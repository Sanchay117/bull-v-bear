// The clerk's filing cabinet: full transcripts keyed by their keccak256 hash.
// The chain holds the hash; this holds the words. Anyone can recompute one from the other.

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

export function saveTranscript(entry: FiledTranscript): void {
  const computed = transcriptHash(entry.transcript);
  if (computed !== entry.transcriptHash) throw new Error("Transcript does not match its hash");
  mkdirSync(dir(), { recursive: true });
  writeFileSync(join(dir(), `${computed}.json`), JSON.stringify(entry, null, 2));
}

export function loadTranscript(hash: string): FiledTranscript | null {
  if (!/^0x[0-9a-f]{64}$/.test(hash)) return null;
  const file = join(dir(), `${hash}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as FiledTranscript) : null;
}

export function listTranscriptHashes(): Set<string> {
  if (!existsSync(dir())) return new Set();
  return new Set(readdirSync(dir()).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)));
}
