// Runs the CRE CLI simulation of the workflow and saves its log for the film:
// public/capture/simulate.json ({ title, command, lines }). Needs `cre login` first.
//
//   node scripts/simulate.ts [--broadcast]

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const creDir = join(root, "..", "cre");
const args = ["workflow", "simulate", "bull-v-bear", "--target", "staging-settings", "--non-interactive", "--trigger-index", "0"];
if (process.argv.includes("--broadcast")) args.push("--broadcast");

const bin = process.env.CRE_BIN ?? join(homedir(), ".cre", "bin", "cre");
const run = spawnSync(bin, args, { cwd: creDir, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
// The CLI prints its setup steps on stderr before the run on stdout; show them in that order.
const raw = `${run.stderr ?? ""}${run.stdout ?? ""}`;
// Strip colours and cursor codes and the CLI's update notice; keep what a person would read.
const lines = raw
  .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
  .split(/\r?\n/)
  .map((l) => l.replace(/\s+$/, ""))
  .filter((l) => !/Update available|`cre update`/.test(l))
  .filter((l, i, all) => l || (all[i - 1] ?? "") !== "");

process.stdout.write(raw);
if (run.status !== 0) {
  console.error(`\ncre exited with ${run.status}; nothing saved.`);
  process.exit(run.status ?? 1);
}
mkdirSync(join(root, "public", "capture"), { recursive: true });
writeFileSync(
  join(root, "public", "capture", "simulate.json"),
  JSON.stringify({ title: "cre workflow simulate", command: `cre ${args.join(" ")}`, lines }, null, 2) + "\n",
);
console.log(`\nSaved ${lines.length} lines → public/capture/simulate.json`);
