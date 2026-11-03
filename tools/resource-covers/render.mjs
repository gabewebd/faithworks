// Resources featured images: SVG sources first, PNG exports from them.
//   1. Serve the repository root:  python -m http.server 8775
//   2. node tools/resource-covers/render.mjs --compose   writes svg/<slug>.svg from the scenes in
//      covers.html (text measured with the real fonts), then exports the PNGs
//      node tools/resource-covers/render.mjs             exports the PNGs from the SVG files as
//      they are (after editing an SVG by hand)
// PNGs: assets/images/resources/<slug>.png, 1920×1080, rendered by headless Chrome (Chrome DevTools
// Protocol, no dependencies), then recompressed losslessly with Pillow when Python has it. Full
// colour on purpose: a 256-colour palette greys out small brand colours (the Google and GitHub
// marks, pink and yellow accents) next to the wide gradients.
// Options: BASE=http://localhost:8775  CHROME=<path to chrome>  --only=setup,modes (scene names; the
// other images are left exactly as they are)
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "../..");
const BASE = (process.env.BASE || "http://localhost:8775").replace(/\/$/, "");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
// scene in covers.html → the article's slug (the file names)
const SCENES = {
  niche: "ai-is-not-another-niche-skill",
  agents: "what-are-ai-agents-beginners-guide",
  beginners: "ai-for-beginners-what-ai-can-do",
  purpose: "purpose-before-productivity",
  github: "github-for-beginners",
  setup: "how-to-set-up-an-ai-agent",
  modes: "chatbot-vs-copilot-vs-ai-agent",
};
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
for (const k of Object.keys(SCENES)) if (only.length && !only.includes(k)) delete SCENES[k];
const SVG_DIR = join(HERE, "svg"), OUT = join(ROOT, "assets/images/resources");
mkdirSync(SVG_DIR, { recursive: true });
mkdirSync(OUT, { recursive: true });

/* ---- Headless Chrome over the DevTools Protocol ---- */
const port = 9334;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${mkdtempSync(join(tmpdir(), "fw-covers-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 60 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {} }
if (!target) throw new Error("Chrome did not start");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0; const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const n = ++seq; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
const open = async (url) => { await send("Page.navigate", { url }); for (let i = 0; i < 80; i++) { await sleep(250); if ((await evaluate("document.readyState")) === "complete") return; } };
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });

try {
  /* ---- SVG sources ---- */
  if (process.argv.includes("--compose")) {
    await open(`${BASE}/tools/resource-covers/covers.html`);
    for (const [scene, slug] of Object.entries(SCENES)) {
      writeFileSync(join(SVG_DIR, `${slug}.svg`), await evaluate(`compose(${JSON.stringify(scene)})`));
      console.log(`svg/${slug}.svg  ${(statSync(join(SVG_DIR, `${slug}.svg`)).size / 1024).toFixed(0)} KB`);
    }
  }
  /* ---- PNG exports from the SVG files ---- */
  for (const slug of Object.values(SCENES)) {
    const file = join(OUT, `${slug}.png`);
    await open(`${BASE}/tools/resource-covers/svg/${slug}.svg`);
    // fonts (from the SVG's @import) and any raster image it links
    await evaluate(`(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll("image")].map((im) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = im.href.baseVal ? new URL(im.href.baseVal, location).href : ""; }))); await new Promise((r) => setTimeout(r, 400)); })()`);
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
    writeFileSync(file, Buffer.from(shot.result.data, "base64"));
    try { execFileSync("python", ["-c", `from PIL import Image; Image.open(r"${file}").convert("RGB").save(r"${file}", optimize=True)`], { stdio: "ignore" }); } catch { /* Pillow not installed: keep Chrome's PNG */ }
    console.log(`${slug}.png  ${(statSync(file).size / 1024).toFixed(0)} KB`);
  }
} finally {
  ws.close();
  chrome.kill();
}
