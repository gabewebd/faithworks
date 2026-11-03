// Renders the Resources featured images in covers.html to assets/images/resources/<slug>.png
// (1920×1080) with headless Chrome, then shrinks each PNG with Pillow when Python has it: graphics
// become 256-colour PNGs (about a third of the size, no visible change); a scene with a photo keeps
// full colour, where fewer colours would show on skin and walls.
//   1. Serve the repository root:  python -m http.server 8775
//   2. node tools/resource-covers/render.mjs  [BASE=http://localhost:8775] [CHROME=path to chrome]
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BASE = (process.env.BASE || "http://localhost:8775").replace(/\/$/, "");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
// scene in covers.html → [the article's slug (the file name), whether it shows a photo]
const SCENES = {
  niche: ["ai-is-not-another-niche-skill"],
  agents: ["what-are-ai-agents-beginners-guide"],
  beginners: ["ai-for-beginners-what-ai-can-do"],
  purpose: ["purpose-before-productivity", true],
  github: ["github-for-beginners"],
};
const OUT = join(ROOT, "assets/images/resources");
mkdirSync(OUT, { recursive: true });

for (const [scene, [slug, photo]] of Object.entries(SCENES)) {
  const file = join(OUT, `${slug}.png`);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1920,1080",
    "--virtual-time-budget=10000", `--screenshot=${file}`, `${BASE}/tools/resource-covers/covers.html?scene=${scene}`], { stdio: "ignore" });
  const shrink = photo ? "im" : "im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)";
  try {
    execFileSync("python", ["-c", `from PIL import Image; im = Image.open(r"${file}").convert("RGB"); ${shrink}.save(r"${file}", optimize=True)`], { stdio: "ignore" });
  } catch { /* Pillow not installed: keep Chrome's PNG */ }
  console.log(`${slug}.png  ${(statSync(file).size / 1024).toFixed(0)} KB`);
}
