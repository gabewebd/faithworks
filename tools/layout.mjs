// Shared page chrome: <head>, header (full or campaign), footer, staging bar.
// Brief §2: launch navigation Learn AI | Build with AI | For Business | Resources | About,
// logo → Home, persistent CTA → /free-ai-starter-kit. Community and Contact live in the footer,
// as its two most visible links (under the brand line).
// The campaign landing page uses a reduced header: logo and privacy access only.

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const NAV = [
  ["learn", "/learn/", "Learn AI"],
  ["build", "/build/", "Build with AI"],
  ["business", "/business/", "For Business"],
  ["resources", "/resources/", "Resources"],
  ["about", "/about/", "About"],
];

const VERSION = "15";

// Site settings come from the CMS (tools/content.mjs). Each has a default equal to the
// approved copy, so an unset value never blanks the header or footer.
const logo = (site) => site.logo || "/assets/icons/wordmark.svg";
const logoReversed = (site) => site.logoReversed || "/assets/icons/wordmark-reversed.svg";
const privacyUrl = (site) => site.privacyUrl || "/privacy/";
const termsUrl = (site) => site.termsUrl || "/terms/";

// Approved tracking IDs only (validated again here; never secrets). Off on staging builds so
// previews do not pollute reports. Consent handling must be agreed before launch (docs/04 D6).
function tracking(site) {
  const t = site.tracking || {};
  if (site.staging) return "";
  let out = "";
  if (/^GTM-[A-Z0-9]{4,12}$/.test(t.gtm || "")) out += `\n  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${t.gtm}');</script>`;
  if (/^G-[A-Z0-9]{4,16}$/.test(t.ga4 || "")) out += `\n  <script async src="https://www.googletagmanager.com/gtag/js?id=${t.ga4}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${t.ga4}');</script>`;
  if (/^[0-9]{6,20}$/.test(t.metaPixel || "")) out += `\n  <script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${t.metaPixel}');fbq('track','PageView');</script>`;
  return out;
}

function head({ title, description, path, site, image, noindex }) {
  const origin = site.origin.replace(/\/$/, "");
  const canonical = origin + (path === "/404.html" ? "/" : path);
  const ogImage = /^https?:\/\//i.test(image || "") ? image : origin + (image || "/assets/images/masterclass-batch3-1440.jpg");
  return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  ${site.staging || noindex ? '<meta name="robots" content="noindex,nofollow">\n  ' : ""}<link rel="canonical" href="${esc(canonical)}">
  <meta name="theme-color" content="#1A1A1A">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Faith Works PH">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap">
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
  <script src="/js/forms.js?v=${VERSION}" defer></script>${tracking(site)}
</head>`;
}

function stagingBar(site) {
  if (!site.staging) return "";
  return `<div class="staging" role="note"><div class="wrap staging__inner"><span class="dot" aria-hidden="true"></span><span><strong>Staging preview.</strong> Forms are not connected yet, so nothing you enter is sent or stored. Draft content is shown here before it is published.</span></div></div>`;
}

function header(nav, variant, site) {
  if (variant === "campaign") {
    return `<header class="site-header site-header--campaign">
    <a class="logo" href="/" aria-label="Faith Works home"><img src="${esc(logo(site))}" alt="" width="168" height="34"></a>
    <a class="text-link" href="${esc(privacyUrl(site))}">Privacy Notice</a>
  </header>`;
  }
  const links = NAV.map(([key, href, label]) =>
    `<a href="${href}"${key === nav ? ' aria-current="page"' : ""}>${label}</a>`).join("\n      ");
  return `<header class="site-header">
    <a class="logo" href="/" aria-label="Faith Works home"><img src="${esc(logo(site))}" alt="" width="168" height="34"></a>
    <button class="menu" type="button" aria-label="Open navigation" aria-controls="main-navigation" aria-expanded="false"><span class="menu__bars" aria-hidden="true"></span></button>
    <nav id="main-navigation" class="site-nav" aria-label="Main navigation">
      ${links}
      <a class="btn btn--yellow" href="${esc(site.primaryCta?.url || "/free-ai-starter-kit/")}" data-track="starter_kit_click">${esc(site.primaryCta?.label || "Get the Free AI Starter Kit")}</a>
    </nav>
  </header>`;
}

function footer(site, variant) {
  const year = 2026;
  if (variant === "campaign") {
    return `<footer class="site-footer site-footer--campaign"><div class="wrap site-footer__bottom">
      <span>© ${year} Faith Works PH</span>
      <span class="site-footer__legal"><a href="${esc(privacyUrl(site))}">Privacy Notice</a><a href="${esc(termsUrl(site))}">Terms</a><a href="/">faithph.ai</a></span>
    </div></footer>`;
  }
  const social = site.social.map((s) =>
    `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.label)} (opens in a new tab)">${esc(s.name)} <span class="icon-arrow" aria-hidden="true">↗</span></a>`).join("");
  return `<footer class="site-footer">
    <div class="wrap">
      <div class="site-footer__top">
        <div class="site-footer__brand">
          <a class="logo" href="/" aria-label="Faith Works home"><img src="${esc(logoReversed(site))}" alt="" width="168" height="34"></a>
          <p>${esc(site.footerTagline || "Work better with AI, without becoming a tech expert.")}</p>
          <p class="site-footer__tagline">${esc(site.footerMotto || "Learn. Implement. Scale.")}</p>
          <p class="site-footer__reach">
            <a class="site-footer__cta site-footer__cta--pink" href="/community/" data-track="community_click">Join the Community <span class="icon-arrow" aria-hidden="true">↗</span></a>
            <a class="site-footer__cta" href="/contact/">Contact us <span class="icon-arrow" aria-hidden="true">↗</span></a>
          </p>
        </div>
        <nav class="site-footer__links" aria-label="Footer">
          <div><h2>Learn</h2><a href="/learn/">Learn AI</a><a href="/workshops/">Workshops</a><a href="/resources/">Resources</a><a href="/free-ai-starter-kit/">Free AI Starter Kit</a></div>
          <div><h2>Work with us</h2><a href="/business/">For Business</a><a href="/build/">Build with AI</a><a href="/speaking/">Speaking &amp; partnerships</a><a href="/about/">About Faith Works</a></div>
          <div><h2>Follow</h2>${social}<a href="${esc(site.community.url)}" target="_blank" rel="noopener" data-track="community_click">Community group <span class="icon-arrow" aria-hidden="true">↗</span></a></div>
        </nav>
      </div>
      <div class="site-footer__bottom">
        <span>© ${year} Faith Works PH</span>
        <span class="site-footer__legal"><a href="${esc(privacyUrl(site))}">Privacy Notice</a><a href="${esc(termsUrl(site))}">Terms</a></span>
      </div>
    </div>
  </footer>`;
}

// chrome: false renders a CMS page with "Custom page layout": no global header or footer (the
// page brings its own). The head, styles, scripts and staging bar stay.
export function layout({ title, description, path, nav, header: variant, bodyClass, body, site, image, noindex, chrome = true }) {
  if (!chrome) {
    return `<!doctype html>
<!-- Generated by tools/build.mjs. Edit src/pages/ or the content in the CMS, then run: node tools/build.mjs -->
<html lang="en">
${head({ title, description, path, site, image, noindex })}
<body class="page--custom${bodyClass ? ` ${bodyClass}` : ""}" data-page="${esc(path)}">
  ${stagingBar(site)}
  <div id="main-content">
${body}
  </div>
</body>
</html>
`;
  }
  return `<!doctype html>
<!-- Generated by tools/build.mjs. Edit src/pages/ or the content in the CMS, then run: node tools/build.mjs -->
<html lang="en">
${head({ title, description, path, site, image, noindex })}
<body${bodyClass ? ` class="${bodyClass}"` : ""} data-page="${esc(path)}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  ${stagingBar(site)}
  ${header(nav, variant, site)}
  <main id="main-content" tabindex="-1">
${body}
  </main>
  ${footer(site, variant)}
</body>
</html>
`;
}
