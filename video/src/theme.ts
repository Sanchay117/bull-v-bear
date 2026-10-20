import { loadFont as loadStencil } from "@remotion/google-fonts/BigShouldersStencil";
import { loadFont as loadCourier } from "@remotion/google-fonts/CourierPrime";
import { loadFont as loadNewsreader } from "@remotion/google-fonts/Newsreader";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

// The courtroom's own type and ink (web/src/styles.css), so the film matches the app.
export const fonts = {
  display: loadPlayfair("normal", { weights: ["700", "900"], subsets: ["latin"] }).fontFamily,
  body: loadNewsreader("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily,
  mono: loadCourier("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily,
  stamp: loadStencil("normal", { weights: ["700", "800", "900"], subsets: ["latin"] }).fontFamily,
};
loadPlayfair("italic", { weights: ["700", "900"], subsets: ["latin"] });
loadNewsreader("italic", { weights: ["400", "500"], subsets: ["latin"] });

export const ink = {
  paper: "#efe6d1",
  paper2: "#f8f2e4",
  paper3: "#e6dabd",
  manila: "#e9d29c",
  manila2: "#d6b873",
  manilaInk: "#4a3815",
  ink: "#1d1913",
  ink2: "#3b342a",
  soft: "#6c6253",
  rule: "#cfc1a0",
  rule2: "#b5a47e",
  bull: "#1d5a3a",
  bull2: "#2d7a50",
  bear: "#8d2017",
  bear2: "#ac3427",
  gold: "#94722a",
  brassHi: "#e9cf83",
  brass: "#c09a45",
  brassLo: "#7d5f22",
  wood1: "#3a2416",
  wood2: "#2b1a10",
  wood3: "#4a2e1b",
  wax: "#9e1b1b",
  waxHi: "#d24b40",
  waxLo: "#5a0c0c",
  marginRed: "#c4504a",
  // Chambers (night)
  night: "#17110c",
  night2: "#221a12",
  nightInk: "#f1e6cd",
  nightSoft: "#a99a7c",
  nightBull: "#7cc596",
  nightBear: "#ee8473",
  // Chainlink
  link: "#375bd2",
  linkHi: "#8aa6ff",
};
