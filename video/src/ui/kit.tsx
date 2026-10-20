import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fonts, ink } from "../theme.ts";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 over `dur` frames starting at `at`, eased. */
export function ramp(frame: number, at: number, dur = 18, easing = easeOut) {
  return interpolate(frame, [at, at + dur], [0, 1], { ...clamp, easing });
}

/** A physical pop-in, 0→1 with a little overshoot. */
export function usePop(at: number, damping = 13, stiffness = 140) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - at, fps, config: { damping, stiffness, mass: 0.9 } });
}

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .25  0 0 0 0 .1  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Legal paper (day) or walnut chambers (night), with film grain and a soft vignette. */
export function Paper({ night = false, children, style }: { night?: boolean; children?: ReactNode; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  // Shift the grain a little every other frame so the paper feels filmed, not flat.
  const jitter = Math.floor(frame / 2) % 4;
  return (
    <AbsoluteFill
      style={{
        background: night ? ink.night : ink.paper,
        backgroundImage: night
          ? "radial-gradient(ellipse at 50% -10%, rgba(255,190,110,0.10), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.6), transparent 55%)"
          : "radial-gradient(ellipse at 50% -10%, rgba(255,250,235,0.65), transparent 60%), radial-gradient(ellipse at 50% 120%, rgba(90,60,20,0.16), transparent 55%)",
        color: night ? ink.nightInk : ink.ink,
        fontFamily: fonts.body,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          backgroundImage: GRAIN,
          backgroundPosition: `${jitter * 37}px ${jitter * 53}px`,
          opacity: night ? 0.16 : 0.3,
          mixBlendMode: night ? "screen" : "multiply",
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: night
            ? "radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)"
            : "radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(70,45,10,0.22) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}

/** "I. Discovery" — roman numeral, title, and a rule that draws across. */
export function SectionHead({ roman, title, at = 0, night = false, note }: { roman: string; title: string; at?: number; night?: boolean; note?: string }) {
  const frame = useCurrentFrame();
  const t = ramp(frame, at, 22);
  const rule = ramp(frame, at + 6, 40, easeInOut);
  return (
    <div style={{ position: "absolute", left: 120, right: 120, top: 78, display: "flex", alignItems: "center", gap: 22, opacity: t, transform: `translateY(${(1 - t) * 18}px)` }}>
      <span style={{ fontFamily: fonts.display, fontStyle: "italic", fontWeight: 900, fontSize: 52, color: night ? ink.nightBear : ink.bear }}>{roman}</span>
      <span style={{ fontFamily: fonts.display, fontWeight: 900, fontSize: 52, letterSpacing: -0.5 }}>{title}</span>
      <span style={{ flex: 1, height: 2, background: night ? ink.nightSoft : ink.ink2, opacity: 0.6, transformOrigin: "left", transform: `scaleX(${rule})` }} />
      {note && <span style={{ fontFamily: fonts.body, fontStyle: "italic", fontSize: 24, color: night ? ink.nightSoft : ink.soft, opacity: rule }}>{note}</span>}
    </div>
  );
}

/** A rubber stamp that slams onto the page at `at`. */
export function Stamp({
  at,
  children,
  color = ink.bear,
  angle = -8,
  size = 64,
  sub,
  style,
}: {
  at: number;
  children: ReactNode;
  color?: string;
  angle?: number;
  size?: number;
  sub?: ReactNode;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const local = frame - at;
  if (local < 0) return null;
  const drop = interpolate(local, [0, 5], [2.4, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const settle = interpolate(local, [5, 9, 13], [1, 0.97, 1], clamp);
  const fade = interpolate(local, [0, 3], [0, 1], clamp);
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${size * 0.16}px ${size * 0.4}px`,
        border: `${Math.max(3, size * 0.07)}px solid ${color}`,
        borderRadius: size * 0.12,
        color,
        fontFamily: fonts.stamp,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: size * 0.04,
        textTransform: "uppercase",
        transform: `rotate(${angle}deg) scale(${local < 5 ? drop : settle})`,
        opacity: fade * 0.92,
        mixBlendMode: "multiply",
        boxShadow: `inset 0 0 0 ${Math.max(1, size * 0.03)}px ${color}33`,
        maskImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='r'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.9'/></filter><rect width='100%' height='100%' filter='url(%23r)'/></svg>\")",
        ...style,
      }}
    >
      <span>{children}</span>
      {sub && <span style={{ fontSize: size * 0.32, letterSpacing: size * 0.06, marginTop: size * 0.12, fontWeight: 800 }}>{sub}</span>}
    </div>
  );
}

/** A boxed exhibit citation, as the courtroom renders "[Ex. B]". */
export function Cite({ letters, color, lit = 1, size = 22 }: { letters: string[]; color: string; lit?: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, margin: "0 4px", verticalAlign: "middle" }}>
      <span style={{ fontFamily: fonts.mono, fontSize: size * 0.72, opacity: 0.75 }}>Ex.</span>
      {letters.map((l) => (
        <span
          key={l}
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: size * 1.05,
            height: size * 1.15,
            border: `2px solid ${color}`,
            borderRadius: 3,
            fontFamily: fonts.mono,
            fontWeight: 700,
            fontSize: size * 0.82,
            color: lit > 0.5 ? ink.paper2 : color,
            background: lit > 0.5 ? color : "transparent",
            transform: `scale(${1 + (lit > 0 && lit < 1 ? 0.25 * Math.sin(lit * Math.PI) : 0)})`,
          }}
        >
          {l}
        </span>
      ))}
    </span>
  );
}

export function Eyebrow({ children, color = ink.bear, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color, ...style }}>{children}</div>
  );
}

export const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
