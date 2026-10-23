// The trial: discovery → openings → rebuttals → deliberation → sentencing → filing.
// Every step is streamed to the courtroom as an event.

import type { Hex } from "viem";
import {
  COURT_VERSION,
  buildFiling,
  extractCitations,
  sentence as sentenceFor,
  type Argument,
  type AssetSpec,
  type Evidence,
  type JudgeRuling,
  type Round,
  type Sentence,
  type Side,
  type StandingOrders,
  type Transcript,
} from "@court/core";
import { chainStatus, fileReport } from "./chain.ts";
import { describeError, type Counsel } from "./counsel.ts";
import { discoverEvidence } from "./market.ts";
import { saveTranscript } from "./store.ts";

export type Phase = "discovery" | "openings" | "rebuttals" | "deliberation" | "sentencing" | "filing";

export type TrialEvent =
  | { type: "docketed"; caption: string; asset: string; openedAt: string; counsel: Counsel["info"] }
  | { type: "phase"; phase: Phase }
  | { type: "evidence"; evidence: Evidence }
  | { type: "counsel_start"; side: Side | "BENCH"; round: Round | "ruling" }
  | { type: "notes"; side: Side | "BENCH"; round: Round | "ruling"; text: string }
  | { type: "speech"; side: Side; round: Round; text: string }
  | { type: "counsel_done"; argument: Argument }
  | { type: "ruling"; ruling: JudgeRuling }
  | { type: "sentence"; sentence: Sentence }
  | {
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
  | { type: "adjourned"; transcript: Transcript; transcriptHash: Hex }
  | { type: "error"; message: string };

export async function runTrial(
  asset: AssetSpec,
  orders: StandingOrders,
  counsel: Counsel,
  emit: (e: TrialEvent) => void,
): Promise<void> {
  const openedAt = new Date().toISOString();
  const caption = `In re ${asset.symbol}/USD`;
  emit({ type: "docketed", caption, asset: asset.symbol, openedAt, counsel: counsel.info });

  try {
    emit({ type: "phase", phase: "discovery" });
    const evidence = await discoverEvidence(asset);
    emit({ type: "evidence", evidence });
    const ids = evidence.exhibits.map((x) => x.id);

    const argue = async (side: Side, round: Round, opponent: Argument | null): Promise<Argument> => {
      emit({ type: "counsel_start", side, round });
      const text = await counsel.argue(evidence, side, round, opponent, {
        onText: (d) => emit({ type: "speech", side, round, text: d }),
        onNotes: (d) => emit({ type: "notes", side, round, text: d }),
      });
      const argument: Argument = { side, round, text, citations: extractCitations(text, ids) };
      emit({ type: "counsel_done", argument });
      return argument;
    };

    emit({ type: "phase", phase: "openings" });
    const [bullOpen, bearOpen] = await Promise.all([argue("BULL", "opening", null), argue("BEAR", "opening", null)]);

    emit({ type: "phase", phase: "rebuttals" });
    const [bullReb, bearReb] = await Promise.all([argue("BULL", "rebuttal", bearOpen), argue("BEAR", "rebuttal", bullOpen)]);
    const args = [bullOpen, bearOpen, bullReb, bearReb];

    emit({ type: "phase", phase: "deliberation" });
    emit({ type: "counsel_start", side: "BENCH", round: "ruling" });
    const ruling = await counsel.judge(evidence, args, {
      onText: () => {},
      onNotes: (d) => emit({ type: "notes", side: "BENCH", round: "ruling", text: d }),
    });
    emit({ type: "ruling", ruling });

    emit({ type: "phase", phase: "sentencing" });
    const sentence = sentenceFor(ruling, evidence, orders);
    emit({ type: "sentence", sentence });

    const transcript: Transcript = {
      court: COURT_VERSION,
      caption,
      asset: asset.symbol,
      openedAt,
      evidenceAsOf: evidence.asOf,
      exhibits: evidence.exhibits,
      arguments: args,
      ruling,
      sentence,
      standingOrders: orders,
      counsel: counsel.info,
    };

    emit({ type: "phase", phase: "filing" });
    const filing = buildFiling(transcript);
    const chain = chainStatus();
    let filed: Extract<TrialEvent, { type: "filed" }> = {
      type: "filed",
      transcriptHash: filing.transcriptHash,
      evidenceHash: filing.evidenceHash,
      report: filing.report,
      onChain: false,
      chainId: chain.chainId,
      address: chain.address,
    };
    if (chain.canFile) {
      try {
        const r = await fileReport(filing.report);
        filed = { ...filed, onChain: true, ...r };
      } catch (err) {
        filed.note = `Filing failed: ${(err as Error).message.split("\n")[0]}`;
      }
    } else {
      filed.note = chain.online
        ? "This clerk is not the court's forwarder: rulings on this chain are filed by the Chainlink CRE workflow."
        : "No chain connected, so the record was sealed off-chain only.";
    }
    saveTranscript({
      transcript,
      transcriptHash: filing.transcriptHash,
      filing: filed.onChain
        ? { txHash: filed.txHash, blockNumber: filed.blockNumber, caseNumber: filed.caseNumber, chainId: filed.chainId, venue: "clerk" }
        : undefined,
    });
    emit(filed);
    emit({ type: "adjourned", transcript, transcriptHash: filing.transcriptHash });
  } catch (err) {
    emit({ type: "error", message: describeError(err) });
  }
}
