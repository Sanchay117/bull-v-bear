// Discovery: turn raw market data into numbered exhibits that both counsel must argue from.
// Pure functions only: the CRE workflow fetches the JSON with its HTTP capability (and reads the
// Chainlink feed with its EVM capability), the clerk server uses fetch() and viem, and both hand
// the results to the same parsers.

import { parseAbi } from "viem";
import type {
  AssetSpec,
  DerivedMetrics,
  Evidence,
  Exhibit,
  Headline,
  MarketSnapshot,
  OracleSnapshot,
  SentimentSnapshot,
} from "./types.ts";

export function coingeckoMarketsUrl(asset: AssetSpec): string {
  return (
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd" +
    `&ids=${asset.coingeckoId}&sparkline=true&price_change_percentage=1h%2C24h%2C7d`
  );
}

export const FEAR_GREED_URL = "https://api.alternative.me/fng/?limit=8";

// ─── Parsers ────────────────────────────────────────────────────────────────

function num(v: unknown, field: string): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) throw new Error(`Bad number for ${field}`);
  return n;
}

function optNum(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Parses a CoinGecko /coins/markets response (array with one coin). */
export function parseCoinGeckoMarket(body: unknown): MarketSnapshot {
  const row = Array.isArray(body) ? body[0] : undefined;
  if (!row || typeof row !== "object") throw new Error("CoinGecko returned no market row");
  const r = row as Record<string, unknown>;
  const spark = (r.sparkline_in_7d as { price?: unknown[] } | undefined)?.price ?? [];
  const sparkline = spark.map((p) => optNum(p)).filter((p) => p > 0);
  return {
    price: num(r.current_price, "current_price"),
    change1hPct: optNum(r.price_change_percentage_1h_in_currency),
    change24hPct: optNum(r.price_change_percentage_24h_in_currency ?? r.price_change_percentage_24h),
    change7dPct: optNum(r.price_change_percentage_7d_in_currency),
    high24h: optNum(r.high_24h),
    low24h: optNum(r.low_24h),
    volume24h: optNum(r.total_volume),
    marketCap: optNum(r.market_cap),
    sparkline,
    asOf: typeof r.last_updated === "string" ? r.last_updated : new Date(0).toISOString(),
  };
}

/** The two AggregatorV3Interface reads behind the oracle exhibit. */
export const FEED_ABI = parseAbi([
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

export const FEED_NETWORK = "Ethereum mainnet";

/** Turns a decoded latestRoundData() into the oracle snapshot, or null for an unusable round. */
export function parseFeedRound(
  asset: AssetSpec,
  decimals: number,
  latest: readonly [bigint, bigint, bigint, bigint, bigint],
): OracleSnapshot | null {
  const [roundId, answer, , updatedAt] = latest;
  if (!asset.chainlinkFeed || answer <= 0n || updatedAt === 0n) return null;
  const price = Number(answer) / 10 ** decimals;
  return {
    pair: `${asset.symbol}/USD`,
    network: FEED_NETWORK,
    feed: asset.chainlinkFeed,
    price: round(price, priceDecimals(price)),
    updatedAt: new Date(Number(updatedAt) * 1000).toISOString(),
    roundId: roundId.toString(),
  };
}

/** Parses an alternative.me Fear & Greed response. */
export function parseFearGreed(body: unknown): SentimentSnapshot | null {
  const data = (body as { data?: Array<Record<string, unknown>> } | null)?.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const newestFirst = data.map((d) => optNum(d.value));
  return {
    value: newestFirst[0],
    label: String(data[0].value_classification ?? "Unknown"),
    history: [...newestFirst].reverse(),
  };
}

// ─── Metrics ────────────────────────────────────────────────────────────────

export function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function priceDecimals(p: number): number {
  if (p >= 100) return 2;
  if (p >= 1) return 4;
  return 6;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function rsi(closes: number[], period: number): number {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return gains === 0 ? 50 : 100;
  const rs = gains / period / (losses / period);
  return 100 - 100 / (1 + rs);
}

export function deriveMetrics(m: MarketSnapshot): DerivedMetrics {
  const closes = m.sparkline.length >= 2 ? [...m.sparkline, m.price] : [m.price, m.price];
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const mean = avg(rets);
  const variance = avg(rets.map((r) => (r - mean) ** 2));
  const dailyVolPct = Math.sqrt(variance) * Math.sqrt(24) * 100;

  const high7d = Math.max(...closes, m.high24h || 0);
  const low7d = Math.min(...closes.filter((c) => c > 0), m.low24h || Infinity);
  const range24 = m.high24h - m.low24h;

  const dp = priceDecimals(m.price);
  return {
    dailyVolPct: round(dailyVolPct, 2),
    rsi14h: round(rsi(closes, 14), 1),
    sma24: round(avg(closes.slice(-24)), dp),
    sma72: round(avg(closes.slice(-72)), dp),
    high7d: round(high7d, dp),
    low7d: round(low7d, dp),
    drawdownFromHigh7dPct: round(((high7d - m.price) / high7d) * 100, 2),
    aboveLow7dPct: round(((m.price - low7d) / low7d) * 100, 2),
    rangePosition24h: range24 > 0 ? round((m.price - m.low24h) / range24, 3) : 0.5,
    turnoverPct: m.marketCap > 0 ? round((m.volume24h / m.marketCap) * 100, 2) : 0,
  };
}

// ─── Exhibits ───────────────────────────────────────────────────────────────

/** Formats USD with thousands separators. Avoids Intl so output is identical in V8 and the CRE WASM engine. */
export function fmtUsd(n: number): string {
  const d = priceDecimals(Math.abs(n));
  const [int, frac] = Math.abs(n).toFixed(d).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${n < 0 ? "-" : ""}$${grouped}${frac ? "." + frac : ""}`;
}

function fmtBig(n: number): string {
  if (n >= 1e12) return `$${round(n / 1e12, 2)} trillion`;
  if (n >= 1e9) return `$${round(n / 1e9, 2)} billion`;
  if (n >= 1e6) return `$${round(n / 1e6, 2)} million`;
  return fmtUsd(n);
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function downsample(xs: number[], every: number, decimals: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < xs.length; i += every) out.push(round(xs[i], decimals));
  if (xs.length && (xs.length - 1) % every !== 0) out.push(round(xs[xs.length - 1], decimals));
  return out;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Enters the evidence into the record as lettered exhibits. Deterministic for a given input. */
export function buildEvidence(
  asset: AssetSpec,
  market: MarketSnapshot,
  sentiment: SentimentSnapshot | null,
  { oracle = null, headlines = [] }: { oracle?: OracleSnapshot | null; headlines?: Headline[] } = {},
): Evidence {
  const metrics = deriveMetrics(market);
  const dp = priceDecimals(market.price);
  const price = round(market.price, dp);
  const asOfUtc = market.asOf.replace("T", " ").replace(/\.\d+Z$|Z$/, " UTC");
  const exhibits: Exhibit[] = [];
  const add = (e: Omit<Exhibit, "id">) => exhibits.push({ id: LETTERS[exhibits.length], ...e });

  add({
    kind: "price",
    title: "Spot Price",
    statement:
      `${asset.name} (${asset.symbol}) traded at ${fmtUsd(price)} as of ${asOfUtc}, ` +
      `${signed(market.change1hPct)} over one hour and ${signed(market.change24hPct)} over twenty-four hours.`,
    data: {
      price,
      change1hPct: round(market.change1hPct, 2),
      change24hPct: round(market.change24hPct, 2),
    },
  });

  add({
    kind: "range",
    title: "24-Hour Trading Range",
    statement:
      `Over twenty-four hours the price ranged from ${fmtUsd(market.low24h)} to ${fmtUsd(market.high24h)}; ` +
      `spot sits at ${Math.round(metrics.rangePosition24h * 100)}% of that range.`,
    data: {
      low24h: round(market.low24h, dp),
      high24h: round(market.high24h, dp),
      rangePosition24h: metrics.rangePosition24h,
    },
  });

  const smaRel = metrics.sma24 >= metrics.sma72 ? "above" : "below";
  add({
    kind: "trend",
    title: "Seven-Day Trend",
    statement:
      `Price is ${signed(market.change7dPct)} over seven days. The 24-hour average (${fmtUsd(metrics.sma24)}) is ` +
      `${smaRel} the 72-hour average (${fmtUsd(metrics.sma72)}). Spot is ${metrics.drawdownFromHigh7dPct.toFixed(2)}% ` +
      `below the seven-day high of ${fmtUsd(metrics.high7d)} and ${metrics.aboveLow7dPct.toFixed(2)}% above the ` +
      `seven-day low of ${fmtUsd(metrics.low7d)}.`,
    data: {
      change7dPct: round(market.change7dPct, 2),
      sma24: metrics.sma24,
      sma72: metrics.sma72,
      high7d: metrics.high7d,
      low7d: metrics.low7d,
      sparkline: downsample(market.sparkline, 2, dp),
    },
  });

  const rsiRead = metrics.rsi14h >= 70 ? "overbought" : metrics.rsi14h <= 30 ? "oversold" : "neutral";
  add({
    kind: "volatility",
    title: "Volatility & Momentum",
    statement:
      `Realized volatility computed from hourly closes is ${metrics.dailyVolPct.toFixed(2)}% per day. ` +
      `The 14-hour relative strength index reads ${metrics.rsi14h.toFixed(1)}, conventionally ${rsiRead}.`,
    data: { dailyVolPct: metrics.dailyVolPct, rsi14h: metrics.rsi14h },
  });

  add({
    kind: "liquidity",
    title: "Liquidity",
    statement:
      `Twenty-four-hour trading volume was ${fmtBig(market.volume24h)}, equal to ${metrics.turnoverPct.toFixed(2)}% ` +
      `of the ${fmtBig(market.marketCap)} market capitalization.`,
    data: { volume24h: Math.round(market.volume24h), marketCap: Math.round(market.marketCap), turnoverPct: metrics.turnoverPct },
  });

  if (sentiment) {
    const weekAgo = sentiment.history.length > 1 ? sentiment.history[0] : sentiment.value;
    add({
      kind: "sentiment",
      title: "Market Sentiment",
      statement:
        `The Crypto Fear & Greed Index reads ${sentiment.value} ("${sentiment.label}"), ` +
        `versus ${weekAgo} ${sentiment.history.length - 1} days earlier.`,
      data: { value: sentiment.value, label: sentiment.label, history: sentiment.history },
    });
  }

  if (oracle) {
    const deviationPct = round(((oracle.price - price) / price) * 100, 2);
    const lagMinutes = Math.round((Date.parse(market.asOf) - Date.parse(oracle.updatedAt)) / 60_000);
    const lag = Math.abs(lagMinutes);
    const span = lag >= 120 ? `${round(lag / 60, 1)} hours` : `${lag} minute${lag === 1 ? "" : "s"}`;
    add({
      kind: "oracle",
      title: "Chainlink Price Feed",
      statement:
        `The Chainlink ${oracle.pair} Data Feed on ${oracle.network} last reported ${fmtUsd(oracle.price)}, ` +
        `${span} ${lagMinutes >= 0 ? "before" : "after"} the spot quote and ${signed(deviationPct)} against the ` +
        `spot price in Exhibit ${exhibits[0].id}. Practice positions are entered and settled at this mark.`,
      data: {
        price: oracle.price,
        deviationPct,
        lagMinutes,
        updatedAt: oracle.updatedAt,
        roundId: oracle.roundId,
        feed: oracle.feed,
        network: oracle.network,
      },
    });
  }

  for (const h of headlines.slice(0, 4)) {
    add({
      kind: "headline",
      title: `Report: ${h.source}`,
      statement: `${h.source} reported: "${h.title}"`,
      data: { source: h.source, title: h.title, url: h.url ?? "" },
    });
  }

  return { asset, asOf: market.asOf, market: { ...market, price }, sentiment, oracle, headlines, metrics, exhibits };
}

/** Exhibits formatted the way counsel and the judge receive them. */
export function formatRecord(exhibits: Exhibit[]): string {
  return exhibits.map((e) => `[Ex. ${e.id}] ${e.title}: ${e.statement}`).join("\n");
}

const LETTERS_LIST = String.raw`([A-Z](?:\s*(?:,|and|&)\s*[A-Z])*)`;
const CITATION = new RegExp(String.raw`[[(](?:Ex\.?|Exhibit)\s*${LETTERS_LIST}[\])]|\bExhibits?\s+${LETTERS_LIST}\b`, "g");

/**
 * A citation as counsel write it: [Ex. A], [Ex. A, C], [Exhibit B], the same in parentheses, or a
 * bare "Exhibit B" / "Exhibits B and D" in prose, which some models use despite the rules.
 */
export const citationPattern = () => new RegExp(CITATION);

/** The letters one citationPattern() match cites, e.g. ["A", "C"]. */
export const citedLetters = (m: RegExpMatchArray): string[] => (m[1] ?? m[2]).split(/\s*(?:,|and|&)\s*/);

/** Extracts the exhibit ids cited in counsel's text. */
export function extractCitations(text: string, validIds: string[]): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(citationPattern())) {
    for (const id of citedLetters(m)) {
      if (validIds.includes(id)) found.add(id);
    }
  }
  return [...found].sort();
}
