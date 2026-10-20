import { fmtUsd, type Sentence, type StandingOrders } from "@court/core";

function Ladder({ s }: { s: Sentence }) {
  const long = s.action === "LONG";
  const prices = [s.stopPrice, s.entryPrice, s.targetPrice];
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const y = (p: number) => 12 + (1 - (p - lo) / (hi - lo || 1)) * 196;
  const rows = [
    { p: s.targetPrice, label: "Target", cls: long ? "lad-win" : "lad-win" },
    { p: s.entryPrice, label: "Entry", cls: "lad-entry" },
    { p: s.stopPrice, label: "Stop", cls: "lad-stop" },
  ];
  return (
    <svg viewBox="0 0 220 220" className="ladder" aria-label="Price ladder of the ordered position">
      <rect x="54" y={Math.min(y(s.entryPrice), y(s.targetPrice))} width="28" height={Math.abs(y(s.targetPrice) - y(s.entryPrice))} className="lad-zone-win" />
      <rect x="54" y={Math.min(y(s.entryPrice), y(s.stopPrice))} width="28" height={Math.abs(y(s.stopPrice) - y(s.entryPrice))} className="lad-zone-stop" />
      <line x1="68" y1="6" x2="68" y2="214" className="lad-spine" />
      {rows.map((r) => (
        <g key={r.label} transform={`translate(0 ${y(r.p)})`}>
          <line x1="50" x2="86" y1="0" y2="0" className={`lad-tick ${r.cls}`} />
          <text x="44" y="4" textAnchor="end" className="lad-label">
            {r.label}
          </text>
          <text x="94" y="4" className={`lad-price ${r.cls}`}>
            {fmtUsd(r.p)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function SentenceOrder({ sentence, orders }: { sentence: Sentence; orders?: StandingOrders }) {
  const none = sentence.action === "NO_POSITION";
  return (
    <section className="order doc" aria-label="Order of practice position">
      <header className="section-head">
        <span className="roman">IV.</span>
        <h3>Order of Practice Position</h3>
        <span className="section-rule" />
        <span className="section-note">{sentence.guidelines}</span>
      </header>
      <div className="doc-sheet order-sheet">
        <div className="order-main">
          <p className="order-preamble">
            Pursuant to the Court's ruling and the Sentencing Guidelines for Practice Positions, it is hereby <b>ORDERED</b> that:
          </p>
          {none ? (
            <p className="order-none">{sentence.reason}</p>
          ) : (
            <>
              <p className={`order-directive ${sentence.action === "LONG" ? "bull" : "bear"}`}>
                A <b>{sentence.action}</b> practice position be opened at <b>{fmtUsd(sentence.entryPrice)}</b>, sized at{" "}
                <b>{(sentence.sizeBps / 100).toFixed(2)}%</b> of the practice bankroll, with a protective stop at{" "}
                <b>{fmtUsd(sentence.stopPrice)}</b> and a target of <b>{fmtUsd(sentence.targetPrice)}</b>.
              </p>
            </>
          )}
          <ol className="worksheet">
            {sentence.steps.map((st) => (
              <li key={st.label}>
                <span className="ws-label">{st.label}</span>
                <span className="ws-formula">{st.formula}</span>
                <span className="ws-leader" aria-hidden="true" />
                <span className="ws-value">{st.value}</span>
              </li>
            ))}
          </ol>
          {orders && (
            <p className="standing">
              Standing orders: risk {orders.riskPerTradeBps} bps/trade · cap {orders.maxPositionBps} bps · min conviction{" "}
              {orders.minConviction} · reward:risk {orders.rewardRiskRatio}:1 · stop {orders.stopVolMultiple}× vol
            </p>
          )}
          <p className="order-fine">
            Practice positions only. No funds move. The position is settled on-chain at the next ruling for this asset.
          </p>
        </div>
        {!none && <Ladder s={sentence} />}
      </div>
    </section>
  );
}
