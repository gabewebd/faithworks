/* ==========================================================================
   Faith Works — homepage redesign (review route /home-redesign/ only)
   Loaded after js/main.js and js/motion.js (deferred, in order), so GSAP and ScrollTrigger are
   already running. js/main.js keeps doing what it does on the homepage
   (tabs, testimonial deck, logo-strip toggle); this file adds only the redesign's own motion:
   1. Journey progress rail  2. Station threads  3. Constellation parallax
   4. Journey pin (wide screens)  5. Scene scrubs (photo, night glow, gallery drift, finale)
   Reduced motion or a library that did not load: nothing here moves; every thread is drawn,
   the journey is a plain tabbed section and the finale's tools sit in their ring.
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var page = doc.querySelector(".hr-page");
  if (!page) return;
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1. Journey progress rail ------------------------------------------- */
  // The pink rail beside the five stages fills to the selected one, however it was chosen
  // (click, arrow keys, or the pinned scroll below).
  var steps = $("[data-hr-steps]");
  var stepTabs = steps ? $$("[data-step]", steps) : [];
  var selectedStep = function () {
    for (var i = 0; i < stepTabs.length; i++) if (stepTabs[i].getAttribute("aria-selected") === "true") return i;
    return 0;
  };
  if (steps && stepTabs.length > 1) {
    var paint = function () { steps.style.setProperty("--hr-step", (selectedStep() / (stepTabs.length - 1)).toFixed(3)); };
    new MutationObserver(paint).observe(steps, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    paint();
  }

  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  if (reduceMotion || !gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  /* ---- 2. Station threads ------------------------------------------------- */
  // Each thread draws down from its glass tile into the scene's heading as the seam rises
  // through the lower half of the screen, and undraws on the way back up.
  $$("[data-hr-thread]").forEach(function (thread) {
    var scene = thread.closest(".hr-scene") || thread.parentNode;
    var routes = thread.closest(".hr-routes");
    gsap.fromTo(thread, { "--draw": 0 }, {
      "--draw": 1, ease: "none",
      scrollTrigger: routes
        ? { trigger: routes, start: "top 75%", end: "bottom 60%", scrub: true }
        : { trigger: scene, start: "top 92%", end: "top 40%", scrub: true }
    });
  });

  /* ---- 3. Constellation parallax ------------------------------------------ */
  // The tools lean toward the pointer, each by its own depth (--z), on a damped spring; the
  // wires stay put, so nearer tiles seem to float above them. Mouse and trackpad only.
  var cons = $("[data-hr-cons]");
  if (cons && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var hero = cons.closest(".hr-hero");
    var aim = { x: 0, y: 0 }, at = { x: 0, y: 0 }, vel = { x: 0, y: 0 }, raf = 0, prev = 0, onScreen = true;
    var loop = function (now) {
      var dt = Math.min(0.1, (now - (prev || now)) / 1000);
      prev = now;
      ["x", "y"].forEach(function (k) {
        for (var s = 0; s < 4; s++) { vel[k] += (25 * (aim[k] - at[k]) - 10 * vel[k]) * dt / 4; at[k] += vel[k] * dt / 4; }
      });
      cons.style.setProperty("--mx", at.x.toFixed(3));
      cons.style.setProperty("--my", at.y.toFixed(3));
      var settled = Math.abs(aim.x - at.x) + Math.abs(aim.y - at.y) + Math.abs(vel.x) + Math.abs(vel.y) < 0.002;
      raf = onScreen && !settled ? requestAnimationFrame(loop) : 0;
      if (!raf) prev = 0;
    };
    var wake = function () { if (onScreen && !raf) raf = requestAnimationFrame(loop); };
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      aim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      aim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      wake();
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { aim.x = 0; aim.y = 0; wake(); });
    new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; wake(); }).observe(hero);
  }

  /* ---- 4. Journey pin (wide screens) -------------------------------------- */
  // The page's one pinned moment. On wide screens the charcoal scene holds still while the scroll
  // walks Learn → Apply → Build → Implement → Improve (about 60% of a screen per stage), choosing
  // each stage's tab exactly as a click would. Choosing a tab yourself moves the scroll to that
  // stage, so the two never disagree. Narrower screens keep the plain tabs.
  var pin = $("[data-hr-pin]");
  if (pin && stepTabs.length > 1) {
    gsap.matchMedia().add("(min-width: 1101px) and (min-height: 640px)", function () {
      var n = stepTabs.length, driving = false;
      var st = ScrollTrigger.create({
        trigger: pin, pin: true, start: "top top", end: function () { return "+=" + Math.round(window.innerHeight * 0.6 * (n - 1)); },
        onUpdate: function (self) {
          var i = Math.min(n - 1, Math.round(self.progress * (n - 1)));
          if (i === selectedStep()) return;
          driving = true;
          stepTabs[i].click();
          driving = false;
        }
      });
      var follow = function (e) {
        if (driving || !st.isActive && !e.isTrusted) return;
        var i = stepTabs.indexOf(e.currentTarget);
        if (i < 0 || !st.isActive) return;
        var y = st.start + (st.end - st.start) * (i / (n - 1));
        window.scrollTo({ top: Math.round(y) + 1, behavior: "smooth" });
      };
      stepTabs.forEach(function (t) { t.addEventListener("click", follow); });
      return function () { stepTabs.forEach(function (t) { t.removeEventListener("click", follow); }); };
    });
  }

  /* ---- 5. Scene scrubs ----------------------------------------------------- */
  var scrub = function (el, prop, from, to, trigger) {
    if (!el) return;
    var o = {}, f = {};
    f[prop] = from; o[prop] = to; o.ease = "none";
    o.scrollTrigger = Object.assign({ trigger: el, start: "top bottom", end: "bottom top", scrub: true }, trigger || {});
    gsap.fromTo(el, f, o);
  };
  // The organization photo drifts inside its frame; the night horizon rises as the scene arrives
  scrub($(".hr-org"), "--hr-org", -1, 1);
  scrub($(".hr-night"), "--hr-night", 0, 1, { start: "top bottom", end: "top top" });
  // Gallery: every third photo drifts against the scroll, so the spread reads in layers
  $$(".hr-photos__tile").forEach(function (tile, i) {
    if (i % 3 !== 1) return;
    scrub(tile, "--hr-drift", 1.6, -1.6);
  });
  // Finale: the tools from the hero gather in round the last line as it arrives
  scrub($(".hr-finale"), "--gather", 0, 1, { start: "top bottom", end: "center 60%" });
})();
