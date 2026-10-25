// The clerk's filing cabinet: full transcripts keyed by their keccak256 hash.
// The chain holds the hash; this holds the words. Anyone can recompute one from the other.
//
// Three drawers, searched in order: this clerk's own data dir, the public docket shipped with the
// build (docket/transcripts, committed by the scheduled CRE runs), and the live public docket at
// DOCKET_URL for transcripts committed since the build. Every transcript is re-hashed on the way in.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Hex } from "viem";
import { transcriptHash, type Transcript } from "@court/core";
import { config } from "./config.ts";

export interface FiledTranscript {
  transcript: Transcript;
  transcriptHash: Hex;
  filing?: { txHash?: Hex; blockNumber?: number; caseNumber?: number; chainId?: number; venue: "clerk" | "cre" };
}

const dir = () => join(config.dataDir, "transcripts");
const docketDir = () => join(config.docketDir, "transcripts");
const HASH = /^0x[0-9a-f]{64}$/;

export function saveTranscript(entry: FiledTranscript): void {
  const computed = transcriptHash(entry.transcript);
  if (computed !== entry.transcriptHash) throw new Error("Transcript does not match its hash");
  mkdirSync(dir(), { recursive: true });
  writeFileSync(join(dir(), `${computed}.json`), JSON.stringify(entry, null, 2));
}

function readLocal(hash: string): FiledTranscript | null {
  for (const d of [dir(), docketDir()]) {
    const file = join(d, `${hash}.json`);
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as FiledTranscript;
  }
  return null;
}

export async function loadTranscript(hash: string): Promise<FiledTranscript | null> {
  if (!HASH.test(hash)) return null;
  const local = readLocal(hash);
  if (local || !config.docketUrl || !(await remoteIndex()).has(hash)) return local;
  try {
    const res = await fetch(`${config.docketUrl}/transcripts/${hash}.json`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const entry = (await res.json()) as FiledTranscript;
    // Only words that hash to the requested record are kept.
    saveTranscript({ ...entry, transcriptHash: hash as Hex });
    return entry;
  } catch {
    return null;
  }
}

const listDir = (d: string) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)) : []);

let index: { at: number; hashes: Set<string> } = { at: 0, hashes: new Set() };

/** docket/index.json on the live docket, re-read at most every two minutes. */
async function remoteIndex(): Promise<Set<string>> {
  if (!config.docketUrl || Date.now() - index.at < 120_000) return index.hashes;
  try {
    const res = await fetch(`${config.docketUrl}/index.json`, { signal: AbortSignal.timeout(5_000) });
    if (res.ok) index = { at: Date.now(), hashes: new Set(((await res.json()) as string[]).filter((h) => HASH.test(h))) };
  } catch {
    // keep the last good index
  }
  index.at = Date.now();
  return index.hashes;
}

export async function listTranscriptHashes(): Promise<Set<string>> {
  return new Set([...listDir(dir()), ...listDir(docketDir()), ...(await remoteIndex())]);
}
