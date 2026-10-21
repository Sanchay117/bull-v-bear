import { fonts, ink } from "./theme.ts";
import { BearMark, BullMark, CourtSeal, WaxSeal } from "./ui/emblems.tsx";
import { Paper, Stamp } from "./ui/kit.tsx";

/** YouTube thumbnail and BUIDL cover, 1280 × 720. */
export function Thumbnail() {
  return (
    <Paper>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 92, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: fonts.body, fontWeight: 600, fontSize: 24, letterSpacing: 8, textTransform: "uppercase", color: ink.soft }}>In the Court of Market Opinion</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 26, marginTop: 4, fontFamily: fonts.display, fontWeight: 900, fontStyle: "italic", fontSize: 200, lineHeight: 1.05 }}>
          <span style={{ color: ink.bull }}>Bull</span>
          <span style={{ color: ink.ink2, fontSize: 84 }}>v.</span>
          <span style={{ color: ink.bear }}>Bear</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 56, marginTop: 18 }}>
          <div style={{ color: ink.bull, transform: "rotate(-8deg)" }}>
            <BullMark size={128} />
          </div>
          <Stamp at={-30} size={58} angle={-3} color={ink.bear}>
            Every trade on trial
          </Stamp>
          <div style={{ color: ink.bear, transform: "rotate(8deg)" }}>
            <BearMark size={128} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", right: 44, top: 30, transform: "rotate(14deg)" }}>
        <WaxSeal size={128} label="ON-CHAIN" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 92,
          background: ink.ink,
          color: ink.paper2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          fontFamily: fonts.mono,
          fontWeight: 700,
          fontSize: 25,
          letterSpacing: 1,
        }}
      >
        <span>AI counsel argue</span>
        <span style={{ color: ink.brassHi }}>→</span>
        <span>AI judge rules</span>
        <span style={{ color: ink.brassHi }}>→</span>
        <span>
          filed on-chain with <span style={{ color: ink.linkHi }}>Chainlink CRE</span>
        </span>
      </div>
    </Paper>
  );
}

/** Square BUIDL logo: the court seal around a two-colour monogram. */
export function Logo() {
  return (
    <Paper>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: ink.ink }}>
        <CourtSeal size={720} />
      </div>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: ink.paper,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "center",
            paddingTop: 92,
            boxSizing: "border-box",
            fontFamily: fonts.display,
            fontWeight: 900,
            fontStyle: "italic",
            fontSize: 210,
            lineHeight: 1,
          }}
        >
          <span style={{ color: ink.bull }}>B</span>
          <span style={{ color: ink.ink2, fontSize: 90, margin: "0 10px" }}>v</span>
          <span style={{ color: ink.bear }}>B</span>
        </div>
      </div>
    </Paper>
  );
}
