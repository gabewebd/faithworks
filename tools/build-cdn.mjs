// Production (main) on Vercel is a CDN for the live site on GoHighLevel, not a website: it serves
// only the files the GHL pages load from it, css/, js/ and assets/, copied as they are into dist/.
// No pages are built, so the Vercel address itself shows nothing but these files.
// The full website build (tools/build.mjs) still runs locally and on the testing-before-live
// branch, whose vercel.mjs builds every page.
import { cpSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist");
const SERVED = ["css", "js", "assets"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const count = (dir) => readdirSync(dir).reduce((n, f) => n + (statSync(join(dir, f)).isDirectory() ? count(join(dir, f)) : 1), 0);
for (const dir of SERVED) {
  cpSync(join(ROOT, dir), join(OUT, dir), { recursive: true });
  console.log(`dist/${dir}/  ${count(join(OUT, dir))} files`);
}
