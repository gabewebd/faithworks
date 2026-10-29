/* ==========================================================================
   Faith Works — scroll motion (every page)
   1. Setup  4. Depth (parallax)  5. Section reveals  5b. Checklist rows  5c. Gallery rows  5i. Inked motto  6. Keeping measurements fresh
   The page scrolls natively (same-page #links glide with CSS scroll-behavior, stopping below the
   sticky header via scroll-padding-top); ScrollTrigger follows the native scroll. The CSS
   reveals (style.css §18, [data-reveal]) stay as they are: this file only reveals sections they
   do not cover, and gives a few chosen elements depth (style.css §18b decides how far each one
   moves). Reduced motion, or a library that did not load: nothing
   here runs, the page scrolls natively and every element stays where the stylesheet put it.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. Setup ----------------------------------------------------------- */
  var doc = document;
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !gsap || !ScrollTrigger) return;

  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  gsap.registerPlugin(ScrollTrigger);

  /* ---- 4. Depth (parallax) ------------------------------------------------ */
  // Each element below gets one number, --fw-p, as it crosses the viewport: -1 entering at the
  // bottom, 1 leaving at the top. Elements already on screen when the page opens run 0 → 1 from
  // the top of the page, so nothing shifts as the script starts; the home hero runs 0 → 1 while
  // it scrolls away. style.css §18b turns --fw-p into a few pixels of movement (halved on small
  // screens), on the independent translate/scale properties. Add [data-depth] (optionally with
  // style="--depth: 30") to give another decorative element the same treatment.
  var DEPTH = ".hero, .ahero__photo, .phero__photo, .founder__photo, .business__photo, .talks__photo, .kitart, .cta, [data-depth]";
  $$(DEPTH).forEach(function (el) {
    var hero = el.classList.contains("hero");
    var atLoad = el.getBoundingClientRect().top + window.scrollY < window.innerHeight;
    gsap.fromTo(el, { "--fw-p": hero || atLoad ? 0 : -1 }, {
      "--fw-p": 1, ease: "none",
      scrollTrigger: { trigger: el, start: hero ? "top top" : atLoad ? "clamp(top bottom)" : "top bottom", end: "bottom top", scrub: true }
    });
  });

  /* ---- 5. Section reveals ------------------------------------------------- */
  // Sections the CSS reveals don't cover (most inner pages, programs, articles) fade up as they
  // arrive: each block of a section once, cards in a list a beat apart, and photos settle from a
  // slight zoom. Only what starts below the fold is hidden, so nothing visible ever blinks out;
  // anything with its own entrance animation, and the page's first (hero) section, are left
  // alone. Each block is put back exactly as the stylesheet has it once it has arrived, and
  // focusing into a block, or printing, shows it at once.
  var main = doc.getElementById("main-content");
  var WIDGET = "[data-carousel], [data-logo-marquee], [data-pager], [data-fw-calendar]";
  var shown = function (el) { return el.getClientRects().length > 0; };
  var blocksOf = function (section) {
    var box = section.classList.contains("wrap") ? section : section.querySelector(":scope > .wrap") || section;
    var kids = Array.prototype.filter.call(box.children, shown);
    if (kids.length === 1 && kids[0].children.length > 1 && !kids[0].matches(WIDGET + ", form, ul, ol, figure")) {
      kids = Array.prototype.filter.call(kids[0].children, shown);
    }
    var out = [];
    kids.forEach(function (k) {
      var list = k.matches("ul, ol") && !k.matches(WIDGET) && k.children.length > 1 && k.children.length <= 12;
      out.push.apply(out, list ? Array.prototype.filter.call(k.children, shown) : [k]);
    });
    return out;
  };
  var blocks = [];
  if (main) {
    // Page sections, including those of CMS page documents (.cms-page); the first is the hero
    $$(":scope > section, :scope > article > section, :scope > .cms-page > section", main).forEach(function (section) {
      var before = section.previousElementSibling;
      while (before && before.matches("style, script, template")) before = before.previousElementSibling;
      if (!before || section.matches("[data-reveal]") || section.querySelector("[data-reveal]")) return;
      blocks.push.apply(blocks, blocksOf(section));
    });
    blocks.push.apply(blocks, $$(".article__fig", main));
  }
  blocks = blocks.filter(function (el) {
    return el.getBoundingClientRect().top > window.innerHeight && getComputedStyle(el).animationName === "none" && !el.matches(".goals__item, [data-approach] .journey-list--rail > li");
  });

  var pending = blocks.slice();
  var photos = function (els) {
    var out = [];
    els.forEach(function (el) {
      $$("figure img, picture img", el).forEach(function (img) { if (!img.closest(WIDGET)) out.push(img); });
      if (el.matches("figure")) $$("img", el).forEach(function (img) { if (out.indexOf(img) < 0) out.push(img); });
    });
    return out;
  };
  var reveal = function (els, now) {
    els = els.filter(function (el) { return pending.indexOf(el) > -1; });
    if (!els.length) return;
    pending = pending.filter(function (el) { return els.indexOf(el) < 0; });
    var done = { opacity: 1, y: 0, overwrite: true, clearProps: "opacity,transform,transition" };
    if (now) { gsap.set(els, done); gsap.set(photos(els), { scale: 1, clearProps: "transform" }); return; }
    gsap.to(els, Object.assign({ duration: 0.9, ease: "power3.out", stagger: 0.08 }, done));
    gsap.to(photos(els), { scale: 1, duration: 1.4, ease: "expo.out", overwrite: true, clearProps: "transform" });
  };
  if (blocks.length) {
    // transition: none while hidden, so a block's own hover transition can't drag the tween
    gsap.set(blocks, { opacity: 0, y: window.innerWidth < 760 ? 18 : 28, transition: "none" });
    gsap.set(photos(blocks), { scale: 1.05 });
    ScrollTrigger.batch(blocks, {
      start: "top 90%", once: true,
      onEnter: function (els) { reveal(els); },
      onLeave: function (els) { reveal(els, true); } // jumped past (a #link, a restored position)
    });
    doc.addEventListener("focusin", function (e) {
      var el = pending.filter(function (b) { return b.contains(e.target); });
      if (el.length) reveal(el, true);
    });
    window.addEventListener("beforeprint", function () { reveal(pending.slice(), true); });
  }

  /* ---- 5b. Checklist rows (business: what teams come to us for; professionals: who it's for) */
  // While the heading holds on the left (style.css .goals__head), each row arriving on the right
  // draws its pink rule, pops its check circle, strokes the tick and brings its line up to full
  // strength; scrolling back above a row winds it back. Rows already on screen at load stay drawn.
  var goalTls = [];
  $$("[data-goals] .goals__item").forEach(function (item) {
    if (item.getBoundingClientRect().top < window.innerHeight) return;
    var tl = gsap.timeline({ paused: true })
      .fromTo(item, { "--goal-rule": 0 }, { "--goal-rule": 1, duration: 0.9, ease: "power3.inOut" }, 0)
      .fromTo(item.querySelector(".goals__check"), { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(1.8)" }, 0.1)
      .fromTo(item.querySelector(".goals__check path"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5, ease: "power2.out" }, 0.35)
      .fromTo(item.querySelector(".goals__body") || item.querySelector(".goals__text"), { opacity: 0.2, y: 14 }, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, 0.1);
    goalTls.push(tl);
    ScrollTrigger.create({
      trigger: item, start: "top 80%",
      onEnter: function () { tl.play(); },
      onLeaveBack: function () { tl.reverse(); }
    });
  });
  if (goalTls.length) window.addEventListener("beforeprint", function () { goalTls.forEach(function (tl) { tl.progress(1); }); });


  /* ---- 5c. Gallery rows (homepage events) --------------------------------- */
  // The three photo rows (tools/event-gallery.mjs scrollRows) drift endlessly left, right, left.
  // Each row's tiles are copied (hidden from assistive tech) until the row is wide enough to
  // wrap without a gap, then the row's offset runs modulo one set's width. Scrolling the page
  // adds speed in proportion to how fast it scrolls, eased in and out so the rows surge and
  // settle instead of jumping. Rows only move while the gallery is on screen.
  var SPEEDS = [22, 18, 20];       // px per second at rest, per row
  var BOOST = 0.003, MAX_BOOST = 3; // scroll velocity (px/s) → speed multiplier, and its cap
  $$("[data-srows]").forEach(function (box) {
    var rows = $$("[data-srow]", box).map(function (row, i) {
      var tiles = Array.prototype.slice.call(row.children);
      if (!tiles.length) return null;
      return { el: row, tiles: tiles, dir: row.getAttribute("data-srow") === "right" ? 1 : -1, speed: SPEEDS[i % SPEEDS.length], pos: 0, loop: 0, set: gsap.quickSetter(row, "x", "px") };
    }).filter(Boolean);
    if (!rows.length) return;
    box.classList.add("is-scrubbed");

    var clone = function (tile) {
      var c = tile.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      $$("img", c).forEach(function (img) { img.alt = ""; });
      $$("a, button, [tabindex]", c).forEach(function (el) { el.setAttribute("tabindex", "-1"); });
      return c;
    };
    var measure = function () {
      rows.forEach(function (r) {
        r.el.scrollLeft = 0;
        // one set = distance from the first tile to its first copy
        if (r.el.children.length === r.tiles.length) r.tiles.forEach(function (t) { r.el.appendChild(clone(t)); });
        r.loop = r.el.children[r.tiles.length].offsetLeft - r.tiles[0].offsetLeft;
        while (r.loop > 0 && r.el.scrollWidth - r.loop < box.clientWidth + r.loop) {
          r.tiles.forEach(function (t) { r.el.appendChild(clone(t)); });
        }
        r.pos = r.loop ? r.pos % r.loop : 0;
      });
    };
    measure();
    window.addEventListener("resize", function () { clearTimeout(box._fwT); box._fwT = setTimeout(measure, 150); });

    var visible = false, boost = 0;
    ScrollTrigger.create({
      trigger: box, start: "top bottom", end: "bottom top",
      onToggle: function (self) { visible = self.isActive; },
      onUpdate: function (self) { boost = Math.max(boost, Math.min(Math.abs(self.getVelocity()) * BOOST, MAX_BOOST)); }
    });
    var mult = 1;
    gsap.ticker.add(function (time, delta) {
      var dt = Math.min(delta, 64) / 1000;
      boost *= Math.pow(0.04, dt);               // the surge fades over about a second
      mult += (1 + boost - mult) * Math.min(1, dt * 6); // ease toward it so speed never jumps
      if (!visible) return;
      rows.forEach(function (r) {
        if (!r.loop) return;
        r.pos = (r.pos + r.speed * mult * dt) % r.loop;
        r.set(r.dir < 0 ? -r.pos : r.pos - r.loop);
      });
    });
  });


  // An illustration arriving (5d, 5e): its blocks a beat apart, then its small parts after them
  var kids = function (el) { return el ? Array.prototype.slice.call(el.children) : []; };
  var settle = function (blocks, parts, delay, dir) {
    gsap.fromTo(blocks, { autoAlpha: 0, y: 18 * dir }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.08, delay: delay, overwrite: true });
    gsap.fromTo(parts, { autoAlpha: 0, y: 8 * dir }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.035, delay: delay + 0.25, overwrite: true });
  };

  /* ---- 5d. Use-case story (build; also the program pages and the starter kit) */
  // Wide, tall screens: .is-live turns the section into a scroll story (css/build.css §2). The
  // case crossing the middle of the screen is the active one; its output glides into the frame
  // (the old one leaves the way the page is moving) and the output's parts settle in a beat
  // apart. The rail fills with the scroll. Elsewhere each output arrives once, as it scrolls in.
  var story = doc.querySelector("[data-story]");
  if (story) {
    var steps = $$("[data-story-step]", story), arts = $$("[data-story-art]", story);
    // The small pieces of each output (not its top-level blocks, which arrive first)
    var PARTS = ".bw-cal__grid .is-post, .bw-inbox__row, .bw-inbox__summary, .bw-checks > span, .bw-inbox__send, .bw-ask__docs span, .bw-ask__refs > span, .bw-site__hero > *, .bw-site__shape, .bw-site__checks span, .bw-path__chips > span, .bw-path__mini, .bw-path__row > .bw-mark, .proto__page > span, .proto__row, .preview__table tbody tr, .preview__plan li, .preview__msg, .bw-kitpage .bw-path__row, .bw-kitpage__table tbody tr, .bw-kitscene__side > *, .bw-kitflow__step, .bw-kitfaces > *, .bw-kitpage__field, .bw-kitpage__prompt > span, .bw-kitpage__next li";
    var settleArt = function (art, delay, dir) { settle(kids(art.firstElementChild), $$(PARTS, art), delay, dir); };
    var mm = gsap.matchMedia();

    mm.add("(min-width: 961px) and (min-height: 680px)", function () {
      story.classList.add("is-live");
      // The frame keeps one height (css/build.css), at least the tallest output's, which also
      // paces the cases and places it on screen; the outputs sit centred in it.
      var current = -1;
      var measureFrame = function () {
        var tallest = Math.max.apply(null, arts.map(function (a) { return a.offsetHeight; }));
        story.style.setProperty("--fit-h", tallest + "px");
      };
      measureFrame();
      var frameObs = "ResizeObserver" in window ? new ResizeObserver(function () { measureFrame(); refresh(); }) : null;
      if (frameObs) arts.forEach(function (a) { frameObs.observe(a); });
      var show = function (i, dir, instant) {
        if (i === current) return;
        var prev = arts[current];
        current = i;
        steps.forEach(function (s, n) { s.classList.toggle("is-active", n === i); });
        story.setAttribute("data-active", i); // the frame's gradient, one per case (css/build.css)
        var art = arts[i];
        // Every other output still showing leaves (more than one when a scroll skips a case)
        arts.forEach(function (a) {
          if (a === art || (gsap.getProperty(a, "autoAlpha") === 0 && !gsap.getTweensOf(a).length)) return;
          a.classList.remove("is-active");
          gsap.to(a, { autoAlpha: 0, y: -20 * dir, scale: 0.985, duration: 0.4, ease: "power2.in", overwrite: true });
        });
        art.classList.add("is-active");
        if (instant) { gsap.set(art, { autoAlpha: 1, y: 0, scale: 1 }); return; }
        gsap.fromTo(art, { autoAlpha: 0, y: 28 * dir, scale: 0.985 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.85, ease: "expo.out", delay: prev ? 0.2 : 0, overwrite: true });
        settleArt(art, prev ? 0.25 : 0.05, dir);
      };

      var triggers = steps.map(function (step, i) {
        return ScrollTrigger.create({
          trigger: step, start: "top 55%", end: "bottom 55%",
          onEnter: function () { show(i, 1); },
          onEnterBack: function () { show(i, -1); }
        });
      });
      gsap.fromTo("[data-story-rail]", { scaleY: 0 }, {
        scaleY: 1, ease: "none",
        scrollTrigger: { trigger: story, start: "top 55%", end: "bottom 55%", scrub: 0.4 }
      });
      // The frame arrives once with the section; whichever case is in view (or the first) shows
      var first = 0;
      triggers.forEach(function (t, n) { if (t.scroll() >= t.start) first = n; });
      show(first, 1, true);
      gsap.from("[data-story-frame]", {
        autoAlpha: 0, y: 40, duration: 1, ease: "expo.out",
        scrollTrigger: { trigger: story, start: "top 85%", once: true, onEnter: function () { settleArt(arts[current], 0.15, 1); } }
      });

      return function () {
        if (frameObs) frameObs.disconnect();
        story.style.removeProperty("--fit-h");
        story.removeAttribute("data-active");
        story.classList.remove("is-live");
        steps.concat(arts).forEach(function (el) { el.classList.remove("is-active"); });
      };
    });

    mm.add("(max-width: 960px), (max-height: 679px)", function () {
      arts.forEach(function (art) {
        if (art.getBoundingClientRect().top < window.innerHeight) return; // already on screen: leave it be
        gsap.set(kids(art.firstElementChild).concat($$(PARTS, art)), { autoAlpha: 0 });
        ScrollTrigger.create({ trigger: art, start: "top 85%", once: true, onEnter: function () { art.classList.add("is-active"); settleArt(art, 0, 1); } });
      });
      return function () { arts.forEach(function (art) { art.classList.remove("is-active"); }); };
    });
  }


  /* ---- 5e. Faith AI system card (build) ----------------------------------- */
  // The card rises in as it scrolls into view, then the way the use-case outputs do: the hub,
  // the three panels and the approval a beat apart, then each panel's rows, draft and chips.
  // .is-active lets css/build.css tick the approval in last. Only a card below the fold waits.
  var sys = doc.querySelector(".bw-sys");
  if (sys && sys.getBoundingClientRect().top > window.innerHeight) {
    var sysParts = $$(".bw-panel__row, .bw-panel__msg, .bw-panel__foot, .bw-panel__search, .bw-panel__hit", sys);
    gsap.set(sys, { autoAlpha: 0, y: window.innerWidth < 760 ? 18 : 28 });
    gsap.set(kids(sys).concat(sysParts), { autoAlpha: 0 });
    ScrollTrigger.create({
      trigger: sys, start: "top 85%", once: true,
      onEnter: function () {
        gsap.to(sys, { autoAlpha: 1, y: 0, duration: 0.9, ease: "expo.out", clearProps: "transform" });
        settle(kids(sys), sysParts, 0.15, 1);
        sys.classList.add("is-active");
      }
    });
  }


  /* ---- 5g. Your AI journey (professionals) -------------------------------- */
  // The Build with AI story (5d) with circular visuals. Wide, tall screens: .is-live turns the
  // section into a scroll story (css/professionals.css §4). The step crossing the middle of the
  // screen is the active one; its visual turns into the orb (the old one turns away the way the
  // page is moving), then its parts pop in and its rings draw. The rail fills and the orb's dial
  // turns with the scroll. Elsewhere each visual arrives once, as it scrolls in; nothing is pinned.
  var journey = doc.querySelector("[data-journey]");
  if (journey) {
    var jsteps = $$("[data-journey-step]", journey), jarts = $$("[data-journey-art]", journey);
    var jsegs = $$(".pp-orb__seg", journey);
    var JPARTS = ".pp-disc, .pp-chip, .pp-art__field > .pp-face, .pp-hub__doc, .pp-hub__core";
    // Each visual's parts pop in a beat apart while its arcs, weeks and traces draw round
    var settleJourney = function (art, delay) {
      gsap.fromTo($$(JPARTS, art), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: "back.out(1.6)", stagger: 0.05, delay: delay, overwrite: true });
      $$(".pp-arc, .pp-week", art).forEach(function (el, n) {
        var dash = getComputedStyle(el).getPropertyValue("--dash").trim(), len = dash.split(/\s+/);
        gsap.fromTo(el, { strokeDasharray: "0 " + (parseFloat(len[0]) + parseFloat(len[1])) }, { strokeDasharray: dash, duration: 0.9, ease: "power2.inOut", delay: delay + 0.15 + n * 0.09, overwrite: true });
      });
      gsap.fromTo($$(".pp-hub__trace", art), { strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut", stagger: 0.05, delay: delay + 0.1, overwrite: true });
      gsap.fromTo($$(".pp-live__bar b", art), { scaleX: 0 }, { scaleX: 1, duration: 1.2, ease: "power2.inOut", delay: delay + 0.5, overwrite: true });
    };
    var jmm = gsap.matchMedia();

    jmm.add("(min-width: 961px) and (min-height: 680px)", function () {
      journey.classList.add("is-live");
      var current = -1;
      var show = function (i, dir, instant) {
        if (i === current) return;
        var prev = jarts[current];
        current = i;
        jsteps.forEach(function (s, n) { s.classList.toggle("is-active", n === i); });
        jsegs.forEach(function (s, n) { s.classList.toggle("is-on", n <= i); s.classList.toggle("is-current", n === i); });
        journey.setAttribute("data-active", i); // the stage's gradient, one per step (css/professionals.css)
        var art = jarts[i];
        // Every other visual still showing turns away (more than one when a scroll skips a step)
        jarts.forEach(function (a) {
          if (a === art || (gsap.getProperty(a, "autoAlpha") === 0 && !gsap.getTweensOf(a).length)) return;
          a.classList.remove("is-active");
          gsap.to(a, { autoAlpha: 0, scale: 0.88, rotation: -16 * dir, duration: 0.45, ease: "power2.in", overwrite: true });
        });
        art.classList.add("is-active");
        if (instant) { gsap.set(art, { autoAlpha: 1, scale: 1, rotation: 0 }); return; }
        gsap.fromTo(art, { autoAlpha: 0, scale: 0.88, rotation: 16 * dir }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.95, ease: "expo.out", delay: prev ? 0.2 : 0, overwrite: true });
        settleJourney(art, prev ? 0.3 : 0.05);
      };

      var triggers = jsteps.map(function (step, i) {
        return ScrollTrigger.create({
          trigger: step, start: "top 55%", end: "bottom 55%",
          onEnter: function () { show(i, 1); },
          onEnterBack: function () { show(i, -1); }
        });
      });
      // The rail fills with the scroll, as on Build with AI (5d)
      gsap.fromTo("[data-journey-rail]", { scaleY: 0 }, {
        scaleY: 1, ease: "none",
        scrollTrigger: { trigger: journey, start: "top 55%", end: "bottom 55%", scrub: 0.4 }
      });
      gsap.fromTo("[data-journey-ticks]", { rotation: 0 }, {
        rotation: 120, svgOrigin: "200 200", ease: "none",
        scrollTrigger: { trigger: journey, start: "top bottom", end: "bottom top", scrub: 0.6 }
      });
      // The orb arrives once with the section; whichever step is in view (or the first) shows
      var first = 0;
      triggers.forEach(function (t, n) { if (t.scroll() >= t.start) first = n; });
      show(first, 1, true);
      gsap.from("[data-journey-frame]", {
        autoAlpha: 0, scale: 0.9, duration: 1.1, ease: "expo.out",
        scrollTrigger: { trigger: journey, start: "top 85%", once: true, onEnter: function () { settleJourney(jarts[current], 0.2); } }
      });
      // Tabbing to a step's link shows that step's visual
      var onFocus = function (e) {
        var n = jsteps.indexOf(e.target.closest("[data-journey-step]"));
        if (n > -1) show(n, n < current ? -1 : 1);
      };
      journey.addEventListener("focusin", onFocus);

      return function () {
        journey.removeEventListener("focusin", onFocus);
        journey.classList.remove("is-live");
        journey.removeAttribute("data-active");
        gsap.set(jarts, { clearProps: "all" });
        jsteps.concat(jarts, jsegs).forEach(function (el) { el.classList.remove("is-active", "is-on", "is-current"); });
      };
    });

    jmm.add("(max-width: 960px), (max-height: 679px)", function () {
      jarts.forEach(function (art) {
        if (art.getBoundingClientRect().top < window.innerHeight) { art.classList.add("is-active"); return; } // already on screen: leave it be
        gsap.set(art, { autoAlpha: 0, scale: 0.92, rotation: 10 });
        gsap.set($$(JPARTS, art), { autoAlpha: 0 });
        ScrollTrigger.create({
          trigger: art, start: "top 85%", once: true,
          onEnter: function () {
            art.classList.add("is-active");
            gsap.to(art, { autoAlpha: 1, scale: 1, rotation: 0, duration: 1, ease: "expo.out", clearProps: "transform" });
            settleJourney(art, 0.15);
          }
        });
      });
      return function () { jarts.forEach(function (art) { art.classList.remove("is-active"); }); };
    });
    window.addEventListener("beforeprint", function () {
      gsap.set(jarts.concat($$(JPARTS, journey)), { autoAlpha: 1, scale: 1, rotation: 0 });
    });
  }


  /* ---- 5h. Our approach steps (about) ------------------------------------- */
  // The heading and intro arrive with the section reveals (5); the five steps (Learn → Improve)
  // then come in one at a time as each one scrolls up: the yellow line from the step before draws
  // down, the step's pink node pops, and the row rises in with its label a beat behind.
  // Scrolling back above a step winds it back. Nothing is pinned; steps already on screen at load
  // stay as they are.
  // A fast scroll that brings in several steps at once still plays them in order, a beat apart.
  var approachTls = [], approachNext = 0;
  var playStep = function (tl) {
    var now = gsap.ticker.time, at = Math.max(now, approachNext);
    approachNext = at + 0.18;
    gsap.delayedCall(at - now, function () { if (!tl.reversed()) tl.play(); });
  };
  $$("[data-approach] .journey-list--rail").forEach(function (list) {
    var steps = $$(":scope > li", list);
    steps.forEach(function (step, i) {
      if (step.getBoundingClientRect().top < window.innerHeight) return;
      var tl = gsap.timeline({ paused: true });
      if (i) tl.fromTo(steps[i - 1], { "--jl-line": 0 }, { "--jl-line": 1, duration: 0.6, ease: "power2.inOut" }, 0);
      tl.fromTo(step, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, i ? 0.3 : 0)
        .fromTo(step, { "--jl-node": 0 }, { "--jl-node": 1, duration: 0.55, ease: "back.out(2.2)" }, i ? 0.4 : 0.1)
        .fromTo(step.querySelector("b"), { x: -10, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, i ? 0.45 : 0.15);
      approachTls.push(tl);
      ScrollTrigger.create({
        trigger: step, start: "top 82%",
        onEnter: function () { tl.reversed(false); playStep(tl); },
        onLeaveBack: function () { tl.reverse(); }
      });
    });
  });
  if (approachTls.length) window.addEventListener("beforeprint", function () { approachTls.forEach(function (tl) { tl.progress(1); }); });


  /* ---- 5i. Inked motto (home hero) ------------------------------------------ */
  // [data-ink-scroll] text starts pale and fills in to Charcoal one letter after another as it
  // scrolls up the screen. Screen readers get the plain text; the letters are decoration. Without
  // this script (reduced motion, no GSAP) the text simply shows in full Charcoal.
  $$("[data-ink-scroll]").forEach(function (el) {
    var text = el.textContent.trim();
    var letters = doc.createElement("span");
    letters.setAttribute("aria-hidden", "true");
    text.split(/(\s+)/).forEach(function (part) {
      if (/^\s+$/.test(part)) { letters.appendChild(doc.createTextNode(" ")); return; }
      var word = doc.createElement("span");
      word.style.whiteSpace = "nowrap";
      part.split("").forEach(function (ch) {
        var c = doc.createElement("span");
        c.textContent = ch;
        word.appendChild(c);
      });
      letters.appendChild(word);
    });
    var label = doc.createElement("span");
    label.className = "sr-only";
    label.textContent = text;
    el.textContent = "";
    el.appendChild(label);
    el.appendChild(letters);
    gsap.fromTo(letters.querySelectorAll("span > span"), { opacity: 0.16 }, {
      opacity: 1, ease: "none", stagger: 0.1,
      scrollTrigger: { trigger: el, start: "clamp(top 92%)", end: "top 45%", scrub: true }
    });
  });

  /* ---- 6. Keeping measurements fresh -------------------------------------- */
  // ScrollTrigger re-measures on resize and load by itself. Content that changes the page's
  // height afterwards (fonts, an opened FAQ, a filtered list, the calendar) refreshes it once
  // things settle, so triggers and parallax ranges never point at old positions.
  var queued = 0, height = 0;
  var refresh = function () { clearTimeout(queued); queued = setTimeout(function () { ScrollTrigger.refresh(); }, 200); };
  if ("ResizeObserver" in window) {
    new ResizeObserver(function (entries) {
      var h = Math.round(entries[0].contentRect.height);
      if (height && h !== height) refresh();
      height = h;
    }).observe(doc.body);
  }
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refresh);

  // For other scripts (and the console): a way to re-measure
  window.fwMotion = { refresh: refresh };
})();
