// Bull v. Bear, convened inside a Chainlink DON.
//
// Cron trigger → docket number (CourtRecord.totalCases on Sepolia, EVM read) picks the asset →
// discovery (CoinGecko + Fear & Greed over the HTTP capability, identical consensus; the asset's
// Chainlink Data Feed on Ethereum mainnet, EVM read) → two openings, two rebuttals and a ruling from
// the LLM (Claude, or any OpenAI-compatible API; HTTP capability, identical consensus) → sentencing
// guidelines at the Chainlink mark → signed report → CourtRecord.onReport via the Keystone forwarder.
//
// The procedure, prompts, exhibits, sentencing math and report encoding are imported from
// ../../core, the same module the clerk server runs, so a ruling filed here hashes and renders
// exactly like one filed from the courtroom UI.

import {
  LAST_FINALIZED_BLOCK_NUMBER,
  TxStatus,
  bytesToHex,
  consensusIdenticalAggregation,
  cre,
  encodeCallMsg,
  getNetwork,
  hexToBase64,
  ok,
  prepareReportRequest,
  text,
  type HTTPSendRequester,
  type Runtime,
} from "@chainlink/cre-sdk";
import { decodeFunctionResult, encodeFunctionData, stringToHex, zeroAddress, type Hex } from "viem";
import { z } from "zod";
import {
  COURT_VERSION,
  DEFAULT_ORDERS,
  FEAR_GREED_URL,
  FEED_ABI,
  JUDGE_SYSTEM,
  RULING_SCHEMA,
  assetBySymbol,
  buildEvidence,
  buildFiling,
  coingeckoMarketsUrl,
  counselSystem,
  courtRecordAbi,
  extractCitations,
  extractJson,
  judgeJsonInstruction,
  judgePrompt,
  normalizeRuling,
  openingPrompt,
  parseCoinGeckoMarket,
  parseFearGreed,
  parseFeedRound,
  rebuttalPrompt,
  sentence as sentenceFor,
  type Argument,
  type AssetSpec,
  type Evidence,
  type MarketSnapshot,
  type OracleSnapshot,
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
  /** Docket rotation: case number N tries assets[N % assets.length]. */
  assets: z.array(z.string()).min(1),
  /** anthropic: Claude Messages API · openai: any OpenAI-compatible chat completions API at baseUrl. */
  provider: z.enum(["anthropic", "openai"]).default("anthropic"),
  baseUrl: z.string().optional(),
  model: z.string(),
  /** Claude only: output effort for counsel and the bench. */
  counselEffort: effort,
  judgeEffort: effort,
  /** Per-call HTTP timeout for the LLM, as a protobuf Duration string, e.g. "60s". */
  llmTimeout: z.string(),
  chainSelectorName: z.string(),
  /** Where the Chainlink Data Feeds behind the oracle exhibit are read. */
  feedChainSelectorName: z.string().default("ethereum-mainnet"),
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

const fetchMarket = (sr: HTTPSendRequester, url: string, demoKey: string): string => {
  // CoinGecko throttles keyless calls per IP; a free demo key gets its own quota.
  const headers: Record<string, string> = { accept: "application/json", ...(demoKey ? { "x-cg-demo-api-key": demoKey } : {}) };
  const resp = sr.sendRequest({ url, method: "GET", headers, cacheSettings: { store: true, maxAge: "60s" } }).result();
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

interface LlmCall {
  model: string;
  maxTokens: number;
  system: string;
  prompt: string;
  effort: string;
  timeout: string;
  /** Set for the bench: the ruling must match this JSON schema. */
  schema?: Record<string, unknown>;
  /** OpenAI-compatible provider only. */
  baseUrl?: string;
}

interface LlmAnswer {
  text: string;
  model: string;
}

function apiError(provider: string, status: number, raw: string): Error {
  let detail = raw.slice(0, 240);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string };
    detail = (typeof parsed.error === "string" ? parsed.error : parsed.error?.message) ?? detail;
  } catch {
    // keep the raw prefix
  }
  return new Error(`${provider} ${status}: ${detail}`);
}

/** One Messages API call. The WASM runtime cannot load the Anthropic SDK, so this is raw HTTP. */
const askClaude = (sr: HTTPSendRequester, apiKey: string, call: LlmCall): string => {
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
  if (!ok(resp)) throw apiError("Claude API", resp.statusCode, raw);
  const msg = JSON.parse(raw) as { model: string; stop_reason: string; content: Array<{ type: string; text?: string }> };
  if (msg.stop_reason === "refusal") throw new Error("Claude declined this request");
  const answer: LlmAnswer = {
    text: msg.content
      .flatMap((b) => (b.type === "text" && b.text ? [b.text] : []))
      .join("")
      .trim(),
    model: msg.model,
  };
  return JSON.stringify(answer);
};

/** One chat completions call to an OpenAI-compatible provider (DeepSeek, OpenRouter, Gemini, Groq, …). */
const askCompat = (sr: HTTPSendRequester, apiKey: string, call: LlmCall): string => {
  const send = (jsonMode: boolean) =>
    sr
      .sendRequest({
        url: `${call.baseUrl}/chat/completions`,
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: body64(
          JSON.stringify({
            model: call.model,
            max_tokens: call.maxTokens,
            messages: [
              { role: "system", content: call.system },
              { role: "user", content: call.schema ? `${call.prompt}\n\n${judgeJsonInstruction()}` : call.prompt },
            ],
            ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
          }),
        ),
        timeout: call.timeout,
        cacheSettings: { store: true, maxAge: "300s" },
      })
      .result();

  let jsonMode = Boolean(call.schema);
  // Worst case 3 requests per call (JSON mode rejected, then one empty answer), so a trial stays
  // within the 15-request HTTP budget: 2 discovery + 4 × 2 counsel + 3 bench + 1 records = 14.
  for (let attempt = 0; attempt < 2; attempt++) {
    let resp = send(jsonMode);
    // A few providers reject JSON mode; the schema in the prompt is enough for them.
    if (jsonMode && resp.statusCode === 400) {
      jsonMode = false;
      resp = send(false);
    }
    const raw = text(resp);
    if (!ok(resp)) throw apiError(call.model, resp.statusCode, raw);
    const msg = JSON.parse(raw) as { model?: string; choices?: Array<{ message?: { content?: string | null } }> };
    const content = msg.choices?.[0]?.message?.content ?? "";
    const answer: LlmAnswer = {
      // Some open models think inline before answering (<think>, or Gemma's <thought>), occasionally
      // never closing it. Only the answer goes on the record; an answer lost in thought is asked again.
      text: content
        .replace(/<(think|thought)>[\s\S]*?<\/\1>/g, "")
        .replace(/<(think|thought)>[\s\S]*$/, "")
        .trim(),
      model: msg.model ?? call.model,
    };
    if (answer.text) return JSON.stringify(answer);
  }
  throw new Error(`${call.model} returned an empty answer twice`);
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

// ─── EVM reads (at the last finalized block, so every node reads the same state) ───

type EvmClient = InstanceType<typeof cre.capabilities.EVMClient>;

const evmClient = (chainSelectorName: string): EvmClient => {
  const network = getNetwork({ chainFamily: "evm", chainSelectorName });
  if (!network) throw new Error(`Unknown chain ${chainSelectorName}`);
  return new cre.capabilities.EVMClient(network.chainSelector.selector);
};

const callView = (runtime: Runtime<Config>, evm: EvmClient, to: string, data: Hex): Hex => {
  const reply = evm
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: to as Hex, data }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();
  return bytesToHex(reply.data);
};

/** The number the next case will be filed under. */
const nextCaseNumber = (runtime: Runtime<Config>, court: EvmClient): number => {
  const data = callView(runtime, court, runtime.config.courtAddress, encodeFunctionData({ abi: courtRecordAbi, functionName: "totalCases" }));
  return Number(decodeFunctionResult({ abi: courtRecordAbi, functionName: "totalCases", data }));
};

/** The asset's Chainlink Data Feed: decimals() and latestRoundData(). */
const readFeed = (runtime: Runtime<Config>, asset: AssetSpec): OracleSnapshot | null => {
  if (!asset.chainlinkFeed) return null;
  const feeds = evmClient(runtime.config.feedChainSelectorName);
  const call = (functionName: "decimals" | "latestRoundData") =>
    callView(runtime, feeds, asset.chainlinkFeed!, encodeFunctionData({ abi: FEED_ABI, functionName }));
  const decimals = decodeFunctionResult({ abi: FEED_ABI, functionName: "decimals", data: call("decimals") });
  const latest = decodeFunctionResult({ abi: FEED_ABI, functionName: "latestRoundData", data: call("latestRoundData") });
  return parseFeedRound(asset, decimals, latest);
};

// ─── The trial ──────────────────────────────────────────────

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s);

export const convene = (runtime: Runtime<Config>): string => {
  const cfg = runtime.config;
  const orders = cfg.orders ?? DEFAULT_ORDERS;
  const now = runtime.now();
  const openedAt = now.toISOString();
  const court = evmClient(cfg.chainSelectorName);

  // The docket rotates by case number, so every asset gets its turn whatever the schedule.
  let slot: number;
  try {
    slot = nextCaseNumber(runtime, court);
    runtime.log(`Docket: case No. ${slot} is next`);
  } catch (err) {
    slot = Math.floor(now.getTime() / 3_600_000);
    runtime.log(`Docket unreadable, rotating by the hour: ${clip(String(err))}`);
  }
  const asset = assetBySymbol(cfg.assets[slot % cfg.assets.length]);
  const caption = `In re ${asset.symbol}/USD`;
  runtime.log(`⚖ Court is in session: ${caption} (${openedAt})`);

  const http = new cre.capabilities.HTTPClient();
  const consensus = consensusIdenticalAggregation<string>();
  const secret = (id: string) => {
    try {
      return runtime.getSecret({ id }).result().value;
    } catch {
      return "";
    }
  };

  // Discovery
  const market = JSON.parse(
    http.sendRequest(runtime, fetchMarket, consensus)(coingeckoMarketsUrl(asset), secret("COINGECKO_API_KEY")).result(),
  ) as MarketSnapshot;
  const sentiment = JSON.parse(
    http.sendRequest(runtime, fetchSentiment, consensus)(FEAR_GREED_URL).result(),
  ) as SentimentSnapshot | null;
  let oracle: OracleSnapshot | null = null;
  try {
    oracle = readFeed(runtime, asset);
  } catch (err) {
    runtime.log(`Chainlink feed unreadable, marking at spot: ${clip(String(err))}`);
  }
  const evidence: Evidence = buildEvidence(asset, market, sentiment, { oracle });
  const ids = evidence.exhibits.map((x) => x.id);
  runtime.log(
    `Discovery closed: ${ids.length} exhibits, spot ${market.price}` +
      `${oracle ? `, Chainlink ${oracle.pair} ${oracle.price} (round ${oracle.roundId})` : ""}, as of ${evidence.asOf}`,
  );

  // Argument
  const apiKey = runtime.getSecret({ id: "LLM_API_KEY" }).result().value;
  const compat = cfg.provider === "openai";
  if (compat && !cfg.baseUrl) throw new Error('provider "openai" needs baseUrl in the workflow config');
  const ask = (call: Omit<LlmCall, "model" | "timeout" | "baseUrl">): LlmAnswer =>
    JSON.parse(
      http
        .sendRequest(runtime, compat ? askCompat : askClaude, consensus)(apiKey, {
          ...call,
          model: cfg.model,
          timeout: cfg.llmTimeout,
          baseUrl: cfg.baseUrl?.replace(/\/+$/, ""),
        })
        .result(),
    ) as LlmAnswer;

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
    counsel: { mode: compat ? "llm" : "claude", model: cfg.model, venue: "cre" },
  };

  // Filing: the DON signs the report and the forwarder delivers it to CourtRecord.onReport.
  const filing = buildFiling(transcript);
  runtime.log(`Transcript ${filing.transcriptHash} · evidence ${filing.evidenceHash}`);

  const report = runtime.report(prepareReportRequest(filing.report)).result();
  const write = court
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
