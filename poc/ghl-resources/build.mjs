// node poc/ghl-resources/build.mjs  → poc/ghl-resources/dist/fw-resources.js (one browser file)
// Node built-ins used at import time by the shared renderers are replaced by tiny shims; the
// gallery registry JSON they read from disk is inlined.
import { createRequire } from "node:module";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url)), ROOT = join(here, "../..");
const esbuild = createRequire(process.env.ESBUILD_FROM)("esbuild");
const files = Object.fromEntries(["gallery.json", "gallery.lock.json", "events.json", "trusted-by.json"].map((n) => [`src/data/${n}`, readFileSync(join(ROOT, "src/data", n), "utf8")]));
for (const n of readdirSync(join(ROOT, "assets/icons/tools"))) files[`assets/icons/tools/${n}`] = readFileSync(join(ROOT, "assets/icons/tools", n), "utf8");
const FS = `const F=${JSON.stringify(files)};
const k=(p)=>Object.keys(F).find((x)=>String(p).split("\\\\").join("/").endsWith(x));
export const readFileSync=(p)=>{const x=k(p);if(x===undefined)throw new Error("not available in the browser: "+p);return F[x]};
export const existsSync=(p)=>k(p)!==undefined;
export const writeFileSync=()=>{throw new Error("no fs in the browser")};export const mkdirSync=writeFileSync;`;
const PATH = `export const join=(...p)=>p.join("/");export const dirname=(p)=>p.split("/").slice(0,-1).join("/")||"/";`;
const URL_ = `export const fileURLToPath=(u)=>String(u).replace("file://","");`;
const shim = {
  name: "node-shims",
  setup(b) {
    b.onResolve({ filter: /^node:(fs|path|url)$/ }, (a) => ({ path: a.path, namespace: "shim" }));
    b.onLoad({ filter: /.*/, namespace: "shim" }, (a) => ({ resolveDir: ROOT, loader: "js", contents:
      a.path === "node:fs" ? FS : a.path === "node:path" ? PATH : URL_ }));
  },
};
mkdirSync(join(here, "dist"), { recursive: true });
const r = await esbuild.build({ entryPoints: [join(here, "entry.mjs")], bundle: true, minify: true, format: "iife", globalName: "FWResources", platform: "browser", target: ["es2019"],
  define: { "process.env": "{}", "import.meta.url": '"file:///x/tools/render.mjs"' }, plugins: [shim], outfile: join(here, "dist/fw-resources.js"), metafile: true, logLevel: "warning" });
console.log("built", Object.values(r.metafile.outputs)[0].bytes, "bytes");
