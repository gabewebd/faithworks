// Local development server for the CMS: `npm run dev` (from cms/).
// Serves the dashboard (public/), the shared modules (/shared/), the API, and, for page
// previews, the website's own CSS, scripts and images from the repository root.
// Reads cms/.env if present. Never use this server in production.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.mjs";

const CMS = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = join(CMS, "..");

loadEnv(join(CMS, ".env"));
const { createApp } = await import("../server/app.mjs");
const app = createApp();
const { securityHeaders } = await import("../server/security.mjs");
const headers = securityHeaders(app.cfg);
const PORT = Number(process.env.PORT) || 5174;

const TYPES = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".woff2": "font/woff2" };
// URL prefix → directory. Site assets are read-only and only used by previews.
const MOUNTS = [["/shared/", join(CMS, "shared")], ["/css/", join(REPO, "css")], ["/assets/", join(REPO, "assets")], ["/js/", join(REPO, "js")], ["/", join(CMS, "public")]];

function staticFile(pathname) {
  for (const [prefix, dir] of MOUNTS) {
    if (!pathname.startsWith(prefix)) continue;
    const rel = normalize(decodeURIComponent(pathname.slice(prefix.length)) || "index.html").replace(/^(\.\.[/\\])+/, "");
    const file = join(dir, rel);
    if (!file.startsWith(dir)) return null;
    if (existsSync(file) && statSync(file).isFile()) return file;
    if (prefix === "/" && !extname(pathname)) return join(dir, "index.html");
  }
  return null;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
      const response = await app.handle(request);
      const out = {};
      response.headers.forEach((v, k) => { if (k !== "set-cookie") out[k] = v; });
      const cookies = response.headers.getSetCookie?.() || [];
      if (cookies.length) out["set-cookie"] = cookies;
      res.writeHead(response.status, out);
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const file = staticFile(url.pathname);
    if (!file) { res.writeHead(404, headers); res.end("Not found"); return; }
    res.writeHead(200, { ...headers, "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(readFileSync(file));
  } catch (e) {
    console.error(e);
    res.writeHead(500); res.end("Server error");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Faith Works CMS (development) on http://localhost:${PORT}  [store: ${app.cfg.store}${app.cfg.store === "json" ? `, ${app.cfg.jsonPath}` : ""}]`);
  if (app.cfg.errors.length) console.log("Configuration problems:\n  - " + app.cfg.errors.join("\n  - "));
  if (app.cfg.devLogin) console.log("Development login is ON (local only).");
});
