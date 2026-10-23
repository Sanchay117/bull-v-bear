import { interpolate, useCurrentFrame } from "remotion";
import { caseNo, ruling, trial } from "../data.ts";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { type Load, Scales } from "../ui/emblems.tsx";
import { clamp, easeInOut, Paper, ramp, SectionHead, Stamp } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

const favorColor = (f: string) => (f === "BULL" ? ink.bull : f === "BEAR" ? ink.bear : ink.soft);
const findings = [...ruling.findings].sort((a, b) => a.exhibit.localeCompare(b.exhibit));

/**
 * The beam's angle at `frame`: a damped spring toward the weight on each pan, trembling while
 * the Court deliberates. Integrated from the first frame so it is the same on every render.
 */
function beamAngle(frame: number, goal: (f: number) => number, tremble: (f: number) => number) {
  let a = 0;
  let v = 0;
  const dt = 1 / 30;
  for (let f = 0; f <= frame; f++) {
    const g = goal(f) + tremble(f);
    v += ((g - a) * 38 - v * 5.5) * dt;
    a += v * dt;
  }
  return a;
}

export function Ruling({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const tExhibits = cue(shot, "exhibits", 0, 60);
  const tRhetoric = cue(shot, "rhetoric", 0, 100);
  const tFindings = cue(shot, "findings", 0, 150);
  const tVerdict = cue(shot, "verdict", 0, 240);
  const tConviction = cue(shot, "conviction", 0, 270);
  const tOpinion = cue(shot, "opinion", 0, 320);
  const tDissent = cue(shot, "dissent", 0, 350);

  // Each finding drops its exhibit onto the side it favours.
  const drops = findings.map((f, i) => ({ ...f, at: tExhibits + 4 + i * 9 }));
  const dropT = (at: number, f = frame) => interpolate(f, [at, at + 12], [0, 1], { ...clamp, easing: (t) => t * t });
  const weightOn = (side: string, f: number) => drops.filter((d) => d.favors === side && dropT(d.at, f) >= 1).reduce((s, d) => s + d.weight, 0);
  const goal = (f: number) => {
    const bull = weightOn("BULL", f);
    const bear = weightOn("BEAR", f);
    return bull + bear ? ((bear - bull) / (bull + bear)) * 14 : 0;
  };
  const tremble = (f: number) => (f < tVerdict ? Math.sin(f / 7.8) * 2.2 + Math.sin(f / 2.9) * 0.6 : 0);
  const angle = beamAngle(frame, goal, tremble);
  const loads = { BULL: [] as Load[], BEAR: [] as Load[] };
  for (const d of drops) {
    if (d.favors === "NEUTRAL") continue;
    loads[d.favors as "BULL" | "BEAR"].push({ label: d.exhibit, weight: d.weight, drop: dropT(d.at), color: favorColor(d.favors) });
  }

  const bench = ramp(frame, 0, 20);
  const conv = ramp(frame, tConviction - 4, 30, easeInOut);
  const opinion = ramp(frame, tOpinion - 6, 18);
  const dissent = ramp(frame, tDissent - 4, 18);
  const rhetoric = interpolate(frame, [tRhetoric - 10, tRhetoric, tRhetoric + 30, tRhetoric + 42], [0, 1, 1, 0], clamp);
  const strike = ramp(frame, tRhetoric + 4, 12);
  const verdictSide = ruling.verdict === "LONG" ? "Bull" : ruling.verdict === "SHORT" ? "Bear" : null;

  return (
    <Paper>
      <SectionHead roman="III." title="Ruling" at={2} note="Opinion & Order" />

      {/* Findings of fact */}
      <div style={{ position: "absolute", left: 110, top: 190, width: 600 }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 34, opacity: ramp(frame, tFindings - 8, 14) }}>Findings of Fact</div>
        {findings.map((f, i) => {
          const t = ramp(frame, tFindings + i * 7, 16);
          const c = favorColor(f.favors);
          return (
            <div
              key={f.exhibit}
              style={{
                display: "grid",
                gridTemplateColumns: "52px 1fr 92px",
                gap: 14,
                alignItems: "center",
                marginTop: 16,
                padding: "10px 12px",
                background: ink.paper2,
                borderLeft: `6px solid ${c}`,
                boxShadow: "0 10px 24px -16px rgba(70,45,10,0.6)",
                opacity: t,
                transform: `translateX(${(1 - t) * -40}px)`,
              }}
            >
              <div style={{ fontFamily: fonts.stamp, fontWeight: 900, fontSize: 40, color: ink.bear, textAlign: "center" }}>{f.exhibit}</div>
              <div style={{ fontFamily: fonts.body, fontSize: 20, lineHeight: 1.25, color: ink.ink2 }}>{f.finding}</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: fonts.stamp, fontWeight: 800, fontSize: 20, letterSpacing: 2, color: ink.paper2, background: c, borderRadius: 4, padding: "2px 0" }}>{f.favors}</div>
                <div style={{ color: c, fontSize: 18, letterSpacing: 3, marginTop: 4 }}>
                  {"●".repeat(f.weight)}
                  {"○".repeat(3 - f.weight)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* The bench */}
      <div
        style={{
          position: "absolute",
          left: 742,
          top: 176,
          width: 436,
          height: 730,
          borderRadius: 10,
          background: `linear-gradient(180deg, ${ink.wood3}, ${ink.wood2} 60%, #1c1009)`,
          boxShadow: "0 30px 60px -30px rgba(0,0,0,0.8), inset 0 0 0 2px rgba(233,207,131,0.18)",
          opacity: bench,
          transform: `translateY(${(1 - bench) * 30}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ marginTop: 26, padding: "10px 26px", borderRadius: 6, background: `linear-gradient(180deg, ${ink.brassHi}, ${ink.brass})`, boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.25)", textAlign: "center" }}>
          <div style={{ fontFamily: fonts.display, fontStyle: "italic", fontWeight: 900, fontSize: 28, color: ink.wood2 }}>The Hon. GPT OSS 120B</div>
          <div style={{ fontFamily: fonts.body, fontSize: 15, letterSpacing: 5, color: ink.wood3 }}>PRESIDING</div>
        </div>
        <div style={{ marginTop: 34 }}>
          <Scales angle={angle} width={380} loads={loads} />
        </div>
        <div style={{ height: 70, display: "grid", placeItems: "center", marginTop: 6 }}>
          {frame < tVerdict ? (
            <div style={{ fontFamily: fonts.body, fontStyle: "italic", fontSize: 26, color: "#e9dcc0", opacity: 0.6 + 0.4 * Math.sin(frame / 8) ** 2 }}>The Court is in chambers…</div>
          ) : (
            <div style={{ fontFamily: fonts.stamp, fontWeight: 900, fontSize: 34, letterSpacing: 2, whiteSpace: "nowrap", color: ink.nightBear, opacity: ramp(frame, tVerdict, 8) }}>
              {verdictSide ? `JUDGMENT FOR THE ${verdictSide.toUpperCase()}` : "CASE DISMISSED"}
            </div>
          )}
        </div>
        <div style={{ width: 360, marginTop: 8, opacity: conv }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: fonts.body, fontSize: 20, letterSpacing: 4, color: "#e9dcc0" }}>
            <span>CONVICTION</span>
            <b style={{ fontFamily: fonts.mono, fontSize: 26 }}>{Math.round(ruling.conviction * conv)}</b>
          </div>
          <div style={{ position: "relative", height: 14, marginTop: 10, borderRadius: 7, background: "rgba(255,255,255,0.12)" }}>
            <div style={{ width: `${ruling.conviction * conv}%`, height: "100%", borderRadius: 7, background: ink.nightBear }} />
            <div style={{ position: "absolute", left: `${trial.standingOrders.minConviction}%`, top: -6, width: 3, height: 26, background: ink.brassHi }} />
          </div>
          <div style={{ fontFamily: fonts.body, fontStyle: "italic", fontSize: 17, color: "#bcae93", marginTop: 8 }}>tick: your standing minimum ({trial.standingOrders.minConviction})</div>
        </div>
      </div>

      {/* Rhetoric is struck */}
      <div style={{ position: "absolute", left: 150, top: 400, width: 520, opacity: rhetoric, transform: `rotate(-3deg)` }}>
        <div style={{ position: "relative", padding: "18px 24px", background: ink.paper2, fontFamily: fonts.body, fontStyle: "italic", fontSize: 34, lineHeight: 1.25, color: ink.ink2, boxShadow: "0 12px 24px -12px rgba(0,0,0,0.6)" }}>
          “The Bull's claim of a technical floor is hollow.”
          <div style={{ position: "absolute", left: 14, right: 14, top: "50%", height: 5, background: ink.bear, transformOrigin: "left", transform: `scaleX(${strike})` }} />
        </div>
        <div style={{ fontFamily: fonts.stamp, fontWeight: 800, fontSize: 30, letterSpacing: 3, color: ink.bear, marginTop: 12, opacity: strike }}>RHETORIC IS NOT EVIDENCE</div>
      </div>

      {/* Order, opinion and dissent */}
      <div style={{ position: "absolute", left: 1232, top: 190, width: 580 }}>
        <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Stamp at={tVerdict} size={50} angle={-6} sub={`Conviction ${ruling.conviction}`} style={{ whiteSpace: "nowrap" }}>
            {ruling.verdict === "DISMISSED" ? "Dismissed" : `${ruling.verdict === "LONG" ? "Long" : "Short"} · So Ordered`}
          </Stamp>
        </div>
        <div style={{ marginTop: 20, padding: "22px 26px", background: ink.paper2, boxShadow: "0 18px 40px -22px rgba(70,45,10,0.55)", opacity: opinion, transform: `translateY(${(1 - opinion) * 20}px)` }}>
          <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 16, letterSpacing: 4, color: ink.soft }}>OPINION · CASE NO. {caseNo}</div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30, lineHeight: 1.2, marginTop: 8 }}>{ruling.holding}</div>
          <div style={{ fontFamily: fonts.body, fontSize: 20, lineHeight: 1.35, color: ink.ink2, marginTop: 10 }}>{ruling.opinion.replace(/\s*\[Ex\.[^\]]*\]/g, "").split(/(?<=\.)\s/)[0]}</div>
        </div>
        <div style={{ marginTop: 18, padding: "16px 22px", borderLeft: `5px solid ${ink.bull}`, background: "rgba(29,90,58,0.07)", opacity: dissent, transform: `translateX(${(1 - dissent) * 30}px)` }}>
          <div style={{ fontFamily: fonts.stamp, fontWeight: 800, fontSize: 18, letterSpacing: 3, color: ink.bull }}>DISSENTING NOTE</div>
          <div style={{ fontFamily: fonts.body, fontStyle: "italic", fontSize: 21, lineHeight: 1.3, color: ink.ink2, marginTop: 4 }}>{ruling.dissent}</div>
        </div>
      </div>

      {drops.map((d) => (d.favors === "NEUTRAL" ? null : <Sfx key={d.exhibit} name="tick" at={d.at + 12} volume={0.5} />))}
      <Sfx name="stamp" at={tVerdict} volume={0.8} />
      <Sfx name="gavel" at={tVerdict + 3} volume={0.5} />
    </Paper>
  );
}
