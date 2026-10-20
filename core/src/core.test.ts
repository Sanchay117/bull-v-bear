import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeAbiParameters } from "viem";
import {
  ASSETS,
  DEFAULT_ORDERS,
  REPORT_PARAMS,
  buildEvidence,
  buildFiling,
  canonicalize,
  extractCitations,
  fmtUsd,
  normalizeRuling,
  parseCoinGeckoMarket,
  parseFearGreed,
  sentence,
  toUsd8,
  transcriptHash,
  type JudgeRuling,
  type Transcript,
} from "./index.ts";

const ETH = ASSETS[0];

function sampleMarket() {
  const spark = Array.from({ length: 168 }, (_, i) => 3000 + 40 * Math.sin(i / 9) + i * 0.8);
  return parseCoinGeckoMarket([
    {
      current_price: 3142.17,
      price_change_percentage_1h_in_currency: 0.21,
      price_change_percentage_24h_in_currency: -1.37,
      price_change_percentage_7d_in_currency: 4.9,
      high_24h: 3201.5,
      low_24h: 3088.02,
      total_volume: 18_400_000_000,
      market_cap: 378_000_000_000,
      sparkline_in_7d: { price: spark },
      last_updated: "2026-10-20T12:00:00.000Z",
    },
  ]);
}

const sentiment = parseFearGreed({
  data: [
    { value: "61", value_classification: "Greed" },
    { value: "55", value_classification: "Greed" },
    { value: "48", value_classification: "Neutral" },
  ],
});

const ruling = (over: Partial<JudgeRuling> = {}): JudgeRuling => ({
  holding: "The Court finds for the Bull.",
  verdict: "LONG",
  conviction: 72,
  bull_score: 8,
  bear_score: 6,
  findings: [],
  opinion: "",
  dissent: "",
  ...over,
});

test("exhibits are lettered, deterministic and cite real numbers", () => {
  const e1 = buildEvidence(ETH, sampleMarket(), sentiment);
  const e2 = buildEvidence(ETH, sampleMarket(), sentiment);
  assert.deepEqual(e1.exhibits, e2.exhibits);
  assert.deepEqual(
    e1.exhibits.map((x) => x.id),
    ["A", "B", "C", "D", "E", "F"],
  );
  assert.match(e1.exhibits[0].statement, /\$3,142\.17/);
  assert.match(e1.exhibits[5].statement, /reads 61 \("Greed"\), versus 48 2 days earlier/);
  assert.ok(e1.metrics.dailyVolPct > 0);
});

test("fmtUsd groups thousands without Intl", () => {
  assert.equal(fmtUsd(1234567.891), "$1,234,567.89");
  assert.equal(fmtUsd(0.123456), "$0.123456");
  assert.equal(fmtUsd(12.5), "$12.5000");
});

test("citations are extracted from counsel's text", () => {
  const ids = ["A", "B", "C", "D"];
  assert.deepEqual(extractCitations("Price fell [Ex. B] and [Ex. A, D]; see also [Exhibit C] and [Ex. Z].", ids), [
    "A",
    "B",
    "C",
    "D",
  ]);
});

test("ruling normalization clamps and drops bad findings", () => {
  const r = normalizeRuling(
    {
      verdict: "dismissed",
      conviction: 90,
      bull_score: 14,
      bear_score: -2,
      holding: "The Court finds the evidence balanced.",
      findings: [
        { exhibit: "Ex. B", finding: "Range is mid.", favors: "neutral", weight: 7 },
        { exhibit: "Q", finding: "nope", favors: "BULL", weight: 1 },
      ],
      opinion: "x",
      dissent: "y",
    },
    ["A", "B"],
  );
  assert.equal(r.verdict, "DISMISSED");
  assert.equal(r.conviction, 54);
  assert.equal(r.bull_score, 10);
  assert.equal(r.bear_score, 0);
  assert.deepEqual(r.findings, [{ exhibit: "B", finding: "Range is mid.", favors: "NEUTRAL", weight: 3 }]);
});

test("sentencing follows the guidelines exactly", () => {
  const e = buildEvidence(ETH, sampleMarket(), sentiment);
  const s = sentence(ruling(), e, DEFAULT_ORDERS);
  assert.equal(s.action, "LONG");
  const expectedStop = Math.min(12, Math.max(1, 1.25 * e.metrics.dailyVolPct));
  assert.ok(Math.abs(s.stopDistancePct - expectedStop) < 0.01);
  assert.ok(s.stopPrice < s.entryPrice && s.targetPrice > s.entryPrice);
  assert.ok(s.sizeBps > 0 && s.sizeBps <= DEFAULT_ORDERS.maxPositionBps);
  assert.ok(Math.abs(s.targetPrice - s.entryPrice - 2 * (s.entryPrice - s.stopPrice)) < 0.05);

  assert.equal(sentence(ruling({ conviction: 50 }), e, DEFAULT_ORDERS).action, "NO_POSITION");
  assert.equal(sentence(ruling({ verdict: "DISMISSED", conviction: 40 }), e, DEFAULT_ORDERS).sizeBps, 0);
  const short = sentence(ruling({ verdict: "SHORT" }), e, DEFAULT_ORDERS);
  assert.ok(short.stopPrice > short.entryPrice && short.targetPrice < short.entryPrice);
});

test("canonical form sorts keys at every depth", () => {
  assert.equal(canonicalize({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: "x" } }), '{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}');
  assert.equal(canonicalize({ a: undefined, b: null }), '{"b":null}');
});

test("toUsd8 is exact", () => {
  assert.equal(toUsd8(3142.17), 314217000000n);
  assert.equal(toUsd8(0.123456), 12345600n);
  assert.equal(toUsd8(0), 0n);
});

test("the filing round-trips through the on-chain ABI", () => {
  const e = buildEvidence(ETH, sampleMarket(), sentiment);
  const r = ruling();
  const t: Transcript = {
    court: "bull-v-bear/1",
    caption: "In re ETH/USD",
    asset: "ETH",
    openedAt: "2026-10-20T12:01:00.000Z",
    evidenceAsOf: e.asOf,
    exhibits: e.exhibits,
    arguments: [],
    ruling: r,
    sentence: sentence(r, e, DEFAULT_ORDERS),
    standingOrders: DEFAULT_ORDERS,
    counsel: { mode: "demo", model: "demo-clerk", venue: "clerk" },
  };
  const f = buildFiling(t);
  assert.equal(f.transcriptHash, transcriptHash(JSON.parse(JSON.stringify(t))));
  const d = decodeAbiParameters(REPORT_PARAMS, f.report);
  assert.equal(d[1], 1);
  assert.equal(d[2], 72);
  assert.equal(d[4], toUsd8(t.sentence.entryPrice));
  assert.equal(d[7], BigInt(Date.UTC(2026, 9, 20, 12, 1) / 1000));
  assert.equal(d[8], f.transcriptHash);
  assert.equal(d[10], "The Court finds for the Bull.");
});
