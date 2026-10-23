import { useCallback, useEffect, useReducer, useRef } from "react";
import type { Argument, CounselInfo, Evidence, JudgeRuling, Round, Sentence, Side, StandingOrders, Transcript } from "@court/core";
import { api, type FiledEvent, type FiledTranscript, type Hex, type Phase, type TrialEvent } from "./api.ts";

export interface Speech {
  text: string;
  notes: string;
  started: boolean;
  done: boolean;
  citations: string[];
}

export type SpeechKey = `${Side}-${Round}`;

export interface TrialState {
  status: "idle" | "running" | "done" | "error";
  replay: boolean;
  phase?: Phase;
  caption?: string;
  asset?: string;
  openedAt?: string;
  counsel?: CounselInfo;
  evidence?: Evidence;
  speeches: Record<SpeechKey, Speech>;
  benchNotes: string;
  deliberating: boolean;
  ruling?: JudgeRuling;
  sentence?: Sentence;
  filed?: FiledEvent;
  transcript?: Transcript;
  transcriptHash?: Hex;
  error?: string;
}

const blank = (): Speech => ({ text: "", notes: "", started: false, done: false, citations: [] });
const freshSpeeches = (): Record<SpeechKey, Speech> => ({
  "BULL-opening": blank(),
  "BEAR-opening": blank(),
  "BULL-rebuttal": blank(),
  "BEAR-rebuttal": blank(),
});

const initial: TrialState = { status: "idle", replay: false, speeches: freshSpeeches(), benchNotes: "", deliberating: false };

type Action = TrialEvent | { type: "reset" } | { type: "start" } | { type: "hydrate"; filed: FiledTranscript };

function reducer(s: TrialState, a: Action): TrialState {
  switch (a.type) {
    case "reset":
      return initial;
    case "start":
      return { ...initial, status: "running", speeches: freshSpeeches() };
    case "hydrate":
      return fromTranscript(a.filed);
    case "docketed":
      return { ...s, caption: a.caption, asset: a.asset, openedAt: a.openedAt, counsel: a.counsel };
    case "phase":
      return { ...s, phase: a.phase };
    case "evidence":
      return { ...s, evidence: a.evidence };
    case "counsel_start":
      if (a.side === "BENCH") return { ...s, deliberating: true };
      return patch(s, `${a.side}-${a.round as Round}`, { started: true });
    case "notes":
      if (a.side === "BENCH") return { ...s, benchNotes: s.benchNotes + a.text };
      return patch(s, `${a.side}-${a.round as Round}`, (sp) => ({ notes: sp.notes + a.text }));
    case "speech":
      return patch(s, `${a.side}-${a.round}`, (sp) => ({ text: sp.text + a.text, started: true }));
    case "counsel_done":
      return patch(s, `${a.argument.side}-${a.argument.round}`, {
        text: a.argument.text,
        done: true,
        citations: a.argument.citations,
      });
    case "ruling":
      return { ...s, ruling: a.ruling, deliberating: false };
    case "sentence":
      return { ...s, sentence: a.sentence };
    case "filed":
      return { ...s, filed: a };
    case "adjourned":
      return { ...s, status: "done", transcript: a.transcript, transcriptHash: a.transcriptHash, phase: undefined };
    case "error":
      return { ...s, status: "error", error: a.message, deliberating: false };
  }
}

function patch(s: TrialState, key: string, p: Partial<Speech> | ((sp: Speech) => Partial<Speech>)): TrialState {
  const k = key as SpeechKey;
  const cur = s.speeches[k] ?? blank();
  return { ...s, speeches: { ...s.speeches, [k]: { ...cur, ...(typeof p === "function" ? p(cur) : p) } } };
}

/** Rebuilds a finished trial from a filed transcript (docket replay). */
function fromTranscript(f: FiledTranscript): TrialState {
  const t = f.transcript;
  const speeches = freshSpeeches();
  for (const a of t.arguments as Argument[]) {
    speeches[`${a.side}-${a.round}`] = { text: a.text, notes: "", started: true, done: true, citations: a.citations };
  }
  const exhibits = t.exhibits;
  const price = exhibits.find((e) => e.kind === "price");
  const evidence = {
    asset: { symbol: t.asset, name: t.asset, coingeckoId: "" },
    asOf: t.evidenceAsOf,
    exhibits,
    market: { price: Number(price?.data.price ?? t.sentence.entryPrice) },
  } as unknown as Evidence;
  return {
    status: "done",
    replay: true,
    caption: t.caption,
    asset: t.asset,
    openedAt: t.openedAt,
    counsel: t.counsel,
    evidence,
    speeches,
    benchNotes: "",
    deliberating: false,
    ruling: t.ruling,
    sentence: t.sentence,
    transcript: t,
    transcriptHash: f.transcriptHash,
    filed: {
      type: "filed",
      transcriptHash: f.transcriptHash,
      evidenceHash: (f.onChain?.evidenceHash ?? "0x") as Hex,
      report: "0x",
      onChain: Boolean(f.onChain),
      txHash: f.filing?.txHash,
      blockNumber: f.filing?.blockNumber,
      caseNumber: f.onChain?.caseNumber ?? f.filing?.caseNumber,
      chainId: f.filing?.chainId,
      note: f.filing?.venue === "cre" ? "Filed by the Chainlink CRE workflow." : undefined,
    },
  };
}

export function useTrial(onAdjourned?: () => void) {
  const [state, dispatch] = useReducer(reducer, initial);
  const source = useRef<EventSource | null>(null);
  const adjourned = useRef(onAdjourned);
  adjourned.current = onAdjourned;

  const stop = useCallback(() => {
    source.current?.close();
    source.current = null;
  }, []);

  const start = useCallback(
    (asset: string, orders: StandingOrders) => {
      stop();
      dispatch({ type: "start" });
      const es = new EventSource(api.trialUrl(asset, orders));
      source.current = es;
      es.onmessage = (m) => {
        const ev = JSON.parse(m.data) as TrialEvent;
        dispatch(ev);
        if (ev.type === "adjourned" || ev.type === "error") {
          stop();
          adjourned.current?.();
        }
      };
      es.onerror = () => {
        if (source.current === es) {
          dispatch({ type: "error", message: "Lost connection to the clerk. Check that the server is running, then call the case again." });
          stop();
        }
      };
    },
    [stop],
  );

  const replay = useCallback(
    async (hash: string) => {
      stop();
      const filed = await api.transcript(hash);
      dispatch({ type: "hydrate", filed });
    },
    [stop],
  );

  const reset = useCallback(() => {
    stop();
    dispatch({ type: "reset" });
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { state, start, replay, reset };
}
