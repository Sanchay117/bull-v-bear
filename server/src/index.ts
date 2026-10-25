import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS, DEFAULT_ORDERS, assetBySymbol, counselName, transcriptHash, type StandingOrders, type Transcript } from "@court/core";
import { chainStatus, initChain, readDocket, rulingByTranscript } from "./chain.ts";
import { config } from "./config.ts";
import { makeCounsel } from "./counsel.ts";
import { listTranscriptHashes, loadTranscript, saveTranscript } from "./store.ts";
import { runTrial, type TrialEvent } from "./trial.ts";

const counsel = makeCounsel();
const webDist = fileURLToPath(new URL("../../web/dist/", import.meta.url));

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 512_000): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new Error("Body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function ordersFrom(q: URLSearchParams): StandingOrders {
  const n = (k: string, lo: number, hi: number, d: number) => {
    const v = Number(q.get(k));
    return Number.isFinite(v) && q.has(k) ? Math.min(hi, Math.max(lo, v)) : d;
  };
  return {
    riskPerTradeBps: n("risk", 10, 500, DEFAULT_ORDERS.riskPerTradeBps),
    maxPositionBps: n("cap", 100, 10_000, DEFAULT_ORDERS.maxPositionBps),
    minConviction: n("min", 50, 90, DEFAULT_ORDERS.minConviction),
    rewardRiskRatio: n("rr", 1, 5, DEFAULT_ORDERS.rewardRiskRatio),
    stopVolMultiple: n("stop", 0.5, 4, DEFAULT_ORDERS.stopVolMultiple),
  };
}

function serveTrial(req: IncomingMessage, res: ServerResponse, q: URLSearchParams) {
  let asset;
  try {
    asset = assetBySymbol(q.get("asset") ?? "ETH");
  } catch (err) {
    return json(res, 400, { error: (err as Error).message });
  }
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  let open = true;
  req.on("close", () => (open = false));
  const emit = (e: TrialEvent) => {
    if (open) res.write(`data: ${JSON.stringify(e)}\n\n`);
  };
  const heartbeat = setInterval(() => open && res.write(": still in session\n\n"), 15_000);
  void runTrial(asset, ordersFrom(q), counsel, emit).finally(() => {
    clearInterval(heartbeat);
    if (open) res.end();
  });
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function serveStatic(path: string, res: ServerResponse) {
  if (!existsSync(webDist)) return json(res, 404, { error: "Not found. Run the web app with `npm run dev:web`." });
  let file = normalize(join(webDist, path));
  if (!file.startsWith(webDist) || !existsSync(file) || statSync(file).isDirectory()) file = join(webDist, "index.html");
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  try {
    if (req.method === "GET" && path === "/api/status") {
      return json(res, 200, { counsel: counsel.info, chain: chainStatus(), assets: ASSETS, defaults: DEFAULT_ORDERS });
    }
    if (req.method === "GET" && path === "/api/trial") return serveTrial(req, res, url.searchParams);

    if (req.method === "GET" && path === "/api/docket") {
      const [docket, have] = await Promise.all([readDocket(60), listTranscriptHashes()]);
      return json(res, 200, { ...docket, rulings: docket.rulings.map((r) => ({ ...r, hasTranscript: have.has(r.transcriptHash) })) });
    }

    const m = path.match(/^\/api\/transcripts\/(0x[0-9a-f]{64})$/);
    if (req.method === "GET" && m) {
      const filed = await loadTranscript(m[1]);
      if (!filed) return json(res, 404, { error: "No transcript with that hash is on file" });
      const onChain = await rulingByTranscript(m[1] as `0x${string}`).catch(() => null);
      return json(res, 200, { ...filed, onChain });
    }

    // The CRE workflow posts each transcript here so the words behind an on-chain hash are public.
    if (req.method === "POST" && path === "/api/records") {
      if (process.env.RECORDS_KEY && req.headers["x-court-key"] !== process.env.RECORDS_KEY) {
        return json(res, 401, { error: "Bad court key" });
      }
      const body = JSON.parse(await readBody(req)) as { transcript?: Transcript };
      if (!body.transcript) return json(res, 400, { error: "Missing transcript" });
      const hash = transcriptHash(body.transcript);
      saveTranscript({ transcript: body.transcript, transcriptHash: hash, filing: { venue: "cre" } });
      console.log(`📜 Transcript received from CRE: ${body.transcript.caption} ${hash}`);
      return json(res, 200, { transcriptHash: hash });
    }

    if (req.method === "GET" && !path.startsWith("/api/")) return serveStatic(path, res);
    return json(res, 404, { error: "Not found" });
  } catch (err) {
    return json(res, 500, { error: (err as Error).message });
  }
});

const chain = await initChain();
server.listen(config.port, () => {
  console.log(`\n  ⚖  BULL v. BEAR: the Court of Market Opinion is in session`);
  console.log(`     clerk      http://localhost:${config.port}`);
  console.log(
    `     counsel    ${counsel.info.mode === "demo" ? "demo counsel (set ANTHROPIC_API_KEY or LLM_API_KEY for live counsel)" : `${counselName(counsel.info)} (${counsel.info.model})`}`,
  );
  console.log(
    `     record     ${chain.online ? `${chain.mode} chain ${chain.chainId} · CourtRecord ${chain.address}${chain.canFile ? " · clerk may file" : ""}` : `offline (${chain.error})`}\n`,
  );
});
