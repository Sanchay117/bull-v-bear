import type { ReactNode } from "react";

/** A rubber stamp that slams onto the page. Re-mounts (and re-slams) when `stampKey` changes. */
export function Stamp({
  children,
  tone,
  sub,
  stampKey,
  size = "lg",
  angle = -7,
}: {
  children: ReactNode;
  tone: "bull" | "bear" | "neutral" | "seal";
  sub?: ReactNode;
  stampKey?: string;
  size?: "sm" | "md" | "lg";
  angle?: number;
}) {
  return (
    <div key={stampKey} className={`stamp stamp-${tone} stamp-${size}`} style={{ ["--angle" as string]: `${angle}deg` }}>
      <div className="stamp-main">{children}</div>
      {sub && <div className="stamp-sub">{sub}</div>}
    </div>
  );
}
