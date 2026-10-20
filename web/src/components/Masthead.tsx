import { counselName } from "@court/core";
import type { Docket, Status } from "../api.ts";
import { CourtSeal } from "./Emblems.tsx";

const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

export function Masthead({
  status,
  docket,
  theme,
  onTheme,
  sound,
  onSound,
}: {
  status?: Status;
  docket?: Docket;
  theme: "light" | "dark";
  onTheme: () => void;
  sound: boolean;
  onSound: () => void;
}) {
  const chain = status?.chain;
  const counsel = status?.counsel;
  const ticker = docket?.rulings.slice(0, 12) ?? [];
  return (
    <header className="masthead">
      <div className="masthead-top">
        <span>Vol. I · No. {docket?.total ?? 0}</span>
        <span className="mt-center">{today}</span>
        <span className="mt-controls">
          <button type="button" className="chip-btn" onClick={onSound} aria-pressed={sound}>
            {sound ? "♪ Sound on" : "♪ Sound off"}
          </button>
          <button type="button" className="chip-btn" onClick={onTheme}>
            {theme === "light" ? "☾ Chambers" : "☀ Courtroom"}
          </button>
        </span>
      </div>
      <div className="masthead-main">
        <div className="masthead-seal">
          <CourtSeal size={124} />
        </div>
        <div className="masthead-title">
          <p className="mt-eyebrow">In the Court of Market Opinion · Practice Division</p>
          <h1 className="wordmark">
            <span className="wm-bull">Bull</span>
            <span className="wm-v">v.</span>
            <span className="wm-bear">Bear</span>
          </h1>
          <p className="mt-tagline">AI counsel argue the evidence. An AI judge rules. Chainlink CRE files the verdict on-chain.</p>
        </div>
        <dl className="masthead-certs">
          <div className={`cert-chip ${counsel && counsel.mode !== "demo" ? "ok" : "warn"}`}>
            <dt>Counsel</dt>
            <dd>{!counsel ? "…" : counsel.mode === "demo" ? "Demo counsel" : `${counselName(counsel)} · ${counsel.model}`}</dd>
          </div>
          <div className={`cert-chip ${chain?.online ? "ok" : "warn"}`}>
            <dt>Record</dt>
            <dd>{!chain ? "…" : chain.online ? `${chain.mode === "local" ? "Local chain" : "Sepolia"} · ${chain.chainId}` : "Off-chain"}</dd>
          </div>
          <div className="cert-chip">
            <dt>Practice equity</dt>
            <dd>
              {docket ? `${(docket.equityIndex * 100).toFixed(2)}%` : "…"}
              {docket && docket.wins + docket.losses > 0 && (
                <small>
                  {" "}
                  W{docket.wins}·L{docket.losses}
                </small>
              )}
            </dd>
          </div>
        </dl>
      </div>
      <div className="ticker" aria-label="Latest rulings">
        <span className="ticker-label">Court News</span>
        <div className="ticker-window">
          <div className="ticker-track" style={{ animationDuration: `${Math.max(30, ticker.length * 9)}s` }}>
            {(ticker.length ? [...ticker, ...ticker] : []).map((r, i) => (
              <span key={i} className={`ticker-item v-${r.verdict.toLowerCase()}`}>
                <b>No. {String(r.caseNumber).padStart(4, "0")}</b> In re {r.asset} — <em>{r.verdict}</em> ({r.conviction}) — {r.holding}
                <span className="ticker-sep">✦</span>
              </span>
            ))}
            {ticker.length === 0 && <span className="ticker-item">The docket is empty. The Court awaits its first matter. ✦ Practice positions only — not investment advice. ✦</span>}
          </div>
        </div>
      </div>
    </header>
  );
}
