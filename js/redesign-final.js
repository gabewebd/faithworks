/* ==========================================================================
   Faith Works — hero redesign (review route /redesign-final/ only)
   Loaded after js/main.js (deferred, in order). Everything else on this hero is CSS
   (css/redesign-final.css §6); this file adds only the pointer parallax: --px/--py (−1…1)
   on the hero, eased toward the pointer, for fine pointers on wide screens. The loop sleeps
   once settled or while the hero is off screen. Touch, reduced motion: nothing moves.
   ========================================================================== */
(function () {
  "use strict";

  var hero = document.querySelector(".rf-page .rf-hero");
  if (!hero) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1101px)");

  var aim = { x: 0, y: 0 }, now = { x: 0, y: 0 }, raf = 0, on = true;
  var loop = function () {
    now.x += (aim.x - now.x) * 0.06;
    now.y += (aim.y - now.y) * 0.06;
    hero.style.setProperty("--px", now.x.toFixed(4));
    hero.style.setProperty("--py", now.y.toFixed(4));
    var settled = Math.abs(aim.x - now.x) < 0.001 && Math.abs(aim.y - now.y) < 0.001;
    raf = on && !settled ? requestAnimationFrame(loop) : 0;
  };
  var wake = function () { if (on && !raf) raf = requestAnimationFrame(loop); };

  hero.addEventListener("pointermove", function (e) {
    if (!fine.matches || e.pointerType !== "mouse") return;
    var r = hero.getBoundingClientRect();
    aim.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    aim.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    wake();
  });
  hero.addEventListener("pointerleave", function () { aim.x = 0; aim.y = 0; wake(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) { on = entries[0].isIntersecting; wake(); }).observe(hero);
  }
})();
