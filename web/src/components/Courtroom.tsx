import { useEffect, useRef, useState, type ReactNode } from "react";
import type { JudgeRuling, Side } from "@court/core";
import type { Speech, TrialState } from "../useTrial.ts";
import { WithCitations } from "./Citations.tsx";
import { BearMark, BullMark } from "./Emblems.tsx";
import { Scales } from "./Scales.tsx";

const LINE = 30;

/** Ruled pleading paper with numbered lines down the margin, as in a court transcript. */
function Pleading({ children, side }: { children: ReactNode; side: Side }) {
  const ref = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState(12);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setLines(Math.max(12, Math.ceil(e.contentRect.height / LINE))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div className={`pleading pleading-${side.toLowerCase()}`}>
      <ol className="pleading-numbers" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <li key={i}>{i + 1}</li>
        ))}
      </ol>
      <div className="pleading-body" ref={ref}>
        {children}
      </div>
    </div>
  );
}

function SealedNotes({ notes, label }: { notes: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (!notes.trim()) return null;
  return (
    <div className={`sealed ${open ? "is-open" : ""}`}>
      <button type="button" className="sealed-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="sealed-badge">{open ? "Unsealed" : "Under seal"}</span>
        <span>{label}</span>
      </button>
      <p className="sealed-text">{notes.trim()}</p>
    </div>
  );
}

function Address({ speech, title, side, idle }: { speech: Speech; title: string; side: Side; idle: string }) {
  const speaking = speech.started && !speech.done;
  return (
    <div className={`address ${speaking ? "is-speaking" : ""} ${speech.done ? "is-done" : ""}`}>
      <h5 className="address-title">
        <span>{title}</span>
        {speaking && <span className="on-floor">● On the floor</span>}
      </h5>
      <SealedNotes notes={speech.notes} label="Counsel's private reasoning" />
      {speech.text ? (
        <p className="speech">
          <WithCitations text={speech.text} />
          {speaking && <span className="caret" aria-hidden="true" />}
        </p>
      ) : (
        <p className="speech-idle">{speech.started ? "Counsel confers privately…" : idle}</p>
      )}
      {speech.done && speech.citations.length > 0 && (
        <p className="speech-cites">Authorities cited: {speech.citations.map((c) => `Ex. ${c}`).join(" · ")}</p>
      )}
    </div>
  );
}

function Tally({ score }: { score: number }) {
  return (
    <span className="tally" aria-label={`${score} of 10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < score ? "on" : ""} />
      ))}
      <b>{score}/10</b>
    </span>
  );
}

function CounselColumn({ side, state, ruling }: { side: Side; state: TrialState; ruling?: JudgeRuling }) {
  const bull = side === "BULL";
  const open = state.speeches[`${side}-opening`];
  const reb = state.speeches[`${side}-rebuttal`];
  const won = ruling && ((bull && ruling.verdict === "LONG") || (!bull && ruling.verdict === "SHORT"));
  return (
    <section className={`counsel counsel-${side.toLowerCase()} ${won ? "is-winner" : ""}`} aria-label={`Counsel for the ${bull ? "Bull" : "Bear"}`}>
      <header className="counsel-head">
        <span className="counsel-mark">{bull ? <BullMark size={52} /> : <BearMark size={52} />}</span>
        <div>
          <div className="counsel-role">{bull ? "Movant" : "Respondent"}</div>
          <h4 className="counsel-name">Counsel for the {bull ? "Bull" : "Bear"}</h4>
          <div className="counsel-brief">{bull ? "moves for a LONG practice position" : "moves for a SHORT, or denial"}</div>
        </div>
        {ruling && <Tally score={bull ? ruling.bull_score : ruling.bear_score} />}
      </header>
      <Pleading side={side}>
        <Address speech={open} side={side} title="Opening Argument" idle="Awaiting the Court's call." />
        <Address speech={reb} side={side} title="Rebuttal" idle="Reserved." />
      </Pleading>
    </section>
  );
}

export function Courtroom({ state }: { state: TrialState }) {
  const r = state.ruling;
  const tilt = !r ? 0 : r.verdict === "DISMISSED" ? 0 : (r.verdict === "LONG" ? -1 : 1) * Math.max(0.25, (r.conviction - 40) / 60);
  const judge = state.counsel?.mode === "claude" ? "The Hon. Claude" : "The Hon. Demo Counsel";
  return (
    <section className="courtroom">
      <header className="section-head">
        <span className="roman">II.</span>
        <h3>Transcript of Argument</h3>
        <span className="section-rule" />
        <span className="section-note">Hover a citation to see the exhibit</span>
      </header>
      <div className="floor">
        <CounselColumn side="BULL" state={state} ruling={r} />
        <aside className="bench" aria-label="The bench">
          <div className="bench-plate">
            <span className="bench-presiding">{judge}</span>
            <span className="bench-sub">presiding</span>
          </div>
          <Scales tilt={tilt} deliberating={state.status === "running" && !r} />
          <div className="bench-status" aria-live="polite">
            {state.deliberating && <span className="in-chambers">The Court is in chambers…</span>}
            {!state.deliberating && !r && state.status === "running" && <span>Argument in progress</span>}
            {r && (
              <span className={`bench-verdict v-${r.verdict.toLowerCase()}`}>
                {r.verdict === "DISMISSED" ? "Case dismissed" : `Judgment for the ${r.verdict === "LONG" ? "Bull" : "Bear"}`}
              </span>
            )}
          </div>
          {state.benchNotes && <SealedNotes notes={state.benchNotes} label="Notes from chambers" />}
          {r && (
            <div className="conviction">
              <div className="conviction-label">
                Conviction <b>{r.conviction}</b>
              </div>
              <div className="conviction-track">
                <div className={`conviction-fill v-${r.verdict.toLowerCase()}`} style={{ width: `${r.conviction}%` }} />
                <div className="conviction-tick" style={{ left: `${state.transcript?.standingOrders.minConviction ?? 55}%` }} />
              </div>
            </div>
          )}
        </aside>
        <CounselColumn side="BEAR" state={state} ruling={r} />
      </div>
    </section>
  );
}
