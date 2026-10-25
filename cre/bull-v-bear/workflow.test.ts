// Runs the whole trial inside the CRE test runtime: mocked HTTP (CoinGecko, Fear & Greed,
// the LLM, the clerk), mocked EVM reads (the docket on Sepolia, the Chainlink feed on mainnet)
// and a mocked EVM write. Checks the requests the LLM receives and that the signed report decodes
// to the hash of the transcript lodged with the clerk.

import { describe, expect } from "bun:test";
import { TxStatus } from "@chainlink/cre-sdk";
import { EvmMock, HttpActionsMock, addContractMock, newTestRuntime, test } from "@chainlink/cre-sdk/test";
import { decodeAbiParameters, type Hex, bytesToHex } from "viem";
import { FEED_ABI, REPORT_PARAMS, assetBySymbol, courtRecordAbi, transcriptHash, type Transcript } from "../../core/src/index.ts";
import { convene, initWorkflow } from "./workflow";

const SEPOLIA = 16015286601757825753n;
const MAINNET = 5009297550715157269n;
const COURT = "0x7109709ECfa91a80626fF3989D68f67F5b1DD12D";
const NOW = Date.UTC(2026, 9, 20, 14, 0, 0); // hour 14: the fallback rotation also lands on assets[2] = SOL
const SOL_FEED = assetBySymbol("SOL").chainlinkFeed!;

const baseConfig = {
  schedule: "0 0 */2 * * *",
  assets: ["ETH", "BTC", "SOL", "LINK"],
  provider: "anthropic" as "anthropic" | "openai",
  baseUrl: undefined as string | undefined,
  model: "claude-opus-5-5",
  counselEffort: "low" as const,
  judgeEffort: "medium" as const,
  llmTimeout: "90s",
  chainSelectorName: "ethereum-testnet-sepolia",
  feedChainSelectorName: "ethereum-mainnet",
  courtAddress: COURT,
  gasLimit: "1000000",
  recordsUrl: "http://localhost:8787/api/records",
};

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s: string | Uint8Array) => (typeof s === "string" ? Buffer.from(s, "base64") : Buffer.from(s)).toString("utf8");

// A week of hourly closes trending up from 150 to ~170 with a gentle wobble.
const sparkline = Array.from({ length: 168 }, (_, i) => 150 + i * 0.12 + Math.sin(i / 5) * 1.5);
const coingecko = [
  {
    current_price: 171.25,
    price_change_percentage_1h_in_currency: 0.4,
    price_change_percentage_24h_in_currency: 2.1,
    price_change_percentage_7d_in_currency: 13.4,
    high_24h: 172,
    low_24h: 166.5,
    total_volume: 3_100_000_000,
    market_cap: 81_000_000_000,
    sparkline_in_7d: { price: sparkline },
    last_updated: "2026-10-20T13:59:12.000Z",
  },
];
const fearGreed = { data: [64, 61, 58, 55, 52, 50, 49, 47].map((v) => ({ value: String(v), value_classification: "Greed" })) };

const SPEECH = {
  "BULL opening": "May it please the Court. 1. Price rose 13.40% in seven days [Ex. C]. 2. Spot sits high in its range [Ex. B]. 3. Sentiment is improving [Ex. F]. The Bull rests.",
  "BEAR opening": "May it please the Court. 1. RSI is stretched [Ex. D]. 2. Turnover is thin [Ex. E]. 3. Greed precedes pullbacks [Ex. F]. The Bear rests.",
  "BULL rebuttal": "Your Honor, momentum is not exhaustion [Ex. D], and liquidity is ample [Ex. E]. Nothing further.",
  "BEAR rebuttal": "Your Honor, a seven-day rally [Ex. C] already priced the good news [Ex. A]. Nothing further.",
};

const RULING = {
  holding: "The Court finds the trend and sentiment exhibits favor the Bull.",
  verdict: "LONG",
  conviction: 68,
  bull_score: 7,
  bear_score: 5,
  findings: [
    { exhibit: "C", finding: "Seven-day trend is up.", favors: "BULL", weight: 3 },
    { exhibit: "D", finding: "Momentum is elevated.", favors: "BEAR", weight: 1 },
    { exhibit: "F", finding: "Sentiment improved.", favors: "BULL", weight: 2 },
  ],
  opinion: "The trend [Ex. C] and sentiment [Ex. F] outweigh momentum concerns [Ex. D].",
  dissent: "Elevated RSI [Ex. D] warns of a pullback.",
};

/** Which counsel a request is for, from its system prompt and user prompt. */
function speechFor(system: string, prompt: string): string {
  const side = system.includes("Counsel for the Bull") ? "BULL" : "BEAR";
  const round = prompt.includes("Deliver your rebuttal") ? "rebuttal" : "opening";
  return SPEECH[`${side} ${round}` as keyof typeof SPEECH];
}

type LlmRequest = { url: string; headers: Record<string, string>; body: Record<string, any> };
type LlmReply = { statusCode: number; body: string };

/** Mocks every capability, convenes the court once, and returns what came out of it. */
function trial(config: typeof baseConfig, llm: (req: LlmRequest) => LlmReply, { chainReads = true } = {}) {
  const http = HttpActionsMock.testInstance();
  const llmRequests: LlmRequest[] = [];
  let lodged = "";

  http.sendRequest = (req) => {
    if (req.url.startsWith("https://api.coingecko.com/")) {
      expect(req.url).toContain("ids=solana");
      expect(req.headers["x-cg-demo-api-key"]).toBe("cg-test");
      return { statusCode: 200, body: b64(JSON.stringify(coingecko)) };
    }
    if (req.url.startsWith("https://api.alternative.me/")) return { statusCode: 200, body: b64(JSON.stringify(fearGreed)) };
    if (req.url === config.recordsUrl) {
      lodged = unb64(req.body);
      return { statusCode: 200, body: b64("{}") };
    }
    const request = { url: req.url, headers: req.headers, body: JSON.parse(unb64(req.body)) };
    llmRequests.push(request);
    const reply = llm(request);
    return { statusCode: reply.statusCode, body: b64(reply.body) };
  };

  const court = addContractMock(EvmMock.testInstance(SEPOLIA), { address: COURT, abi: courtRecordAbi });
  let rawReport: Uint8Array | undefined;
  court.writeReport = (input) => {
    expect(bytesToHex(input.receiver).toLowerCase()).toBe(COURT.toLowerCase());
    rawReport = input.report.rawReport;
    return { txStatus: TxStatus.SUCCESS, txHash: new Uint8Array(32).fill(0xab) };
  };
  if (chainReads) {
    // Six cases on the docket: case No. 6 tries assets[6 % 4] = SOL.
    court.totalCases = () => 6n;
    const feed = addContractMock(EvmMock.testInstance(MAINNET), { address: SOL_FEED, abi: FEED_ABI });
    feed.decimals = () => 8;
    feed.latestRoundData = () => [7000n, 17_110_000_000n, 1n, BigInt(Date.UTC(2026, 9, 20, 13, 30) / 1000), 7000n];
  }

  const secrets = new Map([["main", new Map([["LLM_API_KEY", "sk-test"], ["COINGECKO_API_KEY", "cg-test"]])]]);
  const runtime = newTestRuntime(secrets, { timeProvider: () => NOW });
  (runtime as any).config = config;

  const result = JSON.parse(convene(runtime as any));
  const transcript = (JSON.parse(lodged) as { transcript: Transcript }).transcript;
  return { result, transcript, rawReport, llmRequests };
}

/** The ruling, the transcript and the signed report must all agree. */
function expectConsistentFiling({ result, transcript, rawReport }: ReturnType<typeof trial>, mark = 17_110_000_000n) {
  expect(result.caption).toBe("In re SOL/USD");
  expect(result.verdict).toBe("LONG");
  expect(result.conviction).toBe(68);
  expect(result.action).toBe("LONG");
  expect(result.sizeBps).toBeGreaterThan(0);
  expect(result.txHash).toBe(`0x${"ab".repeat(32)}`);

  expect(transcript.openedAt).toBe(new Date(NOW).toISOString());
  expect(transcript.arguments.map((a) => a.citations)).toEqual([["B", "C", "F"], ["D", "E", "F"], ["D", "E"], ["A", "C"]]);

  expect(rawReport).toBeDefined();
  const payload = bytesToHex(rawReport!.slice(109)) as Hex;
  const [asset, verdict, conviction, sizeBps, entry, , , trialTime, tHash] = decodeAbiParameters(REPORT_PARAMS, payload);
  expect(asset.startsWith("0x534f4c00")).toBe(true); // "SOL"
  expect(verdict).toBe(1);
  expect(conviction).toBe(68);
  expect(sizeBps).toBe(result.sizeBps);
  expect(entry).toBe(mark);
  expect(trialTime).toBe(BigInt(NOW / 1000));
  expect(tHash).toBe(transcriptHash(transcript));
  expect(tHash).toBe(result.transcriptHash);
}

describe("Bull v. Bear workflow", () => {
  test("Claude: convenes, rules, files a signed report, and lodges the transcript", () => {
    const run = trial(baseConfig, ({ url, body }) => {
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      const text = body.output_config.format ? JSON.stringify(RULING) : speechFor(body.system, body.messages[0].content);
      return {
        statusCode: 200,
        body: JSON.stringify({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text }] }),
      };
    });
    expectConsistentFiling(run);
    expect(run.transcript.counsel).toEqual({ mode: "claude", model: "claude-opus-5-5", venue: "cre" });

    // The Chainlink feed is Exhibit G and the court's mark.
    const g = run.transcript.exhibits[6];
    expect(g).toMatchObject({ id: "G", kind: "oracle", data: { price: 171.1, roundId: "7000", feed: SOL_FEED } });
    expect(g.statement).toContain("SOL/USD Data Feed on Ethereum mainnet last reported $171.10, 29 minutes before the spot quote");
    expect(run.transcript.sentence.steps[0]).toEqual({ label: "Mark price", formula: "Chainlink SOL/USD Data Feed [Ex. G]", value: "$171.10" });

    // Claude was asked five times with the court's exact procedure.
    expect(run.llmRequests).toHaveLength(5);
    for (const { headers, body } of run.llmRequests) {
      expect(headers["x-api-key"]).toBe("sk-test");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
      expect(body.model).toBe("claude-opus-5-5");
      expect(body.thinking).toEqual({ type: "adaptive" });
      expect(body.fallbacks).toBe("default");
    }
    const judge = run.llmRequests[4].body;
    expect(judge.output_config).toMatchObject({ effort: "medium", format: { type: "json_schema" } });
    expect(judge.messages[0].content).toContain("TRANSCRIPT OF ARGUMENT");
  });

  test("OpenAI-compatible provider: JSON mode falls back, inline thinking stays off the record", () => {
    const config = { ...baseConfig, provider: "openai" as const, baseUrl: "https://llm.example/v1/", model: "deepseek-v4-flash" };
    const run = trial(config, ({ url, body }) => {
      expect(url).toBe("https://llm.example/v1/chat/completions");
      if (body.response_format) return { statusCode: 400, body: JSON.stringify({ error: { message: "response_format unsupported" } }) };
      const [system, user] = body.messages;
      const content = user.content.includes("TRANSCRIPT OF ARGUMENT")
        ? `<thought>weighing C against D</thought>${JSON.stringify(RULING)}`
        : `<think>plan the argument</think>${speechFor(system.content, user.content)}`;
      return { statusCode: 200, body: JSON.stringify({ model: "deepseek-v4-flash", choices: [{ message: { content } }] }) };
    });
    expectConsistentFiling(run);
    expect(run.transcript.counsel).toEqual({ mode: "llm", model: "deepseek-v4-flash", venue: "cre" });
    expect(run.transcript.arguments.every((a) => !a.text.includes("think"))).toBe(true);

    // Four arguments, then the bench twice: JSON mode rejected, retried with the schema in the prompt.
    expect(run.llmRequests).toHaveLength(6);
    for (const { headers } of run.llmRequests) expect(headers.authorization).toBe("Bearer sk-test");
    const [judgeJson, judgePlain] = run.llmRequests.slice(4).map((r) => r.body);
    expect(judgeJson.response_format).toEqual({ type: "json_object" });
    expect(judgePlain.response_format).toBeUndefined();
    expect(judgePlain.messages[1].content).toContain("matching this JSON Schema");
  });

  test("chain reads down: rotates by the hour and marks at spot", () => {
    const run = trial(
      baseConfig,
      ({ body }) => {
        const text = body.output_config.format ? JSON.stringify(RULING) : speechFor(body.system, body.messages[0].content);
        return {
          statusCode: 200,
          body: JSON.stringify({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text }] }),
        };
      },
      { chainReads: false },
    );
    expectConsistentFiling(run, 17_125_000_000n);
    expect(run.transcript.exhibits.map((x) => x.kind)).not.toContain("oracle");
    expect(run.transcript.sentence.steps[0].formula).toBe("spot price [Ex. A]");
  });

  test("subscribes one cron handler", () => {
    const handlers = initWorkflow(baseConfig);
    expect(handlers).toHaveLength(1);
    expect(handlers[0].fn).toBe(convene);
  });
});
