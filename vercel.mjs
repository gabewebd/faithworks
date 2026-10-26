// Vercel project configuration for the website (formerly vercel.json). A module rather than JSON so
// the CMS slug history becomes real redirects: when an event, program or resource changes slug, its
// old address answers 308 → the new address at the CDN, instead of a "This page has moved" page
// with a meta refresh. Vercel evaluates this file at deploy time, before the build command, with
// the project's environment variables; it reads the same published snapshot the build does
// (tools/content.mjs), so a CMS outage stops the deploy here just as it would stop the build.
// The build still writes its fallback redirect pages (tools/build.mjs) for other hosts and local
// previews; on Vercel these redirects run first, so those pages are never shown.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSnapshot, SITE_REDIRECTS } from "./tools/content.mjs";
import { publicPath } from "./cms/shared/schema.mjs";

const root = dirname(fileURLToPath(import.meta.url));

// Site renames come from tools/content.mjs SITE_REDIRECTS (the build writes fallback pages for the same list).

async function cmsRedirects() {
  const snap = await loadSnapshot({ root, source: "cms", view: "published" });
  // Redirects run before the site's own files, so never redirect away from an address that a
  // current item owns (the CMS already refuses such slugs; this keeps a stale entry harmless).
  // Plain paths only: Vercel reads a source as a route pattern, and slugs never need more.
  const live = new Set(["programs", "events", "resources"].flatMap((c) => (snap[c] || []).map((p) => publicPath(c, p.slug))));
  const plain = (p) => /^\/[a-z0-9/-]+\/$/.test(p || "");
  return (snap.redirects || []).filter((r) => plain(r.from) && plain(r.to) && r.from !== r.to && !live.has(r.from));
}

const redirects = [...SITE_REDIRECTS, ...(await cmsRedirects())];

export const config = {
  framework: null,
  installCommand: "",
  buildCommand: "node tools/build.mjs --deploy --content=cms --view=published --out=dist",
  outputDirectory: "dist",
  trailingSlash: true,
  redirects: redirects.map((r) => ({ source: r.from, destination: r.to, permanent: true })),
  headers: [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ],
    },
  ],
};
