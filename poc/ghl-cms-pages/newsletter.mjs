// The GHL pages' footer: the site footer (tools/layout.mjs, left as it is for the main site) with
// its links area rearranged and the newsletter sign-up (GHL form "Newsletter") added. Used by
// poc/ghl-cms-pages/build.mjs and poc/ghl-resources-cms/prepare.mjs (also bundled into the
// Resources embed's runtime, so no <script> here: build.mjs adds the form's sizing script).
//
// Links area (user, 2026-11-07): Learn | Work with us | Newsletter card (in Follow's old column);
// at 760px and below the card goes under the two link columns. The Follow column is gone:
// Facebook, Instagram and LinkedIn are round icon buttons under the brand column's Join the
// Community / Contact us buttons, and the community group link is dropped (Join the Community
// already goes there). The card has no heading (user: keep it small), just its eyebrow and line.
// The styles travel with the footer in a <style> block: the asset CDN's
// css/style.css has no rules for them, and the Resources embed renders the footer inside a shadow
// root (a <style> there applies to it).
export const NEWSLETTER_FORM = "DTFz2Yw3qZ7iWFVB1zBi";
// The form at phone width. It then follows the form's own size (iframe-resizer handshake):
// FORM_SIZER in build.mjs on the GHL pages, runtime.js in the Resources shadow root. GHL's
// form_embed.js is not used for it: it hides the iframe until its handshake completes, and the
// form stayed invisible on GHL. The form is see-through: its look is newsletter-form.css, pasted
// into the form's Custom CSS in GHL.
export const NEWSLETTER_HEIGHT = 180; // three 48px rows and their gaps (newsletter-form.css)

const FOOTER_CSS = `<style data-fw-footer>
      .site-footer .fw-foot { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr); grid-template-areas: "nav nav news"; gap: 32px 24px; align-content: start; align-items: start; }
      .site-footer .fw-foot__nav { grid-area: nav; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .site-footer .fw-foot__news { grid-area: news; }
      .site-footer .fw-foot__social { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
      .site-footer .fw-foot__social a { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border: 1px solid var(--line-dark); border-radius: 50%; color: var(--white); transition: background-color var(--dur-fast), border-color var(--dur-fast), color var(--dur-fast); }
      .site-footer .fw-foot__social a:hover { border-color: var(--pink); background: var(--pink); color: var(--ink); }
      .site-footer .fw-foot__social a:focus-visible { outline: 3px solid var(--yellow); outline-offset: 3px; }
      .site-footer .fw-foot__social svg { width: 18px; height: 18px; }
      .site-footer .fw-foot__card { padding: clamp(20px, 2.4vw, 28px); border: 1px solid var(--line-dark); border-radius: var(--r-lg); background: rgb(255 255 255 / 0.03); }
      .site-footer .fw-foot__eyebrow { margin: 0; font-size: 12px; font-weight: 700; line-height: 1.4; letter-spacing: 0.14em; text-transform: uppercase; color: var(--pink); }
      .site-footer .fw-foot__card p.fw-foot__lead { margin: 8px 0 18px; font-size: var(--fs-small); color: var(--white); }
      .site-footer .fw-foot__card iframe { display: block; width: 100%; height: ${NEWSLETTER_HEIGHT}px; border: none; background: transparent; }
      @media (max-width: 760px) {
        .site-footer .fw-foot { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: "nav nav" "news news"; }
      }
    </style>`;

// The card: eyebrow and line on top, then the form. No privacy links in it (user, 2026-11-07: removed;
// the footer's bottom bar already links Privacy and Terms).
export const newsletterHtml = `<div class="fw-foot__news">
          <div class="fw-foot__card">
            <p class="fw-foot__eyebrow">Newsletter</p>
            <p class="fw-foot__lead">New guides, AI tools and events, straight to your inbox.</p>
            <iframe
              src="https://api.faithph.ai/widget/form/${NEWSLETTER_FORM}"
              style="height:${NEWSLETTER_HEIGHT}px"
              id="inline-${NEWSLETTER_FORM}"
              data-fw-size
              scrolling="no"
              data-layout="{'id':'INLINE'}"
              data-trigger-type="alwaysShow"
              data-trigger-value=""
              data-activation-type="alwaysActivated"
              data-activation-value=""
              data-deactivation-type="neverDeactivate"
              data-deactivation-value=""
              data-form-name="Newsletter"
              data-height="${NEWSLETTER_HEIGHT}"
              data-layout-iframe-id="inline-${NEWSLETTER_FORM}"
              data-form-id="${NEWSLETTER_FORM}"
              title="Newsletter sign-up">
            </iframe>
          </div>
        </div>`;

// Social icons (24px grid, currentColor)
const ICONS = {
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5.2 3.6a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM3.3 9.6h3.8V21H3.3zM9.5 9.6h3.6v1.6h.1c.5-.9 1.7-1.9 3.6-1.9 3.8 0 4.5 2.5 4.5 5.8V21h-3.8v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V21H9.5z"/></svg>',
};
const socialOf = (href) => /instagram\.com/.test(href) ? "instagram" : /linkedin\.com/.test(href) ? "linkedin" : /facebook\.com\/(?!share\/g\/)/.test(href) ? "facebook" : null;

// The Follow column's profile links as icon buttons (their accessible names kept). Its other links
// (the community group) are left out.
function socialHtml(inner) {
  const icons = (inner.match(/<a\b[\s\S]*?<\/a>/g) || []).map((a) => {
    const href = (a.match(/\shref="([^"]*)"/) || [])[1] || "", kind = socialOf(href);
    if (!kind) return "";
    const name = a.replace(/<span[\s\S]*?<\/span>/g, "").replace(/<[^>]+>/g, "").trim();
    const label = (a.match(/\saria-label="([^"]*)"/) || [])[1] || `${name} (opens in a new tab)`;
    return `<a href="${href}" target="_blank" rel="noopener" aria-label="${label}" title="${name}">${ICONS[kind]}</a>`;
  }).filter(Boolean);
  return icons.length ? `\n          <div class="fw-foot__social" role="group" aria-label="Follow Faith Works">${icons.join("")}</div>` : "";
}

// html with its full site footer's links area rearranged, the social icons moved under the brand
// column's buttons and the sign-up added. The short campaign footer has no links area and is left
// as it is.
export function withNewsletter(html) {
  if (html.includes(`inline-${NEWSLETTER_FORM}`)) return html;
  const nav = html.match(/<nav class="site-footer__links" aria-label="Footer">([\s\S]*?)<\/nav>/);
  if (!nav) return html;
  const cols = [...nav[1].matchAll(/<div><h2>([^<]+)<\/h2>([\s\S]*?)<\/div>/g)];
  const follow = cols.find((c) => c[1] === "Follow");
  const others = cols.filter((c) => c !== follow).map((c) => c[0]);
  const block = `${FOOTER_CSS}
        <div class="fw-foot">
        <nav class="site-footer__links fw-foot__nav" aria-label="Footer">
          ${others.join("\n          ")}
        </nav>
        ${newsletterHtml}
        </div>`;
  let out = html.slice(0, nav.index) + block + html.slice(nav.index + nav[0].length);
  const reach = out.match(/<p class="site-footer__reach">[\s\S]*?<\/p>/);
  if (follow && reach) out = out.slice(0, reach.index + reach[0].length) + socialHtml(follow[2]) + out.slice(reach.index + reach[0].length);
  return out;
}
