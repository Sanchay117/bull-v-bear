import { interpolate, useCurrentFrame } from "remotion";
import { FPS, type Shot, type Word } from "../plan.ts";
import { fonts } from "../theme.ts";
import { clamp } from "./kit.tsx";

/** Breaks a line into caption cards at sentence and clause ends, about eight words each. */
function cards(words: Word[]): Word[][] {
  const out: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const end = /[.?!]$/.test(w.text);
    const pause = /[,:;]$/.test(w.text) && cur.length >= 4;
    const next = words[i + 1];
    if (end || pause || cur.length >= 9 || (next && next.start - w.end > 0.45)) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
}

/** Estimated timing when there is no recording: an even 2.6 words a second. */
function estimate(text: string): Word[] {
  return text.split(/\s+/).map((t, i) => ({ text: t, start: i / 2.6, end: (i + 0.9) / 2.6 }));
}

/** Burned-in captions: the current card, each word brightening as it is spoken. */
export function Captions({ shot, night = false }: { shot: Shot; night?: boolean }) {
  const frame = useCurrentFrame();
  const t = (frame - shot.voiceAt) / FPS;
  const words = shot.take?.words ?? estimate(shot.text);
  const all = cards(words);
  const i = all.findIndex((c, k) => t >= c[0].start - 0.08 && (k === all.length - 1 ? t <= c.at(-1)!.end + 0.6 : t < all[k + 1][0].start - 0.08));
  if (i < 0) return null;
  const card = all[i];
  const inT = interpolate(t, [card[0].start - 0.08, card[0].start + 0.12], [0, 1], clamp);
  const outT = i === all.length - 1 ? interpolate(t, [card.at(-1)!.end + 0.3, card.at(-1)!.end + 0.6], [1, 0], clamp) : 1;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 46, display: "flex", justifyContent: "center", pointerEvents: "none", opacity: inT * outT }}>
      <div
        style={{
          maxWidth: 1480,
          padding: "12px 28px 14px",
          borderRadius: 10,
          background: night ? "rgba(10,7,4,0.72)" : "rgba(29,25,19,0.78)",
          boxShadow: "0 10px 30px -12px rgba(0,0,0,0.5)",
          fontFamily: fonts.body,
          fontWeight: 500,
          fontSize: 38,
          lineHeight: 1.25,
          color: "#f8f2e4",
          textAlign: "center",
          letterSpacing: 0.2,
        }}
      >
        {card.map((w, k) => (
          <span key={k} style={{ opacity: t >= w.start - 0.05 ? 1 : 0.42 }}>
            {w.text}
            {k < card.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
