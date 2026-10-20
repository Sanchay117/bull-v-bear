import { useState } from "react";
import type { AssetSpec, StandingOrders } from "@court/core";
import { GavelMark } from "./Emblems.tsx";

const SLIDERS: { key: keyof StandingOrders; label: string; hint: string; min: number; max: number; step: number; fmt: (v: number) => string }[] = [
  { key: "riskPerTradeBps", label: "Risk per matter", hint: "Bankroll lost if the stop is hit, at full conviction", min: 10, max: 500, step: 10, fmt: (v) => `${(v / 100).toFixed(1)}%` },
  { key: "maxPositionBps", label: "Position cap", hint: "Largest position the Court may order", min: 500, max: 10000, step: 250, fmt: (v) => `${(v / 100).toFixed(0)}%` },
  { key: "minConviction", label: "Minimum conviction", hint: "Below this the Court orders no position", min: 50, max: 90, step: 1, fmt: (v) => `${v}` },
  { key: "rewardRiskRatio", label: "Reward : risk", hint: "Target distance as a multiple of the stop", min: 1, max: 5, step: 0.5, fmt: (v) => `${v}:1` },
  { key: "stopVolMultiple", label: "Stop width", hint: "Stop distance in units of daily volatility", min: 0.5, max: 4, step: 0.25, fmt: (v) => `${v}× vol` },
];

export function FilingDesk({
  assets,
  defaults,
  busy,
  onFile,
}: {
  assets: AssetSpec[];
  defaults: StandingOrders;
  busy: boolean;
  onFile: (asset: string, orders: StandingOrders) => void;
}) {
  const [asset, setAsset] = useState(assets[0]?.symbol ?? "ETH");
  const [orders, setOrders] = useState<StandingOrders>(defaults);
  const [showOrders, setShowOrders] = useState(false);

  return (
    <section className="desk" aria-label="File a new matter">
      <div className="desk-intro">
        <p className="desk-eyebrow">Clerk's Office</p>
        <h2 className="desk-title">File a new matter</h2>
        <p className="desk-copy">
          Name the defendant market. The clerk enters live market data as lettered exhibits. Two AI counsel argue from that
          closed record, cite it line by line, and rebut each other. The bench weighs every exhibit, then the Sentencing
          Guidelines turn the ruling into an exact practice position. Its hash is filed on-chain.
        </p>
      </div>
      <div className="desk-form">
        <fieldset className="docket-cards">
          <legend>Defendant market</legend>
          {assets.map((a, i) => (
            <label key={a.symbol} className={`index-card ${asset === a.symbol ? "is-picked" : ""}`} style={{ ["--i" as string]: i }}>
              <input type="radio" name="asset" value={a.symbol} checked={asset === a.symbol} onChange={() => setAsset(a.symbol)} />
              <span className="ic-symbol">{a.symbol}</span>
              <span className="ic-name">{a.name}</span>
              <span className="ic-caption">In re {a.symbol}/USD</span>
            </label>
          ))}
        </fieldset>

        <button type="button" className="orders-toggle" onClick={() => setShowOrders((s) => !s)} aria-expanded={showOrders}>
          {showOrders ? "▾" : "▸"} Standing orders (your risk limits)
        </button>
        {showOrders && (
          <div className="orders">
            {SLIDERS.map((s) => (
              <label key={s.key} className="order-row">
                <span className="order-label">
                  {s.label}
                  <small>{s.hint}</small>
                </span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={orders[s.key]}
                  onChange={(e) => setOrders({ ...orders, [s.key]: Number(e.target.value) })}
                />
                <output>{s.fmt(orders[s.key])}</output>
              </label>
            ))}
          </div>
        )}

        <button type="button" className="call-to-order" disabled={busy} onClick={() => onFile(asset, orders)}>
          <GavelMark size={26} />
          <span>{busy ? "Court is in session…" : "Call the Court to Order"}</span>
        </button>
        <p className="desk-fine">Practice positions only. Nothing here is investment advice.</p>
      </div>
    </section>
  );
}
