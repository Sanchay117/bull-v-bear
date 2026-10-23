import { useState } from "react";
import { transcriptHash, type Transcript } from "@court/core";
import { api, type ChainStatus, type FiledEvent } from "../api.ts";
import { WaxSeal } from "./Emblems.tsx";
import { Stamp } from "./Stamp.tsx";

type Check =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "match"; computed: string; onChain: string; tampered: false }
  | { kind: "mismatch"; computed: string; onChain: string; tampered: boolean }
  | { kind: "error"; message: string };

const short = (h?: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-6)}` : "pending");

/** Alters one word of the opinion: the smallest possible forgery. */
function forge(t: Transcript): Transcript {
  const copy = structuredClone(t);
  const words = copy.ruling.opinion.split(" ");
  const i = Math.min(words.length - 1, 7);
  words[i] = words[i] === "not" ? "clearly" : "not";
  copy.ruling.opinion = words.join(" ");
  return copy;
}

export function Certificate({ filed, transcript, chain }: { filed: FiledEvent; transcript?: Transcript; chain?: ChainStatus }) {
  const [check, setCheck] = useState<Check>({ kind: "idle" });

  async function verify(tamper: boolean) {
    if (!transcript) return;
    setCheck({ kind: "checking" });
    try {
      const record = await api.transcript(filed.transcriptHash);
      const onChain = record.onChain?.transcriptHash;
      if (!onChain) throw new Error("This transcript has no ruling on the connected chain.");
      // Recomputed here, in your browser, from the words on the page.
      const computed = transcriptHash(tamper ? forge(transcript) : transcript);
      setCheck(computed === onChain ? { kind: "match", computed, onChain, tampered: false } : { kind: "mismatch", computed, onChain, tampered: tamper });
    } catch (err) {
      setCheck({ kind: "error", message: (err as Error).message });
    }
  }

  const explorerTx = chain?.explorer && filed.txHash ? `${chain.explorer}/tx/${filed.txHash}` : undefined;

  return (
    <section className="certificate doc" aria-label="Certificate of filing">
      <header className="section-head">
        <span className="roman">V.</span>
        <h3>Certificate of Filing</h3>
        <span className="section-rule" />
      </header>
      <div className="doc-sheet cert-sheet">
        <div className="cert-seal">
          <WaxSeal size={128} label={filed.onChain ? "ON-CHAIN" : "SEALED"} />
        </div>
        <div className="cert-body">
          <p className="cert-text">
            I hereby certify that the foregoing transcript (exhibits, arguments, opinion and sentencing worksheet) bears the
            keccak256 digest below, and that{" "}
            {filed.onChain ? (
              <>
                it was entered into the public record as <b>Case No. {String(filed.caseNumber ?? "pending").padStart(4, "0")}</b>
                {filed.blockNumber ? (
                  <>
                    {" "}
                    at block <b>#{filed.blockNumber}</b>
                  </>
                ) : null}{" "}
                of chain <b>{filed.chainId ?? chain?.chainId}</b>.
              </>
            ) : (
              <>it was sealed off-chain. {filed.note}</>
            )}
          </p>
          <dl className="cert-grid">
            <dt>Transcript digest</dt>
            <dd className="mono" title={filed.transcriptHash}>
              {filed.transcriptHash}
            </dd>
            {filed.evidenceHash && filed.evidenceHash !== "0x" && (
              <>
                <dt>Evidence digest</dt>
                <dd className="mono">{short(filed.evidenceHash, 18)}</dd>
              </>
            )}
            {filed.txHash && (
              <>
                <dt>Filing transaction</dt>
                <dd className="mono">{explorerTx ? <a href={explorerTx} target="_blank" rel="noreferrer">{short(filed.txHash, 18)}</a> : short(filed.txHash, 18)}</dd>
              </>
            )}
            {(filed.address || chain?.address) && (
              <>
                <dt>CourtRecord</dt>
                <dd className="mono">{short(filed.address ?? chain?.address, 14)}</dd>
              </>
            )}
            {filed.note && filed.onChain && (
              <>
                <dt>Note</dt>
                <dd>{filed.note}</dd>
              </>
            )}
          </dl>
          {filed.onChain && transcript && (
            <div className="cert-actions">
              <button type="button" className="btn btn-ink" onClick={() => verify(false)} disabled={check.kind === "checking"}>
                Verify certified copy
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => verify(true)} disabled={check.kind === "checking"}>
                Tamper test: alter one word
              </button>
            </div>
          )}
          {check.kind === "checking" && <p className="cert-result">Recomputing the digest in your browser…</p>}
          {check.kind === "error" && <p className="cert-result err">{check.message}</p>}
          {(check.kind === "match" || check.kind === "mismatch") && (
            <div className="cert-result">
              <Stamp tone={check.kind === "match" ? "seal" : "bear"} size="md" stampKey={`${check.kind}-${check.computed}`} angle={-4}>
                {check.kind === "match" ? "Certified True Copy" : check.tampered ? "Forgery Detected" : "Does Not Match"}
              </Stamp>
              <dl className="cert-compare">
                <dt>Recomputed here</dt>
                <dd className={`mono ${check.kind === "match" ? "ok" : "bad"}`}>{check.computed}</dd>
                <dt>On-chain</dt>
                <dd className="mono">{check.onChain}</dd>
              </dl>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
