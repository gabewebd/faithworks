// In-article diagrams for Resources: renders every .fig in figures.html to
// assets/images/resources/<data-out>.png (1600px wide, full colour), via headless Chrome over the
// DevTools Protocol (no dependencies), then recompresses losslessly with Pillow when Python has it.
//   1. Serve the repository root:  python -m http.server 8775
//   2. node tools/resource-figures/render.mjs [id …]
// Options: BASE=http://localhost:8775  CHROME=<path to chrome>
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "../..");
const BASE = (process.env.BASE || "http://localhost:8775").replace(/\/$/, "");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const only = process.argv.slice(2);

const port = 9336;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${mkdtempSync(join(tmpdir(), "fw-figs-"))}`, "about:blank"], { stdio: "ignore" });
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

try {
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${BASE}/tools/resource-figures/figures.html` });
  for (let i = 0; i < 80; i++) { await sleep(250); if ((await evaluate("document.readyState")) === "complete") break; }
  const figs = await evaluate("window.ready");
  for (const f of figs) {
    if (only.length && !only.some((o) => f.out.endsWith(o))) continue;
    const { result } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: f.x, y: f.y, width: f.w, height: f.h, scale: 1 } });
    const file = join(ROOT, "assets/images/resources", `${f.out}.png`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(result.data, "base64"));
    try { execFileSync("python", ["-I", "-c", "import sys;from PIL import Image;Image.open(sys.argv[1]).save(sys.argv[1],optimize=True)", file]); } catch {}
    console.log(`${f.out}.png  ${Math.round(f.w)}×${Math.round(f.h)}  ${(statSync(file).size / 1024).toFixed(0)} KB`);
  }
} finally { ws.close(); chrome.kill(); }
