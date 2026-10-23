import type { JudgeRuling } from "@court/core";
import { WithCitations } from "./Citations.tsx";
import { Stamp } from "./Stamp.tsx";

export function verdictTone(v: JudgeRuling["verdict"]): "bull" | "bear" | "neutral" {
  return v === "LONG" ? "bull" : v === "SHORT" ? "bear" : "neutral";
}

export function Opinion({ ruling, caption, judge }: { ruling: JudgeRuling; caption: string; judge: string }) {
  const tone = verdictTone(ruling.verdict);
  return (
    <section className="opinion doc" aria-label="Opinion and order">
      <header className="section-head">
        <span className="roman">III.</span>
        <h3>Opinion &amp; Order</h3>
        <span className="section-rule" />
      </header>
      <div className="doc-sheet">
        <div className="doc-stamp">
          <Stamp tone={tone} stampKey={ruling.holding} sub={ruling.verdict === "DISMISSED" ? "No position ordered" : `Conviction ${ruling.conviction}`}>
            {ruling.verdict === "LONG" ? "Long · So Ordered" : ruling.verdict === "SHORT" ? "Short · So Ordered" : "Dismissed"}
          </Stamp>
        </div>
        <p className="doc-kicker">{caption} · {judge}, presiding</p>
        <h2 className="holding">{ruling.holding}</h2>
        <div className="opinion-body">
          <p className="dropcap">
            <WithCitations text={ruling.opinion} />
          </p>
        </div>

        {ruling.findings.length > 0 && (
          <>
            <h4 className="doc-subhead">Findings of Fact</h4>
            <ol className="findings">
              {ruling.findings.map((f, i) => (
                <li key={`${f.exhibit}-${i}`} className={`finding favors-${f.favors.toLowerCase()}`}>
                  <span className="finding-ex">
                    Ex. <b>{f.exhibit}</b>
                  </span>
                  <span className="finding-text">{f.finding}</span>
                  <span className={`favor favor-${f.favors.toLowerCase()}`}>
                    {f.favors === "NEUTRAL" ? "Neutral" : f.favors === "BULL" ? "Bull" : "Bear"}
                  </span>
                  <span className="weight" aria-label={`weight ${f.weight}`}>
                    {"●".repeat(f.weight)}
                    {"○".repeat(Math.max(0, 3 - f.weight))}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}

        {ruling.dissent && (
          <blockquote className="dissent">
            <span className="dissent-label">Dissenting note</span>
            <WithCitations text={ruling.dissent} />
          </blockquote>
        )}
      </div>
    </section>
  );
}
