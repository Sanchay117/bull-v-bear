import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { Gavel } from "../ui/emblems.tsx";
import { clamp, Paper, ramp, Stamp, usePop } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

const FEED = [
  ["ETH", "2,380.18", "▼ 2.58%", "RSI 38.1", "VOL 9.33B", "F&G 55", "σ 2.46%"],
  ["BTC", "SMA24 > SMA72", "▲ 0.41%", "OI +3.2%", "FUNDING 0.01%", "Δ7D −5.89%"],
  ["SOL", "171.25", "BID 171.21", "ASK 171.29", "▲ 1.12%", "VOL 3.1B"],
  ["LINK", "RANGE 9%", "HIGH 2,436.65", "LOW 2,374.52", "TURNOVER 3.21%"],
  ["ETH", "MCAP 290.7B", "▼ 0.33% 1H", "GREED", "CLOSE 2,388.08", "Δ24H −2.58%"],
  ["BTC", "RSI 61.4", "VOL 31.0B", "▲ 0.88%", "σ 1.71%", "F&G 55"],
  ["SOL", "▼ 0.19%", "RANGE 44%", "SMA24 171.0", "MCAP 82.1B"],
];

const BOX = { x: 790, y: 290, s: 340 };

export function Open({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const end = shot.frames;
  const tBox = cue(shot, "black", 0, 20);
  const tFeed = cue(shot, "market", 0, 60) - 14;
  const tBuy = cue(shot, "buy", 0, 120);
  const tNobody = cue(shot, "nobody", 0, 180);
  const tWhy = cue(shot, "why", 0, 230);
  const hit = end - 14;

  const box = usePop(tBox - 12, 16, 90);
  const buy = usePop(tBuy - 2, 11, 160);
  const shake = frame > tWhy && frame < tWhy + 10 ? Math.sin(frame * 3.1) * 6 : 0;

  // The gavel swings down onto the black box.
  const swing = interpolate(frame, [hit - 16, hit], [-70, 0], { ...clamp, easing: (t) => t * t * t });
  const gavelIn = ramp(frame, hit - 22, 8);
  const flash = interpolate(frame, [hit, hit + 2, end], [0, 1, 0.9], clamp);

  return (
    <Paper night style={{ background: "#0b0907" }}>
      {/* Market data streaming into the box */}
      <AbsoluteFill style={{ opacity: ramp(frame, tFeed, 20), maskImage: `linear-gradient(90deg, transparent 0, #000 12%, #000 ${BOX.x - 60}px, transparent ${BOX.x + 30}px)` }}>
        {FEED.map((row, r) => {
          const speed = 5.2 + (r % 3) * 1.3;
          const unit = row.join("    ") + "    ";
          const L = unit.length * 26 * 0.6; // Courier Prime advances 0.6 em per character
          const x = (((frame - tFeed) * speed + r * 170) % L) - L;
          return (
            <div
              key={r}
              style={{
                position: "absolute",
                top: BOX.y + 14 + r * 46,
                left: x,
                whiteSpace: "pre",
                fontFamily: fonts.mono,
                fontSize: 26,
                color: r % 2 ? "#8f826a" : "#c8b48a",
              }}
            >
              {unit.repeat(3)}
            </div>
          );
        })}
      </AbsoluteFill>

      {/* The black box */}
      <div
        style={{
          position: "absolute",
          left: BOX.x + shake,
          top: BOX.y,
          width: BOX.s,
          height: BOX.s,
          transform: `scale(${0.6 + 0.4 * box})`,
          opacity: box,
          borderRadius: 18,
          background: "linear-gradient(160deg, #26211b 0%, #0d0b09 45%, #030202 100%)",
          boxShadow: "0 0 0 1px rgba(255,235,200,0.10), inset 0 1px 0 rgba(255,235,200,0.18), 0 40px 90px -20px rgba(0,0,0,0.9), 0 0 120px rgba(200,150,80,0.08)",
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 150, color: "rgba(255,235,200,0.06)" }}>?</div>
        <div style={{ position: "absolute", bottom: -58, fontFamily: fonts.mono, fontSize: 22, letterSpacing: 8, color: "#8f826a" }}>TRADING AGENT</div>
      </div>

      {/* BUY pops out the other side */}
      <div
        style={{
          position: "absolute",
          left: BOX.x + BOX.s / 2 + buy * 430 - 110,
          top: BOX.y + BOX.s / 2 - 52,
          width: 220,
          height: 104,
          borderRadius: 52,
          background: "linear-gradient(180deg, #3fae6d, #1d5a3a)",
          color: "#f8f2e4",
          display: "grid",
          placeItems: "center",
          fontFamily: fonts.stamp,
          fontWeight: 900,
          fontSize: 58,
          letterSpacing: 6,
          opacity: Math.min(1, buy * 2),
          transform: `scale(${0.4 + 0.6 * buy})`,
          boxShadow: `0 0 ${40 + 20 * Math.sin(frame / 5)}px rgba(63,174,109,0.55)`,
          zIndex: -0,
        }}
      >
        BUY
      </div>

      {/* Question marks gathering around it */}
      {[...Array(7)].map((_, i) => {
        const at = tNobody + i * 4;
        const t = ramp(frame, at, 16);
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const r = 270 + (i % 3) * 30;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: BOX.x + BOX.s / 2 + Math.cos(a) * r - 20,
              top: BOX.y + BOX.s / 2 + Math.sin(a) * r * 0.62 - 40,
              fontFamily: fonts.display,
              fontWeight: 900,
              fontSize: 56 + (i % 3) * 14,
              color: "#c8b48a",
              opacity: t * 0.55,
              transform: `translateY(${(1 - t) * 20 + Math.sin((frame + i * 9) / 11) * 5}px)`,
            }}
          >
            ?
          </div>
        );
      })}

      <div style={{ position: "absolute", left: 0, right: 0, top: 128, display: "flex", justifyContent: "center" }}>
        <Stamp at={tWhy} color={ink.waxHi} size={120} angle={-6} style={{ mixBlendMode: "normal", opacity: 0.95 }}>
          Why?
        </Stamp>
      </div>

      {/* Gavel */}
      <div
        style={{
          position: "absolute",
          left: BOX.x + BOX.s / 2 - 40,
          top: BOX.y - 330,
          opacity: gavelIn,
          transformOrigin: "88% 88%",
          transform: `rotate(${swing}deg)`,
        }}
      >
        <Gavel size={420} />
      </div>
      <AbsoluteFill style={{ background: "#fff8ea", opacity: flash, pointerEvents: "none" }} />

      <Sfx name="whoosh" at={tFeed} volume={0.25} />
      <Sfx name="chime" at={tBuy - 2} volume={0.35} />
      <Sfx name="stamp" at={tWhy} volume={0.6} />
      <Sfx name="gavel" at={hit - 1} volume={0.9} />
    </Paper>
  );
}
