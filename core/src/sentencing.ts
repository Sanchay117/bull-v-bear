// Sentencing Guidelines for Practice Positions. The judge decides direction and conviction;
// these fixed, transparent rules turn that into an exact practice position. No model output
// touches the arithmetic, so every number on the order can be re-derived by hand.

import { fmtUsd, priceDecimals, round } from "./evidence.ts";
import { GUIDELINES_VERSION, type Evidence, type JudgeRuling, type Sentence, type StandingOrders } from "./types.ts";

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function sentence(ruling: JudgeRuling, e: Evidence, orders: StandingOrders): Sentence {
  // The mark is the Chainlink feed when it is in the record, so the court never scores its own
  // positions against the API its counsel argued from. CourtRecord settles the prior position at it.
  const oracleEx = e.oracle ? e.exhibits.find((x) => x.kind === "oracle") : undefined;
  const entry = e.oracle && oracleEx ? e.oracle.price : e.market.price;
  const dp = priceDecimals(entry);
  const steps: Sentence["steps"] = [];
  steps.push({
    label: "Mark price",
    formula: oracleEx ? `Chainlink ${e.oracle!.pair} Data Feed [Ex. ${oracleEx.id}]` : `spot price [Ex. ${e.exhibits[0]?.id ?? "A"}]`,
    value: fmtUsd(entry),
  });
  const none = (reason: string): Sentence => ({
    action: "NO_POSITION",
    reason,
    entryPrice: entry,
    stopPrice: 0,
    targetPrice: 0,
    sizeBps: 0,
    stopDistancePct: 0,
    steps,
    guidelines: GUIDELINES_VERSION,
  });

  steps.push({ label: "§1(a) Verdict", formula: "from the bench", value: ruling.verdict });
  if (ruling.verdict === "DISMISSED") return none("The case was dismissed; no practice position is ordered.");

  steps.push({
    label: "§1(b) Conviction threshold",
    formula: `conviction ${ruling.conviction} ≥ standing minimum ${orders.minConviction}`,
    value: ruling.conviction >= orders.minConviction ? "met" : "not met",
  });
  if (ruling.conviction < orders.minConviction) {
    return none(`Conviction ${ruling.conviction} is below the standing minimum of ${orders.minConviction}; no position is ordered.`);
  }

  const vol = e.metrics.dailyVolPct;
  const stopPct = round(clamp(orders.stopVolMultiple * vol, 1, 12), 2);
  steps.push({
    label: "§2 Stop distance",
    formula: `clamp(${orders.stopVolMultiple} × daily vol ${vol.toFixed(2)}%, 1%, 12%)`,
    value: `${stopPct.toFixed(2)}%`,
  });

  const scale = round(clamp((ruling.conviction - orders.minConviction) / (100 - orders.minConviction), 0.15, 1), 3);
  steps.push({
    label: "§3 Conviction scale",
    formula: `clamp((${ruling.conviction} − ${orders.minConviction}) ÷ (100 − ${orders.minConviction}), 0.15, 1)`,
    value: scale.toFixed(3),
  });

  const riskBps = round(orders.riskPerTradeBps * scale, 1);
  steps.push({
    label: "§4 Risk budget",
    formula: `${orders.riskPerTradeBps} bps × ${scale.toFixed(3)}`,
    value: `${riskBps} bps of bankroll`,
  });

  const rawSize = (riskBps * 100) / stopPct;
  const sizeBps = Math.max(1, Math.round(Math.min(orders.maxPositionBps, rawSize)));
  steps.push({
    label: "§5 Position size",
    formula: `min(cap ${orders.maxPositionBps} bps, ${riskBps} bps ÷ ${stopPct.toFixed(2)}%)`,
    value: `${sizeBps} bps (${(sizeBps / 100).toFixed(2)}% of bankroll)`,
  });

  const long = ruling.verdict === "LONG";
  const stopPrice = round(entry * (1 + (long ? -1 : 1) * (stopPct / 100)), dp);
  const targetPrice = round(entry * (1 + (long ? 1 : -1) * (stopPct / 100) * orders.rewardRiskRatio), dp);
  steps.push({
    label: "§6 Protective order (stop)",
    formula: `entry ${long ? "−" : "+"} ${stopPct.toFixed(2)}%`,
    value: String(stopPrice),
  });
  steps.push({
    label: "§7 Target",
    formula: `entry ${long ? "+" : "−"} ${orders.rewardRiskRatio} × ${stopPct.toFixed(2)}%`,
    value: String(targetPrice),
  });

  return {
    action: ruling.verdict,
    reason: `The ${long ? "Bull" : "Bear"} prevailed with conviction ${ruling.conviction}.`,
    entryPrice: entry,
    stopPrice,
    targetPrice,
    sizeBps,
    stopDistancePct: stopPct,
    steps,
    guidelines: GUIDELINES_VERSION,
  };
}
