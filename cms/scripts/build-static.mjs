// Static build for Vercel/Netlify: copies the shared modules the dashboard imports
// (/shared/*.mjs) into public/, which is the only folder served as static files.
import { cpSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CMS = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(CMS, "public", "shared");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of readdirSync(join(CMS, "shared")).filter((x) => x.endsWith(".mjs"))) cpSync(join(CMS, "shared", f), join(out, f));
console.log(`Copied shared modules to ${out}`);
