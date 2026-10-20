// Runs the whole trial inside the CRE test runtime: mocked HTTP (CoinGecko, Fear & Greed,
// Claude, the clerk) and a mocked EVM write. Checks the request Claude receives and that the
// signed report decodes to the hash of the transcript lodged with the clerk.

import { describe, expect } from "bun:test";
import { TxStatus } from "@chainlink/cre-sdk";
import { EvmMock, HttpActionsMock, newTestRuntime, test } from "@chainlink/cre-sdk/test";
import { bytesToHex, decodeAbiParameters, type Hex } from "viem";
import { REPORT_PARAMS, transcriptHash, type Transcript } from "../../core/src/index.ts";
import { convene, initWorkflow } from "./workflow";

const SEPOLIA = 16015286601757825753n;
const COURT = "0x7109709ECfa91a80626fF3989D68f67F5b1DD12D";
const NOW = Date.UTC(2026, 9, 20, 14, 0, 0); // hour 14 → assets[14 % 4] = SOL

const config = {
  schedule: "0 0 */2 * * *",
  assets: ["ETH", "BTC", "SOL", "LINK"],
  model: "claude-opus-5-5",
  counselEffort: "low" as const,
  judgeEffort: "medium" as const,
  claudeTimeout: "90s",
  chainSelectorName: "ethereum-testnet-sepolia",
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

const messageResponse = (text: string) =>
  JSON.stringify({ model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text }] });

describe("Bull v. Bear workflow", () => {
  test("convenes, rules, files a signed report, and lodges the transcript", () => {
    const http = HttpActionsMock.testInstance();
    const claudeRequests: Array<{ headers: Record<string, string>; body: Record<string, any> }> = [];
    let lodged = "";

    http.sendRequest = (req) => {
      if (req.url.startsWith("https://api.coingecko.com/")) {
        expect(req.url).toContain("ids=solana");
        return { statusCode: 200, body: b64(JSON.stringify(coingecko)) };
      }
      if (req.url.startsWith("https://api.alternative.me/")) return { statusCode: 200, body: b64(JSON.stringify(fearGreed)) };
      if (req.url === "https://api.anthropic.com/v1/messages") {
        const body = JSON.parse(unb64(req.body));
        claudeRequests.push({ headers: req.headers, body });
        if (body.output_config.format) return { statusCode: 200, body: b64(messageResponse(JSON.stringify(RULING))) };
        const side = body.system.includes("Counsel for the Bull") ? "BULL" : "BEAR";
        const round = body.messages[0].content.includes("Deliver your rebuttal") ? "rebuttal" : "opening";
        return { statusCode: 200, body: b64(messageResponse(SPEECH[`${side} ${round}` as keyof typeof SPEECH])) };
      }
      if (req.url === config.recordsUrl) {
        lodged = unb64(req.body);
        return { statusCode: 200, body: b64("{}") };
      }
      throw new Error(`unexpected request to ${req.url}`);
    };

    const evm = EvmMock.testInstance(SEPOLIA);
    let rawReport: Uint8Array | undefined;
    evm.writeReport = (input) => {
      expect(bytesToHex(input.receiver).toLowerCase()).toBe(COURT.toLowerCase());
      rawReport = input.report?.rawReport;
      return { txStatus: TxStatus.SUCCESS, txHash: new Uint8Array(32).fill(0xab) };
    };

    const secrets = new Map([["main", new Map([["ANTHROPIC_API_KEY", "sk-test"]])]]);
    const runtime = newTestRuntime(secrets, { timeProvider: () => NOW });
    (runtime as any).config = config;

    const result = JSON.parse(convene(runtime as any));
    expect(result.caption).toBe("In re SOL/USD");
    expect(result.verdict).toBe("LONG");
    expect(result.conviction).toBe(68);
    expect(result.action).toBe("LONG");
    expect(result.sizeBps).toBeGreaterThan(0);
    expect(result.txHash).toBe(`0x${"ab".repeat(32)}`);

    // Claude was asked five times with the court's exact procedure.
    expect(claudeRequests).toHaveLength(5);
    for (const { headers, body } of claudeRequests) {
      expect(headers["x-api-key"]).toBe("sk-test");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
      expect(body.model).toBe("claude-opus-5-5");
      expect(body.thinking).toEqual({ type: "adaptive" });
      expect(body.fallbacks).toBe("default");
    }
    const judge = claudeRequests[4].body;
    expect(judge.output_config).toMatchObject({ effort: "medium", format: { type: "json_schema" } });
    expect(judge.messages[0].content).toContain("TRANSCRIPT OF ARGUMENT");

    // The report the DON signed carries the hash of the transcript the clerk received.
    const transcript = (JSON.parse(lodged) as { transcript: Transcript }).transcript;
    expect(transcript.counsel).toEqual({ mode: "claude", model: "claude-opus-5-5", venue: "cre" });
    expect(transcript.openedAt).toBe(new Date(NOW).toISOString());
    expect(transcript.arguments.map((a) => a.citations)).toEqual([["B", "C", "F"], ["D", "E", "F"], ["D", "E"], ["A", "C"]]);

    expect(rawReport).toBeDefined();
    const payload = bytesToHex(rawReport!.slice(109)) as Hex;
    const [asset, verdict, conviction, sizeBps, entry, , , trialTime, tHash] = decodeAbiParameters(REPORT_PARAMS, payload);
    expect(asset.startsWith("0x534f4c00")).toBe(true); // "SOL"
    expect(verdict).toBe(1);
    expect(conviction).toBe(68);
    expect(sizeBps).toBe(result.sizeBps);
    expect(entry).toBe(17_125_000_000n);
    expect(trialTime).toBe(BigInt(NOW / 1000));
    expect(tHash).toBe(transcriptHash(transcript));
    expect(tHash).toBe(result.transcriptHash);
  });

  test("subscribes one cron handler", () => {
    const handlers = initWorkflow(config);
    expect(handlers).toHaveLength(1);
    expect(handlers[0].fn).toBe(convene);
  });
});
