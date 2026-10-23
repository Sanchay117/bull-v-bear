# Bull v. Bear: The Court of Market Opinion

> AI counsel argue the market from evidence. An AI judge rules. Fixed sentencing guidelines size the
> practice trade. A Chainlink CRE workflow files the signed record on-chain, where anyone can check
> that not one word was changed.

Most trading agents are a black box that turns data into a buy button. Bull v. Bear runs every
trade decision as a **trial**, so the reasoning trail is the product:

1. **Discovery.** Live market data (CoinGecko price, range, 7-day hourly closes, volume; the
   Crypto Fear & Greed Index) is entered into the record as lettered **exhibits A–F**. Each exhibit
   has a plain-language statement and the numbers behind it.
2. **Argument.** *Counsel for the Bull* and *Counsel for the Bear* (Claude) each deliver an
   opening and a rebuttal. Every factual claim must cite an exhibit, like `[Ex. C]`, and must show
   cause and effect: the evidence, then the mechanism, then the expected price consequence.
3. **Ruling.** The *Presiding Judge* (Claude, structured JSON output) weighs the exhibits, not the
   rhetoric. It returns **LONG**, **SHORT** or **DISMISSED**, a conviction from 0–100, findings of
   fact per exhibit, an opinion and a dissent.
4. **Sentencing.** Deterministic *Sentencing Guidelines for Practice Positions* turn the ruling
   into a paper trade:
   - stop distance = vol multiple × realized daily volatility
   - risk scales with conviction
   - size = risk ÷ stop distance, capped
   - target = reward:risk × stop distance

   Every step is printed with its formula. No AI is involved in sizing.
5. **Filing.** The whole transcript is canonicalized and hashed with keccak256. The hash and the
   order (asset, verdict, conviction, size, entry/stop/target) go on-chain to `CourtRecord`. The
   next ruling for the same asset **settles** the open position at the new mark, honoring a stop or
   target that was crossed. The docket keeps a public win/loss record and an equity curve.

The courtroom UI shows all of it live:

- arguments stream onto pleading paper with line numbers
- counsel's notes (summarized thinking) arrive under seal
- exhibits light up as they're cited
- the scales of justice tremble while the court is in chambers, then tip toward the winner by
  conviction
- a rubber-stamped verdict, a sentencing order with a price ladder, a wax-sealed certificate of
  filing, and a ledger of every case

Two themes: **Courtroom** (day) and **Chambers** (night).

The **Certificate of Filing** recomputes the transcript hash in your browser and compares it with
the hash on-chain (*Verify certified copy*). *Tamper test: alter one word* changes a single word of
the opinion, and verification fails.

> Practice positions only. No funds move, and nothing here is investment advice.

---

## Architecture

```
                         ┌──────────────── core/ (shared, pure TypeScript) ────────────────┐
                         │ evidence → exhibits · prompts (rules of court) · ruling schema   │
                         │ sentencing guidelines · canonical JSON + keccak · report ABI     │
                         └───────────────┬───────────────────────────────┬─────────────────┘
                                         │                               │
     Live courtroom (interactive)        │                               │   Autonomous docket (Chainlink CRE)
 ┌──────────────┐   SSE   ┌──────────────┴──────┐                ┌───────┴──────────────────────────┐
 │  web/ React  │◀───────▶│ server/ the Clerk   │                │ cre/bull-v-bear  (WASM in a DON) │
 │  courtroom   │         │ Claude SDK stream   │                │ Cron → HTTP: CoinGecko, F&G      │
 └──────────────┘         │ market fetch, store │◀── transcript ─│ HTTP: Claude ×5 (consensus)      │
                          └──────────┬──────────┘   POST /api/   │ sentencing → runtime.report()    │
                                     │ local: files      records │ EVMClient.writeReport()          │
                                     ▼ directly                  └───────────────┬──────────────────┘
                          ┌────────────────────────────────────┐                 │ signed report
                          │ contracts/ CourtRecord.sol          │◀── Keystone ───┘
                          │ onReport → enter ruling, settle     │    Forwarder
                          │ prior position, equity, docket      │
                          └────────────────────────────────────┘
```

The clerk and the CRE workflow import the **same** `core` module. The prompts, exhibit wording,
sentencing math and report encoding are byte-for-byte the same in both, so a ruling made in the DON
hashes, verifies and renders exactly like one made in the courtroom.

| Path | What it is |
| --- | --- |
| `contracts/` | `CourtRecord.sol` (a Keystone receiver), `ReceiverTemplate.sol`, Foundry tests, deploy script |
| `core/` | Evidence builder, rules of court and prompts, ruling normalizer, sentencing guidelines, canonical hashing, report ABI |
| `server/` | The Clerk: runs trials, streams them over SSE, uses Claude (or demo counsel), files to a local chain, stores transcripts |
| `web/` | The courtroom (React + Vite) |
| `cre/bull-v-bear/` | The Chainlink CRE workflow, with a unit test that runs a full trial in the CRE test runtime |
| `video/` | The demo film (Remotion): motion graphics built from a real trial, footage of the live courtroom, Deepgram narration |

---

## Run the courtroom locally

Requires Node 24, [Foundry](https://getfoundry.sh) (anvil) and, for the workflow, [Bun](https://bun.sh).

```bash
npm install
```

```bash
anvil
```

```bash
npm run dev
```

Open http://localhost:5173, pick an asset, optionally adjust your standing orders (risk limits),
and press **Call the Court to Order**.

- The clerk auto-deploys `CourtRecord` to anvil on first start and files every ruling there.
- **Counsel.** Set one of these in `server/.env` (see `server/.env.example`):
  - **Claude:** `ANTHROPIC_API_KEY=...`. Counsel stream their arguments and summarized thinking from
    `claude-opus-5-5`.
  - **Any OpenAI-compatible API** (DeepSeek, OpenRouter, Gemini, Groq, …): `LLM_API_KEY`,
    `LLM_BASE_URL` and `LLM_MODEL`. Reasoning text (`reasoning_content`, or inline
    `<think>`/`<thought>`) goes to the sealed notes. The judge uses JSON mode with the ruling schema
    in the prompt. Overloaded (503) and rate-limited (429) calls are retried for about 45 seconds,
    and an empty answer is asked again once. Tested live on Groq's free tier with
    `openai/gpt-oss-120b`, where a full trial takes under 20 seconds, and with Gemma 4 31B on
    the Gemini API, where a trial takes about 5 minutes.
  - **Neither:** the court runs **demo counsel**, deterministic arguments built from the same
    exhibits, so the whole procedure can be shown offline.

Tests (core, CRE workflow, contracts):

```bash
npm test
```

---

## Chainlink CRE workflow

`cre/bull-v-bear/workflow.ts` uses CRE as the orchestration layer for the whole decision:

| Step | CRE capability |
| --- | --- |
| Trial on a schedule; the asset rotates hourly | `CronCapability` trigger |
| Discovery: CoinGecko markets + Fear & Greed | `HTTPClient` with identical consensus and response caching |
| Two openings, two rebuttals, the ruling (Claude Messages API with JSON-schema output, or any OpenAI-compatible API with `"provider": "openai"` and `baseUrl`) | `HTTPClient` with identical consensus (one node calls, others read the cached response) |
| LLM key | `runtime.getSecret("LLM_API_KEY")` |
| Sentencing, canonical transcript hash, ABI report | `core` (deterministic, in WASM) |
| Sign the report | `runtime.report()` (ECDSA, keccak256) |
| File to Sepolia | `EVMClient.writeReport()` → Keystone forwarder → `CourtRecord.onReport` |
| Publish the transcript behind the hash | `HTTPClient` POST to the clerk's `/api/records` (optional) |

Eight HTTP calls per run (the limit is 15). Logs stay under 1 kB per line. Consensus observations
are compact parsed snapshots and texts rather than raw pages.

### Prove it without an account

```bash
npm run test:cre
```

This runs the full trial inside the SDK's test runtime with mocked HTTP and EVM capabilities, once
with Claude and once with an OpenAI-compatible provider. It checks:

- the LLM requests (headers, model, adaptive thinking and JSON schema for Claude; JSON mode with a
  plain retry for OpenAI-compatible providers)
- the citations extracted from each argument
- that the ABI report the DON signs decodes to the keccak256 of the transcript lodged with the
  clerk

It also compiles to WASM:

```bash
cd cre/bull-v-bear && bunx cre-compile main.ts /tmp/bull-v-bear.wasm
```

### Simulate with the CRE CLI

1. Install the [CRE CLI](https://docs.chain.link/cre), then sign in to it:

   ```bash
   cre login
   ```

2. Run `cd cre/bull-v-bear && bun install`.
3. `cp cre/.env.example cre/.env` and set `LLM_API_KEY_ENV` (plus `CRE_ETH_PRIVATE_KEY` for
   step 5). For a non-Anthropic model, set `"provider": "openai"`, `baseUrl` and `model` in
   `config.staging.json`.
4. Dry-run simulation (no transaction):

   ```bash
   npm run cre:simulate
   ```

   One trial uses about 8,000 tokens in under 20 seconds. On Groq's free tier (8,000 tokens per
   minute), leave a minute between runs; a run that starts too soon stops with a 429.

5. **On-chain filing on Sepolia.**
   - Deploy `CourtRecord` with the simulation forwarder:

     ```bash
     cd contracts && FORWARDER=0x15fC6ae953E024d975e77382eEeC56A9101f9F88 forge script script/Deploy.s.sol --rpc-url https://ethereum-sepolia-rpc.publicnode.com --private-key $SEPOLIA_KEY --gas-estimate-multiplier 800 --broadcast
     ```

     Sepolia now charges far more for contract creation than forge's local EVM estimates (the node
     asks about 10.8M gas for `CourtRecord`, forge estimates 1.5M), hence the multiplier.

   - Put the deployed address in `cre/bull-v-bear/config.staging.json` as `courtAddress`.
   - Run the simulation with broadcasting:

     ```bash
     cd cre && cre workflow simulate bull-v-bear --target staging-settings --broadcast
     ```

6. Watch the docket in the courtroom. Start the clerk against Sepolia:

   ```bash
   CHAIN_MODE=sepolia COURT_ADDRESS=0x... npm run dev:server
   ```

   The clerk then reads the docket from Sepolia and serves the transcripts the workflow lodged. If
   the clerk is reachable at `recordsUrl` while you simulate, you can verify each transcript in the
   browser.

### Host the courtroom on Render

One Node service runs the clerk and serves the built courtroom. `render.yaml` describes it:

1. On [render.com](https://render.com), choose **New > Blueprint** and pick this repository.
2. Paste an OpenAI-compatible API key for `LLM_API_KEY` when asked (the blueprint uses Groq's
   `openai/gpt-oss-120b`; change `LLM_BASE_URL` and `LLM_MODEL` for another provider).
3. Deploy. The site reads the docket from `CourtRecord` on Sepolia, where the CRE workflow files
   rulings. It holds no filing key, so trials run on the site are sealed and verifiable in the
   browser but are not filed on-chain.

The free plan sleeps when idle (about a minute to wake) and forgets the site's own transcripts on
restart; the on-chain docket is unaffected.

For a deployed workflow, construct `CourtRecord` with the production `KeystoneForwarder`
(`0xF8344CFd5c43616a4366C34E3EEE75af79a74482` on Sepolia), or switch it with
`setForwarderAddress`. Optionally lock the receiver to your workflow with `setExpectedWorkflowId`
and `setExpectedAuthor`.

---

## The demo film

`video/` renders the submission video with [Remotion](https://www.remotion.dev). Every number on
screen comes from a real trial (`video/src/case.json`), and the courtroom footage is a screen
capture of that trial running live.

```bash
cd video && npm install
```

| Step | Command | Needs |
| --- | --- | --- |
| Sound effects and music bed (synthesized) | `node scripts/sfx.ts` | nothing |
| Narration, one take per scene, word-timed captions | `node scripts/voice.ts` | `DEEPGRAM_KEY` in `server/.env` |
| Film a live trial in the courtroom | `node scripts/capture.ts` | `npm run dev` and anvil running |
| Record the CRE CLI simulation | `node scripts/simulate.ts` | `cre login` |
| Preview | `npm run studio` | |
| Render | `npm run render` | |
| Master the audio to YouTube loudness (−14 LUFS) | `npm run master` | ffmpeg |
| Thumbnail (1280 × 720) and BUIDL logo (800 × 800) | `npm run stills` | |

The narration lives in `video/src/script.ts`. Each scene is sized to its voice line, and the
motion cues land on the words the narrator says.

---

## How this maps to the bounties

**Chainlink: Best workflow with CRE.** The CRE workflow is the orchestration layer. It connects a
blockchain (Sepolia `CourtRecord`, via a signed report through the Keystone forwarder) to external
APIs (CoinGecko, alternative.me) and an LLM (Claude, or any OpenAI-compatible model; the demo runs
on Groq), with consensus on every off-chain answer. The full trial is tested in the CRE test
runtime, compiles to WASM, and runs end to end in the CRE CLI simulator: live discovery, five model
calls, the ruling, sentencing and a signed report.

**RYO-CHAN: Autonomous Agents.** Agents interpret live market evidence and record practice trades
on a public ledger:

- **Bull/Bear debate**: adversarial counsel, a judge, and a written dissent.
- **Cause and effect**: every claim cites an exhibit and states its mechanism, and the judge's
  findings tie each exhibit to a side and a weight.
- **Repeatable reasoning trail**: the exhibits, arguments, ruling and sentencing worksheet are one
  canonical transcript whose hash is on-chain. Anyone can re-verify it in the browser, and the next
  ruling settles the last trade, so the agent keeps a scored track record.

---

## On-chain record format

`CourtRecord.onReport(metadata, report)` accepts:

```
(bytes32 asset, uint8 verdict, uint8 conviction, uint16 sizeBps,
 uint64 entryPrice, uint64 stopPrice, uint64 targetPrice, uint64 trialTime,
 bytes32 transcriptHash, bytes32 evidenceHash, string holding)
```

Prices use 8 decimals; verdict is `0 DISMISSED · 1 LONG · 2 SHORT`. Each ruling settles the asset's
previous open position at the new entry price (a stop or target that was crossed in between is
honored), updates `equityIndex` and the win/loss count, and emits `RulingEntered` and
`PositionSettled`.
