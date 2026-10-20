import { useCallback, useEffect, useRef, useState } from "react";
import { counselName, type StandingOrders } from "@court/core";
import { api, type Docket, type Status } from "./api.ts";
import { Certificate } from "./components/Certificate.tsx";
import { ExhibitFocus } from "./components/Citations.tsx";
import { Courtroom } from "./components/Courtroom.tsx";
import { DocketLedger } from "./components/DocketLedger.tsx";
import { ExhibitShelf } from "./components/Exhibits.tsx";
import { FilingDesk } from "./components/FilingDesk.tsx";
import { Masthead } from "./components/Masthead.tsx";
import { Opinion } from "./components/Opinion.tsx";
import { AllRise, Procedure } from "./components/Procedure.tsx";
import { SentenceOrder } from "./components/SentenceOrder.tsx";
import { gavel, stamp } from "./sfx.ts";
import { useTrial, type TrialState } from "./useTrial.ts";

function readPref<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) ?? fallback;
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

function Caption({ state, caseNumber }: { state: TrialState; caseNumber?: number }) {
  const opened = state.openedAt ? new Date(state.openedAt) : null;
  return (
    <div className="caption">
      <p className="caption-court">In the Court of Market Opinion</p>
      <p className="caption-div">Practice Division</p>
      <div className="caption-grid">
        <div className="caption-parties">
          <p>
            <b>THE BULL,</b>
          </p>
          <p className="indent">Movant,</p>
          <p className="caption-v">v.</p>
          <p>
            <b>THE BEAR,</b>
          </p>
          <p className="indent">Respondent.</p>
          <p className="caption-re">{state.caption ?? "In re —"}</p>
        </div>
        <div className="caption-parens" aria-hidden="true">
          {")\n)\n)\n)\n)\n)\n)"}
        </div>
        <div className="caption-meta">
          <p>
            Case No. <b>{caseNumber !== undefined && caseNumber >= 0 ? String(caseNumber).padStart(4, "0") : "pending"}</b>
          </p>
          <p className="caption-doc">{state.ruling ? "Opinion and Order" : state.status === "running" ? "Proceedings in Progress" : "Transcript"}</p>
          {opened && (
            <p className="caption-date">
              {opened.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
            </p>
          )}
          {state.replay && <p className="caption-replay">From the record</p>}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState<Status>();
  const [docket, setDocket] = useState<Docket>();
  const [bootError, setBootError] = useState<string>();
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    readPref("bvb-theme", window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  );
  const [sound, setSound] = useState(() => readPref("bvb-sound", "on") === "on");
  const [rising, setRising] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const trialTop = useRef<HTMLDivElement>(null);

  const refreshDocket = useCallback(() => {
    api.docket().then(setDocket).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .status()
      .then(setStatus)
      .catch(() => setBootError("The clerk is not answering. Start the server with `npm run dev` and reload."));
    refreshDocket();
  }, [refreshDocket]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writePref("bvb-theme", theme);
  }, [theme]);
  useEffect(() => writePref("bvb-sound", sound ? "on" : "off"), [sound]);

  const { state, start, replay, reset } = useTrial(refreshDocket);

  useEffect(() => {
    if (state.ruling && !state.replay && sound) stamp();
  }, [state.ruling, state.replay, sound]);

  const file = (asset: string, orders: StandingOrders) => {
    if (sound) gavel(3);
    setRising(true);
    window.setTimeout(() => setRising(false), 2100);
    start(asset, orders);
    window.setTimeout(() => trialTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const open = async (hash: string) => {
    await replay(hash);
    trialTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const judge = `the Hon. ${status ? counselName(status.counsel) : "Demo Counsel"}`;
  const caseNumber = state.filed?.caseNumber;

  return (
    <ExhibitFocus.Provider value={{ focus, setFocus }}>
      <div className="grain" aria-hidden="true" />
      {rising && <AllRise judge={judge} />}
      <Masthead
        status={status}
        docket={docket}
        theme={theme}
        onTheme={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        sound={sound}
        onSound={() => setSound((s) => !s)}
      />
      <main className="page">
        {bootError && <div className="notice err">{bootError}</div>}

        {state.status === "idle" && status && (
          <FilingDesk assets={status.assets} defaults={status.defaults} busy={false} onFile={file} />
        )}

        <div ref={trialTop} className="trial-anchor" />
        {state.status !== "idle" && (
          <article className="trial">
            <div className="trial-top">
              <Caption state={state} caseNumber={caseNumber} />
              <div className="trial-actions">
                <Procedure phase={state.phase} done={state.status === "done"} />
                {state.status !== "running" && (
                  <button type="button" className="btn btn-ink" onClick={reset}>
                    ← File another matter
                  </button>
                )}
              </div>
            </div>

            {state.status === "running" && !state.evidence && (
              <p className="discovery-wait">The clerk is gathering evidence from the market…</p>
            )}
            {state.evidence && (
              <ExhibitShelf exhibits={state.evidence.exhibits} findings={state.ruling?.findings} live={state.status === "running"} />
            )}
            {state.evidence && <Courtroom state={state} />}
            {state.ruling && <Opinion ruling={state.ruling} caption={state.caption ?? ""} judge={judge.replace(/^the/, "The")} />}
            {state.sentence && <SentenceOrder sentence={state.sentence} orders={state.transcript?.standingOrders} />}
            {state.filed && <Certificate filed={state.filed} transcript={state.transcript} chain={status?.chain} />}
            {state.status === "error" && (
              <div className="notice err">
                <b>Mistrial.</b> {state.error}
              </div>
            )}
          </article>
        )}

        <DocketLedger docket={docket} onOpen={open} activeHash={state.transcriptHash} />
      </main>
      <footer className="colophon">
        <p>
          <b>Bull v. Bear</b> · The Court of Market Opinion · Built for the BLI Legal Tech Hackathon 2026
        </p>
        <p>
          Rulings are orchestrated by a Chainlink CRE workflow and filed to <span className="mono">CourtRecord</span>. Every
          position is a practice position. Nothing here is investment advice.
        </p>
      </footer>
    </ExhibitFocus.Provider>
  );
}
