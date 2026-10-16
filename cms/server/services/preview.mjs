// Page preview with the website's real templates (tools/render.mjs + tools/layout.mjs).
// Nothing is saved or published. The page is shown in a sandboxed iframe without scripts,
// and the HTML/CSS go through the same sanitizer as published content, so the preview is
// exactly what publishing would produce.
//   draft (default): the editor's current, unsaved values;
//   live: the version the website shows now (the published copy), for comparison.
import { COLLECTIONS } from "../../shared/schema.mjs";
import { normalize } from "../../shared/validate.mjs";
import { buildSnapshot } from "../../shared/public.mjs";
import { sanitizeHtml, describeReport } from "../../shared/sanitize-html.mjs";
import { bylineOf, isPastEvent } from "../../shared/page-doc.mjs";
import { HttpError } from "../http.mjs";

let site; // lazily imported site renderer
async function siteModules() {
  site ||= Promise.all([import("../../../tools/render.mjs"), import("../../../tools/layout.mjs"), import("../../../tools/content.mjs")])
    .then(([R, L, C]) => ({ R, L, C }));
  return site;
}

export function createPreview({ store, cfg }) {
  return {
    async render(user, collection, { id, data, live = false }) {
      if (!COLLECTIONS[collection]) throw new HttpError(404, "Unknown content type.", "not_found");
      const tabs = ["programs", "events", "resources", "testimonials", "settings", "tags", "users", "published"];
      const t = await store.listMany(tabs, { fresh: false });
      let snap, rec, report = [];
      if (live) {
        const row = t.published.find((p) => p.id === `${collection}:${id}` && p.state === "live");
        if (!row) throw new HttpError(404, "This item is not on the website yet, so there is no live version to show.", "not_live");
        snap = buildSnapshot({ published: t.published, tags: t.tags, view: "published", iframeHosts: cfg.iframeHosts });
        if (!snap.settings) snap.settings = buildSnapshot({ records: { settings: t.settings }, view: "preview" }).settings;
        rec = row.payload;
        if (collection === "testimonials" && !snap.testimonials.some((x) => x.id === id)) snap.testimonials.push(rec);
      } else {
        rec = { ...normalize(collection, data || {}), id: id || "preview", status: "draft", version: 0 };
        // Hidden and legacy values the editor does not send come from the stored record (as on save)
        const stored = t[collection].find((r) => r.id === rec.id);
        if (stored) for (const fd of COLLECTIONS[collection].fields) if ((fd.hidden || fd.legacy || fd.computed) && !(fd.key in (data || {}))) rec[fd.key] = stored[fd.key] ?? rec[fd.key];
        const names = Object.fromEntries(t.users.map((u) => [u.id, u.name || u.id.split("@")[0]]));
        if ("byline" in rec) rec.byline = Array.isArray(rec.authors) && rec.authors.length ? bylineOf({ authors: rec.authors }, names) : rec.author || "";
        report = describeReport(sanitizeHtml(rec.body_html || "", { iframeHosts: cfg.iframeHosts }).report);
        t[collection] = [...t[collection].filter((r) => r.id !== rec.id), rec];
        snap = buildSnapshot({ records: t, tags: t.tags, view: "preview", iframeHosts: cfg.iframeHosts });
        if (collection === "testimonials" && !snap.testimonials.some((x) => x.id === rec.id)) {
          snap.testimonials.push(buildSnapshot({ records: { testimonials: [{ ...rec, consent_status: "obtained" }] }, view: "preview" }).testimonials[0]);
        }
      }
      if (!snap.settings) throw new HttpError(409, "Site settings are missing, so pages cannot be previewed.", "no_settings");

      let mods;
      try { mods = await siteModules(); } catch (e) { throw new HttpError(501, `Page preview is unavailable on this deployment (${e.message}).`, "no_renderer"); }
      const { R, L, C } = mods;
      const d = C.toRenderData(snap);
      d.site.staging = true; // always shows the "Staging preview" bar
      R.init(d);
      const rid = rec.id;
      let page;
      if (collection === "programs") page = R.programPage(d.programs.find((p) => p.id === rid));
      else if (collection === "events") {
        const e = d.events.find((x) => x.rid === rid);
        if (e?.hasPage) page = R.eventPage(e);
        else if (e) {
          d.events = [e];
          page = { title: rec.title, description: rec.summary, path: "/workshops/", nav: "learn", body: `<section class="section wrap"><p class="eyebrow">This event has no page of its own (no page content). How it appears on /workshops/</p>${R.events(isPastEvent(e.rec) ? "past" : "upcoming")}</section>` };
        }
      } else if (collection === "resources") {
        const a = d.articles.find((x) => x.rid === rid), r = d.resources.find((x) => x.rid === rid);
        if (a) page = R.articlePage(a);
        else if (r?.hasPage) page = R.resourcePage(r);
        else if (r) { d.resources = [r]; page = { title: rec.title, description: rec.summary, path: "/resources/", nav: "resources", body: `<section class="section wrap"><p class="eyebrow">This resource has no page of its own (no page content). How its card appears on /resources/</p>${R.resourceList()}</section>` }; }
      } else if (collection === "testimonials") {
        const s = d.stories.find((x) => x.id === rid);
        page = { title: "Testimonial preview", description: "", path: "/", nav: "", body: `<section class="section wrap"><p class="eyebrow">How this testimonial card appears on the website</p><div class="quotes fw-quotes">${s ? R.storyCard(s, "pink") : "<p>This testimonial would not be shown (consent declined or withdrawn).</p>"}</div></section>` };
      } else throw new HttpError(400, "This content type has no page preview.", "no_preview");
      if (!page) throw new HttpError(422, "Add a title, slug and page content to preview this page.", "incomplete");
      let html = L.layout({ ...page, site: d.site });
      if (cfg.production) html = html.replace("<head>", `<head>\n  <base href="${cfg.publicSiteUrl}/">`);
      return { html, report, path: page.path, view: live ? "live" : "draft" };
    },
  };
}
