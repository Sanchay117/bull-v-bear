import { fmtUsd } from "@court/core";
import type { Docket, OnChainRuling } from "../api.ts";
import { Stamp } from "./Stamp.tsx";

function EquityCurve({ rulings }: { rulings: OnChainRuling[] }) {
  const settled = [...rulings].filter((r) => r.settled && r.sizeBps > 0).sort((a, b) => a.caseNumber - b.caseNumber);
  const pts = [1];
  for (const r of settled) pts.push(pts[pts.length - 1] * (1 + r.bankrollImpactBps / 10_000));
  const w = 320;
  const h = 70;
  const lo = Math.min(...pts, 0.995);
  const hi = Math.max(...pts, 1.005);
  const xy = pts.map((p, i) => [(i / Math.max(1, pts.length - 1)) * w, h - 6 - ((p - lo) / (hi - lo)) * (h - 12)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const base = h - 6 - ((1 - lo) / (hi - lo)) * (h - 12);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="equity" preserveAspectRatio="none" aria-label="Practice equity curve">
      <line x1="0" x2={w} y1={base} y2={base} className="equity-base" />
      <path d={d} className="equity-line" />
      {xy.slice(1).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.6" className="equity-dot" />
      ))}
    </svg>
  );
}

export function DocketLedger({ docket, onOpen, activeHash }: { docket?: Docket; onOpen: (hash: string) => void; activeHash?: string }) {
  const rulings = docket?.rulings ?? [];
  return (
    <section className="ledger" aria-label="The docket">
      <header className="ledger-head">
        <div>
          <p className="desk-eyebrow">The Public Record</p>
          <h2 className="desk-title">The Docket</h2>
        </div>
        <div className="ledger-equity">
          <EquityCurve rulings={rulings} />
          <div className="ledger-stats">
            <span>
              Practice equity <b>{docket ? `${(docket.equityIndex * 100).toFixed(2)}%` : "—"}</b>
            </span>
            <span>
              Matters <b>{docket?.total ?? 0}</b>
            </span>
            <span>
              Won <b>{docket?.wins ?? 0}</b> · Lost <b>{docket?.losses ?? 0}</b>
            </span>
          </div>
        </div>
      </header>
      {rulings.length === 0 ? (
        <p className="ledger-empty">No matters have been entered into the record yet. File one above.</p>
      ) : (
        <div className="ledger-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Matter</th>
                <th>Ruling</th>
                <th>Conv.</th>
                <th>Position</th>
                <th>Entry</th>
                <th>Damages</th>
                <th>Holding</th>
              </tr>
            </thead>
            <tbody>
              {rulings.map((r) => {
                const tone = r.verdict === "LONG" ? "bull" : r.verdict === "SHORT" ? "bear" : "neutral";
                const clickable = r.hasTranscript;
                return (
                  <tr
                    key={r.caseNumber}
                    className={`${clickable ? "is-clickable" : ""} ${activeHash === r.transcriptHash ? "is-active" : ""}`}
                    onClick={() => clickable && onOpen(r.transcriptHash)}
                    tabIndex={clickable ? 0 : -1}
                    onKeyDown={(e) => clickable && e.key === "Enter" && onOpen(r.transcriptHash)}
                    title={clickable ? "Open the transcript" : "Transcript not on file with this clerk"}
                  >
                    <td className="mono">{String(r.caseNumber).padStart(4, "0")}</td>
                    <td>
                      <b>In re {r.asset}</b>
                      <small>{new Date(r.trialTime * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small>
                    </td>
                    <td>
                      <Stamp tone={tone} size="sm" angle={-3}>
                        {r.verdict}
                      </Stamp>
                    </td>
                    <td className="mono">{r.conviction}</td>
                    <td className="mono">{r.sizeBps ? `${(r.sizeBps / 100).toFixed(1)}%` : "—"}</td>
                    <td className="mono">{fmtUsd(r.entryPrice)}</td>
                    <td className={`mono dmg ${r.bankrollImpactBps > 0 ? "up" : r.bankrollImpactBps < 0 ? "down" : ""}`}>
                      {!r.sizeBps ? "—" : r.settled ? `${r.bankrollImpactBps >= 0 ? "+" : ""}${(r.bankrollImpactBps / 100).toFixed(2)}%` : "open"}
                    </td>
                    <td className="ledger-holding">{r.holding}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
