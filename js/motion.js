/* ==========================================================================
   Faith Works — smooth scrolling and scroll motion (every page)
   1. Setup  2. Lenis + ScrollTrigger  3. In-page links  4. Depth (parallax)
   5. Section reveals  5b. Program showcase (pinned)  6. Keeping measurements fresh
   Lenis smooths wheel scrolling of the window itself (touch, keyboard, scrollbars and nested
   scroll areas stay native) and GSAP's ticker drives it, so Lenis and ScrollTrigger share one
   frame loop. The CSS reveals (style.css §18, [data-reveal]) stay as they are: this file only
   reveals sections they do not cover, and gives a few chosen elements depth (style.css §18b
   decides how far each one moves). Reduced motion, or a library that did not load: nothing
   here runs, the page scrolls natively and every element stays where the stylesheet put it.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. Setup ----------------------------------------------------------- */
  var doc = document;
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, Lenis = window.Lenis;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !gsap || !ScrollTrigger || !Lenis) return;

  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  var expoOut = function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  gsap.registerPlugin(ScrollTrigger);

  /* ---- 2. Lenis + ScrollTrigger ------------------------------------------- */
  // One instance for the page. lerp 0.1 follows the wheel closely without drifting on; nested
  // scroll areas (the mobile menu, the article contents) keep their own native scrolling.
  var lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, allowNestedScroll: true, autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);
  // Dialogs (booking) scroll on their own, as before
  $$("dialog").forEach(function (d) { d.setAttribute("data-lenis-prevent", ""); });

  /* ---- 3. In-page links --------------------------------------------------- */
  // Same-page #links glide to their target, stopping below the sticky header (Lenis reads the
  // page's scroll-padding-top), then focus moves there as a native jump would, and the address
  // keeps the hash. Links to other pages, new tabs and modified clicks are left to the browser.
  var focusOn = function (el) {
    if (!el.matches("a[href], button, input, select, textarea, summary, [tabindex]")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };
  doc.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href*='#']");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return;
    var target = url.hash.length > 1 ? doc.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
    if (!target) return;
    e.preventDefault();
    if (location.hash !== url.hash) history.pushState(null, "", url.hash);
    var distance = Math.abs(target.getBoundingClientRect().top);
    lenis.scrollTo(target, { duration: 0.8 + Math.min(1, distance / 3000) * 0.6, easing: expoOut });
    focusOn(target);
  });

  /* ---- 4. Depth (parallax) ------------------------------------------------ */
  // Each element below gets one number, --fw-p, as it crosses the viewport: -1 entering at the
  // bottom, 1 leaving at the top. Elements already on screen when the page opens run 0 → 1 from
  // the top of the page, so nothing shifts as the script starts; the home hero runs 0 → 1 while
  // it scrolls away. style.css §18b turns --fw-p into a few pixels of movement (halved on small
  // screens), on the independent translate/scale properties. Add [data-depth] (optionally with
  // style="--depth: 30") to give another decorative element the same treatment.
  var DEPTH = ".hero, .ahero__photo, .phero__photo, .founder__photo, .business__photo, .talks__photo, .kit-by__photos figure:first-child, .kitart, .cta, [data-depth]";
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
    return el.getBoundingClientRect().top > window.innerHeight && getComputedStyle(el).animationName === "none";
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


  /* ---- 6. Keeping measurements fresh -------------------------------------- */
  // ScrollTrigger re-measures on resize and load by itself. Content that changes the page's
  // height afterwards (fonts, an opened FAQ, a filtered list, the calendar) refreshes it once
  // things settle, so triggers and parallax ranges never point at old positions.
  var queued = 0, height = 0;
  var refresh = function () { clearTimeout(queued); queued = setTimeout(function () { lenis.resize(); ScrollTrigger.refresh(); }, 200); };
  if ("ResizeObserver" in window) {
    new ResizeObserver(function (entries) {
      var h = Math.round(entries[0].contentRect.height);
      if (height && h !== height) refresh();
      height = h;
    }).observe(doc.body);
  }
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refresh);

  // For other scripts (and the console): the shared instance and a way to re-measure
  window.fwMotion = { lenis: lenis, refresh: refresh, showcaseTo: showcaseTo, scrollTo: function (target, opts) { lenis.scrollTo(target, opts); } };
})();
