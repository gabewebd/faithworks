// js/fw-live.js (bundled by build.mjs): on a GHL page, loads the CMS's published content
// (GET /api/public/content, open to any site, read only, no key) and brings each CMS-driven section
// up to date: event cards, the Workshops calendar, the events gallery, the testimonial stack, the
// event announcement bar and the latest resources (published only: drafts never reach this endpoint).
//
// The page arrives with those sections as they were when it was built, each between
// <!--fw-live:name:arg:hash--> and <!--/fw-live-->. That markup is the loading state, and it stays
// if the CMS cannot be reached. Here the same site renderers run on the live content; a section
// whose HTML hash differs (an event published, moved or now past, a testimonial added) is
// replaced, and js/main.js FW_SITE.mount gives the new markup its behaviour. A section the CMS
// leaves empty is hidden, and shown again when it has content. Nothing else on the page changes.
//
// Published content only: the endpoint serves the published view (drafts, archived and hidden
// records never reach it) and anything else is refused. The renderers escape every CMS text field.
import { checkSnapshot } from "../../cms/shared/public.mjs";
import { toRenderData } from "../../tools/content.mjs";
import * as R from "../../tools/render.mjs";
import { finish, hash, LIVE, START, END, startMark } from "./finish.mjs";

(function () {
  if (window.__fwLive) return; // pasted or loaded twice: runs once
  window.__fwLive = true;
  var me = document.currentScript;
  var cms = ((me && me.getAttribute("data-cms-url")) || "").replace(/\/$/, "");
  var cdn = ((me && me.getAttribute("data-asset-url")) || "").replace(/\/$/, "");
  var root = document.documentElement;
  var log = function (m) { console.warn("[fw-live] " + m); };

  // Each marked section: its start and end comments
  var marks = [];
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  for (var c = walker.nextNode(); c; c = walker.nextNode()) {
    var m = START.exec(c.data.trim());
    if (!m || LIVE.indexOf(m[1]) < 0) continue;
    var end = c.nextSibling;
    while (end && !(end.nodeType === 8 && end.data.trim() === END)) end = end.nextSibling;
    if (end) marks.push({ start: c, end: end, name: m[1], arg: m[2], hash: m[3] });
  }
  if (!cms || !marks.length) return;

  root.setAttribute("data-fw-live", "loading");
  var ctrl = "AbortController" in window ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
  fetch(cms + "/api/public/content", { headers: { accept: "application/json" }, cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
    .then(function (res) {
      if (!res.ok) throw new Error("the CMS answered HTTP " + res.status);
      return res.json();
    })
    .then(function (snap) {
      clearTimeout(timer);
      var problems = checkSnapshot(snap);
      if (snap && snap.view !== "published") problems.push("not the published view");
      if (problems.length) throw new Error(problems.join(" "));
      R.init(toRenderData(snap));
      var changed = 0;
      marks.forEach(function (mk) {
        var out = R[mk.name](mk.arg || undefined);
        var empty = out.indexOf(R.EMPTY_SECTION) > -1;
        var html = empty ? "" : finish(out, cdn), h = hash(html);
        if (h === mk.hash) return; // as built
        changed++;
        var parent = mk.start.parentNode;
        while (mk.start.nextSibling && mk.start.nextSibling !== mk.end) parent.removeChild(mk.start.nextSibling);
        var tpl = document.createElement("template");
        tpl.innerHTML = html;
        parent.insertBefore(tpl.content, mk.end);
        mk.start.data = startMark(mk.name, mk.arg, h);
        mk.hash = h;
        // The section around it: hidden while empty (only one this script hid comes back)
        var section = parent.closest ? parent.closest("section") : null;
        if (section && empty && !section.hidden) { section.hidden = true; section.setAttribute("data-fw-live-hidden", ""); }
        else if (section && !empty && section.hasAttribute("data-fw-live-hidden")) { section.hidden = false; section.removeAttribute("data-fw-live-hidden"); }
        // Calendar, testimonial stack, slideshows, gallery rows (js/main.js §21). Before main.js
        // has run there is nothing to do: it sets up the whole page, this markup included.
        if (window.__fwReady && window.FW_SITE) window.FW_SITE.mount(parent);
      });
      root.setAttribute("data-fw-live", changed ? "updated" : "current");
    })
    .catch(function (e) {
      clearTimeout(timer);
      root.setAttribute("data-fw-live", "failed");
      log("Showing the content as built; the live CMS content could not be loaded (" + (e && e.message) + ").");
    });
})();
