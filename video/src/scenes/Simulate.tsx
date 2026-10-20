import { interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { fonts, ink } from "../theme.ts";
import { clamp, Paper, ramp, usePop } from "../ui/kit.tsx";
import { Typing } from "../ui/Sfx.tsx";

const VISIBLE = 17;

function tone(line: string) {
  if (/error|fail(?!\b\s*0)|panic/i.test(line) && !/\b0 fail/.test(line)) return ink.nightBear;
  if (/✓|success|pass\b|written|confirmed|SUCCESS|tx(Hash)?\b|0x[0-9a-f]{10}/i.test(line)) return ink.nightBull;
  if (/verdict|ruling|SHORT|LONG|DISMISSED|conviction/i.test(line)) return ink.brassHi;
  if (/\[USER LOG\]|log/i.test(line)) return "#cfd8ff";
  return "#cbbfa6";
}

export function Simulate({ shot, plan }: SceneProps) {
  const frame = useCurrentFrame();
  const log = plan.simulate;
  const win = usePop(0, 16, 110);
  const typeStart = 14;
  const typeEnd = typeStart + Math.min(45, log.command.length * 0.9);
  const typed = Math.floor(interpolate(frame, [typeStart, typeEnd], [0, log.command.length], clamp));
  const outStart = typeEnd + 10;
  const outEnd = Math.max(outStart + 20, shot.frames - 50);
  const shown = Math.floor(interpolate(frame, [outStart, outEnd], [0, log.lines.length], clamp));
  const first = Math.max(0, shown - VISIBLE);
  const lines = log.lines.slice(first, shown);

  return (
    <Paper night style={{ background: "#0d0c0f" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, rgba(55,91,210,0.16), transparent 65%)" }} />
      <div
        style={{
          position: "absolute",
          left: 190,
          top: 96,
          width: 1540,
          height: 820,
          borderRadius: 16,
          background: "rgba(16,14,18,0.97)",
          border: "1px solid rgba(255,255,255,0.09)",
          boxShadow: "0 50px 100px -40px rgba(0,0,0,0.95), 0 0 0 1px rgba(55,91,210,0.15)",
          overflow: "hidden",
          opacity: win,
          transform: `translateY(${(1 - win) * 40}px) scale(${0.96 + 0.04 * win})`,
        }}
      >
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 20px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
          ))}
          <span style={{ flex: 1, textAlign: "center", fontFamily: fonts.mono, fontSize: 18, color: "#8d8577" }}>{log.title}</span>
          {log.draft && <span style={{ fontFamily: fonts.mono, fontSize: 15, color: ink.nightBear }}>DRAFT · CLI run pending `cre login`</span>}
        </div>
        <div style={{ padding: "26px 34px", fontFamily: fonts.mono, fontSize: 25, lineHeight: "40px" }}>
          <div style={{ color: "#e9e1cf" }}>
            <span style={{ color: ink.linkHi }}>bull-v-bear/cre</span> <span style={{ color: ink.nightBull }}>$</span> {log.command.slice(0, typed)}
            {frame < outStart && <span style={{ display: "inline-block", width: 13, height: 26, marginLeft: 3, verticalAlign: "-4px", background: "#e9e1cf", opacity: Math.floor(frame / 8) % 2 ? 1 : 0.2 }} />}
          </div>
          {lines.map((l, i) => (
            <div key={first + i} style={{ color: tone(l), whiteSpace: "pre", overflow: "hidden", textOverflow: "ellipsis", opacity: i === lines.length - 1 ? ramp(frame, outStart + ((first + i) / log.lines.length) * (outEnd - outStart), 4) : 1 }}>
              {l || " "}
            </div>
          ))}
        </div>
      </div>
      <Typing from={typeStart} frames={typeEnd - typeStart} volume={0.2} />
    </Paper>
  );
}
