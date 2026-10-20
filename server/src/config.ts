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

  /** Claude counsel is used when credentials exist; otherwise demo counsel. COUNSEL=demo forces demo. */
  counsel: (process.env.COUNSEL ?? "auto") as "auto" | "claude" | "demo",
  model: process.env.CLAUDE_MODEL ?? "claude-opus-5-5",

  chain: {
    mode: chainMode,
    rpcUrl: process.env.RPC_URL ?? (chainMode === "local" ? "http://127.0.0.1:8545" : "https://ethereum-sepolia-rpc.publicnode.com"),
    courtAddress: process.env.COURT_ADDRESS as `0x${string}` | undefined,
    /** Key the clerk uses to file rulings directly (local mode: it is also the forwarder). */
    clerkKey: (process.env.CLERK_PRIVATE_KEY ?? (chainMode === "local" ? ANVIL_KEY_0 : undefined)) as `0x${string}` | undefined,
    explorer: chainMode === "sepolia" ? "https://sepolia.etherscan.io" : "",
  },
};
