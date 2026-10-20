import type { CSSProperties, ReactNode } from "react";
import { fonts, ink } from "../theme.ts";

/** A manila evidence tag with its punched hole and string, as on the courtroom's shelf. */
export function ExhibitTag({
  id,
  title,
  children,
  width = 520,
  height = 290,
  lit = 0,
  style,
}: {
  id: string;
  title: string;
  children?: ReactNode;
  width?: number;
  height?: number;
  /** 0–1: how strongly the tag is singled out (lifted, outlined). */
  lit?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        width,
        height,
        borderRadius: "8px 8px 10px 10px",
        background: `linear-gradient(170deg, #f0dca8 0%, ${ink.manila} 45%, #dcc285 100%)`,
        boxShadow: `0 ${18 + lit * 22}px ${40 + lit * 30}px -22px rgba(70,45,10,${0.55 + lit * 0.25}), 0 2px 6px -2px rgba(70,45,10,0.25), inset 0 0 0 ${lit * 4}px ${ink.bear}`,
        color: ink.manilaInk,
        padding: "22px 26px",
        boxSizing: "border-box",
        clipPath: "polygon(0 22px, 22px 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 0 100%)",
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: "50%", top: 12, width: 16, height: 16, marginLeft: -8, borderRadius: 8, background: ink.paper, boxShadow: "inset 0 2px 3px rgba(0,0,0,0.35)", border: `2px solid ${ink.manila2}` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontFamily: fonts.stamp, fontWeight: 800, fontSize: 22, letterSpacing: 4 }}>EXHIBIT</div>
          <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 32, color: ink.ink, marginTop: 8 }}>{title}</div>
        </div>
        <div style={{ fontFamily: fonts.stamp, fontWeight: 900, fontSize: 92, lineHeight: 0.8, color: ink.bear, opacity: 0.9 }}>{id}</div>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}
