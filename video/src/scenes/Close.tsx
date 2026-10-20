import { AbsoluteFill, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue, FPS } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { CourtSeal, Gavel } from "../ui/emblems.tsx";
import { clamp, easeInOut, Paper, ramp, usePop } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

export function Close({ shot, plan, repo }: SceneProps & { repo: string }) {
  const frame = useCurrentFrame();
  const end = shot.frames;
  const tWork = cue(shot, "agents", 0, 60);
  const tProves = cue(shot, "proves", 0, 110);
  const tAdjourned = cue(shot, "adjourned", 0, 170);
  const f = plan.footage;

  const seal = ramp(frame, 0, 40, easeInOut);
  const mark = usePop(6, 14, 120);
  const line1 = ramp(frame, tWork - 6, 16);
  const line2 = ramp(frame, tProves - 10, 16);
  const tags = ramp(frame, tProves + 16, 16);
  // Three knocks of the gavel, then the lights go down.
  const knocks = [0, 9, 18].map((k) => tAdjourned + 4 + k);
  const swing = knocks.reduce((a, k) => a + interpolate(frame, [k - 5, k, k + 4], [0, 1, 0], clamp), 0);
  const fade = interpolate(frame, [end - 40, end - 4], [0, 1], { ...clamp, easing: easeInOut });

  return (
    <Paper night>
      {f && (
        <AbsoluteFill style={{ opacity: 0.22, filter: "blur(10px) saturate(0.7)", transform: "scale(1.08)" }}>
          <OffthreadVideo src={staticFile("capture/courtroom.mp4")} trimBefore={Math.round(f.marks.chambers * FPS)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(23,17,12,0.35), rgba(12,9,6,0.92) 75%)" }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ marginTop: 92, color: ink.brass }}>
          <CourtSeal size={170} draw={seal} turn={frame * 0.3} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 28, marginTop: 4, fontFamily: fonts.display, fontWeight: 900, fontStyle: "italic", fontSize: 176, lineHeight: 1.05, opacity: mark, transform: `scale(${0.9 + 0.1 * mark})` }}>
          <span style={{ color: ink.nightBull }}>Bull</span>
          <span style={{ color: ink.nightSoft, fontSize: 76 }}>v.</span>
          <span style={{ color: ink.nightBear }}>Bear</span>
        </div>
        <div style={{ fontFamily: fonts.body, fontSize: 44, color: ink.nightInk, marginTop: 10, opacity: line1, transform: `translateY(${(1 - line1) * 12}px)` }}>Agents that show their work.</div>
        <div style={{ fontFamily: fonts.body, fontStyle: "italic", fontSize: 44, color: ink.brassHi, marginTop: 2, opacity: line2, transform: `translateY(${(1 - line2) * 12}px)` }}>And a record that proves it.</div>
        <div style={{ display: "flex", gap: 18, marginTop: 40, opacity: tags }}>
          {["Chainlink CRE workflow", "Autonomous agents · Bull/Bear debate", "Legal Hack 2026"].map((t) => (
            <span key={t} style={{ padding: "10px 20px", borderRadius: 999, border: `2px solid ${ink.brassLo}`, fontFamily: fonts.mono, fontSize: 21, color: ink.brassHi }}>
              {t}
            </span>
          ))}
        </div>
        {repo && <div style={{ marginTop: 26, fontFamily: fonts.mono, fontSize: 28, color: ink.nightInk, opacity: tags }}>{repo}</div>}
        <div style={{ position: "absolute", bottom: 130, fontFamily: fonts.body, fontStyle: "italic", fontSize: 20, color: ink.nightSoft, opacity: tags }}>Practice positions only. Nothing here is investment advice.</div>
      </div>

      <div style={{ position: "absolute", right: 120, bottom: 150, opacity: ramp(frame, tAdjourned - 10, 10), transformOrigin: "88% 88%", transform: `rotate(${-28 * (1 - swing) + 4}deg)` }}>
        <Gavel size={230} />
      </div>
      <AbsoluteFill style={{ background: "#000", opacity: fade }} />
      <Sfx name="gavel3" at={knocks[0] - 1} volume={0.85} />
    </Paper>
  );
}
