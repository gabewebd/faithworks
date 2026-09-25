/* ==========================================================================
   FAITH WORKS · main.js
   All of the site's JavaScript in one file. Plain browser JS, no build step,
   no dependencies. Load with:  <script src="js/main.js" defer></script>

   Page structure is plain HTML and works without this file: nothing is hidden,
   desktop nav panels open on hover/focus (CSS) and "Menu" links to the footer
   navigation. Content that changes (insights, events, highlights, resources, programs,
   success stories, tools, social links)
   comes from assets/data/*.json and is rendered here, so it needs a web server
   (any static host or CDN); fetch() can't read JSON from a file:// page.

   Contents
     1. SETUP             "JS is on" flag, ?placeholders outline
     2. HEADER            hide on scroll, follow section surface, chapter indicator
     3. NAV PANELS        Escape closes a desktop panel
     4. MOBILE MENU       open/close, focus trap, Escape to close
     5. REVEALS           [data-fw-reveal] / [data-fw-draw] animate once in view
     6. JOURNEY           Learn → Implement → Scale: section colour follows the stage
     7. HERO LINE         circuit line threading Learn → Implement → Scale
     8. FILTERS           topic chips (items can carry several categories)
     9. TABS              [data-fw-tabs]: accessible tabs; no JS = all panels shown
    10. CONTENT           JSON data layer: loading, dates, date card, images, shared card markup
    11. VIEWS             [data-fw-render="…"]: what each dynamic element shows
    12. ARTICLE           insight.html?slug=…: the full Insight as a page, Back and Share
    12b. INSIGHT READER   ?insight=<slug>: full-screen reader sliding up, X / Escape, shareable URL
    13. DEMO FORMS        until GHL forms are connected, forms say so instead of reloading
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. SETUP -------------------------------------------------------------- */
  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";

  // Tells the CSS that JavaScript is running; reveal animations only hide content under this class.
  root.classList.add("fw-js");

  // Add ?placeholders to the URL to outline every piece of placeholder content.
  if (/[?&]placeholders\b/.test(location.search)) root.classList.add("fw-show-placeholders");

  /* ---- 2. HEADER ------------------------------------------------------------- */
  var header = doc.querySelector("[data-fw-header]");
  var CHAPTER_ACCENT = { learn: "var(--fw-pink-ink)", implement: "var(--fw-charcoal)", scale: "var(--fw-yellow)" };

  // The last matching element in DOM order is the most deeply nested one.
  function innermostAt(nodes, y) {
    var hit = null;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) hit = nodes[i];
    }
    return hit;
  }

  if (header) {
    var surfaces = doc.querySelectorAll("main [data-fw-surface], body > footer[data-fw-surface]");
    var chapters = doc.querySelectorAll("main [data-fw-chapter]");
    var chapterLinks = header.querySelectorAll("[data-fw-chapter-link]");
    var lastY = window.scrollY;
    var ticking = false;

    var updateHeader = function () {
      ticking = false;
      var y = window.scrollY;
      header.classList.toggle("is-scrolled", y > 8);
      if (!root.classList.contains("fw-menu-open")) {
        header.classList.toggle("is-hidden", y > lastY && y > 320);
      }
      lastY = y;

      // Surface: take the colour of the section directly under the header
      var under = innermostAt(surfaces, header.offsetHeight);
      if (under) {
        var journey = under.closest("[data-fw-journey].is-enhanced");
        var s = journey ? journey.getAttribute("data-fw-active-surface") : under.getAttribute("data-fw-surface");
        // Over the yellow room the wordmark's yellow [ai] block would vanish: stay Works White
        if (s === "yellow") s = "white";
        if (s && header.getAttribute("data-fw-surface") !== s) header.setAttribute("data-fw-surface", s);
      }

      // Journey indicator: the chapter holding the middle of the viewport
      var mid = innermostAt(chapters, window.innerHeight / 2);
      var current = mid ? mid.getAttribute("data-fw-chapter") : "";
      chapterLinks.forEach(function (li) {
        var on = li.getAttribute("data-fw-chapter-link") === current;
        li.classList.toggle("is-chapter", on);
        if (on) li.style.setProperty("--fw-chapter-accent", CHAPTER_ACCENT[current]);
      });
    };

    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(updateHeader); }
    }, { passive: true });
    window.addEventListener("resize", updateHeader);
    updateHeader();
  }

  /* ---- 3. NAV PANELS: Escape closes (they open via CSS) ---------------------- */
  doc.querySelectorAll(".fw-nav__item--panel").forEach(function (item) {
    item.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      item.classList.add("is-dismissed");
      var link = item.querySelector(".fw-nav__link");
      if (link) link.focus();
    });
    var reset = function () { item.classList.remove("is-dismissed"); };
    item.addEventListener("mouseleave", reset);
    item.addEventListener("focusout", function (e) { if (!item.contains(e.relatedTarget)) reset(); });
  });

  /* ---- 4. MOBILE MENU -------------------------------------------------------- */
  var toggle = doc.querySelector("[data-fw-menu-toggle]");
  var menu = toggle && doc.getElementById(toggle.getAttribute("aria-controls"));
  if (toggle && menu) {
    var setMenu = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
      root.classList.toggle("fw-menu-open", open);
      if (open) {
        if (header) {
          header.classList.remove("is-hidden");
          header.setAttribute("data-fw-surface", "white");
        }
        var first = menu.querySelector("a, summary");
        if (first) first.focus();
      } else {
        toggle.focus();
        // The menu forced the header to white; hand it back to the section underneath
        if (header && updateHeader) updateHeader();
      }
    };

    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    doc.addEventListener("keydown", function (e) {
      if (toggle.getAttribute("aria-expanded") !== "true") return;
      if (e.key === "Escape") { setMenu(false); return; }
      if (e.key !== "Tab") return;
      // Keep focus inside: the toggle plus the menu's visible links
      var items = [toggle].concat([].slice.call(menu.querySelectorAll("a, summary")).filter(function (el) {
        return el.offsetParent !== null;
      }));
      var firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && doc.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && doc.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    });
  }

  /* ---- 5. REVEALS ------------------------------------------------------------ */
  // SVG line drawing needs each path's length as a CSS variable
  // Lengths are applied with transitions off, so a line never animates from the CSS
  // fallback length to its real one (visible as flicker when the SVG is on screen at load).
  function setDrawLengths(svg) {
    var paths = svg.querySelectorAll("path");
    for (var i = 0; i < paths.length; i++) {
      paths[i].style.transition = "none";
      paths[i].style.setProperty("--fw-len", Math.ceil(paths[i].getTotalLength()));
      if (!paths[i].style.getPropertyValue("--i")) paths[i].style.setProperty("--i", i);
    }
    if (paths.length) getComputedStyle(paths[0]).strokeDashoffset; // commit the hidden starting state before transitions return
    for (var j = 0; j < paths.length; j++) paths[j].style.transition = "";
  }

  var observer = null;
  function reveal(el) {
    if (el.hasAttribute("data-fw-draw")) setDrawLengths(el);
    if (!("IntersectionObserver" in window) || reduceMotion) { el.classList.add("is-in"); return; }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var target = entry.target;
          observer.unobserve(target);
          // Two frames later, so the hidden starting state has been painted and the entrance
          // plays even for content already in view at load (heroes)
          requestAnimationFrame(function () { requestAnimationFrame(function () { target.classList.add("is-in"); }); });
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    }
    observer.observe(el);
  }
  doc.querySelectorAll("[data-fw-reveal], [data-fw-draw]").forEach(reveal);

  /* ---- 6. JOURNEY: the room changes colour with the stage -------------------- */
  // Without JS each stage keeps its own background (hard cuts). With JS the
  // stages go transparent and the whole section eases to the active stage colour.
  doc.querySelectorAll("[data-fw-journey]").forEach(function (journey) {
    var stages = journey.querySelectorAll("[data-fw-stage]");
    if (!stages.length || !("IntersectionObserver" in window)) return;
    journey.classList.add("is-enhanced");
    // The desktop sticky index (CSS position: sticky) marks the stage in view
    var indexLinks = journey.querySelectorAll("[data-fw-stage-link]");
    var activate = function (stage) {
      journey.style.setProperty("--fw-journey-bg", getComputedStyle(stage).getPropertyValue("--fw-surface").trim());
      journey.setAttribute("data-fw-active-surface", stage.getAttribute("data-fw-surface"));
      indexLinks.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + stage.id;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "step");
        else a.removeAttribute("aria-current");
      });
    };
    activate(stages[0]);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) activate(entry.target); });
    }, { rootMargin: "-50% 0px -50% 0px" });
    stages.forEach(function (s) { io.observe(s); });
  });

  /* ---- 7. HERO LINE: circuit through the three words ------------------------- */
  function node(svg, x, y, r, cls) {
    var c = doc.createElementNS(SVGNS, "circle");
    c.setAttribute("cx", x.toFixed(1));
    c.setAttribute("cy", y.toFixed(1));
    c.setAttribute("r", r);
    c.setAttribute("class", "fw-circuit__node" + (cls ? " " + cls : ""));
    svg.appendChild(c);
  }

  function pathEl(d) {
    var p = doc.createElementNS(SVGNS, "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "fw-circuit__path");
    p.style.transitionDelay = "300ms";
    return p;
  }

  function drawCircuit(box) {
    // Measure the line masks (never transformed), not the animating text inside them
    var words = box.querySelectorAll("[data-fw-anchor] .fw-line");
    if (words.length < 3) return;
    var old = box.querySelector(".fw-circuit");
    if (old) old.remove();

    var b = box.getBoundingClientRect();
    var fs = parseFloat(getComputedStyle(words[0]).fontSize);
    var rel = function (el) {
      var r = el.getBoundingClientRect();
      return {
        l: r.left - b.left,
        r: r.right - b.left,
        t: r.top - b.top,
        b: r.bottom - b.top - fs * 0.12, // the mask adds 0.12em below
        m: r.top - b.top + fs * 0.45     // optical middle of the capitals
      };
    };
    var L = rel(words[0]), I = rel(words[1]), S = rel(words[2]);
    var R = 14; // corner radius
    var d, svg = doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "fw-circuit");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("data-fw-draw", "");

    if (window.innerWidth >= 1280) {
      // Learn → down into the gap → along to Implement's end (node) → down into the
      // next gap → out past "Scale." → down to finish beside its full stop.
      // The line never crosses or caps a letter.
      var x0 = L.r + fs * 0.08, y0 = L.m;
      var x1 = x0 + 40;
      var yGap1 = L.b + fs * 0.02;
      var xR = I.r + fs * 0.16;
      var yGap2 = I.b + fs * 0.03;
      var xS = Math.max(S.r + fs * 0.12, xR + 2 * R);
      var yEnd = S.m;
      d = "M" + x0 + " " + y0 + " H" + (x1 - R) + " Q" + x1 + " " + y0 + " " + x1 + " " + (y0 + R) +
          " V" + (yGap1 - R) + " Q" + x1 + " " + yGap1 + " " + (x1 + R) + " " + yGap1 +
          " H" + (xR - R) + " Q" + xR + " " + yGap1 + " " + xR + " " + (yGap1 + R) +
          " V" + (yGap2 - R) + " Q" + xR + " " + yGap2 + " " + (xR + R) + " " + yGap2 +
          " H" + (xS - R) + " Q" + xS + " " + yGap2 + " " + xS + " " + (yGap2 + R) +
          " V" + yEnd;
      svg.appendChild(pathEl(d));
      node(svg, x0, y0, 4.5, "fw-circuit__node--open");
      node(svg, xR, I.m, 4.5);
      node(svg, xS, yEnd, 6, "fw-circuit__node--end");
    } else {
      // Narrow screens: a vertical thread in the left margin, a node at each word
      var mx = Math.max(6, parseFloat(getComputedStyle(box).paddingLeft) / 2);
      d = "M" + mx + " " + L.m + " V" + S.m +
          " M" + mx + " " + L.m + " H" + (L.l - 8) +
          " M" + mx + " " + I.m + " H" + (I.l - 8);
      svg.appendChild(pathEl(d));
      node(svg, L.l - 8, L.m, 3.5);
      node(svg, I.l - 8, I.m, 3.5);
      node(svg, mx, S.m, 5, "fw-circuit__node--end");
    }

    box.appendChild(svg);
    setDrawLengths(svg);
    // Draw once on first load; redraws after a resize appear instantly
    if (box.__fwDrawn || reduceMotion) {
      svg.classList.add("is-in");
    } else {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { svg.classList.add("is-in"); box.__fwDrawn = true; });
      });
    }
  }

  var circuits = doc.querySelectorAll('[data-fw-circuit="hero"]');
  if (circuits.length) {
    var redraw = function () { circuits.forEach(drawCircuit); };
    var timer;
    window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(redraw, 150); });
    // Measure after the webfonts are in, or the word widths are wrong
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(redraw);
    else redraw();
  }

  /* ---- 8. FILTERS ---------------------------------------------------------- */
  doc.querySelectorAll("[data-fw-filter]").forEach(function (group) {
    var list = doc.getElementById(group.getAttribute("data-fw-filter"));
    if (!list) return;
    var scope = list.parentNode;
    var empty = scope.querySelector("[data-fw-filter-empty]");
    var status = scope.querySelector("[data-fw-filter-status]");

    group.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-fw-filter-value]");
      if (!chip) return;
      var value = chip.getAttribute("data-fw-filter-value");

      group.querySelectorAll("[data-fw-filter-value]").forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === chip));
      });

      var shown = 0;
      list.querySelectorAll("[data-fw-category]").forEach(function (item) {
        var cats = item.getAttribute("data-fw-category").split(" ");
        var match = value === "all" || cats.indexOf(value) !== -1;
        item.hidden = !match;
        if (match) { shown++; item.classList.add("is-in"); }
      });

      if (empty) empty.hidden = shown > 0;
      var noun = group.getAttribute("data-fw-filter-noun") || "item";
      if (status) status.textContent = shown + " " + noun + (shown === 1 ? "" : "s") + " shown";
    });
  });

  /* ---- 9. TABS -------------------------------------------------------------- */
  // [data-fw-tabs]: accessible tabs. Also run on tabs rendered from JSON (section 11).
  function setupTabs(box) {
    var tabs = [].slice.call(box.querySelectorAll('[role="tab"]'));
    if (!tabs.length || box.classList.contains("fw-tabs--ready")) return;
    var select = function (tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = doc.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    };
    box.classList.add("fw-tabs--ready");
    select(tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tabs[0]);
    box.addEventListener("click", function (e) {
      var t = e.target.closest('[role="tab"]');
      if (t) select(t);
    });
    box.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(doc.activeElement);
      if (i === -1) return;
      var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length], true);
    });
  }
  doc.querySelectorAll("[data-fw-tabs]").forEach(setupTabs);

  /* ---- 10. CONTENT: the JSON data layer ------------------------------------- */
  // Everything that changes (insights, events, highlights, resources, programs,
  // success stories, tools, social links) lives in assets/data/*.json and is
  // rendered into [data-fw-render="<view>"] elements. Paths resolve from this
  // script's own URL (…/js/main.js → …/assets/data/), so the site works from any
  // folder or CDN. Optional overrides on the tag:
  //   <script src="…/main.js" data-fw-data="https://cdn…/data/" data-fw-insight-page="/insight" defer>
  var self = doc.currentScript || doc.querySelector('script[src*="main.js"]');
  var ROOT = new URL("../", self ? self.src : location.href).href;
  var dataAttr = self && self.getAttribute("data-fw-data");
  var DATA = dataAttr ? new URL(dataAttr.replace(/\/?$/, "/"), location.href).href : ROOT + "assets/data/";
  // Insight permalinks: <page>?insight=<slug> opens that Insight in the full-screen reader
  var INSIGHT_PAGE = (self && self.getAttribute("data-fw-insight-page")) || "learn.html";
  var LEARN_INSIGHTS = "learn.html#insights";

  var dataCache = {};
  function getData(name) {
    if (!dataCache[name]) {
      // "no-cache": always check with the server, so edits to the JSON show on a normal refresh
      dataCache[name] = fetch(DATA + name + ".json", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(name + ".json returned " + r.status);
        return r.json();
      });
    }
    return dataCache[name];
  }

  // Titles and labels are escaped. Article body text (insights.json content blocks)
  // is trusted, editor-written HTML so it can carry links and emphasis.
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function asset(p) { return /^([a-z]+:|\/)/i.test(p) ? p : ROOT + p; }
  function isExternal(url) { return /^https?:\/\//i.test(url) && new URL(url).origin !== location.origin; }
  var NEW_TAB = '<span class="fw-visually-hidden"> (opens in a new tab)</span>';
  function linkAttrs(url) { return 'href="' + esc(url) + '"' + (isExternal(url) ? ' target="_blank" rel="noopener"' : ""); }
  function arrow(url) { return '<span class="fw-link__arrow" aria-hidden="true">' + (isExternal(url) ? "↗" : "→") + "</span>"; }

  /* Dates. Insights use "YYYY-MM-DD"; events use { day: "30", month: "SEP", year: "2026" }.
     Both become a local Date (new Date("2026-09-25") would be UTC and can slip a day). */
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function parseDate(s) {
    if (!s) return null;
    if (typeof s === "object") {
      var m = MONTHS.map(function (x) { return x.slice(0, 3).toUpperCase(); }).indexOf(String(s.month).slice(0, 3).toUpperCase());
      return m === -1 ? null : new Date(+s.year, m, +s.day);
    }
    var p = String(s).split("-");
    return p.length === 3 ? new Date(+p[0], p[1] - 1, +p[2]) : null;
  }
  function isoDate(s) {
    var d = parseDate(s);
    return d ? d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) : "";
  }
  function dateText(s, style) {
    var d = parseDate(s);
    if (!d) return "";
    var m = MONTHS[d.getMonth()];
    if (style === "short") return d.getDate() + " " + m.slice(0, 3) + " " + d.getFullYear();   // 25 Sep 2026
    if (style === "weekday") return DAYS[d.getDay()];                                          // Friday
    return d.getDate() + " " + m + " " + d.getFullYear();                                      // 25 September 2026
  }
  // The yellow date card: day / MON / year, built from the event's JSON date
  function dateCard(date, cls) {
    var d = parseDate(date);
    if (!d) return "";
    return '<p class="fw-datecard' + (cls ? " " + cls : "") + '"><time datetime="' + isoDate(date) + '">' +
      '<span class="fw-datecard__day">' + d.getDate() + "</span>" +
      '<span class="fw-datecard__month">' + MONTHS[d.getMonth()].slice(0, 3).toUpperCase() + "</span>" +
      '<span class="fw-datecard__year">' + d.getFullYear() + "</span></time></p>";
  }

  /* Images. An item's image is either { base, widths } (responsive webp + jpg files
     name-480.webp …), { url }, or a plain path string; alt text comes from image.alt
     or the item's imageAlt. source (a temporary stock photo's origin) is kept on <picture>. */
  function imageOf(item) {
    var img = item && (item.image || item.coverImage);
    if (!img) return null;
    if (typeof img === "string") img = { url: img };
    if (!img.alt && item.imageAlt) img = Object.assign({}, img, { alt: item.imageAlt });
    return img;
  }
  function picture(img, sizes, eager) {
    if (!img) return "";
    if (typeof img === "string") img = { url: img };
    var open = "<picture" + (img.source ? ' data-image-source="' + esc(img.source) + '"' : "") + ">";
    var common = (img.width ? ' width="' + img.width + '" height="' + img.height + '"' : "") +
      (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"' +
      (img.position ? ' style="object-position:' + esc(img.position) + '"' : "") +
      ' alt="' + esc(img.alt) + '"';
    if (!img.base) return open + '<img src="' + esc(asset(img.url)) + '"' + common + "></picture>";
    var set = function (ext) {
      return img.widths.map(function (w) { return esc(asset(img.base + "-" + w + "." + ext)) + " " + w + "w"; }).join(", ");
    };
    var fallback = img.widths[Math.min(1, img.widths.length - 1)];
    return open + '<source type="image/webp" srcset="' + set("webp") + '" sizes="' + sizes + '">' +
      '<img src="' + esc(asset(img.base + "-" + fallback + ".jpg")) + '" srcset="' + set("jpg") + '" sizes="' + sizes + '"' + common + "></picture>";
  }

  function eyebrow(text) {
    return '<p class="fw-eyebrow"><span class="fw-eyebrow__bracket" aria-hidden="true">[</span> <span>' + esc(text) +
      '</span> <span class="fw-eyebrow__bracket" aria-hidden="true">]</span></p>';
  }
  var SEP = '<span class="fw-meta__sep" aria-hidden="true">·</span>';
  function ticks(items, cls) {
    return items && items.length ? '<ul class="fw-ticks' + (cls ? " " + cls : "") + '">' + items.map(function (h) { return "<li>" + esc(h) + "</li>"; }).join("") + "</ul>" : "";
  }
  function factsList(rows, cls) {
    var html = rows.filter(function (f) { return f[1]; })
      .map(function (f) { return '<div><dt class="fw-label">' + f[0] + "</dt><dd>" + f[1] + "</dd></div>"; }).join("");
    return html ? '<dl class="' + cls + '">' + html + "</dl>" : "";
  }

  /* Insights */
  function insightHref(slug) { return INSIGHT_PAGE + "?insight=" + encodeURIComponent(slug); }
  function insightsByDate(d) {
    return d.insights.slice().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });
  }
  function leadInsight(list) { return list.filter(function (i) { return i.featured; })[0] || list[0]; }
  function findInsight(list, slug) { return list.filter(function (i) { return i.slug === slug; })[0]; }
  function insightMeta(i, lead) {
    return '<p class="fw-label fw-meta"><span class="fw-meta__cat">' + (lead ? esc(lead) + " · " : "") + esc(i.category) + "</span>" + SEP +
      '<time datetime="' + esc(i.date) + '">' + dateText(i.date, "short") + "</time>" + SEP + "<span>" + esc(i.readTime) + "</span></p>";
  }

  /* Events: upcoming = dated first (soonest first), then undated in file order */
  function upcomingEvents(d) {
    return d.events.filter(function (e) { return e.status === "upcoming"; }).sort(function (a, b) {
      if (!a.date !== !b.date) return a.date ? -1 : 1;
      return isoDate(a.date).localeCompare(isoDate(b.date));
    });
  }
  function datedUpcoming(d) { return upcomingEvents(d).filter(function (e) { return e.date; }); }
  function leadEvent(d) {
    var dated = datedUpcoming(d);
    return dated.filter(function (e) { return e.featured; })[0] || dated[0] || null;
  }
  function findEvent(d, id) { return d && d.events.filter(function (e) { return e.id === id; })[0]; }
  function typeLabel(e) { return e.typeLabel || e.type || "Event"; }
  // An event's one call to action: Register ↗ (or "Get notified" for an undated one).
  // label: optional visible text that already names the event (then no hidden title is added)
  function registerButton(e, cls, label) {
    var url = e.registrationUrl;
    if (!url) return "";
    var ext = isExternal(url);
    return '<a class="' + cls + '" ' + linkAttrs(url) + '><span>' + esc(label || e.registrationLabel || "Register") + (label ? "" : '<span class="fw-visually-hidden">: ' + esc(e.title) + "</span>") +
      (ext ? NEW_TAB : "") + "</span>" + '<span class="fw-btn__arrow" aria-hidden="true">' + (ext ? "↗" : "→") + "</span></a>";
  }
  function eventFacts(e, cls) {
    return factsList([
      ["When", e.dateDisplay ? esc(e.dateDisplay) : e.date ? '<time datetime="' + isoDate(e.date) + '">' + dateText(e.date) + "</time>" : ""],
      ["Where", esc(e.location)], ["For", esc(e.audience)], ["Hosted by", esc(e.host)]
    ], cls);
  }
  // Event photo with the yellow date card on its top-left corner
  function eventPhoto(e, cls, sizes) {
    var img = imageOf(e);
    if (!img) return "";
    return '<figure class="fw-evphoto ' + cls + '"><div class="fw-evphoto__frame"><div class="fw-media fw-evphoto__media" data-fw-reveal="clip">' + picture(img, sizes) + "</div>" +
      dateCard(e.date, "fw-evphoto__date") + "</div>" +
      (img.caption ? '<figcaption class="fw-label fw-media__caption">' + esc(img.caption) + "</figcaption>" : "") + "</figure>";
  }
  function pickEvent(el, d) {
    var id = el.getAttribute("data-fw-event"), e = id && findEvent(d, id);
    return e && e.status === "upcoming" ? e : leadEvent(d);
  }

  /* Resources: a record with eventRef takes its title, text, image and link from that event */
  function resourceList(d) {
    return d.resources.resources.map(function (r) {
      var e = r.eventRef && findEvent(d.events, r.eventRef);
      if (!e) return r.eventRef ? null : r;
      return {
        id: r.id, type: r.type || typeLabel(e), category: r.category, topics: r.topics || e.tags, featured: r.featured,
        title: e.title, description: e.description, image: imageOf(e), url: e.registrationUrl,
        ctaLabel: r.ctaLabel || e.registrationLabel || "Register", status: r.status || "available", event: e
      };
    }).filter(Boolean);
  }
  var STATUS = { available: "Open now", "on-request": "Free · sent by email", "coming-soon": "Coming soon" };
  function statusText(r) { return r.event && r.event.date ? "Starts " + dateText(r.event.date, "short") : STATUS[r.status] || ""; }
  var TYPE_ICON = {
    guide: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    framework: '<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><path d="M13.5 17.25h7.5M17.25 13.5V21"/>',
    checklist: '<path d="m3.5 6 2 2 3.5-3.5M3.5 13l2 2 3.5-3.5M12.5 7h8M12.5 14h8M12.5 20h8M4.5 20h3"/>',
    worksheet: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    plan: '<rect x="3" y="4.5" width="18" height="16.5" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 14h3M13.5 14h3M7.5 17.5h3"/>',
    program: '<path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>',
    event: '<rect x="3" y="4.5" width="18" height="16.5" rx="1.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><circle cx="12" cy="15" r="2"/>',
    article: '<path d="M5 3h14v18H5z"/><path d="M8.5 7.5h7M8.5 11h7M8.5 14.5h4"/>'
  };
  function typeIcon(type) {
    var k = String(type || "").toLowerCase();
    return '<svg class="fw-type__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (TYPE_ICON[k] || TYPE_ICON.guide) + "</svg>";
  }

  /* Resource card: photo · type mark · title · description · status. Event-backed
     resources carry the yellow date card on the photo. */
  function resourceCard(r, opts) {
    opts = opts || {};
    var type = String(r.type || "").toLowerCase(), img = imageOf(r);
    return '<li class="fw-rcard" data-fw-type="' + esc(type) + '" data-fw-category="' + esc((r.topics || []).join(" ")) + '" data-fw-reveal="fade"' +
      (opts.delay ? ' style="--fw-delay:' + opts.delay + 'ms"' : "") + ">" +
      '<a class="fw-rcard__link" ' + linkAttrs(r.url) + ">" +
        (img ? '<div class="fw-rcard__photo"><div class="fw-media fw-rcard__media" data-fw-reveal="clip">' + picture(img, opts.sizes || "(min-width: 1280px) 30vw, (min-width: 768px) 50vw, 100vw") + "</div>" +
          (r.event ? dateCard(r.event.date, "fw-datecard--sm fw-rcard__date") : "") + "</div>" : "") +
        '<p class="fw-label fw-rcard__type">' + typeIcon(type) + "<span>" + esc(r.type) + "</span>" + (r.category ? '<span class="fw-rcard__cat">' + esc(r.category) + "</span>" : "") + "</p>" +
        '<h3 class="fw-h3 fw-rcard__title"><span class="fw-resource__title-text">' + esc(r.title) + "</span></h3>" +
        '<p class="fw-body-s fw-rcard__desc">' + esc(r.description) + "</p>" +
        '<p class="fw-rcard__foot"><span class="fw-label fw-rcard__status">' + esc(statusText(r)) + "</span>" +
          '<span class="fw-rcard__cta">' + esc(r.ctaLabel || "Open") + (isExternal(r.url) ? NEW_TAB : "") + arrow(r.url) + "</span></p>" +
      "</a></li>";
  }

  /* Insight card: Home's Insights section and the article page's "Keep reading" */
  function contentCard(item, opts) {
    var img = imageOf(item);
    return '<li class="fw-resource' + (opts.lead ? " fw-resource--featured" : "") + '" data-fw-category="' + esc((item.topics || []).join(" ")) + '" data-fw-reveal="fade">' +
      '<a class="fw-resource__link" href="' + esc(insightHref(item.slug)) + '">' +
        (img ? '<div class="fw-resource__media fw-media" data-fw-reveal="clip">' + picture(img, opts.sizes) + "</div>" : "") +
        '<p class="fw-label fw-resource__meta"><span class="fw-resource__cat">' + esc(item.category) + '</span><span aria-hidden="true"> · </span><span>' +
          (opts.date ? dateText(item.date, "short") + " · " : "") + esc(item.readTime) + "</span></p>" +
        '<h3 class="' + (opts.lead ? "fw-h2" : "fw-h3") + ' fw-resource__title"><span class="fw-resource__title-text">' + esc(item.title) + "</span></h3>" +
      "</a></li>";
  }

  /* Social icons: simple single-line marks, labelled for screen readers and on hover */
  function socialIcon(name) {
    var paths = {
      facebook: '<path d="M15.5 3.5h-2.2a4 4 0 0 0-4 4V10H7v3.4h2.3v7.1h3.5v-7.1h2.6l.5-3.4h-3.1V7.8c0-.6.4-.9.9-.9h1.8V3.5Z"/>',
      instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle class="fw-social__dot" cx="17.3" cy="6.7" r="1"/>',
      linkedin: '<path d="M7 10v9M7 6.2v.1M11 19v-5.2a3 3 0 0 1 6 0V19M11 10v9"/><rect x="3" y="3" width="18" height="18" rx="3"/>',
      youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10.5 9.5 4 2.5-4 2.5v-5Z"/>',
      group: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5v-.8A4.7 4.7 0 0 1 8.2 14h1.6a4.7 4.7 0 0 1 4.7 4.7v.8"/><path d="M15.5 5.7a3 3 0 0 1 0 5.6M17.5 14.2a4.7 4.7 0 0 1 3 4.5v.8"/>'
    };
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || "") + "</svg>";
  }

  /* Success story: evidence of the work. Drafts carry a visible tag; their text is
     template copy to replace, never a real claim. */
  /* Success stories showcase (Home #stories): one featured story on a panel, an index of
     previous / next to step through them (buttons, or ← → while focus is inside). Works for testimonials (name + quote)
     and longer stories (title + summary, optional image, category, url). Nothing is added
     to the content: no quotation marks, ratings or results that aren't in the JSON. */
  function storyName(s) { return s.name || s.title || ""; }
  function storyText(s) { return s.quote || s.summary || ""; }
  function showcaseSlide(s, i, n) {
    var img = imageOf(s), text = storyText(s), len = text.length;
    var size = len > 200 ? " fw-showcase__text--long" : len < 70 ? " fw-showcase__text--short" : "";
    var draft = s.status !== "published";
    return '<div class="fw-showcase__slide' + (img ? " fw-showcase__slide--media" : "") + (i === 0 ? " is-active" : "") + '" role="group" aria-roledescription="slide"' +
        ' aria-label="' + (i + 1) + " of " + n + '"' + (i === 0 ? "" : ' aria-hidden="true"') + ">" +
      (img ? '<div class="fw-media fw-showcase__media">' + picture(img, "(min-width: 1024px) 28vw, 100vw") + "</div>" : "") +
      '<figure class="fw-showcase__story">' +
        (draft ? '<p class="fw-label fw-showcase__draft">Draft · replace with a real story</p>' : "") +
        (s.category ? '<p class="fw-label fw-showcase__cat">' + esc(s.category) + "</p>" : "") +
        (s.quote ? '<blockquote class="fw-showcase__text' + size + '"><p>' + esc(s.quote) + "</p></blockquote>"
                 : '<p class="fw-h2 fw-showcase__title">' + esc(s.title) + '</p><p class="fw-body-l fw-showcase__summary">' + esc(s.summary) + "</p>") +
        (s.quote ? '<figcaption class="fw-showcase__name">' + esc(storyName(s)) + "</figcaption>" : "") +
        (s.url ? '<a class="fw-link fw-showcase__more" ' + linkAttrs(s.url) + ">Read the story" + (isExternal(s.url) ? NEW_TAB : "") + " " + arrow(s.url) + "</a>" : "") +
      "</figure></div>";
  }
  function setupShowcase(root, count) {
    var slides = root.querySelectorAll(".fw-showcase__slide");
    var num = root.querySelector(".fw-showcase__num"), bar = root.querySelector(".fw-showcase__progress span"), current = 0;
    function select(i) {
      i = (i + count) % count;
      slides[current].classList.remove("is-active"); slides[current].setAttribute("aria-hidden", "true");
      current = i;
      slides[i].classList.add("is-active"); slides[i].removeAttribute("aria-hidden");
      num.textContent = ("0" + (i + 1)).slice(-2);
      bar.style.transform = "scaleX(" + (i + 1) / count + ")";
    }
    root.addEventListener("click", function (e) {
      var step = e.target.closest("[data-fw-sc-step]");
      if (step) select(current + (+step.getAttribute("data-fw-sc-step")));
    });
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") select(current + 1);
      else if (e.key === "ArrowLeft") select(current - 1);
      else return;
      e.preventDefault();
    });
  }

  function relatedLink(href, label, title) {
    return '<a class="fw-related__link" ' + linkAttrs(href) + '><span class="fw-label">' + esc(label) + "</span>" +
      '<span class="fw-h4 fw-related__title">' + esc(title) + (isExternal(href) ? NEW_TAB : "") + "</span>" + arrow(href) + "</a>";
  }

  /* ---- 11. VIEWS: what each [data-fw-render] element shows --------------------- */
  // Optional attributes on the element: data-fw-limit="3" · data-fw-skip="featured" ·
  // data-fw-types="guide checklist" · data-fw-event="<id>" · data-fw-slug="<slug>"
  function limitOf(el, fallback) { return parseInt(el.getAttribute("data-fw-limit"), 10) || fallback; }

  var VIEWS = {
    /* Home · Insights: the featured insight large, the next two stacked beside it */
    "home-insights": { needs: ["insights"], render: function (el, d) {
      var list = insightsByDate(d.insights), lead = leadInsight(list);
      el.innerHTML = contentCard(lead, { lead: true, date: true, sizes: "(min-width: 1280px) 55vw, 100vw" }) +
        list.filter(function (i) { return i !== lead; }).slice(0, 2).map(function (i) {
          return contentCard(i, { date: true, sizes: "(min-width: 1280px) 30vw, (min-width: 768px) 50vw, 100vw" });
        }).join("");
    } },

    /* Learn · featured insight (insights.json "featured": true) */
    "insight-feature": { needs: ["insights"], render: function (el, d) {
      var i = leadInsight(insightsByDate(d.insights)), href = esc(insightHref(i.slug));
      el.innerHTML =
        (imageOf(i) ? '<a class="fw-media fw-feature__media" href="' + href + '" tabindex="-1" aria-hidden="true" data-fw-reveal="clip">' +
          picture(imageOf(i), "(min-width: 1280px) 55vw, 100vw") + "</a>" : "") +
        '<div class="fw-feature__body">' + insightMeta(i, "Featured insight") +
          '<h2 class="fw-h1 fw-feature__title" id="fw-feat-title"><a class="fw-post__link" href="' + href + '">' + esc(i.title) + "</a></h2>" +
          '<p class="fw-body-l fw-feature__excerpt">' + esc(i.excerpt) + "</p>" +
          '<div class="fw-feature__actions"><a class="fw-btn fw-btn--dark fw-btn--lg" href="' + href + '"><span>Read the insight</span><span class="fw-btn__arrow" aria-hidden="true">→</span></a></div>' +
        "</div>";
    } },

    /* Learn · every other insight, newest first */
    "insights-list": { needs: ["insights"], render: function (el, d) {
      // The first insight on each topic also answers that topic's anchor (learn.html#ai, #business …)
      var list = insightsByDate(d.insights), lead = leadInsight(list), used = {};
      el.innerHTML = list.filter(function (i) { return i !== lead; }).map(function (i) {
        var href = esc(insightHref(i.slug)), img = imageOf(i), topic = (i.topics || [])[0];
        var id = topic && !used[topic] && !doc.getElementById(topic) ? topic : "insight-" + i.slug;
        if (topic) used[topic] = true;
        return '<li class="fw-post' + (img ? "" : " fw-post--text") + '" id="' + esc(id) + '" data-fw-category="' + esc((i.topics || []).join(" ")) + '">' +
          (img ? '<a class="fw-media fw-post__thumb" href="' + href + '" tabindex="-1" aria-hidden="true" data-fw-reveal="clip">' + picture(img, "(min-width: 1024px) 28vw, 100vw") + "</a>" : "") +
          '<article class="fw-post__body">' + insightMeta(i) +
            '<h3 class="fw-h2 fw-post__title"><a class="fw-post__link" href="' + href + '">' + esc(i.title) + "</a></h3>" +
            '<p class="fw-body fw-post__excerpt">' + esc(i.excerpt) + "</p>" +
            '<a class="fw-link" href="' + href + '">Read insight<span class="fw-visually-hidden">: ' + esc(i.title) + '</span> <span class="fw-link__arrow" aria-hidden="true">→</span></a>' +
          "</article></li>";
      }).join("");
    } },

    /* Learn · hero quick links: the featured insight, the next workshop, the featured resource */
    "learn-quick": { needs: ["insights", "events", "resources"], render: function (el, d) {
      var lead = leadInsight(insightsByDate(d.insights)), ev = leadEvent(d.events);
      var res = resourceList(d).filter(function (r) { return r.featured; })[0];
      var item = function (href, label, title) {
        return '<li><a class="fw-quick__link" href="' + esc(href) + '"><span class="fw-label">' + esc(label) + '</span><span class="fw-quick__title">' + esc(title) + "</span></a></li>";
      };
      el.innerHTML = item(insightHref(lead.slug), "Featured insight", lead.title) +
        (ev ? item("#workshops", "Next up · " + dateText(ev.date, "short"), ev.title) : "") +
        (res ? item("#resources", res.type, res.title) : "");
    } },

    /* Home hero · "Now on Faith Works": the next event, the featured insight */
    "home-now": { needs: ["insights", "events"], render: function (el, d) {
      var lead = leadInsight(insightsByDate(d.insights)), ev = leadEvent(d.events);
      var item = function (href, label, title) {
        return '<li><a class="fw-quick__link" href="' + esc(href) + '"><span class="fw-label">' + esc(label) + '</span><span class="fw-quick__title">' + esc(title) +
          ' <span class="fw-link__arrow" aria-hidden="true">→</span></span></a></li>';
      };
      el.innerHTML = (ev ? item("#events", "Next up · " + dateText(ev.date, "short"), ev.shortTitle || ev.title) : "") +
        item(insightHref(lead.slug), "Read · " + lead.readTime, lead.title) +
        item("community.html#connection", "Join", "The Faith Works Community");
    } },

    /* Learn · the featured resource, large */
    "resource-feature": { needs: ["resources", "events"], render: function (el, d) {
      var r = resourceList(d).filter(function (x) { return x.featured; })[0];
      if (!r) { el.hidden = true; return; }
      el.innerHTML =
        (imageOf(r) ? '<div class="fw-media fw-feature__media" data-fw-reveal="clip">' + picture(imageOf(r), "(min-width: 1280px) 50vw, 100vw") + "</div>" : "") +
        '<div class="fw-feature__body">' + eyebrow("Featured resource") +
          '<p class="fw-label fw-rcard__type">' + typeIcon(r.type) + "<span>" + esc(r.type) + '</span><span class="fw-rcard__cat">' + esc(statusText(r)) + "</span></p>" +
          '<h2 class="fw-h1 fw-feature__title" id="fw-learn-res-title">' + esc(r.title) + "</h2>" +
          '<p class="fw-body-l fw-feature__excerpt">' + esc(r.description) + "</p>" +
          '<div class="fw-feature__actions"><a class="fw-btn fw-btn--dark fw-btn--lg" ' + linkAttrs(r.url) + "><span>" + esc(r.ctaLabel || "Get the resource") + '</span><span class="fw-btn__arrow" aria-hidden="true">→</span></a></div>' +
        "</div>";
    } },

    /* Learn · resource cards, mixed types (data-fw-skip="featured" leaves out the one above) */
    "resources-grid": { needs: ["resources", "events"], render: function (el, d) {
      var skip = el.getAttribute("data-fw-skip") === "featured";
      var list = resourceList(d).filter(function (r) { return !(skip && r.featured); }).slice(0, limitOf(el, 99));
      if (!list.length) { el.hidden = true; return; }
      el.innerHTML = list.map(function (r, n) { return resourceCard(r, { delay: n * 60 }); }).join("");
    } },

    /* Implement · Templates & tools: the sheets you can use (data-fw-types) */
    "resource-sheets": { needs: ["resources", "events"], render: function (el, d) {
      var types = (el.getAttribute("data-fw-types") || "guide framework checklist worksheet plan").split(" ");
      el.innerHTML = resourceList(d).filter(function (r) { return types.indexOf(String(r.type).toLowerCase()) !== -1; }).map(function (r, n) {
        var href = r.status === "on-request" ? "#access" : r.url;
        return '<li class="fw-impl-templates__sheet" data-fw-type="' + esc(String(r.type).toLowerCase()) + '" data-fw-reveal="fade" style="--fw-delay:' + n * 70 + 'ms">' +
          '<p class="fw-label fw-rcard__type">' + typeIcon(r.type) + "<span>" + esc(r.type) + "</span></p>" +
          '<div class="fw-impl-templates__rules" aria-hidden="true"><span class="fw-impl-templates__heading"></span><span></span><span></span></div>' +
          '<h3 class="fw-h4">' + esc(r.title) + "</h3>" +
          '<p class="fw-body-s">' + esc(r.description) + "</p>" +
          '<p class="fw-label fw-impl-templates__status">' + esc(statusText(r)) + "</p>" +
          '<a class="fw-link" ' + linkAttrs(href) + ">" + (r.status === "on-request" ? "Get it" : esc(r.ctaLabel || "Open")) + '<span class="fw-visually-hidden">: ' + esc(r.title) + "</span> " + arrow(href) + "</a>" +
        "</li>";
      }).join("");
    } },

    /* Implement · the program (programs.json): intro + photo + one tab per track */
    "program": { needs: ["programs"], render: function (el, d) {
      var p = d.programs.programs.filter(function (x) { return x.id === (el.getAttribute("data-fw-program") || x.id); })[0];
      if (!p) { el.hidden = true; return; }
      var img = imageOf(p);
      el.innerHTML =
        '<div class="fw-grid fw-impl-program__head">' +
          '<div class="fw-page-intro fw-impl-program__intro">' + eyebrow("Program") +
            '<h2 class="fw-display-l" id="fw-program-title">' + esc(p.title) + "</h2>" +
            '<p class="fw-body-l">' + esc(p.summary) + "</p>" +
            (p.url ? '<a class="fw-btn fw-btn--dark fw-btn--lg" ' + linkAttrs(p.url) + "><span>" + esc(p.ctaLabel || "Find out more") + '</span><span class="fw-btn__arrow" aria-hidden="true">→</span></a>' : "") +
          "</div>" +
          (img ? '<div class="fw-media fw-impl-program__photo" data-fw-reveal="clip">' + picture(img, "(min-width: 1280px) 30vw, 100vw") + "</div>" : "") +
        "</div>" +
        '<div class="fw-tabs" data-fw-tabs>' +
          '<div class="fw-tabs__list" role="tablist" aria-label="Program tracks">' + p.tracks.map(function (t, n) {
            return '<button class="fw-tabs__tab" role="tab" id="fw-tab-' + esc(t.id) + '" aria-controls="fw-track-' + esc(t.id) + '" aria-selected="' + (n === 0) + '" type="button">' + esc(t.title) + "</button>";
          }).join("") + "</div>" +
          p.tracks.map(function (t, n) {
            return '<div class="fw-tabs__panel fw-grid fw-track" id="fw-track-' + esc(t.id) + '" role="tabpanel" aria-labelledby="fw-tab-' + esc(t.id) + '">' +
              '<div class="fw-track__head"><p class="fw-label">Track ' + ("0" + (n + 1)).slice(-2) + '</p><h3 class="fw-h1">' + esc(t.title) + "</h3></div>" +
              '<div class="fw-track__body"><p class="fw-body-l">' + esc(t.summary) + "</p>" + ticks(t.points) +
                (t.output ? '<div class="fw-track__output"><p class="fw-label">You leave with</p><p class="fw-h3">' + esc(t.output) + "</p></div>" : "") +
              "</div></div>";
          }).join("") +
        "</div>";
    } },

    /* Home + Community · the featured upcoming event (events.json "featured": true).
       Copy on the left; the photo on the right with the yellow date card on it. */
    "event-feature": { needs: ["events"], render: function (el, d) {
      var e = leadEvent(d.events);
      if (!e) { el.hidden = true; return; }
      var titleId = el.getAttribute("aria-labelledby") || "fw-event-feature-title";
      el.innerHTML =
        '<div class="fw-event-feature__copy" data-fw-reveal="fade">' +
          '<p class="fw-label fw-event-feature__label">' + (e.featured ? "Featured · " : "Next · ") + esc(typeLabel(e)) + "</p>" +
          '<h3 class="fw-h2 fw-event-feature__title" id="' + esc(titleId) + '">' + esc(e.title) + "</h3>" +
          '<p class="fw-body-l fw-event-feature__desc">' + esc(e.description) + "</p>" +
          ticks(e.highlights, "fw-event-feature__ticks") +
          eventFacts(e, "fw-event-feature__facts") +
          '<div class="fw-event-feature__actions">' + registerButton(e, "fw-btn fw-btn--primary fw-btn--lg") +
            (e.note ? '<p class="fw-body-s fw-event-feature__note">' + esc(e.note) + "</p>" : "") + "</div>" +
        "</div>" +
        eventPhoto(e, "fw-event-feature__figure", "(min-width: 1280px) 45vw, (min-width: 1024px) 50vw, 100vw");
    } },

    /* Home + Learn · dated upcoming events, one simple row each: yellow date card,
       type, title, when + where, Register (to the event's own page), photo. */
    "event-cards": { needs: ["events"], render: function (el, d) {
      var list = datedUpcoming(d.events);
      if (!list.length) { el.outerHTML = '<p class="fw-body">New dates are announced here first. <a class="fw-link" href="#join" data-fw-to-footer>Get notified</a></p>'; return; }
      el.innerHTML = list.map(function (e, n) {
        var img = imageOf(e), id = "fw-evrow-" + esc(e.id);
        return '<li class="fw-evcard" data-fw-reveal="fade" style="--fw-delay:' + n * 80 + 'ms">' +
          dateCard(e.date, "fw-evcard__date") +
          '<div class="fw-evcard__body">' +
            '<p class="fw-label fw-evcard__type">' + esc(typeLabel(e)) + "</p>" +
            '<h3 class="fw-h2 fw-evcard__title" id="' + id + '">' + esc(e.title) + "</h3>" +
            '<p class="fw-label fw-meta fw-evcard__meta"><span>' + esc(e.dateDisplay || dateText(e.date, "weekday")) + "</span>" +
              (e.location ? SEP + "<span>" + esc(e.location) + "</span>" : "") + "</p>" +
            registerButton(e, "fw-btn fw-btn--primary fw-evcard__cta") +
          "</div>" +
          (img ? '<div class="fw-media fw-evcard__media" data-fw-reveal="clip"' + (img.width ? ' style="aspect-ratio:' + img.width + " / " + img.height + '"' : "") + ">" +
            picture(img, "(min-width: 1024px) 352px, (min-width: 768px) 288px, 100vw") + "</div>" : "") +
        "</li>";
      }).join("");
    } },

    /* Home · every other upcoming event as a row */
    "home-event-rows": { needs: ["events"], render: function (el, d) {
      var lead = leadEvent(d.events);
      var rows = upcomingEvents(d.events).filter(function (e) { return e !== lead; });
      if (!rows.length) { (el.closest("[data-fw-render-wrap]") || el).hidden = true; return; }
      el.innerHTML = rows.map(function (e) {
        return '<li class="fw-event-row">' +
          '<p class="fw-event-row__date"><span class="fw-h3">' + (e.date ? '<time datetime="' + isoDate(e.date) + '">' + dateText(e.date, "short").replace(/ \d{4}$/, "") + "</time>" : "TBA") + "</span></p>" +
          '<h4 class="fw-h4 fw-event-row__title">' + esc(e.title) + "</h4>" +
          '<p class="fw-label fw-event-row__meta">' + esc(typeLabel(e)) + " · " + esc(e.date ? e.location || "" : e.dateLabel || "Dates to be announced") + "</p>" +
          registerButton(e, "fw-btn fw-btn--reversed fw-event-row__cta") +
        "</li>";
      }).join("");
    } },

    /* Learn (workshops) + Community (the others) · dated upcoming events in full.
       data-fw-skip="featured": the featured event is already shown above. */
    "event-listings": { needs: ["events"], render: function (el, d) {
      var list = datedUpcoming(d.events);
      if (el.getAttribute("data-fw-skip") === "featured") {
        var lead = leadEvent(d.events);
        list = list.filter(function (e) { return e !== lead; });
        if (!list.length) { el.hidden = true; return; }
      }
      if (!list.length) { el.innerHTML = '<p class="fw-body">New dates are announced here first. <a class="fw-link" href="community.html#register">Get notified</a></p>'; return; }
      el.innerHTML = list.map(function (e) {
        var id = "fw-ev-" + esc(e.id);
        return '<article class="fw-listing" aria-labelledby="' + id + '">' +
          '<div class="fw-listing__date">' + eventPhoto(e, "fw-listing__figure", "(min-width: 1024px) 26vw, 100vw") + "</div>" +
          '<div class="fw-listing__main">' +
            '<p class="fw-label fw-listing__type">' + esc(typeLabel(e)) + "</p>" +
            '<h3 class="fw-h1" id="' + id + '">' + esc(e.title) + "</h3>" +
            '<p class="fw-body-l">' + esc(e.description) + "</p>" +
            ticks(e.highlights) +
            eventFacts(e, "fw-listing__facts") +
            (e.note ? '<p class="fw-body-s">' + esc(e.note) + "</p>" : "") +
            '<div class="fw-listing__actions">' + registerButton(e, "fw-btn fw-btn--primary fw-btn--lg") + "</div>" +
          "</div></article>";
      }).join("");
    } },

    /* Community · upcoming events without dates yet */
    "event-soon": { needs: ["events"], render: function (el, d) {
      var list = upcomingEvents(d.events).filter(function (e) { return !e.date; });
      if (!list.length) { el.hidden = true; return; }
      el.innerHTML = list.map(function (e) {
        return '<li class="fw-index__row"><a class="fw-index__link fw-index__link--plain" ' + linkAttrs(e.registrationUrl || "#register") + ">" +
          '<span class="fw-scale-paths__item"><span class="fw-index__title fw-h3">' + esc(e.title) + '<span class="fw-index__arrow" aria-hidden="true">→</span></span>' +
          '<span class="fw-body-s">' + esc(e.dateLabel || "Dates to be announced") + ".</span></span>" +
          '<span class="fw-label fw-index__meta">' + esc(e.registrationLabel || "Get notified") + "</span></a></li>";
      }).join("");
    } },

    /* About · "Programs & events": the next event and the latest highlight lead the list */
    "about-events": { needs: ["events", "event-highlights"], quiet: true, render: function (el, d) {
      var e = leadEvent(d.events), last = d["event-highlights"].highlights[0], html = "";
      if (e) html += '<li class="fw-dl__item" data-fw-type="' + esc(e.type) + '">' +
        '<div><p class="fw-label fw-meta"><time datetime="' + isoDate(e.date) + '">' + dateText(e.date) + "</time>" + (e.location ? SEP + "<span>" + esc(e.location) + "</span>" : "") + "</p>" +
          '<h3 class="fw-h2">' + esc(e.title) + '</h3><p class="fw-body">' + esc(e.description) + "</p></div>" +
        registerButton(e, "fw-btn fw-btn--primary") + "</li>";
      if (last) html += '<li class="fw-dl__item" data-fw-type="highlight">' +
        '<div><h3 class="fw-h2">' + esc(last.title) + '</h3><p class="fw-body">' + esc(last.caption || "") + "</p></div>" +
        '<a class="fw-btn fw-btn--reversed" href="community.html#highlights">See photos</a></li>';
      el.insertAdjacentHTML("afterbegin", html);
    } },

    /* Community hero · "Next up: …" */
    "event-next-link": { needs: ["events"], quiet: true, render: function (el, d) {
      var e = leadEvent(d.events);
      if (!e) { el.hidden = true; return; }
      el.textContent = "Next up: " + (e.shortTitle || e.title) + " · " + dateText(e.date, "short") + " →";
    } },

    /* Community · Event highlights: a visual board of photos and videos
       (event-highlights.json). Add an object and a tile appears. */
    "event-highlights": { needs: ["event-highlights"], render: function (el, d) {
      var list = d["event-highlights"].highlights.slice(0, limitOf(el, 99));
      if (!list.length) { (el.closest("section") || el).hidden = true; return; }
      el.innerHTML = list.map(function (h, n) {
        var img = imageOf(h), video = h.type === "video" && h.video;
        var inner = '<div class="fw-media fw-tile__media" data-fw-reveal="clip" style="--fw-delay:' + (n % 4) * 70 + 'ms">' + picture(img, h.size === "wide" ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, 50vw") +
            (video ? '<video class="fw-tile__video" src="' + esc(asset(h.video)) + '" muted loop playsinline preload="none" aria-hidden="true"></video>' : "") + "</div>" +
          '<div class="fw-tile__overlay"><p class="fw-tile__caption">' + esc(h.caption || h.title) + "</p>" +
            (h.date ? '<p class="fw-label fw-tile__date">' + dateText(h.date, "short") + "</p>" : "") + "</div>" +
          (video ? '<span class="fw-tile__play" aria-hidden="true"></span>' : "");
        return '<li class="fw-tile fw-tile--' + esc(h.size || "regular") + (video ? " fw-tile--video" : "") + '">' +
          (h.url ? '<a class="fw-tile__link" ' + linkAttrs(h.url) + ' aria-label="' + esc(h.title) + (isExternal(h.url) ? " (opens in a new tab)" : "") + '">' + inner + "</a>" : '<div class="fw-tile__link">' + inner + "</div>") +
        "</li>";
      }).join("");
      // Videos play (muted) while hovered or focused, and stop when you leave
      el.querySelectorAll(".fw-tile--video").forEach(function (tile) {
        var v = tile.querySelector("video");
        var play = function () { if (!reduceMotion) v.play().catch(function () {}); };
        var stop = function () { v.pause(); };
        tile.addEventListener("mouseenter", play); tile.addEventListener("focusin", play);
        tile.addEventListener("mouseleave", stop); tile.addEventListener("focusout", stop);
      });
    } },

    /* "Related" lists: one insight (data-fw-slug, default: the featured one)
       or one event (data-fw-event = its id, default: the featured upcoming one) */
    "insight-link": { needs: ["insights"], quiet: true, render: function (el, d) {
      var i = findInsight(d.insights.insights, el.getAttribute("data-fw-slug")) || leadInsight(insightsByDate(d.insights));
      el.innerHTML = relatedLink(insightHref(i.slug), "Insight · " + i.category, i.title);
    } },
    "event-link": { needs: ["events"], quiet: "hide", render: function (el, d) {
      var e = pickEvent(el, d.events);
      if (!e) { el.hidden = true; return; }
      el.innerHTML = relatedLink(e.registrationUrl, typeLabel(e) + " · " + (e.date ? dateText(e.date, "short") : e.dateLabel || "Dates TBA"), e.title);
    } },
    /* An event's Register button anywhere on a page (the placeholder <a> is the no-JS fallback) */
    "event-button": { needs: ["events"], quiet: "hide", render: function (el, d) {
      var e = pickEvent(el, d.events);
      if (!e) { el.hidden = true; return; }
      el.outerHTML = registerButton(e, el.className || "fw-btn fw-btn--primary",
        (e.registrationLabel || "Register") + ": " + (e.shortTitle || e.title) + (e.date ? " · " + dateText(e.date, "short").replace(/ \d{4}$/, "") : ""));
    } },

    /* Home · Success stories (success-stories.json). The first leads; drafts only while showDrafts is true */
    "stories": { needs: ["success-stories"], render: function (el, d) {
      var data = d["success-stories"];
      var list = data.stories.filter(function (s) { return s.status === "published" || (data.showDrafts && s.status === "draft"); }).slice(0, limitOf(el, 12));
      if (!list.length) { (el.closest("section") || el).hidden = true; return; }
      var n = list.length, total = ("0" + n).slice(-2);
      el.innerHTML = '<div class="fw-showcase" data-fw-reveal="fade">' +
        '<div class="fw-showcase__stage" role="region" aria-roledescription="carousel" aria-label="Success stories">' +
          '<p class="fw-showcase__count" aria-hidden="true"><span class="fw-showcase__num">01</span><span class="fw-showcase__total">/ ' + total + "</span></p>" +
          '<div class="fw-showcase__slides" aria-live="polite">' + list.map(function (s, i) { return showcaseSlide(s, i, n); }).join("") + "</div>" +
          (n > 1 ? '<div class="fw-showcase__nav">' +
            '<span class="fw-showcase__progress" aria-hidden="true"><span style="transform:scaleX(' + 1 / n + ')"></span></span>' +
            '<button class="fw-showcase__step" type="button" data-fw-sc-step="-1" aria-label="Previous story"><span aria-hidden="true">←</span></button>' +
            '<button class="fw-showcase__step" type="button" data-fw-sc-step="1" aria-label="Next story"><span aria-hidden="true">→</span></button>' +
          "</div>" : "") +
        "</div>" +
      "</div>";
      if (n > 1) setupShowcase(el.querySelector(".fw-showcase"), n);
    } },

    /* Join the community: the Faith Works Community (site.json "community"), set apart from the page icons */
    "community-cta": { needs: ["site"], quiet: "hide", render: function (el, d) {
      var c = d.site.community;
      if (!c) { el.hidden = true; return; }
      el.innerHTML = '<div class="fw-group__mark" aria-hidden="true">' + socialIcon("group") + "</div>" +
        '<div class="fw-group__copy">' + eyebrow(c.eyebrow || "Join the community") +
          '<h3 class="fw-h2 fw-group__title">' + esc(c.title) + "</h3>" +
          '<p class="fw-body-l fw-group__text">' + esc(c.text) + "</p>" +
        "</div>" +
        '<a class="fw-btn fw-btn--dark fw-btn--lg fw-group__cta" ' + linkAttrs(c.url) + "><span>" + esc(c.ctaLabel) + NEW_TAB + '</span><span class="fw-btn__arrow" aria-hidden="true">↗</span></a>';
    } },

    /* Implement · AI tools used in practical workflows (tools.json). Logos are single-colour
       SVGs drawn as a CSS mask, so they take the section's ink colour. */
    "ai-tools": { needs: ["tools"], render: function (el, d) {
      el.innerHTML = d.tools.tools.map(function (t, n) {
        return '<li class="fw-tool" data-fw-reveal="fade" style="--fw-delay:' + n * 50 + 'ms">' +
          '<a class="fw-tool__link" ' + linkAttrs(t.url) + ">" +
            '<span class="fw-tool__logo" aria-hidden="true" style="--fw-tool-logo:url(&quot;' + esc(asset(t.logo)) + '&quot;)"></span>' +
            '<span class="fw-tool__name">' + esc(t.name) + (isExternal(t.url) ? NEW_TAB : "") + "</span>" +
            (t.category ? '<span class="fw-label fw-tool__cat">' + esc(t.category) + "</span>" : "") +
            (t.description ? '<span class="fw-body-s fw-tool__use">' + esc(t.description) + "</span>" : "") +
          "</a></li>";
      }).join("");
    } },

    /* Social icons (site.json "social"): the Facebook page, Instagram, LinkedIn. The
       Faith Works Community is not an icon here; it has its own call to action (community-cta). */
    "social": { needs: ["site"], quiet: "hide", render: function (el, d) {
      el.innerHTML = d.site.social.map(function (s) {
        return '<li><a class="fw-social__link" href="' + esc(s.url) + '" target="_blank" rel="noopener" aria-label="' + esc(s.label || s.name) +
          ' (opens in a new tab)" title="' + esc(s.name) + '">' + socialIcon(s.icon) + "</a></li>";
      }).join("");
    } },

    /* insight.html · the full article for ?slug=… */
    "article": { needs: ["insights"], render: function (el, d) { return renderArticle(el, d); } }
  };

  // Browsers block fetch() on file:// pages, so opening the .html straight from disk
  // shows no JSON content. Say so plainly instead of a vague "refresh" message.
  var FILE_PAGE = location.protocol === "file:";
  if (FILE_PAGE && doc.querySelector("[data-fw-render]") && window.console) {
    console.error("[Faith Works] JSON content can't load from a file:// page. Serve the site folder over HTTP, " +
      "e.g. run `python -m http.server 8000` in the site folder and open http://localhost:8000");
  }

  var renders = [];
  doc.querySelectorAll("[data-fw-render]").forEach(function (el) {
    var view = VIEWS[el.getAttribute("data-fw-render")];
    if (!view) return;
    var parent = el.parentNode;
    el.setAttribute("aria-busy", "true");
    renders.push(Promise.all(view.needs.map(getData)).then(function (res) {
      var d = {};
      view.needs.forEach(function (n, i) { d[n] = res[i]; });
      return view.render(el, d);
    }).then(function () {
      // A view may replace its element (event-button), so look inside the parent
      var scope = el.isConnected ? el : parent;
      scope.querySelectorAll("[data-fw-reveal], [data-fw-draw]").forEach(reveal);
      scope.querySelectorAll("[data-fw-tabs]").forEach(setupTabs);
    }).catch(function (err) {
      if (window.console) console.warn("[Faith Works] content could not load:", err.message);
      // quiet views keep their static fallback markup ("hide": remove the element)
      if (view.quiet) { if (view.quiet === "hide") el.hidden = true; return; }
      var msg = FILE_PAGE
        ? "This content loads from assets/data/*.json, which browsers block on file:// pages. Open the site through a local server (e.g. http://localhost:8000)."
        : "This content couldn’t load. Please refresh the page to try again.";
      el.innerHTML = /^(UL|OL)$/.test(el.tagName) ? '<li class="fw-render-error">' + msg + "</li>" : '<p class="fw-render-error">' + msg + "</p>";
    }).then(function () { el.removeAttribute("aria-busy"); }));
  });

  // Rendered content changes the page height, and may create the #anchor
  // the URL points at, so land on the anchor again once everything is in.
  if (renders.length && location.hash.length > 1) {
    Promise.all(renders).then(function () {
      var t = doc.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t) t.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }

  /* ---- 12. INSIGHT ARTICLE PAGE ---------------------------------------------- */
  // insight.html?slug=<slug> is a normal page: the site header and footer, and the
  // article rendered into <main data-fw-render="article">. Every insight card links
  // here, so each insight has its own shareable URL. Unknown slugs get a "not found" state.

  // Article blocks (insights.json "content"). Text is trusted, editor-written HTML
  // so it can carry links and emphasis; labels and captions are escaped.
  function blockItems(items, ordered) {
    var tag = ordered ? "ol" : "ul";
    return "<" + tag + ' class="fw-article__list' + (ordered ? " fw-article__list--ordered" : "") + '">' + (items || []).map(function (t) {
      return "<li>" + (typeof t === "string" ? t : "<strong>" + (t.title || "") + "</strong> " + (t.text || "")) + "</li>";
    }).join("") + "</" + tag + ">";
  }
  function blocksHTML(blocks) {
    return (blocks || []).map(function (b) {
      switch (b.type) {
        case "h2": case "heading": return '<h2 class="fw-article__h2">' + b.text + "</h2>";
        case "h3": case "subheading": return '<h3 class="fw-article__h3">' + b.text + "</h3>";
        case "list": return blockItems(b.items, b.ordered);
        case "quote": return '<blockquote class="fw-article__quote" data-fw-reveal="fade"><p>' + b.text + "</p>" +
          (b.cite ? '<footer class="fw-label">' + esc(b.cite) + "</footer>" : "") + "</blockquote>";
        case "callout": return '<aside class="fw-article__callout" aria-label="' + esc(b.label || "Note") + '" data-fw-reveal="fade">' +
          '<p class="fw-label fw-article__callout-label">' + esc(b.label || "Note") + "</p>" + (b.title ? '<p class="fw-h4">' + b.title + "</p>" : "") +
          (b.text ? "<p>" + b.text + "</p>" : "") + (b.items ? blockItems(b.items, b.ordered) : "") + "</aside>";
        case "takeaway": return '<aside class="fw-article__takeaway" aria-label="Practical takeaway" data-fw-reveal="fade">' +
          '<p class="fw-label">Practical takeaway</p>' + (b.title ? '<p class="fw-h3">' + b.title + "</p>" : "") +
          (b.text ? "<p>" + b.text + "</p>" : "") +
          (b.items ? '<ul class="fw-ticks">' + b.items.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ul>" : "") + "</aside>";
        case "image": return '<figure class="fw-article__image"><div class="fw-media" data-fw-reveal="clip">' + picture(imageOf(b), "(min-width: 1024px) 720px, 100vw") + "</div>" +
          (b.caption ? '<figcaption class="fw-label fw-media__caption">' + esc(b.caption) + "</figcaption>" : "") + "</figure>";
        case "link": return '<p class="fw-article__linkcard">' + relatedLink(b.href, b.label || "Read more", b.text || b.href) + "</p>";
        case "cta": return '<aside class="fw-article__cta" data-fw-reveal="fade"><p class="fw-h3">' + b.title + "</p>" + (b.text ? "<p>" + b.text + "</p>" : "") +
          '<a class="fw-btn fw-btn--primary fw-btn--lg" ' + linkAttrs(b.href) + "><span>" + esc(b.label) + '</span><span class="fw-btn__arrow" aria-hidden="true">→</span></a></aside>';
        default: return "<p>" + b.text + "</p>";
      }
    }).join("");
  }

  // "Put it into practice": the resources the article names (resources.json ids)
  function practiceHTML(ins, d) {
    if (!d || !ins.resources || !ins.resources.length) return "";
    var all = resourceList(d);
    var picked = ins.resources.map(function (id) { return all.filter(function (r) { return r.id === id; })[0]; }).filter(Boolean);
    if (!picked.length) return "";
    return '<section class="fw-container fw-article__practice" aria-labelledby="fw-practice-title">' +
      '<p class="fw-label fw-article__practice-label" id="fw-practice-title">Put it into practice</p>' +
      '<ul class="fw-rgrid fw-rgrid--2" role="list">' + picked.map(function (r) { return resourceCard(r, { sizes: "(min-width: 768px) 40vw, 100vw" }); }).join("") + "</ul></section>";
  }

  // Keep reading: the article's related slugs, topped up with the newest others
  function relatedHTML(ins, list) {
    var picked = (ins.related || []).map(function (s) { return findInsight(list, s); }).filter(Boolean);
    insightsByDate({ insights: list }).forEach(function (i) {
      if (picked.length < 3 && i !== ins && picked.indexOf(i) === -1) picked.push(i);
    });
    if (!picked.length) return "";
    return '<section class="fw-article__related" data-fw-surface="pinkTint" data-fw-accent="pink" aria-labelledby="fw-related-title">' +
      '<div class="fw-container">' +
        '<div class="fw-sechead"><div class="fw-page-intro">' + eyebrow("Related insights") + '<h2 class="fw-h1" id="fw-related-title">Keep reading.</h2></div>' +
          '<a class="fw-link" href="' + LEARN_INSIGHTS + '">All insights <span class="fw-link__arrow" aria-hidden="true">→</span></a></div>' +
        '<ul class="fw-article__cards" role="list">' + picked.slice(0, 3).map(function (i) {
          return contentCard(i, { date: true, sizes: "(min-width: 768px) 30vw, 100vw" });
        }).join("") + "</ul>" +
      "</div></section>";
  }

  // Back: to the page the visitor came from on this site, else to Learn's insights
  function backLink() {
    return '<a class="fw-article__back fw-label" href="' + LEARN_INSIGHTS + '" data-fw-back><span aria-hidden="true">←</span> All insights</a>';
  }

  // inReader: the reader bar already has Share and Close, so the page's own top bar is left out
  function articleHTML(ins, list, extra, inReader) {
    var img = imageOf(ins), url = location.href;
    var end = inReader ? '<button class="fw-article__back fw-article__close fw-label" type="button" data-fw-reader-close><span aria-hidden="true">←</span> Close insight</button>' : backLink();
    return '<article class="fw-article" data-fw-surface="white" data-fw-accent="pink">' +
      '<header class="fw-container fw-article__head">' +
        (inReader ? "" : '<div class="fw-article__topbar">' + backLink() +
          '<button class="fw-article__share fw-label" type="button" data-fw-share>Share</button></div>') +
        '<div data-fw-reveal="fade">' + eyebrow("Insight · " + ins.category) + "</div>" +
        '<h1 class="fw-display-l fw-article__title" id="fw-article-title" data-fw-reveal="fade" style="--fw-delay:80ms">' + esc(ins.title) + "</h1>" +
        '<p class="fw-label fw-meta fw-article__meta" data-fw-reveal="fade" style="--fw-delay:160ms"><span>By ' + esc(ins.author || "Faith Works") + "</span>" +
          SEP + '<time datetime="' + esc(ins.date) + '">' + dateText(ins.date) + "</time>" + SEP + "<span>" + esc(ins.readTime) + "</span></p>" +
      "</header>" +
      (img ? '<figure class="fw-container fw-article__figure"><div class="fw-media fw-article__cover" data-fw-reveal="clip">' +
        picture(img, "(min-width: 1632px) 1440px, 90vw", true) + "</div></figure>" : "") +
      '<div class="fw-container fw-grid fw-article__layout"><div class="fw-article__body">' +
        '<p class="fw-article__dek">' + esc(ins.excerpt) + "</p>" + blocksHTML(ins.content) +
        '<p class="fw-article__end fw-label">' + end + '<span class="fw-visually-hidden">Link to this article: ' + esc(url) + "</span></p>" +
      "</div></div>" + practiceHTML(ins, extra) +
    "</article>" + relatedHTML(ins, list);
  }

  function emptyHTML() {
    return '<section class="fw-page-hero fw-article--empty" data-fw-surface="white" data-fw-accent="pink"><div class="fw-container fw-page-intro">' +
      eyebrow("Insight not found") +
      '<h1 class="fw-display-l fw-article__title" id="fw-article-title">We couldn’t find that insight.</h1>' +
      '<p class="fw-body-l">The link may be incomplete, or the insight may have moved.</p>' +
      '<div class="fw-btn-row"><a class="fw-btn fw-btn--dark fw-btn--lg" href="' + LEARN_INSIGHTS + '">Browse all insights</a></div>' +
    "</div></section>";
  }

  function renderArticle(el, d) {
    var q = new URLSearchParams(location.search), slug = q.get("slug") || q.get("insight") || "";
    var list = d.insights.insights, ins = findInsight(list, slug);
    if (!ins) { el.innerHTML = emptyHTML(); doc.title = "Insight not found · Faith Works"; return; }
    doc.title = ins.title + " · Faith Works";
    var desc = doc.querySelector('meta[name="description"]');
    if (desc) desc.content = ins.excerpt;
    // Resources and events are optional extras: the article still renders if they fail
    return Promise.all([getData("resources"), getData("events")]).then(function (r) { return { resources: r[0], events: r[1] }; }, function () { return null; })
      .then(function (extra) { el.innerHTML = articleHTML(ins, list, extra); });
  }

  // Back goes to the previous page when it was on this site; Share copies the link
  doc.addEventListener("click", function (e) {
    var back = e.target.closest("[data-fw-back]");
    if (back && doc.referrer && new URL(doc.referrer).origin === location.origin && history.length > 1 && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      history.back();
      return;
    }
    var share = e.target.closest("[data-fw-share]");
    if (!share) return;
    var done = function (text) {
      share.textContent = text;
      setTimeout(function () { share.textContent = "Share"; }, 2400);
    };
    if (navigator.share && window.matchMedia("(hover: none)").matches) {
      navigator.share({ title: doc.title, url: location.href }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(location.href).then(function () { done("Link copied"); }, function () { done("Copy the address bar link"); });
    }
  });

  /* ---- 12b. INSIGHT READER ---------------------------------------------------- */
  // Clicking any Insight link (…?insight=<slug>) opens the Insight as a full-screen
  // reader that slides up from the bottom, over the current page, and adds
  // ?insight=<slug> to the address bar (a shareable permalink). Opening such a URL
  // directly opens the reader on load. The X button and Escape close it and remove
  // the parameter again, without a reload. The page underneath can't scroll or be
  // focused while the reader is open.
  var reader = null, sheet = null, readerContent = null, readerOpen = false;
  var readerDepth = 0, readerReturn = null, readerTimer = 0, readerToken = 0;
  var pageTitle = doc.title;
  var pageDescription = doc.querySelector('meta[name="description"]');
  var pageDescriptionText = pageDescription ? pageDescription.content : "";

  function insightParam(url) { return new URL(url, location.href).searchParams.get("insight"); }
  function urlWithInsight(slug) {
    var u = new URL(location.href);
    if (slug) u.searchParams.set("insight", slug); else u.searchParams.delete("insight");
    return u.pathname + u.search + u.hash;
  }

  function buildReader() {
    if (reader) return;
    reader = doc.createElement("div");
    reader.className = "fw-reader";
    reader.hidden = true;
    reader.innerHTML =
      '<div class="fw-reader__backdrop" aria-hidden="true"></div>' +
      '<div class="fw-reader__sheet" role="dialog" aria-modal="true" aria-labelledby="fw-article-title" tabindex="-1" data-fw-surface="white" data-fw-accent="pink">' +
        '<div class="fw-reader__bar">' +
          '<div class="fw-container fw-reader__bar-inner">' +
            '<a class="fw-reader__brand" href="index.html" aria-label="Faith Works, home"><span class="fw-wordmark"><img src="' + esc(asset("assets/icons/wordmark.svg")) + '" alt="" width="1906" height="385"></span></a>' +
            '<p class="fw-label fw-reader__crumb"><a href="' + LEARN_INSIGHTS + '">Learn</a> <span aria-hidden="true">/</span> Insights</p>' +
            '<div class="fw-reader__tools">' +
              '<button class="fw-reader__share fw-label" type="button" data-fw-share>Share</button>' +
              '<button class="fw-reader__close" type="button" data-fw-reader-close aria-label="Close insight">' +
                '<span class="fw-reader__close-text fw-label" aria-hidden="true">Close</span>' +
                '<span class="fw-reader__close-x" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M7 7l10 10M17 7 7 17"/></svg></span>' +
              "</button>" +
            "</div>" +
          "</div>" +
          '<span class="fw-reader__progress" aria-hidden="true"></span>' +
        "</div>" +
        '<div class="fw-reader__content"></div>' +
      "</div>";
    doc.body.appendChild(reader);
    sheet = reader.querySelector(".fw-reader__sheet");
    readerContent = reader.querySelector(".fw-reader__content");

    // Reading progress along the bottom of the bar
    var progress = reader.querySelector(".fw-reader__progress"), busy = false;
    sheet.addEventListener("scroll", function () {
      if (busy) return;
      busy = true;
      requestAnimationFrame(function () {
        busy = false;
        var max = sheet.scrollHeight - sheet.clientHeight;
        progress.style.transform = "scaleX(" + (max > 0 ? Math.min(1, sheet.scrollTop / max) : 0) + ")";
      });
    }, { passive: true });

    reader.addEventListener("click", function (e) {
      if (e.target.closest("[data-fw-reader-close]")) { e.preventDefault(); closeInsight(); }
    });
    // Keep keyboard focus inside the reader
    reader.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var items = [].slice.call(sheet.querySelectorAll("a[href], button")).filter(function (el) { return el.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (doc.activeElement === first || doc.activeElement === sheet)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function setBackgroundInert(on) {
    doc.querySelectorAll("body > header, body > main, body > footer, body > .fw-skip").forEach(function (el) {
      if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert");
    });
  }

  function showInsight(slug, trigger, instant) {
    buildReader();
    var token = ++readerToken;
    if (!readerOpen) {
      readerOpen = true;
      readerReturn = trigger || doc.activeElement;
      clearTimeout(readerTimer);
      reader.hidden = false;
      reader.classList.toggle("is-instant", !!instant);
      root.classList.add("fw-reader-open");
      setBackgroundInert(true);
      // Next frame, so the sheet starts below the viewport and slides up
      requestAnimationFrame(function () { requestAnimationFrame(function () { reader.classList.add("is-open"); }); });
      sheet.focus({ preventScroll: true });
    }
    var extras = Promise.all([getData("resources"), getData("events")])
      .then(function (r) { return { resources: r[0], events: r[1] }; }, function () { return null; });
    Promise.all([getData("insights"), extras]).then(function (res) {
      if (token !== readerToken) return;
      var list = res[0].insights, ins = findInsight(list, slug);
      readerContent.innerHTML = ins ? articleHTML(ins, list, res[1], true) : emptyHTML();
      doc.title = (ins ? ins.title : "Insight not found") + " · Faith Works";
      if (pageDescription && ins) pageDescription.content = ins.excerpt;
      sheet.scrollTop = 0;
      readerContent.querySelectorAll("[data-fw-reveal]").forEach(reveal);
    }).catch(function () {
      if (token !== readerToken) return;
      readerContent.innerHTML = '<p class="fw-container fw-render-error">This insight couldn’t load. Please refresh the page to try again.</p>';
    });
  }

  function hideReader() {
    if (!readerOpen) return;
    readerOpen = false;
    readerDepth = 0;
    reader.classList.remove("is-open");
    root.classList.remove("fw-reader-open");
    setBackgroundInert(false);
    doc.title = pageTitle;
    if (pageDescription) pageDescription.content = pageDescriptionText;
    if (readerReturn && doc.contains(readerReturn) && readerReturn.focus) readerReturn.focus({ preventScroll: true });
    readerTimer = setTimeout(function () { reader.hidden = true; readerContent.innerHTML = ""; }, reduceMotion ? 0 : 750);
  }

  function openInsight(slug, trigger) {
    readerDepth++;
    history.pushState({ fwInsight: slug, fwDepth: readerDepth }, "", urlWithInsight(slug));
    showInsight(slug, trigger);
  }

  // Close: step back through the insights opened here (popstate hides the reader),
  // or, for a reader opened straight from a shared link, just drop ?insight=
  function closeInsight() {
    if (readerDepth > 0) { history.go(-readerDepth); return; }
    history.replaceState(null, "", urlWithInsight(null));
    hideReader();
  }

  // insight.html (the standalone article page) keeps its own layout
  if ("pushState" in history && !doc.querySelector('[data-fw-render="article"]')) {
    doc.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.origin !== location.origin) return;
      var slug = insightParam(a.href);
      if (!slug) return;
      e.preventDefault();
      if (readerOpen && insightParam(location.href) === slug) return;
      openInsight(slug, readerOpen ? readerReturn : a);
    });

    window.addEventListener("popstate", function (e) {
      var slug = (e.state && e.state.fwInsight) || insightParam(location.href);
      if (slug) { readerDepth = (e.state && e.state.fwDepth) || 0; showInsight(slug); }
      else if (readerOpen) hideReader();
    });

    doc.addEventListener("keydown", function (e) {
      if (readerOpen && e.key === "Escape") closeInsight();
    });

    // A shared link: open that insight straight away
    var firstSlug = insightParam(location.href);
    if (firstSlug) {
      history.replaceState({ fwInsight: firstSlug, fwDepth: 0 }, "");
      showInsight(firstSlug, null, true);
    }
  }

  /* ---- 13. DEMO FORMS ------------------------------------------------------- */
  doc.querySelectorAll("form[data-fw-demo]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector("[data-fw-form-status]");
      if (status) status.textContent = "Thanks. This form isn't connected yet; it will send once it's set up in GoHighLevel.";
    });
  });

  // "Get notified" links send people to the footer sign-up and say what to do there
  doc.addEventListener("click", function (e) {
    var link = e.target.closest("[data-fw-to-footer]");
    var form = link && doc.querySelector(".fw-footer__join");
    if (!form) return;
    e.preventDefault();
    form.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    var status = form.querySelector("[data-fw-form-status]");
    if (status) status.textContent = "Add your name and email here and we’ll let you know when new ones are out.";
    var first = form.querySelector("input");
    if (first) first.focus({ preventScroll: true });
  });
})();
