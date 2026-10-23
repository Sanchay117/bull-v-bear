import {
  FEAR_GREED_URL,
  buildEvidence,
  coingeckoMarketsUrl,
  parseCoinGeckoMarket,
  parseFearGreed,
  type AssetSpec,
  type Evidence,
  type MarketSnapshot,
  type SentimentSnapshot,
} from "@court/core";
import { config } from "./config.ts";

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

/** Discovery: fetches market data and sentiment and enters them as exhibits. */
export async function discoverEvidence(asset: AssetSpec): Promise<Evidence> {
  const [marketRes, sentimentRes] = await Promise.allSettled([
    getJson(coingeckoMarketsUrl(asset)),
    getJson(FEAR_GREED_URL),
  ]);
  if (marketRes.status === "rejected") {
    throw new Error(`Market data unavailable (${(marketRes.reason as Error).message}). Try again in a minute.`);
  }
  const market: MarketSnapshot = parseCoinGeckoMarket(marketRes.value);
  const sentiment: SentimentSnapshot | null = sentimentRes.status === "fulfilled" ? parseFearGreed(sentimentRes.value) : null;
  return buildEvidence(asset, market, sentiment);
}
