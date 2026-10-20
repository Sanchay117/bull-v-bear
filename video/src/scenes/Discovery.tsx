import { interpolate, useCurrentFrame } from "remotion";
import { ex } from "../data.ts";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { ExhibitTag } from "../ui/Exhibit.tsx";
import { clamp, easeInOut, money, Paper, ramp, SectionHead, usePop } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const d = (id: string) => ex(id).data as any;

const SLOTS = [
  { x: 120, y: 268 },
  { x: 700, y: 268 },
  { x: 1280, y: 268 },
  { x: 120, y: 598 },
  { x: 700, y: 598 },
  { x: 1280, y: 598 },
];
const WORDS = ["price", "range", "trend", "volatility", "liquidity", "sentiment"];

const big = { fontFamily: fonts.display, fontWeight: 900, fontSize: 58, color: ink.ink, lineHeight: 1 } as const;
const small = { fontFamily: fonts.mono, fontSize: 21, color: ink.manilaInk } as const;

function Spot({ p }: { p: number }) {
  const a = d("A");
  const shown = a.price * (0.985 + 0.015 * p);
  return (
    <div>
      <div style={big}>{money(shown)}</div>
      <div style={{ display: "inline-block", marginTop: 14, padding: "4px 12px", background: ink.bear, color: ink.paper2, fontFamily: fonts.mono, fontWeight: 700, fontSize: 22, borderRadius: 4 }}>
        ▼ {Math.abs(a.change24hPct).toFixed(2)}% 24h · ▼ {Math.abs(a.change1hPct).toFixed(2)}% 1h
      </div>
    </div>
  );
}

function Range({ p }: { p: number }) {
  const b = d("B");
  const at = b.rangePosition24h * p;
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ position: "relative", height: 26, borderRadius: 13, background: `linear-gradient(90deg, ${ink.bear}, #c9a24a 50%, ${ink.bull})`, opacity: 0.85 }}>
        <div style={{ position: "absolute", left: `${at * 100}%`, top: -12, width: 6, height: 50, marginLeft: -3, background: ink.ink, borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, ...small }}>
        <span>{money(b.low24h)}</span>
        <span style={{ fontWeight: 700, color: ink.bear }}>spot at {Math.round(at * 100)}%</span>
        <span>{money(b.high24h)}</span>
      </div>
    </div>
  );
}

function Trend({ p }: { p: number }) {
  const c = d("C");
  const pts: number[] = c.sparkline;
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const W = 468;
  const H = 104;
  const path = pts.map((v, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * W).toFixed(1)} ${(H - ((v - lo) / (hi - lo)) * H).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg width={W} height={H + 6} style={{ overflow: "visible" }}>
        <path d={path} fill="none" stroke={ink.bear} strokeWidth={3} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      </svg>
      <div style={{ ...small, marginTop: 4 }}>
        <b style={{ color: ink.bear }}>{c.change7dPct.toFixed(2)}%</b> over 7 days · SMA24 &lt; SMA72
      </div>
    </div>
  );
}

function Gauge({ value, p, label, max = 100 }: { value: number; p: number; label: string; max?: number }) {
  const a = Math.PI * (1 - (value / max) * p);
  const R = 74;
  return (
    <svg width={190} height={130} viewBox="-95 -90 190 130">
      <path d={`M${-R} 0 A${R} ${R} 0 0 1 ${R} 0`} fill="none" stroke={ink.manila2} strokeWidth={16} />
      <path d={`M${-R} 0 A${R} ${R} 0 0 1 ${-R * Math.cos(Math.PI * 0.3)} ${-R * Math.sin(Math.PI * 0.3)}`} fill="none" stroke={ink.bear} strokeWidth={16} opacity={0.8} />
      <path d={`M${R * Math.cos(Math.PI * 0.3)} ${-R * Math.sin(Math.PI * 0.3)} A${R} ${R} 0 0 1 ${R} 0`} fill="none" stroke={ink.bull} strokeWidth={16} opacity={0.8} />
      <line x1={0} y1={0} x2={Math.cos(a) * (R - 8)} y2={-Math.sin(a) * (R - 8)} stroke={ink.ink} strokeWidth={5} strokeLinecap="round" />
      <circle r={8} fill={ink.ink} />
      <text y={34} textAnchor="middle" fontFamily={fonts.mono} fontWeight={700} fontSize={22} fill={ink.ink}>
        {label}
      </text>
    </svg>
  );
}

function Momentum({ p }: { p: number }) {
  const v = d("D");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <Gauge value={v.rsi14h} p={p} label={`RSI ${(v.rsi14h * p).toFixed(1)}`} />
      <div>
        <div style={{ ...big, fontSize: 50 }}>{(v.dailyVolPct * p).toFixed(2)}%</div>
        <div style={small}>realized vol / day</div>
      </div>
    </div>
  );
}

function Liquidity({ p }: { p: number }) {
  const e = d("E");
  return (
    <div>
      <div style={big}>${((e.volume24h / 1e9) * p).toFixed(2)}B</div>
      <div style={{ ...small, marginTop: 6 }}>24h volume · {e.turnoverPct}% of market cap</div>
      <div style={{ marginTop: 12, height: 14, borderRadius: 7, background: ink.manila2 }}>
        <div style={{ width: `${Math.min(100, e.turnoverPct * 10) * p}%`, height: "100%", borderRadius: 7, background: ink.ink2 }} />
      </div>
    </div>
  );
}

function Sentiment({ p }: { p: number }) {
  const f = d("F");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <Gauge value={f.value} p={p} label={`${Math.round(f.value * p)}`} />
      <div>
        <div style={{ ...big, fontSize: 50, color: ink.bull }}>{f.label}</div>
        <div style={small}>Fear &amp; Greed Index</div>
        <div style={small}>57 a week ago</div>
      </div>
    </div>
  );
}

const BODIES = [Spot, Range, Trend, Momentum, Liquidity, Sentiment];

export function Discovery({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const tGecko = cue(shot, "coingecko", 0, 60);
  const tFear = cue(shot, "fear", 0, 100);
  const tDeal = cue(shot, "six", 0, 160) - 26;
  const said = WORDS.map((w, i) => cue(shot, w, 0, 260 + i * 25));

  const src = (at: number) => ramp(frame, at - 4, 14);

  return (
    <Paper>
      <SectionHead roman="I." title="Discovery" at={4} note="Exhibits entered into evidence" />
      <div style={{ position: "absolute", left: 120, top: 172, display: "flex", gap: 18 }}>
        {[
          { at: tGecko, name: "CoinGecko", what: "price · range · 7-day hourly closes · volume" },
          { at: tFear, name: "alternative.me", what: "Crypto Fear & Greed Index" },
        ].map((s) => (
          <div
            key={s.name}
            style={{
              opacity: src(s.at),
              transform: `translateY(${(1 - src(s.at)) * 12}px)`,
              display: "flex",
              gap: 12,
              alignItems: "baseline",
              padding: "8px 18px",
              border: `2px solid ${ink.ink2}`,
              borderRadius: 999,
              fontFamily: fonts.body,
              fontSize: 24,
            }}
          >
            <span style={{ fontFamily: fonts.mono, fontWeight: 700, fontSize: 18, letterSpacing: 2, color: ink.bear }}>LIVE</span>
            <b>{s.name}</b>
            <span style={{ color: ink.soft, fontStyle: "italic" }}>{s.what}</span>
          </div>
        ))}
      </div>

      {SLOTS.map((slot, i) => {
        const id = "ABCDEF"[i];
        const at = tDeal + i * 6;
        const k = frame - at;
        const inT = interpolate(k, [0, 22], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
        const rot = (i % 2 ? 1 : -1) * (2 + (i % 3));
        const lit = interpolate(frame, [said[i] - 4, said[i] + 4, said[i] + 26, said[i] + 40], [0, 1, 1, 0.0], clamp);
        const draw = ramp(frame, Math.max(at + 10, said[i] - 30), 40, easeInOut);
        const Body = BODIES[i];
        return (
          <div key={id}>
            <ExhibitTag
              id={id}
              title={ex(id).title}
              lit={lit}
              style={{
                left: slot.x,
                top: slot.y,
                opacity: inT,
                transform: `translate(${(1 - inT) * (i % 3 - 1) * 120}px, ${(1 - inT) * 520 - lit * 14}px) rotate(${rot * (1 - inT) * 5 + rot * 0.18}deg) scale(${1 + lit * 0.035})`,
                zIndex: lit > 0 ? 2 : 1,
              }}
            >
              <Body p={draw} />
            </ExhibitTag>
          </div>
        );
      })}
      {SLOTS.map((_, i) => (
        <Sfx key={i} name="paper" at={tDeal + i * 6} volume={0.35} />
      ))}
    </Paper>
  );
}
