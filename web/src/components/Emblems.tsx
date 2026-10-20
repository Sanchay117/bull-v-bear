// Engraved-style marks for the parties and the court. All strokes use currentColor so the
// parent decides the ink.

export function BullMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 25C12 26 5 20 6 9c3 7 8 10 15 10" />
      <path d="M43 25c9 1 16-5 15-16-3 7-8 10-15 10" />
      <path d="M21 22c3-4 19-4 22 0l-2 21c-1 8-17 8-18 0z" />
      <path d="M17 24l5 4M47 24l-5 4" />
      <circle cx="27" cy="30" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="37" cy="30" r="1.6" fill="currentColor" stroke="none" />
      <path d="M26 44c3 3 9 3 12 0" />
      <path d="M28.5 40.5v.5M35.5 40.5v.5" strokeWidth="3" />
      <path d="M29 48c0 4 6 4 6 0" strokeWidth="1.8" />
    </svg>
  );
}

export function BearMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="16" cy="17" r="7" />
      <circle cx="16" cy="17" r="2.6" />
      <circle cx="48" cy="17" r="7" />
      <circle cx="48" cy="17" r="2.6" />
      <path d="M12 33c0-14 40-14 40 0 0 13-9 21-20 21S12 46 12 33z" />
      <circle cx="24.5" cy="31" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="39.5" cy="31" r="1.7" fill="currentColor" stroke="none" />
      <ellipse cx="32" cy="42" rx="8.5" ry="6.5" />
      <path d="M29 38.5h6l-3 3z" fill="currentColor" />
      <path d="M32 41.5v3M28.5 46c2 1.5 5 1.5 7 0" strokeWidth="1.8" />
    </svg>
  );
}

export function GavelMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <rect x="9" y="3" width="14" height="8" rx="2" transform="rotate(-40 16 7)" />
      <rect x="15" y="11" width="3.2" height="17" rx="1.6" transform="rotate(-40 16 7)" />
      <rect x="3" y="26" width="13" height="3" rx="1.2" />
    </svg>
  );
}

/** The circular seal of the Court with slowly turning legend. */
export function CourtSeal({ size = 132, spin = true }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className="seal" aria-label="Seal of the Court of Market Opinion" role="img">
      <defs>
        <path id="seal-ring" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
      </defs>
      <circle cx="100" cy="100" r="97" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="currentColor" strokeWidth="0.8" />
      <circle cx="100" cy="100" r="68" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="100" cy="100" r="64" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.5 3" />
      <g className={spin ? "seal-ring spin" : "seal-ring"}>
        <text fontFamily="'Playfair Display', serif" fontWeight="900" fontSize="12" fill="currentColor">
          {/* textLength = ring circumference (2π·80 ≈ 502.6), so the legend closes exactly. */}
          <textPath href="#seal-ring" startOffset="0" textLength="500" lengthAdjust="spacing">
            COURT OF MARKET OPINION ✦ PRACTICE DIVISION ✦ MMXXVI ✦
          </textPath>
        </text>
      </g>
      <g transform="translate(100 98)" stroke="currentColor" fill="none" strokeWidth="2.2" strokeLinecap="round">
        <path d="M0 -40 V30" />
        <path d="M-34 -28 H34" />
        <circle cx="0" cy="-44" r="4" fill="currentColor" />
        <path d="M-34 -28 l-12 26 M-34 -28 l12 26 M34 -28 l-12 26 M34 -28 l12 26" strokeWidth="1" />
        <path d="M-48 -2 a14 7 0 0 0 28 0z M20 -2 a14 7 0 0 0 28 0z" fill="currentColor" fillOpacity="0.15" />
        <path d="M-16 34 H16 M-22 40 H22" strokeWidth="3" />
      </g>
      <text x="69" y="104" textAnchor="middle" fontSize="11" fontWeight="900" fill="currentColor" fontFamily="'Playfair Display', serif">B</text>
      <text x="131" y="104" textAnchor="middle" fontSize="11" fontWeight="900" fill="currentColor" fontFamily="'Playfair Display', serif">B</text>
    </svg>
  );
}

/** Wax seal pressed onto the certificate of filing. */
export function WaxSeal({ size = 120, label = "FILED" }: { size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="wax" aria-hidden="true">
      <defs>
        <radialGradient id="wax-g" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="var(--wax-hi)" />
          <stop offset="60%" stopColor="var(--wax)" />
          <stop offset="100%" stopColor="var(--wax-lo)" />
        </radialGradient>
        <filter id="wax-emboss">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="b" />
          <feSpecularLighting in="b" surfaceScale="3" specularConstant="0.6" specularExponent="18" lightingColor="#fff" result="s">
            <fePointLight x="30" y="20" z="60" />
          </feSpecularLighting>
          <feComposite in="s" in2="SourceAlpha" operator="in" result="s2" />
          <feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" />
        </filter>
      </defs>
      <path
        filter="url(#wax-emboss)"
        fill="url(#wax-g)"
        d="M60 4c8 0 10 6 17 8s14-1 18 5-1 12 2 18 10 8 9 16-8 9-9 16 6 13 0 18-12 1-17 5-5 12-12 13-10-5-17-5-12 7-18 3-3-12-8-16-14-2-16-9 5-11 3-18-9-10-6-17 10-6 13-12-1-13 5-17 13 0 18-4 8-8 16-8z"
      />
      <circle cx="60" cy="60" r="34" fill="none" stroke="var(--wax-lo)" strokeWidth="2.5" opacity="0.7" />
      <circle cx="60" cy="60" r="29" fill="none" stroke="var(--wax-hi)" strokeWidth="1" opacity="0.5" strokeDasharray="2 3" />
      <text x="60" y="56" textAnchor="middle" fontFamily="'Playfair Display', serif" fontStyle="italic" fontWeight="900" fontSize="20" fill="var(--wax-lo)">
        B·v·B
      </text>
      <text x="60" y="74" textAnchor="middle" fontFamily="'Big Shoulders Stencil Display', sans-serif" fontWeight="800" fontSize="11" letterSpacing="2.5" fill="var(--wax-lo)">
        {label}
      </text>
    </svg>
  );
}
