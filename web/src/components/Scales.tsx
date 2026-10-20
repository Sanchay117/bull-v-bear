import { useEffect, useRef, useState } from "react";
import { BearMark, BullMark } from "./Emblems.tsx";

/**
 * The scales of the bench. `tilt` in [-1, 1]: negative sinks the Bull's pan (left), positive the Bear's.
 * While `deliberating`, the beam trembles. Motion is a damped spring so the swing feels physical.
 */
export function Scales({ tilt, deliberating }: { tilt: number; deliberating: boolean }) {
  const [angle, setAngle] = useState(0);
  const sim = useRef({ a: 0, v: 0 });
  const target = useRef(tilt);
  const shaking = useRef(deliberating);
  target.current = tilt;
  shaking.current = deliberating;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = sim.current;
      const wobble = shaking.current && !reduce ? Math.sin(now / 260) * 4 + Math.sin(now / 97) * 1.5 : 0;
      const goal = target.current * 16 + wobble;
      if (reduce) s.a = goal;
      else {
        s.v += ((goal - s.a) * 38 - s.v * 5.5) * dt;
        s.a += s.v * dt;
      }
      setAngle(s.a);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const L = 128;
  const cx = 160;
  const cy = 64;
  const rad = (angle * Math.PI) / 180;
  const left = { x: cx - L * Math.cos(rad), y: cy - L * Math.sin(rad) };
  const right = { x: cx + L * Math.cos(rad), y: cy + L * Math.sin(rad) };

  // Plain function (not a component) so the pans are not remounted on every animation frame.
  const pan = (x: number, y: number, side: "BULL" | "BEAR") => (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 L-38 74 M0 0 L38 74 M0 0 L0 70" className="scales-chain" />
      <path d="M-46 74 Q0 106 46 74 Z" className={`scales-pan pan-${side.toLowerCase()}`} />
      <g transform="translate(-17 42)" className={`pan-mark mark-${side.toLowerCase()}`}>
        {side === "BULL" ? <BullMark size={34} /> : <BearMark size={34} />}
      </g>
    </g>
  );

  return (
    <svg viewBox="0 0 320 300" className="scales" role="img" aria-label={`Scales of the bench, ${tilt < -0.05 ? "tipped toward the Bull" : tilt > 0.05 ? "tipped toward the Bear" : "level"}`}>
      <path d="M160 64 V262" className="scales-pillar" />
      <path d="M118 286 h84 l-12 -24 h-60 z" className="scales-base" />
      <path d="M150 262 h20" className="scales-pillar" />
      <g>
        <line x1={left.x} y1={left.y} x2={right.x} y2={right.y} className="scales-beam" />
        <circle cx={left.x} cy={left.y} r="4" className="scales-knob" />
        <circle cx={right.x} cy={right.y} r="4" className="scales-knob" />
      </g>
      <path d={`M${cx - 10} ${cy + 8} L${cx} ${cy - 22} L${cx + 10} ${cy + 8} Z`} className="scales-needle" transform={`rotate(${angle} ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r="9" className="scales-pivot" />
      <circle cx={cx} cy={cy - 40} r="7" className="scales-finial" />
      {pan(left.x, left.y, "BULL")}
      {pan(right.x, right.y, "BEAR")}
    </svg>
  );
}
