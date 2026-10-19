/* ==========================================================================
   Faith Works — site interactions (every page)
   1. Helpers  2. Motion setup (split headings, draw paths, reveals)
   3. Header + navigation  4. Tablists (home: examples, journey)
   5. Program selector (learn)  6. Starter kit thank-you  7. Analytics events
   8. Events calendar (workshops)  9. Testimonial photos
   Each module checks that its elements exist, so one file serves every page.
   Motion lives in CSS; this file only adds/removes state classes.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. Helpers --------------------------------------------------------- */
  var doc = document;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function swap(el, update) {
    if (reduceMotion) { update(); return; }
    el.classList.add("is-swapping");
    setTimeout(function () { update(); el.classList.remove("is-swapping"); }, 200);
  }
  // Type text once (the full text stays in the HTML for no-JS and reduced motion)
  function typeOut(el, delay) {
    if (!el || reduceMotion) return;
    var full = el.getAttribute("data-text") || el.textContent;
    el.setAttribute("data-text", full);
    clearTimeout(el._typing);
    el.textContent = "";
    var i = 0;
    function tick() {
      el.textContent = full.slice(0, ++i);
      if (i < full.length) el._typing = setTimeout(tick, 34 + (i % 5) * 6);
    }
    el._typing = setTimeout(tick, delay || 0);
  }
  function fill(listEl, items) {
    listEl.replaceChildren.apply(listEl, items.map(function (t, i) {
      var li = doc.createElement("li");
      li.textContent = t;
      li.style.setProperty("--c", i);
      return li;
    }));
  }
  function stagger(list, prop) { list.forEach(function (el, i) { el.style.setProperty(prop || "--c", i); }); }

  // Analytics: pushes named events to a data layer if a tag manager is installed.
  // Never include names, emails or message text (brief §6, §14).
  var track = window.fwTrack = function (name, params) {
    window.dataLayer = window.dataLayer || [];
    var e = { event: name, page_path: location.pathname };
    for (var k in params || {}) e[k] = params[k];
    window.dataLayer.push(e);
  };

  /* ---- 2. Motion setup ---------------------------------------------------- */
  $$("[data-split]").forEach(function (h) {
    var lines = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = lines.map(function (line, i) {
      return '<span class="line" style="--l:' + i + '"><span>' + line.trim() + "</span></span>";
    }).join(" ");
  });
  $$("[data-draw] path").forEach(function (p) { p.setAttribute("pathLength", "1"); });
  stagger($$(".flow__chips li"));
  stagger($$(".flow__tool"));
  stagger($$(".flow__list li"));
  stagger($$(".faq details"), "--q");

  // Reveal once in view; pause anything running again when a block leaves the viewport
  var revealables = $$("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    revealables.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var el = entry.target;
        if (entry.isIntersecting) {
          el.classList.remove("is-off");
          if (!el.classList.contains("is-in")) {
            requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-in"); }); });
          }
        } else if (el.classList.contains("is-in")) {
          el.classList.add("is-off");
        }
        el.dispatchEvent(new CustomEvent("fw:visibility", { detail: entry.isIntersecting }));
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });
  }
  typeOut($(".h-prompt__typed"), 1100);

  /* ---- 3. Header + navigation -------------------------------------------- */
  var header = $(".site-header");
  var menu = $(".menu");
  var nav = $("#main-navigation");
  if (menu && nav) {
    var setMenu = function (open) {
      nav.classList.toggle("is-open", open);
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    };
    menu.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); menu.focus(); }
    });
    // Close when focus or a click leaves the open menu
    doc.addEventListener("click", function (e) {
      if (nav.classList.contains("is-open") && !nav.contains(e.target) && !menu.contains(e.target)) setMenu(false);
    });
  }
  if (header) {
    var ticking = false;
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); ticking = false; };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  /* ---- 4. Tablists ------------------------------------------------------- */
  // Roving tabindex + arrow keys; onSelect receives the index
  function tablist(list, tabs, onSelect, attr) {
    if (!list || !tabs.length) return;
    attr = attr || "aria-selected";
    function select(i, focus) {
      tabs.forEach(function (t, n) {
        var on = n === i;
        t.setAttribute(attr, String(on));
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tabs[i].focus();
      onSelect(i);
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { if (t.getAttribute(attr) !== "true") select(i); });
    });
    list.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(doc.activeElement);
      if (i < 0) return;
      var next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select((next + tabs.length) % tabs.length, true);
    });
  }

  // Make it concrete: the workflow canvas updates (and replays once) for each task
  var canvas = $("#ex-panel");
  if (canvas) {
    var examples = [
      { task: "Turn a topic into a content plan.", input: "Start with your audience, one business objective and approved source notes.",
        chips: ["Your audience", "One business objective", "Approved source notes"],
        review: "Check accuracy, voice and whether every claim is supported.", title: "A simple content planning workflow",
        list: ["Choose one useful audience question", "Draft three angles from your source notes", "Review and turn one angle into a publishable draft"] },
      { task: "Make lead follow-up more consistent.", input: "Start with an approved inquiry record, service details and the next action.",
        chips: ["Inquiry record", "Service details", "Next action"],
        review: "Verify contact permission, pricing and context before sending.", title: "A follow-up preparation workflow",
        list: ["Summarize the inquiry and missing details", "Draft a relevant next-step message", "Review the draft and record the follow-up date"] },
      { task: "Help your team find an answer.", input: "Start with approved process notes and frequently asked questions.",
        chips: ["Process notes", "Frequently asked questions"],
        review: "Check source permissions and keep human escalation available.", title: "An internal knowledge workflow",
        list: ["Organize the approved source material", "Draft an answer with its source reference", "Flag gaps for the responsible team member"] }
    ];
    var exTabs = $$("[data-example]");
    tablist($(".flow__tabs"), exTabs, function (i) {
      var x = examples[i];
      canvas.setAttribute("aria-labelledby", exTabs[i].id);
      $("#example-task").textContent = x.task;
      $("#example-input").textContent = x.input;
      $("#example-review").textContent = x.review;
      $("#example-title").textContent = x.title;
      fill($("#example-chips"), x.chips);
      fill($("#example-list"), x.list);
      if (!reduceMotion) replay(canvas, "is-playing");
    });
  }

  // Journey: five stages, five scenes; the selected tab, its scene and its copy always change together
  var scenes = $$(".scene");
  if (scenes.length) {
    var stepTabs = $$("[data-step]");
    tablist($(".steps"), stepTabs, function (i) {
      scenes.forEach(function (s, n) {
        var on = n === i;
        s.hidden = !on;
        s.classList.toggle("is-active", on);
      });
    });
  }

  /* ---- 5. Program selector (learn) --------------------------------------- */
  var preview = $(".fit__preview");
  if (preview) {
    var choices = [
      { name: "AI Workforce Masterclass & Accelerator", href: "/programs/ai-workforce-accelerator/", tone: "stone", kicker: "A good place to start",
        dt: "Typical learning output", output: "A workflow plan and first prototype",
        focus: ["Assess your workflow readiness", "Choose one recurring, reviewable process", "Design a workflow and build a first prototype"], cta: "View this program" },
      { name: "AI + LinkedIn B2B Growth", href: "/programs/ai-linkedin-b2b-growth/", tone: "pink", kicker: "A good place to start",
        dt: "Typical learning output", output: "A positioning statement and a reviewed content plan",
        focus: ["Clarify who you serve", "Plan useful content with AI, edited in your voice", "Design a reviewable follow-up workflow"], cta: "View this program" },
      { name: "AI Websites & Workflow Building", href: "/programs/ai-websites-workflow-building/", tone: "yellow", kicker: "A good place to start",
        dt: "Typical learning output", output: "A first landing page or lead tracker",
        focus: ["Choose a useful business project", "Build a first version with guided practice", "Review what is needed before real-world use"], cta: "View this program" },
      { name: "Training for your organization", href: "/business/", tone: "ink", kicker: "For your organization",
        dt: "The aim", output: "Move your team from AI awareness to practical adoption",
        focus: ["Align on your team’s priorities", "Learn through relevant use cases", "Apply AI in guided exercises", "Define the next implementation steps"], cta: "Explore corporate training" }
    ];
    var fitCta = $("#fit-cta");
    tablist($(".fit__goals"), $$("[data-goal]"), function (i) {
      var c = choices[i];
      swap(preview, function () {
        preview.setAttribute("data-tone", c.tone);
        $(".fit__kicker", preview).textContent = c.kicker;
        $("#fit-name").textContent = c.name;
        $(".fit__output dt", preview).textContent = c.dt;
        $("#fit-output").textContent = c.output;
        fill($("#fit-focus"), c.focus);
        fitCta.setAttribute("href", c.href);
        fitCta.firstChild.textContent = c.cta + " ";
      });
    }, "aria-checked");
  }

  /* ---- 6. Starter kit thank-you ------------------------------------------ */
  var dl = $("[data-kit-download]");
  if (dl) {
    var cfg = (window.FW_CONFIG || {}).starterKit || {};
    var params = new URLSearchParams(location.search);
    if (cfg.downloadUrl) {
      dl.setAttribute("href", cfg.downloadUrl);
      dl.removeAttribute("aria-disabled");
      var missing = $("[data-kit-missing]");
      if (missing) missing.hidden = true;
    } else {
      dl.addEventListener("click", function (e) { e.preventDefault(); });
    }
    if (params.get("delivery") === "pending") {
      $("[data-delivery-text]").textContent = "Your starter kit is ready to download. Your email copy is on its way and may take a few minutes.";
    }
  }

  /* ---- 7. Analytics events ------------------------------------------------ */
  if (location.pathname.indexOf("/free-ai-starter-kit/") === 0 && !dl) track("landing_view", { offer_id: "ai-workflow-starter-kit" });
  doc.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-track]");
    if (el) track(el.getAttribute("data-track"), { link_url: el.getAttribute("href") || "" });
  });

  /* ---- 8. Events calendar (workshops) ------------------------------------- */
  // Draws one month from the event data the build embeds (published, visible events only).
  // Dates are the event's own calendar dates (as entered in its time zone), so they never shift.
  var cal = $("[data-fw-calendar]");
  if (cal) {
    var calEvents = [];
    try { calEvents = JSON.parse($("[data-cal-data]", cal).textContent) || []; } catch (err) { calEvents = []; }
    var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var iso = function (y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); };
    var todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    var byDay = {};
    calEvents.forEach(function (ev) {
      var first = String(ev.start || "").slice(0, 10), last = String(ev.end || ev.start || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) return;
      if (!(last >= first)) last = first;
      var d = new Date(first + "T12:00:00Z"), guard = 0;
      while (guard++ < 62) {
        var key = d.toISOString().slice(0, 10);
        (byDay[key] = byDay[key] || []).push(ev);
        if (key >= last) break;
        d.setUTCDate(d.getUTCDate() + 1);
      }
    });
    // Start on the month of the next upcoming event, or this month
    var next = calEvents.filter(function (ev) { return !ev.past; })[0];
    var startIso = next ? String(next.start).slice(0, 10) : todayIso;
    var view = { y: +startIso.slice(0, 4), m: +startIso.slice(5, 7) - 1 };
    var grid = $("[data-cal-grid]", cal), title = $("[data-cal-title]", cal), empty = $("[data-cal-empty]", cal);
    var el = function (tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
    var draw = function () {
      title.textContent = MONTHS[view.m] + " " + view.y;
      grid.textContent = "";
      DOW.forEach(function (d) { grid.appendChild(el("span", "cal__dow", d)); });
      var lead = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
      var days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
      var cells = Math.ceil((lead + days) / 7) * 7, any = false;
      for (var i = 0; i < cells; i++) {
        var day = i - lead + 1;
        if (day < 1 || day > days) { grid.appendChild(el("div", "cal__day cal__day--out")); continue; }
        var key = iso(view.y, view.m, day), list = byDay[key] || [];
        var cell = el("div", "cal__day" + (key === todayIso ? " cal__day--today" : "") + (list.length ? "" : " cal__day--empty"));
        var label = new Date(key + "T12:00:00Z").toLocaleDateString("en-PH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
        cell.appendChild(el("span", "cal__num", window.innerWidth <= 640 ? label : String(day)));
        list.forEach(function (ev) {
          any = true;
          var a = el("a", "cal__ev" + (ev.past ? " cal__ev--past" : ""), ev.title);
          a.href = ev.url;
          if (ev.external) { a.target = "_blank"; a.rel = "noopener"; }
          if (ev.time) a.appendChild(el("small", "", ev.time));
          a.setAttribute("aria-label", ev.title + ", " + label + (ev.time ? ", " + ev.time : "") + (ev.external ? " (opens in a new tab)" : ""));
          cell.appendChild(a);
        });
        grid.appendChild(cell);
      }
      empty.hidden = any;
    };
    $("[data-cal-prev]", cal).addEventListener("click", function () { view.m--; if (view.m < 0) { view.m = 11; view.y--; } draw(); });
    $("[data-cal-next]", cal).addEventListener("click", function () { view.m++; if (view.m > 11) { view.m = 0; view.y++; } draw(); });
    draw();
  }

  /* ---- 9. Testimonial photos ---------------------------------------------- */
  // A photo that cannot load is removed, so a card never shows a broken image.
  $$(".quote__photo").forEach(function (img) {
    var drop = function () { img.remove(); };
    if (img.complete && img.naturalWidth === 0) drop(); else img.addEventListener("error", drop);
  });

  window.__fwReady = true;
})();
