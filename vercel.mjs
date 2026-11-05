// Vercel project configuration for main: the asset CDN for the live site on GoHighLevel.
// It serves only css/, js/ and assets/ (tools/build-cdn.mjs). No pages, so no CMS snapshot or
// redirects are needed here. Other paths, including the root address, answer 404.
// The full website build lives on the testing-before-live branch (its vercel.mjs builds every page
// with tools/build.mjs). When merging that branch into main, keep this file and .vercelignore.
export const config = {
  framework: null,
  installCommand: "",
  buildCommand: "node tools/build-cdn.mjs",
  outputDirectory: "dist",
  headers: [
    {
      source: "/(.*)",
      headers: [
        // The GHL pages (another origin) load these files, and the resources embed fetches css/style.css
        { key: "Access-Control-Allow-Origin", value: "*" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
        // The CDN address is not a website: keep it and its files (images included) out of search
        // results. Does not affect the GHL pages that load these files.
        { key: "X-Robots-Tag", value: "noindex, nofollow, noimageindex" },
      ],
    },
  ],
};
