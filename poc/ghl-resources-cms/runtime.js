// Browser runtime of the GHL Resources test (inlined by build.mjs). Plain ES2017, no imports, no
// globals: everything renders inside a shadow root, so GHL's page styles and these styles never
// touch each other. The site's header and footer frame every view. Routes are real addresses
// on the GHL page the embed sits on: <page> (listing) and <page>?<slug> (article).
//   Snapshot: DATA already holds the content and the CSS it needs.
//   Live:     DATA.live is set and FWRender (prepare.mjs, bundled) is passed in. On every load the
//             content comes from the CMS public API and the styles from the site's style.css.
(function (DATA, FWRender) {
  "use strict";
  var host = document.getElementById(DATA.hostId);
  if (!host || host.shadowRoot) return;
  var log = function (e) { console.error("[fw-resources]", e); };
  if (!host.attachShadow) { host.textContent = "This browser cannot show the resources."; return; }

  // The title and share tags written in the embed (data-fw-head) sit in GHL's page body; they move
  // into <head>, unless the GHL page's own settings already set that tag (those win).
  [].slice.call(document.querySelectorAll("[data-fw-head]")).forEach(function (el) {
    if (el.parentNode === document.head) return;
    var key = el.getAttribute("property") ? "meta[property=\"" + el.getAttribute("property") + "\"]" : el.getAttribute("name") ? "meta[name=\"" + el.getAttribute("name") + "\"]" : "title";
    var own = document.head.querySelector(key);
    if (own && !own.hasAttribute("data-fw-head")) el.parentNode.removeChild(el);
    else document.head.appendChild(el);
  });

  // Fonts must be declared in the document: @font-face inside a shadow root is ignored.
  if (!document.querySelector('link[href^="' + DATA.fontsUrl.split("?")[0] + '"]')) {
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = DATA.fontsUrl;
    document.head.appendChild(font);
  }

  var root = host.attachShadow({ mode: "open" });
  var main, cleanup = [];
  var on = function (target, type, fn, opts) { target.addEventListener(type, fn, opts); cleanup.push(function () { target.removeEventListener(type, fn, opts); }); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---- Live: content from the CMS, styles from the site ---- */
  // The CMS and asset addresses can be changed on the element without rebuilding:
  // <div id="…" data-cms-url="https://…" data-asset-url="https://…">
  function loadLive() {
    var cms = (host.getAttribute("data-cms-url") || DATA.live.cmsUrl).replace(/\/$/, "");
    var cdn = (host.getAttribute("data-asset-url") || DATA.live.cdn).replace(/\/$/, "");
    var content = fetch(cms + "/api/public/content", { headers: { accept: "application/json" }, cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("The CMS answered HTTP " + res.status);
      if (res.headers.get("x-content-stale")) console.warn("[fw-resources] The CMS database was unreachable; showing the CMS's last good snapshot.");
      return res.json();
    }).then(function (snap) {
      var problems = FWRender.checkSnapshot(snap);
      if (problems.length) throw new Error(problems.join(" "));
      var out = FWRender.prepare(snap, { template: DATA.template, cdn: cdn });
      ["listingHtml", "articles", "resources", "headerHtml", "footerHtml", "origin"].forEach(function (k) { DATA[k] = out[k]; });
      console.info("[fw-resources] live CMS content, generated " + out.generatedAt + " (" + out.resources.length + " resources)");
    });
    // The whole site stylesheet, moved into the shadow root (html/:root → host, body → wrapper).
    // Without it (blocked, offline, old browser) the embedded copy is used instead.
    var styles = ("adoptedStyleSheets" in Document.prototype ? fetch(cdn + "/css/style.css").then(function (res) {
      if (!res.ok) throw new Error("style.css answered HTTP " + res.status);
      return res.text();
    }).then(function (text) {
      var sheet = new CSSStyleSheet(), extra = new CSSStyleSheet();
      sheet.replaceSync(text);
      (function remap(list) {
        for (var i = list.cssRules.length - 1; i >= 0; i--) {
          var rule = list.cssRules[i];
          if (rule.selectorText !== undefined) {
            var mapped = FWRender.mapSelectorList(rule.selectorText);
            if (!mapped) list.deleteRule(i);
            else if (mapped !== rule.selectorText) rule.selectorText = mapped;
          } else if (rule.cssRules && rule.deleteRule) remap(rule);
        }
      })(sheet);
      extra.replaceSync(DATA.hostCss + "\n" + DATA.extraCss);
      return [sheet, extra];
    }) : Promise.reject(new Error("constructable stylesheets are not supported"))).catch(function (e) {
      console.warn("[fw-resources] Using the embedded styles: " + (e && e.message));
      return null;
    });
    return Promise.all([content, styles]).then(function (r) { return r[1]; });
  }

  /* ---- Listing: the same card markup as tools/render.mjs resourceCards ---- */
  var DATE = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
  var dateLabel = function (r) { return /^\d{4}-\d{2}-\d{2}/.test(r.date || "") ? DATE.format(new Date(r.date.slice(0, 10) + "T12:00:00Z")) : ""; };
  var metaParts = function (r) { return String(r.category || "").split("·").map(function (c) { return c.trim(); }).concat([dateLabel(r), r.readTime]).filter(Boolean); };

  function cardsHtml() {
    var items = DATA.resources.filter(function (r) { return r.href; }).sort(function (a, b) {
      return (b.featured - a.featured) || String(b.date || "").localeCompare(String(a.date || ""));
    });
    if (!items.length) return ""; // the page source's own empty state shows instead
    var types = [];
    items.forEach(function (r) { if (types.indexOf(r.type) < 0) types.push(r.type); });
    var chips = types.length > 1 ? "<div class=\"rcards__filters\" role=\"group\" aria-label=\"Filter by type\"><button type=\"button\" class=\"rcards__chip\" aria-pressed=\"true\" data-type=\"\">All</button>" +
      types.map(function (t) { var r = items.filter(function (x) { return x.type === t; })[0]; return "<button type=\"button\" class=\"rcards__chip\" aria-pressed=\"false\" data-type=\"" + esc(t) + "\">" + esc(r.typeLabel) + "</button>"; }).join("") + "</div>" : "";
    return "<div class=\"rcards__tools\" data-rcards-tools><label class=\"rcards__search\"><span class=\"sr-only\">Search resources</span><input type=\"search\" placeholder=\"Search resources\" autocomplete=\"off\" data-rcards-search></label>" + chips + "</div>" +
      "<ul class=\"rcards\" data-rcards-list>" + items.map(function (r, i) {
        var attrs = r.download ? " download" : r.external ? " target=\"_blank\" rel=\"noopener\"" : "";
        var lead = i === 0 && r.featured;
        var words = [r.title, r.summary, r.category, r.typeLabel].concat(r.topics).filter(Boolean).join(" ").toLowerCase();
        var media = r.imageHtml ? r.imageHtml.replace(/__SIZES__/g, lead ? "(min-width: 1280px) 600px, (min-width: 641px) 50vw, 100vw" : "(min-width: 1280px) 400px, (min-width: 961px) 32vw, (min-width: 641px) 48vw, 100vw") : "<span class=\"rcard__img rcard__img--blank\"></span>";
        return "<li class=\"rcard" + (lead ? " rcard--lead" : "") + "\" data-type=\"" + esc(r.type) + "\" data-search=\"" + esc(words) + "\">" +
          "<a class=\"rcard__media\" href=\"" + esc(r.href) + "\"" + attrs + " tabindex=\"-1\" aria-hidden=\"true\">" + media + "</a>" +
          "<div class=\"rcard__body\">" +
          "<p class=\"rcard__badges\"><span class=\"rcard__type\">" + esc(r.typeLabel) + "</span>" + (r.featured ? "<span class=\"rcard__flag\">Featured</span>" : "") + "</p>" +
          "<p class=\"rcard__meta\">" + metaParts(r).map(function (p) { return "<span>" + esc(p) + "</span>"; }).join("") + "</p>" +
          "<h3><a href=\"" + esc(r.href) + "\"" + attrs + ">" + esc(r.title) + (r.external ? "<span class=\"sr-only\"> (opens in a new tab)</span>" : "") + "</a></h3>" +
          (r.summary ? "<p class=\"rcard__excerpt\">" + esc(r.summary) + "</p>" : "") +
          "</div></li>";
      }).join("") + "</ul><p class=\"rcards__none small\" data-rcards-none hidden>No resources match your search.</p>" +
      "<nav class=\"rcards__pager\" aria-label=\"Resource pages\" data-rcards-pager hidden></nav>";
  }

  // Search and Type filter (js/main.js §15), plus pages of PER_PAGE cards (embed only). The wide
  // featured card is extra on the page it falls on, so the three-column rows below it stay full.
  // The search, type and page are kept for the visit, so Back from an article returns to the same page.
  // Pager arrows: line icons in the text colour (currentColor), hidden from screen readers
  var ARROW = function (d) { return "<svg class=\"rcards__arrow\" viewBox=\"0 0 20 20\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"" + d + "\"/></svg>"; };
  var ARROW_L = ARROW("M16 10H4M9 5l-5 5 5 5"), ARROW_R = ARROW("M4 10h12M11 5l5 5-5 5");
  var PER_PAGE = 9, listState = { q: "", type: "", page: 1 };
  function pageList(n, cur) { // 1 … 4 5 6 … 12 once there are more than seven pages
    if (n <= 7) return Array.apply(null, Array(n)).map(function (_, i) { return i + 1; });
    var out = [1], from = Math.max(2, Math.min(cur - 1, n - 4)), to = Math.min(n - 1, Math.max(cur + 1, 5));
    if (from > 2) out.push(0);
    for (var p = from; p <= to; p++) out.push(p);
    if (to < n - 1) out.push(0);
    out.push(n);
    return out;
  }
  function wireFilters() {
    var tools = root.querySelector("[data-rcards-tools]"), pager = root.querySelector("[data-rcards-pager]");
    if (!tools) return;
    var cards = [].slice.call(root.querySelectorAll("[data-rcards-list] > li")), none = root.querySelector("[data-rcards-none]");
    var search = tools.querySelector("[data-rcards-search]"), chips = [].slice.call(tools.querySelectorAll("[data-type]"));
    var type = chips.some(function (c) { return c.getAttribute("data-type") === listState.type; }) ? listState.type : "", page = listState.page;
    search.value = listState.q;
    chips.forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-type") === type ? "true" : "false"); });
    var apply = function (scrollUp) {
      var words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
      var matches = cards.filter(function (c) {
        var text = c.getAttribute("data-search") || "";
        return (!type || c.getAttribute("data-type") === type) && words.every(function (w) { return text.indexOf(w) >= 0; });
      });
      var counted = matches.filter(function (c) { return !c.classList.contains("rcard--lead"); }).length;
      var pages = Math.max(1, Math.ceil(counted / PER_PAGE));
      page = Math.min(Math.max(1, page), pages);
      var i = 0, onPage = [];
      matches.forEach(function (c) {
        if (c.classList.contains("rcard--lead")) { if (page === 1) onPage.push(c); return; } // always first in the list
        if (Math.ceil(++i / PER_PAGE) === page) onPage.push(c);
      });
      cards.forEach(function (c) { c.hidden = onPage.indexOf(c) < 0; });
      if (none) none.hidden = matches.length > 0;
      listState = { q: search.value, type: type, page: page };
      if (pager) {
        pager.hidden = pages < 2;
        pager.innerHTML = pages < 2 ? "" :
          "<button type=\"button\" class=\"rcards__step\" data-page=\"" + (page - 1) + "\"" + (page === 1 ? " disabled" : "") + ">" + ARROW_L + "<span>Previous</span></button>" +
          "<ol class=\"rcards__pages\">" + pageList(pages, page).map(function (p) {
            return p ? "<li><button type=\"button\" class=\"rcards__page\" data-page=\"" + p + "\" aria-label=\"Page " + p + "\"" + (p === page ? " aria-current=\"page\"" : "") + ">" + p + "</button></li>" : "<li class=\"rcards__gap\" aria-hidden=\"true\">…</li>";
          }).join("") + "</ol>" +
          "<button type=\"button\" class=\"rcards__step\" data-page=\"" + (page + 1) + "\"" + (page === pages ? " disabled" : "") + "><span>Next</span>" + ARROW_R + "</button>";
      }
      if (scrollUp) { // back to the top of the list: the search box and type chips, below the sticky header
        var head = parseFloat(getComputedStyle(root.querySelector(".fw-main") || tools).getPropertyValue("--header-h")) || 80;
        var top = tools.getBoundingClientRect().top - head - 24;
        if (top < 0) window.scrollTo({ top: window.scrollY + top, behavior: "smooth" });
      }
    };
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        type = chip.getAttribute("data-type");
        page = 1;
        chips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
        apply();
      });
    });
    search.addEventListener("input", function () { page = 1; apply(); });
    if (pager) pager.addEventListener("click", function (e) {
      var b = e.target.closest("[data-page]");
      if (!b || b.disabled || b.getAttribute("aria-current")) return;
      page = +b.getAttribute("data-page");
      apply(true);
      var cur = pager.querySelector("[aria-current]");
      if (cur) cur.focus({ preventScroll: true });
    });
    apply();
  }

  /* ---- Article: the production page body, plus its contents and share bar ---- */
  // Contents sidebar (js/main.js §14): marks the section being read and fills the progress line.
  function wireToc() {
    var toc = root.querySelector("[data-toc]");
    if (!toc) return;
    var links = [].slice.call(toc.querySelectorAll(".toc__link"));
    var heads = links.map(function (a) { return root.getElementById(decodeURIComponent(a.getAttribute("href").slice(1))); });
    var bar = toc.querySelector("[data-toc-progress]"), body = root.querySelector(".article__body");
    var narrow = window.matchMedia("(max-width: 1024px)");
    if (narrow.matches) toc.open = false;
    var ticking = false;
    var update = function () {
      ticking = false;
      var line = Math.min(window.innerHeight * 0.3, 200), active = -1;
      heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top <= line) active = i; });
      links.forEach(function (a, i) {
        a.classList.toggle("is-active", i === active);
        if (i === active) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
      });
      if (bar && body) {
        var r = body.getBoundingClientRect(), span = r.height - window.innerHeight * 0.6;
        bar.parentNode.style.setProperty("--read", Math.max(0, Math.min(1, span > 0 ? -r.top / span : 1)).toFixed(3));
      }
    };
    var queue = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    on(window, "scroll", queue, { passive: true });
    on(window, "resize", queue);
    links.forEach(function (a) { a.addEventListener("click", function () { if (narrow.matches) toc.open = false; }); });
    update();
  }

  // Share this (js/main.js §16). The shared address is the article's real page on the site.
  function wireShare() {
    var bar = root.querySelector("[data-share-bar]");
    if (!bar) return;
    var url = bar.getAttribute("data-url"), title = bar.getAttribute("data-title"), note = bar.querySelector("[data-share-note]"), timer;
    var say = function (text) { note.textContent = text; clearTimeout(timer); timer = setTimeout(function () { note.textContent = ""; }, 4000); };
    var copy = function (done) {
      var fail = function () { say("Copy this link: " + url); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { say(done); }, fail);
      else fail();
    };
    [].slice.call(bar.querySelectorAll("[data-share]")).forEach(function (el) {
      var net = el.getAttribute("data-share");
      el.addEventListener("click", function (e) {
        if (net === "copy") copy("Link copied.");
        else if (net === "instagram") {
          if (navigator.share && window.matchMedia("(pointer: coarse)").matches) navigator.share({ title: title, url: url }).catch(function () {});
          else copy("Link copied. Paste it into your Instagram story or bio.");
        } else {
          var w = window.open(el.href, "fw-share", "width=600,height=640");
          if (w) { w.opener = null; e.preventDefault(); }
        }
      });
    });
  }

  // In-page links (#heading) scroll inside the shadow root instead of changing the route.
  root.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href^='#']");
    if (!a || /^#\//.test(a.getAttribute("href"))) return;
    var target = root.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---- Header (js/main.js §3): the mobile menu and the scrolled state ---- */
  // Listeners find the header when they run, so the live header can replace the first one.
  var parts = function () { return { header: root.querySelector(".site-header"), menu: root.querySelector(".menu"), nav: root.querySelector("#main-navigation") }; };
  function setMenu(open) {
    var p = parts();
    if (!p.menu || !p.nav) return;
    p.nav.classList.toggle("is-open", open);
    p.menu.setAttribute("aria-expanded", String(open));
    p.menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }
  var menuOpen = function () { var p = parts(); return !!(p.nav && p.nav.classList.contains("is-open")); };
  var scrolled = function () { var h = parts().header; if (h) h.classList.toggle("is-scrolled", window.scrollY > 8); };
  function wireHeader() {
    root.addEventListener("click", function (e) {
      if (e.target.closest(".menu")) setMenu(!menuOpen());
      else if (e.target.closest("#main-navigation a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menuOpen()) { setMenu(false); parts().menu.focus(); } });
    // A click outside the open menu closes it (clicks inside the shadow root reach the document
    // retargeted to the host, so the real target comes from the event's path)
    document.addEventListener("click", function (e) {
      var p = parts(), path = e.composedPath ? e.composedPath() : [];
      if (menuOpen() && path.indexOf(p.nav) < 0 && path.indexOf(p.menu) < 0) setMenu(false);
    });
    var ticking = false;
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; scrolled(); }); } }, { passive: true });
    scrolled();
  }

  /* ---- Router ---- */
  // The parent page is the GHL page's own address (data-base overrides it): the listing lives
  // there and each article at <parent>?<slug>. GHL serves only the pages built in it and
  // sends any other path to /not-found, but it serves a page whatever its query string, so these
  // addresses can be copied, shared and reloaded. <parent>/<slug> also opens its article when a
  // GHL page exists at that address with this same embed.
  var base = "", pageTitle = document.title;
  function findBase() {
    var given = host.getAttribute("data-base");
    var path = location.pathname.replace(/\/+$/, "");
    if (given != null) return given.replace(/\/+$/, "");
    var last = path.slice(path.lastIndexOf("/") + 1);
    return DATA.articles && DATA.articles[decodeURIComponent(last)] ? path.slice(0, path.lastIndexOf("/")) : path;
  }
  var hrefOf = function (slug) { return (base || "/") + (slug ? "?" + encodeURIComponent(slug) : ""); };
  // The article from the query: <parent>?<slug>, or the earlier <parent>?article=<slug>. Other
  // parameters (utm_…, fbclid) may come along and are ignored.
  function querySlug() {
    var named = new URLSearchParams(location.search).get("article");
    if (named) return named;
    var bare = location.search.slice(1).split("&").filter(function (p) { return p && p.indexOf("=") < 0; })[0];
    return bare ? decodeURIComponent(bare) : null;
  }
  // Where the address cannot change (a file opened from disk), routes fall back to #/resources/<slug>.
  function route() {
    var query = querySlug();
    var path = location.pathname.replace(/\/+$/, ""), hash = location.hash.match(/^#\/resources\/([^/?#]+)/);
    var slug = query || (path.indexOf(base + "/") === 0 ? decodeURIComponent(path.slice(base.length + 1)) : hash ? decodeURIComponent(hash[1]) : null);
    return slug && DATA.articles && DATA.articles[slug] ? slug : null;
  }
  function go(href, slug) {
    try {
      if (href !== location.pathname + location.search) history.pushState(null, "", href);
    } catch (e) {
      location.hash = slug ? "#/resources/" + encodeURIComponent(slug) : "#/resources"; // hashchange renders
      return;
    }
    render(true);
  }
  // The pages' links to the listing and to articles (#/resources, #/resources/<slug>, written by
  // prepare.mjs) become addresses under the parent page; the share bar shares that address too.
  function withRoutes(html, slug) {
    html = html.replace(/href="#\/resources(?:\/([^"]*))?"/g, function (all, s) {
      var to = s ? decodeURIComponent(s) : "";
      return "href=\"" + esc(hrefOf(to)) + "\" data-fw-route=\"" + esc(to) + "\"";
    });
    if (slug) {
      var was = DATA.origin + "/resources/" + slug, now = location.origin + hrefOf(slug);
      html = html.split(encodeURIComponent(was)).join(encodeURIComponent(now)).split(was).join(now);
    }
    return html;
  }
  // Search tags on the GHL page itself (outside the shadow root): each article sets its own title,
  // description, canonical address, share tags and Article data, and the listing puts back what
  // the GHL page had. Google reads them after running the page; link-preview crawlers (Facebook,
  // LinkedIn) do not run scripts and keep seeing the GHL page's own tags.
  var HEAD = [["meta", "name", "description"], ["link", "rel", "canonical"], ["meta", "property", "og:title"], ["meta", "property", "og:description"],
    ["meta", "property", "og:url"], ["meta", "property", "og:image"], ["meta", "property", "og:type"], ["meta", "name", "twitter:title"],
    ["meta", "name", "twitter:description"], ["meta", "name", "twitter:image"]];
  var original = HEAD.map(function (t) {
    var el = document.head.querySelector(t[0] + "[" + t[1] + "=\"" + t[2] + "\"]");
    return el ? { el: el, value: el.getAttribute(t[0] === "link" ? "href" : "content") } : null;
  });
  // The page's share-image size (og:image:width/height) is wrong for an article's image: those
  // tags leave <head> while an article is open.
  var imageSize = [].slice.call(document.head.querySelectorAll("meta[property^=\"og:image:\"]"));
  function setHead(seo) {
    imageSize.forEach(function (el) {
      if (seo && el.parentNode) el.parentNode.removeChild(el);
      else if (!seo && !el.parentNode) document.head.appendChild(el);
    });
    HEAD.forEach(function (t, i) {
      var attr = t[0] === "link" ? "href" : "content", value = seo ? seo[t[2]] : null, was = original[i];
      var el = document.head.querySelector(t[0] + "[" + t[1] + "=\"" + t[2] + "\"]");
      if (value) {
        if (!el) { el = document.createElement(t[0]); el.setAttribute(t[1], t[2]); el.setAttribute("data-fw-seo", ""); document.head.appendChild(el); }
        el.setAttribute(attr, value);
      } else if (el && el.hasAttribute("data-fw-seo")) el.parentNode.removeChild(el);
      else if (el && was) el.setAttribute(attr, was.value);
    });
    var ld = document.head.querySelector("script[data-fw-seo]");
    if (seo && seo.ld) {
      if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.setAttribute("data-fw-seo", ""); document.head.appendChild(ld); }
      ld.textContent = JSON.stringify(seo.ld);
    } else if (ld) ld.parentNode.removeChild(ld);
  }
  function articleHead(r, slug) {
    var s = r.seo || {}, url = location.origin + hrefOf(slug), title = s.title || r.title + " · Faith Works", desc = s.description || r.summary || "";
    return {
      title: title, description: desc, canonical: url, "og:title": title, "og:description": desc, "og:url": url, "og:image": s.image, "og:type": "article",
      "twitter:title": title, "twitter:description": desc, "twitter:image": s.image,
      ld: { "@context": "https://schema.org", "@type": "Article", headline: r.title, description: desc, image: s.image || undefined, datePublished: s.published || undefined,
        author: s.author ? { "@type": "Organization", name: s.author } : undefined, mainEntityOfPage: url },
    };
  }

  root.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-fw-route]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(a.getAttribute("href"), a.getAttribute("data-fw-route"));
  });
  var started = false; // content in hand; until then a route change only updates the address
  // The listing, keeping the hero element that is already on screen when the new markup has the same
  // hero (the live embed's loading frame → content): re-creating it would restart its rise-in animation.
  function setListing(html) {
    var oldHero = main.querySelector(".phero");
    var tpl = document.createElement("template");
    tpl.innerHTML = html;
    var newHero = tpl.content.querySelector(".phero");
    if (!oldHero || !newHero || oldHero.parentNode !== main || newHero.parentNode !== tpl.content || oldHero.outerHTML !== newHero.outerHTML) {
      main.innerHTML = html;
      return;
    }
    while (oldHero.previousSibling) main.removeChild(oldHero.previousSibling);
    while (oldHero.nextSibling) main.removeChild(oldHero.nextSibling);
    while (tpl.content.firstChild !== newHero) main.insertBefore(tpl.content.firstChild, oldHero);
    while (newHero.nextSibling) main.appendChild(newHero.nextSibling);
  }
  function render(scroll) {
    if (!started) return;
    cleanup.forEach(function (fn) { fn(); });
    cleanup = [];
    var slug = route();
    try {
      if (slug) {
        main.innerHTML = withRoutes(DATA.articles[slug], slug);
        wireToc();
        wireShare();
        var r = DATA.resources.filter(function (x) { return x.slug === slug; })[0] || { title: slug, slug: slug };
        var head = articleHead(r, slug);
        document.title = head.title;
        setHead(head);
      } else {
        setListing(withRoutes(DATA.listingHtml.replace("%%FW_CARDS%%", cardsHtml())));
        wireFilters();
        document.title = pageTitle;
        setHead(null);
      }
      host.setAttribute("data-fw-view", slug ? "article" : "listing");
      if (scroll) window.scrollTo(0, Math.max(0, window.scrollY + host.getBoundingClientRect().top));
      host.dispatchEvent(new CustomEvent("fw:rendered", { bubbles: true, detail: { view: slug ? "article" : "listing", slug: slug, count: DATA.resources.length } }));
    } catch (e) {
      main.innerHTML = "<p class=\"small\">Resources could not be shown. See the browser console.</p>";
      log(e);
    }
  }

  /* ---- Start ---- */
  // The frame (header, page, footer) shows at once with the embedded styles. The live embed fills
  // the cards area with wireframes until the CMS answers, then swaps in the live styles, header,
  // footer and content; if the CMS cannot be reached, only the cards area says so.
  var SKEL_CARD = function (lead) {
    return "<li class=\"rcard" + (lead ? " rcard--lead" : "") + "\" aria-hidden=\"true\"><span class=\"rcard__media\"><span class=\"rcard__img rcard__img--blank fw-skel__img\"></span></span><div class=\"rcard__body\">" +
      "<div class=\"fw-skel__chips\"><span class=\"fw-skel__bar fw-skel__chip\"></span>" + (lead ? "<span class=\"fw-skel__bar fw-skel__chip\"></span>" : "") + "</div>" +
      "<span class=\"fw-skel__bar fw-skel__w50\"></span><span class=\"fw-skel__bar fw-skel__h fw-skel__w90\"></span><span class=\"fw-skel__bar fw-skel__h fw-skel__w60\"></span>" +
      "<span class=\"fw-skel__bar fw-skel__w90\"></span><span class=\"fw-skel__bar fw-skel__w70\"></span><span class=\"fw-skel__bar fw-skel__w30\"></span></div></li>";
  };
  var SKEL_LIST = "<div class=\"fw-skel\" role=\"status\" aria-live=\"polite\"><span class=\"sr-only\">Loading resources…</span>" +
    "<div class=\"rcards__tools\" aria-hidden=\"true\"><span class=\"fw-skel__bar fw-skel__search\"></span></div>" +
    "<ul class=\"rcards\">" + SKEL_CARD(true) + SKEL_CARD() + SKEL_CARD() + SKEL_CARD() + "</ul></div>";
  // The article's own header and cover boxes, so the wireframe sits where the article will
  var SKEL_ARTICLE = "<div class=\"fw-skel\" role=\"status\" aria-live=\"polite\"><span class=\"sr-only\">Loading the article…</span><div class=\"article\" aria-hidden=\"true\">" +
    "<div class=\"article__head wrap\"><span class=\"fw-skel__bar fw-skel__w20\"></span><span class=\"fw-skel__bar fw-skel__title\"></span><span class=\"fw-skel__bar fw-skel__title fw-skel__w60\"></span>" +
    "<span class=\"fw-skel__bar fw-skel__w70\"></span><span class=\"fw-skel__bar fw-skel__w30\"></span></div>" +
    "<div class=\"article__cover wrap\"><span class=\"fw-skel__img fw-skel__cover\"></span></div></div></div>";
  var FAILED = "<div class=\"empty\" role=\"alert\"><p><strong>Resources could not be loaded right now.</strong> Please refresh the page or try again shortly.</p></div>";

  var shownHeader, shownFooter;
  function mount() {
    shownHeader = DATA.headerHtml; shownFooter = DATA.footerHtml;
    root.innerHTML = "<style data-fw-embedded>" + DATA.hostCss + "\n" + DATA.css + "\n" + DATA.extraCss + "</style><div class=\"fw-root\">" + withRoutes(DATA.headerHtml) +
      "<main class=\"fw-main\" id=\"main-content\" tabindex=\"-1\"></main>" + withRoutes(DATA.footerHtml) + "</div>";
    main = root.querySelector(".fw-main");
    wireHeader();
  }
  // Header or footer changed in the CMS since this file was built: the live one replaces it.
  function swapPart(selector, html) {
    var el = root.querySelector(selector), tpl = document.createElement("template");
    tpl.innerHTML = withRoutes(html);
    if (el && tpl.content.firstElementChild) el.replaceWith(tpl.content.firstElementChild);
  }
  function start() {
    started = true;
    host.setAttribute("data-fw-source", DATA.live ? "live" : "snapshot");
    // Links from the earlier hash version (#/resources/<slug>) still open their article
    var old = location.hash.match(/^#\/resources\/([^/?#]+)/);
    if (old && DATA.articles[decodeURIComponent(old[1])]) try { history.replaceState(null, "", hrefOf(decodeURIComponent(old[1]))); } catch (e) { /* stays on the hash */ }
    window.addEventListener("popstate", function () { render(true); });
    window.addEventListener("hashchange", function () { if (/^#\/resources(\/|$)/.test(location.hash)) render(true); });
    render(false);
  }

  base = findBase();
  mount();
  // Image preview (js/main.js fw-lightbox block, put in front of this file by build.mjs)
  if (window.FWLightbox) window.FWLightbox.attach(root);
  if (!DATA.live) start();
  else {
    // An article address (?slug, #/resources/slug) waits on an article wireframe, the rest on cards
    var wantsArticle = !!(querySlug() || /^#\/resources\/[^/?#]/.test(location.hash));
    main.innerHTML = wantsArticle ? SKEL_ARTICLE : withRoutes(DATA.listingHtml.replace("%%FW_CARDS%%", SKEL_LIST));
    host.setAttribute("data-fw-view", "loading");
    loadLive().then(function (sheets) {
      if (sheets) {
        root.adoptedStyleSheets = sheets;
        var embedded = root.querySelector("style[data-fw-embedded]");
        if (embedded) embedded.parentNode.removeChild(embedded);
      }
      if (DATA.headerHtml !== shownHeader) swapPart(".site-header", DATA.headerHtml);
      if (DATA.footerHtml !== shownFooter) swapPart(".site-footer", DATA.footerHtml);
      base = findBase();
      start();
    }).catch(function (e) {
      var skel = root.querySelector(".fw-skel");
      if (skel && !wantsArticle) skel.outerHTML = FAILED; else main.innerHTML = "<div class=\"wrap\" style=\"padding-block:64px\">" + FAILED + "</div>";
      host.setAttribute("data-fw-view", "error");
      log(e);
    });
  }
})(/*DATA*/, /*RENDER*/);
