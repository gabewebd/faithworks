// The privacy notice under each GHL form on the GHL pages (user, 2026-11-07): the form's own
// "Privacy Policy | Terms of Service" text element is removed in GHL, and the notice lives in the
// form's card on the page instead, as on the Starter Kit and newsletter cards. Applies to every
// GHL form wrapper the root pages have (.form.form--ghl: Contact, Business, Build, Workshops,
// Speaking, the program pages). The Starter Kit card (kit-card.mjs) and the footer newsletter
// (newsletter.mjs) have their own. Styles in a <style> block once per page (the asset CDN's
// style.css has no rules for them).

// A root page's GHL form wrapper: the iframe and GHL's embed script
const WRAPPER = /(<div class="form form--ghl"[^>]*>\s*<iframe\b[\s\S]*?<\/iframe>\s*(?:<script src="[^"]*form_embed\.js"><\/script>\s*)?)(<\/div>)/g;

const CSS = `<style data-fw-form-note>
      .fw-form-note { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 8px; margin: 8px 4px 0; padding-top: 16px; border-top: 1px dashed var(--line); font-size: 13px; line-height: 1.5; color: var(--ink); text-align: center; }
      .fw-form-note svg { flex: none; width: 15px; height: 15px; }
      .fw-form-note a { text-decoration: underline; text-underline-offset: 3px; }
      .fw-form-note a:hover { color: var(--rose, var(--ink)); }
    </style>`;

const NOTE = `<p class="fw-form-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><a href="/privacy">Privacy Policy</a><span aria-hidden="true">|</span><a href="/terms">Terms of Service</a></p>`;

// html with the notice at the end of each GHL form wrapper, and its styles once
export function withFormNotes(html) {
  if (html.includes("data-fw-form-note")) return html;
  let found = false;
  const out = html.replace(WRAPPER, (all, inner, close) => { found = true; return `${inner}  ${NOTE}\n    ${close}`; });
  if (!found) return html;
  const first = out.indexOf('<div class="form form--ghl"');
  return out.slice(0, first) + CSS + "\n        " + out.slice(first);
}
