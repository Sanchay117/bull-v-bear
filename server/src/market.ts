import { createPublicClient, http } from "viem";
import {
  FEAR_GREED_URL,
  FEED_ABI,
  buildEvidence,
  coingeckoMarketsUrl,
  parseCoinGeckoMarket,
  parseFearGreed,
  parseFeedRound,
  type AssetSpec,
  type Evidence,
  type MarketSnapshot,
  type OracleSnapshot,
  type SentimentSnapshot,
} from "@court/core";
import { config } from "./config.ts";

const mainnet = createPublicClient({ transport: http(config.feedRpcUrl, { timeout: 8_000 }) });

const TTL_MS = 60_000;
/** On a rate limit, a snapshot this recent still serves; every exhibit carries its as-of time. */
const STALE_MS = 15 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

function headersFor(url: string): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (config.coingeckoKey && new URL(url).host === "api.coingecko.com") headers["x-cg-demo-api-key"] = config.coingeckoKey;
  return headers;
}

async function getJson(url: string): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: headersFor(url), signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const value = await res.json();
      cache.set(url, { at: Date.now(), value });
      return value;
    }
    // Free APIs throttle shared IPs in short bursts: wait a moment, twice, before giving up.
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
      continue;
    }
    if (hit && Date.now() - hit.at < STALE_MS) return hit.value;
    throw new Error(`${new URL(url).host} answered ${res.status}`);
  }
}

/** The asset's Chainlink Data Feed at the last finalized block, as the CRE workflow reads it. */
async function readFeed(asset: AssetSpec): Promise<OracleSnapshot | null> {
  const feed = asset.chainlinkFeed;
  if (!feed) return null;
  const hit = cache.get(feed);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as OracleSnapshot | null;
  const [decimals, latest] = await Promise.all([
    mainnet.readContract({ address: feed, abi: FEED_ABI, functionName: "decimals", blockTag: "finalized" }),
    mainnet.readContract({ address: feed, abi: FEED_ABI, functionName: "latestRoundData", blockTag: "finalized" }),
  ]);
  const value = parseFeedRound(asset, decimals, latest);
  cache.set(feed, { at: Date.now(), value });
  return value;
}

/** Discovery: fetches market data, sentiment and the Chainlink mark and enters them as exhibits. */
export async function discoverEvidence(asset: AssetSpec): Promise<Evidence> {
  const [marketRes, sentimentRes, oracleRes] = await Promise.allSettled([
    getJson(coingeckoMarketsUrl(asset)),
    getJson(FEAR_GREED_URL),
    readFeed(asset),
  ]);
  if (marketRes.status === "rejected") {
    throw new Error(`Market data unavailable (${(marketRes.reason as Error).message}). Try again in a minute.`);
  }
  const market: MarketSnapshot = parseCoinGeckoMarket(marketRes.value);
  const sentiment: SentimentSnapshot | null = sentimentRes.status === "fulfilled" ? parseFearGreed(sentimentRes.value) : null;
  // Without the feed the court marks at spot, exactly as the workflow does.
  if (oracleRes.status === "rejected") console.warn(`Chainlink feed unreadable: ${(oracleRes.reason as Error).message.split("\n")[0]}`);
  const oracle = oracleRes.status === "fulfilled" ? oracleRes.value : null;
  return buildEvidence(asset, market, sentiment, { oracle });
}
