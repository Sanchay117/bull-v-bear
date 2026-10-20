// Films a real trial in the running courtroom (web on :5173, clerk on :8787) with Chrome's
// screencast, resampled to a constant 30 fps and encoded by ffmpeg. Writes
// public/capture/courtroom.mp4 and public/capture/courtroom.json, the second offsets of each
// moment (call to order, evidence, argument, verdict, …) that the film cuts to.
//
//   node scripts/capture.ts [--asset ETH] [--url http://localhost:5173]

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "capture");
mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const url = flag("--url", "http://localhost:5173");
const asset = flag("--asset", "ETH");

const FPS = 30;
const VIEW = { width: 1600, height: 900 };
const SCALE = 1.35; // 2160 × 1215 frames

const ffmpeg = spawn(
  "ffmpeg",
  ["-y", "-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS), "-i", "-",
   "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
   join(outDir, "courtroom.mp4")],
  { stdio: ["pipe", "inherit", "inherit"] },
);

// Constant-rate resampling: the screencast only sends a frame when the page changes, so each
// frame is repeated until the next one's timestamp.
let t0 = 0;
let clockOffset = 0; // Date.now()/1000 − frame timestamp
let written = 0;
let last: Buffer | null = null;
const fill = (until: number) => {
  const target = Math.floor((until - t0) * FPS);
  while (last && written < target) {
    ffmpeg.stdin.write(last);
    written++;
  }
};

const marks: Record<string, number> = {};
const mark = (name: string) => {
  marks[name] = Math.round((Date.now() / 1000 - clockOffset - t0) * 100) / 100;
  console.log(`${marks[name].toFixed(2).padStart(7)}s  ${name}`);
};
const hold = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE, colorScheme: "light" });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
  const ts = metadata.timestamp ?? Date.now() / 1000;
  if (!t0) {
    t0 = ts;
    clockOffset = Date.now() / 1000 - ts;
  }
  fill(ts);
  last = Buffer.from(data, "base64");
  await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

await page.goto(url, { waitUntil: "networkidle" });
await page.addStyleTag({
  content: `
    html { scrollbar-width: none; } ::-webkit-scrollbar { display: none; }
    #film-cursor { position: fixed; z-index: 10000; left: 0; top: 0; width: 26px; height: 26px; pointer-events: none;
      transition: transform 0.8s cubic-bezier(.65,0,.35,1); filter: drop-shadow(0 3px 4px rgba(0,0,0,.35)); }
    #film-cursor.press svg { transform: scale(.82); } #film-cursor svg { transition: transform .12s; }
  `,
});
await page.evaluate(() => {
  const c = document.createElement("div");
  c.id = "film-cursor";
  c.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 9.5-6.6 1.4L16 20l-2.6 1.3-3.6-7.3L4 18.6z" fill="#1d1913" stroke="#f8f2e4" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  c.style.transform = `translate(${innerWidth * 0.72}px, ${innerHeight * 0.8}px)`;
  document.body.appendChild(c);
  const w = window as unknown as Record<string, unknown>;
  // Eased page scroll, slower and smoother than the browser's own.
  w.__glide = (y: number, ms: number) =>
    new Promise<void>((done) => {
      const y0 = scrollY;
      const max = document.documentElement.scrollHeight - innerHeight;
      const goal = Math.max(0, Math.min(max, y));
      const start = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / ms);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        scrollTo(0, y0 + (goal - y0) * e);
        if (p < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
});

await cdp.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: VIEW.width * SCALE, maxHeight: VIEW.height * SCALE, everyNthFrame: 1 });
await hold(400);

/** Scrolls so the element's top sits `offset` px below the top of the viewport. */
async function glideTo(page: Page, selector: string, ms = 1400, offset = 24) {
  await page.evaluate(
    async ([sel, dur, off]) => {
      const el = document.querySelector(sel as string);
      if (!el) return;
      const y = el.getBoundingClientRect().top + scrollY - (off as number);
      await (window as unknown as { __glide: (y: number, ms: number) => Promise<void> }).__glide(y, dur as number);
    },
    [selector, ms, offset] as const,
  );
}
async function glideBy(page: Page, dy: number, ms: number) {
  await page.evaluate(
    async ([d, dur]) => (window as unknown as { __glide: (y: number, ms: number) => Promise<void> }).__glide(scrollY + d, dur),
    [dy, ms] as const,
  );
}
/** Moves the film cursor onto the element, presses, and clicks it. */
async function press(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`nothing to click at ${selector}`);
  const x = box.x + box.width * 0.5;
  const y = box.y + box.height * 0.55;
  await page.evaluate(([px, py]) => {
    const c = document.getElementById("film-cursor")!;
    c.style.transform = `translate(${px}px, ${py}px)`;
  }, [x, y] as const);
  await hold(950);
  await page.evaluate(() => document.getElementById("film-cursor")!.classList.add("press"));
  await page.mouse.click(x, y);
  await hold(160);
  await page.evaluate(() => document.getElementById("film-cursor")!.classList.remove("press"));
}
async function waitFor(page: Page, selector: string, ms = 120_000) {
  await page.waitForSelector(selector, { timeout: ms });
  const failed = await page.evaluate(() => /Mistrial\./.test(document.body.innerText));
  if (failed) throw new Error("Mistrial — the trial failed; see the clerk's logs.");
}

try {
  mark("masthead");
  await hold(2600);
  await glideTo(page, ".desk", 1600, 40);
  mark("desk");
  await hold(800);
  await press(page, `.index-card:has(input[value="${asset}"])`);
  await hold(700);
  await press(page, ".call-to-order");
  mark("call");

  await waitFor(page, ".shelf");
  await hold(500);
  await glideTo(page, ".shelf", 1200, 20);
  mark("evidence");

  await waitFor(page, ".courtroom .address.is-speaking, .courtroom .address.is-done");
  await hold(1200);
  await glideTo(page, ".courtroom", 1300, 16);
  mark("argument");

  // Follow whoever has the floor until the bench rules.
  let lastSpeaker = "";
  while (!(await page.$(".bench-verdict"))) {
    const speaker = await page.evaluate(() => {
      const all = [...document.querySelectorAll(".courtroom .address")];
      const i = all.findIndex((a) => a.classList.contains("is-speaking"));
      if (i < 0) return "";
      const el = all[i];
      const r = el.getBoundingClientRect();
      if (r.bottom > innerHeight - 60) scrollBy({ top: Math.min(r.bottom - innerHeight + 120, r.top - 90), behavior: "smooth" });
      return String(i);
    });
    if (speaker && speaker !== lastSpeaker) {
      mark(`speaker-${speaker}`);
      lastSpeaker = speaker;
    }
    if (await page.evaluate(() => /Mistrial\./.test(document.body.innerText))) throw new Error("Mistrial");
    await hold(100);
  }
  mark("judgment");
  await glideTo(page, ".bench", 900, 30);
  mark("verdict");
  await hold(3200);

  await waitFor(page, ".opinion");
  await glideTo(page, ".opinion", 1500, 20);
  mark("opinion");
  await hold(2600);
  await glideBy(page, 520, 2600);
  await hold(1200);

  await waitFor(page, ".order");
  await glideTo(page, ".order", 1500, 20);
  mark("sentence");
  await hold(3600);

  await waitFor(page, ".certificate .cert-actions", 30_000);
  await glideTo(page, ".certificate", 1500, 20);
  mark("certificate");
  await hold(1800);
  await press(page, ".cert-actions .btn-ink");
  mark("verify");
  await page.waitForSelector(".cert-result .cert-compare", { timeout: 20_000 });
  await hold(600);
  await glideBy(page, 260, 900);
  await hold(3000);
  await glideBy(page, -260, 900);
  await press(page, ".cert-actions .btn-ghost");
  mark("tamper");
  await hold(600);
  await glideBy(page, 260, 900);
  await hold(3200);

  await page.evaluate(() => (window as unknown as { __glide: (y: number, ms: number) => Promise<void> }).__glide(0, 1800));
  mark("top");
  await hold(500);
  await press(page, ".mt-controls .chip-btn:last-child");
  mark("chambers");
  await hold(2600);
  await glideTo(page, ".ledger", 2400, 20);
  mark("ledger");
  await hold(3400);
  mark("end");
} finally {
  await cdp.send("Page.stopScreencast").catch(() => {});
  fill(Date.now() / 1000 - clockOffset);
  ffmpeg.stdin.end();
  await new Promise((r) => ffmpeg.on("close", r));
  await browser.close();
  writeFileSync(
    join(outDir, "courtroom.json"),
    JSON.stringify({ fps: FPS, width: VIEW.width * SCALE, height: VIEW.height * SCALE, seconds: written / FPS, marks }, null, 2) + "\n",
  );
  console.log(`\n${(written / FPS).toFixed(1)}s of footage → public/capture/courtroom.mp4`);
}
