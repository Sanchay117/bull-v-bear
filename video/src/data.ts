// The trial filmed for the demo (Case No. 0004, Groq gpt-oss-120b), copied from the clerk's
// records so the motion graphics show the same numbers as the footage.
import record from "./case.json";

export const filed = record;
export const trial = record.transcript;
export const exhibits = trial.exhibits;
export const ex = (id: string) => exhibits.find((e) => e.id === id)!;
export const args = trial.arguments;
export const ruling = trial.ruling;
export const sentence = trial.sentence;
export const caseNo = String(record.filing.caseNumber).padStart(4, "0");
export const hash = record.transcriptHash;
