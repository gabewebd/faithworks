/* ==========================================================================
   Faith Works — single-page interactions
   1. Navigation  2. Examples  3. Learning journey (+ build motif stage)
   4. Dialog: programs, inquiry brief, design notes  5. Line-draw reveals
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  doc.documentElement.classList.add("js");

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }

  // Swap content with a short cross-fade (skipped when motion is reduced)
  function swap(el, update) {
    if (reduceMotion) { update(); return; }
    el.classList.add("is-swapping");
    setTimeout(function () { update(); el.classList.remove("is-swapping"); }, 140);
  }

  /* ---- 1. Navigation ------------------------------------------------------ */
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

  // Mark the nav link for the section in view
  var navLinks = $$('.site-nav > a:not(.btn)');
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

  /* ---- 2. Examples -------------------------------------------------------- */
  var examples = [
    ["Turn a topic into a content plan.", "Start with your audience, one business objective and approved source notes.", "Check accuracy, voice and whether every claim is supported.", "A simple content planning workflow",
      ["Choose one useful audience question", "Draft three angles from your source notes", "Review and turn one angle into a publishable draft"]],
    ["Make lead follow-up more consistent.", "Start with an approved inquiry record, service details and the next action.", "Verify contact permission, pricing and context before sending.", "A follow-up preparation workflow",
      ["Summarize the inquiry and missing details", "Draft a relevant next-step message", "Review the draft and record the follow-up date"]],
    ["Help your team find an answer.", "Start with approved process notes and frequently asked questions.", "Check source permissions and keep human escalation available.", "An internal knowledge workflow",
      ["Organize the approved source material", "Draft an answer with its source reference", "Flag gaps for the responsible team member"]]
  ];
  var exampleBox = $(".example");
  var exampleButtons = $$("[data-example]");

  function selectExample(i) {
    var x = examples[i];
    exampleButtons.forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.dataset.example) === i)); });
    swap(exampleBox, function () {
      $("#example-task").textContent = x[0];
      $("#example-input").textContent = x[1];
      $("#example-review").textContent = x[2];
      $("#example-title").textContent = x[3];
      $("#example-list").replaceChildren.apply($("#example-list"), x[4].map(function (t) {
        var li = doc.createElement("li"); li.textContent = t; return li;
      }));
    });
  }
  exampleButtons.forEach(function (b) {
    b.addEventListener("click", function () { selectExample(Number(b.dataset.example)); });
  });

  /* ---- 3. Learning journey ------------------------------------------------ */
  var steps = [
    ["Make AI feel less overwhelming.", "Understand what AI can do, where human judgment matters, and how to choose a practical starting point.", "Example: an AI readiness map"],
    ["Start with one real task.", "Use AI to support an everyday task in your work. Build confidence through useful practice and review the result.", "Example: a repeatable content workflow"],
    ["Make your first version real.", "Turn an idea into a simple prototype that you can explore, test and refine with guidance.", "Example: a landing page or lead tracker"],
    ["Bring it into your workflow.", "Define how the process fits into real work, who is responsible, and what needs a human check.", "Example: a documented handoff"],
    ["Learn from what happens next.", "Review results, gather feedback, and refine your process as your needs and skills grow.", "Example: a workflow improvement log"]
  ];
  var stepButtons = $$("[data-step]");
  var journeyCopy = $(".journey-box__copy");
  var motif = $(".motif-build");

  function selectStep(i) {
    stepButtons.forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.dataset.step) === i)); });
    motif.setAttribute("data-stage", String(i));
    swap(journeyCopy, function () {
      $("#journey-title").textContent = steps[i][0];
      $("#journey-copy").textContent = steps[i][1];
      $("#journey-example").textContent = steps[i][2];
    });
  }
  stepButtons.forEach(function (b) {
    b.addEventListener("click", function () { selectStep(Number(b.dataset.step)); });
  });

  /* ---- 4. Dialog ---------------------------------------------------------- */
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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Programs
  var programs = [
    ["AI Workforce Masterclass & Accelerator", ["Assess your workflow readiness", "Identify one high-impact process", "Design a workflow and explore a first prototype"]],
    ["AI + LinkedIn B2B Growth", ["Clarify your audience and positioning", "Develop useful content ideas with AI", "Explore a repeatable B2B growth workflow"]],
    ["AI Websites & Workflow Building", ["Choose a useful business project", "Build a first version with guided practice", "Review what is needed before real-world use"]]
  ];
  $$("[data-program]").forEach(function (b) {
    b.addEventListener("click", function () {
      var p = programs[Number(b.dataset.program)];
      show(
        '<p class="modal__kicker">EXPLORE A LEARNING PATHWAY</p>' +
        '<h2 class="modal__title">' + escapeHtml(p[0]) + "</h2>" +
        '<div class="modal__body"><p>Focus areas for this pathway:</p><ul>' +
        p[1].map(function (x) { return "<li>" + escapeHtml(x) + "</li>"; }).join("") +
        '</ul><div class="notice">New schedules, fees, exact inclusions and prerequisites are to be confirmed. This preview does not accept registrations or payments.</div>' +
        '<button type="button" class="btn btn--full" id="program-interest">Prepare my inquiry <span aria-hidden="true">↗</span></button></div>'
      );
      $("#program-interest").addEventListener("click", function () { inquiry(p[0]); });
    });
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
      '<button class="btn btn--full">Download my brief <span aria-hidden="true">↓</span></button>' +
      "</form>" +
      '<p class="small">No email or payment is required for this preview. You can review the downloaded brief before sharing it.</p>' +
      "</div>"
    );

    var form = $("#inquiry");
    var select = $("#interest");
    var options = ["Program interest", "Corporate training", "Speaking or partnership", "Faith AI discovery"]
      .concat(programs.map(function (p) { return p[0]; }));
    options.forEach(function (x) {
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

  /* ---- 5. Line-draw reveals ----------------------------------------------- */
  // Each path's length becomes --len so the stroke can draw itself in. Lengths are applied
  // with transitions off so a line never animates from the fallback length to its real one.
  function setDrawLengths(svg) {
    var paths = $$("path", svg);
    paths.forEach(function (p, i) {
      p.style.transition = "none";
      p.style.setProperty("--len", Math.ceil(p.getTotalLength()));
      if (!p.style.getPropertyValue("--i")) p.style.setProperty("--i", i);
    });
    if (paths.length) getComputedStyle(paths[0]).strokeDashoffset; // commit the hidden state
    paths.forEach(function (p) { p.style.transition = ""; });
  }

  var drawables = $$("[data-draw]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    drawables.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var drawObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        drawObserver.unobserve(el);
        // Two frames later, so the hidden starting state has been painted first
        requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("is-in"); }); });
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.2 });
    drawables.forEach(function (el) { setDrawLengths(el); drawObserver.observe(el); });
  }
})();
