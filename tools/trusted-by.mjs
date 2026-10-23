// The homepage "Trusted by" logo strip, from src/data/trusted-by.json. A real logo is an <img>
// shown in monochrome; a placeholder is a typographic mark (glyph + lettering). The list is
// written twice, the copy hidden from assistive technology, so the CSS loop (css/style.css §10b)
// can slide exactly one set's width and start over without a jump.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./layout.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(ROOT, "src/data/trusted-by.json"), "utf8"));
const MARKS = new Set(["circle", "square", "diamond", "ring", "bars", "none"]);
const STYLES = new Set(["caps", "wide", "bold", "light"]);

function logo(l, hidden) {
  if (l.logo) return `<li class="trusted__logo trusted__logo--image"><img src="${esc(l.logo)}" alt="${hidden ? "" : esc(l.name)}" loading="lazy" decoding="async"></li>`;
  const mark = MARKS.has(l.mark) ? l.mark : "none";
  const style = STYLES.has(l.style) ? l.style : "caps";
  return `<li class="trusted__logo trusted__logo--${style}">${mark === "none" ? "" : `<span class="trusted__mark trusted__mark--${mark}" aria-hidden="true"></span>`}<span class="trusted__name">${esc(l.name)}</span></li>`;
}

export function trustedBy() {
  const shown = (data.logos || []).filter((l) => l.show !== false && l.name);
  if (!shown.length) return "";
  const set = (hidden) => `<ul class="trusted__set" role="list"${hidden ? ` aria-hidden="true"` : ` aria-label="${esc(data.label || "Trusted by")}"`}>${shown.map((l) => logo(l, hidden)).join("")}</ul>`;
  return `<div class="trusted__track">${set(false)}${set(true)}</div>`;
}
