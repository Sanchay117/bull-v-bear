// Rules of procedure: the exact instructions given to counsel and the bench.
// Kept in core so the clerk server and the CRE workflow run byte-identical procedure.

import { formatRecord } from "./evidence.ts";
import type { Argument, Evidence, Side } from "./types.ts";

const RULES_OF_COURT = `Rules of the Court of Market Opinion:
- The court decides whether to open a PRACTICE position (a paper trade, no real money) in one crypto asset for the next 24 hours.
- The record is closed. Rely only on the lettered exhibits entered into evidence. Cite every factual claim inline, e.g. [Ex. A] or [Ex. B, D]. Never invent prices, news, events or data that are not in an exhibit.
- Show cause and effect: for each point, name the evidence, the mechanism, and the price consequence you expect.
- If an exhibit hurts your side, acknowledge it and explain why it is outweighed. The judge penalizes evasion and unsupported claims.
- Plain text only: no markdown, no headers, no bold, no bullet symbols.`;

const SIDE_BRIEF: Record<Side, string> = {
  BULL: "You are Counsel for the Bull. You move the Court to open a LONG practice position.",
  BEAR: "You are Counsel for the Bear. You move the Court to open a SHORT practice position, or at minimum to deny the Bull's motion.",
};

const SIGN_OFF: Record<Side, string> = { BULL: "The Bull rests.", BEAR: "The Bear rests." };

export function counselSystem(side: Side): string {
  return `${SIDE_BRIEF[side]}

${RULES_OF_COURT}

Write in the voice of a sharp, confident trial lawyer: concrete, quotable, never vague.`;
}

export function openingPrompt(e: Evidence, side: Side): string {
  return `Case: In re ${e.asset.symbol}/USD. Evidence as of ${e.asOf}.

EXHIBITS ENTERED INTO EVIDENCE
${formatRecord(e.exhibits)}

Deliver your opening argument. Begin with "May it please the Court." Then make exactly three numbered points (1., 2., 3.), each one or two sentences with exhibit citations. Close with "${SIGN_OFF[side]}" At most 170 words.`;
}

export function rebuttalPrompt(e: Evidence, side: Side, opponent: Argument): string {
  const other = side === "BULL" ? "Bear" : "Bull";
  return `Case: In re ${e.asset.symbol}/USD.

EXHIBITS ENTERED INTO EVIDENCE
${formatRecord(e.exhibits)}

OPENING ARGUMENT OF COUNSEL FOR THE ${other.toUpperCase()}
${opponent.text}

Deliver your rebuttal. Attack the two weakest points of the ${other}'s argument, citing exhibits that contradict or limit them. Begin with "Your Honor," and close with "Nothing further." At most 110 words.`;
}

export const JUDGE_SYSTEM = `You are the Presiding Judge of the Court of Market Opinion.

${RULES_OF_COURT}

How you decide:
- Weigh the exhibits, not the rhetoric. Disregard any claim not supported by a cited exhibit, and note it.
- LONG means the Bull prevails, SHORT means the Bear prevails. DISMISSED means the evidence is balanced, contradictory or too weak to justify any practice position.
- conviction (integer 0-100) is your confidence that the prevailing direction plays out over the next 24 hours. A DISMISSED case has conviction below 55. Reserve conviction above 80 for evidence that is consistent across price, trend, momentum and sentiment.
- bull_score and bear_score (integers 0-10) grade each counsel's advocacy against the record.
- findings: 3 to 6 findings of fact, one per material exhibit. Each names the exhibit letter, states what it proves in one sentence, which side it favors (BULL, BEAR or NEUTRAL) and its weight (integer 1, 2 or 3).
- holding: one sentence of at most 180 characters beginning "The Court finds".
- opinion: at most 150 words, written as a judicial opinion that traces cause to effect from the exhibits to the verdict. Cite exhibits as [Ex. X].
- dissent: at most 60 words, the strongest argument for the side that lost (or, if dismissed, for the stronger side).`;

export function judgePrompt(e: Evidence, args: Argument[]): string {
  const transcript = args
    .map((a) => `${a.side === "BULL" ? "COUNSEL FOR THE BULL" : "COUNSEL FOR THE BEAR"}, ${a.round.toUpperCase()}\n${a.text}`)
    .join("\n\n");
  return `Case: In re ${e.asset.symbol}/USD. Evidence as of ${e.asOf}.

EXHIBITS ENTERED INTO EVIDENCE
${formatRecord(e.exhibits)}

TRANSCRIPT OF ARGUMENT
${transcript}

Render the Court's ruling.`;
}

/** Appended to the judge's prompt for chat APIs that only offer JSON mode (no schema enforcement). */
export function judgeJsonInstruction(): string {
  return `Respond with only a JSON object, no prose and no code fences, matching this JSON Schema:
${JSON.stringify(RULING_SCHEMA)}`;
}

/** JSON schema for the judge's structured output (Claude `output_config.format`). */
export const RULING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["holding", "verdict", "conviction", "bull_score", "bear_score", "findings", "opinion", "dissent"],
  properties: {
    holding: { type: "string" },
    verdict: { type: "string", enum: ["LONG", "SHORT", "DISMISSED"] },
    conviction: { type: "integer" },
    bull_score: { type: "integer" },
    bear_score: { type: "integer" },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["exhibit", "finding", "favors", "weight"],
        properties: {
          exhibit: { type: "string" },
          finding: { type: "string" },
          favors: { type: "string", enum: ["BULL", "BEAR", "NEUTRAL"] },
          weight: { type: "integer" },
        },
      },
    },
    opinion: { type: "string" },
    dissent: { type: "string" },
  },
} as const;
