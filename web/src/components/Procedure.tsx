import type { Phase } from "../api.ts";

const STEPS: { phase: Phase; numeral: string; label: string }[] = [
  { phase: "discovery", numeral: "I", label: "Discovery" },
  { phase: "openings", numeral: "II", label: "Openings" },
  { phase: "rebuttals", numeral: "III", label: "Rebuttals" },
  { phase: "deliberation", numeral: "IV", label: "Deliberation" },
  { phase: "sentencing", numeral: "V", label: "Sentencing" },
  { phase: "filing", numeral: "VI", label: "Filing" },
];

export function Procedure({ phase, done }: { phase?: Phase; done: boolean }) {
  const at = done ? STEPS.length : Math.max(0, STEPS.findIndex((s) => s.phase === phase));
  return (
    <ol className="procedure" aria-label="Order of proceedings">
      {STEPS.map((s, i) => (
        <li key={s.phase} className={i < at ? "is-past" : i === at && !done ? "is-now" : ""} aria-current={i === at && !done ? "step" : undefined}>
          <span className="proc-num">{s.numeral}</span>
          <span className="proc-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function AllRise({ judge }: { judge: string }) {
  return (
    <div className="all-rise" role="status">
      <div className="all-rise-inner">
        <p className="ar-small">Hear ye, hear ye</p>
        <p className="ar-big">All Rise</p>
        <p className="ar-small">The Court of Market Opinion is now in session, {judge} presiding</p>
      </div>
    </div>
  );
}
