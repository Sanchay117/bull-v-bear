import Anthropic from "@anthropic-ai/sdk";
import {
  JUDGE_SYSTEM,
  RULING_SCHEMA,
  counselSystem,
  extractJson,
  judgePrompt,
  normalizeRuling,
  openingPrompt,
  rebuttalPrompt,
  type Argument,
  type CounselInfo,
  type Evidence,
  type JudgeRuling,
  type Round,
  type Side,
} from "@court/core";
import { config } from "./config.ts";
import { DemoCounsel } from "./demo.ts";

export interface StreamHooks {
  /** Visible argument text as it is spoken. */
  onText(delta: string): void;
  /** Counsel's private reasoning (summarized thinking), shown in the UI as sealed notes. */
  onNotes(delta: string): void;
}

export interface Counsel {
  info: CounselInfo;
  argue(e: Evidence, side: Side, round: Round, opponent: Argument | null, hooks: StreamHooks): Promise<string>;
  judge(e: Evidence, args: Argument[], hooks: StreamHooks): Promise<JudgeRuling>;
}

// Server-side fallback: if the model declines for policy reasons, the API re-runs the request
// on Anthropic's recommended fallback model within the same call.
const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

class ClaudeCounsel implements Counsel {
  info: CounselInfo = { mode: "claude", model: config.model, venue: "clerk" };
  private client = new Anthropic();

  async argue(e: Evidence, side: Side, round: Round, opponent: Argument | null, hooks: StreamHooks): Promise<string> {
    const prompt = round === "opening" || !opponent ? openingPrompt(e, side) : rebuttalPrompt(e, side, opponent);
    const stream = this.client.beta.messages.stream({
      model: config.model,
      max_tokens: 16000,
      system: counselSystem(side),
      messages: [{ role: "user", content: prompt }],
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "medium" },
      ...FALLBACK,
    });
    stream.on("text", (d) => hooks.onText(d));
    stream.on("thinking", (d) => hooks.onNotes(d));
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new Error(`Counsel for the ${side} declined to argue.`);
    return msg.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim();
  }

  async judge(e: Evidence, args: Argument[], hooks: StreamHooks): Promise<JudgeRuling> {
    const stream = this.client.beta.messages.stream({
      model: config.model,
      max_tokens: 16000,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: judgePrompt(e, args) }],
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "high", format: { type: "json_schema", schema: RULING_SCHEMA as unknown as Record<string, unknown> } },
      ...FALLBACK,
    });
    stream.on("thinking", (d) => hooks.onNotes(d));
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("The bench declined to rule.");
    const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return normalizeRuling(extractJson(text), e.exhibits.map((x) => x.id));
  }
}

export function makeCounsel(): Counsel {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
  if (config.counsel === "claude" || (config.counsel === "auto" && hasKey)) return new ClaudeCounsel();
  return new DemoCounsel();
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Claude rejected the API key (401). Check ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "Claude rate limit reached — wait a moment and call the case again.";
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ""}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
