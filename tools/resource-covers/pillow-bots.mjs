// Pillow Bots: the five named AI teammates in "Goodbye Prompt Engineering? Hello, Role Engineering."
// Original Faith Works characters (soft, pillow-like shapes with two pill eyes), drawn only in the
// brand palette. They are not xAI's avatars. Each one is a standalone SVG used by the article's
// group-chat section and embedded in the cover (covers.html, scene `roles`).
//   node tools/resource-covers/pillow-bots.mjs   writes assets/images/resources/<slug>/bot-<id>.svg
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const C = { pink: "#EFACBA", pinkTint: "#F7D6DD", yellow: "#FBC522", white: "#FAF8F4", ink: "#1A1A1A" };

// viewBox 0 0 120 120; each body sits on the same baseline so a row of Bots lines up
export const BOTS = [
  { id: "maya", name: "Maya", role: "Marketing Strategist", fill: C.pink, eye: C.ink, cheek: "#FFFFFF", // pillow with pinched corners
    body: "M16 24 Q60 12 104 24 Q114 62 104 100 Q60 110 16 100 Q6 62 16 24Z", eyes: [[48, 58], [72, 58]] },
  { id: "alex", name: "Alex", role: "Sales Assistant", fill: C.yellow, eye: C.ink, cheek: C.pink, // tilted bean
    body: "M30 22 C58 8 102 16 106 54 C109 88 84 106 54 104 C22 102 10 80 12 56 C13 40 19 29 30 22Z", eyes: [[50, 56], [74, 54]] },
  { id: "nova", name: "Nova", role: "Research Analyst", fill: C.ink, eye: C.white, cheek: C.pink, // tall marshmallow
    body: "M30 16 H90 Q100 16 100 30 V90 Q100 104 86 104 H34 Q20 104 20 90 V30 Q20 16 30 16Z", eyes: [[50, 54], [70, 54]] },
  { id: "sam", name: "Sam", role: "Operations Manager", fill: C.white, eye: C.ink, cheek: C.pink, // wide cushion
    body: "M10 64 C10 34 24 28 60 28 C96 28 110 34 110 64 C110 94 96 100 60 100 C24 100 10 94 10 64Z", eyes: [[48, 60], [72, 60]] },
  { id: "pixel", name: "Pixel", role: "Content Creator", fill: C.pinkTint, eye: C.ink, cheek: C.pink, spark: true, // round puff with a spark
    body: "M60 18 C88 18 106 38 106 64 C106 92 88 104 60 104 C32 104 14 92 14 64 C14 38 32 18 60 18Z", eyes: [[49, 60], [71, 60]] },
];

// The inner drawing (no <svg> wrapper), so the cover can place it as a <symbol>
export function botArt(b, uid = b.id) {
  const pill = ([x, y]) => `<rect x="${x - 4.5}" y="${y - 9}" width="9" height="18" rx="4.5" fill="${b.eye}" transform="rotate(8 ${x} ${y})"/>`;
  const cheeks = [[b.eyes[0][0] - 12, b.eyes[0][1] + 15], [b.eyes[1][0] + 12, b.eyes[1][1] + 15]]
    .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="3.6" fill="${b.cheek}" fill-opacity="${b.fill === C.pink ? 0.55 : 0.85}"/>`).join("");
  const spark = b.spark ? `<path d="M97 10 l3.2 8 8 3.2 -8 3.2 -3.2 8 -3.2 -8 -8 -3.2 8 -3.2Z" fill="${C.yellow}"/>` : "";
  return `<defs><radialGradient id="sheen-${uid}" cx="0.32" cy="0.22" r="0.75"><stop offset="0" stop-color="#FFFFFF" stop-opacity="${b.fill === C.ink ? 0.22 : 0.55}"/><stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="base-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.6" stop-color="${C.ink}" stop-opacity="0"/><stop offset="1" stop-color="${C.ink}" stop-opacity="${b.fill === C.ink ? 0 : 0.08}"/></linearGradient></defs>` +
    `<ellipse cx="60" cy="110" rx="38" ry="5" fill="${C.ink}" fill-opacity="0.1"/>` +
    `<path d="${b.body}" fill="${b.fill}"/>` + (b.fill === C.white ? `<path d="${b.body}" fill="none" stroke="${C.ink}" stroke-opacity="0.12" stroke-width="1.5"/>` : "") +
    `<path d="${b.body}" fill="url(#sheen-${uid})"/><path d="${b.body}" fill="url(#base-${uid})"/>` +
    b.eyes.map(pill).join("") + cheeks + spark;
}
export const botSvg = (b) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${b.name}, ${b.role}">${botArt(b)}</svg>\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(dirname(fileURLToPath(import.meta.url)), "../../assets/images/resources/goodbye-prompt-engineering-hello-role-engineering");
  mkdirSync(out, { recursive: true });
  for (const b of BOTS) { writeFileSync(join(out, `bot-${b.id}.svg`), botSvg(b)); console.log(`bot-${b.id}.svg`); }
}
