/* ---- js/main.js (settings at the top) ---- */
/* ==========================================================================
   Faith Works — runtime settings (public; never put API keys or private
   webhook URLs here). See docs/06_Forms_and_Lead_Capture_Specification.docx.

   forms.mode
     "preview"  : staging. Forms validate and show what would be recorded,
                  but nothing is sent or stored, and no false success is shown.
     "endpoint" : forms POST JSON to forms.endpoint: the CMS submission API,
                  https://<cms-domain>/api/forms/submit (cms/README.md §13). It
                  stores the submission in Supabase, then alerts the team. Its
                  credentials stay on the CMS server. Success is shown only when
                  it answers 2xx with { ok: true }. The website's origin must be
                  listed in the CMS setting FORMS_ALLOWED_ORIGINS.
     If native GHL forms are embedded instead (the recommended launch path),
     the designed forms are replaced and this setting is unused.
   starterKit.downloadUrl : the approved kit file. null until the PDF is final.
   ========================================================================== */
window.FW_CONFIG = {
  forms: {
    mode: "preview",
    endpoint: "",
    timeoutMs: 15000
  },
  starterKit: {
    downloadUrl: null,
    version: "v1.0-draft"
  },
  consentWordingVersion: "marketing-optin-v1-draft",
  contactEmail: "ibelieve@faithph.ai"
};


/* ---- js/main.js ---- */
/* ==========================================================================
   Faith Works — site interactions (every page)
   1. Helpers  2. Motion setup (split headings, draw paths, reveals)
   3. Header + navigation  4. Tablists (home: examples, journey)
   5. Program selector and showcase (learn), 5b. programs split (home)  6. Starter kit thank-you  7. Analytics events
   8. Event Calendar (workshops)  9. Testimonial photos  10. Hero node web wires
   11. Logo strip pause  12. Testimonial carousel  13. Video (click to load) and booking
   14. Article contents (sticky sidebar)  15. Resource search and filters  16. Share this (articles)
   17. Card pager (professionals: challenges)  18. Event gallery marquee
   19. Event buttons after the event  20. Event photo slideshows
   Each module checks that its elements exist, so one file serves every page.
   Motion lives in CSS; this file adds/removes state classes, except the pointer-driven hero
   and the testimonial deck, which need per-frame values.
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
  stagger($$(".fpills li"));
  stagger($$(".fout__rows li"));
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
    return select;
  }

  // Make it concrete: three cards (the task, AI assists, you review) change together for each task
  var cards = $("#ex-panel");
  if (cards) {
    var examples = [
      { inputs: ["Your audience", "One business objective", "Approved source notes"],
        taskTitle: "Start with the right context", taskCopy: "Turn a topic into a content plan. Begin with your audience, one business objective and approved source notes.",
        draft: "Three content angles", aiTitle: "Turn notes into a first draft", aiCopy: "AI drafts three content angles from your approved source notes, ready for you to choose from.",
        out: "Content plan", output: ["Answer one audience question", "Share a practical how-to", "Tell a real example"],
        reviewTitle: "Review before it goes live", reviewCopy: "Check accuracy, voice and whether every claim is supported, then publish one angle." },
      { inputs: ["Inquiry record", "Service details", "Next action"],
        taskTitle: "Start with the inquiry", taskCopy: "Make follow-up more consistent. Begin with an approved inquiry record, your service details and the next action.",
        draft: "Next-step message", aiTitle: "Draft the next-step message", aiCopy: "AI summarizes the inquiry, notes any missing details and drafts a relevant next-step message.",
        out: "Follow-up", output: ["Inquiry summarized", "Message reviewed", "Follow-up date recorded"],
        reviewTitle: "Check it before you send", reviewCopy: "Verify contact permission, pricing and context before the message goes out." },
      { inputs: ["Approved process notes", "Frequently asked questions"],
        taskTitle: "Start with approved sources", taskCopy: "Help your team find an answer, using only approved process notes and frequently asked questions.",
        draft: "Answer with its source", aiTitle: "Draft an answer with its source", aiCopy: "AI organizes the approved material and drafts an answer with its source reference.",
        out: "Team answer", output: ["Source reference attached", "Gaps flagged to the owner", "Human escalation kept"],
        reviewTitle: "Keep a person accountable", reviewCopy: "Check source permissions and keep human escalation available." }
    ];
    var exText = { taskTitle: "#ex-task-title", taskCopy: "#ex-task-copy", draft: "#ex-draft", aiTitle: "#ex-ai-title",
      aiCopy: "#ex-ai-copy", out: "#ex-out", reviewTitle: "#ex-review-title", reviewCopy: "#ex-review-copy" };
    var exTabs = $$("[data-example]");
    tablist($(".flow__tabs"), exTabs, function (i) {
      var x = examples[i];
      cards.setAttribute("aria-labelledby", exTabs[i].id);
      swap(cards, function () {
        for (var k in exText) $(exText[k]).textContent = x[k];
        fill($("#ex-inputs"), x.inputs);
        fill($("#ex-output"), x.output);
        if (!reduceMotion) replay(cards, "is-playing");
      });
    });
  }

  // Journey: five stages, five scenes; the selected tab, its scene and its copy always change together
  var scenes = $$(".scene");
  if (scenes.length) {
    var stepTabs = $$("[data-step]");
    var journey = $("#journey");
    var current = 0;
    var fromScroll = false;
    var pinQuery = window.matchMedia("(min-width: 901px) and (min-height: 700px)");
    var pinned = function () { return !reduceMotion && pinQuery.matches; };
    // The pin holds from the section top meeting the header until its bottom meets the viewport bottom
    var headH = function () { return header ? header.offsetHeight : 0; };
    var pinRun = function () { return journey.offsetHeight - window.innerHeight + headH(); };
    // Scroll position for stage i: the middle of that stage's slice of the pinned run
    var stageTop = function (i) {
      return journey.getBoundingClientRect().top + window.scrollY - headH() + pinRun() * (i + 0.5) / scenes.length;
    };
    var selectStep = tablist($(".steps"), stepTabs, function (i) {
      current = i;
      scenes.forEach(function (s, n) {
        var on = n === i;
        s.hidden = !on;
        s.classList.toggle("is-active", on);
      });
      // A click or arrow key moves the page to that stage so scrolling carries on from there
      if (!fromScroll && pinned()) window.scrollTo({ top: stageTop(i), behavior: "smooth" });
    });

    // Pinned on wide screens: scrolling through the section steps through the stages, no clicks needed
    if (journey && selectStep) {
      var pinTicking = false;
      var onPinScroll = function () {
        pinTicking = false;
        if (!pinned()) return;
        var p = (headH() - journey.getBoundingClientRect().top) / pinRun();
        p = Math.min(Math.max(p, 0), 0.9999);
        var i = Math.floor(p * scenes.length);
        if (i !== current) { fromScroll = true; selectStep(i); fromScroll = false; }
      };
      var setPin = function () { journey.classList.toggle("is-pinned", pinned()); onPinScroll(); };
      window.addEventListener("scroll", function () { if (!pinTicking) { pinTicking = true; requestAnimationFrame(onPinScroll); } }, { passive: true });
      if (pinQuery.addEventListener) pinQuery.addEventListener("change", setPin);
      setPin();
    }
  }

  /* ---- 5b. Programs split (home) ----------------------------------------- */
  // The program crossing a thin band at the middle of the screen becomes active, and the sticky
  // mockup shows its view. Between programs nothing is in the band, so the last one stays active:
  // no flicker, and scrolling either way lands on the right one.
  var pscene = $("[data-pscene]");
  if (pscene && "IntersectionObserver" in window) {
    var psteps = $$("[data-pstep]", pscene), pstage = $("[data-pscene-stage]", pscene);
    var pviews = pstage ? $$(".pmock__view", pstage) : [];
    var pactive = -1;
    var pset = function (i) {
      if (i === pactive) return;
      pactive = i;
      psteps.forEach(function (s, k) { s.classList.toggle("is-active", k === i); });
      pviews.forEach(function (v, k) { v.classList.toggle("is-active", k === i); });
      if (pstage) pstage.setAttribute("data-at", String(i));
    };
    pset(0);
    pscene.classList.add("is-live");
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) pset(psteps.indexOf(e.target)); });
    }, { rootMargin: "-48% 0px -48% 0px" });
    psteps.forEach(function (s) { pio.observe(s); });
  }

  /* ---- 5. Program selector (learn) --------------------------------------- */
  // Three facts per goal: who it is for, what you leave with, and the next step (the button)
  var preview = $(".fit__preview");
  if (preview) {
    var choices = [
      { name: "AI Workforce Masterclass & Accelerator", href: "/programs/ai-workforce-accelerator/", tone: "stone", kicker: "A good place to start",
        who: "Professionals, founders and team leads new to AI", dt: "You leave with", output: "A workflow plan and first prototype", cta: "View this program" },
      { name: "AI + LinkedIn B2B Growth", href: "/programs/ai-linkedin-b2b-growth/", tone: "pink", kicker: "A good place to start",
        who: "Founders, consultants and B2B professionals", dt: "You leave with", output: "A positioning statement and a reviewed content plan", cta: "View this program" },
      { name: "AI Websites & Workflow Building", href: "/programs/ai-websites-workflow-building/", tone: "yellow", kicker: "A good place to start",
        who: "Founders and professionals who want to build, not only prompt", dt: "You leave with", output: "A first landing page or lead tracker", cta: "View this program" },
      { name: "Training for your organization", href: "/business/", tone: "ink", kicker: "For your organization",
        who: "Teams and organizations", dt: "The aim", output: "Move your team from AI awareness to practical adoption", cta: "Explore corporate training" }
    ];
    var fitCta = $("#fit-cta");
    tablist($(".fit__goals"), $$("[data-goal]"), function (i) {
      var c = choices[i];
      swap(preview, function () {
        preview.setAttribute("data-tone", c.tone);
        $(".fit__kicker", preview).textContent = c.kicker;
        $("#fit-name").textContent = c.name;
        $("#fit-for").textContent = c.who;
        $("#fit-output-label").textContent = c.dt;
        $("#fit-output").textContent = c.output;
        fitCta.setAttribute("href", c.href);
        fitCta.firstChild.textContent = c.cta + " ";
      });
    }, "aria-checked");
  }

  /* ---- 5a. Workshop photo gallery (all hero showcases: loop & zoom parallax) */
  var pgalleries = $$("[data-pgallery]");
  pgalleries.forEach(function (pgallery) {
    var stage = $("figure.pgallery__stage", pgallery);
    var stageImg = stage ? $("img", stage) : null;
    var thumbs = $$(".pgallery__thumb", pgallery);
    if (!stageImg || !thumbs.length) return;

    var currentIndex = 0;
    var timer = null;
    var INTERVAL = 4400;
    var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    thumbs.forEach(function (b, i) {
      if (b.getAttribute("aria-pressed") === "true") currentIndex = i;
    });

    function goTo(idx, isUser) {
      if (idx < 0) idx = thumbs.length - 1;
      if (idx >= thumbs.length) idx = 0;
      currentIndex = idx;
      var btn = thumbs[idx];
      thumbs.forEach(function (b, n) {
        b.setAttribute("aria-pressed", n === idx ? "true" : "false");
      });

      var tImg = btn.querySelector("img");
      var src = (tImg && tImg.getAttribute("src")) || btn.getAttribute("data-src");
      var srcset = (tImg && tImg.getAttribute("srcset")) || btn.getAttribute("data-srcset");
      var alt = btn.getAttribute("data-alt");
      var pos = btn.getAttribute("data-pos");

      // Cross-dissolve: outgoing image placed on top layer, dissolves smoothly to reveal incoming
      var prevLayer = stage.querySelector(".pgallery__dissolve-layer");
      if (prevLayer && prevLayer.parentNode) prevLayer.parentNode.removeChild(prevLayer);

      var clone = stageImg.cloneNode(true);
      clone.classList.add("pgallery__dissolve-layer");
      clone.style.zIndex = "2";
      clone.style.opacity = "1";
      clone.style.transition = reduceMotion ? "none" : "opacity 500ms cubic-bezier(0.25, 1, 0.5, 1)";
      stage.appendChild(clone);

      if (srcset) stageImg.setAttribute("srcset", srcset);
      if (src) stageImg.setAttribute("src", src);
      if (alt) stageImg.setAttribute("alt", alt);
      if (pos) stageImg.style.objectPosition = pos;

      // Restart zoom animation on new image
      stage.classList.remove("is-zooming");
      void stage.offsetWidth;
      stage.classList.add("is-zooming");

      requestAnimationFrame(function () {
        clone.style.opacity = "0";
      });

      setTimeout(function () {
        if (clone.parentNode) clone.parentNode.removeChild(clone);
      }, reduceMotion ? 0 : 520);

      if (isUser) {
        restart();
      }
    }

    function start() {
      if (prefersReduced) return;
      stop();
      timer = setInterval(function () {
        goTo(currentIndex + 1, false);
      }, INTERVAL);
    }

    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function restart() {
      stop();
      start();
    }

    thumbs.forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        goTo(i, true);
      });
    });

    pgallery.addEventListener("mouseenter", stop);
    pgallery.addEventListener("mouseleave", start);
    pgallery.addEventListener("focusin", stop);
    pgallery.addEventListener("focusout", start);

    stage.classList.add("is-zooming");
    start();
  });

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
  if (/\/start-your-ai-journey(\.html|\/?$)/.test(location.pathname)) track("landing_view", { offer_id: "ai-workflow-starter-kit" });
  doc.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-track]");
    if (el) track(el.getAttribute("data-track"), { link_url: el.getAttribute("href") || "" });
  });

  /* ---- 8. Event Calendar (workshops) -------------------------------------- */
  // Draws one month from the event data the build embeds (published, visible events only).
  // Dates are the event's own calendar dates (as entered in its time zone), so they never shift.
  // Every day is a button (one tab stop: the arrow keys move between days, Page Up/Down change
  // the month). Choosing a day lists its events in the panel; "Next up" jumps to the next event.
  var cal = $("[data-fw-calendar]");
  if (cal) {
    var calEvents = [];
    try { calEvents = JSON.parse($("[data-cal-data]", cal).textContent) || []; } catch (err) { calEvents = []; }
    // An event that has ended since this page was built is shown as past: its title only
    calEvents.forEach(function (ev) {
      if (ev.past || !ev.endsAt || !(Date.parse(ev.endsAt) <= Date.now())) return;
      ev.past = true;
    });
    var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var iso = function (y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); };
    var noon = function (key) { return new Date(key + "T12:00:00Z"); };
    var shift = function (key, days) { var d = noon(key); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
    var longDate = function (key, opts) { return noon(key).toLocaleDateString("en-PH", opts || { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
    var todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    var byDay = {};
    calEvents.forEach(function (ev) {
      var first = String(ev.start || "").slice(0, 10), last = String(ev.end || ev.start || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(first)) return;
      if (!(last >= first)) last = first;
      ev.first = first;
      var d = noon(first), guard = 0;
      while (guard++ < 62) {
        var key = d.toISOString().slice(0, 10);
        (byDay[key] = byDay[key] || []).push(ev);
        if (key >= last) break;
        d.setUTCDate(d.getUTCDate() + 1);
      }
    });
    var upcoming = calEvents.filter(function (ev) { return !ev.past && ev.first; });
    // Start on the day of the next upcoming event, or today
    var sel = upcoming[0] ? upcoming[0].first : todayIso;
    var view = { y: +sel.slice(0, 4), m: +sel.slice(5, 7) - 1 };
    var grid = $("[data-cal-grid]", cal), title = $("[data-cal-title]", cal), panel = $("[data-cal-panel]", cal), hint = $("[data-cal-hint]", cal);
    var el = function (tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
    var inView = function (key) { return +key.slice(0, 4) === view.y && +key.slice(5, 7) - 1 === view.m; };
    // "Today", "Tomorrow", "In 5 days", "Past event"
    var countdown = function (ev) {
      if (ev.past) return "Past event";
      var days = Math.round((noon(ev.first) - noon(todayIso)) / 86400000);
      return days <= 0 ? "Happening now" : days === 1 ? "Tomorrow" : "In " + days + " days";
    };
    // The day that takes the tab stop: the chosen day when it is in this month, else the
    // month's first event day, else the 1st.
    var focusKey = function () {
      if (inView(sel)) return sel;
      var days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
      for (var d = 1; d <= days; d++) if (byDay[iso(view.y, view.m, d)]) return iso(view.y, view.m, d);
      return iso(view.y, view.m, 1);
    };
    var draw = function (dir) {
      title.textContent = MONTHS[view.m] + " " + view.y;
      grid.textContent = "";
      DOW.forEach(function (d) { grid.appendChild(el("span", "cal__dow", d)); });
      var lead = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
      var days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
      var cells = Math.ceil((lead + days) / 7) * 7, stop = focusKey();
      for (var i = 0; i < cells; i++) {
        var day = i - lead + 1;
        if (day < 1 || day > days) { grid.appendChild(el("span", "cal__day cal__day--out")); continue; }
        var key = iso(view.y, view.m, day), list = byDay[key] || [];
        var btn = el("button", "cal__day" + (key === todayIso ? " cal__day--today" : "") + (list.length ? " cal__day--has" : "") + (list.length && list.every(function (ev) { return ev.past; }) ? " cal__day--pastonly" : ""));
        btn.type = "button";
        btn.setAttribute("data-date", key);
        btn.setAttribute("aria-pressed", key === sel ? "true" : "false");
        btn.tabIndex = key === stop ? 0 : -1;
        btn.setAttribute("aria-label", longDate(key) + (key === todayIso ? ", today" : "") + ", " + (list.length ? list.length + (list.length === 1 ? " event" : " events") : "no events"));
        var num = el("span", "cal__num", String(day));
        num.setAttribute("aria-hidden", "true");
        btn.appendChild(num);
        if (list.length) {
          var dots = el("span", "cal__dots");
          dots.setAttribute("aria-hidden", "true");
          list.slice(0, 3).forEach(function (ev) {
            dots.appendChild(el("span", "cal__dot" + (ev.past ? " cal__dot--past" : "")));
          });
          btn.appendChild(dots);
          list.slice(0, 2).forEach(function (ev) {
            var chip = el("span", "cal__chip" + (ev.past ? " cal__chip--past" : ""), ev.title);
            chip.setAttribute("aria-hidden", "true");
            btn.appendChild(chip);
          });
          if (list.length > 2) { var more = el("span", "cal__more", "+" + (list.length - 2) + " more"); more.setAttribute("aria-hidden", "true"); btn.appendChild(more); }
        }
        grid.appendChild(btn);
      }
      if (dir) replay(grid, dir > 0 ? "is-turning-next" : "is-turning-prev");
    };
    var eventItem = function (ev, i) {
      var li = el("li", "cal__item" + (ev.past ? " cal__item--past" : ""));
      li.style.setProperty("--c", i);
      // The event card's photos (built by tools/render.mjs eventFigure), slideshow and all
      if (ev.figure) {
        var tmp = el("div");
        tmp.innerHTML = ev.figure;
        var fig = tmp.firstElementChild;
        if (fig) { fig.classList.add("cal__photo"); li.appendChild(fig); if (fig.hasAttribute("data-slides")) slideshow(fig); }
      }
      // A past event: its photos, "Past event" and its title only, without details or a link
      if (ev.past) {
        li.appendChild(el("span", "cal__count cal__count--past", countdown(ev)));
        li.appendChild(el("h4", "", ev.title));
        return li;
      }
      li.appendChild(el("span", "cal__count" + (ev.past ? " cal__count--past" : ""), countdown(ev)));
      li.appendChild(el("h4", "", ev.title));
      if (ev.summary) li.appendChild(el("p", "", ev.summary));
      var meta = el("p", "cal__meta");
      if (ev.time) meta.appendChild(el("span", "", ev.time));
      if (ev.location) meta.appendChild(el("span", "", ev.location));
      if (meta.childNodes.length) li.appendChild(meta);
      var a = el("a", "btn" + (ev.cta ? "" : " btn--light"), ev.cta || "Event details");
      a.href = ev.url;
      if (ev.cta) a.setAttribute("data-track", "registration_start");
      if (ev.cta) {
        var arrow = el("span", "btn__arrow", "↗");
        arrow.setAttribute("aria-hidden", "true");
        a.appendChild(doc.createTextNode(" "));
        a.appendChild(arrow);
      }
      if (ev.external) {
        a.target = "_blank"; a.rel = "noopener";
        a.appendChild(el("span", "sr-only", " (opens in a new tab)"));
      }
      li.appendChild(a);
      return li;
    };
    var drawPanel = function () {
      panel.textContent = "";
      var list = byDay[sel] || [];
      panel.appendChild(el("p", "cal__kicker", sel === todayIso ? "Today" : "Selected day"));
      panel.appendChild(el("h4", "cal__date", longDate(sel)));
      if (list.length) {
        var ul = el("ul", "cal__items");
        list.forEach(function (ev, i) { ul.appendChild(eventItem(ev, i)); });
        panel.appendChild(ul);
      } else {
        panel.appendChild(el("p", "cal__none", calEvents.length ? "Nothing is scheduled on this day." : "No events are scheduled yet. New dates appear here as soon as they are confirmed."));
      }
      // Next up: the next event after the chosen day (or after today, whichever is later)
      var from = sel > todayIso ? sel : todayIso;
      var next = upcoming.filter(function (ev) { return ev.first > from || (ev.first === from && from !== sel); })[0];
      if (next) {
        panel.appendChild(el("p", "cal__kicker", "Next up"));
        // A white card: the event's first photo, its countdown, its title as a heading and its date
        var jump = el("button", "cal__next");
        jump.type = "button";
        if (next.figure) {
          var tmpNext = el("div");
          tmpNext.innerHTML = next.figure;
          var img = tmpNext.querySelector("img");
          if (img) { var media = el("span", "cal__next-media"); img.removeAttribute("loading"); img.alt = ""; media.appendChild(img); jump.appendChild(media); }
        }
        var body = el("span", "cal__next-body");
        body.appendChild(el("span", "cal__count", countdown(next)));
        body.appendChild(el("span", "cal__next-title", next.title));
        body.appendChild(el("span", "cal__next-date", longDate(next.first)));
        jump.appendChild(body);
        jump.addEventListener("click", function () { select(next.first, true); });
        panel.appendChild(jump);
      } else if (!list.length && !upcoming.length) {
        var notify = el("a", "text-link", "Get notified about new dates");
        notify.href = "#notify";
        panel.appendChild(notify);
      }
    };
    var select = function (key, focus) {
      var dir = 0;
      if (!inView(key)) {
        dir = key > iso(view.y, view.m, 1) ? 1 : -1;
        view = { y: +key.slice(0, 4), m: +key.slice(5, 7) - 1 };
      }
      sel = key;
      draw(dir);
      drawPanel();
      if (focus) { var b = $('[data-date="' + key + '"]', grid); if (b) b.focus(); }
    };
    var turn = function (dir) {
      view.m += dir;
      if (view.m < 0) { view.m = 11; view.y--; } else if (view.m > 11) { view.m = 0; view.y++; }
      draw(dir);
    };
    grid.addEventListener("click", function (e) {
      var b = e.target.closest("[data-date]");
      if (b) select(b.getAttribute("data-date"), true);
    });
    grid.addEventListener("keydown", function (e) {
      var b = e.target.closest("[data-date]");
      if (!b) return;
      var key = b.getAttribute("data-date"), dow = noon(key).getUTCDay(), to = null;
      var moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -dow, End: 6 - dow };
      if (e.key in moves) to = shift(key, moves[e.key]);
      else if (e.key === "PageUp" || e.key === "PageDown") {
        var d = noon(key), m = d.getUTCMonth() + (e.key === "PageUp" ? -1 : 1);
        var y = d.getUTCFullYear() + Math.floor(m / 12); m = (m + 12) % 12;
        to = iso(y, m, Math.min(d.getUTCDate(), new Date(Date.UTC(y, m + 1, 0)).getUTCDate()));
      }
      if (!to) return;
      e.preventDefault();
      if (inView(to)) {
        b.tabIndex = -1;
        var t = $('[data-date="' + to + '"]', grid);
        t.tabIndex = 0;
        t.focus();
      } else {
        view = { y: +to.slice(0, 4), m: +to.slice(5, 7) - 1 };
        var keep = sel;
        sel = to; draw(to > key ? 1 : -1); sel = keep; // the tab stop lands on the target day
        $$("[data-date]", grid).forEach(function (n) { n.setAttribute("aria-pressed", n.getAttribute("data-date") === sel ? "true" : "false"); });
        $('[data-date="' + to + '"]', grid).focus();
      }
    });
    grid.addEventListener("focusin", function () { if (hint) hint.hidden = false; });
    $("[data-cal-prev]", cal).addEventListener("click", function () { turn(-1); });
    $("[data-cal-next]", cal).addEventListener("click", function () { turn(1); });
    $("[data-cal-today]", cal).addEventListener("click", function () { select(todayIso); });
    draw();
    drawPanel();
  }

  /* ---- 9. Testimonial photos ---------------------------------------------- */
  // A photo that cannot load is removed, so a card never shows a broken image.
  $$(".quote__photo").forEach(function (img) {
    var drop = function () { img.remove(); };
    if (img.complete && img.naturalWidth === 0) drop(); else img.addEventListener("error", drop);
  });

  /* ---- 10. Hero: node web wires ------------------------------------------ */
  // The home hero's node web (css/style.css, 5. Home: hero) runs the full width of the hero. One set
  // of branch shapes drives both the node positions and the lines, so the lines always pass through
  // their nodes. Left x values are fractions of the space between the edge and the left junction;
  // right x values, of the space between the right junction and the far edge; y values, of the web's
  // height. Lines are straight runs with softly rounded corners, each in its own weight and brand
  // colour (Pink, Yellow or Charcoal), drawn in one SVG across the hero and redrawn on resize. A twin
  // path carries the travelling signal, which CSS animates under .motion only.
  var hero = $(".hero");
  var web = hero && $(".hweb", hero);
  var hub = web && $(".hweb__hub", web);
  if (web && hub && window.SVGElement) {
    var NS = "http://www.w3.org/2000/svg";
    var TONES = ["239 172 186", "251 197 34", "26 26 26", "251 197 34", "239 172 186", "26 26 26", "251 197 34", "239 172 186"];
    var WEIGHTS = [1.75, 1.25, 1.5, 1, 2, 1.25, 1.5, 1];
    // [x, y] points from the edge inward; "J" is the junction. Nodes: [key, x, y] on those lines.
    var LEFT = [
      { pts: [[0, 0.14], [0.66, 0.14], [0.84, 0.3], "J"], nodes: [["a", 0.36, 0.14], ["b", 0.84, 0.3]] },
      { pts: [[0, 0.5], "J"], nodes: [["c", 0.22, 0.5], ["d", 0.56, 0.5]] },
      { pts: [[0, 0.86], [0.66, 0.86], [0.84, 0.7], "J"], nodes: [["e", 0.84, 0.7], ["f", 0.36, 0.86]] }
    ];
    var RIGHT = [0.12, 0.37, 0.63, 0.88].map(function (y, i) {
      return { pts: ["S", [0.22, 0.5], [0.22, y], [1, y]], nodes: [["ghij".charAt(i), 0.6, y]] };
    });
    var svg = doc.createElementNS(NS, "svg");
    svg.setAttribute("class", "hero__wires");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    web.insertBefore(svg, web.firstChild);
    var el = function (name, attrs) {
      var n = doc.createElementNS(NS, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    };
    var f = function (n) { return n.toFixed(1); };
    // a polyline with its corners rounded (radius r, or less where a segment is short)
    var rounded = function (pts, r) {
      var d = "M" + f(pts[0][0]) + " " + f(pts[0][1]);
      for (var i = 1; i < pts.length - 1; i++) {
        var p = pts[i - 1], c = pts[i], q = pts[i + 1];
        var l1 = Math.hypot(c[0] - p[0], c[1] - p[1]), l2 = Math.hypot(q[0] - c[0], q[1] - c[1]);
        var k = Math.min(r, l1 / 2, l2 / 2);
        var a = [c[0] - (c[0] - p[0]) / l1 * k, c[1] - (c[1] - p[1]) / l1 * k];
        var b = [c[0] + (q[0] - c[0]) / l2 * k, c[1] + (q[1] - c[1]) / l2 * k];
        d += "L" + f(a[0]) + " " + f(a[1]) + "Q" + f(c[0]) + " " + f(c[1]) + " " + f(b[0]) + " " + f(b[1]);
      }
      var z = pts[pts.length - 1];
      return d + "L" + f(z[0]) + " " + f(z[1]);
    };
    var drawWires = function () {
      var W = web.clientWidth, H = web.clientHeight;
      if (!W) return;
      var hubW = hub.offsetWidth, cy = H / 2;
      var reach = Math.max(28, Math.min(84, W * 0.05));
      var jx = W / 2 - hubW / 2 - 14 - reach, sx = W / 2 + hubW / 2 + 14 + reach;
      var L = function (pt) { return pt === "J" ? [jx, cy] : [pt[0] * jx, pt[1] * H]; };
      var R = function (pt) { return pt === "S" ? [sx, cy] : [sx + pt[0] * (W - sx), pt[1] * H]; };
      var defs = el("defs", {});
      var paths = [];
      var n = 0;
      var line = function (pts, inward) {
        var i = n++, tone = TONES[i % TONES.length], ink = tone === "26 26 26", w = WEIGHTS[i % WEIGHTS.length];
        var a = pts[0], z = pts[pts.length - 1], d = rounded(pts, 22);
        var grad = el("linearGradient", { id: "hweb-g" + i, gradientUnits: "userSpaceOnUse", x1: a[0], y1: a[1], x2: z[0], y2: z[1] });
        grad.appendChild(el("stop", { offset: "0", "stop-color": "rgb(" + tone + " / " + (ink ? (inward ? 0.14 : 0.38) : (inward ? 0.45 : 0.95)) + ")" }));
        grad.appendChild(el("stop", { offset: "1", "stop-color": "rgb(" + tone + " / " + (ink ? (inward ? 0.38 : 0.14) : (inward ? 0.95 : 0.45)) + ")" }));
        defs.appendChild(grad);
        paths.push(el("path", { class: "hweb__wire", d: d, stroke: "url(#hweb-g" + i + ")", "stroke-width": w }));
        paths.push(el("path", { class: "hweb__pulse", d: d, pathLength: "1", stroke: "rgb(" + (ink ? "239 172 186" : tone) + ")",
          "stroke-width": w + 1.25, style: "--delay:" + (1.6 + i * 0.7).toFixed(1) + "s" }));
        return tone;
      };
      var place = function (key, xy, tone) {
        var node = $(".hweb__node[data-k='" + key + "']", web);
        if (!node) return;
        node.style.left = f(xy[0]) + "px";
        node.style.top = f(xy[1]) + "px";
        var dot = $(".hweb__dot", node), ink = tone === "26 26 26";
        // the node glows softly in its line's colour (css: .hweb__dot --glow)
        dot.style.setProperty("--glow", tone);
        dot.style.setProperty("--glow-a", ink ? "0.08" : "0.22");
        dot.style.setProperty("--edge-a", ink ? "0.16" : "0.6");
      };
      LEFT.forEach(function (b) {
        var tone = line(b.pts.map(L), true);
        b.nodes.forEach(function (nd) { place(nd[0], L([nd[1], nd[2]]), tone); });
      });
      line([[jx, cy], [W / 2 - hubW / 2 - 12, cy]], true);
      line([[W / 2 + hubW / 2 + 12, cy], [sx, cy]], false);
      RIGHT.forEach(function (b) {
        var tone = line(b.pts.map(R), false);
        b.nodes.forEach(function (nd) { place(nd[0], R([nd[1], nd[2]]), tone); });
      });
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.appendChild(defs);
      paths.forEach(function (p) { svg.appendChild(p); });
      svg.appendChild(el("circle", { class: "hweb__junction", cx: jx, cy: cy, r: 6, fill: "rgb(26 26 26)" }));
      svg.appendChild(el("circle", { class: "hweb__junction", cx: sx, cy: cy, r: 6, fill: "rgb(26 26 26)" }));
    };
    var queued = 0;
    var redraw = function () { if (!queued) queued = requestAnimationFrame(function () { queued = 0; drawWires(); }); };
    drawWires();
    if ("ResizeObserver" in window) new ResizeObserver(redraw).observe(web);
    else window.addEventListener("resize", redraw, { passive: true });
  }

  /* ---- 11. Logo strip pause ----------------------------------------------- */
  // The "Trusted by" strip loops in CSS (css/style.css §10b); this only reveals its Pause/Play
  // button, so the motion can be stopped without hovering. Reduced motion: the strip is still.
  $$("[data-logo-toggle]").forEach(function (btn) {
    var box = btn.closest(".trusted");
    if (!box || reduceMotion) return;
    btn.hidden = false;
    btn.addEventListener("click", function () {
      var paused = box.classList.toggle("is-paused");
      btn.setAttribute("aria-pressed", String(paused));
    });
  });

  /* ---- 12. Testimonial carousel -------------------------------------------- */
  // A stack of cards. The active card lies on top and the next two are tucked behind it, turned a
  // little, their edges showing below; the rest wait out of sight at the back. Each card's place in
  // the pile is data-depth (0 on top, 1, 2, then "far"); the CSS sets the look and glides between
  // places. Moving on, the top card swings out to the right and slips to the back of the pile;
  // moving back, the card from the back swings in from the right onto the top (the .is-out and
  // .is-in keyframes). The stack moves on by itself every few seconds, and pauses while it is
  // hovered, focused, dragged, off screen or in a background tab; the buttons, dragging the top card
  // off and the arrow keys flip through it, and any of them starts the wait again. Reduced motion: no autoplay,
  // and cards change place without the swing. Without JS: the scroll-snap row.
  $$("[data-carousel]").forEach(function (box) {
    var track = $(".voices__track", box);
    var slides = $$("[data-slide]", box);
    var n = slides.length;
    if (!track || n < 2) return;
    var count = $("[data-carousel-count]", box);
    var DWELL = 6500, i = 0, timer = 0;
    var hold = { hover: false, focus: false, away: true, hidden: doc.hidden, drag: false };
    var wrap = function (x) { return ((x % n) + n) % n; };
    var held = function () { for (var key in hold) if (hold[key]) return true; return false; };

    var paint = function () {
      slides.forEach(function (s, j) {
        var d = wrap(j - i);
        s.setAttribute("data-depth", d < 3 ? String(d) : "far");
        s.style.zIndex = String(n - d);
        s.classList.toggle("is-active", d === 0);
        s.setAttribute("aria-hidden", String(d !== 0));
      });
      if (count) count.textContent = (i + 1) + " / " + n;
    };
    var schedule = function () {
      clearTimeout(timer);
      if (!reduceMotion && !held()) timer = setTimeout(function () { go(1); }, DWELL);
    };
    var pause = function (key, on) {
      if (hold[key] === on) return;
      hold[key] = on;
      schedule();
    };
    // One card on (dir 1) or back (dir -1). The card that swings is the one leaving the top going
    // forward, or the one arriving on top going back.
    var go = function (dir, thrown) {
      var leaving = slides[i];
      i = wrap(i + dir);
      if (!reduceMotion && !thrown) {
        var card = dir > 0 ? leaving : slides[i];
        slides.forEach(function (s) { s.classList.remove("is-out", "is-in"); });
        void card.offsetWidth; // restart the swing if the same card swings twice in a row
        card.classList.add(dir > 0 ? "is-out" : "is-in");
      }
      paint();
      schedule();
    };
    slides.forEach(function (s) {
      s.addEventListener("animationend", function () { s.classList.remove("is-out", "is-in"); });
    });

    var prev = $("[data-carousel-prev]", box), next = $("[data-carousel-next]", box);
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
    track.addEventListener("keydown", function (e) {
      var dir = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      go(dir);
    });
    // Drag: the top card follows the pointer, turning a little as it goes, and the cards under it
    // rise toward their next places as it moves aside, the next quote fading up on the card below.
    // Let go past a quarter of the card's width (or with a quick flick) and it is thrown off that
    // side, still showing its words, fading as it goes, and then turns up at the back of the pile;
    // let go short of that and everything settles back. The track has touch-action: pan-y, so a
    // vertical swipe still scrolls the page (pointercancel).
    // Each place in the pile as [x as a share of the card's width, y px, turn deg, scale, opacity]:
    // the same values as the data-depth rules in css/style.css.
    var POSE = [[0, 0, 0, 1, 1], [-0.015, 26, -1.8, 0.96, 1], [0.015, 48, 1.6, 0.92, 1], [0, 60, 0, 0.88, 0]];
    var drag = null, flying = null;
    var mix = function (a, b, p) { return a + (b - a) * p; };
    // The cards under the top one, as [card, its place now]: up to three of them.
    var under = function () {
      var list = [];
      for (var k = 1; k < Math.min(4, n); k++) list.push([slides[wrap(i + k)], k]);
      return list;
    };
    var unstyle = function (s) {
      ["transition", "transform", "opacity", "visibility", "--reveal"].forEach(function (p) { s.style.removeProperty(p); });
    };
    var land = function () { // the thrown card, now out of sight, joins the back of the pile
      if (!flying) return;
      var s = flying.card;
      clearTimeout(flying.timer);
      flying = null;
      s.style.transition = "none";
      s.style.removeProperty("transform");
      s.style.removeProperty("--reveal");
      paint();
      void s.offsetWidth;
      unstyle(s); // fades in where it now sits
    };
    var release = function (e, cancel) {
      if (!drag || e.pointerId !== drag.id) return;
      var card = drag.card, rest = drag.rest, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      var w = card.offsetWidth || 1, fast = Math.abs(e.clientX - drag.sx) / Math.max(1, e.timeStamp - drag.st) > 0.5;
      var moved = drag.moved;
      drag = null;
      track.classList.remove("is-dragging");
      pause("drag", false);
      if (!moved) return;
      rest.forEach(function (r) { unstyle(r[0]); }); // they glide on, or back, from where the drag left them
      if (cancel || !(Math.abs(dx) > w / 4 || (fast && Math.abs(dx) > 30))) { unstyle(card); return; }
      if (reduceMotion) { unstyle(card); go(1, true); return; }
      var side = dx < 0 ? -1 : 1;
      go(1, true);
      card.style.zIndex = String(n + 1);
      card.style.setProperty("--reveal", "1");
      card.style.visibility = "visible";
      card.style.transition = "transform 0.5s var(--ease-out), opacity 0.4s ease-in 0.1s";
      card.style.transform = "translate(" + side * (w * 0.9 + Math.abs(dx) * 0.4) + "px, " + (dy * 0.2 + 40) + "px) rotate(" + side * 16 + "deg)";
      card.style.opacity = "0";
      flying = { card: card, timer: setTimeout(land, 500) };
    };
    track.addEventListener("pointerdown", function (e) {
      if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
      land();
      var card = slides[i];
      if (!card.contains(e.target)) return;
      card.classList.remove("is-out", "is-in");
      drag = { id: e.pointerId, card: card, x: e.clientX, y: e.clientY, sx: e.clientX, st: e.timeStamp, moved: false, rest: [] };
    });
    track.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y, w = drag.card.offsetWidth || 1;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        track.setPointerCapture(e.pointerId);
        track.classList.add("is-dragging");
        pause("drag", true);
        drag.rest = under();
        drag.card.style.transition = "none";
        drag.rest.forEach(function (r) {
          r[0].classList.remove("is-out", "is-in");
          r[0].style.transition = "none";
          r[0].style.visibility = "visible";
        });
      }
      if (e.timeStamp - drag.st > 80) { drag.sx = e.clientX; drag.st = e.timeStamp; } // flick speed: last ~80ms
      drag.card.style.transform = "translate(" + dx + "px, " + dy * 0.2 + "px) rotate(" + dx / w * 12 + "deg)";
      var p = Math.min(1, Math.abs(dx) / (w * 0.5));
      drag.rest.forEach(function (r) {
        var a = POSE[r[1]], b = POSE[r[1] - 1], s = r[0];
        s.style.transform = "translate(" + mix(a[0], b[0], p) * w + "px, " + mix(a[1], b[1], p) + "px) rotate(" + mix(a[2], b[2], p) + "deg) scale(" + mix(a[3], b[3], p) + ")";
        s.style.opacity = String(mix(a[4], b[4], p));
        if (r[1] === 1) s.style.setProperty("--reveal", String(p));
      });
    });
    track.addEventListener("pointerup", function (e) { release(e, false); });
    track.addEventListener("pointercancel", function (e) { release(e, true); });
    track.addEventListener("dragstart", function (e) { e.preventDefault(); });

    box.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pause("hover", true); });
    box.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") pause("hover", false); });
    box.addEventListener("focusin", function () { pause("focus", true); });
    box.addEventListener("focusout", function (e) { if (!box.contains(e.relatedTarget)) pause("focus", false); });
    doc.addEventListener("visibilitychange", function () { pause("hidden", doc.hidden); });
    new IntersectionObserver(function (entries) { pause("away", !entries[0].isIntersecting); }, { threshold: 0.35 }).observe(box);

    box.classList.add("is-ready", "is-stack");
    paint();
  });

  /* ---- 13. Video (click to load) and booking ------------------------------- */
  // Nothing from YouTube, Vimeo or Calendly loads until the visitor asks for it.
  $$("[data-video-embed]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var frame = doc.createElement("iframe");
      frame.src = btn.getAttribute("data-video-embed");
      frame.title = btn.getAttribute("data-video-title") || "Video";
      frame.allow = "autoplay; fullscreen; picture-in-picture";
      frame.allowFullscreen = true;
      frame.loading = "lazy";
      frame.className = "video__frame";
      btn.replaceWith(frame);
      track("video_play", { video: frame.src });
    });
  });
  $$("[data-booking]").forEach(function (link) {
    var dialog = doc.getElementById(link.getAttribute("aria-controls"));
    if (!dialog || typeof dialog.showModal !== "function") return; // the plain link still works
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var slot = $("[data-booking-slot]", dialog);
      if (slot && !slot.firstChild) {
        var frame = doc.createElement("iframe");
        frame.src = link.getAttribute("data-booking");
        frame.title = "Book a call with Faith Works";
        frame.className = "booking__frame";
        slot.appendChild(frame);
      }
      dialog.showModal();
      track("booking_open", { link_url: link.getAttribute("href") });
    });
    $$("[data-booking-close]", dialog).forEach(function (b) { b.addEventListener("click", function () { dialog.close(); }); });
    dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  });

  /* ---- 13b. Forms as a bottom sheet on phones ------------------------------ */
  // On phones each GHL form (.form--ghl) waits off screen as a bottom sheet; an "Open the form"
  // button in its place, or any link to its section, slides it up. The iframe never moves in the
  // page, so GHL's loading, validation and submission are untouched. Tablets and desktops keep
  // the inline form (css/style.css §21). Close: the X, the backdrop or Escape.
  var sheetMq = window.matchMedia("(max-width: 640px)");
  var sheetOpen = null;
  var sheetBackdrop = null;
  var sheetOpener = null;
  function closeSheet() {
    if (!sheetOpen) return;
    var form = sheetOpen;
    sheetOpen = null;
    form.classList.remove("is-open");
    form.removeAttribute("role");
    form.removeAttribute("aria-modal");
    sheetBackdrop.classList.remove("is-open");
    doc.documentElement.classList.remove("has-sheet");
    // focus goes back to whatever opened the sheet: the button in place or a link higher up
    if (sheetOpener) sheetOpener.focus({ preventScroll: true });
    sheetOpener = null;
  }
  function openSheet(form, opener) {
    if (!sheetMq.matches) return false;
    if (sheetOpen && sheetOpen !== form) closeSheet();
    sheetOpen = form;
    sheetOpener = opener || form._sheetTrigger;
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-modal", "true");
    form.classList.add("is-open");
    sheetBackdrop.classList.add("is-open");
    doc.documentElement.classList.add("has-sheet");
    $(".form-sheet__close", form).focus({ preventScroll: true });
    track("form_sheet_open", { form: (form.querySelector("iframe") || {}).title || "" });
    return true;
  }
  var sheetForms = $$(".form--ghl");
  if (sheetForms.length) {
    sheetBackdrop = doc.createElement("div");
    sheetBackdrop.className = "form-sheet__backdrop";
    sheetBackdrop.addEventListener("click", closeSheet);
    doc.body.appendChild(sheetBackdrop);
    sheetForms.forEach(function (form) {
      var frame = form.querySelector("iframe");
      form.classList.add("form-sheet");
      form.setAttribute("aria-label", (frame && frame.title) || "Form");
      var close = doc.createElement("button");
      close.type = "button";
      close.className = "form-sheet__close";
      close.setAttribute("aria-label", "Close the form");
      close.innerHTML = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      close.addEventListener("click", closeSheet);
      form.insertBefore(close, form.firstChild);
      var open = doc.createElement("button");
      open.type = "button";
      open.className = "btn form-sheet__open";
      // the page's own call to action for this form ("Register your interest"…), so the
      // wording matches; the arrow points up, the way the sheet arrives
      var section = form.parentNode.closest("[id]");
      var cta = section && $('a.btn[href="#' + section.id + '"]');
      var label = cta ? cta.firstChild.textContent.trim() : "";
      open.innerHTML = (label || "Open the form") + ' <span class="btn__arrow btn__arrow--up" aria-hidden="true">↑</span>';
      open.addEventListener("click", function () { openSheet(form, open); });
      form.parentNode.insertBefore(open, form);
      form._sheetTrigger = open;
    });
    // "Register your interest", "Request a proposal"…: links to a form's section open its sheet
    doc.addEventListener("click", function (e) {
      var link = e.target.closest && e.target.closest('a[href^="#"]');
      if (!link || !sheetMq.matches) return;
      var id = link.getAttribute("href").slice(1);
      var target = id && doc.getElementById(id);
      var form = target && (target.matches(".form--ghl") ? target : target.querySelector(".form--ghl"));
      if (form && openSheet(form, link)) e.preventDefault();
    });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
    // Rotating to a wider screen puts the form back inline
    sheetMq.addEventListener("change", function (e) { if (!e.matches) closeSheet(); });
  }

  /* ---- 14. Article contents ----------------------------------------------- */
  // The sidebar built from the article's headings (tools/render.mjs withToc): marks the section
  // being read and fills a reading-progress line. On narrower screens the list starts folded.
  var toc = $("[data-toc]");
  if (toc) {
    var tocLinks = $$(".toc__link", toc);
    var tocHeads = tocLinks.map(function (a) { return doc.getElementById(decodeURIComponent(a.hash.slice(1))); });
    var tocBar = $("[data-toc-progress]", toc), tocBody = $(".article__body");
    var narrow = window.matchMedia("(max-width: 1024px)");
    if (narrow.matches) toc.open = false;
    var keepOpen = function (e) { if (!e.matches) toc.open = true; };
    if (narrow.addEventListener) narrow.addEventListener("change", keepOpen); else if (narrow.addListener) narrow.addListener(keepOpen);
    var tocTicking = false;
    var tocUpdate = function () {
      tocTicking = false;
      var line = Math.min(window.innerHeight * 0.3, 200), active = -1;
      tocHeads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top <= line) active = i; });
      tocLinks.forEach(function (a, i) {
        a.classList.toggle("is-active", i === active);
        if (i === active) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
      });
      if (tocBar && tocBody) {
        var r = tocBody.getBoundingClientRect(), span = r.height - window.innerHeight * 0.6;
        tocBar.parentNode.style.setProperty("--read", Math.max(0, Math.min(1, span > 0 ? -r.top / span : 1)).toFixed(3));
      }
    };
    var tocQueue = function () { if (!tocTicking) { tocTicking = true; requestAnimationFrame(tocUpdate); } };
    window.addEventListener("scroll", tocQueue, { passive: true });
    window.addEventListener("resize", tocQueue);
    tocLinks.forEach(function (a) {
      a.addEventListener("click", function () { if (narrow.matches) toc.open = false; });
    });
    tocUpdate();
  }

  /* ---- 15. Resource search and type filters (resources) ------------------- */
  // The search box and chips stay hidden without JS, so every resource is listed. A card shows
  // when it has the chosen type and every word typed appears in its title, summary or labels.
  var rTools = $("[data-rcards-tools]");
  if (rTools) {
    var rCards = $$("[data-rcards-list] > li"), rNone = $("[data-rcards-none]"), rSearch = $("[data-rcards-search]", rTools);
    var rChips = $$("[data-type]", rTools), rType = "", rTimer;
    rTools.hidden = false;
    var rApply = function () {
      var words = rSearch.value.toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
      rCards.forEach(function (card) {
        var text = card.getAttribute("data-search") || "";
        var match = (!rType || card.getAttribute("data-type") === rType) && words.every(function (w) { return text.indexOf(w) >= 0; });
        card.hidden = !match;
        if (match) shown++;
      });
      if (rNone) rNone.hidden = shown > 0;
    };
    rChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        rType = chip.getAttribute("data-type");
        rChips.forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
        rApply();
        track("resource_filter", { type: rType || "all" });
      });
    });
    rSearch.addEventListener("input", function () {
      rApply();
      clearTimeout(rTimer);
      // One event per pause in typing; the words themselves are never sent
      rTimer = setTimeout(function () { if (rSearch.value.trim()) track("resource_search", {}); }, 1200);
    });
  }

  /* ---- 16. Share this (articles) ------------------------------------------ */
  // Facebook and LinkedIn are plain links. Instagram has no share link: phones get the share
  // sheet, other browsers copy the link with a note to paste it into Instagram.
  var shareBar = $("[data-share-bar]");
  if (shareBar) {
    var shareUrl = shareBar.getAttribute("data-url"), shareTitle = shareBar.getAttribute("data-title");
    var shareNote = $("[data-share-note]", shareBar), shareTimer;
    var say = function (text) {
      shareNote.textContent = text;
      clearTimeout(shareTimer);
      shareTimer = setTimeout(function () { shareNote.textContent = ""; }, 4000);
    };
    var copyLink = function (done) {
      var ok = function () { say(done); };
      var fail = function () { say("Copy this link: " + shareUrl); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(shareUrl).then(ok, fail);
      else fail();
    };
    $$("[data-share]", shareBar).forEach(function (el) {
      var net = el.getAttribute("data-share");
      el.addEventListener("click", function (e) {
        track("share_click", { network: net });
        if (net === "copy") copyLink("Link copied.");
        else if (net === "instagram") {
          if (navigator.share && window.matchMedia("(pointer: coarse)").matches) navigator.share({ title: shareTitle, url: shareUrl }).catch(function () {});
          else copyLink("Link copied. Paste it into your Instagram story or bio.");
        } else if (net === "facebook" || net === "linkedin") {
          // A small share window; the link still works if pop-ups are blocked
          var w = window.open(el.href, "fw-share", "width=600,height=640");
          if (w) { w.opener = null; e.preventDefault(); }
        }
      });
    });
  }

  /* ---- 16b. Stat reveals --------------------------------------------------- */
  // For Professionals record cards: hover and keyboard focus reveal each card's link or flags in
  // CSS; a tap (touch has no hover) toggles one card open, and a tap elsewhere closes it.
  var stats = $$("[data-stat]");
  stats.forEach(function (card) {
    card.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var open = !card.classList.contains("is-open");
      stats.forEach(function (c) { c.classList.remove("is-open"); });
      card.classList.toggle("is-open", open);
    });
  });
  if (stats.length) {
    doc.addEventListener("click", function (e) {
      if (!e.target.closest("[data-stat]")) stats.forEach(function (c) { c.classList.remove("is-open"); });
    });
  }

  /* ---- 17. Card pager ------------------------------------------------------ */
  // A scroll-snap row that pages a whole view of cards at a time (two on desktop, one on small
  // screens; CSS decides how many fit). Swipe and trackpad scrolling stay native; the arrows and
  // the arrow keys step one page, and the count and progress line follow wherever the row is.
  $$("[data-pager]").forEach(function (box) {
    var track = $("[data-pager-track]", box);
    var cards = track ? $$(":scope > li", track) : [];
    var n = cards.length;
    if (n < 2) return;
    var prev = $("[data-pager-prev]", box), next = $("[data-pager-next]", box);
    var count = $("[data-pager-count]", box), live = $("[data-pager-live]", box);
    var bar = $("[data-pager-progress]", box);
    var per = 1, page = -1, frame = 0;
    var pad = function (k) { return (k < 10 ? "0" : "") + k; };
    var pages = function () { return Math.ceil(n / per); };
    var label = function (p) {
      var a = p * per + 1, b = Math.min(n, a + per - 1);
      return a === b ? pad(a) : pad(a) + "–" + pad(b);
    };
    var update = function () {
      frame = 0;
      var step = cards[1].offsetLeft - cards[0].offsetLeft;
      per = Math.max(1, Math.round((track.clientWidth + step - cards[0].offsetWidth) / step));
      // The page whose first card is nearest the left edge; the last page also counts once the row
      // can scroll no further (an odd card count can't snap its last page flush left)
      var p = Math.round(track.scrollLeft / (step * per));
      if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) p = pages() - 1;
      p = Math.max(0, Math.min(pages() - 1, p));
      page = p;
      if (count) count.textContent = label(p);
      if (bar) { bar.style.width = (100 * per / n) + "%"; box.style.setProperty("--page", p); }
      if (prev) prev.setAttribute("aria-disabled", String(p === 0));
      if (next) next.setAttribute("aria-disabled", String(p === pages() - 1));
    };
    var queue = function () { if (!frame) frame = requestAnimationFrame(update); };
    var go = function (dir) {
      var p = Math.max(0, Math.min(pages() - 1, page + dir));
      if (p === page) return;
      track.scrollTo({ left: cards[p * per].offsetLeft - cards[0].offsetLeft, behavior: reduceMotion ? "auto" : "smooth" });
      if (live) live.textContent = "Showing " + label(p).replace("–", " to ") + " of " + pad(n);
    };
    if (prev) prev.addEventListener("click", function () { go(-1); });
    if (next) next.addEventListener("click", function () { go(1); });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); go(e.key === "ArrowLeft" ? -1 : 1); }
    });
    track.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    update();
  });

  /* ---- 19. Event buttons after the event ---------------------------------- */
  // Registration buttons carry the event's end (data-event-end, from the build). A page built
  // before the event ended drops them once it is over (on a card, with its "Event details" link,
  // as past cards have none); the next daily rebuild does the same on the server.
  $$("[data-event-end]").forEach(function (btn) {
    if (!(Date.parse(btn.getAttribute("data-event-end")) <= Date.now())) return;
    var box = btn.parentNode;
    btn.remove();
    if (box && box.classList.contains("event__cta")) box.remove();
  });

  /* ---- 20. Event photo slideshows ------------------------------------------- */
  // Event cards with several photos: Previous/Next buttons (and the arrow keys while focus is in
  // the slideshow) show one photo at a time, wrapping round; the count is announced politely.
  // The calendar panel (§8) runs the same for the photos it shows.
  $$("[data-slides]").forEach(slideshow);
  function slideshow(box) {
    var slides = $$("[data-slide]", box), nav = $("[data-slides-nav]", box), count = $("[data-slide-count]", box);
    if (slides.length < 2 || !nav) return;
    var at = 0;
    var show = function (i) {
      at = (i + slides.length) % slides.length;
      slides.forEach(function (img, k) {
        if (k === at) { img.removeAttribute("hidden"); img.removeAttribute("loading"); } else img.setAttribute("hidden", "");
      });
      if (count) count.textContent = (at + 1) + " / " + slides.length;
    };
    nav.hidden = false;
    $("[data-slide-prev]", box).addEventListener("click", function () { show(at - 1); });
    $("[data-slide-next]", box).addEventListener("click", function () { show(at + 1); });
    box.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      show(at + (e.key === "ArrowLeft" ? -1 : 1));
    });
  }

  window.__fwReady = true;
})();


/* ---- js/main.js ---- */
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
  // Wide, tall screens: .is-live turns the section into a scroll story (css/style.css §2). The
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
      // The frame keeps one height (css/style.css), at least the tallest output's, which also
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
        story.setAttribute("data-active", i); // the frame's gradient, one per case (css/style.css)
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
  // .is-active lets css/style.css tick the approval in last. Only a card below the fold waits.
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
  // section into a scroll story (css/style.css §4). The step crossing the middle of the
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
        journey.setAttribute("data-active", i); // the stage's gradient, one per step (css/style.css)
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


/* ---- js/main.js ---- */
/* ==========================================================================
   Faith Works — lead forms (brief §5 required form behavior, §12 states, §14)
   - Visible labels, required checks, accessible errors (field + summary)
   - Duplicate-submit protection, honeypot + time trap for spam
   - Hidden context: source page, UTMs, offer ID, timestamp, request ID
     (idempotency key, reused on retry), consent state + wording version
   - Success only after the destination confirms storage; on failure the
     entries stay and a retry/contact option is shown. Never a false success.
   - preview mode (staging): validates and shows what would be recorded,
     states plainly that nothing was sent.
   ========================================================================== */
(function () {
  "use strict";
  var doc = document;
  var cfg = window.FW_CONFIG || { forms: { mode: "preview" } };
  var track = window.fwTrack || function () {};
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function store(get, key, value) {
    try { return get ? sessionStorage.getItem(key) : sessionStorage.setItem(key, value); } catch (e) { return null; }
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "r-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  // Keep campaign tags for the session, so a lead keeps its source after navigating
  var params = new URLSearchParams(location.search);
  var utm = {};
  try { utm = JSON.parse(store(true, "fw_utm") || "{}"); } catch (e) { utm = {}; }
  if (UTM_KEYS.some(function (k) { return params.get(k); })) {
    utm = {};
    UTM_KEYS.forEach(function (k) { if (params.get(k)) utm[k] = params.get(k).slice(0, 200); });
    store(false, "fw_utm", JSON.stringify(utm));
  }

  function labelOf(input) {
    var l = doc.querySelector('label[for="' + input.id + '"]');
    return l ? l.textContent.replace(/\(optional\)/, "").trim() : input.name;
  }

  function validate(input) {
    var v = (input.value || "").trim();
    var name = labelOf(input);
    if (input.type === "checkbox") return "";
    if (input.required && !v) return "Enter your " + name.toLowerCase() + ".";
    if (!v) return "";
    if (input.type === "email" && !EMAIL.test(v)) return "Enter a valid email address, like name@example.com.";
    if (input.type === "number" && (isNaN(Number(v)) || Number(v) < Number(input.min || 0))) return "Enter a number for " + name.toLowerCase() + ".";
    if (input.maxLength > 0 && v.length > input.maxLength) return "Keep " + name.toLowerCase() + " under " + input.maxLength + " characters.";
    return "";
  }

  function showError(input, msg) {
    var err = doc.getElementById(input.id + "-error");
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) { err.textContent = msg; err.hidden = !msg; }
  }

  function init(form) {
    var key = form.getAttribute("data-fw-form");
    var fields = $$("input:not([type=hidden]):not([name=website]), select, textarea", form);
    var submit = $(".form__submit", form);
    var label = $(".form__label", form);
    var summary = $(".form__summary", form);
    var status = $(".form__status", form);
    var started = false;
    var renderedAt = Date.now();
    var requestId = uuid();

    // Prefill from links: /contact/?type=corporate, /workshops/?event=<id>#notify
    var type = params.get("type");
    var typeSelect = $("select[name=inquiry_type]", form);
    if (type && typeSelect && $('option[value="' + type + '"]', typeSelect)) typeSelect.value = type;
    var ev = params.get("event");
    var evSelect = $("select[name=event_interest]", form);
    if (ev && evSelect && $('option[value="' + ev + '"]', evSelect)) evSelect.value = ev;

    form.addEventListener("input", function (e) {
      if (!started) { started = true; track("form_start", { form_id: key, offer_id: form.getAttribute("data-offer-id") }); }
      if (e.target.getAttribute("aria-invalid") === "true") showError(e.target, validate(e.target));
    });
    fields.forEach(function (f) {
      f.addEventListener("blur", function () { if (f.value.trim()) showError(f, validate(f)); });
    });

    function setBusy(busy) {
      form.setAttribute("aria-busy", String(busy));
      submit.disabled = busy;
      label.textContent = busy ? "Sending…" : submit.getAttribute("data-label");
    }
    submit.setAttribute("data-label", label.textContent);

    function payload() {
      var data = {};
      new FormData(form).forEach(function (value, name) {
        if (name === "website") return;
        data[name] = String(value).trim();
      });
      if (data.email) data.email = data.email.toLowerCase();
      var consent = $("input[name=consent_marketing]", form);
      return {
        form_id: key,
        request_id: requestId,
        offer_id: form.getAttribute("data-offer-id"),
        offer_title: form.getAttribute("data-offer-title"),
        source_page: location.pathname,
        submitted_at: new Date().toISOString(),
        utm: utm,
        // Spam signals the server records (it never trusts the browser's own checks alone)
        hp: $("input[name=website]", form).value,
        elapsed_ms: Date.now() - renderedAt,
        consent: consent ? {
          marketing: consent.checked ? "yes" : "no",
          wording: consent.checked ? $('label[for="' + consent.id + '"]', form).textContent.trim() : null,
          wording_version: cfg.consentWordingVersion,
          recorded_at: new Date().toISOString()
        } : null,
        fields: data
      };
    }

    function message(kind, html) {
      status.className = "form__status form__status--" + kind;
      status.innerHTML = html;
      if (kind !== "busy") { status.setAttribute("tabindex", "-1"); status.focus({ preventScroll: false }); }
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.getAttribute("aria-busy") === "true") return; // double-click / rapid repeat

      // Spam: honeypot filled, or submitted faster than a person can type
      if ($("input[name=website]", form).value) return;
      if (Date.now() - renderedAt < 2500) {
        message("error", "<p>Please take a moment to check your details, then send again.</p>");
        renderedAt = 0;
        return;
      }

      var errors = [];
      fields.forEach(function (f) {
        var msg = validate(f);
        showError(f, msg);
        if (msg) errors.push({ id: f.id, msg: msg });
      });
      if (errors.length) {
        summary.innerHTML = "<p><strong>Please check " + (errors.length === 1 ? "1 field" : errors.length + " fields") + ":</strong></p><ul>" +
          errors.map(function (x) { return '<li><a href="#' + x.id + '">' + x.msg + "</a></li>"; }).join("") + "</ul>";
        summary.hidden = false;
        summary.focus();
        return;
      }
      summary.hidden = true;
      var body = payload();

      if ((cfg.forms || {}).mode !== "endpoint" || !cfg.forms.endpoint) {
        var rows = Object.keys(body.fields).map(function (k) { return "<li><code>" + k + "</code>: " + escapeHtml(body.fields[k] || "(empty)") + "</li>"; }).join("");
        var redirect = form.getAttribute("data-redirect");
        message("preview",
          "<p><strong>Preview only. Nothing was sent.</strong> This staging form is not connected to the CRM yet, so your details were not stored and no email will arrive.</p>" +
          "<details><summary>What would be recorded</summary><ul>" + rows +
          "<li><code>offer_id</code>: " + escapeHtml(body.offer_id) + "</li><li><code>source_page</code>: " + escapeHtml(body.source_page) + "</li>" +
          "<li><code>utm</code>: " + escapeHtml(JSON.stringify(body.utm)) + "</li>" +
          (body.consent ? "<li><code>consent_marketing</code>: " + body.consent.marketing + " (" + escapeHtml(body.consent.wording_version) + ")</li>" : "") +
          "<li><code>request_id</code>: " + body.request_id + "</li></ul></details>" +
          (redirect ? '<p><a class="text-link" href="' + redirect + '">Preview the thank-you page</a></p>' : ""));
        return;
      }

      setBusy(true);
      message("busy", "<p>Sending your request…</p>");
      var ctrl = "AbortController" in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, cfg.forms.timeoutMs || 15000);
      fetch(cfg.forms.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": body.request_id },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
        credentials: "same-origin"
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          if (!res.ok || !json.ok) { var err = new Error("not stored"); err.status = res.status; err.body = json; throw err; }
          return json;
        });
      }).then(function (json) {
        clearTimeout(timer);
        track("lead_created", { form_id: key, offer_id: body.offer_id });
        if (key === "corporate_inquiry") track("corporate_inquiry", { offer_id: body.offer_id });
        var redirect = form.getAttribute("data-redirect");
        if (redirect) {
          location.assign(redirect + (json.delivery === "pending" ? "?delivery=pending" : ""));
          return;
        }
        form.classList.add("is-done");
        message("success", "<h3>" + escapeHtml(form.getAttribute("data-success")) + "</h3>" +
          "<p>Your request: <strong>" + escapeHtml(body.offer_title) + "</strong>.</p>");
        requestId = uuid();
      }).catch(function (err) {
        clearTimeout(timer);
        setBusy(false);
        // The server checks the same rules; show its field messages where they belong
        var invalid = err && err.status === 422 && err.body && err.body.error && err.body.error.fields;
        if (invalid && invalid.length) {
          invalid.forEach(function (x) { var input = doc.getElementById(key + "-" + x.field); if (input) showError(input, x.message); });
          message("error", "<p><strong>Please check the highlighted fields, then send again.</strong></p>");
          return;
        }
        if (err && err.status === 429) {
          message("error", "<p><strong>We received several requests from your connection.</strong> Please wait a few minutes, then try again.</p>" +
            '<p>Or email <a href="mailto:' + cfg.contactEmail + '">' + cfg.contactEmail + "</a>.</p>");
          return;
        }
        message("error", "<p><strong>We could not complete your request. Please try again.</strong> Your details are still in the form.</p>" +
          '<p>If it keeps failing, email <a href="mailto:' + cfg.contactEmail + '">' + cfg.contactEmail + "</a>.</p>");
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  $$("form[data-fw-form]").forEach(init);
})();


/* ---- js/main.js ---- */
/* ==========================================================================
   Faith Works — homepage redesign (review route /home-redesign/ only)
   Loaded after js/main.js and js/main.js (deferred, in order), so GSAP and ScrollTrigger are
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


