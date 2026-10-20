import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { courtRecordAbi, bytes32ToAsset, fromUsd8, VERDICT_FROM_CODE, type Verdict } from "@court/core";
import { courtRecordBytecode } from "@court/core/bytecode";
import { config } from "./config.ts";

export interface OnChainRuling {
  caseNumber: number;
  asset: string;
  verdict: Verdict;
  conviction: number;
  sizeBps: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  trialTime: number;
  filedAt: number;
  transcriptHash: Hex;
  evidenceHash: Hex;
  settled: boolean;
  exitPrice: number;
  moveBps: number;
  bankrollImpactBps: number;
  holding: string;
}

export interface ChainStatus {
  mode: string;
  online: boolean;
  chainId?: number;
  address?: Address;
  forwarder?: Address;
  clerk?: Address;
  canFile: boolean;
  explorer: string;
  error?: string;
}

const account = config.chain.clerkKey ? privateKeyToAccount(config.chain.clerkKey) : undefined;
let pub: PublicClient | undefined;
let court: Address | undefined = config.chain.courtAddress;
let status: ChainStatus = { mode: config.chain.mode, online: false, canFile: false, explorer: config.chain.explorer };

const deploymentFile = (chainId: number) => join(config.dataDir, `deployment-${chainId}.json`);

async function hasCode(addr: Address) {
  const code = await pub!.getCode({ address: addr });
  return Boolean(code && code !== "0x");
}

/** Connects to the chain; in local mode deploys CourtRecord with the clerk acting as forwarder. */
export async function initChain(): Promise<ChainStatus> {
  if (config.chain.mode === "off") return (status = { ...status, online: false, error: "CHAIN_MODE=off" });
  try {
    pub = createPublicClient({ transport: http(config.chain.rpcUrl) }) as PublicClient;
    const chainId = await pub.getChainId();

    if (!court && existsSync(deploymentFile(chainId))) {
      const saved = JSON.parse(readFileSync(deploymentFile(chainId), "utf8")).address as Address;
      if (await hasCode(saved)) court = saved;
    }
    if (!court && config.chain.mode === "local" && account) {
      const wallet = createWalletClient({ account, transport: http(config.chain.rpcUrl) });
      const hash = await wallet.deployContract({
        abi: courtRecordAbi,
        bytecode: courtRecordBytecode,
        args: [account.address],
        chain: null,
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      court = receipt.contractAddress ?? undefined;
      mkdirSync(config.dataDir, { recursive: true });
      writeFileSync(deploymentFile(chainId), JSON.stringify({ address: court, txHash: hash }, null, 2));
      console.log(`⚖  CourtRecord deployed to local chain at ${court}`);
    }
    if (!court) throw new Error("No COURT_ADDRESS configured");

    const forwarder = (await pub.readContract({ address: court, abi: courtRecordAbi, functionName: "getForwarderAddress" })) as Address;
    status = {
      mode: config.chain.mode,
      online: true,
      chainId,
      address: court,
      forwarder,
      clerk: account?.address,
      canFile: Boolean(account && account.address.toLowerCase() === forwarder.toLowerCase()),
      explorer: config.chain.explorer,
    };
  } catch (err) {
    status = { ...status, online: false, canFile: false, error: (err as Error).message.split("\n")[0] };
  }
  return status;
}

export const chainStatus = () => status;

/** Files a report the way the Keystone forwarder would: onReport(metadata, report). */
export async function fileReport(report: Hex): Promise<{ txHash: Hex; blockNumber: number; caseNumber: number }> {
  if (!pub || !court || !account || !status.canFile) throw new Error("This clerk is not authorized to file on this chain");
  const wallet = createWalletClient({ account, transport: http(config.chain.rpcUrl) });
  const txHash = await wallet.writeContract({
    address: court,
    abi: courtRecordAbi,
    functionName: "onReport",
    args: ["0x", report],
    chain: null,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error("Filing transaction reverted");
  let caseNumber = -1;
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: courtRecordAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "RulingEntered") caseNumber = Number(ev.args.caseNumber);
    } catch {
      // not ours
    }
  }
  return { txHash, blockNumber: Number(receipt.blockNumber), caseNumber };
}

type RawRuling = {
  asset: Hex;
  verdict: number;
  conviction: number;
  sizeBps: number;
  entryPrice: bigint;
  stopPrice: bigint;
  targetPrice: bigint;
  trialTime: bigint;
  filedAt: bigint;
  transcriptHash: Hex;
  evidenceHash: Hex;
  settled: boolean;
  exitPrice: bigint;
  moveBps: number;
  bankrollImpactBps: number;
  holding: string;
};

const toRuling = (r: RawRuling, caseNumber: number): OnChainRuling => ({
  caseNumber,
  asset: bytes32ToAsset(r.asset),
  verdict: VERDICT_FROM_CODE[r.verdict] ?? "DISMISSED",
  conviction: r.conviction,
  sizeBps: r.sizeBps,
  entryPrice: fromUsd8(r.entryPrice),
  stopPrice: fromUsd8(r.stopPrice),
  targetPrice: fromUsd8(r.targetPrice),
  trialTime: Number(r.trialTime),
  filedAt: Number(r.filedAt),
  transcriptHash: r.transcriptHash,
  evidenceHash: r.evidenceHash,
  settled: r.settled,
  exitPrice: fromUsd8(r.exitPrice),
  moveBps: r.moveBps,
  bankrollImpactBps: r.bankrollImpactBps,
  holding: r.holding,
});

export interface Docket {
  total: number;
  equityIndex: number;
  wins: number;
  losses: number;
  rulings: OnChainRuling[];
}

export async function readDocket(limit = 50): Promise<Docket> {
  if (!pub || !court || !status.online) return { total: 0, equityIndex: 1, wins: 0, losses: 0, rulings: [] };
  const read = <T>(functionName: string, args: unknown[] = []) =>
    pub!.readContract({ address: court!, abi: courtRecordAbi, functionName: functionName as never, args: args as never }) as Promise<T>;
  const [total, equity, wins, losses, page] = await Promise.all([
    read<bigint>("totalCases"),
    read<bigint>("equityIndex"),
    read<bigint>("wins"),
    read<bigint>("losses"),
    read<RawRuling[]>("getRecentRulings", [0n, BigInt(limit)]),
  ]);
  const n = Number(total);
  return {
    total: n,
    equityIndex: Number(equity) / 1e8,
    wins: Number(wins),
    losses: Number(losses),
    rulings: page.map((r, i) => toRuling(r, n - 1 - i)),
  };
}

export async function rulingByTranscript(hash: Hex): Promise<OnChainRuling | null> {
  if (!pub || !court || !status.online) return null;
  const [exists, caseNumber] = (await pub.readContract({
    address: court,
    abi: courtRecordAbi,
    functionName: "caseForTranscript",
    args: [hash],
  })) as [boolean, bigint];
  if (!exists) return null;
  const r = (await pub.readContract({ address: court, abi: courtRecordAbi, functionName: "getRuling", args: [caseNumber] })) as RawRuling;
  return toRuling(r, Number(caseNumber));
}
