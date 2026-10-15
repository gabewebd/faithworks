// Shared page chrome: <head>, header (full or campaign), footer, staging bar.
// Brief §2: launch navigation Learn AI | Build with AI | For Business | Resources | About,
// logo → Home, persistent CTA → /free-ai-starter-kit. Community and Contact live in the footer.
// The campaign landing page uses a reduced header: logo and privacy access only.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const NAV = [
  ["learn", "/learn/", "Learn AI"],
  ["build", "/build/", "Build with AI"],
  ["business", "/business/", "For Business"],
  ["resources", "/resources/", "Resources"],
  ["about", "/about/", "About"],
];

const VERSION = "9";

function head({ title, description, path, site, image, noindex }) {
  const origin = site.origin.replace(/\/$/, "");
  const canonical = origin + (path === "/404.html" ? "/" : path);
  const ogImage = origin + (image || "/assets/images/masterclass-batch3-1440.jpg");
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${site.staging || noindex ? '<meta name="robots" content="noindex,nofollow">\n  ' : ""}<link rel="canonical" href="${esc(canonical)}">
  <meta name="theme-color" content="#1A1E24">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Faith Works PH">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="/css/style.css?v=${VERSION}">
  <script>
    /* Motion is opt-in: html.motion only while main.js runs, so content can never stay hidden */
    (function (h) {
      h.classList.add("js");
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      h.classList.add("motion");
      setTimeout(function () { if (!window.__fwReady) h.classList.remove("motion"); }, 3000);
    })(document.documentElement);
  </script>
  <script src="/js/config.js?v=${VERSION}" defer></script>
  <script src="/js/main.js?v=${VERSION}" defer></script>
  <script src="/js/forms.js?v=${VERSION}" defer></script>
</head>`;
}

function stagingBar(site) {
  if (!site.staging) return "";
  return `<div class="staging" role="note"><div class="wrap staging__inner"><span class="dot" aria-hidden="true"></span><span><strong>Staging preview.</strong> Forms are not connected yet, so nothing you enter is sent or stored. Content marked as draft awaits approval.</span></div></div>`;
}

function header(nav, variant) {
  if (variant === "campaign") {
    return `<header class="site-header site-header--campaign">
    <a class="logo" href="/" aria-label="Faith Works home"><img src="/assets/icons/wordmark.svg" alt="" width="168" height="34"></a>
    <a class="text-link" href="/privacy/">Privacy Notice</a>
  </header>`;
  }
  const links = NAV.map(([key, href, label]) =>
    `<a href="${href}"${key === nav ? ' aria-current="page"' : ""}>${label}</a>`).join("\n      ");
  return `<header class="site-header">
    <a class="logo" href="/" aria-label="Faith Works home"><img src="/assets/icons/wordmark.svg" alt="" width="168" height="34"></a>
    <button class="menu" type="button" aria-label="Open navigation" aria-controls="main-navigation" aria-expanded="false"><span class="menu__bars" aria-hidden="true"></span></button>
    <nav id="main-navigation" class="site-nav" aria-label="Main navigation">
      ${links}
      <a class="btn btn--yellow" href="/free-ai-starter-kit/" data-track="starter_kit_click">Get the Free AI Starter Kit</a>
    </nav>
  </header>`;
}

function footer(site, variant) {
  const year = 2026;
  if (variant === "campaign") {
    return `<footer class="site-footer site-footer--campaign"><div class="wrap site-footer__bottom">
      <span>© ${year} Faith Works PH</span>
      <span class="site-footer__legal"><a href="/privacy/">Privacy Notice</a><a href="/terms/">Terms</a><a href="/">faithph.ai</a></span>
    </div></footer>`;
  }
  const social = site.social.map((s) =>
    `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.label)} (opens in a new tab)">${esc(s.name)} <span aria-hidden="true">↗</span></a>`).join("");
  return `<footer class="site-footer">
    <div class="wrap">
      <div class="site-footer__top">
        <div class="site-footer__brand">
          <a class="logo" href="/" aria-label="Faith Works home"><img src="/assets/icons/wordmark-reversed.svg" alt="" width="168" height="34"></a>
          <p>Work better with AI, without becoming a tech expert.</p>
          <p class="site-footer__tagline">Learn. Implement. Scale.</p>
        </div>
        <nav class="site-footer__links" aria-label="Footer">
          <div><h2>Learn</h2><a href="/learn/">Learn AI</a><a href="/workshops/">Workshops</a><a href="/resources/">Resources</a><a href="/free-ai-starter-kit/">Free AI Starter Kit</a></div>
          <div><h2>Work with us</h2><a href="/business/">For Business</a><a href="/build/">Build with AI</a><a href="/speaking/">Speaking &amp; partnerships</a></div>
          <div><h2>Faith Works</h2><a href="/about/">About</a><a href="/community/">Community</a><a href="/contact/">Contact</a></div>
          <div><h2>Follow</h2>${social}<a href="${esc(site.community.url)}" target="_blank" rel="noopener" data-track="community_click">Community group <span aria-hidden="true">↗</span></a></div>
        </nav>
      </div>
      <div class="site-footer__bottom">
        <span>© ${year} Faith Works PH</span>
        <span class="site-footer__legal"><a href="/privacy/">Privacy Notice</a><a href="/terms/">Terms</a></span>
      </div>
    </div>
  </footer>`;
}

export function layout({ title, description, path, nav, header: variant, bodyClass, body, site, image, noindex }) {
  return `<!doctype html>
<!-- Generated by tools/build.mjs. Edit src/pages/ or assets/data/, then run: node tools/build.mjs -->
<html lang="en">
${head({ title, description, path, site, image, noindex })}
<body${bodyClass ? ` class="${bodyClass}"` : ""} data-page="${esc(path)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${stagingBar(site)}
  ${header(nav, variant)}
  <main id="main-content" tabindex="-1">
${body}
  </main>
  ${footer(site, variant)}
</body>
</html>
`;
}
