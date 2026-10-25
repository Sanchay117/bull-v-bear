import { join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

// Anvil's well-known dev account #0. Only ever used against a local chain.
const ANVIL_KEY_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export type ChainMode = "local" | "sepolia" | "off";

const chainMode = (process.env.CHAIN_MODE ?? "local") as ChainMode;

export const config = {
  port: Number(process.env.PORT ?? 8787),
  dataDir: process.env.DATA_DIR ?? join(here, "..", "data"),

  /**
   * auto: Claude if Anthropic credentials exist, else an OpenAI-compatible provider if LLM_API_KEY is set,
   * else demo counsel. COUNSEL=claude|llm|demo forces one.
   */
  counsel: (process.env.COUNSEL ?? "auto") as "auto" | "claude" | "llm" | "demo",
  model: process.env.CLAUDE_MODEL ?? "claude-opus-5-5",

  /** Any OpenAI-compatible chat completions API (DeepSeek, OpenRouter, Gemini, Groq, …). */
  llm: {
    baseUrl: (process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1").replace(/\/+$/, ""),
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL ?? "deepseek-chat",
    /** Sent as reasoning_effort (low|medium|high) when set; gpt-oss, Qwen 3 and o-series models take it. */
    reasoningEffort: process.env.LLM_REASONING_EFFORT,
  },

  /**
   * Optional CoinGecko Demo API key. Keyless calls are rate-limited per IP, and hosts like Render
   * share IPs; a free demo key gets its own quota.
   */
  coingeckoKey: process.env.COINGECKO_API_KEY,

  /** Ethereum mainnet, where the Chainlink Data Feeds behind the oracle exhibit live (read only). */
  feedRpcUrl: process.env.FEED_RPC_URL ?? "https://ethereum-rpc.publicnode.com",

  /**
   * The public docket: transcripts the scheduled CRE runs commit to the repo (docket/transcripts).
   * The copy shipped with this build is read from disk; newer ones from DOCKET_URL, e.g.
   * https://raw.githubusercontent.com/<owner>/<repo>/main/docket
   */
  docketDir: process.env.DOCKET_DIR ?? join(here, "..", "..", "docket"),
  docketUrl: process.env.DOCKET_URL?.replace(/\/+$/, ""),

  chain: {
    mode: chainMode,
    rpcUrl: process.env.RPC_URL ?? (chainMode === "local" ? "http://127.0.0.1:8545" : "https://ethereum-sepolia-rpc.publicnode.com"),
    courtAddress: process.env.COURT_ADDRESS as `0x${string}` | undefined,
    /** Key the clerk uses to file rulings directly (local mode: it is also the forwarder). */
    clerkKey: (process.env.CLERK_PRIVATE_KEY ?? (chainMode === "local" ? ANVIL_KEY_0 : undefined)) as `0x${string}` | undefined,
    explorer: chainMode === "sepolia" ? "https://sepolia.etherscan.io" : "",
  },
};
