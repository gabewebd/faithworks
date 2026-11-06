// Next.js shell around the existing CMS. The dashboard is still the static app in public/
// (hash routes, served as /index.html); the API is app/api/[...path]/route.js -> server/app.mjs.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { csp } from "./server/security.mjs";
import { loadConfig } from "./server/config.mjs";

const CMS = dirname(fileURLToPath(import.meta.url));
const cfg = loadConfig(process.env); // same values the API uses for its own response headers
const production = cfg.production;

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  // The page preview renders with the website's templates (../tools), which read ../data and ../assets/icons.
  outputFileTracingRoot: join(CMS, ".."),
  outputFileTracingIncludes: {
    "/api/[...path]": ["../tools/**/*", "./shared/**/*", "./fixtures/seed.json", "../data/*.json", "../assets/icons/**/*"],
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/rss.xml", destination: "/api/public/newsletter/rss" },
      ],
    };
  },
  async headers() {
    const h = [
      { key: "Content-Security-Policy", value: csp(cfg) },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ];
    return [{ source: "/:path*", headers: h }];
  },
};
