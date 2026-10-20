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

/** Overloaded or rate-limited: worth another try after a short wait. */
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

const INLINE_TAGS = ["<think>", "</think>", "<thought>", "</thought>"];
const INLINE_TAG = /(<\/?(?:think|thought)>)/;

type ErrorBody = { error?: { message?: string } | string; message?: string };

function errorMessage(status: number, body: string): string {
  const who = `${config.llm.model} (${new URL(config.llm.baseUrl).host})`;
  try {
    // Most providers send {error:{message}}; Gemini wraps it in an array.
    const raw = JSON.parse(body) as ErrorBody | ErrorBody[];
    const parsed = Array.isArray(raw) ? (raw[0] ?? {}) : raw;
    const msg = typeof parsed.error === "string" ? parsed.error : (parsed.error?.message ?? parsed.message);
    if (msg) return `${who} answered ${status}: ${msg}`;
  } catch {
    // not JSON
  }
  return `${who} answered ${status}${body ? `: ${body.slice(0, 200)}` : ""}`;
}

export class CompatCounsel implements Counsel {
  info: CounselInfo = { mode: "llm", model: config.llm.model, venue: "clerk" };

  /** Opens the stream, retrying for ~45s (2+4+8+15+15) while the provider is overloaded or rate-limited. */
  private async open(body: string): Promise<ReadableStream<Uint8Array>> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.llm.apiKey}`, "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(180_000),
      });
      if (res.ok && res.body) return res.body;
      const detail = await res.text().catch(() => "");
      // A daily quota (Gemini says "retryDelay": "79026s") will not clear by waiting here.
      const retryDelay = Number(detail.match(/"retryDelay":\s*"(\d+)s"/)?.[1] ?? 0);
      if (retryDelay > 60) {
        throw new CompatError(res.status, `${errorMessage(res.status, detail)} (quota resets in about ${Math.ceil(retryDelay / 3600)}h)`);
      }
      if (!TRANSIENT.has(res.status) || attempt >= 5) throw new CompatError(res.status, errorMessage(res.status, detail));
      await new Promise((r) => setTimeout(r, Math.max(retryDelay * 1000, Math.min(15_000, 2000 * 2 ** attempt))));
    }
  }

  /** Streams one chat completion, routing reasoning (and inline <think>/<thought> blocks) to sealed notes. */
  private async chat(system: string, prompt: string, hooks: StreamHooks, maxTokens: number, json: boolean): Promise<string> {
    const stream = await this.open(
      JSON.stringify({
        model: config.llm.model,
        stream: true,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    );

    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let thinking = false;
    let held = "";
    // Some open models think inline before answering: <think>…</think> (DeepSeek, Qwen) or
    // <thought>…</thought> (Gemma). A tag can be split across chunks, so a trailing partial tag is held back.
    const emit = (piece: string, final = false) => {
      held += piece;
      let ready = held;
      held = "";
      const lt = ready.lastIndexOf("<");
      if (!final && lt >= 0 && !ready.includes(">", lt) && INLINE_TAGS.some((t) => t.startsWith(ready.slice(lt)))) {
        held = ready.slice(lt);
        ready = ready.slice(0, lt);
      }
      for (const part of ready.split(INLINE_TAG)) {
        if (part === "<think>" || part === "<thought>") thinking = true;
        else if (part === "</think>" || part === "</thought>") thinking = false;
        else if (part && thinking) hooks.onNotes(part);
        else if (part) {
          text += part;
          hooks.onText(part);
        }
      }
    };

    for await (const chunk of stream) {
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
    emit("", true);
    return text.trim();
  }

  async argue(e: Evidence, side: Side, round: Round, opponent: Argument | null, hooks: StreamHooks): Promise<string> {
    const prompt = round === "opening" || !opponent ? openingPrompt(e, side) : rebuttalPrompt(e, side, opponent);
    // Open models occasionally spend the whole turn inside an unclosed thought; one retry usually lands.
    for (let attempt = 0; attempt < 2; attempt++) {
      const text = await this.chat(counselSystem(side), prompt, hooks, 8000, false);
      if (text) return text;
    }
    throw new Error(`Counsel for the ${side} said nothing (${config.llm.model}).`);
  }

  async judge(e: Evidence, args: Argument[], hooks: StreamHooks): Promise<JudgeRuling> {
    const prompt = `${judgePrompt(e, args)}\n\n${judgeJsonInstruction()}`;
    const quiet: StreamHooks = { onText: () => {}, onNotes: hooks.onNotes };
    const ids = e.exhibits.map((x) => x.id);
    let jsonMode = true;
    for (let attempt = 0; ; attempt++) {
      let text: string;
      try {
        text = await this.chat(JUDGE_SYSTEM, prompt, quiet, 12000, jsonMode);
      } catch (err) {
        // A few providers reject JSON mode; the schema in the prompt is enough for them.
        if (!jsonMode || !(err instanceof CompatError) || err.status !== 400) throw err;
        jsonMode = false;
        text = await this.chat(JUDGE_SYSTEM, prompt, quiet, 12000, false);
      }
      try {
        return normalizeRuling(extractJson(text), ids);
      } catch (err) {
        if (attempt >= 1) throw new Error(`The bench returned no usable ruling (${config.llm.model}): ${(err as Error).message}`);
      }
    }
  }
}
