// Voices the narration with Deepgram Aura-2, then transcribes each take with Deepgram Nova-3 to
// time every caption word. Writes public/vo/<id>.wav and public/vo/manifest.json.
//
//   node scripts/voice.ts                      all lines, default voice
//   node scripts/voice.ts --voice aura-2-zeus-en
//   node scripts/voice.ts --only cre,simulate  re-voice some lines, keep the rest
//   node scripts/voice.ts --audition           one line in several voices, to public/vo/audition/
//
// The key is DEEPGRAM_KEY, from the environment, video/.env or server/.env.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCRIPT, type Line } from "../src/script.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "vo");
const manifestPath = join(out, "manifest.json");

for (const f of [join(root, ".env"), join(root, "..", "server", ".env")]) {
  if (!process.env.DEEPGRAM_KEY && existsSync(f)) process.loadEnvFile(f);
}
const key = process.env.DEEPGRAM_KEY;
if (!key) {
  console.error("Set DEEPGRAM_KEY (environment, video/.env or server/.env).");
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const voice = flag("--voice") ?? "aura-2-draco-en";
const only = flag("--only")?.split(",");

export interface Word {
  text: string;
  start: number;
  end: number;
}
export interface Take {
  file: string;
  seconds: number;
  words: Word[];
}
export interface Manifest {
  voice: string;
  lines: Record<string, Take>;
}

async function speak(text: string, model: string): Promise<Buffer> {
  const url = `https://api.deepgram.com/v1/speak?model=${model}&encoding=linear16&container=wav&sample_rate=48000`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    throw new Error(`speak ${model}: ${res.status} ${await res.text()}`);
  }
}

interface SttWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
}

async function listen(wav: Buffer): Promise<SttWord[]> {
  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "audio/wav" },
    body: new Uint8Array(wav),
  });
  if (!res.ok) throw new Error(`listen: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { results: { channels: { alternatives: { words: SttWord[] }[] }[] } };
  return json.results.channels[0]?.alternatives[0]?.words ?? [];
}

/** Length of a PCM WAV in seconds, from its fmt and data chunks. */
function wavSeconds(wav: Buffer): number {
  let byteRate = 0;
  for (let p = 12; p + 8 <= wav.length; ) {
    const id = wav.toString("ascii", p, p + 4);
    const size = wav.readUInt32LE(p + 4);
    if (id === "fmt ") byteRate = wav.readUInt32LE(p + 16);
    if (id === "data") {
      // Streamed WAVs may leave the data size unset; fall back to the bytes present.
      const bytes = size === 0 || size === 0xffffffff ? wav.length - p - 8 : Math.min(size, wav.length - p - 8);
      return bytes / byteRate;
    }
    p += 8 + size + (size % 2);
  }
  throw new Error("not a PCM WAV");
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Times each caption word. The caption and the spoken text can differ ("keccak256" is read as
 * "ketch-ack two fifty-six"), so words are matched to the transcription where they agree and
 * interpolated between matches where they do not.
 */
function align(caption: string, heard: SttWord[], seconds: number): Word[] {
  const tokens = caption.split(/\s+/).filter(Boolean);
  const times: ({ start: number; end: number } | null)[] = tokens.map(() => null);
  let j = 0;
  tokens.forEach((t, i) => {
    const n = norm(t);
    if (!n) return;
    for (let k = j; k < Math.min(heard.length, j + 5); k++) {
      if (norm(heard[k].word) === n || norm(heard[k].punctuated_word ?? "") === n) {
        times[i] = { start: heard[k].start, end: heard[k].end };
        j = k + 1;
        return;
      }
    }
  });
  const first = heard[0]?.start ?? 0;
  const last = heard.at(-1)?.end ?? seconds;
  // Fill gaps: spread unmatched words across the time between their matched neighbours,
  // in proportion to their length.
  let i = 0;
  while (i < tokens.length) {
    if (times[i]) {
      i++;
      continue;
    }
    let k = i;
    while (k < tokens.length && !times[k]) k++;
    const from = i > 0 ? times[i - 1]!.end : first;
    const to = k < tokens.length ? times[k]!.start : last;
    const span = tokens.slice(i, k);
    const total = span.reduce((a, t) => a + t.length + 1, 0);
    let at = from;
    span.forEach((t, m) => {
      const d = ((to - from) * (t.length + 1)) / total;
      times[i + m] = { start: at, end: at + d };
      at += d;
    });
    i = k;
  }
  return tokens.map((text, m) => ({ text, start: round(times[m]!.start), end: round(times[m]!.end) }));
}

const round = (n: number) => Math.round(n * 1000) / 1000;

async function voiceLine(line: Line): Promise<Take> {
  const wav = await speak(line.say ?? line.text, voice);
  const file = `vo/${line.id}.wav`;
  writeFileSync(join(root, "public", file), wav);
  const seconds = round(wavSeconds(wav));
  const words = align(line.text, await listen(wav), seconds);
  return { file, seconds, words };
}

async function audition() {
  const dir = join(out, "audition");
  mkdirSync(dir, { recursive: true });
  const line = SCRIPT.find((l) => l.id === "title")!;
  const voices = ["aura-2-draco-en", "aura-2-zeus-en", "aura-2-orpheus-en", "aura-2-pluto-en", "aura-2-saturn-en", "aura-2-athena-en"];
  for (const v of voices) {
    const wav = await speak(line.say ?? line.text, v);
    writeFileSync(join(dir, `${v}.wav`), wav);
    console.log(`${v}  ${wavSeconds(wav).toFixed(2)}s`);
  }
}

async function main() {
  mkdirSync(out, { recursive: true });
  if (args.includes("--audition")) return audition();

  const prior: Manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { voice, lines: {} };
  if (only && prior.voice !== voice) {
    console.error(`The manifest was voiced by ${prior.voice}. Re-voice everything to switch to ${voice}.`);
    process.exit(1);
  }
  const manifest: Manifest = { voice, lines: only ? prior.lines : {} };
  for (const line of SCRIPT) {
    if (only && !only.includes(line.id)) continue;
    const take = await voiceLine(line);
    manifest.lines[line.id] = take;
    console.log(`${line.id.padEnd(11)} ${take.seconds.toFixed(2)}s  ${take.words.length} words`);
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  const total = Object.values(manifest.lines).reduce((a, t) => a + t.seconds, 0);
  console.log(`\n${voice}: ${total.toFixed(1)}s of narration → public/vo/manifest.json`);
}

await main();
