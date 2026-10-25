import { useContext } from "react";
import { fmtUsd, type Exhibit, type Finding } from "@court/core";
import { ExhibitFocus } from "./Citations.tsx";

const n = (v: unknown) => (typeof v === "number" ? v : Number(v));

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return null;
  const w = 220;
  const h = 64;
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const span = hi - lo || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 6 - ((p - lo) / span) * (h - 12)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`ex-spark ${up ? "up" : "down"}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="5" className="hatch-line" />
        </pattern>
      </defs>
      <path d={area} fill="url(#hatch)" />
      <path d={line} className="spark-line" />
      <circle cx={lx} cy={ly} r="3.2" className="spark-dot" />
    </svg>
  );
}

function RangeBar({ low, high, pos }: { low: number; high: number; pos: number }) {
  return (
    <div className="ex-range" aria-hidden="true">
      <div className="ex-range-track">
        <div className="ex-range-mark" style={{ left: `${Math.max(0, Math.min(1, pos)) * 100}%` }} />
      </div>
      <div className="ex-range-labels">
        <span>{fmtUsd(low)}</span>
        <span>{fmtUsd(high)}</span>
      </div>
    </div>
  );
}

function Dial({ value, lo = 0, hi = 100, zones, label }: { value: number; lo?: number; hi?: number; zones: [number, number, string][]; label: string }) {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const ang = Math.PI * (1 - t);
  const arc = (a: number, b: number) => {
    const p = (v: number) => {
      const th = Math.PI * (1 - (v - lo) / (hi - lo));
      return [50 + 40 * Math.cos(th), 50 - 40 * Math.sin(th)];
    };
    const [x1, y1] = p(a);
    const [x2, y2] = p(b);
    return `M${x1} ${y1} A40 40 0 0 1 ${x2} ${y2}`;
  };
  return (
    <svg viewBox="0 0 100 60" className="ex-dial" aria-hidden="true">
      {zones.map(([a, b, cls]) => (
        <path key={`${a}-${b}`} d={arc(a, b)} className={`dial-zone ${cls}`} />
      ))}
      <line x1="50" y1="50" x2={50 + 34 * Math.cos(ang)} y2={50 - 34 * Math.sin(ang)} className="dial-needle" />
      <circle cx="50" cy="50" r="3.5" className="dial-hub" />
      <text x="50" y="44" textAnchor="middle" className="dial-label">
        {label}
      </text>
    </svg>
  );
}

function Visual({ ex }: { ex: Exhibit }) {
  const d = ex.data;
  switch (ex.kind) {
    case "price": {
      const c = n(d.change24hPct);
      return (
        <div className="ex-price">
          <div className="ex-price-figure">{fmtUsd(n(d.price))}</div>
          <div className={`ex-pill ${c >= 0 ? "up" : "down"}`}>
            {c >= 0 ? "▲" : "▼"} {Math.abs(c).toFixed(2)}% <small>24h</small>
          </div>
        </div>
      );
    }
    case "range":
      return <RangeBar low={n(d.low24h)} high={n(d.high24h)} pos={n(d.rangePosition24h)} />;
    case "trend":
      return <Sparkline points={(d.sparkline as number[]) ?? []} up={n(d.change7dPct) >= 0} />;
    case "volatility":
      return (
        <Dial
          value={n(d.rsi14h)}
          zones={[
            [0, 30, "zone-bull"],
            [30, 70, "zone-mid"],
            [70, 100, "zone-bear"],
          ]}
          label={`RSI ${n(d.rsi14h).toFixed(0)}`}
        />
      );
    case "sentiment":
      return (
        <Dial
          value={n(d.value)}
          zones={[
            [0, 25, "zone-bull"],
            [25, 75, "zone-mid"],
            [75, 100, "zone-bear"],
          ]}
          label={`${n(d.value)}`}
        />
      );
    case "oracle": {
      const dev = n(d.deviationPct);
      return (
        <div className="ex-price">
          <div className="ex-price-figure">{fmtUsd(n(d.price))}</div>
          <div className="ex-pill flat">
            {dev >= 0 ? "+" : "−"}
            {Math.abs(dev).toFixed(2)}% <small>vs spot</small>
          </div>
          <div className="ex-oracle-src">Chainlink · {String(d.network)} · the court's mark</div>
        </div>
      );
    }
    case "liquidity": {
      const t = n(d.turnoverPct);
      return (
        <div className="ex-meter" aria-hidden="true">
          <div className="ex-meter-fill" style={{ width: `${Math.min(100, (t / 15) * 100)}%` }} />
          <span>{t.toFixed(2)}% turnover</span>
        </div>
      );
    }
    default:
      return null;
  }
}

export function ExhibitShelf({ exhibits, findings, live }: { exhibits: Exhibit[]; findings?: Finding[]; live: boolean }) {
  const { focus, setFocus } = useContext(ExhibitFocus);
  return (
    <section className="shelf" aria-label="Exhibits entered into evidence">
      <header className="section-head">
        <span className="roman">I.</span>
        <h3>Exhibits Entered Into Evidence</h3>
        <span className="section-rule" />
        <span className="section-note">{live ? "Both counsel argue from the same closed record" : "Closed record"}</span>
      </header>
      <div className="shelf-row">
        {exhibits.map((ex, i) => {
          const f = findings?.find((x) => x.exhibit === ex.id);
          return (
            <article
              key={ex.id}
              id={`exhibit-${ex.id}`}
              className={`tag tag-${ex.kind} ${focus === ex.id ? "is-focus" : ""} ${f ? `favors-${f.favors.toLowerCase()}` : ""}`}
              style={{ ["--i" as string]: i, ["--tilt" as string]: `${((i * 37) % 7) - 3}deg` }}
              onMouseEnter={() => setFocus(ex.id)}
              onMouseLeave={() => setFocus(null)}
            >
              <div className="tag-hole" aria-hidden="true" />
              <div className="tag-head">
                <span className="tag-label">Exhibit</span>
                <span className="tag-letter">{ex.id}</span>
              </div>
              <h4 className="tag-title">{ex.title}</h4>
              <Visual ex={ex} />
              <p className="tag-statement">{ex.statement}</p>
              {f && (
                <div className="tag-finding">
                  <span className={`favor favor-${f.favors.toLowerCase()}`}>
                    {f.favors === "NEUTRAL" ? "Neutral" : `Favors ${f.favors === "BULL" ? "Bull" : "Bear"}`}
                  </span>
                  <span className="weight" aria-label={`weight ${f.weight} of 3`}>
                    {"●".repeat(f.weight)}
                    {"○".repeat(3 - f.weight)}
                  </span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
