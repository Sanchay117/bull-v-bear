import { interpolate, useCurrentFrame } from "remotion";
import { sentence, trial } from "../data.ts";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { clamp, easeInOut, money, Paper, ramp, SectionHead, Stamp } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

export function Sentencing({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const tNoAi = cue(shot, "no", 0, 90);
  const tGuidelines = cue(shot, "guidelines", 0, 160);
  const tConviction = cue(shot, "conviction", 0, 200);
  const tVol = cue(shot, "volatility", 0, 250);
  const tStop = cue(shot, "stop", 0, 300);
  const tTarget = cue(shot, "target", 0, 330);
  const tSize = cue(shot, "position", 0, 360);
  const tEvery = cue(shot, "every", 0, 400);

  const steps = sentence.steps;
  // Rows arrive one by one; the ones the narrator names light up as he names them.
  const rowAt = (i: number) => 24 + i * Math.max(6, (tEvery - 24) / steps.length);
  const spotlight: Record<number, number> = { 2: tVol, 3: tConviction, 5: tSize, 6: tStop, 7: tTarget };
  const sheet = ramp(frame, 0, 20);

  // Price ladder
  const { entryPrice: entry, stopPrice: stop, targetPrice: target } = sentence;
  const hi = Math.max(stop, target) * 1.008;
  const lo = Math.min(stop, target) * 0.992;
  const H = 560;
  const y = (p: number) => ((hi - p) / (hi - lo)) * H;
  const eIn = ramp(frame, 20, 18);
  const sIn = ramp(frame, tStop - 4, 18, easeInOut);
  const tIn = ramp(frame, tTarget - 4, 18, easeInOut);
  const size = ramp(frame, tSize - 4, 30, easeInOut);
  const short = sentence.action === "SHORT";

  const line = (p: number, t: number, color: string, label: string, sub: string) => (
    <div style={{ position: "absolute", left: 0, right: 0, top: y(p), opacity: t }}>
      <div style={{ position: "absolute", left: 0, width: `${t * 100}%`, height: 3, background: color }} />
      <div style={{ position: "absolute", right: 0, top: -40, textAlign: "right", fontFamily: fonts.mono, color }}>
        <span style={{ fontWeight: 700, fontSize: 22, letterSpacing: 2 }}>{label}</span>
        <span style={{ fontSize: 30, fontWeight: 700, marginLeft: 14 }}>{money(p)}</span>
      </div>
      <div style={{ position: "absolute", right: 0, top: 10, fontFamily: fonts.body, fontStyle: "italic", fontSize: 19, color: ink.soft }}>{sub}</div>
    </div>
  );

  return (
    <Paper>
      <SectionHead roman="IV." title="Sentencing" at={2} note={sentence.guidelines} />

      {/* Worksheet */}
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 186,
          width: 940,
          height: 716,
          background: ink.paper2,
          boxShadow: "0 18px 40px -22px rgba(70,45,10,0.55), 0 2px 6px -2px rgba(70,45,10,0.18)",
          padding: "30px 40px",
          boxSizing: "border-box",
          opacity: sheet,
          transform: `translateY(${(1 - sheet) * 30}px)`,
        }}
      >
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 17, letterSpacing: 4, color: ink.soft }}>ORDER OF PRACTICE POSITION · WORKSHEET</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 34, marginTop: 4 }}>
          {short ? "Short" : "Long"} ETH · {(sentence.sizeBps / 100).toFixed(2)}% of bankroll
        </div>
        <div style={{ marginTop: 18, borderTop: `2px solid ${ink.ink2}` }}>
          {steps.map((s, i) => {
            const t = ramp(frame, rowAt(i), 12);
            const sp = spotlight[i];
            const glow = sp ? interpolate(frame, [sp - 4, sp + 2, sp + 30, sp + 44], [0, 1, 1, 0], clamp) : 0;
            return (
              <div
                key={s.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "250px 1fr 140px",
                  gap: 16,
                  alignItems: "baseline",
                  padding: "12px 10px",
                  borderBottom: `1px solid ${ink.rule}`,
                  opacity: t,
                  transform: `translateX(${(1 - t) * 24}px)`,
                  background: `rgba(148,114,42,${glow * 0.16})`,
                  boxShadow: glow ? `inset 4px 0 0 ${ink.gold}` : "none",
                }}
              >
                <span style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 22 }}>{s.label}</span>
                <span style={{ fontFamily: fonts.mono, fontSize: 20, color: ink.ink2 }}>{s.formula}</span>
                <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 21, textAlign: "right", color: i === 0 ? ink.bear : ink.ink }}>
                  {s.value
                    .replace(/ \(.*\)$/, "")
                    .replace(" of bankroll", "")
                    .replace(/^(\d{4}\.\d+)$/, (v) => money(Number(v)))}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", right: 40, bottom: 26 }}>
          <Stamp at={tNoAi} size={40} angle={-4} color={ink.bull}>
            No AI past this line
          </Stamp>
        </div>
      </div>

      {/* Price ladder */}
      <div style={{ position: "absolute", left: 1130, top: 214, width: 680, height: H }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: y(stop), height: Math.max(0, y(entry) - y(stop)), background: `rgba(141,32,23,${0.13 * sIn})` }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: y(entry), height: Math.max(0, y(target) - y(entry)), background: `rgba(29,90,58,${0.13 * tIn})` }} />
        <div style={{ position: "absolute", left: 18, top: 0, bottom: 0, width: 2, background: ink.rule2 }} />
        {line(stop, sIn, ink.bear, "STOP", `+${sentence.stopDistancePct}% · 1.25 × daily vol`)}
        {line(entry, eIn, ink.ink, short ? "ENTRY · SHORT" : "ENTRY · LONG", "the mark when the Court rules")}
        {line(target, tIn, ink.bull, "TARGET", `−${(sentence.stopDistancePct * trial.standingOrders.rewardRiskRatio).toFixed(2)}% · 2 : 1 reward to risk`)}
        <svg width={60} height={H} style={{ position: "absolute", left: 60, top: 0, overflow: "visible", opacity: tIn }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={ink.bull} />
            </marker>
          </defs>
          <line x1={20} y1={y(entry) + 10} x2={20} y2={y(entry) + (y(target) - y(entry) - 16) * tIn} stroke={ink.bull} strokeWidth={5} markerEnd="url(#arrow)" />
        </svg>
      </div>

      {/* Position size */}
      <div style={{ position: "absolute", left: 1130, top: 812, width: 680, opacity: ramp(frame, tSize - 8, 12) }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 20, letterSpacing: 4, color: ink.soft }}>POSITION SIZE</span>
          <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 34 }}>{((sentence.sizeBps / 100) * size).toFixed(2)}%</span>
        </div>
        <div style={{ position: "relative", height: 16, marginTop: 8, borderRadius: 8, background: ink.paper3 }}>
          <div style={{ width: `${(sentence.sizeBps / trial.standingOrders.maxPositionBps) * 100 * size}%`, height: "100%", borderRadius: 8, background: ink.ink2 }} />
        </div>
        <div style={{ fontFamily: fonts.body, fontStyle: "italic", fontSize: 18, color: ink.soft, marginTop: 6 }}>of a {trial.standingOrders.maxPositionBps / 100}% cap · risk = 1% × conviction scale</div>
      </div>

      <Sfx name="stamp" at={tNoAi} volume={0.6} />
      {steps.map((s, i) => (
        <Sfx key={s.label} name="tick" at={rowAt(i)} volume={0.3} />
      ))}
    </Paper>
  );
}
