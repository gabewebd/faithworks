/* ==========================================================================
   Faith Works — single-page interactions
   1. Helpers  2. Motion setup (split headings, draw paths, reveals)
   3. Header + navigation  4. Pointer parallax  5. Tablists (examples, journey)
   6. Pathway selector  7. Gallery loop  8. Dialogs: programs, inquiry, notes
   Motion lives in CSS keyframes; this file only adds/removes state classes.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. Helpers --------------------------------------------------------- */
  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Restart a CSS keyframe sequence by re-applying its trigger class
  function replay(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }
  // Cross-fade content in place (skipped when motion is reduced)
  function swap(el, update) {
    if (reduceMotion) { update(); return; }
    el.classList.add("is-swapping");
    setTimeout(function () { update(); el.classList.remove("is-swapping"); }, 200);
  }
  // Type text out character by character (the full text stays in the HTML for no-JS / reduced motion)
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
  function stagger(list, prop) {
    list.forEach(function (el, i) { el.style.setProperty(prop || "--c", i); });
  }

  /* ---- 2. Motion setup ---------------------------------------------------- */
  // Headings marked data-split: each <br>-separated line gets its own mask
  $$("[data-split]").forEach(function (h) {
    var lines = h.innerHTML.split(/<br\s*\/?>/i);
    h.innerHTML = lines.map(function (line, i) {
      return '<span class="line" style="--l:' + i + '"><span>' + line.trim() + "</span></span>";
    }).join(" ");
  });

  // Normalise every drawable path so one CSS dash pattern fits all lengths
  $$("[data-draw] path").forEach(function (p) { p.setAttribute("pathLength", "1"); });

  stagger($$(".flow__chips li"));
  stagger($$(".flow__tools .tool"));
  stagger($$(".flow__list li"));
  stagger($$(".flow__pulse"));
  stagger($$(".faq details"), "--q");

  // Reveal once in view; pause loops again whenever a block leaves the viewport
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
            // Two frames later, so the paused starting state is painted first
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
  // The hero's task types itself as the entrance plays
  typeOut($(".h-prompt__typed"), 1100);

  /* ---- 3. Header + navigation -------------------------------------------- */
  var header = $(".site-header");
  var menu = $(".menu");
  var nav = $("#main-navigation");

  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }
  menu.addEventListener("click", function () { setMenu(!nav.classList.contains("is-open")); });
  $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && nav.classList.contains("is-open")) { setMenu(false); menu.focus(); }
  });

  // Scrolled state + reading progress, one rAF per scroll burst
  var ticking = false;
  function onScroll() {
    var max = root.scrollHeight - window.innerHeight;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
    header.style.setProperty("--progress", max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // Mark the nav link for the section in view
  var navLinks = $$(".site-nav > a:not(.btn)");
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          if (a.getAttribute("href") === "#" + entry.target.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) {
      var target = doc.getElementById(a.getAttribute("href").slice(1));
      if (target) spy.observe(target);
    });
  }

  /* ---- 4. Pointer parallax (hero) ---------------------------------------- */
  // Clamped, eased, only on fine pointers with motion allowed, only while the hero is visible
  var hero = $(".hero");
  if (hero && finePointer && !reduceMotion) {
    var layers = $$("[data-depth]", hero);
    var target = { x: 0, y: 0 }, current = { x: 0, y: 0 }, raf = 0, heroVisible = true, rect = null;
    function measure() { rect = hero.getBoundingClientRect(); }
    function frame() {
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      layers.forEach(function (el) {
        var d = Number(el.getAttribute("data-depth")) / 20;
        el.style.setProperty("--px", (current.x * d).toFixed(2) + "px");
        el.style.setProperty("--py", (current.y * d).toFixed(2) + "px");
      });
      if (Math.abs(target.x - current.x) > 0.05 || Math.abs(target.y - current.y) > 0.05) raf = requestAnimationFrame(frame);
      else raf = 0;
    }
    hero.addEventListener("pointerenter", measure);
    hero.addEventListener("pointermove", function (e) {
      if (!heroVisible) return;
      if (!rect) measure();
      var nx = (e.clientX - rect.left) / rect.width - 0.5;
      var ny = (e.clientY - rect.top) / rect.height - 0.5;
      target.x = Math.max(-1, Math.min(1, nx * 2)) * 12;
      target.y = Math.max(-1, Math.min(1, ny * 2)) * 10;
      if (!raf) raf = requestAnimationFrame(frame);
    });
    hero.addEventListener("pointerleave", function () {
      target.x = 0; target.y = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    });
    window.addEventListener("resize", function () { rect = null; }, { passive: true });
    hero.addEventListener("fw:visibility", function (e) { heroVisible = e.detail; });
    layers.forEach(function (el) { el.style.transition = "none"; });
  }

  /* ---- 5. Tablists ------------------------------------------------------- */
  // Roving tabindex + arrow keys; onSelect receives the index
  function tablist(list, tabs, onSelect, attr) {
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

  // Make it concrete: the workflow canvas replays for each task
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
  var canvas = $("#ex-panel");
  function fill(listEl, items) {
    listEl.replaceChildren.apply(listEl, items.map(function (t, i) {
      var li = doc.createElement("li");
      li.textContent = t;
      li.style.setProperty("--c", i);
      return li;
    }));
  }
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

  // Journey: five stages, five scenes
  var stepTabs = $$("[data-step]");
  var scenes = $$(".scene");
  tablist($(".steps"), stepTabs, function (i) {
    scenes.forEach(function (s, n) {
      var on = n === i;
      s.hidden = !on;
      s.classList.toggle("is-active", on);
    });
    if (i === 0) typeOut($(".learn__typed"), 2300);
  });
  // The Learn prompt types when the scenes first come into view
  var learnTyped = $(".learn__typed");
  if (learnTyped && !reduceMotion) {
    learnTyped.setAttribute("data-text", learnTyped.textContent);
    learnTyped.textContent = "";
    var typedOnce = false;
    $(".scenes").addEventListener("fw:visibility", function (e) {
      if (e.detail && !typedOnce && $(".scene--learn").classList.contains("is-active")) { typedOnce = true; typeOut(learnTyped, 2300); }
    });
  }

  /* ---- 6. Pathway selector ----------------------------------------------- */
  var programs = [
    { name: "AI Workforce Masterclass & Accelerator", id: "program-workforce", tone: "stone",
      focus: ["Assess your workflow readiness", "Identify one high-impact process", "Design a workflow and explore a first prototype"] },
    { name: "AI + LinkedIn B2B Growth", id: "program-linkedin", tone: "pink",
      focus: ["Clarify your audience and positioning", "Develop useful content ideas with AI", "Explore a repeatable B2B growth workflow"] },
    { name: "AI Websites & Workflow Building", id: "program-websites", tone: "yellow",
      focus: ["Choose a useful business project", "Build a first version with guided practice", "Review what is needed before real-world use"] }
  ];
  var goals = [
    { program: 0, output: "A workflow plan and first prototype" },
    { program: 1, output: "A repeatable content and growth workflow" },
    { program: 2, output: "A first landing page or workflow prototype" },
    { team: true }
  ];
  var team = {
    name: "Training for your organization", tone: "ink", output: "Help your team move from AI awareness to practical adoption",
    focus: ["Align on your team’s priorities", "Learn through relevant use cases", "Apply AI in guided exercises", "Define the next implementation steps"]
  };
  var preview = $(".fit__preview");
  var fitCta = $("#fit-cta");
  var fitLink = $("#fit-link");
  var currentGoal = 0;
  var goalButtons = $$("[data-goal]");
  stagger(goalButtons, "--g");

  var goalChosen = false;
  function showGoal(i) {
    currentGoal = i;
    var g = goals[i];
    var p = g.team ? team : programs[g.program];
    $$(".program").forEach(function (el) { el.classList.toggle("is-match", goalChosen && !g.team && el.id === p.id); });
    swap(preview, function () {
      preview.setAttribute("data-tone", p.tone);
      $(".fit__kicker", preview).textContent = g.team ? "For your organization" : "Explore";
      $("#fit-name").textContent = p.name;
      $("#fit-output").textContent = g.team ? p.output : g.output;
      $(".fit__output dt", preview).textContent = g.team ? "The aim" : "Typical learning output";
      fill($("#fit-focus"), p.focus);
      fitCta.firstChild.textContent = g.team ? "Prepare a training brief " : "Explore this pathway ";
      fitLink.setAttribute("href", g.team ? "#business" : "#" + p.id);
      fitLink.firstChild.textContent = g.team ? "See how it works " : "See it above ";
      fitLink.querySelector(".link-arrow").textContent = g.team ? "↓" : "↑";
    });
  }
  tablist($(".fit__goals"), goalButtons, function (i) { goalChosen = true; showGoal(i); }, "aria-checked");
  fitCta.addEventListener("click", function () {
    var g = goals[currentGoal];
    if (g.team) inquiry("Corporate training");
    else openProgram(g.program);
  });
  showGoal(0);

  /* ---- 7. Gallery loop --------------------------------------------------- */
  // Each row loops seamlessly (its items are cloned once), can be dragged, pauses on
  // hover, off-screen and with the toggle. Reduced motion: rows stay natively scrollable.
  var gallery = $(".gallery");
  var toggle = $(".gallery__toggle");
  if (gallery && !reduceMotion) {
    var paused = false, galleryVisible = false;
    var rows = $$(".gallery__row", gallery).map(function (row) {
      var track = $(".gallery__track", row);
      $$("li", track).forEach(function (li) {
        var clone = li.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        $$("img", clone).forEach(function (img) { img.alt = ""; });
        track.append(clone);
      });
      var state = {
        row: row, track: track, x: 0, half: 0, hover: false, drag: null,
        dir: row.classList.contains("gallery__row--reverse") ? 1 : -1,
        speed: Number(row.getAttribute("data-speed")) || 24
      };
      function measureRow() { state.half = track.scrollWidth / 2; }
      measureRow();
      $$("img", track).forEach(function (img) { if (!img.complete) img.addEventListener("load", measureRow); });
      window.addEventListener("resize", measureRow, { passive: true });
      if (state.dir > 0) state.x = -state.half / 2;

      row.addEventListener("pointerenter", function () { state.hover = true; });
      row.addEventListener("pointerleave", function () { state.hover = false; });
      row.addEventListener("pointerdown", function (e) {
        state.drag = { start: e.clientX, x: state.x, id: e.pointerId, moved: false };
      });
      row.addEventListener("pointermove", function (e) {
        if (!state.drag || e.pointerId !== state.drag.id) return;
        var dx = e.clientX - state.drag.start;
        if (!state.drag.moved && Math.abs(dx) > 6) {
          state.drag.moved = true;
          row.classList.add("is-dragging");
          row.setPointerCapture(e.pointerId);
        }
        if (state.drag.moved) state.x = state.drag.x + dx;
      });
      function endDrag() { state.drag = null; row.classList.remove("is-dragging"); }
      row.addEventListener("pointerup", endDrag);
      row.addEventListener("pointercancel", endDrag);
      return state;
    });

    var last = 0;
    function loop(t) {
      var dt = last ? Math.min(64, t - last) / 1000 : 0;
      last = t;
      rows.forEach(function (s) {
        if (!s.half) return;
        if (!paused && !s.hover && !s.drag) s.x += s.dir * s.speed * dt;
        // Wrap within one copy of the items, so the loop never shows a seam
        if (s.x <= -s.half) s.x += s.half;
        if (s.x > 0) s.x -= s.half;
        s.track.style.transform = "translate3d(" + s.x.toFixed(2) + "px,0,0)";
      });
      if (galleryVisible) requestAnimationFrame(loop);
    }
    gallery.addEventListener("fw:visibility", function (e) {
      var was = galleryVisible;
      galleryVisible = e.detail;
      if (galleryVisible && !was) { last = 0; requestAnimationFrame(loop); }
    });

    toggle.hidden = false;
    toggle.addEventListener("click", function () {
      paused = !paused;
      toggle.setAttribute("aria-pressed", String(paused));
      $(".gallery__toggle-text", toggle).textContent = paused ? "Play gallery" : "Pause gallery";
    });
  }

  /* ---- 8. Dialogs -------------------------------------------------------- */
  var modal = $("#modal");
  var modalContent = $(".modal__content", modal);
  var modalInvoker = null;

  $(".modal__close", modal).addEventListener("click", function () { modal.close(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.close(); });
  modal.addEventListener("close", function () {
    if (modalInvoker && modalInvoker.isConnected) modalInvoker.focus();
  });

  function show(html) {
    if (!modal.open) modalInvoker = doc.activeElement;
    modalContent.innerHTML = html;
    var title = $("h2", modalContent);
    if (title) { title.id = "modal-title"; modal.setAttribute("aria-labelledby", "modal-title"); }
    if (!modal.open) modal.showModal();
    $(".modal__close", modal).focus();
  }

  // Programs
  function openProgram(n) {
    var p = programs[n];
    show(
      '<p class="modal__kicker">EXPLORE A LEARNING PATHWAY</p>' +
      '<h2 class="modal__title">' + escapeHtml(p.name) + "</h2>" +
      '<div class="modal__body"><p>Focus areas for this pathway:</p><ul>' +
      p.focus.map(function (x) { return "<li>" + escapeHtml(x) + "</li>"; }).join("") +
      '</ul><div class="notice">New schedules, fees, exact inclusions and prerequisites are to be confirmed. This preview does not accept registrations or payments.</div>' +
      '<button type="button" class="btn btn--full" id="program-interest">Prepare my inquiry <span class="btn__arrow" aria-hidden="true">↗</span></button></div>'
    );
    $("#program-interest").addEventListener("click", function () { inquiry(p.name); });
  }
  $$("[data-program]").forEach(function (b) {
    b.addEventListener("click", function () { openProgram(Number(b.dataset.program)); });
  });

  // Inquiry brief (prepared and downloaded locally; nothing is submitted)
  var contextFields = {
    "Corporate training":
      '<label for="organization">Organization</label><input id="organization" name="organization" required maxlength="160" autocomplete="organization">' +
      '<label for="team-size">Approximate team size</label><input id="team-size" name="team-size" type="number" inputmode="numeric" min="1" max="100000" required>' +
      '<label for="format">Preferred format</label><select id="format" name="format"><option>Open to a recommendation</option><option>Online</option><option>In person</option><option>Hybrid</option></select>',
    "Speaking or partnership":
      '<label for="organization">Organization or event</label><input id="organization" name="organization" required maxlength="160">' +
      '<label for="audience">Who is the audience?</label><input id="audience" name="audience" required maxlength="250" placeholder="Audience profile and approximate size">',
    "Faith AI discovery":
      '<label for="workflow">Which business process needs support?</label><input id="workflow" name="workflow" required maxlength="250" placeholder="For example, inquiry tracking or follow-up">'
  };
  var defaultFields =
    '<label for="experience">Your experience with AI</label><select id="experience" name="experience"><option>Just getting started</option><option>Using AI for some tasks</option><option>Ready to build a workflow</option></select>';
  var briefLabels = {
    "name": "Name", "interest": "Interest", "organization": "Organization / event", "team-size": "Team size",
    "format": "Preferred format", "audience": "Audience", "workflow": "Business process",
    "experience": "AI experience", "goals": "Goals", "timing": "Preferred timing"
  };

  function inquiry(type) {
    show(
      '<p class="modal__kicker">PREPARE YOUR CONVERSATION</p>' +
      '<h2 class="modal__title">Start with the work you want to improve.</h2>' +
      '<div class="modal__body">' +
      '<div class="notice" id="inquiry-notice" role="status">Preview only: prepare a brief to download. Your entries are not submitted to Faith Works.</div>' +
      '<form id="inquiry" novalidate>' +
      '<label for="name">Your name</label><input id="name" name="name" required maxlength="120" autocomplete="name">' +
      '<label for="interest">I’m interested in</label><select id="interest" name="interest"></select>' +
      '<div id="context-fields"></div>' +
      '<label for="goals">What would you like to achieve?</label><textarea id="goals" name="goals" required maxlength="3000" placeholder="Describe one task or outcome that matters to you."></textarea>' +
      '<label for="timing">Preferred timing (optional)</label><input id="timing" name="timing" maxlength="120" placeholder="For example, next month or exploring options">' +
      '<button class="btn btn--full">Download my brief <span class="btn__arrow btn__arrow--down" aria-hidden="true">↓</span></button>' +
      "</form>" +
      '<p class="small">No email or payment is required for this preview. You can review the downloaded brief before sharing it.</p>' +
      "</div>"
    );

    var form = $("#inquiry");
    var select = $("#interest");
    ["Program interest", "Corporate training", "Speaking or partnership", "Faith AI discovery"]
      .concat(programs.map(function (p) { return p.name; }))
      .forEach(function (x) {
        var o = doc.createElement("option");
        o.textContent = x;
        o.selected = x === type;
        select.append(o);
      });

    function renderFields() { $("#context-fields").innerHTML = contextFields[select.value] || defaultFields; }
    select.addEventListener("change", renderFields);
    renderFields();

    form.addEventListener("input", function (e) { if (e.target.setCustomValidity) e.target.setCustomValidity(""); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var required = $$("input[required], textarea[required]", form);
      for (var i = 0; i < required.length; i++) {
        var el = required[i];
        el.setCustomValidity(el.value.trim() ? "" : "Please enter a value.");
        if (!el.reportValidity()) return;
      }
      var lines = ["FAITH WORKS — CONVERSATION BRIEF", ""];
      new FormData(form).forEach(function (value, key) {
        if (String(value).trim()) lines.push((briefLabels[key] || key) + ": " + String(value).trim());
      });
      lines.push("", "Prepared in the design preview. Not submitted to Faith Works.");

      var url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
      var a = doc.createElement("a");
      a.href = url;
      a.download = "Faith_Works_Conversation_Brief.txt";
      doc.body.append(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      $("#inquiry-notice").textContent = "Your brief is ready to download. No inquiry has been sent to Faith Works. Keep it for your conversation with the team.";
    });
  }
  $$("[data-inquiry]").forEach(function (b) {
    b.addEventListener("click", function () { inquiry(b.dataset.inquiry); });
  });

  // Design notes
  function notes() {
    show(
      '<p class="modal__kicker">DEVELOPER HANDOFF</p>' +
      '<h2 class="modal__title">Human first.<br>Bold, clear, practical.</h2>' +
      '<div class="modal__body">' +
      "<p>Responsive homepage concept for faithph.ai. This private preview is separate from the existing website.</p>" +
      '<div class="swatches">' +
      '<div style="background:#EFACBA">Faith Pink<br>#EFACBA</div>' +
      '<div style="background:#FFCB2A">AI Yellow<br>#FFCB2A</div>' +
      '<div style="background:#FFFFFF">White<br>#FFFFFF</div>' +
      '<div style="background:#1A1E24;color:#fff">Charcoal<br>#1A1E24</div>' +
      "</div><ul>" +
      "<li>Poppins type, large editorial headings, rounded cards and purposeful color.</li>" +
      "<li>Working interactions: responsive navigation, project examples, learning steps, program details, FAQs, starter worksheet and inquiry download.</li>" +
      "<li>Replace the text wordmark with approved SVG logo artwork. Add approved founder and workshop photography.</li>" +
      "<li>Connect the final forms, calendar and CRM. Add approved privacy, terms and official social links.</li>" +
      "<li>Confirm programs, prices and dates before enabling enrollment. No fabricated testimonials or metrics are shown.</li>" +
      "</ul>" +
      '<p class="small">Revision 3 adds a pathway comparison and tailored corporate, speaking, learning and Faith AI briefs. Source checks passed; Browser/device, keyboard and assistive-technology checks remain pending. This is a homepage preview; full program pages, CMS and integrations remain part of the developer brief.</p>' +
      "</div>"
    );
  }
  $$("[data-notes]").forEach(function (b) { b.addEventListener("click", notes); });

  window.__fwReady = true;
})();
