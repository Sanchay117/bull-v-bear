// Demo counsel: a scripted, deterministic stand-in used when no Claude credentials are set.
// It argues from the same exhibits with the same citation rules, so the whole pipeline
// (sentencing, hashing, on-chain filing, verification) runs end to end without an API key.

import {
  fmtUsd,
  normalizeRuling,
  type Argument,
  type CounselInfo,
  type Evidence,
  type Exhibit,
  type JudgeRuling,
  type Round,
  type Side,
} from "@court/core";
import type { Counsel, StreamHooks } from "./counsel.ts";

interface Point {
  exhibit: string;
  /** +1 favors the Bull, -1 the Bear, 0 neutral. */
  lean: number;
  weight: number;
  bull: string;
  bear: string;
  finding: string;
}

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function analyze(e: Evidence): Point[] {
  const { market: m, metrics: x, sentiment: s } = e;
  const id = (kind: Exhibit["kind"]) => e.exhibits.find((ex) => ex.kind === kind)?.id ?? "A";
  const sym = e.asset.symbol;
  const pts: Point[] = [];
  const A = id("price"), B = id("range"), C = id("trend"), D = id("volatility"), E = id("liquidity");

  const c24 = m.change24hPct;
  pts.push({
    exhibit: A,
    lean: Math.abs(c24) < 0.75 ? 0 : Math.sign(c24),
    weight: Math.abs(c24) > 3 ? 3 : 2,
    bull:
      c24 >= 0
        ? `${sym} is ${pct(c24)} on the day and ${pct(m.change1hPct)} in the last hour [Ex. ${A}]; buyers hold the tape, and momentum begets momentum.`
        : m.change7dPct > 0
          ? `The ${pct(c24)} session [Ex. ${A}] is a discount, not a verdict: the seven-day record still reads ${pct(m.change7dPct)} [Ex. ${C}].`
          : `The ${pct(c24)} session [Ex. ${A}] sits inside one ordinary daily move of ${x.dailyVolPct.toFixed(2)}% [Ex. ${D}]; nothing in the record has broken.`,
    bear:
      c24 < 0
        ? `${sym} has shed ${Math.abs(c24).toFixed(2)}% in twenty-four hours [Ex. ${A}], and the hourly print of ${pct(m.change1hPct)} offers no relief.`
        : `A ${pct(c24)} day [Ex. ${A}] is noise, not conviction: it sits inside a single ordinary daily move of ${x.dailyVolPct.toFixed(2)}% [Ex. ${D}].`,
    finding: `${sym} moved ${pct(c24)} over twenty-four hours.`,
  });

  const pos = Math.round(x.rangePosition24h * 100);
  pts.push({
    exhibit: B,
    lean: pos >= 70 ? 1 : pos <= 30 ? -1 : 0,
    weight: 1,
    bull:
      pos >= 50
        ? `Spot holds at ${pos}% of the day's range [Ex. ${B}], pressing the ${fmtUsd(m.high24h)} high; ranges resolve in the direction of the close.`
        : `Spot sits just above the ${fmtUsd(m.low24h)} floor [Ex. ${B}], so the Court's stop rests on ground the market has already defended.`,
    bear:
      pos < 50
        ? `Spot is pinned at ${pos}% of the day's range [Ex. ${B}], near the ${fmtUsd(m.low24h)} low; every bounce has been sold.`
        : `At ${pos}% of the range [Ex. ${B}] there is little room left beneath the ${fmtUsd(m.high24h)} ceiling, the worst possible entry for a long.`,
    finding: `Spot sits at ${pos}% of the twenty-four-hour range.`,
  });

  const up = x.sma24 >= x.sma72;
  const gapPct = x.sma72 > 0 ? (Math.abs(x.sma24 - x.sma72) / x.sma72) * 100 : 0;
  pts.push({
    exhibit: C,
    // A crossover by a hair is not a trend: weight the lean by how far apart the averages are.
    lean: (up ? 1 : -1) * Math.min(1, 0.25 + gapPct / 0.75),
    weight: 3,
    bull: up
      ? `The 24-hour average of ${fmtUsd(x.sma24)} has crossed above the 72-hour average of ${fmtUsd(x.sma72)} [Ex. ${C}]: the short-term trend has turned up.`
      : `Price is only ${x.aboveLow7dPct.toFixed(2)}% above the seven-day low of ${fmtUsd(x.low7d)} [Ex. ${C}]; the downside is largely spent and the risk is defined.`,
    bear: !up
      ? `The 24-hour average of ${fmtUsd(x.sma24)} sits below the 72-hour average of ${fmtUsd(x.sma72)} [Ex. ${C}]: the trend has rolled over.`
      : `Spot remains ${x.drawdownFromHigh7dPct.toFixed(2)}% under the seven-day high of ${fmtUsd(x.high7d)} [Ex. ${C}]; that overhead supply will meet every rally.`,
    finding: `The short-term average is ${up ? "above" : "below"} the 72-hour average.`,
  });

  const rsi = x.rsi14h;
  pts.push({
    exhibit: D,
    lean: rsi >= 70 ? -1 : rsi <= 30 ? 1 : rsi > 55 ? 0.5 : rsi < 45 ? -0.5 : 0,
    weight: rsi >= 70 || rsi <= 30 ? 2 : 1,
    bull:
      rsi <= 30
        ? `An RSI of ${rsi.toFixed(1)} [Ex. ${D}] says the selling is exhausted, not that it has begun.`
        : rsi < 70 && rsi >= 50
          ? `An RSI of ${rsi.toFixed(1)} [Ex. ${D}] shows healthy momentum that is nowhere near overbought.`
          : `Daily volatility of ${x.dailyVolPct.toFixed(2)}% [Ex. ${D}] puts the Court's target within reach of a single session.`,
    bear:
      rsi >= 70
        ? `An RSI of ${rsi.toFixed(1)} [Ex. ${D}] is overbought; the late buyers are the fuel for the reversal.`
        : rsi < 50
          ? `An RSI of ${rsi.toFixed(1)} [Ex. ${D}] confirms momentum is draining out of this market.`
          : `Daily volatility of ${x.dailyVolPct.toFixed(2)}% [Ex. ${D}] means any long is one bad hour from its stop.`,
    finding: `Hourly RSI reads ${rsi.toFixed(1)} with ${x.dailyVolPct.toFixed(2)}% daily volatility.`,
  });

  const t = x.turnoverPct;
  pts.push({
    exhibit: E,
    lean: t >= 6 ? Math.sign(c24) * 0.5 : 0,
    weight: 1,
    bull:
      c24 >= 0
        ? `Turnover of ${t.toFixed(2)}% of market capitalization [Ex. ${E}] shows real participation behind the advance.`
        : `Turnover of ${t.toFixed(2)}% [Ex. ${E}] is orderly; this is rotation, not capitulation.`,
    bear:
      c24 < 0
        ? `Turnover of ${t.toFixed(2)}% on a down day [Ex. ${E}] is distribution, not accumulation.`
        : `Turnover of just ${t.toFixed(2)}% [Ex. ${E}] means the advance has no sponsorship.`,
    finding: `Volume equals ${t.toFixed(2)}% of market capitalization.`,
  });

  if (s) {
    const F = id("sentiment");
    const weekAgo = s.history[0] ?? s.value;
    const rising = s.value > weekAgo;
    pts.push({
      exhibit: F,
      lean: s.value >= 75 ? -1 : s.value <= 25 ? 1 : rising ? 0.5 : -0.5,
      weight: s.value >= 75 || s.value <= 25 ? 2 : 1,
      bull:
        s.value <= 45
          ? `The Fear & Greed Index at ${s.value}, "${s.label}" [Ex. ${F}], is where durable bottoms are made.`
          : `Sentiment has moved from ${weekAgo} to ${s.value} [Ex. ${F}]; the crowd is ${rising ? "arriving" : "already washed out"}.`,
      bear:
        s.value >= 55
          ? `With the Fear & Greed Index at ${s.value}, "${s.label}" [Ex. ${F}], this market is priced for perfection.`
          : `Sentiment of ${s.value}, "${s.label}" [Ex. ${F}], shows no buyer is coming to the rescue.`,
      finding: `Fear & Greed reads ${s.value} (${s.label}), from ${weekAgo} a week earlier.`,
    });
  }
  return pts;
}

function strength(p: Point, side: Side): number {
  const dir = side === "BULL" ? 1 : -1;
  return p.weight * (p.lean * dir > 0 ? 1 : p.lean === 0 ? 0.45 : 0.2);
}

function pickPoints(pts: Point[], side: Side, exclude: string[] = []): Point[] {
  return pts
    .filter((p) => !exclude.includes(p.exhibit))
    .map((p, i) => ({ p, s: strength(p, side) - i * 0.001 }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

export class DemoCounsel implements Counsel {
  info: CounselInfo = { mode: "demo", model: "demo-counsel/1", venue: "clerk" };

  private async speak(text: string, hooks: StreamHooks) {
    for (const word of text.split(/(?<=\s)/)) {
      hooks.onText(word);
      await sleep(14 + Math.random() * 26);
    }
  }

  private async muse(lines: string[], hooks: StreamHooks) {
    for (const l of lines) {
      hooks.onNotes(l + " ");
      await sleep(160);
    }
  }

  async argue(e: Evidence, side: Side, round: Round, opponent: Argument | null, hooks: StreamHooks): Promise<string> {
    const pts = analyze(e);
    const say = (p: Point) => (side === "BULL" ? p.bull : p.bear);
    let text: string;
    if (round === "opening" || !opponent) {
      await this.muse([`Ranking the exhibits for the ${side === "BULL" ? "long" : "short"} case.`, "Leading with the trend, conceding nothing I cannot outweigh."], hooks);
      const top = pickPoints(pts, side).slice(0, 3);
      text =
        "May it please the Court. " +
        top.map((p, i) => `${i + 1}. ${say(p)}`).join(" ") +
        (side === "BULL" ? " The Bull rests." : " The Bear rests.");
    } else {
      await this.muse(["Opposing counsel leaned on exhibits I can turn.", "Answering their two strongest cites."], hooks);
      // Answer the opponent's exhibits with points not already made in our own opening.
      const ownOpening = pickPoints(pts, side).slice(0, 3).map((p) => p.exhibit);
      const fresh = pts.filter((p) => !ownOpening.includes(p.exhibit));
      const answers = fresh.filter((p) => opponent.citations.includes(p.exhibit));
      const chosen = pickPoints(answers.length >= 2 ? answers : fresh.length ? fresh : pts, side).slice(0, 2);
      const other = side === "BULL" ? "the Bear" : "the Bull";
      text =
        `Your Honor, counsel for ${other} reads the record selectively. ` +
        chosen.map((p) => `On Exhibit ${p.exhibit}: ${say(p)}`).join(" ") +
        " Nothing further.";
    }
    await this.speak(text, hooks);
    return text;
  }

  async judge(e: Evidence, args: Argument[], hooks: StreamHooks): Promise<JudgeRuling> {
    await this.muse(["Weighing each exhibit on its own terms.", "Trend and momentum carry the most weight; sentiment is read contrarian at the extremes."], hooks);
    const pts = analyze(e);
    const score = pts.reduce((acc, p) => acc + p.lean * p.weight, 0);
    const verdict = Math.abs(score) < 1.5 ? "DISMISSED" : score > 0 ? "LONG" : "SHORT";
    const conviction = verdict === "DISMISSED" ? 40 + Math.round(Math.abs(score) * 6) : Math.min(88, 56 + Math.round(Math.abs(score) * 5));
    const winner = verdict === "LONG" ? "BULL" : verdict === "SHORT" ? "BEAR" : score >= 0 ? "BULL" : "BEAR";
    const loser: Side = winner === "BULL" ? "BEAR" : "BULL";
    const support = pts.filter((p) => p.lean * (winner === "BULL" ? 1 : -1) > 0).map((p) => p.exhibit);
    const cites = support.length ? support.map((s) => `Ex. ${s}`).join(", ") : "Ex. A";
    const sym = e.asset.symbol;
    const bestLoser = pickPoints(pts, loser)[0];
    const raw = {
      holding:
        verdict === "DISMISSED"
          ? `The Court finds the ${sym} record evenly balanced and dismisses the motion without a position.`
          : `The Court finds for the ${winner === "BULL" ? "Bull" : "Bear"}: the weight of the ${sym} record favors a ${verdict.toLowerCase()} practice position.`,
      verdict,
      conviction,
      bull_score: Math.max(3, Math.min(9, 6 + Math.round(score))),
      bear_score: Math.max(3, Math.min(9, 6 - Math.round(score))),
      findings: pts.map((p) => ({
        exhibit: p.exhibit,
        finding: p.finding,
        favors: p.lean > 0 ? "BULL" : p.lean < 0 ? "BEAR" : "NEUTRAL",
        weight: p.weight,
      })),
      opinion:
        verdict === "DISMISSED"
          ? `Having weighed each exhibit, the Court finds the evidence pulls in opposite directions with roughly equal force. The trend reading [Ex. ${pts[2]?.exhibit ?? "C"}] is offset by momentum and sentiment, and neither counsel carried the burden of showing a consistent cause-and-effect chain. A practice position would rest on a coin toss. The motion is dismissed.`
          : `The ${winner === "BULL" ? "Bull" : "Bear"} carried the burden. The record shows a consistent chain from evidence to effect: the trend [Ex. ${pts[2]?.exhibit ?? "C"}] and the session's move [Ex. ${pts[0]?.exhibit ?? "A"}] point the same way, and the supporting exhibits (${cites}) are not rebutted by anything of comparable weight. Opposing counsel's best points go to timing, not direction. Net weighted score: ${score.toFixed(1)}. So ordered.`,
      dissent: bestLoser ? `For the ${loser === "BULL" ? "Bull" : "Bear"}: ${(loser === "BULL" ? bestLoser.bull : bestLoser.bear).replace(/\s*\[Ex\. [A-Z, ]+\]/g, "")}` : "",
    };
    void args;
    return normalizeRuling(raw, e.exhibits.map((x) => x.id));
  }
}
