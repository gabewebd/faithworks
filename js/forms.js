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
