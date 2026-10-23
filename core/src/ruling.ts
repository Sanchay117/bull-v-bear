// The bench's output is untrusted model text until it passes through here.

import type { Finding, JudgeRuling, Side, Verdict } from "./types.ts";

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Validates and clamps a raw ruling object. Throws only if the verdict itself is unusable. */
export function normalizeRuling(raw: unknown, exhibitIds: string[]): JudgeRuling {
  if (!raw || typeof raw !== "object") throw new Error("Ruling is not an object");
  const r = raw as Record<string, unknown>;
  const verdict = String(r.verdict ?? "").toUpperCase() as Verdict;
  if (!["LONG", "SHORT", "DISMISSED"].includes(verdict)) throw new Error(`Invalid verdict ${String(r.verdict)}`);

  let conviction = clampInt(r.conviction, 0, 100, 50);
  if (verdict === "DISMISSED") conviction = Math.min(conviction, 54);

  const findings: Finding[] = (Array.isArray(r.findings) ? r.findings : [])
    .map((f): Finding | null => {
      if (!f || typeof f !== "object") return null;
      const x = f as Record<string, unknown>;
      // Accepts "B", "Ex. B" or "Exhibit B"; the letter is always last.
      const exhibit = String(x.exhibit ?? "").toUpperCase().match(/([A-Z])[^A-Z]*$/)?.[1] ?? "";
      if (!exhibitIds.includes(exhibit)) return null;
      const favors = String(x.favors ?? "NEUTRAL").toUpperCase();
      return {
        exhibit,
        finding: str(x.finding, 400),
        favors: (favors === "BULL" || favors === "BEAR" ? favors : "NEUTRAL") as Side | "NEUTRAL",
        weight: clampInt(x.weight, 1, 3, 1),
      };
    })
    .filter((f): f is Finding => f !== null)
    .slice(0, 8);

  let holding = str(r.holding, 240);
  if (!holding) holding = `The Court finds for ${verdict === "LONG" ? "the Bull" : verdict === "SHORT" ? "the Bear" : "neither party"}.`;

  return {
    holding,
    verdict,
    conviction,
    bull_score: clampInt(r.bull_score, 0, 10, 5),
    bear_score: clampInt(r.bear_score, 0, 10, 5),
    findings,
    opinion: str(r.opinion, 2000),
    dissent: str(r.dissent, 800),
  };
}

/** Pulls the first JSON object out of a model response (tolerates stray prose or code fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in ruling");
  return JSON.parse(text.slice(start, end + 1));
}
