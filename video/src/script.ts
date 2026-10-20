// The film's narration, one entry per scene, in order. `text` is what the captions show;
// `say` (when set) is what the voice actor reads, spelled for the ear.
// scripts/voice.ts turns each entry into public/vo/<id>.mp3 and records its timing in
// public/vo/manifest.json, and the composition sizes every scene to its line.

export interface Line {
  id: string;
  text: string;
  say?: string;
  /** Seconds of picture before the narrator starts. */
  lead?: number;
  /** Seconds of picture after the narrator stops. */
  tail?: number;
  /** The scene is never shorter than this, voice or not. */
  minSeconds?: number;
}

export const SCRIPT: Line[] = [
  {
    id: "open",
    text: "Most trading agents are a black box. Market data goes in, a buy button comes out, and nobody can tell you why.",
    lead: 0.8,
    tail: 1.4,
  },
  {
    id: "title",
    text: "Bull v. Bear puts every trade on trial. Here, the reasoning trail is the product.",
    say: "Bull versus Bear puts every trade on trial. Here, the reasoning trail is the product.",
    lead: 1.2,
    tail: 1.0,
  },
  {
    id: "discovery",
    text: "First, discovery. Live market data from CoinGecko and the Fear & Greed Index is entered into the record as six lettered exhibits: price, range, trend, volatility, liquidity and sentiment.",
    say: "First, discovery. Live market data from Coin Gecko and the Fear and Greed Index is entered into the record as six lettered exhibits: price, range, trend, volatility, liquidity, and sentiment.",
  },
  {
    id: "argument",
    text: "Then, argument. Two AI agents, counsel for the Bull and counsel for the Bear, argue from the same evidence. Every claim must cite an exhibit and spell out cause and effect: the evidence, the mechanism, the expected move. Then each side rebuts the other.",
  },
  {
    id: "ruling",
    text: "A third agent, the judge, weighs the exhibits, not the rhetoric. It returns findings of fact for each exhibit, a verdict, a conviction score, a written opinion and a dissent.",
    say: "A third agent, the judge, weighs the exhibits, not the rhetoric. It returns findings of fact for each exhibit, a verdict, a conviction score, a written opinion, and a dissent.",
    tail: 1.2,
  },
  {
    id: "sentencing",
    text: "Sentencing is plain arithmetic, with no AI involved. Fixed guidelines turn conviction and realized volatility into a stop, a target and a position size, and every step shows its formula.",
    say: "Sentencing is plain arithmetic, with no A.I. involved. Fixed guidelines turn conviction and realized volatility into a stop, a target, and a position size, and every step shows its formula.",
  },
  {
    id: "filing",
    text: "Finally, filing. The whole transcript is canonicalized and hashed with keccak256. The hash and the order go on-chain to the CourtRecord contract, and the next ruling settles the trade, so the court keeps a public win-loss record.",
    say: "Finally, filing. The whole transcript is canonicalized and hashed with ketch-ack two fifty-six. The hash and the order go on-chain to the Court Record contract, and the next ruling settles the trade, so the court keeps a public win-loss record.",
    tail: 1.0,
  },
  {
    id: "cre",
    text: "And the court runs itself, as a Chainlink CRE workflow. A cron trigger convenes the court. HTTP capabilities gather the evidence and call the model, with consensus across the oracle network. Sentencing runs deterministically in WebAssembly, the report is signed, and the EVM capability files it through the Keystone forwarder.",
    say: "And the court runs itself, as a Chainlink C.R.E. workflow. A cron trigger convenes the court. H.T.T.P. capabilities gather the evidence and call the model, with consensus across the oracle network. Sentencing runs deterministically in WebAssembly, the report is signed, and the E.V.M. capability files it through the Keystone forwarder.",
    tail: 1.0,
  },
  {
    id: "simulate",
    text: "Here is the workflow in the CRE simulator: live evidence, five model calls, one signed report.",
    say: "Here is the workflow in the C.R.E. simulator: live evidence, five model calls, one signed report.",
    tail: 2.0,
  },
  {
    id: "live",
    text: "And this is the live courtroom, on Groq's free tier. A full trial takes under twenty seconds. Arguments stream onto pleading paper, counsel's private notes stay under seal, the scales tip, and the verdict is stamped.",
    lead: 0.6,
    tail: 1.5,
  },
  {
    id: "verify",
    text: "Anyone can check the record. Your browser recomputes the hash and compares it with the one on-chain. Change a single word, and verification fails.",
    tail: 1.5,
  },
  {
    id: "close",
    text: "Bull v. Bear. Agents that show their work, and a record that proves it. The court is adjourned.",
    say: "Bull versus Bear. Agents that show their work, and a record that proves it. The court is adjourned.",
    lead: 0.8,
    tail: 3.0,
  },
];
