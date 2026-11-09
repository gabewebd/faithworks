// A CMS public snapshot (GET /api/public/content) → what runtime.js shows: the Resources page
// source, every resource's card data and its article page, rendered by the site's own code
// (tools/content.mjs toRenderData, tools/render.mjs articlePage) exactly as the public build does.
// build.mjs runs it in Node for the snapshot embed; the live embed carries it as a browser bundle
// and runs it on the content it fetches.
import { checkSnapshot } from "../../cms/shared/public.mjs";
import { toRenderData, currentUrl } from "../../tools/content.mjs";
import { cleanPath, layout } from "../../tools/layout.mjs";
import * as R from "../../tools/render.mjs";
import * as SEO from "../ghl-cms-pages/seo.mjs";
import { withNewsletter } from "../ghl-cms-pages/newsletter.mjs";
export { checkSnapshot };
export { mapSelectorList } from "./shadow-css.mjs";

const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

// A page-source call: {{name}} or {{name:arg}} as in templates/, or %%FW:name%% / %%FW:name:arg%%,
// the form build.mjs embeds (GHL treats {{…}} as its own merge fields and rewrites them).
const CALL = /\{\{\s*(\w+)(?::([\w.-]+))?\s*\}\}|%%FW:(\w+)(?::([\w.-]+))?%%/g;
export const tokenizeCalls = (src) => src.replace(CALL, (all, n1, a1, n2, a2) => `%%FW:${n1 || n2}${a1 || a2 ? `:${a1 || a2}` : ""}%%`);

// template: templates/resources.html (either call form); cdn: the asset host for root-relative images.
export function prepare(snap, { template, cdn }) {
  const data = toRenderData(snap);
  R.init(data);
  const origin = data.site.origin.replace(/\/$/, "");
  const listed = data.articles.filter((a) => a.href); // the cards tools/render.mjs resourceCards shows
  const pages = new Set(listed.filter((a) => a.doc).map((a) => a.slug));

  // /resources → #/resources, /resources/<slug> → #/resources/<slug> (when it has a page), other
  // site links → the site origin, root-relative images → the asset CDN.
  const fixHref = (u) => {
    if (!u.startsWith("/") || u.startsWith("//")) return u;
    const m = u.match(/^\/resources\/?([^/?#]*)\/?(?:[?#].*)?$/);
    if (m && !m[1]) return "#/resources";
    if (m && pages.has(m[1])) return `#/resources/${m[1]}`;
    return origin + cleanPath(currentUrl(u));
  };
  const fixSrc = (u) => (u.startsWith("/") && !u.startsWith("//") ? cdn + u : u);
  const localize = (html) => html
    .replace(/(\shref)="([^"]*)"/g, (all, attr, u) => `${attr}="${fixHref(u)}"`)
    .replace(/(\s(?:src|poster))="([^"]*)"/g, (all, attr, u) => `${attr}="${fixSrc(u)}"`)
    .replace(/(\ssrcset)="([^"]*)"/g, (all, attr, set) => `${attr}="${set.split(",").map((s) => { const [u, ...rest] = s.trim().split(/\s+/); return [fixSrc(u), ...rest].join(" "); }).join(", ")}"`);
  // As tools/build.mjs emit(): no empty sections, no HTML comments, no CMS field markers.
  const publish = (html) => localize(R.dropEmptySections(html).replace(/<!--[\s\S]*?-->\n?/g, "").replace(/\sdata-cms-[\w-]+(?:="[^"]*")?/g, ""));

  // The Resources page source, with the cards left for runtime.js to render from the data. In the
  // embed its hero is Faith Pink (the site's phero--pink).
  const body = template.replace(/^<!--meta[\s\S]*?-->\s*/, "").replace(/\bphero--stone\b/, "phero--pink");
  const listingHtml = publish(body.replace(CALL, (all, n1, a1, n2, a2) => {
    const name = n1 || n2;
    if (name === "resourceCards") return "%%FW_CARDS%%";
    if (typeof R[name] !== "function") throw new Error(`templates/resources.html: unknown renderer ${name}`);
    return R[name](a1 || a2);
  }));
  const pageOf = Object.fromEntries(listed.filter((a) => a.doc).map((a) => [a.slug, R.articlePage(a)]));
  const articles = Object.fromEntries(Object.entries(pageOf).map(([slug, p]) => [slug, publish(p.body)]));
  // What the site puts in each article's <head> (title, description, share image), for the embed
  // to set on the GHL page while the article is open.
  const seoOf = (a) => {
    const p = pageOf[a.slug];
    if (!p) return null;
    // The page's share image, else the largest copy of the article's cover photo
    const im = a.image, cover = im && (im.url || (im.base && im.widths ? `/${im.base.replace(/^\//, "")}-${im.widths[im.widths.length - 1]}.${(im.formats && im.formats[0]) || "jpg"}` : null));
    const src = p.image || cover, image = src ? (/^https?:\/\//i.test(src) ? src : cdn + src) : null;
    return { title: p.title, description: p.description || "", image, published: a.date || null, author: a.author || null };
  };
  const resources = listed.map((a) => ({
    seo: seoOf(a),
    slug: a.slug, title: a.title, summary: a.excerpt, category: a.category, type: a.type, typeLabel: a.typeLabel, topics: a.topics,
    date: a.date, author: a.author, readTime: a.readTime, featured: a.featured, href: fixHref(a.href), external: a.external, download: a.download,
    imageHtml: a.image ? localize(R.img(a.image, "__SIZES__", "rcard__img")) : null,
    record: omit(a.rec, ["body_html", "body_css"]), // the public CMS record, minus the page HTML rendered into `articles`
  }));
  // The site's own header and footer (tools/layout.mjs), cut from a page it lays out, with the
  // Resources item marked as the current section.
  const page = layout({ title: "", description: "", path: "/resources/", nav: "resources", body: "", site: data.site });
  const cut = (re) => { const m = page.match(re); if (!m) throw new Error(`tools/layout.mjs no longer renders ${re}`); return publish(m[0]); };
  const headerHtml = cut(/<header class="site-header"[\s\S]*?<\/header>/), footerHtml = withNewsletter(cut(/<footer class="site-footer"[\s\S]*?<\/footer>/)); // + the newsletter sign-up (GHL pages only)
  // The Resources page's own title, description and share tags (its <!--meta--> header, laid out
  // by tools/layout.mjs with the site's default share image), for build.mjs to write into the
  // embed's HTML: link-preview crawlers read only the HTML GHL sends. Canonical and og:url are
  // left out (they belong to the GHL page's own address), and so is robots (a staging setting).
  const meta = JSON.parse((template.match(/^<!--meta\s*([\s\S]*?)-->/) || [, "{}"])[1]);
  const head = layout({ title: meta.title || "Resources · Faith Works", description: meta.description || "", path: "/resources/", nav: "resources", body: "", site: data.site }).match(/<head>[\s\S]*?<\/head>/)[0];
  const headHtml = (head.match(/<title>[^<]*<\/title>|<meta (?:name="(?:description|twitter:[a-z]+)"|property="og:(?:type|site_name|title|description|image)")[^>]*>/g) || [])
    .map((t) => t.replace(/^<(title|meta)/, "<$1 data-fw-head")).join("\n")
    // Schema.org (seo.mjs, as the other GHL pages): Organization, WebSite, the Resources page as a
    // CollectionPage and its breadcrumb. runtime.js swaps the page and breadcrumb for an article's
    // while one is open, keeping the same Organization and WebSite @ids.
    + "\n" + SEO.ldScript(SEO.graph([
      SEO.organization({ ...data.site, logo: data.site.logo || "/assets/icons/wordmark.svg" }, origin, cdn, { withFounder: true }),
      SEO.website(data.site, origin),
      SEO.webPage({ origin, url: `${origin}/resources`, title: meta.title || "Resources · Faith Works", description: meta.description || undefined, type: "CollectionPage", trail: SEO.PAGE_TRAILS.resources }),
      SEO.breadcrumb(origin, `${origin}/resources`, SEO.PAGE_TRAILS.resources),
    ]), "data-fw-head data-fw-ld");
  // siteCards: the cards as the site renders them, so build.mjs knows which CSS they need
  return { origin, listingHtml, articles, resources, headerHtml, footerHtml, headHtml, siteCards: R.resourceCards(), generatedAt: snap.generated_at };
}
