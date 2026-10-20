// Bull v. Bear, convened inside a Chainlink DON.
//
// Cron trigger → discovery (CoinGecko + Fear & Greed over the HTTP capability, identical consensus)
// → two openings, two rebuttals and a ruling from Claude (HTTP capability, identical consensus)
// → sentencing guidelines → signed report → CourtRecord.onReport via the Keystone forwarder.
//
// The procedure, prompts, exhibits, sentencing math and report encoding are imported from
// ../../core, the same module the clerk server runs, so a ruling filed here hashes and renders
// exactly like one filed from the courtroom UI.

import {
  TxStatus,
  bytesToHex,
  consensusIdenticalAggregation,
  cre,
  getNetwork,
  hexToBase64,
  ok,
  prepareReportRequest,
  text,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";
import { stringToHex } from "viem";
import { z } from "zod";
import {
  COURT_VERSION,
  DEFAULT_ORDERS,
  FEAR_GREED_URL,
  JUDGE_SYSTEM,
  RULING_SCHEMA,
  assetBySymbol,
  buildEvidence,
  buildFiling,
  coingeckoMarketsUrl,
  counselSystem,
  extractCitations,
  extractJson,
  judgePrompt,
  normalizeRuling,
  openingPrompt,
  parseCoinGeckoMarket,
  parseFearGreed,
  rebuttalPrompt,
  sentence as sentenceFor,
  type Argument,
  type Evidence,
  type MarketSnapshot,
  type Round,
  type SentimentSnapshot,
  type Side,
  type Transcript,
} from "../../core/src/index.ts";

// ─── Config ─────────────────────────────────────────────────

const effort = z.enum(["low", "medium", "high"]);

export const configSchema = z.object({
  /** Six-field cron (with seconds). */
  schedule: z.string(),
  /** Docket rotation: the asset tried is assets[hourOfEpoch % assets.length]. */
  assets: z.array(z.string()).min(1),
  model: z.string(),
  counselEffort: effort,
  judgeEffort: effort,
  /** Per-call HTTP timeout for Claude, as a protobuf Duration string, e.g. "60s". */
  claudeTimeout: z.string(),
  chainSelectorName: z.string(),
  courtAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  gasLimit: z.string(),
  /** Optional clerk endpoint that receives the full transcript (POST /api/records). */
  recordsUrl: z.string().optional(),
  orders: z
    .object({
      riskPerTradeBps: z.number(),
      maxPositionBps: z.number(),
      minConviction: z.number(),
      rewardRiskRatio: z.number(),
      stopVolMultiple: z.number(),
    })
    .optional(),
});

type Config = z.infer<typeof configSchema>;

// ─── HTTP (runs on each node; results reach identical consensus) ───

/** Encodes a UTF-8 string as the base64 body the HTTP capability expects. */
const body64 = (s: string) => hexToBase64(stringToHex(s));

const fetchMarket = (sr: HTTPSendRequester, url: string): string => {
  const resp = sr
    .sendRequest({ url, method: "GET", headers: { accept: "application/json" }, cacheSettings: { store: true, maxAge: "60s" } })
    .result();
  if (!ok(resp)) throw new Error(`CoinGecko answered ${resp.statusCode}`);
  // Parse on the node so the consensus observation is the compact snapshot, not the raw page.
  return JSON.stringify(parseCoinGeckoMarket(JSON.parse(text(resp))));
};

const fetchSentiment = (sr: HTTPSendRequester, url: string): string => {
  const resp = sr
    .sendRequest({ url, method: "GET", headers: { accept: "application/json" }, cacheSettings: { store: true, maxAge: "60s" } })
    .result();
  if (!ok(resp)) return "null";
  return JSON.stringify(parseFearGreed(JSON.parse(text(resp))));
};

interface ClaudeCall {
  model: string;
  maxTokens: number;
  system: string;
  prompt: string;
  effort: string;
  timeout: string;
  schema?: Record<string, unknown>;
}

interface ClaudeAnswer {
  text: string;
  model: string;
}

/** One Messages API call. The WASM runtime cannot load the Anthropic SDK, so this is raw HTTP. */
const askClaude = (sr: HTTPSendRequester, apiKey: string, call: ClaudeCall): string => {
  const request = {
    model: call.model,
    max_tokens: call.maxTokens,
    system: call.system,
    messages: [{ role: "user", content: call.prompt }],
    thinking: { type: "adaptive" },
    output_config: {
      effort: call.effort,
      ...(call.schema ? { format: { type: "json_schema", schema: call.schema } } : {}),
    },
    // If the model declines, the API re-runs the turn on its recommended fallback model.
    fallbacks: "default",
  };
  const resp = sr
    .sendRequest({
      url: "https://api.anthropic.com/v1/messages",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "server-side-fallback-2026-07-01",
      },
      body: body64(JSON.stringify(request)),
      timeout: call.timeout,
      // One node calls Claude; the others read the cached response, so every node sees the same words.
      cacheSettings: { store: true, maxAge: "300s" },
    })
    .result();

  const raw = text(resp);
  if (!ok(resp)) {
    let detail = raw.slice(0, 240);
    try {
      detail = (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? detail;
    } catch {
      // keep the raw prefix
    }
    throw new Error(`Claude API ${resp.statusCode}: ${detail}`);
  }
  const msg = JSON.parse(raw) as { model: string; stop_reason: string; content: Array<{ type: string; text?: string }> };
  if (msg.stop_reason === "refusal") throw new Error("Claude declined this request");
  const answer: ClaudeAnswer = {
    text: msg.content
      .flatMap((b) => (b.type === "text" && b.text ? [b.text] : []))
      .join("")
      .trim(),
    model: msg.model,
  };
  return JSON.stringify(answer);
};

const postRecord = (sr: HTTPSendRequester, url: string, transcriptJson: string): string => {
  const resp = sr
    .sendRequest({
      url,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body64(`{"transcript":${transcriptJson}}`),
      cacheSettings: { store: true, maxAge: "60s" },
    })
    .result();
  return String(resp.statusCode);
};

// ─── The trial ──────────────────────────────────────────────

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s);

export const convene = (runtime: Runtime<Config>): string => {
  const cfg = runtime.config;
  const orders = cfg.orders ?? DEFAULT_ORDERS;
  const now = runtime.now();
  const openedAt = now.toISOString();
  const asset = assetBySymbol(cfg.assets[Math.floor(now.getTime() / 3_600_000) % cfg.assets.length]);
  const caption = `In re ${asset.symbol}/USD`;
  runtime.log(`⚖ Court is in session: ${caption} (${openedAt})`);

  const http = new cre.capabilities.HTTPClient();
  const consensus = consensusIdenticalAggregation<string>();

  // Discovery
  const market = JSON.parse(
    http.sendRequest(runtime, fetchMarket, consensus)(coingeckoMarketsUrl(asset)).result(),
  ) as MarketSnapshot;
  const sentiment = JSON.parse(
    http.sendRequest(runtime, fetchSentiment, consensus)(FEAR_GREED_URL).result(),
  ) as SentimentSnapshot | null;
  const evidence: Evidence = buildEvidence(asset, market, sentiment);
  const ids = evidence.exhibits.map((x) => x.id);
  runtime.log(`Discovery closed: ${ids.length} exhibits, spot ${market.price}, as of ${evidence.asOf}`);

  // Argument
  const apiKey = runtime.getSecret({ id: "ANTHROPIC_API_KEY" }).result().value;
  const ask = (call: Omit<ClaudeCall, "model" | "timeout">): ClaudeAnswer =>
    JSON.parse(
      http.sendRequest(runtime, askClaude, consensus)(apiKey, { ...call, model: cfg.model, timeout: cfg.claudeTimeout }).result(),
    ) as ClaudeAnswer;

  const argue = (side: Side, round: Round, opponent: Argument | null): Argument => {
    const prompt = round === "opening" || !opponent ? openingPrompt(evidence, side) : rebuttalPrompt(evidence, side, opponent);
    const { text: speech } = ask({ maxTokens: 6000, system: counselSystem(side), prompt, effort: cfg.counselEffort });
    runtime.log(`${side} ${round}: ${clip(speech)}`);
    return { side, round, text: speech, citations: extractCitations(speech, ids) };
  };

  const bullOpen = argue("BULL", "opening", null);
  const bearOpen = argue("BEAR", "opening", null);
  const bullReb = argue("BULL", "rebuttal", bearOpen);
  const bearReb = argue("BEAR", "rebuttal", bullOpen);
  const args = [bullOpen, bearOpen, bullReb, bearReb];

  // Deliberation
  const bench = ask({
    maxTokens: 12000,
    system: JUDGE_SYSTEM,
    prompt: judgePrompt(evidence, args),
    effort: cfg.judgeEffort,
    schema: RULING_SCHEMA as unknown as Record<string, unknown>,
  });
  const ruling = normalizeRuling(extractJson(bench.text), ids);
  runtime.log(`RULING ${ruling.verdict} @ ${ruling.conviction}: ${clip(ruling.holding, 200)}`);

  // Sentencing
  const sentence = sentenceFor(ruling, evidence, orders);
  runtime.log(
    sentence.action === "NO_POSITION"
      ? `No position: ${clip(sentence.reason)}`
      : `${sentence.action} ${sentence.sizeBps} bps @ ${sentence.entryPrice}, stop ${sentence.stopPrice}, target ${sentence.targetPrice}`,
  );

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
    counsel: { mode: "claude", model: cfg.model, venue: "cre" },
  };

  // Filing: the DON signs the report and the forwarder delivers it to CourtRecord.onReport.
  const filing = buildFiling(transcript);
  runtime.log(`Transcript ${filing.transcriptHash} · evidence ${filing.evidenceHash}`);

  const network = getNetwork({ chainFamily: "evm", chainSelectorName: cfg.chainSelectorName, isTestnet: true });
  if (!network) throw new Error(`Unknown chain ${cfg.chainSelectorName}`);
  const evm = new cre.capabilities.EVMClient(network.chainSelector.selector);

  const report = runtime.report(prepareReportRequest(filing.report)).result();
  const write = evm
    .writeReport(runtime, { receiver: cfg.courtAddress, report, gasConfig: { gasLimit: cfg.gasLimit } })
    .result();
  if (write.txStatus !== TxStatus.SUCCESS) {
    throw new Error(`Filing failed: ${write.errorMessage || write.txStatus}`);
  }
  if (write.receiverContractExecutionStatus !== undefined && write.receiverContractExecutionStatus !== 0) {
    throw new Error(`CourtRecord rejected the filing (status ${write.receiverContractExecutionStatus})`);
  }
  const txHash = bytesToHex(write.txHash ?? new Uint8Array(32));
  runtime.log(`📜 Entered into CourtRecord ${cfg.courtAddress}: tx ${txHash}`);

  // Publish the words behind the hash so anyone can re-verify it.
  if (cfg.recordsUrl) {
    try {
      const status = http.sendRequest(runtime, postRecord, consensus)(cfg.recordsUrl, JSON.stringify(transcript)).result();
      runtime.log(`Transcript lodged with the clerk (${status})`);
    } catch (err) {
      runtime.log(`Clerk unreachable, transcript kept on-chain by hash only: ${clip(String(err))}`);
    }
  }

  return JSON.stringify({
    caption,
    verdict: ruling.verdict,
    conviction: ruling.conviction,
    action: sentence.action,
    sizeBps: sentence.sizeBps,
    transcriptHash: filing.transcriptHash,
    txHash,
  });
};

export function initWorkflow(config: Config) {
  const cron = new cre.capabilities.CronCapability();
  return [cre.handler(cron.trigger({ schedule: config.schedule }), convene)];
}
