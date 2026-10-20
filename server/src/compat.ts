// Counsel served by any OpenAI-compatible chat completions API (DeepSeek, OpenRouter, Gemini,
// Groq, …). Same rules of court as Claude counsel; the judge uses JSON mode plus the schema in
// the prompt, and the ruling still passes through normalizeRuling before it reaches the record.

import {
  JUDGE_SYSTEM,
  counselSystem,
  extractJson,
  judgeJsonInstruction,
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
import type { Counsel, StreamHooks } from "./counsel.ts";

export class CompatError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ChatDelta {
  content?: string | null;
  /** Reasoning models expose their thinking under one of these names, depending on the provider. */
  reasoning_content?: string | null;
  reasoning?: string | null;
}

interface ChatChunk {
  choices?: Array<{ delta?: ChatDelta }>;
  error?: { message?: string };
}

function errorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    const msg = typeof parsed.error === "string" ? parsed.error : (parsed.error?.message ?? parsed.message);
    if (msg) return `${config.llm.baseUrl} answered ${status}: ${msg}`;
  } catch {
    // not JSON
  }
  return `${config.llm.baseUrl} answered ${status}${body ? `: ${body.slice(0, 200)}` : ""}`;
}

export class CompatCounsel implements Counsel {
  info: CounselInfo = { mode: "llm", model: config.llm.model, venue: "clerk" };

  /** Streams one chat completion, routing reasoning (and inline <think> blocks) to sealed notes. */
  private async chat(system: string, prompt: string, hooks: StreamHooks, maxTokens: number, json: boolean): Promise<string> {
    const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.llm.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.llm.model,
        stream: true,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok || !res.body) throw new CompatError(res.status, errorMessage(res.status, await res.text().catch(() => "")));

    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let thinking = false;
    const emit = (piece: string) => {
      // Some open models think inline: <think>…</think> before the answer.
      for (const part of piece.split(/(<\/?think>)/)) {
        if (part === "<think>") thinking = true;
        else if (part === "</think>") thinking = false;
        else if (part && thinking) hooks.onNotes(part);
        else if (part) {
          text += part;
          hooks.onText(part);
        }
      }
    };

    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let parsed: ChatChunk;
        try {
          parsed = JSON.parse(data) as ChatChunk;
        } catch {
          continue;
        }
        if (parsed.error) throw new CompatError(502, `${config.llm.model}: ${parsed.error.message ?? "stream error"}`);
        const delta = parsed.choices?.[0]?.delta;
        const notes = delta?.reasoning_content ?? delta?.reasoning;
        if (notes) hooks.onNotes(notes);
        if (delta?.content) emit(delta.content);
      }
    }
    return text.trim();
  }

  async argue(e: Evidence, side: Side, round: Round, opponent: Argument | null, hooks: StreamHooks): Promise<string> {
    const prompt = round === "opening" || !opponent ? openingPrompt(e, side) : rebuttalPrompt(e, side, opponent);
    const text = await this.chat(counselSystem(side), prompt, hooks, 4000, false);
    if (!text) throw new Error(`Counsel for the ${side} said nothing (${config.llm.model}).`);
    return text;
  }

  async judge(e: Evidence, args: Argument[], hooks: StreamHooks): Promise<JudgeRuling> {
    const prompt = `${judgePrompt(e, args)}\n\n${judgeJsonInstruction()}`;
    const quiet: StreamHooks = { onText: () => {}, onNotes: hooks.onNotes };
    let text: string;
    try {
      text = await this.chat(JUDGE_SYSTEM, prompt, quiet, 8000, true);
    } catch (err) {
      // A few providers reject JSON mode; the schema in the prompt is enough for them.
      if (!(err instanceof CompatError) || err.status !== 400) throw err;
      text = await this.chat(JUDGE_SYSTEM, prompt, quiet, 8000, false);
    }
    return normalizeRuling(extractJson(text), e.exhibits.map((x) => x.id));
  }
}
