// Email card HTML for one feed item (<content:encoded>), matching email-templates/12-newsletter-rss-preview.html.
// GHL's RSS loop ({{#rss_items}} … {{{rss_item.content}}} … {{/rss_items}}) only gets each item's content, so the
// layout lives here: email-safe tables, inline styles, Poppins/Inter with fallbacks, black text only.
// The first event and the first resource also carry their section heading, so one loop renders two sections.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const P = "font-family:Poppins,'Helvetica Neue',Helvetica,Arial,sans-serif;";
const I = "font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;";
const INK = "color:#1A1A1A;";
const KIND = `${I}font-size:12px;line-height:16px;font-weight:600;letter-spacing:1px;text-transform:uppercase;${INK}`;
const META = `${I}font-size:14px;line-height:20px;font-weight:600;${INK}`;

const iconRow = (src, html, style, mb) => !src ? `<p style="margin:0 0 ${mb}px 0;${style}">${html}</p>` :
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 ${mb}px 0;"><tr><td width="24" valign="middle" style="width:24px;"><img src="${src}" width="24" height="24" alt="" style="display:block;width:24px;height:24px;"></td><td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td><td valign="middle" style="${style}">${html}</td></tr></table>`;
const link = (u, t) => `<a href="${esc(u)}" target="_blank" style="${P}font-size:15px;line-height:22px;font-weight:600;${INK}text-decoration:underline;">${esc(t)}</a>`;
const title = (u, t, size) => `<h3 style="margin:0 0 8px 0;${P}font-size:${size}px;line-height:${size + 7}px;font-weight:600;${INK}"><a href="${esc(u)}" target="_blank" style="${INK}text-decoration:none;">${esc(t)}</a></h3>`;
const heading = (eyebrow, h2) => `<p style="margin:0 0 6px 0;${P}font-size:12px;line-height:16px;font-weight:600;letter-spacing:2px;text-transform:uppercase;${INK}">${eyebrow}</p><h2 style="margin:6px 0 22px 0;${P}font-size:24px;line-height:32px;font-weight:600;${INK}">${h2}</h2>`;
const img = (it, w, r) => it.image ? `<a href="${esc(it.url)}" target="_blank"><img src="${esc(it.image)}" width="${w}" alt="${esc(it.image_alt)}" style="display:block;width:${w === 520 ? "100%" : w + "px"};max-width:100%;height:auto;border-radius:${r}px;"></a>` : "";
const btn = (u, t) => `<a href="${esc(u)}" target="_blank" style="display:inline-block;background-color:#FBC522;${INK}${P}font-size:16px;font-weight:600;line-height:20px;text-decoration:none;padding:15px 30px;border-radius:8px;">${esc(t)}</a>`;

// Side-by-side row: thumbnail left, text right (stacks on phones via the template's .fw-stack rule).
const row = (it, w, body, top) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:${top ? "24px" : "0"} 0 24px 0;${top ? "border-top:1px solid #E6E1D8;" : ""}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${it.image ? `
<td class="fw-stack fw-thumb" width="${w}" valign="top" style="width:${w}px;">${img(it, w, 10)}</td>
<td class="fw-stack fw-gap" width="20" style="width:20px;font-size:0;line-height:0;">&nbsp;</td>` : ""}
<td class="fw-stack" valign="top">${body}</td>
</tr></table></td></tr></table>`;

export function emailCard(it, { icons = "", first = false } = {}) {
  const ic = (n) => (icons ? `${icons}/assets/email/${n}` : "");
  if (it.kind === "event") {
    const body = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;"><tr><td bgcolor="#EFACBA" style="background-color:#EFACBA;border-radius:6px;padding:6px 10px;${P}font-size:12px;line-height:14px;font-weight:600;letter-spacing:1.5px;${INK}">${esc(it.chip)}</td></tr></table>
${title(it.url, it.title, 18)}
${it.time ? iconRow(ic("icon-clock-pink.png"), esc(it.time), META, 6) : ""}${it.location ? iconRow(ic("icon-pin-yellow.png"), esc(it.location), META, 10) : ""}
${it.summary ? `<p style="margin:0 0 10px 0;${I}font-size:15px;line-height:23px;${INK}">${esc(it.summary)}</p>` : ""}
${link(it.url, it.cta)}`;
    return (first ? heading("Upcoming workshops &amp; events", "Learn with us, live") : "") + row(it, 180, body, !first);
  }
  const kind = it.categories.slice(1).map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(" · ");
  if (first) {
    return heading("Featured resources", "New to read this week") + img(it, 520, 12) + `<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
${kind ? iconRow(ic("icon-book-yellow.png"), esc(kind), KIND, 10) : ""}
${title(it.url, it.title, 22)}
${it.summary ? `<p style="margin:0 0 20px 0;${I}font-size:16px;line-height:26px;${INK}">${esc(it.summary)}</p>` : ""}
${btn(it.url, it.cta === "Read more" ? "Read the guide" : it.cta)}<div style="height:28px;line-height:28px;font-size:0;">&nbsp;</div>`;
  }
  const body = `${kind ? iconRow(ic("icon-book-yellow.png"), esc(kind), KIND, 10) : ""}
${title(it.url, it.title, 18)}
${it.summary ? `<p style="margin:0 0 10px 0;${I}font-size:15px;line-height:23px;${INK}">${esc(it.summary)}</p>` : ""}
${link(it.url, it.cta)}`;
  return row(it, 200, body, true);
}
