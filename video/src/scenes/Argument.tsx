import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { args } from "../data.ts";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { BearMark, BullMark } from "../ui/emblems.tsx";
import { Cite, clamp, easeInOut, Paper, ramp, SectionHead, usePop } from "../ui/kit.tsx";
import { Sfx, Typing } from "../ui/Sfx.tsx";

type Seg = { kind: "text"; s: string } | { kind: "cite"; letters: string[] } | { kind: "br" };

/** Splits counsel's text into prose, exhibit citations and paragraph breaks. */
function parse(text: string, paragraphs: number, maxChars = Infinity): Seg[] {
  const paras = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, paragraphs);
  const out: Seg[] = [];
  let used = 0;
  paras.forEach((p, i) => {
    if (i) out.push({ kind: "br" });
    const re = /,?\s*\[Ex\.\s*([A-F](?:\s*,\s*[A-F])*)\]/g;
    let last = 0;
    for (const m of p.matchAll(re)) {
      out.push({ kind: "text", s: p.slice(last, m.index) });
      out.push({ kind: "cite", letters: m[1].split(/\s*,\s*/) });
      last = m.index! + m[0].length;
    }
    out.push({ kind: "text", s: p.slice(last) });
  });
  // Trim to a length that fits the sheet, ending on a word.
  const trimmed: Seg[] = [];
  for (const seg of out) {
    if (seg.kind !== "text") {
      trimmed.push(seg);
      continue;
    }
    if (used + seg.s.length <= maxChars) {
      trimmed.push(seg);
      used += seg.s.length;
    } else {
      const cut = seg.s.slice(0, maxChars - used).replace(/\s+\S*$/, "");
      trimmed.push({ kind: "text", s: `${cut} …` });
      break;
    }
  }
  return trimmed;
}

const charsOf = (segs: Seg[]) => segs.reduce((n, s) => n + (s.kind === "text" ? s.s.length : s.kind === "cite" ? 1 : 0), 0);

/** When (in characters typed) each citation appears. */
function citeTimes(segs: Seg[]) {
  const out: { at: number; letters: string[] }[] = [];
  let n = 0;
  for (const s of segs) {
    if (s.kind === "text") n += s.s.length;
    if (s.kind === "cite") out.push({ at: n++, letters: s.letters });
  }
  return out;
}

function Typed({ segs, shown, color, caret }: { segs: Seg[]; shown: number; color: string; caret: boolean }) {
  const frame = useCurrentFrame();
  const parts: ReactNode[] = [];
  let n = 0;
  segs.forEach((s, i) => {
    if (n > shown) return;
    if (s.kind === "br") parts.push(<div key={i} style={{ height: 14 }} />);
    else if (s.kind === "cite") {
      if (n < shown) parts.push(<Cite key={i} letters={s.letters} color={color} lit={Math.min(1, (shown - n) / 3)} size={24} />);
      n++;
    } else {
      parts.push(<span key={i}>{s.s.slice(0, Math.max(0, shown - n))}</span>);
      n += s.s.length;
    }
  });
  return (
    <div style={{ fontFamily: fonts.mono, fontSize: 25, lineHeight: "40px", color, whiteSpace: "pre-wrap" }}>
      {parts}
      {caret && <span style={{ display: "inline-block", width: 13, height: 26, marginLeft: 2, verticalAlign: "-4px", background: color, opacity: Math.floor(frame / 8) % 2 ? 1 : 0.15 }} />}
    </div>
  );
}

function Sheet({
  side,
  x,
  label,
  children,
  enter,
  dim,
}: {
  side: "BULL" | "BEAR";
  x: number;
  label: string;
  children: ReactNode;
  enter: number;
  dim: number;
}) {
  const bull = side === "BULL";
  const color = bull ? ink.bull : ink.bear;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 176,
        width: 790,
        height: 730,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 60}px) rotate(${(bull ? -0.4 : 0.4) * enter}deg)`,
        filter: `brightness(${1 - dim * 0.28}) saturate(${1 - dim * 0.4})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, height: 96 }}>
        <div style={{ width: 84, height: 84, borderRadius: 42, border: `3px solid ${color}`, display: "grid", placeItems: "center", color, background: ink.paper2 }}>
          {bull ? <BullMark size={58} /> : <BearMark size={58} />}
        </div>
        <div>
          <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 18, letterSpacing: 4, textTransform: "uppercase", color: ink.soft }}>{bull ? "Movant" : "Respondent"}</div>
          <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 42, color, lineHeight: 1.05 }}>Counsel for the {bull ? "Bull" : "Bear"}</div>
          <div style={{ fontFamily: fonts.body, fontStyle: "italic", fontSize: 22, color: ink.soft }}>{bull ? "moves for a LONG practice position" : "moves for a SHORT, or denial"}</div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 112,
          left: 0,
          right: 0,
          bottom: 0,
          background: ink.paper2,
          boxShadow: "0 18px 40px -22px rgba(70,45,10,0.55), 0 2px 6px -2px rgba(70,45,10,0.18)",
          backgroundImage: `repeating-linear-gradient(180deg, transparent 0 39px, ${ink.rule}88 39px 40px)`,
          backgroundPosition: "0 22px",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 22, width: 58, fontFamily: fonts.mono, fontSize: 15, color: ink.rule2, textAlign: "right" }}>
          {Array.from({ length: 15 }, (_, i) => (
            <div key={i} style={{ height: 40, lineHeight: "40px", paddingRight: 12 }}>
              {i + 1}
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: 66, top: 0, bottom: 0, width: 2, background: ink.marginRed, opacity: 0.7 }} />
        <div style={{ position: "absolute", left: 71, top: 0, bottom: 0, width: 1, background: ink.marginRed, opacity: 0.5 }} />
        <div style={{ position: "absolute", left: 96, right: 34, top: 22 }}>
          <div style={{ height: 40, lineHeight: "40px", fontFamily: fonts.mono, fontWeight: 700, fontSize: 18, letterSpacing: 3, color: ink.ink2, textDecoration: "underline", textUnderlineOffset: 6 }}>
            {label}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Argument({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const end = shot.frames;
  const tStart = cue(shot, "two", 0, 60);
  const tCite = cue(shot, "cite", 0, 330);
  const tCause = cue(shot, "cause", 0, 400);
  const tEvidence = cue(shot, "evidence", 1, 460);
  const tMechanism = cue(shot, "mechanism", 0, 500);
  const tMove = cue(shot, "expected", 0, 540);
  const tRebut = cue(shot, "then", 1, 590);

  const open = {
    BULL: parse(args.find((a) => a.side === "BULL" && a.round === "opening")!.text, 3, 400),
    BEAR: parse(args.find((a) => a.side === "BEAR" && a.round === "opening")!.text, 3, 400),
  };
  const rebut = {
    BULL: parse(args.find((a) => a.side === "BULL" && a.round === "rebuttal")!.text, 1, 250),
    BEAR: parse(args.find((a) => a.side === "BEAR" && a.round === "rebuttal")!.text, 1, 250),
  };

  const sheets = usePop(0, 16, 90);
  const openWindow = tCause - 12 - tStart;
  /** What each counsel has typed by now: the round, its first frame and its pace (chars/frame). */
  const typed = (side: "BULL" | "BEAR") => {
    const delay = side === "BULL" ? 0 : 14;
    if (frame >= tRebut) {
      const segs = rebut[side];
      const start = tRebut + delay / 2;
      const pace = charsOf(segs) / Math.max(1, end - 10 - start);
      return { segs, start, pace, shown: Math.max(0, (frame - start) * pace), label: "REBUTTAL" };
    }
    const segs = open[side];
    const start = tStart + delay;
    const pace = charsOf(segs) / Math.max(1, openWindow - delay);
    return { segs, start, pace, shown: Math.max(0, (frame - start) * pace), label: "OPENING ARGUMENT" };
  };
  const bull = typed("BULL");
  const bear = typed("BEAR");

  // Light each exhibit on the rail as it is cited, and all of them on "cite".
  const rail = "ABCDEF".split("").map((l) => {
    let lit = 0;
    let color: string = ink.ink2;
    for (const [t, c] of [
      [bull, ink.bull],
      [bear, ink.bear],
    ] as const) {
      for (const ct of citeTimes(t.segs)) {
        if (!ct.letters.includes(l) || ct.at > t.shown) continue;
        const at = t.start + ct.at / t.pace;
        const k = interpolate(frame - at, [0, 4, 20], [0, 1, 0.35], clamp);
        if (k > lit) {
          lit = k;
          color = c;
        }
      }
    }
    const roll = interpolate(frame, [tCite + "ABCDEF".indexOf(l) * 3, tCite + "ABCDEF".indexOf(l) * 3 + 6, tCite + 30], [0, 1, 0.35], clamp);
    return { l, lit: Math.max(lit, roll * 0.999), color: roll > lit ? ink.bear : color };
  });

  const card = interpolate(frame, [tCause - 6, tCause + 10, tRebut - 10, tRebut + 4], [0, 1, 1, 0], { ...clamp, easing: easeInOut });
  const steps = [
    { at: tEvidence, k: "Evidence", v: <>spot sits 9% above the 24-hour low <Cite letters={["A", "B"]} color={ink.bull} size={22} /></> },
    { at: tMechanism, k: "Mechanism", v: <>a technical floor, where buyers step in</> },
    { at: tMove, k: "Expected move", v: <>a rally back toward the range high</> },
  ];

  return (
    <Paper>
      <SectionHead roman="II." title="Argument" at={2} note="Transcript of argument" />
      <Sheet side="BULL" x={110} label={bull.label} enter={sheets} dim={card}>
        <Typed segs={bull.segs} shown={bull.shown} color={ink.bull} caret={bull.shown > 0 && bull.shown < charsOf(bull.segs)} />
      </Sheet>
      <Sheet side="BEAR" x={1020} label={bear.label} enter={sheets} dim={card}>
        <Typed segs={bear.segs} shown={bear.shown} color={ink.bear} caret={bear.shown > 0 && bear.shown < charsOf(bear.segs)} />
      </Sheet>

      {/* The exhibit rail between the two sheets */}
      <div style={{ position: "absolute", left: 924, top: 300, display: "flex", flexDirection: "column", gap: 18, opacity: sheets }}>
        {rail.map(({ l, lit, color }) => (
          <div
            key={l}
            style={{
              width: 72,
              height: 72,
              display: "grid",
              placeItems: "center",
              borderRadius: 8,
              fontFamily: fonts.stamp,
              fontWeight: 900,
              fontSize: 44,
              color: lit > 0.5 ? ink.paper2 : ink.manilaInk,
              background: lit > 0.02 ? color : ink.manila,
              opacity: 0.55 + 0.45 * Math.min(1, lit * 2),
              transform: `scale(${1 + 0.18 * Math.sin(Math.min(1, lit) * Math.PI)})`,
              boxShadow: "0 8px 18px -10px rgba(70,45,10,0.6)",
            }}
          >
            {l}
          </div>
        ))}
      </div>

      {/* Cause and effect */}
      <div
        style={{
          position: "absolute",
          left: 190,
          right: 190,
          top: 440,
          padding: "30px 40px 34px",
          borderRadius: 14,
          background: ink.ink,
          color: ink.paper2,
          opacity: card,
          transform: `translateY(${(1 - card) * 30}px) scale(${0.96 + 0.04 * card})`,
          boxShadow: "0 40px 80px -30px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 20, letterSpacing: 5, textTransform: "uppercase", color: ink.brassHi }}>Rule of court: every claim shows cause and effect</div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 18, marginTop: 22 }}>
          {steps.map((s, i) => {
            const t = ramp(frame, s.at - 4, 14);
            return (
              <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 18, flex: 1 }}>
                <div style={{ flex: 1, padding: "16px 20px", borderRadius: 10, border: `2px solid ${t > 0.5 ? ink.brassHi : "#5a5144"}`, opacity: 0.35 + 0.65 * t, transform: `translateY(${(1 - t) * 10}px)` }}>
                  <div style={{ fontFamily: fonts.stamp, fontWeight: 800, fontSize: 24, letterSpacing: 3, color: ink.brassHi }}>{s.k.toUpperCase()}</div>
                  <div style={{ fontFamily: fonts.body, fontSize: 28, lineHeight: 1.25, marginTop: 6 }}>{s.v}</div>
                </div>
                {i < steps.length - 1 && <div style={{ fontSize: 40, color: ink.brassHi, opacity: ramp(frame, steps[i + 1].at - 8, 10) }}>→</div>}
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: fonts.body, fontStyle: "italic", fontSize: 22, color: "#bcae93", marginTop: 18 }}>From the Bull's opening, Case No. 0004</div>
      </div>

      <Typing from={tStart} frames={openWindow} />
      <Typing from={tRebut} frames={end - 10 - tRebut} />
      <Sfx name="whoosh" at={tCause - 6} volume={0.25} />
      <Sfx name="paper" at={tRebut} volume={0.4} />
    </Paper>
  );
}
