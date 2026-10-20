import type {
  Argument,
  AssetSpec,
  CounselInfo,
  Evidence,
  JudgeRuling,
  Round,
  Sentence,
  Side,
  StandingOrders,
  Transcript,
  Verdict,
} from "@court/core";

export type Hex = `0x${string}`;
export type Phase = "discovery" | "openings" | "rebuttals" | "deliberation" | "sentencing" | "filing";
export type Speaker = Side | "BENCH";

export interface FiledEvent {
  type: "filed";
  transcriptHash: Hex;
  evidenceHash: Hex;
  report: Hex;
  onChain: boolean;
  txHash?: Hex;
  blockNumber?: number;
  caseNumber?: number;
  chainId?: number;
  address?: string;
  note?: string;
}

export type TrialEvent =
  | { type: "docketed"; caption: string; asset: string; openedAt: string; counsel: CounselInfo }
  | { type: "phase"; phase: Phase }
  | { type: "evidence"; evidence: Evidence }
  | { type: "counsel_start"; side: Speaker; round: Round | "ruling" }
  | { type: "notes"; side: Speaker; round: Round | "ruling"; text: string }
  | { type: "speech"; side: Side; round: Round; text: string }
  | { type: "counsel_done"; argument: Argument }
  | { type: "ruling"; ruling: JudgeRuling }
  | { type: "sentence"; sentence: Sentence }
  | FiledEvent
  | { type: "adjourned"; transcript: Transcript; transcriptHash: Hex }
  | { type: "error"; message: string };

export interface ChainStatus {
  mode: string;
  online: boolean;
  chainId?: number;
  address?: string;
  forwarder?: string;
  clerk?: string;
  canFile: boolean;
  explorer: string;
  error?: string;
}

export interface Status {
  counsel: CounselInfo;
  chain: ChainStatus;
  assets: AssetSpec[];
  defaults: StandingOrders;
}

export interface OnChainRuling {
  caseNumber: number;
  asset: string;
  verdict: Verdict;
  conviction: number;
  sizeBps: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  trialTime: number;
  filedAt: number;
  transcriptHash: Hex;
  evidenceHash: Hex;
  settled: boolean;
  exitPrice: number;
  moveBps: number;
  bankrollImpactBps: number;
  holding: string;
  hasTranscript?: boolean;
}

export interface Docket {
  total: number;
  equityIndex: number;
  wins: number;
  losses: number;
  rulings: OnChainRuling[];
}

export interface FiledTranscript {
  transcript: Transcript;
  transcriptHash: Hex;
  filing?: { txHash?: Hex; blockNumber?: number; caseNumber?: number; chainId?: number; venue: "clerk" | "cre" };
  onChain: OnChainRuling | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  status: () => get<Status>("/api/status"),
  docket: () => get<Docket>("/api/docket"),
  transcript: (hash: string) => get<FiledTranscript>(`/api/transcripts/${hash}`),
  trialUrl: (asset: string, o: StandingOrders) =>
    `/api/trial?asset=${asset}&risk=${o.riskPerTradeBps}&cap=${o.maxPositionBps}&min=${o.minConviction}&rr=${o.rewardRiskRatio}&stop=${o.stopVolMultiple}`,
};
