import type { ReactNode } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { SceneProps } from "../Film.tsx";
import { cue } from "../plan.ts";
import { fonts, ink } from "../theme.ts";
import { clamp, easeInOut, Paper, ramp, usePop } from "../ui/kit.tsx";
import { Sfx } from "../ui/Sfx.tsx";

const X0 = 120;
const W = 262;
const GAP = 22;
const TOP = 300;
const H = 290;
const cx = (i: number) => X0 + i * (W + GAP) + W / 2;

function Icon({ kind }: { kind: string }) {
  const s = { fill: "none", stroke: ink.linkHi, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, ReactNode> = {
    cron: (
      <>
        <circle cx="20" cy="20" r="14" {...s} />
        <path d="M20 11v9l6 4" {...s} />
      </>
    ),
    http: (
      <>
        <circle cx="20" cy="20" r="14" {...s} />
        <path d="M6 20h28M20 6c-6 8-6 20 0 28M20 6c6 8 6 20 0 28" {...s} />
      </>
    ),
    llm: (
      <>
        <rect x="6" y="9" width="28" height="20" rx="4" {...s} />
        <path d="M13 34l4-5M14 17h12M14 22h8" {...s} />
      </>
    ),
    wasm: (
      <>
        <path d="M8 8h24v24H8z" {...s} />
        <path d="M13 16l3 9 3-6 3 6 3-9" {...s} />
      </>
    ),
    sign: (
      <>
        <path d="M9 30c5-1 6-9 11-9s3 7 7 7 5-4 5-4" {...s} />
        <path d="M24 8l8 8-12 12h-8v-8z" {...s} />
      </>
    ),
    chain: (
      <>
        <rect x="5" y="14" width="13" height="13" rx="2" {...s} />
        <rect x="22" y="14" width="13" height="13" rx="2" {...s} />
        <path d="M18 20.5h4" {...s} />
      </>
    ),
  };
  return (
    <svg width="44" height="44" viewBox="0 0 40 40">
      {paths[kind]}
    </svg>
  );
}

export function Cre({ shot }: SceneProps) {
  const frame = useCurrentFrame();
  const tChainlink = cue(shot, "chainlink", 0, 60);
  const tCron = cue(shot, "cron", 0, 150);
  const tHttp = cue(shot, "http", 0, 210);
  const tEvidence = cue(shot, "evidence", 0, 270);
  const tModel = cue(shot, "model", 0, 315);
  const tConsensus = cue(shot, "consensus", 0, 340);
  const tSentencing = cue(shot, "sentencing", 0, 415);
  const tWasm = cue(shot, "webassembly", 0, 475);
  const tSigned = cue(shot, "signed", 0, 535);
  const tEvm = cue(shot, "evm", 0, 575);
  const tKeystone = cue(shot, "keystone", 0, 640);

  const stations = [
    { at: tCron, icon: "cron", cap: "Cron trigger", title: "Convene the court", body: "every two hours · the asset rotates", api: "CronCapability.trigger" },
    { at: tEvidence - 8, icon: "http", cap: "HTTP · consensus", title: "Discovery", body: "CoinGecko markets · Fear & Greed", api: "HTTPClient.sendRequest" },
    { at: tModel - 8, icon: "llm", cap: "HTTP · consensus", title: "Counsel & bench", body: "2 openings · 2 rebuttals · 1 ruling", api: "identical consensus ×5" },
    { at: tWasm - 12, icon: "wasm", cap: "WASM", title: "Sentencing", body: "guidelines · canonical JSON · keccak256", api: "the clerk's own core/" },
    { at: tSigned - 8, icon: "sign", cap: "Report", title: "Sign the record", body: "ABI-encoded order + transcript hash", api: "runtime.report()" },
    { at: tEvm - 8, icon: "chain", cap: "EVM write", title: "File on Sepolia", body: "Keystone forwarder → CourtRecord", api: "EVMClient.writeReport" },
  ];

  const head = ramp(frame, Math.min(8, tChainlink - 10), 20);
  // The packet rides the wire from one station to the next as each is named.
  const legs = stations.map((s) => s.at + 10);
  let packetX = cx(0);
  for (let i = 1; i < legs.length; i++) {
    if (frame >= legs[i - 1]) packetX = interpolate(frame, [legs[i - 1], legs[i]], [cx(i - 1), cx(i)], { ...clamp, easing: easeInOut });
  }
  const packetOn = ramp(frame, legs[0], 10) * (1 - ramp(frame, tKeystone + 30, 14));

  // Consensus: seven nodes answer, then agree.
  const don = ramp(frame, tConsensus - 14, 16);
  const donX = (cx(1) + cx(2)) / 2;
  const donY = 780;
  const agree = ramp(frame, tConsensus + 34, 12);

  const dest = usePop(tKeystone - 6, 12, 140);

  return (
    <Paper night style={{ background: "#0f0d10" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 30%, rgba(55,91,210,0.20), transparent 60%)" }} />

      <div style={{ position: "absolute", left: 120, top: 78, opacity: head, transform: `translateY(${(1 - head) * 16}px)` }}>
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 20, letterSpacing: 6, color: ink.linkHi }}>THE AUTONOMOUS DOCKET</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 6 }}>
          <svg width="58" height="58" viewBox="0 0 40 40">
            <path d="M20 3l14.7 8.5v17L20 37 5.3 28.5v-17z" fill="none" stroke={ink.link} strokeWidth="4.5" strokeLinejoin="round" />
          </svg>
          <span style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 64, color: ink.nightInk }}>A Chainlink CRE workflow</span>
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: 22, color: ink.nightSoft, marginTop: 8 }}>cre/bull-v-bear/workflow.ts · compiled to WASM · runs on a decentralized oracle network</div>
      </div>

      {/* The wire */}
      <div style={{ position: "absolute", left: cx(0), width: cx(5) - cx(0), top: TOP + H / 2, height: 3, background: "rgba(138,166,255,0.18)" }} />
      <div style={{ position: "absolute", left: cx(0), width: Math.max(0, packetX - cx(0)), top: TOP + H / 2, height: 3, background: ink.link, boxShadow: `0 0 12px ${ink.link}` }} />

      {stations.map((s, i) => {
        const t = popAt(frame, s.at);
        const lit = interpolate(frame, [s.at, s.at + 8, s.at + 40], [0, 1, 0.45], clamp);
        return (
          <div
            key={s.title}
            style={{
              position: "absolute",
              left: X0 + i * (W + GAP),
              top: TOP,
              width: W,
              height: H,
              borderRadius: 14,
              padding: "18px 20px",
              boxSizing: "border-box",
              background: "linear-gradient(180deg, rgba(34,30,38,0.96), rgba(20,18,24,0.96))",
              border: `2px solid rgba(138,166,255,${0.15 + lit * 0.7})`,
              boxShadow: `0 0 ${lit * 40}px rgba(55,91,210,${lit * 0.55}), 0 30px 50px -30px rgba(0,0,0,0.9)`,
              opacity: t,
              transform: `translateY(${(1 - t) * 40}px) scale(${0.9 + 0.1 * t})`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Icon kind={s.icon} />
              <span style={{ fontFamily: fonts.mono, fontSize: 16, color: ink.nightSoft }}>0{i + 1}</span>
            </div>
            <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 15, letterSpacing: 3, textTransform: "uppercase", color: ink.linkHi, marginTop: 12 }}>{s.cap}</div>
            <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 29, color: ink.nightInk, marginTop: 4, lineHeight: 1.1 }}>{s.title}</div>
            <div style={{ fontFamily: fonts.body, fontSize: 19, color: ink.nightSoft, marginTop: 8, lineHeight: 1.3 }}>{s.body}</div>
            <div style={{ position: "absolute", left: 20, right: 16, bottom: 16, fontFamily: fonts.mono, fontSize: 15, color: ink.brassHi, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{s.api}</div>
          </div>
        );
      })}

      {/* Packet */}
      <div
        style={{
          position: "absolute",
          left: packetX - 11,
          top: TOP + H / 2 - 10,
          width: 22,
          height: 22,
          borderRadius: 11,
          background: "#dfe7ff",
          boxShadow: `0 0 18px 6px ${ink.link}`,
          opacity: packetOn,
        }}
      />

      {/* The DON reaching consensus */}
      <div style={{ position: "absolute", left: donX - 240, top: donY - 140, width: 480, height: 280, opacity: don * (1 - ramp(frame, tSentencing + 20, 14)) }}>
        <svg width="480" height="280" viewBox="-240 -140 480 280">
          {Array.from({ length: 7 }, (_, k) => {
            const a = (k / 7) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(a) * 190;
            const y = Math.sin(a) * 100;
            const answered = ramp(frame, tConsensus + k * 4, 8);
            return (
              <g key={k}>
                <line x1={x} y1={y} x2={0} y2={0} stroke={ink.link} strokeWidth={2} opacity={0.25 + agree * 0.6} strokeDasharray="4 5" />
                <circle cx={x} cy={y} r={20} fill="#16151c" stroke={answered > 0.5 ? ink.linkHi : "#3a3d55"} strokeWidth={3} />
                <text x={x} y={y + 6} textAnchor="middle" fontFamily={fonts.mono} fontWeight={700} fontSize={16} fill={answered > 0.5 ? ink.nightBull : ink.nightSoft}>
                  {answered > 0.5 ? "✓" : `n${k + 1}`}
                </text>
              </g>
            );
          })}
          <circle r={44} fill={`rgba(55,91,210,${0.25 + agree * 0.55})`} stroke={ink.linkHi} strokeWidth={2.5} />
          <text y={-2} textAnchor="middle" fontFamily={fonts.stamp} fontWeight={900} fontSize={24} fill="#fff">
            DON
          </text>
          <text y={20} textAnchor="middle" fontFamily={fonts.mono} fontSize={13} fill="#dfe7ff" opacity={agree}>
            identical ✓
          </text>
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: -16, textAlign: "center", fontFamily: fonts.body, fontStyle: "italic", fontSize: 21, color: ink.nightSoft }}>
          one node calls the API · the others read the cached answer and must agree
        </div>
      </div>

      {/* Destination */}
      <div
        style={{
          position: "absolute",
          left: 1160,
          top: 680,
          width: 640,
          padding: "20px 26px",
          borderRadius: 14,
          border: `2px solid ${ink.nightBull}`,
          background: "rgba(124,197,150,0.08)",
          opacity: dest,
          transform: `translateY(${(1 - dest) * 30}px)`,
        }}
      >
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 17, letterSpacing: 4, color: ink.nightBull }}>ETHEREUM SEPOLIA</div>
        <div style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 34, color: ink.nightInk, marginTop: 4 }}>CourtRecord.onReport ✓</div>
        <div style={{ fontFamily: fonts.mono, fontSize: 18, color: ink.nightSoft, marginTop: 8 }}>KeystoneForwarder 0xF834…4482 verifies the DON</div>
        <div style={{ fontFamily: fonts.mono, fontSize: 18, color: ink.nightSoft }}>settles the last position · updates equity</div>
      </div>

      <Sfx name="whoosh" at={tChainlink - 10} volume={0.3} />
      {stations.map((s) => (
        <Sfx key={s.title} name="tick" at={s.at} volume={0.45} />
      ))}
      <Sfx name="chime" at={tConsensus + 34} volume={0.3} />
      <Sfx name="thud" at={tKeystone - 4} volume={0.55} />
    </Paper>
  );
}

/** A spring pop that can be called in a loop (no hooks). */
function popAt(frame: number, at: number) {
  const t = Math.max(0, frame - at) / 30;
  if (frame < at) return 0;
  return 1 - Math.exp(-t * 9) * Math.cos(t * 14);
}
