// The Record: canonical serialization, hashing, and the ABI report filed on-chain.

import { encodeAbiParameters, keccak256, parseAbiParameters, stringToHex, toBytes, type Hex } from "viem";
import { priceDecimals, round } from "./evidence.ts";
import { VERDICT_CODE, type Exhibit, type Transcript } from "./types.ts";

/** JSON with recursively sorted keys and no whitespace: the form that gets hashed. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) return "null";
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

export function hashCanonical(value: unknown): Hex {
  return keccak256(toBytes(canonicalize(value)));
}

export const transcriptHash = (t: Transcript): Hex => hashCanonical(t);
export const evidenceHash = (exhibits: Exhibit[]): Hex => hashCanonical(exhibits);

/** USD → uint64 with 8 decimals. Rounded at the asset's display precision first so it is exact. */
export function toUsd8(n: number): bigint {
  if (!(n > 0)) return 0n;
  const dp = priceDecimals(n);
  const [int, frac = ""] = round(n, dp).toFixed(dp).split(".");
  return BigInt(int) * 10n ** 8n + BigInt((frac + "00000000").slice(0, 8));
}

export function fromUsd8(v: bigint): number {
  return Number(v) / 1e8;
}

export function assetToBytes32(symbol: string): Hex {
  return stringToHex(symbol, { size: 32 });
}

export function bytes32ToAsset(b: Hex): string {
  const bytes = toBytes(b);
  let s = "";
  for (const c of bytes) {
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

export const REPORT_PARAMS = parseAbiParameters(
  "bytes32 asset, uint8 verdict, uint8 conviction, uint16 sizeBps, uint64 entryPrice, uint64 stopPrice, uint64 targetPrice, uint64 trialTime, bytes32 transcriptHash, bytes32 evidenceHash, string holding",
);

export interface FilingSummary {
  transcriptHash: Hex;
  evidenceHash: Hex;
  report: Hex;
}

/** Builds the exact bytes the CRE DON signs and the forwarder delivers to CourtRecord.onReport. */
export function buildFiling(t: Transcript): FilingSummary {
  const tHash = transcriptHash(t);
  const eHash = evidenceHash(t.exhibits);
  const s = t.sentence;
  const report = encodeAbiParameters(REPORT_PARAMS, [
    assetToBytes32(t.asset),
    VERDICT_CODE[t.ruling.verdict],
    t.ruling.conviction,
    s.sizeBps,
    toUsd8(s.entryPrice),
    toUsd8(s.stopPrice),
    toUsd8(s.targetPrice),
    BigInt(Math.floor(Date.parse(t.openedAt) / 1000)),
    tHash,
    eHash,
    t.ruling.holding.slice(0, 200),
  ]);
  return { transcriptHash: tHash, evidenceHash: eHash, report };
}
