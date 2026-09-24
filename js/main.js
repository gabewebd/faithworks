/* ==========================================================================
   FAITH WORKS · main.js
   All of the site's JavaScript in one file. Plain browser JS, no build step,
   no dependencies. Load with:  <script src="js/main.js" defer></script>

   This file is progressive enhancement only. Without it the page still shows
   all content: nothing is hidden, desktop nav panels open on hover/focus (CSS)
   and "Menu" links to the footer navigation.

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
    10. PRE-SELECT        links pick the right option in a form (same page or ?param=)
    11. OPEN ON LINK      a link to an article's #id opens its "Read" panel
    12. DEMO FORMS        until GHL forms are connected, forms say so instead of reloading
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
  function setDrawLengths(svg) {
    var paths = svg.querySelectorAll("path");
    for (var i = 0; i < paths.length; i++) {
      paths[i].style.setProperty("--fw-len", Math.ceil(paths[i].getTotalLength()));
      if (!paths[i].style.getPropertyValue("--i")) paths[i].style.setProperty("--i", i);
    }
  }

  var observer = null;
  function reveal(el) {
    if (el.hasAttribute("data-fw-draw")) setDrawLengths(el);
    if (!("IntersectionObserver" in window) || reduceMotion) { el.classList.add("is-in"); return; }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
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
    var activate = function (stage) {
      journey.style.setProperty("--fw-journey-bg", getComputedStyle(stage).getPropertyValue("--fw-surface").trim());
      journey.setAttribute("data-fw-active-surface", stage.getAttribute("data-fw-surface"));
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
  doc.querySelectorAll("[data-fw-tabs]").forEach(function (box) {
    var tabs = [].slice.call(box.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
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
  });

  /* ---- 10. PRE-SELECT ------------------------------------------------------- */
  // Same page:  <a href="#access" data-fw-select="fw-access-resource:opportunity-map">
  // Other page: <a href="community.html?event=ai-for-business#register">  +  <select data-fw-param="event">
  var preselect = function (id, value) {
    var el = doc.getElementById(id);
    if (el && [].some.call(el.options, function (o) { return o.value === value; })) el.value = value;
  };
  doc.addEventListener("click", function (e) {
    var a = e.target.closest("[data-fw-select]");
    if (!a) return;
    var parts = a.getAttribute("data-fw-select").split(":");
    preselect(parts[0], parts[1]);
  });
  var params = new URLSearchParams(location.search);
  doc.querySelectorAll("select[data-fw-param]").forEach(function (sel) {
    var v = params.get(sel.getAttribute("data-fw-param"));
    if (v) preselect(sel.id, v);
  });

  /* ---- 11. OPEN ON LINK ----------------------------------------------------- */
  var openFromHash = function () {
    if (!location.hash) return;
    var target = doc.getElementById(location.hash.slice(1));
    var read = target && target.querySelector("details.fw-read");
    if (read) read.open = true;
  };
  window.addEventListener("hashchange", openFromHash);
  openFromHash();

  /* ---- 12. DEMO FORMS ------------------------------------------------------- */
  doc.querySelectorAll("form[data-fw-demo]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector("[data-fw-form-status]");
      if (status) status.textContent = "Thanks. This form isn't connected yet; it will send once it's set up in GoHighLevel.";
    });
  });
})();
