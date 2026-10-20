import { useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { BearMark, BullMark, CourtSeal } from "../ui/emblems.tsx";
import { easeInOut, Paper, ramp, Stamp, usePop } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

export function Title({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const tBull = Math.max(14, cue(shot, "bull", 0, 30) - 6);
  const tTrial = cue(shot, "trial", 0, 90);
  const tTrail = cue(shot, "reasoning", 0, 140);

  const seal = ramp(frame, 0, 46, easeInOut);
  const bull = usePop(tBull, 14, 120);
  const v = usePop(tBull + 8, 10, 180);
  const bear = usePop(tBull + 12, 14, 120);
  const marks = usePop(tBull + 20, 12, 120);
  const tag = ramp(frame, tTrail, 20);
  const underline = ramp(frame, tTrail + 10, 30, easeInOut);
  const drift = frame * 0.06;

  return (
    <Paper>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${-drift}px)` }}>
        <div style={{ marginTop: 86, color: ink.ink, opacity: 0.9 }}>
          <CourtSeal size={190} draw={seal} turn={frame * 0.35} />
        </div>
        <div style={{ marginTop: 18, fontFamily: fonts.body, fontWeight: 500, fontSize: 24, letterSpacing: 7, textTransform: "uppercase", color: ink.soft, opacity: seal }}>
          In the Court of Market Opinion · Practice Division
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 36, marginTop: 6, fontFamily: fonts.display, fontWeight: 900, fontStyle: "italic", fontSize: 230, lineHeight: 1.05 }}>
          <span style={{ color: ink.bull, opacity: bull, transform: `translateX(${(1 - bull) * -260}px)`, display: "inline-block" }}>Bull</span>
          <span style={{ color: ink.ink2, fontSize: 96, opacity: v, transform: `scale(${v})`, display: "inline-block" }}>v.</span>
          <span style={{ color: ink.bear, opacity: bear, transform: `translateX(${(1 - bear) * 260}px)`, display: "inline-block" }}>Bear</span>
        </div>
        <div style={{ height: 120, marginTop: 4, display: "flex", alignItems: "center" }}>
          <Stamp at={tTrial} size={62} angle={-3} color={ink.bear}>
            Every trade on trial
          </Stamp>
        </div>
        <div style={{ marginTop: 26, position: "relative", fontFamily: fonts.body, fontStyle: "italic", fontSize: 44, color: ink.ink2, opacity: tag, transform: `translateY(${(1 - tag) * 14}px)` }}>
          The reasoning trail is the product.
          <span style={{ position: "absolute", left: 0, right: 0, bottom: -8, height: 3, background: ink.bear, transformOrigin: "left", transform: `scaleX(${underline})` }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 150, top: 430, opacity: marks, transform: `rotate(${(1 - marks) * -20}deg) scale(${0.6 + 0.4 * marks})`, color: ink.bull }}>
        <BullMark size={170} />
      </div>
      <div style={{ position: "absolute", right: 150, top: 430, opacity: marks, transform: `rotate(${(1 - marks) * 20}deg) scale(${0.6 + 0.4 * marks})`, color: ink.bear }}>
        <BearMark size={170} />
      </div>
      <Sfx name="whoosh" at={tBull - 2} volume={0.3} />
      <Sfx name="stamp" at={tTrial} volume={0.7} />
    </Paper>
  );
}
