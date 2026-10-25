# DoraHacks BUIDL draft

Paste into the BUIDL form on Legal Hack 2026.

**Name:** Bull v. Bear: The Court of Market Opinion

**Tagline:** AI counsel argue the market from evidence, an AI judge rules, and a Chainlink CRE workflow
files the signed record on-chain.

**Links**

- Repository: https://github.com/Sanchay117/bull-v-bear
- Live courtroom: https://bull-v-bear.onrender.com (free hosting: the first visit may take a minute to wake)
- Demo video: https://youtu.be/GeEpKHzueTk
- CourtRecord on Sepolia: https://sepolia.etherscan.io/address/0xbcA0a8c279B1dfDD5cC6640dA7eA22CeaeAE26B3
- A ruling filed by the CRE workflow, marked at the Chainlink feed: https://sepolia.etherscan.io/tx/0xbcf7837c318a489c8a6bdba3d2dbfa9902ecead9c55e6028594d73e6d0bfd406
- The autonomous docket (every transcript and CRE CLI log): https://github.com/Sanchay117/bull-v-bear/tree/main/docket

**Bounties:** Chainlink: Best workflow with CRE · RYO-CHAN: Autonomous Agents

**Images:** logo `video/out/logo.png` (800 × 800), cover `video/out/thumbnail.png` (1280 × 720).
Regenerate with `cd video && npm run stills`.

### YouTube upload

**Title:** Bull v. Bear: AI agents argue every trade, a Chainlink CRE workflow files the verdict on-chain

**Description:**

> Most trading agents are a black box. Bull v. Bear puts every trade on trial. Two AI counsel argue
> the market from live evidence, citing lettered exhibits. An AI judge rules with findings, an
> opinion and a dissent. Fixed guidelines size the practice position, and a Chainlink CRE workflow
> files the hashed transcript on-chain, where anyone can verify it.
>
> Built for Legal Hack 2026 (Chainlink: Best workflow with CRE · Autonomous Agents).
> Code: https://github.com/Sanchay117/bull-v-bear
>
> Practice positions only. No funds move. Not financial advice.

Upload the mastered file (`npm run render && npm run master` → `out/bull-v-bear-master.mp4`) with
the thumbnail above.

---

## What it is

Most trading agents are a black box that turns data into a buy button. Bull v. Bear runs every
trade decision as a trial, so the reasoning trail is the product.

1. **Discovery.** Live market data (CoinGecko price, range, 7-day hourly closes, volume; the Crypto
   Fear & Greed Index; the asset's Chainlink Data Feed on Ethereum mainnet) is entered into the
   record as lettered exhibits A–G.
2. **Argument.** Counsel for the Bull and Counsel for the Bear, two AI agents, each give an opening
   and a rebuttal from the same exhibits. Every claim must cite an exhibit and state its cause and
   effect: the evidence, the mechanism, and the expected move.
3. **Ruling.** A third agent, the judge, returns structured JSON: findings of fact per exhibit, a
   verdict (LONG, SHORT or DISMISSED), a conviction score, an opinion and a written dissent.
4. **Sentencing.** Fixed guidelines, with no AI involved, turn conviction and realized volatility into
   a stop, a target and a position size, entered at the Chainlink mark. Every step prints its formula.
5. **Filing.** The whole transcript is canonicalized and hashed with keccak256. The hash and the
   order go on-chain to `CourtRecord`. The next ruling for the asset settles the open practice
   position at the new Chainlink mark, so the court keeps a public win-loss record and an equity
   curve. It never scores itself against the API its counsel argued from.
6. **The autonomous docket.** Every three hours the court convenes on its own. A scheduler runs the
   CRE workflow in the CRE CLI, which picks the next asset from the on-chain case count, tries it and
   files the ruling on Sepolia. The transcript and the CRE CLI log are pushed to the public docket.

Anyone can verify a ruling. The browser recomputes the transcript hash and compares it with the
chain, and changing a single word makes verification fail.

Practice positions only. No funds move.

## Chainlink CRE

`cre/bull-v-bear/workflow.ts` is the orchestration layer for the autonomous docket; nothing else
coordinates the steps. It works across two chains:

- **Trigger.** A `CronCapability` trigger convenes the court.
- **Docket.** `EVMClient.callContract` reads `CourtRecord.totalCases()` on Sepolia at the last
  finalized block. Case N tries asset N mod 4, so ETH, BTC, SOL and LINK rotate whatever the
  schedule.
- **Discovery.** `HTTPClient` fetches CoinGecko and Fear & Greed with identical consensus and
  response caching.
- **The mark.** `EVMClient.callContract` reads the asset's Chainlink Data Feed (`latestRoundData`,
  `decimals`) on Ethereum mainnet. It is entered as Exhibit G, and positions are entered and settled
  at it.
- **Counsel and bench.** `HTTPClient` makes five LLM calls (two openings, two rebuttals, the
  ruling), with the key from `runtime.getSecret`.
- **Sentencing, hash and ABI encoding.** These run deterministically in WASM. They use the same
  `core` module as the courtroom server, so a ruling made in the DON hashes and renders exactly like
  one made in the courtroom.
- **Filing.** `runtime.report()` signs the report, and `EVMClient.writeReport()` files it through
  the Keystone forwarder to `CourtRecord.onReport` on Sepolia.

The workflow integrates two blockchains with external APIs and LLM agents, with consensus on every
off-chain answer. It is tested in the CRE SDK test runtime, including a run where both chain reads
fail and the court falls back to hourly rotation and a spot mark. It compiles to WASM and runs end
to end in the CRE CLI simulator (`cre workflow simulate`): the docket read, live discovery, the
Chainlink feed read, five model calls, the ruling, sentencing and a signed report.

The docket scheduler runs `cre workflow simulate --broadcast` every three hours, and the
simulator's forwarder delivers each report to `CourtRecord` on Sepolia
([0xbcA0…6B3](https://sepolia.etherscan.io/address/0xbcA0a8c279B1dfDD5cC6640dA7eA22CeaeAE26B3)).
Every run's CLI log is in the [public docket](https://github.com/Sanchay117/bull-v-bear/tree/main/docket)
next to the transcript it filed.

## Autonomous agents

This entry builds the bounty's suggested Bull/Bear debate direction: opposing agents argue from the
same evidence, and a third judges. Each element of the brief is covered:

- **Interpret market evidence.** Agents may only cite the exhibits entered in discovery.
- **Record the practice trades.** Every ruling becomes a sized practice position on a public ledger,
  and the next ruling scores it at the Chainlink mark.
- **Autonomous.** The court convenes itself every three hours and files every case on-chain, so its
  track record grows without anyone pressing a button.
- **Show cause and effect.** Every claim states its evidence, mechanism and consequence, and the
  judge ties each exhibit to a side and a weight.
- **Repeatable reasoning trail.** The exhibits, arguments, ruling and sentencing worksheet form one
  canonical transcript whose hash is on-chain and re-verifiable in the browser.

## Built with

TypeScript throughout:

- **Front end:** React and Vite for the courtroom.
- **Server:** Node, streaming the trial over SSE.
- **Contracts:** Solidity and Foundry (`CourtRecord`, a Keystone receiver).
- **Workflow:** the Chainlink CRE TypeScript SDK.
- **Counsel:** Claude, or any OpenAI-compatible model. The demo runs on Groq's gpt-oss-120b at low
  reasoning effort, where a full trial takes under 10 seconds.
- **Video:** Remotion, with Deepgram narration.
