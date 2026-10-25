// The vocabulary of the Court. Everything here is plain data so it can be hashed,
// stored, streamed to the browser, and bundled into the CRE workflow's WASM.

// 2: Chainlink Data Feed exhibit; positions are entered and settled at the Chainlink mark.
export const COURT_VERSION = "bull-v-bear/2";
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
  /** The Chainlink SYMBOL/USD Data Feed on Ethereum mainnet: the court's mark price. */
  chainlinkFeed?: `0x${string}`;
}

export const ASSETS: AssetSpec[] = [
  { symbol: "ETH", name: "Ether", coingeckoId: "ethereum", chainlinkFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" },
  { symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", chainlinkFeed: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c" },
  { symbol: "SOL", name: "Solana", coingeckoId: "solana", chainlinkFeed: "0x4ffC43a60e009B551865A93d232E33Fce9f01507" },
  { symbol: "LINK", name: "Chainlink", coingeckoId: "chainlink", chainlinkFeed: "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c" },
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

/** One round of a Chainlink Data Feed, read from the chain. */
export interface OracleSnapshot {
  /** e.g. "SOL/USD" */
  pair: string;
  network: string;
  feed: string;
  price: number;
  updatedAt: string;
  roundId: string;
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

export type ExhibitKind = "price" | "range" | "trend" | "volatility" | "liquidity" | "sentiment" | "oracle" | "headline";

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
  oracle: OracleSnapshot | null;
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
  /** claude: Anthropic Messages API · llm: any OpenAI-compatible chat API · demo: scripted counsel. */
  mode: "claude" | "llm" | "demo";
  model: string;
  venue: "clerk" | "cre";
}

const NAME_PARTS: Record<string, string> = { deepseek: "DeepSeek", gpt: "GPT", glm: "GLM", oss: "OSS", ai: "AI" };

/** The name the bench sits under, e.g. "Claude" or "DeepSeek V4 Flash" for "deepseek/deepseek-v4-flash:free". */
export function counselName(info: CounselInfo): string {
  if (info.mode === "claude") return "Claude";
  if (info.mode === "demo") return "Demo Counsel";
  // Drop the provider prefix, any ":free"-style tag, and the instruction-tuned suffix ("-it", "-instruct").
  const id = info.model
    .split("/")
    .pop()!
    .replace(/:.*$/, "")
    .replace(/[-_](it|instruct)$/i, "");
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => NAME_PARTS[w.toLowerCase()] ?? (/^v?\d/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
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
