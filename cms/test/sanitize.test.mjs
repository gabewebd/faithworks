// HTML/CSS sanitizer: known XSS vectors are neutralized; clean markup round-trips unchanged.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizeHtml, safeUrl } from "../shared/sanitize-html.mjs";
import { sanitizeCss, scopeCss } from "../shared/sanitize-css.mjs";

const clean = (h, o) => sanitizeHtml(h, o).html;
const DANGER = /<script|onerror|onload|onclick|onmouseover|javascript:|vbscript:|<iframe(?![^>]*youtube)|srcdoc|<object|<embed|<base|<meta|<form|data:text\/html|<math|<template/i;

const VECTORS = [
  `<script>alert(1)</script>`,
  `<img src=x onerror=alert(1)>`,
  `<img src="x" /onerror=alert(1)>`,
  `<svg onload=alert(1)>`,
  `<svg><script>alert(1)</script></svg>`,
  `<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>`,
  `<svg><use href="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+#x"/></svg>`,
  `<svg><animate onbegin=alert(1) attributeName=x dur=1s>`,
  `<svg><style><img src=x onerror=alert(1)></style></svg>`,
  `<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>`,
  `<a href="javascript:alert(1)">x</a>`,
  `<a href="jav&#x09;ascript:alert(1)">x</a>`,
  `<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>`,
  `<a href="javascript&colon;alert(1)">x</a>`,
  `<a href=" JaVaScRiPt:alert(1)">x</a>`,
  `<a href="vbscript:msgbox(1)">x</a>`,
  `<a href="data:text/html,<script>alert(1)</script>">x</a>`,
  `<iframe src="javascript:alert(1)"></iframe>`,
  `<iframe srcdoc="<script>alert(1)</script>"></iframe>`,
  `<iframe src="https://evil.example/"></iframe>`,
  `<object data="x.swf"></object><embed src="x.swf">`,
  `<base href="https://evil.example/">`,
  `<meta http-equiv="refresh" content="0;url=javascript:alert(1)">`,
  `<form action="https://evil.example"><input name=pw></form>`,
  `<div style="background:url(javascript:alert(1))">x</div>`,
  `<div style="width:expression(alert(1))">x</div>`,
  `<style>@import "javascript:alert(1)"; body{background:url("javascript:alert(1)")}</style>`,
  `<style></style><script>alert(1)</script>`,
  `<!-- --!><img src=x onerror=alert(1)> -->`,
  `<!--><img src=x onerror=alert(1)>-->`,
  `<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>`,
  `<template><img src=x onerror=alert(1)></template>`,
  `<scr<script>ipt>alert(1)</script>`,
  `<img src="data:image/svg+xml,<svg onload=alert(1)>">`,
  `<p title='"><script>alert(1)</script>'>x</p>`,
  `<a href=x title=a"onmouseover=alert(1)>x</a>`,
  `<textarea><img src=x onerror=alert(1)></textarea>`,
  `<title><img src=x onerror=alert(1)></title>`,
  `<xmp><img src=x onerror=alert(1)></xmp>`,
  `<img srcset="javascript:alert(1) 1x">`,
  `<video poster="javascript:alert(1)"></video>`,
  `<button formaction="javascript:alert(1)">x</button>`,
  `<div id="dataLayer">x</div>`,
  `<img src=x onerror=alert(1)`,
  `<![CDATA[<img src=x onerror=alert(1)>]]>`,
];

// Structural check of sanitized output: tag names, attribute names and URL attribute values.
function assertInert(out, input) {
  const msg = `not neutralized:\n  in:  ${input}\n  out: ${out}`;
  for (const m of out.matchAll(/<style>([^]*?)<\/style>/gi)) assert.ok(!m[1].includes("<"), `style breakout: ${out}`);
  const markup = out.replace(/<style>[^<]*<\/style>/gi, "");
  for (const tag of markup.matchAll(/<([a-zA-Z][^\s/>]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*\/?>/g)) {
    assert.ok(!/^(script|iframe|object|embed|base|meta|link|form|input|math|template|frame|frameset|animate|set|foreignobject)$/i.test(tag[1]) || (tag[1] === "iframe" && /youtube/.test(tag[2])), msg);
    for (const a of tag[2].matchAll(/\s+([^\s=>]+)(?:="([^"]*)")?/g)) {
      const [name, value = ""] = [a[1].toLowerCase(), a[2]];
      assert.ok(!name.startsWith("on") && !["srcdoc", "formaction", "action"].includes(name), msg);
      if (["href", "src", "poster", "srcset", "xlink:href", "cite"].includes(name)) {
        const decoded = value.replace(/&#x?([0-9a-f]+);?/gi, (_, n) => String.fromCodePoint(parseInt(n, /x/i.test(_) ? 16 : 10))).replace(/&colon;/gi, ":").replace(/[\s\u0000-\u001f]/g, "");
        assert.ok(!/(javascript|vbscript|data:text|data:image\/svg)/i.test(decoded), msg);
      }
      if (name === "style") assert.ok(!/javascript:|expression\(/i.test(value), msg);
    }
  }
  // Nothing outside a tag or attribute may form a tag: any "<" left in text is escaped.
  assert.ok(!/<(?![a-zA-Z/])/.test(markup), msg);
}

test("XSS vectors are neutralized", () => {
  for (const v of VECTORS) {
    const out = clean(v);
    assertInert(out, v);
    assert.ok(!DANGER.test(out.replace(/="[^"]*"/g, '=""').replace(/<style>[^<]*<\/style>/gi, "")) || /youtube/.test(out), `suspicious markup:\n  in:  ${v}\n  out: ${out}`);
  }
});

test("output is stable: sanitizing twice changes nothing", () => {
  for (const v of VECTORS) assert.equal(clean(clean(v)), clean(v), v);
});

test("clean content round-trips exactly (all published article bodies)", () => {
  const seed = JSON.parse(readFileSync(new URL("../fixtures/seed.json", import.meta.url), "utf8"));
  const bodies = seed.resources.map((r) => r.body_html).filter(Boolean);
  assert.ok(bodies.length >= 7);
  for (const b of bodies) {
    const r = sanitizeHtml(b);
    assert.equal(r.html, b);
    assert.deepEqual(r.report, []);
  }
});

test("typical landing-page markup is preserved", () => {
  const html = `<section class="hero hero--pink" id="top" data-reveal aria-labelledby="h"><div class="wrap"><h1 id="h">Learn <em>AI</em></h1><p class="lead">Text &amp; more</p><a class="btn" href="/learn/" target="_blank" rel="noopener">Go <span aria-hidden="true">↗</span></a><button type="button" class="btn">Open</button><picture><source type="image/webp" srcset="/a-480.webp 480w, /a-960.webp 960w" sizes="100vw"><img src="/a-960.jpg" alt="A" width="960" height="540" loading="lazy" style="object-position:50% 40%"></picture><table><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td colspan="2">1</td></tr></tbody></table><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg><iframe src="https://www.youtube-nocookie.com/embed/abc" title="Video" loading="lazy" allowfullscreen></iframe></div></section>`;
  assert.equal(clean(html), html);
});

test("reports what it removed instead of failing silently", () => {
  const { report } = sanitizeHtml(`<script>x</script><p onclick="x">a</p><form><input></form><custom-el>t</custom-el>`);
  const messages = report.map((r) => r.message).join("\n");
  assert.match(messages, /script/);
  assert.match(messages, /event handler/);
  assert.match(messages, /form/);
  assert.match(messages, /custom-el/);
});

test("target=_blank links get rel=noopener", () => {
  assert.equal(clean(`<a href="https://x.example" target="_blank">x</a>`), `<a href="https://x.example" target="_blank" rel="noopener">x</a>`);
});

test("styles can be extracted for scoping", () => {
  const r = sanitizeHtml(`<style>.a{color:red}</style><p class="a">x</p>`, { extractStyles: true });
  assert.equal(r.html, `<p class="a">x</p>`);
  assert.equal(r.css, ".a{color:red}");
});

test("URL checks", () => {
  for (const ok of ["https://faithph.ai", "/learn/", "#register", "mailto:a@b.co", "tel:+63 2 123", "relative/path.html"]) assert.ok(safeUrl(ok), ok);
  for (const bad of ["javascript:x", "JAVASCRIPT:x", "java\nscript:x", "data:text/html,x", "vbscript:x", "&#106;avascript:x"]) assert.ok(!safeUrl(bad), bad);
});

test("CSS: dangerous constructs removed, cannot close its <style> element", () => {
  const { css, removed } = sanitizeCss(`a{background:url(javascript:alert(1))} b{width:expression(1)} </style><script>alert(1)</script> c{background:url(/ok.png)} @import url("http://x.example/a.css");`);
  assert.ok(!css.includes("<"));
  assert.ok(!/javascript:|expression\(/i.test(css));
  assert.match(css, /url\(\/ok\.png\)/);
  assert.ok(removed.length >= 3);
});

test("CSS scoping keeps rules inside the content wrapper", () => {
  const css = `body{margin:0} html body .x{color:red} :root{--c:1} .hero h1, .hero p{font-size:2rem} @media (max-width:600px){.hero{padding:0}} @keyframes spin{from{transform:rotate(0)}to{transform:rotate(1turn)}} a[href*="a,b"]{x:y} /* c{d} */`;
  const out = scopeCss(css, ".s");
  assert.match(out, /^\.s\{margin:0\}/);
  assert.match(out, /\.s \.x\{color:red\}/);
  assert.match(out, /\.s\{--c:1\}/);
  assert.match(out, /\.s \.hero h1, \.s \.hero p\{/);
  assert.match(out, /@media \(max-width:600px\)\{\.s \.hero\{padding:0\}\}/);
  assert.match(out, /@keyframes spin\{from\{transform:rotate\(0\)\}to\{/, "keyframes untouched");
  assert.match(out, /\.s a\[href\*="a,b"\]\{x:y\}/);
});
