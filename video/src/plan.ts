import { staticFile } from "remotion";
import { SCRIPT } from "./script.ts";

export const FPS = 30;
/** Frames by which each scene overlaps the one before it (a crossfade). */
export const OVERLAP = 12;

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
export interface Footage {
  fps: number;
  width: number;
  height: number;
  seconds: number;
  marks: Record<string, number>;
}

export interface Shot {
  id: string;
  /** First frame of the scene in the film. */
  from: number;
  frames: number;
  /** Frame, relative to the scene, where the narrator starts. */
  voiceAt: number;
  take?: Take;
  text: string;
}

export interface TerminalLog {
  title: string;
  command: string;
  lines: string[];
  draft?: boolean;
}

export interface Plan {
  shots: Shot[];
  total: number;
  footage?: Footage;
  simulate: TerminalLog;
  voiced: boolean;
}

/** Shown until scripts/simulate.ts records the real CRE CLI run (it needs `cre login`). */
const TEST_RUN: TerminalLog = {
  title: "CRE SDK test runtime",
  command: "npm run test:cre",
  lines: ["bun test v1.4.3", "", " 3 pass", " 0 fail", " 92 expect() calls", "Ran 3 tests across 1 file."],
  draft: true,
};

async function load<T>(path: string): Promise<T | undefined> {
  try {
    const res = await fetch(staticFile(path));
    return res.ok ? ((await res.json()) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Seconds of footage each filmed scene needs, measured from the capture's marks. */
function footageNeeds(f?: Footage): Record<string, number> {
  if (!f) return {};
  const m = f.marks;
  return {
    live: m.verdict + 3 - (m.desk + 0.6),
    verify: m.tamper + 4.2 - (m.certificate - 0.4),
  };
}

export async function makePlan(): Promise<Plan> {
  const manifest = await load<{ voice: string; lines: Record<string, Take> }>("vo/manifest.json");
  const footage = await load<Footage>("capture/courtroom.json");
  const needs = footageNeeds(footage);
  const shots: Shot[] = [];
  let at = 0;
  for (const line of SCRIPT) {
    const take = manifest?.lines[line.id];
    // Without a recording, assume an unhurried 2.6 words a second.
    const spoken = take?.seconds ?? line.text.split(/\s+/).length / 2.6;
    const lead = line.lead ?? 0.5;
    const tail = line.tail ?? 0.8;
    const seconds = Math.max(lead + spoken + tail, line.minSeconds ?? 0, needs[line.id] ?? 0);
    const frames = Math.round(seconds * FPS);
    shots.push({ id: line.id, from: at, frames, voiceAt: Math.round(lead * FPS), take, text: line.text });
    at += frames - OVERLAP;
  }
  const simulate = (await load<TerminalLog>("capture/simulate.json")) ?? TEST_RUN;
  return { shots, total: at + OVERLAP, footage, simulate, voiced: Boolean(manifest) };
}

/**
 * Frame (relative to the scene) at which the narrator says `word`: the `nth` occurrence of a
 * word starting with it. Scenes use these cues to land each visual on its line.
 */
export function cue(shot: Shot, word: string, nth = 0, fallback = 0): number {
  const words = shot.take?.words;
  const want = word.toLowerCase();
  if (words) {
    const hits = words.filter((w) => w.text.toLowerCase().replace(/[^a-z0-9&-]/g, "").startsWith(want));
    const hit = hits[nth];
    if (hit) return shot.voiceAt + Math.round(hit.start * FPS);
  }
  // No recording: place the cue by its position in the text.
  const tokens = shot.text.split(/\s+/);
  let seen = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].toLowerCase().replace(/[^a-z0-9&-]/g, "").startsWith(want) && seen++ === nth) {
      return shot.voiceAt + Math.round((i / 2.6) * FPS);
    }
  }
  return fallback;
}
