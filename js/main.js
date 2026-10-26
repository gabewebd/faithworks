/* ==========================================================================
   Faith Works — site interactions (every page)
   1. Helpers  2. Motion setup (split headings, draw paths, reveals)
   3. Header + navigation  4. Tablists (home: examples, journey)
   5. Program selector and showcase (learn)  6. Starter kit thank-you  7. Analytics events
   8. Event Calendar (workshops)  9. Testimonial photos  10. Hero network parallax
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
    var journey = $("#journey.section--dark");
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
  if (location.pathname.indexOf("/start-your-ai-journey/") === 0 && !dl) track("landing_view", { offer_id: "ai-workflow-starter-kit" });
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
        var jump = el("button", "cal__jump", next.title + " · " + longDate(next.first, { timeZone: "UTC", day: "numeric", month: "short" }));
        jump.type = "button";
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

  /* ---- 10. Hero: network parallax --------------------------------------- */
  // The agent network leans gently toward the cursor: the whole layer moves a few pixels and each
  // node a little more by its depth (--d), so the lines stay attached. The values trail the pointer
  // on a damped spring (ω 5, ζ 1) instead of snapping. Mouse/trackpad only: touch and reduced motion
  // stay still, and the loop sleeps once settled or when the hero is off screen.
  var hero = $(".hero");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var nets = hero ? $$(".hnet", hero) : [];
  if (nets.length && !reduceMotion && finePointer && "IntersectionObserver" in window) {
    var aim = { x: 0, y: 0 }, pos = { x: 0, y: 0 }, vel = { x: 0, y: 0 };
    var heroOn = false, raf = 0, prev = 0;
    var loop = function (now) {
      var dt = Math.min(0.1, (now - (prev || now)) / 1000);
      prev = now;
      for (var s = 0; s < 4; s++) {
        ["x", "y"].forEach(function (k) { vel[k] += (25 * (aim[k] - pos[k]) - 10 * vel[k]) * dt / 4; pos[k] += vel[k] * dt / 4; });
      }
      nets.forEach(function (n) {
        n.style.setProperty("--px", pos.x.toFixed(3));
        n.style.setProperty("--py", pos.y.toFixed(3));
      });
      var settled = Math.abs(aim.x - pos.x) + Math.abs(aim.y - pos.y) + Math.abs(vel.x) + Math.abs(vel.y) < 0.002;
      raf = heroOn && !settled ? requestAnimationFrame(loop) : 0;
      if (!raf) prev = 0;
    };
    var wake = function () { if (heroOn && !raf) raf = requestAnimationFrame(loop); };
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      aim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      aim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      wake();
    }, { passive: true });
    hero.addEventListener("pointerleave", function () { aim.x = 0; aim.y = 0; wake(); });
    new IntersectionObserver(function (entries) {
      heroOn = entries[0].isIntersecting;
      wake();
    }).observe(hero);
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
  // hovered, focused, off screen or in a background tab; the buttons, a horizontal swipe and the
  // arrow keys flip through it, and any of them starts the wait again. Reduced motion: no autoplay,
  // and cards change place without the swing. Without JS: the scroll-snap row.
  $$("[data-carousel]").forEach(function (box) {
    var track = $(".voices__track", box);
    var slides = $$("[data-slide]", box);
    var n = slides.length;
    if (!track || n < 2) return;
    var count = $("[data-carousel-count]", box);
    var DWELL = 6500, i = 0, timer = 0;
    var hold = { hover: false, focus: false, away: true, hidden: doc.hidden };
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
    var go = function (dir) {
      var leaving = slides[i];
      i = wrap(i + dir);
      if (!reduceMotion) {
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
    // Swipe: the track has touch-action: pan-y, so a vertical swipe still scrolls the page; a
    // horizontal one of 40px or more flips the stack (left for the next card, right for the last).
    var start = null;
    track.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY };
    });
    track.addEventListener("pointerup", function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    });
    track.addEventListener("pointercancel", function () { start = null; });
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
