// POC: render the Resources listing in the browser from the live CMS, reusing the site's own
// renderers (tools/content.mjs toRenderData + tools/render.mjs resourceCards). Nothing here
// touches the production build. Usage: FWResources.mount(el, { cmsUrl, assetBase })
import { toRenderData } from "../../tools/content.mjs";
import * as R from "../../tools/render.mjs";
import { checkSnapshot } from "../../cms/shared/public.mjs";

const rootRel = (html, base) => html.replace(/(\s(?:src|srcset|data-src|data-srcset|poster))="([^"]*)"/g, (all, attr, v) =>
  `${attr}="${v.split(",").map((s) => { const [u, ...rest] = s.trim().split(/\s+/); return [u.startsWith("/") && !u.startsWith("//") ? base + u : u, ...rest].join(" "); }).join(", ")}"`);

// The search and Type filter from js/main.js §15, scoped to the mounted element
function wire(el) {
  const tools = el.querySelector("[data-rcards-tools]"); if (!tools) return;
  const cards = [...el.querySelectorAll("[data-rcards-list] > li")], none = el.querySelector("[data-rcards-none]");
  const search = tools.querySelector("[data-rcards-search]"), chips = [...tools.querySelectorAll("[data-type]")];
  let type = ""; tools.hidden = false;
  const apply = () => {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean); let shown = 0;
    for (const c of cards) { const ok = (!type || c.dataset.type === type) && words.every((w) => (c.dataset.search || "").includes(w)); c.hidden = !ok; if (ok) shown++; }
    if (none) none.hidden = shown > 0;
  };
  chips.forEach((chip) => chip.addEventListener("click", () => { type = chip.dataset.type; chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip))); apply(); }));
  search.addEventListener("input", apply);
}

export async function mount(el, { cmsUrl, assetBase = "" }) {
  try {
    const res = await fetch(`${cmsUrl.replace(/\/$/, "")}/api/public/content`, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`CMS answered HTTP ${res.status}`);
    const snap = await res.json();
    const problems = checkSnapshot(snap);
    if (problems.length) throw new Error(problems.join(" "));
    const data = toRenderData(snap);
    R.init(data);
    el.innerHTML = rootRel(R.resourceCards(), assetBase.replace(/\/$/, ""));
    wire(el);
    el.dispatchEvent(new CustomEvent("fw:rendered", { detail: { count: data.articles.length }, bubbles: true }));
  } catch (e) {
    el.innerHTML = `<p class="small">Resources could not be loaded right now. Please try again shortly.</p>`;
    console.error("[fw-resources]", e);
  }
}
