// The vocabulary of the Court. Everything here is plain data so it can be hashed,
// stored, streamed to the browser, and bundled into the CRE workflow's WASM.

export const COURT_VERSION = "bull-v-bear/1";
export const GUIDELINES_VERSION = "Sentencing Guidelines for Practice Positions §1 (2026)";

export type Side = "BULL" | "BEAR";
export type Verdict = "LONG" | "SHORT" | "DISMISSED";

/** Matches CourtRecord.Verdict on-chain. */
export const VERDICT_CODE: Record<Verdict, number> = { DISMISSED: 0, LONG: 1, SHORT: 2 };
export const VERDICT_FROM_CODE: Verdict[] = ["DISMISSED", "LONG", "SHORT"];

export interface AssetSpec {
  symbol: string;
  name: string;
  coingeckoId: string;
}

export const ASSETS: AssetSpec[] = [
  { symbol: "ETH", name: "Ether", coingeckoId: "ethereum" },
  { symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin" },
  { symbol: "SOL", name: "Solana", coingeckoId: "solana" },
  { symbol: "LINK", name: "Chainlink", coingeckoId: "chainlink" },
  { symbol: "DOGE", name: "Dogecoin", coingeckoId: "dogecoin" },
];

export function assetBySymbol(symbol: string): AssetSpec {
  const a = ASSETS.find((x) => x.symbol === symbol.toUpperCase());
  if (!a) throw new Error(`Unknown asset ${symbol}`);
  return a;
}

export interface MarketSnapshot {
  price: number;
  change1hPct: number;
  change24hPct: number;
  change7dPct: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  marketCap: number;
  /** Hourly closes for the last 7 days, oldest first. */
  sparkline: number[];
  asOf: string;
}

export interface SentimentSnapshot {
  value: number;
  label: string;
  /** Daily readings, oldest first. */
  history: number[];
}

export interface Headline {
  title: string;
  source: string;
  url?: string;
}

export interface DerivedMetrics {
  dailyVolPct: number;
  rsi14h: number;
  sma24: number;
  sma72: number;
  high7d: number;
  low7d: number;
  drawdownFromHigh7dPct: number;
  aboveLow7dPct: number;
  rangePosition24h: number;
  turnoverPct: number;
}

export type ExhibitKind = "price" | "range" | "trend" | "volatility" | "liquidity" | "sentiment" | "headline";

export interface Exhibit {
  id: string;
  kind: ExhibitKind;
  title: string;
  /** The fact as entered into the record, in plain language. */
  statement: string;
  /** Machine-readable values backing the statement (for charts). */
  data: Record<string, number | string | number[]>;
}

export interface Evidence {
  asset: AssetSpec;
  asOf: string;
  market: MarketSnapshot;
  sentiment: SentimentSnapshot | null;
  headlines: Headline[];
  metrics: DerivedMetrics;
  exhibits: Exhibit[];
}

export type Round = "opening" | "rebuttal";

export interface Argument {
  side: Side;
  round: Round;
  text: string;
  /** Exhibit ids cited in the text, e.g. ["A", "C"]. */
  citations: string[];
}

export interface Finding {
  exhibit: string;
  finding: string;
  favors: Side | "NEUTRAL";
  weight: number;
}

export interface JudgeRuling {
  holding: string;
  verdict: Verdict;
  conviction: number;
  bull_score: number;
  bear_score: number;
  findings: Finding[];
  opinion: string;
  dissent: string;
}

/** User-defined risk limits ("standing orders" of the court). */
export interface StandingOrders {
  /** Bankroll risked if the stop is hit, in bps, at full conviction. */
  riskPerTradeBps: number;
  /** Hard cap on position size, bps of bankroll. */
  maxPositionBps: number;
  /** Below this conviction no position is opened. */
  minConviction: number;
  /** Target distance as a multiple of the stop distance. */
  rewardRiskRatio: number;
  /** Stop distance as a multiple of realized daily volatility. */
  stopVolMultiple: number;
}

export const DEFAULT_ORDERS: StandingOrders = {
  riskPerTradeBps: 100,
  maxPositionBps: 3000,
  minConviction: 55,
  rewardRiskRatio: 2,
  stopVolMultiple: 1.25,
};

export interface SentenceStep {
  label: string;
  formula: string;
  value: string;
}

export interface Sentence {
  action: "LONG" | "SHORT" | "NO_POSITION";
  reason: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  sizeBps: number;
  stopDistancePct: number;
  steps: SentenceStep[];
  guidelines: string;
}

export interface CounselInfo {
  mode: "claude" | "demo";
  model: string;
  venue: "clerk" | "cre";
}

/** The complete, canonical record of one trial. Its keccak256 is filed on-chain. */
export interface Transcript {
  court: string;
  caption: string;
  asset: string;
  openedAt: string;
  evidenceAsOf: string;
  exhibits: Exhibit[];
  arguments: Argument[];
  ruling: JudgeRuling;
  sentence: Sentence;
  standingOrders: StandingOrders;
  counsel: CounselInfo;
}
