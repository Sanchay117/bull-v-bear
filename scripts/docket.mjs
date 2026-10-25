// Convenes the court: the Chainlink CRE workflow runs in the CRE CLI simulator and, with
// --broadcast, files the signed ruling on Sepolia. The transcript it lodges lands in docket/.
//
//   node scripts/docket.mjs             file one case on Sepolia (needs a funded CRE_ETH_PRIVATE_KEY)
//   node scripts/docket.mjs --dry-run   simulate without broadcasting
//   node scripts/docket.mjs --every 3 --until 2026-11-30 --push
//                                       file a case every 3 hours through Nov 30, pushing each one
//
// Runs on a machine logged in to the CRE CLI (`cre login`) with cre/.env. CI can't log in: the CLI
// takes an API key only once Chainlink grants deploy access, which is a commercial agreement.
// 1. Starts a clerk whose data dir is docket/, at the recordsUrl in the workflow config, so the
//    lodged transcript is written to docket/transcripts/<hash>.json.
// 2. Runs the simulation. Groq's free tier allows 8K tokens a minute, about one low-effort
//    trial, so a failed trial is retried twice, 75 s apart. A trial that reached CourtRecord is
//    never retried.
// 3. Keeps the CLI log in docket/runs/, rewrites docket/index.json, and reports a one-line summary.
// 4. With --push, commits docket/ and pushes it. The hosted site reads new transcripts from GitHub.
// With --every, the docket closes on its own at the end of the --until date (required), or after
// three failed sessions in a row.

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const option = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const broadcast = !argv.includes("--dry-run");
const push = argv.includes("--push");
const everyHours = Number(option("--every") ?? 0);
const until = option("--until");
// A dry run files nothing, so its transcript stays out of the public docket.
const docket = broadcast ? join(root, "docket") : join(tmpdir(), "bull-v-bear-dry-run");
const ATTEMPTS = 3;
const GAP_MS = 75_000;
const MAX_FAILURES = 3;

function usage(problem) {
  console.error(`${problem}\nUsage: node scripts/docket.mjs [--dry-run] [--push] [--every <hours> --until <YYYY-MM-DD>]`);
  process.exit(2);
}
if (!(everyHours >= 0)) usage("--every takes a number of hours.");
if (push && !broadcast) usage("A dry run files nothing, so there is nothing to push.");
// The end of the --until day, local time. A schedule without one would run until someone remembers it.
const closesAt = until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? new Date(`${until}T23:59:59`) : null;
if (everyHours && !closesAt) usage("--every needs --until <YYYY-MM-DD>, the day the docket closes.");
if (closesAt && closesAt <= new Date()) usage(`The docket already closed on ${until}.`);

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
    cre.on("error", (err) => resolve({ code: 1, log: `${log}\n${err.message}` }));
    cre.on("close", (code) => resolve({ code, log: log.replace(/\x1b\[[0-9;]*m/g, "") }));
  });
}

const git = (...args) => new Promise((resolve) => spawn("git", args, { cwd: root, stdio: "inherit" }).on("close", (code) => resolve(code === 0)));

/** Commits only docket/, so anything else in the working tree stays out of the record. */
async function enterRecord(summary) {
  const pushed =
    (await git("add", "docket")) &&
    (await git("commit", "-q", "-m", `${summary} [skip render]`, "--", "docket")) &&
    (await git("pull", "-q", "--rebase", "--autostash")) &&
    (await git("push", "-q"));
  console.log(pushed ? "Pushed to the public docket." : "Filed on-chain, but the push failed; the next session pushes it.");
}

const grab = (log, re) => log.match(re)?.[1];

/** One session of the court. Returns the one-line summary, or null when nothing was filed. */
async function convene() {
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
    return null;
  }
  if (!broadcast && run.code !== 0) return null;

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
  if (push) await enterRecord(summary);
  return summary;
}

async function session() {
  try {
    return await convene();
  } catch (err) {
    console.error(`\n${err.message}`);
    return null;
  }
}

if (!everyHours) process.exit((await session()) ? 0 : 1);

console.log(`The docket sits every ${everyHours} hours and closes at the end of ${until}.`);
let failures = 0;
for (;;) {
  failures = (await session()) ? 0 : failures + 1;
  if (failures === MAX_FAILURES) {
    console.error(`\n${MAX_FAILURES} sessions in a row filed nothing, so the docket is closing. Check \`cre whoami\` and try again.`);
    process.exit(1);
  }
  const nextAt = Date.now() + everyHours * 3_600_000;
  if (nextAt > closesAt.getTime()) break;
  const daysLeft = Math.ceil((closesAt.getTime() - Date.now()) / 86_400_000);
  console.log(`\nNext session at ${new Date(nextAt).toLocaleString()}. The docket closes in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`);
  // Short naps on the wall clock: a Mac asleep past the hour (or past the closing date) catches up on waking.
  while (Date.now() < nextAt) await sleep(Math.min(60_000, nextAt - Date.now()));
  if (Date.now() > closesAt.getTime()) break;
}
console.log(`\nThe docket closes at the end of ${until}, so the court is adjourned.`);
