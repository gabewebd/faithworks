// The Starter Kit hero on the GHL Start Your AI Journey page (user, 2026-11-07: make it attractive
// and convert better). GHL pages only: the root page and its template stay as they are. The styles
// travel in a <style> block (the asset CDN's style.css has no rules for the new classes); the icon
// tiles and the badge reuse the "What's inside" section's own (.bw-kitmeta__icon,
// .bw-kitmeta__sticker), the badge set straight (user: no slant). No drop shadows anywhere in it (user).
//
// Left, replacing the eyebrow, tick list and the kit preview (cover + task-selector table):
//   a straight badge, the heading and lead as they were, four icon rows (what you do with the kit,
//   from the old ticks), a gradient mockup of a first workflow (task, inputs, AI draft, a person
//   checking it, output, and a small test under way; in place of three tilted badges, user
//   2026-11-07), and on phones a "Get the free kit" jump button.
// Right, the "kit ticket" card in place of the root page's .kit-card:
//   a Charcoal band (yellow FREE PDF tag, heading, what is in the kit, a small tilted kit cover),
//   ticket notches at the seam, the GHL form sized to its content, and under it the free-download
//   line and the privacy and terms links (moved here from the form; the user deletes them there).
// The form keeps GHL (submissions, consent records, captcha, automations); its look is
// kit-form.css, pasted into that form's Custom CSS in GHL.

// The root page's pieces
const ROOT_CARD = /<div class="kit-card" id="get-the-kit">\s*<h2>[\s\S]*?<\/h2>\s*<div class="form form--ghl"[^>]*>\s*<iframe\b([\s\S]*?)<\/iframe>\s*(?:<script src="[^"]*form_embed\.js"><\/script>\s*)?<\/div>\s*<\/div>/;
const ROOT_COPY = /<div class="kit-hero__copy">([\s\S]*?)<\/ul>\s*<\/div>/;
const ROOT_PREVIEW = /\s*<div class="kit-preview"[\s\S]*?<\/table>\s*<\/div>\s*<\/div>/;

// The form at its height before it reports its own (build.mjs FORM_SIZER sizes [data-fw-size])
const START_HEIGHT = 560;

const CSS = `<style data-fw-kit>
      .kit-hero__grid.kit-hero__grid--fw { grid-template-areas: "copy card"; align-items: start; }
      @media (min-width: 901px) { .kit-hero__grid--fw .kit-hero__copy { position: sticky; top: var(--kit-stick, calc(var(--header-h, 76px) + 24px)); } }
      .kit-hero__copy .kit-hero__badge { margin: 0 0 22px; font-size: 14px; rotate: none; }
      .kit-hero__copy .bw-kitmeta__sticker { box-shadow: inset 0 0 0 1px var(--line); }
      .kit-hero__copy .phero__lead { margin-top: 18px; }
      .kit-flow { container-type: inline-size; margin: 34px 0 0; padding: clamp(22px, 3vw, 36px); border-radius: 24px; background: linear-gradient(110deg, #F2C1CC 0%, #F8E4E7 30%, #FAF6EF 55%, #FBEBC2 80%, #FBDD8A 100%); }
      .kit-flow__list { --cw: min(272px, 100cqw); --gap: 24px; --step: calc((100cqw - var(--cw)) / 3); display: grid; gap: var(--gap); margin: 0; padding: 0; list-style: none; }
      .kit-flow__list li { position: relative; display: flex; align-items: center; gap: 14px; width: var(--cw); margin-left: calc(var(--step) * var(--i, 0)); padding: 12px 18px 12px 12px; border-radius: 20px; background: var(--white); box-shadow: 0 0 0 6px rgb(255 255 255 / 0.5); }
      .kit-flow__list li:nth-child(4n+2) .bw-kitmeta__icon, .kit-flow__list li:nth-child(4n+3) .bw-kitmeta__icon { background: var(--yellow); }
      .kit-flow__list li + li::before { content: ""; position: absolute; z-index: -1; left: calc(35px - var(--step)); top: calc(-1 * var(--gap)); width: calc(var(--step) - 35px); height: calc(var(--gap) + 50%); border-left: 1.5px solid rgb(26 26 26 / 0.22); border-bottom: 1.5px solid rgb(26 26 26 / 0.22); border-bottom-left-radius: 16px; }
      .kit-flow__list li:not(:last-child)::after { content: ""; position: absolute; bottom: -10px; left: 31px; width: 8px; height: 8px; border-radius: 50%; background: var(--pink); }
      .kit-flow__in { position: absolute; top: calc(50% - 4px); left: -10px; width: 8px; height: 8px; border-radius: 50%; background: var(--pink); }
      .kit-flow__t { display: grid; gap: 2px; min-width: 0; font-family: var(--font-display); }
      .kit-flow__t b { font-size: 17px; font-weight: 600; line-height: 1.2; letter-spacing: -0.01em; }
      .kit-flow__t small { font-size: 13px; font-weight: 500; line-height: 1.3; }
      .motion .kit-flow__list li { animation: fw-rise 700ms var(--ease-out) calc(300ms + var(--i, 0) * 150ms) both; }
      .motion .kit-flow .bw-kitmeta__icon [pathLength] { animation: fw-draw 1100ms var(--ease-io) calc(500ms + var(--i, 0) * 150ms) both; }
      @container (max-width: 470px) {
        .kit-flow__list { --cw: 100cqw; --step: 0px; --gap: 22px; }
        .kit-flow__list li + li::before { left: 34px; width: 0; height: var(--gap); border-bottom: 0; border-radius: 0; }
        .kit-flow__in { display: none; }
      }
      .kit-hero__copy h1 { max-width: 19ch; }
      .kit-h__nb { white-space: nowrap; }
      .kit-h__tools { display: inline-flex; vertical-align: 0.06em; margin: 0 0.06em 0 0.02em; }
      .kit-h__tools i { display: inline-grid; place-items: center; width: 0.82em; height: 0.82em; border-radius: 0.24em; background: var(--white); box-shadow: 0 0 0 0.06em var(--pink-tint), inset 0 0 0 1px var(--line); }
      .kit-h__tools i + i { margin-left: -0.2em; }
      .kit-h__tools i:nth-child(2) { background: var(--pink); box-shadow: 0 0 0 0.06em var(--pink-tint); }
      .kit-h__tools i:nth-child(3) { background: var(--yellow); box-shadow: 0 0 0 0.06em var(--pink-tint); }
      .kit-h__tools svg { width: 0.46em; height: 0.46em; }
      .motion .kit-h__tools i { animation: fw-pop 600ms var(--ease-spring) calc(350ms + var(--i, 0) * 120ms) both; }
      .motion .kit-hero__copy h1 .kit-hero__hl { background-repeat: no-repeat; background-size: 100% 100%; animation: kit-hl 600ms var(--ease-out) var(--d, 600ms) both; }
      @keyframes kit-hl { from { background-size: 0% 100%; } }

      .kit-hero__jump { display: none; }
      .kit-hero__jump .btn__arrow { rotate: 90deg; }
      .motion .kit-hero__badge { animation: fw-rise 650ms var(--ease-out) 200ms both; }
      .kit-card.kit-ticket { padding: 0; overflow: visible; border-radius: 20px; background: var(--white); box-shadow: none; }
      .kit-ticket__head { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 18px; align-items: center; padding: clamp(22px, 2.4vw, 30px); border-radius: 20px 20px 0 0; background: var(--ink); color: var(--white); }
      .kit-ticket__tag { display: inline-flex; align-items: center; gap: 6px; margin: 0; padding: 5px 11px; border-radius: 999px; background: var(--yellow); color: var(--ink); font-size: 12px; font-weight: 700; line-height: 1.2; letter-spacing: 0.08em; text-transform: uppercase; }
      .kit-ticket__tag svg { width: 14px; height: 14px; }
      .kit-card.kit-ticket h2 { margin: 14px 0 0; font-size: clamp(23px, 2.1vw, 28px); line-height: 1.15; color: var(--white); }
      .kit-ticket__meta { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 12px 0 0; padding: 0; list-style: none; font-size: 14px; color: var(--white); }
      .kit-ticket__meta li { display: inline-flex; align-items: center; gap: 7px; }
      .kit-ticket__meta li::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--pink); }
      .kit-ticket__cover { display: flex; flex-direction: column; justify-content: space-between; width: 96px; aspect-ratio: 3 / 4; padding: 11px 10px; border-radius: 8px; background: var(--yellow); color: var(--ink); transform: rotate(6deg); transition: transform var(--dur) var(--ease-spring); }
      .kit-ticket:hover .kit-ticket__cover { transform: rotate(2deg) translateY(-3px); }
      .kit-ticket__cover img { display: block; box-sizing: content-box; width: 52px; height: auto; padding: 3px 5px; border-radius: 4px; background: var(--white); } /* the logo's yellow "ai" box needs a white tag on the yellow cover */
      .kit-ticket__cover b { font-family: var(--font-display); font-size: 12px; font-weight: 600; line-height: 1.15; }
      .kit-ticket__cover i { display: block; height: 3px; margin-top: 4px; border-radius: 2px; background: rgb(26 26 26 / 0.18); }
      .kit-ticket__cover i + i { width: 70%; }
      .kit-ticket__body { position: relative; padding: 22px clamp(14px, 1.8vw, 22px) 20px; }
      .kit-ticket__body::before, .kit-ticket__body::after { content: ""; position: absolute; top: -11px; width: 22px; height: 22px; border-radius: 50%; background: var(--pink-tint); }
      .kit-ticket__body::before { left: -11px; }
      .kit-ticket__body::after { right: -11px; }
      .kit-ticket__body iframe { display: block; width: 100%; border: 0; background: transparent; }
      .kit-ticket__foot { margin: 6px 4px 0; padding-top: 16px; border-top: 1px dashed var(--line); text-align: center; font-size: 13px; line-height: 1.5; }
      .kit-ticket__foot p { margin: 0; }
      .kit-ticket__foot p:first-child { display: flex; justify-content: center; align-items: flex-start; gap: 8px; font-weight: 600; }
      .kit-ticket__foot svg { flex: none; width: 16px; height: 16px; margin-top: 1px; }
      .kit-ticket__foot p + p { margin-top: 6px; }
      .kit-ticket__foot a { text-decoration: underline; text-underline-offset: 3px; }
      .kit-ticket__foot a:hover { color: var(--rose, var(--ink)); }
      @media (max-width: 900px) {
        .kit-hero__grid.kit-hero__grid--fw { grid-template-areas: "copy" "card"; }
        .kit-hero__jump { display: inline-flex; margin-top: 28px; }
      }
      @media (max-width: 420px) { .kit-ticket__cover { width: 76px; padding: 9px 8px; } .kit-ticket__cover img { width: 42px; } .kit-ticket__cover b { font-size: 10px; } }
      @media (prefers-reduced-motion: reduce) { .kit-ticket__cover, .kit-ticket:hover .kit-ticket__cover { transition: none; transform: rotate(6deg); } }
    </style>`;

// The four things the kit has you do (the old tick list), each with the "What's inside" icon of
// the matching section (task selector, readiness map, prompt starter, small test plan)
const ICON = (inner) => `<span class="bw-kitmeta__icon" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false">${inner}</svg></span>`;
const STEPS = [
  ["Pick one task", "Task worksheet",
    '<rect pathLength="1" class="route__node" x="19" y="7" width="23" height="8" rx="2.5"/><rect pathLength="1" class="route__node" x="19" y="20" width="23" height="8" rx="2.5"/><rect pathLength="1" class="route__node" x="19" y="33" width="23" height="8" rx="2.5"/><circle pathLength="1" class="route__head route__head--lead" cx="9" cy="24" r="5.5"/><path pathLength="1" class="journey-strip__tick" d="M6.5 24l2 2 3.5-3.5"/>'],
  ["Map the work", "Workflow map",
    '<path pathLength="1" class="route__node" d="M5 12 17 7l14 5 12-5v29l-12 5-14-5-12 5Z"/><path pathLength="1" class="route__line" d="M17 7v29M31 12v29"/><circle pathLength="1" class="route__head route__head--lead" cx="24" cy="22" r="3.5"/>'],
  ["Copy, then adapt", "Prompt starter",
    '<path pathLength="1" class="route__node" d="M6 8h36v24H20l-9 8v-8H6Z"/><path pathLength="1" class="route__node route__node--lead" d="M24 12l2 4.6 4.6 2-4.6 2L24 25l-2-4.4-4.6-2 4.6-2Z"/>'],
  ["Start small", "Test plan",
    '<path pathLength="1" class="route__node" d="M20 5v13L9 38a3.4 3.4 0 0 0 3 5h24a3.4 3.4 0 0 0 3-5L28 18V5Z"/><path pathLength="1" class="route__node route__node--lead" d="M14 29h20l5 9a3.4 3.4 0 0 1-3 5H12a3.4 3.4 0 0 1-3-5Z"/><path pathLength="1" class="route__line" d="M16 5h16"/>'],
];
// The heading, with a small pile of tool tiles after "collecting" and the yellow highlight sweeping in. Only when the root page's
// heading is still this sentence; otherwise it is used as it is.
const H1_TEXT = "Stop collecting AI tools. Start with one useful workflow.";
const H_TOOLS = [
  '<path d="M12 4l1.8 4.6 4.6 1.8-4.6 1.8L12 17l-1.8-4.8-4.6-1.8 4.6-1.8Z"/>',
  '<path d="M5 6.5h14v9.5H11l-4.5 3.5V16H5Z"/>',
  '<rect x="5" y="5" width="5.5" height="5.5" rx="1.4"/><rect x="13.5" y="5" width="5.5" height="5.5" rx="1.4"/><rect x="5" y="13.5" width="5.5" height="5.5" rx="1.4"/><rect x="13.5" y="13.5" width="5.5" height="5.5" rx="1.4"/>',
];
const H1 = `<h1 id="kit-title">Stop <span class="kit-h__nb">collecting <span class="kit-h__tools" aria-hidden="true">${H_TOOLS.map((d, i) => `<i style="--i:${i}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${d}</svg></i>`).join("")}</span></span> AI tools. Start with one <span class="kit-hero__hl">useful </span><span class="kit-h__nb"><span class="kit-hero__hl" style="--d:850ms">workflow</span>.</span></h1>`;

function heroCopy(rootCopy) {
  let h1 = (rootCopy.match(/<h1\b[\s\S]*?<\/h1>/) || [""])[0];
  if (h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() === H1_TEXT) h1 = H1;
  const lead = (rootCopy.match(/<p class="phero__lead">[\s\S]*?<\/p>/) || [""])[0];
  return `<div class="kit-hero__copy">
          <p class="bw-kitmeta__sticker kit-hero__badge">Free guide for non-technical founders and professionals</p>
          ${h1}
          ${lead}
          <div class="kit-flow">
            <ol class="kit-flow__list" aria-label="What the kit walks you through">
              ${STEPS.map(([title, part, svg], i) => `<li style="--i:${i}">${i ? '<span class="kit-flow__in" aria-hidden="true"></span>' : ""}${ICON(svg)}<span class="kit-flow__t"><b>${title}</b><small>${part}</small></span></li>`).join("\n              ")}
            </ol>
          </div>
          <a class="btn btn--sheen kit-hero__jump" href="#get-the-kit">Get the free kit <span class="btn__arrow" aria-hidden="true"></span></a>
          <script data-fw-kit-stick>
            (function () {
              var c = document.querySelector(".kit-hero__grid--fw .kit-hero__copy");
              if (!c) return;
              function fit() {
                var h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 76;
                c.style.setProperty("--kit-stick", Math.min(h + 24, window.innerHeight - c.offsetHeight - 24) + "px");
              }
              fit();
              addEventListener("resize", fit);
              addEventListener("load", fit);
              if (window.ResizeObserver) new ResizeObserver(fit).observe(c);
            })();
          </script>
        </div>`;
}

function card(rootCard, cdn) {
  const attr = (name) => (rootCard.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1] || "";
  const src = attr("src"), formId = attr("data-form-id") || src.split("/").pop(), title = attr("title") || "Free AI Workflow Starter Kit";
  return `<div class="kit-card kit-ticket" id="get-the-kit">
          <div class="kit-ticket__head">
            <div>
              <p class="kit-ticket__tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>Free PDF</p>
              <h2>Get your free starter kit</h2>
              <ul class="kit-ticket__meta">
                <li>7 short sections</li>
                <li>Printable worksheets</li>
                <li>Prompt sheet</li>
              </ul>
            </div>
            <div class="kit-ticket__cover" aria-hidden="true">
              <img src="${cdn}/assets/icons/wordmark.svg" alt="" width="58" height="12">
              <div><b>AI Workflow Starter Kit</b><i></i><i></i></div>
            </div>
          </div>
          <div class="kit-ticket__body">
            <iframe
              src="${src}"
              style="height:${START_HEIGHT}px"
              id="inline-${formId}"
              data-fw-size
              scrolling="no"
              data-layout="{'id':'INLINE'}"
              data-trigger-type="alwaysShow"
              data-trigger-value=""
              data-activation-type="alwaysActivated"
              data-activation-value=""
              data-deactivation-type="neverDeactivate"
              data-deactivation-value=""
              data-form-name="${title}"
              data-height="${START_HEIGHT}"
              data-layout-iframe-id="inline-${formId}"
              data-form-id="${formId}"
              title="${title}">
            </iframe>
            <div class="kit-ticket__foot">
              <p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>Free download. No card required. Designed for non-technical learners.</p>
              <p><a href="/privacy">Privacy Policy</a> | <a href="/terms">Terms of Service</a></p>
            </div>
          </div>
        </div>`;
}

// html with the Starter Kit hero redesigned (unchanged when the page has no kit card). cdn: the
// asset host the page's links use ("" in the local test pages).
export function withKitPage(html, cdn) {
  const c = html.match(ROOT_CARD);
  if (!c) return html;
  html = html.slice(0, c.index) + card(c[1], cdn) + html.slice(c.index + c[0].length);
  html = html.replace(ROOT_PREVIEW, "");
  html = html.replace(ROOT_COPY, (all) => heroCopy(all));
  return html.replace('<div class="wrap kit-hero__grid">', `${CSS}\n      <div class="wrap kit-hero__grid kit-hero__grid--fw">`);
}
