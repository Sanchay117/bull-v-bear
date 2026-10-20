// The courtroom's engraved marks (web/src/components/Emblems.tsx), driven by props instead of
// CSS animation so every frame renders deterministically.

import { ink } from "../theme.ts";

export function BullMark({ size = 40, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 25C12 26 5 20 6 9c3 7 8 10 15 10" />
      <path d="M43 25c9 1 16-5 15-16-3 7-8 10-15 10" />
      <path d="M21 22c3-4 19-4 22 0l-2 21c-1 8-17 8-18 0z" />
      <path d="M17 24l5 4M47 24l-5 4" />
      <circle cx="27" cy="30" r="1.6" fill={color} stroke="none" />
      <circle cx="37" cy="30" r="1.6" fill={color} stroke="none" />
      <path d="M26 44c3 3 9 3 12 0" />
      <path d="M28.5 40.5v.5M35.5 40.5v.5" strokeWidth="3" />
      <path d="M29 48c0 4 6 4 6 0" strokeWidth="1.8" />
    </svg>
  );
}

export function BearMark({ size = 40, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="17" r="7" />
      <circle cx="16" cy="17" r="2.6" />
      <circle cx="48" cy="17" r="7" />
      <circle cx="48" cy="17" r="2.6" />
      <path d="M12 33c0-14 40-14 40 0 0 13-9 21-20 21S12 46 12 33z" />
      <circle cx="24.5" cy="31" r="1.7" fill={color} stroke="none" />
      <circle cx="39.5" cy="31" r="1.7" fill={color} stroke="none" />
      <ellipse cx="32" cy="42" rx="8.5" ry="6.5" />
      <path d="M29 38.5h6l-3 3z" fill={color} />
      <path d="M32 41.5v3M28.5 46c2 1.5 5 1.5 7 0" strokeWidth="1.8" />
    </svg>
  );
}

/** A gavel drawn head-up, pivoting about the end of its handle (bottom right). */
export function Gavel({ size = 300, color = ink.wood3 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <linearGradient id="gavel-wood" x1="0" x2="1">
          <stop offset="0" stopColor="#6b4527" />
          <stop offset="0.5" stopColor="#8a5a33" />
          <stop offset="1" stopColor="#4a2e1b" />
        </linearGradient>
      </defs>
      <g transform="rotate(-45 100 100)">
        <rect x="93" y="70" width="14" height="128" rx="7" fill="url(#gavel-wood)" stroke={color} strokeWidth="2" />
        <rect x="52" y="22" width="96" height="52" rx="10" fill="url(#gavel-wood)" stroke={color} strokeWidth="2.5" />
        <rect x="46" y="28" width="10" height="40" rx="4" fill={ink.brass} stroke={ink.brassLo} strokeWidth="1.5" />
        <rect x="144" y="28" width="10" height="40" rx="4" fill={ink.brass} stroke={ink.brassLo} strokeWidth="1.5" />
      </g>
    </svg>
  );
}

/** The circular seal of the Court; `turn` rotates the legend, `draw` (0–1) inks the rings. */
export function CourtSeal({ size = 132, turn = 0, draw = 1, color = "currentColor" }: { size?: number; turn?: number; draw?: number; color?: string }) {
  const ring = (r: number) => 2 * Math.PI * r;
  const dash = (r: number) => ({ strokeDasharray: ring(r), strokeDashoffset: ring(r) * (1 - draw) });
  return (
    <svg width={size} height={size} viewBox="0 0 200 200">
      <defs>
        <path id="film-seal-ring" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
      </defs>
      <circle cx="100" cy="100" r="97" fill="none" stroke={color} strokeWidth="2.5" style={dash(97)} />
      <circle cx="100" cy="100" r="92" fill="none" stroke={color} strokeWidth="0.8" style={dash(92)} />
      <circle cx="100" cy="100" r="68" fill="none" stroke={color} strokeWidth="1.6" style={dash(68)} />
      <circle cx="100" cy="100" r="64" fill="none" stroke={color} strokeWidth="0.6" strokeDasharray="1.5 3" opacity={draw} />
      <g transform={`rotate(${turn} 100 100)`} opacity={Math.min(1, draw * 1.4)}>
        <text fontFamily="'Playfair Display', serif" fontWeight="900" fontSize="12" fill={color}>
          <textPath href="#film-seal-ring" startOffset="0" textLength="500" lengthAdjust="spacing">
            COURT OF MARKET OPINION ✦ PRACTICE DIVISION ✦ MMXXVI ✦
          </textPath>
        </text>
      </g>
      <g transform="translate(100 98)" stroke={color} fill="none" strokeWidth="2.2" strokeLinecap="round" opacity={Math.min(1, draw * 1.2)}>
        <path d="M0 -40 V30" />
        <path d="M-34 -28 H34" />
        <circle cx="0" cy="-44" r="4" fill={color} />
        <path d="M-34 -28 l-12 26 M-34 -28 l12 26 M34 -28 l-12 26 M34 -28 l12 26" strokeWidth="1" />
        <path d="M-48 -2 a14 7 0 0 0 28 0z M20 -2 a14 7 0 0 0 28 0z" fill={color} fillOpacity="0.15" />
        <path d="M-16 34 H16 M-22 40 H22" strokeWidth="3" />
      </g>
      <text x="69" y="104" textAnchor="middle" fontSize="11" fontWeight="900" fill={color} fontFamily="'Playfair Display', serif" opacity={draw}>
        B
      </text>
      <text x="131" y="104" textAnchor="middle" fontSize="11" fontWeight="900" fill={color} fontFamily="'Playfair Display', serif" opacity={draw}>
        B
      </text>
    </svg>
  );
}

/** Wax seal pressed onto the certificate of filing. */
export function WaxSeal({ size = 120, label = "FILED" }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <defs>
        <radialGradient id="film-wax" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor={ink.waxHi} />
          <stop offset="60%" stopColor={ink.wax} />
          <stop offset="100%" stopColor={ink.waxLo} />
        </radialGradient>
      </defs>
      <path
        fill="url(#film-wax)"
        d="M60 4c8 0 10 6 17 8s14-1 18 5-1 12 2 18 10 8 9 16-8 9-9 16 6 13 0 18-12 1-17 5-5 12-12 13-10-5-17-5-12 7-18 3-3-12-8-16-14-2-16-9 5-11 3-18-9-10-6-17 10-6 13-12-1-13 5-17 13 0 18-4 8-8 16-8z"
      />
      <circle cx="60" cy="60" r="34" fill="none" stroke={ink.waxLo} strokeWidth="2.5" opacity="0.7" />
      <circle cx="60" cy="60" r="29" fill="none" stroke={ink.waxHi} strokeWidth="1" opacity="0.5" strokeDasharray="2 3" />
      <text x="60" y="56" textAnchor="middle" fontFamily="'Playfair Display', serif" fontStyle="italic" fontWeight="900" fontSize="20" fill={ink.waxLo}>
        B·v·B
      </text>
      <text x="60" y="74" textAnchor="middle" fontFamily="'Big Shoulders Stencil', sans-serif" fontWeight="800" fontSize="11" letterSpacing="2.5" fill={ink.waxLo}>
        {label}
      </text>
    </svg>
  );
}

/** An exhibit weighed on a pan: `drop` 0–1 brings it down from above. */
export interface Load {
  label: string;
  weight: number;
  drop: number;
  color: string;
}

/** The bench's scales at a given beam angle in degrees (positive sinks the Bear's pan). */
export function Scales({ angle, width = 420, loads }: { angle: number; width?: number; loads?: { BULL: Load[]; BEAR: Load[] } }) {
  const L = 128;
  const cx = 160;
  const cy = 64;
  const rad = (angle * Math.PI) / 180;
  const left = { x: cx - L * Math.cos(rad), y: cy - L * Math.sin(rad) };
  const right = { x: cx + L * Math.cos(rad), y: cy + L * Math.sin(rad) };
  const pan = (x: number, y: number, side: "BULL" | "BEAR") => {
    let stack = 0;
    return (
      <g transform={`translate(${x} ${y})`}>
        <path d="M0 0 L-38 74 M0 0 L38 74 M0 0 L0 70" stroke={ink.brassHi} strokeWidth="1.2" fill="none" opacity="0.8" />
        {!loads?.[side].some((l) => l.drop > 0) && (
          <g transform="translate(-17 42)">{side === "BULL" ? <BullMark size={34} color={ink.brassHi} /> : <BearMark size={34} color={ink.brassHi} />}</g>
        )}
        {loads?.[side].map((l, i) => {
          const h = 10 + l.weight * 5;
          const w = 26 + l.weight * 6;
          const restY = 74 - stack - h;
          stack += l.drop >= 1 ? h + 1 : 0;
          const xOff = ((i % 2 ? 1 : -1) * (i * 3)) % 14;
          return (
            <g key={l.label} transform={`translate(${xOff - w / 2} ${restY - (1 - l.drop) * 120})`} opacity={Math.min(1, l.drop * 3)}>
              <rect width={w} height={h} rx="2" fill={ink.manila} stroke={l.color} strokeWidth="1.6" />
              <text x={w / 2} y={h / 2 + 4.5} textAnchor="middle" fontFamily="'Big Shoulders Stencil', sans-serif" fontWeight="900" fontSize="13" fill={l.color}>
                {l.label}
              </text>
            </g>
          );
        })}
        <path d="M-46 74 Q0 106 46 74 Z" fill={ink.brass} stroke={ink.brassLo} strokeWidth="2" />
      </g>
    );
  };
  return (
    <svg viewBox="0 0 320 300" width={width} height={(width * 300) / 320} style={{ overflow: "visible" }}>
      <path d="M160 64 V262" stroke={ink.brass} strokeWidth="7" strokeLinecap="round" />
      <path d="M118 286 h84 l-12 -24 h-60 z" fill={ink.brass} stroke={ink.brassLo} strokeWidth="2" />
      <line x1={left.x} y1={left.y} x2={right.x} y2={right.y} stroke={ink.brassHi} strokeWidth="6" strokeLinecap="round" />
      <circle cx={left.x} cy={left.y} r="4" fill={ink.brassHi} />
      <circle cx={right.x} cy={right.y} r="4" fill={ink.brassHi} />
      <path d={`M${cx - 10} ${cy + 8} L${cx} ${cy - 22} L${cx + 10} ${cy + 8} Z`} fill={ink.brassHi} transform={`rotate(${angle} ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r="9" fill={ink.brass} stroke={ink.brassLo} strokeWidth="2" />
      <circle cx={cx} cy={cy - 40} r="7" fill={ink.brassHi} />
      {pan(left.x, left.y, "BULL")}
      {pan(right.x, right.y, "BEAR")}
    </svg>
  );
}
