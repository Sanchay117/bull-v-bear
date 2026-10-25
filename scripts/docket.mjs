// Convenes the court once: the Chainlink CRE workflow runs in the CRE CLI simulator and, with
// --broadcast, files the signed ruling on Sepolia. The transcript it lodges lands in docket/.
//
//   node scripts/docket.mjs             file on Sepolia (needs a funded CRE_ETH_PRIVATE_KEY)
//   node scripts/docket.mjs --dry-run   simulate without broadcasting
//
// Runs in .github/workflows/docket.yml every three hours, and locally after `cre login` with cre/.env.
// 1. Starts a clerk whose data dir is docket/, at the recordsUrl in the workflow config, so the
//    lodged transcript is written to docket/transcripts/<hash>.json.
// 2. Runs the simulation. Groq's free tier allows 8K tokens a minute, about one trial, so a failed
//    trial is retried twice, 75 s apart. A trial that reached CourtRecord is never retried.
// 3. Keeps the CLI log in docket/runs/, rewrites docket/index.json, and reports a one-line summary.

import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const broadcast = !process.argv.includes("--dry-run");
// A dry run files nothing, so its transcript stays out of the public docket.
const docket = broadcast ? join(root, "docket") : join(tmpdir(), "bull-v-bear-dry-run");
const ATTEMPTS = 3;
const GAP_MS = 75_000;

const config = JSON.parse(readFileSync(join(root, "cre/bull-v-bear/config.staging.json"), "utf8"));
const clerkUrl = new URL(config.recordsUrl);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clerkIsUp() {
  try {
    return (await fetch(new URL("/api/status", clerkUrl), { signal: AbortSignal.timeout(2_000) })).ok;
  } catch {
    return false;
  }
}

async function startClerk() {
  if (await clerkIsUp()) throw new Error(`Port ${clerkUrl.port} is taken; stop the running clerk first.`);
  const clerk = spawn("npm", ["start", "--workspace", "server"], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, PORT: clerkUrl.port, CHAIN_MODE: "off", COUNSEL: "demo", DATA_DIR: docket },
  });
  for (let i = 0; i < 60; i++) {
    if (await clerkIsUp()) return clerk;
    await sleep(500);
  }
  process.kill(-clerk.pid);
  throw new Error("The clerk did not start");
}

function simulate() {
  const args = ["workflow", "simulate", "bull-v-bear", "--target", "staging-settings", "--non-interactive", "--trigger-index", "0"];
  if (broadcast) args.push("--broadcast");
  return new Promise((resolve) => {
    const cre = spawn("cre", args, { cwd: join(root, "cre"), env: process.env });
    let log = "";
    const keep = (chunk) => {
      process.stdout.write(chunk);
      log += chunk;
    };
    cre.stdout.on("data", keep);
    cre.stderr.on("data", keep);
    cre.on("close", (code) => resolve({ code, log: log.replace(/\x1b\[[0-9;]*m/g, "") }));
  });
}

const grab = (log, re) => log.match(re)?.[1];

const clerk = await startClerk();
let run;
try {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    console.log(`\n⚖  Convening the court (attempt ${attempt} of ${ATTEMPTS}${broadcast ? ", broadcasting to Sepolia" : ", dry run"})\n`);
    run = await simulate();
    const filed = /Entered into CourtRecord/.test(run.log);
    if (filed || (!broadcast && run.code === 0)) break;
    if (attempt < ATTEMPTS) await sleep(GAP_MS);
  }
} finally {
  process.kill(-clerk.pid);
}

const caseNo = grab(run.log, /case No\. (\d+) is next/);
const caption = grab(run.log, /Court is in session: (In re \S+)/);
const ruling = grab(run.log, /RULING (\w+ @ \d+)/);
const tx = grab(run.log, /Entered into CourtRecord \S+: tx (0x[0-9a-f]{64})/);
if (broadcast && !tx) {
  console.error("\nThe court could not reach a filed ruling this session.");
  process.exit(1);
}
if (!broadcast && run.code !== 0) process.exit(run.code ?? 1);

// Keep the CLI log of the filed run (the CLI prints no secrets) beside the transcripts.
const logFile = join(docket, "runs", `case-${caseNo ?? "unnumbered"}.log`);
mkdirSync(dirname(logFile), { recursive: true });
writeFileSync(logFile, run.log.replace(/^.*(Update available|`cre update`).*\n?/gm, ""));

mkdirSync(join(docket, "transcripts"), { recursive: true });
const hashes = readdirSync(join(docket, "transcripts"))
  .filter((f) => /^0x[0-9a-f]{64}\.json$/.test(f))
  .map((f) => f.slice(0, -5))
  .sort();
writeFileSync(join(docket, "index.json"), `${JSON.stringify(hashes, null, 1)}\n`);

const summary = `Docket: case No. ${caseNo} ${caption}, ${ruling}${broadcast ? ` (tx ${tx.slice(0, 10)})` : ` (dry run, log in ${logFile})`}`;
console.log(`\n${summary}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `summary=${summary}\n`);
if (process.env.GITHUB_STEP_SUMMARY && tx) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${summary}\n\nhttps://sepolia.etherscan.io/tx/${tx}\n`);
}
