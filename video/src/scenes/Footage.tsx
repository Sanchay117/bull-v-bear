import type { ReactNode } from "react";
import { interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { FPS, type Footage, type Shot } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { clamp, easeInOut, Paper, ramp } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

const FRAME = { x: 160, y: 34, w: 1600, bar: 42 };
const VIDEO_H = (FRAME.w * 9) / 16;

/** The courtroom footage in a browser window, starting at `start` seconds into the capture. */
function Browser({ start, zoom = 1, origin = "50% 50%", children }: { start: number; zoom?: number; origin?: string; children?: ReactNode }) {
  const frame = useCurrentFrame();
  const enter = ramp(frame, 0, 18);
  return (
    <div
      style={{
        position: "absolute",
        left: FRAME.x,
        top: FRAME.y,
        width: FRAME.w,
        height: FRAME.bar + VIDEO_H,
        borderRadius: 14,
        overflow: "hidden",
        background: "#1b1712",
        boxShadow: "0 50px 90px -40px rgba(40,25,5,0.85), 0 0 0 1px rgba(60,40,15,0.25)",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 30}px)`,
      }}
    >
      <div style={{ height: FRAME.bar, display: "flex", alignItems: "center", gap: 9, padding: "0 18px", background: "#e9dfc8", borderBottom: "1px solid #cdbf9e" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <div style={{ marginLeft: 18, flex: 1, maxWidth: 560, height: 26, borderRadius: 13, background: "#f8f2e4", display: "flex", alignItems: "center", padding: "0 14px", fontFamily: fonts.mono, fontSize: 15, color: ink.soft }}>
          localhost:5173 · Bull v. Bear — The Court of Market Opinion
        </div>
      </div>
      <div style={{ position: "relative", width: FRAME.w, height: VIDEO_H, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: origin }}>
          <OffthreadVideo src={staticFile("capture/courtroom.mp4")} trimBefore={Math.round(start * FPS)} muted style={{ width: "100%", height: "100%" }} />
        </div>
        {children}
      </div>
    </div>
  );
}

function Missing({ shot }: { shot: Shot }) {
  return (
    <Paper>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: fonts.display, fontSize: 48 }}>Footage for “{shot.id}” not captured yet — run npm run capture</div>
    </Paper>
  );
}

const pill = (bg: string, color: string) =>
  ({
    position: "absolute",
    padding: "10px 18px",
    borderRadius: 999,
    background: bg,
    color,
    fontFamily: fonts.mono,
    fontWeight: 700,
    fontSize: 22,
    boxShadow: "0 12px 30px -12px rgba(0,0,0,0.6)",
  }) as const;

export function liveStart(f: Footage, sceneSeconds: number) {
  return Math.max(0, Math.min(f.marks.desk + 0.6, f.marks.verdict + 3.2 - sceneSeconds));
}

export function Live({ shot, plan }: SceneProps) {
  const frame = useCurrentFrame();
  const f = plan.footage;
  if (!f) return <Missing shot={shot} />;
  const start = liveStart(f, shot.frames / FPS);
  const at = (mark: number) => (mark - start) * FPS; // a capture mark, in scene frames
  // Older captures marked the verdict after gliding to the bench (0.9 s); "judgment" is the
  // moment it appeared.
  const judged = f.marks.judgment ?? f.marks.verdict - 0.95;
  const tCall = at(f.marks.call);
  const tVerdict = at(judged);
  const running = interpolate(frame, [tCall, tVerdict], [0, judged - f.marks.call], clamp);
  const done = frame >= tVerdict;
  const zoom = interpolate(frame, [0, shot.frames], [1, 1.04], clamp);
  const badge = ramp(frame, 10, 14);
  const clock = ramp(frame, tCall - 6, 10);

  return (
    <Paper>
      <Browser start={start} zoom={zoom}>
        <div style={{ ...pill(ink.ink, ink.paper2), right: 24, top: 20, opacity: badge, fontSize: 18 }}>
          <span style={{ color: ink.waxHi }}>●</span> LIVE · REAL TIME · Groq gpt-oss-120b
        </div>
        <div
          style={{
            ...pill(done ? ink.bear : "rgba(29,25,19,0.88)", ink.paper2),
            right: 24,
            top: 78,
            opacity: clock,
            fontSize: 26,
            transform: `scale(${done ? 1 + 0.12 * Math.max(0, 1 - (frame - tVerdict) / 10) : 1})`,
          }}
        >
          {done ? `Judgment in ${running.toFixed(1)} s` : `⏱ ${running.toFixed(1)} s`}
        </div>
      </Browser>
      <Sfx name="gavel3" at={tCall} volume={0.5} />
      <Sfx name="stamp" at={tVerdict} volume={0.6} />
    </Paper>
  );
}

export function Verify({ shot, plan }: SceneProps) {
  const frame = useCurrentFrame();
  const f = plan.footage;
  if (!f) return <Missing shot={shot} />;
  const start = f.marks.certificate - 0.4;
  const at = (mark: number) => (mark - start) * FPS;
  const tVerify = at(f.marks.verify) + 22;
  const tTamper = at(f.marks.tamper) + 22;
  const ok = interpolate(frame, [tVerify, tVerify + 8, tTamper - 14, tTamper - 4], [0, 1, 1, 0], clamp);
  const bad = ramp(frame, tTamper, 8);
  const zoom = interpolate(frame, [0, at(f.marks.verify) - 10, at(f.marks.verify) + 20], [1, 1, 1.12], { ...clamp, easing: easeInOut });

  return (
    <Paper>
      <Browser start={start} zoom={zoom} origin="35% 18%">
        <div style={{ ...pill(ink.bull, ink.paper2), right: 200, top: 530, opacity: ok, transform: `translateY(${(1 - ok) * 12}px)`, fontSize: 24 }}>
          ✓ keccak256 recomputed in your browser = on-chain
        </div>
        <div style={{ ...pill(ink.bear, ink.paper2), right: 200, top: 530, opacity: bad, transform: `translateY(${(1 - bad) * 12}px)`, fontSize: 24 }}>
          ✗ one word altered → the digest no longer matches
        </div>
      </Browser>
      <Sfx name="chime" at={tVerify} volume={0.35} />
      <Sfx name="stamp" at={tTamper} volume={0.7} />
    </Paper>
  );
}
