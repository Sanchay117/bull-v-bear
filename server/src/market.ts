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

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function getJson(url: string): Promise<unknown> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  const value = await res.json();
  cache.set(url, { at: Date.now(), value });
  return value;
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
