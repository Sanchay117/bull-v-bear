import { interpolate, random, useCurrentFrame } from "remotion";
import { caseNo, filed, hash, ruling, sentence, trial } from "../data.ts";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { WaxSeal } from "../ui/emblems.tsx";
import { clamp, easeInOut, money, Paper, ramp, SectionHead, Stamp, usePop } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

/** Canonical JSON (sorted keys), the form the court hashes. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}
const CANON = canonical(trial);

const DOCS = [
  { title: "Exhibits A–F", sub: "CoinGecko · Fear & Greed" },
  { title: "Arguments ×4", sub: "openings and rebuttals" },
  { title: "Opinion & Order", sub: "findings, opinion, dissent" },
  { title: "Sentencing Worksheet", sub: "§1 – §7, with formulas" },
];

// The docket after this trial, as the courtroom showed it (Case No. 0004 filed, 0003 settled).
const DOCKET = [
  { no: "0004", verdict: "SHORT", conv: 70, entry: 2380.18, result: "open" },
  { no: "0003", verdict: "SHORT", conv: 70, entry: 2382.23, result: "+0.00%" },
  { no: "0002", verdict: "SHORT", conv: 65, entry: 2378.17, result: "−0.01%" },
  { no: "0001", verdict: "SHORT", conv: 80, entry: 2383.68, result: "+0.04%" },
];

export function Filing({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const tTranscript = cue(shot, "transcript", 0, 100);
  const tCanon = cue(shot, "canonicalized", 0, 128);
  const tHashed = cue(shot, "hashed", 0, 170);
  const tKeccak = cue(shot, "keccak256", 0, 188);
  const tChain = cue(shot, "on-chain", 0, 310);
  const tRecord = cue(shot, "courtrecord", 0, 344);
  const tNext = cue(shot, "next", 0, 414);
  const tSettles = cue(shot, "settles", 0, 435);
  const tWinLoss = cue(shot, "win-loss", 0, 520);

  // Left: documents → one transcript → canonical JSON → digest.
  const stack = ramp(frame, tTranscript - 6, 18, easeInOut);
  const json = ramp(frame, tCanon - 4, 14);
  const squeeze = ramp(frame, tHashed - 4, 16, easeInOut);
  const reveal = interpolate(frame, [tKeccak, tKeccak + 30], [0, hash.length], clamp);
  const digest = hash
    .split("")
    .map((c, i) => (i < 2 || i < reveal ? c : "0123456789abcdef"[Math.floor(random(`h${i}-${Math.floor(frame / 2)}`) * 16)]))
    .join("");
  const hashIn = ramp(frame, tHashed + 4, 12);

  // Right: the chain and the docket.
  const chain = ramp(frame, tChain - 14, 22, easeInOut);
  const tx = interpolate(frame, [tRecord - 6, tRecord + 16], [0, 1], { ...clamp, easing: easeInOut });
  const docket = ramp(frame, tNext - 8, 16);
  const settled = ramp(frame, tSettles, 10);
  const score = ramp(frame, tWinLoss - 6, 14);
  const seal = usePop(tWinLoss + 4, 12, 160);

  const block = (n: number, i: number, hot: boolean) => (
    <div
      key={n}
      style={{
        width: 180,
        height: 150,
        borderRadius: 10,
        border: `3px solid ${hot ? ink.bear : ink.ink2}`,
        background: hot ? ink.paper2 : ink.paper3,
        padding: "12px 14px",
        boxSizing: "border-box",
        fontFamily: fonts.mono,
        fontSize: 16,
        color: ink.ink2,
        opacity: chain,
        transform: `translateX(${(1 - chain) * (200 + i * 60)}px)`,
        boxShadow: hot ? `0 0 0 ${6 * tx}px rgba(141,32,23,0.15)` : "none",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 20, color: hot ? ink.bear : ink.ink }}>Block #{n}</div>
      <div style={{ marginTop: 8, opacity: 0.7 }}>{hot ? "CourtRecord" : "…"}</div>
      <div style={{ opacity: 0.7 }}>{hot ? ".onReport()" : "…"}</div>
      {hot && <div style={{ marginTop: 8, color: ink.bear, fontWeight: 700, opacity: tx }}>Case {caseNo}</div>}
    </div>
  );

  return (
    <Paper>
      <SectionHead roman="V." title="Filing" at={2} note="Certificate of filing" />

      {/* Documents of the case, stacking into one transcript */}
      <div style={{ position: "absolute", left: 110, top: 190, width: 800, height: 700, opacity: 1 - json }}>
        {DOCS.map((d, i) => {
          const t = ramp(frame, 8 + i * 7, 16);
          const fanX = (i % 2) * 400;
          const fanY = Math.floor(i / 2) * 250;
          const x = interpolate(stack, [0, 1], [fanX, 200 + i * 6]);
          const yy = interpolate(stack, [0, 1], [fanY, 120 + i * 8]);
          return (
            <div
              key={d.title}
              style={{
                position: "absolute",
                left: x,
                top: yy,
                width: 380,
                height: 220,
                background: ink.paper2,
                boxShadow: "0 18px 40px -22px rgba(70,45,10,0.55), 0 2px 6px -2px rgba(70,45,10,0.18)",
                padding: "22px 26px",
                boxSizing: "border-box",
                opacity: t,
                transform: `rotate(${(i - 1.5) * 2 * (1 - stack) + (i - 1.5) * 1.2}deg) translateY(${(1 - t) * 40}px)`,
                backgroundImage: `repeating-linear-gradient(180deg, transparent 0 31px, ${ink.rule}77 31px 32px)`,
              }}
            >
              <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 32 }}>{d.title}</div>
              <div style={{ fontFamily: fonts.body, fontStyle: "italic", fontSize: 22, color: ink.soft, marginTop: 6 }}>{d.sub}</div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 210, top: 380, fontFamily: fonts.stamp, fontWeight: 900, fontSize: 46, letterSpacing: 6, color: ink.bear, opacity: stack }}>THE TRANSCRIPT</div>
      </div>

      {/* Canonical JSON, squeezed into its digest */}
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 200,
          width: 800,
          height: interpolate(squeeze, [0, 1], [520, 96]),
          overflow: "hidden",
          borderRadius: 12,
          background: ink.ink,
          color: "#d8cdb4",
          padding: "20px 26px",
          boxSizing: "border-box",
          opacity: json * (1 - ramp(frame, tHashed + 8, 10)),
          transform: `scaleX(${1 - squeeze * 0.04})`,
        }}
      >
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 16, letterSpacing: 4, color: ink.brassHi }}>CANONICAL JSON · SORTED KEYS</div>
        <div style={{ marginTop: 12, fontFamily: fonts.mono, fontSize: 17, lineHeight: 1.45, wordBreak: "break-all", transform: `translateY(${-Math.max(0, frame - tCanon) * 2.2}px)`, opacity: 1 - squeeze }}>
          {CANON.slice(0, 2600)}
        </div>
      </div>
      <div style={{ position: "absolute", left: 110, top: interpolate(hashIn, [0, 1], [300, 240]), width: 800, opacity: hashIn }}>
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 20, letterSpacing: 4, color: ink.soft }}>keccak256( transcript )</div>
        <div style={{ marginTop: 10, fontFamily: fonts.mono, fontWeight: 700, fontSize: 31, lineHeight: 1.35, color: ink.bear, wordBreak: "break-all" }}>{digest}</div>
        <div style={{ marginTop: 18, fontFamily: fonts.body, fontStyle: "italic", fontSize: 24, color: ink.ink2 }}>Change one word of the transcript and every character changes.</div>
      </div>

      {/* The order that goes on-chain */}
      <div
        style={{
          position: "absolute",
          left: interpolate(tx, [0, 1], [110, 1030]),
          top: interpolate(tx, [0, 1], [520, 450]),
          width: 640,
          padding: "18px 24px",
          borderRadius: 12,
          border: `2px dashed ${ink.ink2}`,
          background: ink.paper2,
          fontFamily: fonts.mono,
          fontSize: 19,
          lineHeight: 1.5,
          color: ink.ink2,
          opacity: ramp(frame, tChain - 4, 12) * (1 - ramp(frame, tNext - 12, 10)),
          transform: `scale(${1 + tx * 0.12})`,
          transformOrigin: "left top",
        }}
      >
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 16, letterSpacing: 4, color: ink.soft }}>SIGNED REPORT → CourtRecord.onReport</div>
        <div>
          asset <b>ETH</b> · verdict <b style={{ color: ink.bear }}>{ruling.verdict}</b> · conviction <b>{ruling.conviction}</b> · size <b>{sentence.sizeBps} bps</b>
        </div>
        <div>
          entry <b>{money(sentence.entryPrice)}</b> · stop <b>{money(sentence.stopPrice)}</b> · target <b>{money(sentence.targetPrice)}</b>
        </div>
        <div>
          transcriptHash <b style={{ color: ink.bear }}>{hash.slice(0, 18)}…{hash.slice(-6)}</b>
        </div>
      </div>

      {/* The chain */}
      <div style={{ position: "absolute", left: 1030, top: 210, display: "flex", alignItems: "center", opacity: 1 - docket }}>
        {[filed.filing.blockNumber - 2, filed.filing.blockNumber - 1, filed.filing.blockNumber].map((n, i) => (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && <div style={{ width: 34, height: 4, background: ink.ink2, opacity: chain }} />}
            {block(n, i, i === 2)}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 1030, top: 380, fontFamily: fonts.body, fontStyle: "italic", fontSize: 22, color: ink.soft, opacity: chain * (1 - docket) }}>
        Local chain {filed.filing.chainId} in the courtroom · Sepolia from the CRE workflow
      </div>

      {/* The docket */}
      <div style={{ position: "absolute", left: 1000, top: 196, width: 810, opacity: docket, transform: `translateY(${(1 - docket) * 20}px)` }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 40 }}>The Docket</div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "90px 130px 90px 1fr 150px", padding: "10px 16px", background: ink.ink, color: ink.paper2, fontFamily: fonts.body, fontWeight: 600, fontSize: 16, letterSpacing: 3 }}>
          <span>NO.</span>
          <span>RULING</span>
          <span>CONV.</span>
          <span>ENTRY</span>
          <span style={{ textAlign: "right" }}>DAMAGES</span>
        </div>
        {DOCKET.map((r, i) => {
          const isNew = i === 0;
          const t = isNew ? ramp(frame, tSettles - 10, 12) : 1;
          const result = i === 1 ? (settled > 0.5 ? r.result : "open") : r.result;
          return (
            <div
              key={r.no}
              style={{
                display: "grid",
                gridTemplateColumns: "90px 130px 90px 1fr 150px",
                alignItems: "center",
                padding: "14px 16px",
                borderBottom: `1px solid ${ink.rule}`,
                background: isNew ? `rgba(141,32,23,${0.07 * t})` : ink.paper2,
                fontFamily: fonts.mono,
                fontSize: 22,
                opacity: t,
                height: 60 * (isNew ? t : 1),
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <span>{r.no}</span>
              <span style={{ fontFamily: fonts.stamp, fontWeight: 800, fontSize: 22, letterSpacing: 2, color: ink.bear }}>{r.verdict}</span>
              <span>{r.conv}</span>
              <span>{money(r.entry)}</span>
              <span style={{ textAlign: "right", fontWeight: 700, color: result.startsWith("+") ? ink.bull : result.startsWith("−") ? ink.bear : ink.soft }}>
                {result}
                {i === 1 && settled > 0.5 && (
                  <span style={{ marginLeft: 10, fontFamily: fonts.stamp, fontSize: 16, letterSpacing: 2, padding: "1px 6px", border: `2px solid ${ink.bull}`, color: ink.bull }}>SETTLED</span>
                )}
              </span>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 40, marginTop: 24, alignItems: "baseline", opacity: score, transform: `translateY(${(1 - score) * 12}px)` }}>
          <span style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 52, color: ink.bull }}>Won 3</span>
          <span style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 52, color: ink.bear }}>Lost 1</span>
          <span style={{ fontFamily: fonts.mono, fontSize: 26, color: ink.ink2 }}>practice equity 100.07%</span>
        </div>
      </div>

      <div style={{ position: "absolute", left: 640, top: 600, opacity: Math.min(1, seal * 1.5), transform: `scale(${2.2 - 1.2 * seal}) rotate(${-12 + 4 * seal}deg)` }}>
        <WaxSeal size={200} label="ON-CHAIN" />
      </div>
      {frame >= tWinLoss + 4 && (
        <div style={{ position: "absolute", left: 160, top: 640 }}>
          <Stamp at={tWinLoss + 10} size={40} angle={-5} color={ink.bear}>
            {`Case No. ${caseNo} · Filed`}
          </Stamp>
        </div>
      )}

      <Sfx name="paper" at={8} volume={0.35} />
      <Sfx name="paper" at={22} volume={0.35} />
      <Sfx name="whoosh" at={tHashed - 4} volume={0.3} />
      <Sfx name="thud" at={tKeccak + 30} volume={0.6} />
      <Sfx name="whoosh" at={tRecord - 6} volume={0.3} />
      <Sfx name="tick" at={tSettles} volume={0.5} />
      <Sfx name="stamp" at={tWinLoss + 6} volume={0.8} />
    </Paper>
  );
}
