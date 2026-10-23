/**
 * Faith Works — Connected Universe Background Engine
 * Continuous, full-viewport generative network of delicate threads,
 * illuminated nodes, and stardust particles framing the homepage content.
 * Integrates with native scrolling & GSAP / Lenis loops, respecting reduced-motion.
 */
(function () {
  "use strict";

  var container = document.getElementById("connected-universe");
  var canvas = document.getElementById("universe-canvas");
  if (!container || !canvas) return;

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Design system palette tokens
  var COLORS = {
    ink: "rgb(26, 26, 26)",
    pink: "rgb(239, 172, 186)",
    pinkAlpha: function (a) { return "rgba(239, 172, 186, " + a + ")"; },
    yellow: "rgb(251, 197, 34)",
    yellowAlpha: function (a) { return "rgba(251, 197, 34, " + a + ")"; },
    inkAlpha: function (a) { return "rgba(26, 26, 26, " + a + ")"; },
    paper: "#FAF8F4",
    white: "#FFFFFF"
  };

  var width = 0;
  var height = 0;
  var dpr = 1;
  var scrollY = window.scrollY || 0;
  var isVisible = true;
  var rafId = null;

  // Pointer tracking with spring physics
  var mouse = { x: -9999, y: -9999, targetX: -9999, targetY: -9999, active: false };

  // Core constellation layout anchors (relative [0..1] coordinates, leaving central negative space)
  var HUB_CONFIGS = [
    { id: "h1", rx: 0.14, ry: 0.22, color: "pink", size: 6.5, pulseSpeed: 1.8, phase: 0.2, depth: 0.18, label: "Intent" },
    { id: "h2", rx: 0.86, ry: 0.26, color: "yellow", size: 7.0, pulseSpeed: 2.2, phase: 1.5, depth: 0.15, label: "Agents" },
    { id: "h3", rx: 0.20, ry: 0.62, color: "pink", size: 5.5, pulseSpeed: 1.5, phase: 2.7, depth: 0.22, label: "Workflow" },
    { id: "h4", rx: 0.82, ry: 0.68, color: "yellow", size: 6.0, pulseSpeed: 2.0, phase: 0.8, depth: 0.20, label: "Systems" },
    { id: "h5", rx: 0.08, ry: 0.88, color: "pink", size: 5.0, pulseSpeed: 1.6, phase: 3.1, depth: 0.25, label: "People" },
    { id: "h6", rx: 0.92, ry: 0.90, color: "yellow", size: 5.5, pulseSpeed: 1.9, phase: 2.0, depth: 0.24, label: "Scale" }
  ];

  var SATELLITE_CONFIGS = [
    // Framing upper left
    { rx: 0.07, ry: 0.15, depth: 0.12, color: "ink", size: 3.0 },
    { rx: 0.24, ry: 0.16, depth: 0.16, color: "pink", size: 3.5 },
    { rx: 0.18, ry: 0.35, depth: 0.20, color: "ink", size: 2.5 },
    { rx: 0.27, ry: 0.30, depth: 0.14, color: "pink", size: 3.0 },
    { rx: 0.10, ry: 0.40, depth: 0.18, color: "ink", size: 2.8 },

    // Framing upper right
    { rx: 0.92, ry: 0.18, depth: 0.14, color: "ink", size: 3.0 },
    { rx: 0.76, ry: 0.20, depth: 0.16, color: "yellow", size: 3.5 },
    { rx: 0.82, ry: 0.38, depth: 0.19, color: "ink", size: 2.5 },
    { rx: 0.72, ry: 0.32, depth: 0.15, color: "yellow", size: 3.2 },
    { rx: 0.90, ry: 0.46, depth: 0.17, color: "ink", size: 2.6 },

    // Mid bridges (left flank)
    { rx: 0.12, ry: 0.54, depth: 0.22, color: "pink", size: 3.2 },
    { rx: 0.28, ry: 0.58, depth: 0.24, color: "ink", size: 2.6 },
    { rx: 0.15, ry: 0.72, depth: 0.26, color: "pink", size: 3.0 },
    { rx: 0.24, ry: 0.76, depth: 0.23, color: "ink", size: 2.4 },

    // Mid bridges (right flank)
    { rx: 0.88, ry: 0.56, depth: 0.21, color: "yellow", size: 3.0 },
    { rx: 0.74, ry: 0.62, depth: 0.23, color: "ink", size: 2.7 },
    { rx: 0.85, ry: 0.78, depth: 0.25, color: "yellow", size: 3.2 },
    { rx: 0.76, ry: 0.84, depth: 0.22, color: "ink", size: 2.5 },

    // Lower connectors
    { rx: 0.35, ry: 0.92, depth: 0.28, color: "ink", size: 2.5 },
    { rx: 0.65, ry: 0.94, depth: 0.28, color: "ink", size: 2.5 },
    { rx: 0.50, ry: 0.96, depth: 0.30, color: "pink", size: 3.2 }
  ];

  var nodes = [];
  var connections = [];
  var stardust = [];
  var impulses = [];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    initNodes();
    if (reduceMotion) {
      renderStatic();
    }
  }

  function getNodeCoords(rx, ry) {
    if (width < 768) {
      var x;
      if (rx < 0.45) {
        // Map rx (0 .. 0.45) to (0.03 .. 0.18) * width for clean lateral framing
        x = (0.03 + (rx / 0.45) * 0.15) * width;
      } else if (rx > 0.55) {
        // Map rx (0.55 .. 1.0) to (0.82 .. 0.97) * width for clean lateral framing
        x = (0.82 + ((rx - 0.55) / 0.45) * 0.15) * width;
      } else {
        x = rx * width;
      }
      return { x: x, y: ry * height };
    }
    return { x: rx * width, y: ry * height };
  }

  function initNodes() {
    nodes = [];
    connections = [];
    impulses = [];

    // 1. Build Hubs
    HUB_CONFIGS.forEach(function (h) {
      var pos = getNodeCoords(h.rx, h.ry);
      nodes.push({
        id: h.id,
        isHub: true,
        rx: h.rx,
        ry: h.ry,
        x: pos.x,
        y: pos.y,
        baseX: pos.x,
        baseY: pos.y,
        color: h.color,
        size: width < 768 ? Math.max(4, h.size * 0.75) : h.size,
        depth: h.depth,
        pulseSpeed: h.pulseSpeed,
        phase: h.phase,
        vx: 0,
        vy: 0
      });
    });

    // 2. Build Satellites
    SATELLITE_CONFIGS.forEach(function (s, i) {
      var pos = getNodeCoords(s.rx, s.ry);
      nodes.push({
        id: "s" + i,
        isHub: false,
        rx: s.rx,
        ry: s.ry,
        x: pos.x,
        y: pos.y,
        baseX: pos.x,
        baseY: pos.y,
        color: s.color,
        size: width < 768 ? Math.max(2, s.size * 0.75) : s.size,
        depth: s.depth,
        pulseSpeed: 1 + (i % 3) * 0.4,
        phase: i * 0.5,
        vx: 0,
        vy: 0
      });
    });

    // 3. Stardust (small drifting particles)
    stardust = [];
    var count = width < 768 ? 20 : 36;
    for (var i = 0; i < count; i++) {
      stardust.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18 - 0.05,
        size: 0.8 + Math.random() * 1.4,
        alpha: 0.12 + Math.random() * 0.28,
        color: Math.random() > 0.6 ? "pink" : Math.random() > 0.3 ? "yellow" : "ink",
        depth: 0.08 + Math.random() * 0.22
      });
    }

    // 4. Connective Filaments: Link neighboring nodes with graceful paths
    // Keep negative space in the center clear
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var n1 = nodes[i];
        var n2 = nodes[j];
        var dx = n1.baseX - n2.baseX;
        var dy = n1.baseY - n2.baseY;
        var dist = Math.sqrt(dx * dx + dy * dy);

        // Maximum connection distance varies with screen size
        var maxDist = Math.min(width, height) * 0.42;

        // Never bridge directly across the center headline area on desktop
        var midX = (n1.baseX + n2.baseX) / 2;
        var midY = (n1.baseY + n2.baseY) / 2;
        var inCenterZone = (midX > width * 0.32 && midX < width * 0.68 && midY > height * 0.15 && midY < height * 0.55);

        if (dist < maxDist && !inCenterZone) {
          var isCrossFlank = (n1.baseX < width * 0.45 && n2.baseX > width * 0.55) ||
                             (n2.baseX < width * 0.45 && n1.baseX > width * 0.55);
          
          // On mobile, never cross flanks; on desktop, allow only subtle lower cross-links
          if (width < 768 && isCrossFlank) {
            continue;
          }
          if (isCrossFlank && (n1.baseY < height * 0.72 || n2.baseY < height * 0.72)) {
            continue;
          }

          var style = (n1.color === "pink" && n2.color === "pink") ? "pink" :
                      (n1.color === "yellow" && n2.color === "yellow") ? "yellow" :
                      (n1.color === "pink" || n2.color === "pink") ? "pink-soft" :
                      (n1.color === "yellow" || n2.color === "yellow") ? "yellow-soft" : "subtle";

          connections.push({
            a: n1,
            b: n2,
            dist: dist,
            style: style,
            curveFactor: (i + j) % 2 === 0 ? 0.12 : -0.12
          });
        }
      }
    }

    // 5. Initialize traveling impulses along selected connections
    impulses = [];
    var impulseLinks = connections.filter(function (c) {
      return c.style !== "subtle" && c.dist > 120;
    });

    for (var k = 0; k < Math.min(6, impulseLinks.length); k++) {
      impulses.push({
        conn: impulseLinks[k],
        progress: Math.random(),
        speed: 0.0015 + Math.random() * 0.0025,
        color: impulseLinks[k].style.indexOf("yellow") !== -1 ? "yellow" : "pink"
      });
    }
  }

  function update() {
    scrollY = window.scrollY || window.pageYOffset || 0;

    // Smooth mouse follower
    if (mouse.active) {
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;
    }

    var time = performance.now() * 0.001;

    // Update nodes
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];

      // Subtle organic breathing drift
      var driftX = Math.cos(time * 0.6 + n.phase) * 3.5;
      var driftY = Math.sin(time * 0.5 + n.phase) * 3.5;

      // Parallax with scroll
      var scrollOffset = scrollY * (0.05 + n.depth * 0.1);

      // Pointer magnetic interaction
      var pX = 0, pY = 0;
      if (mouse.active) {
        var dx = mouse.x - n.baseX;
        var dy = mouse.y - (n.baseY - scrollOffset % height);
        var dist = Math.sqrt(dx * dx + dy * dy);
        var radius = 220;
        if (dist < radius && dist > 1) {
          var force = (1 - dist / radius) * 16;
          pX = (dx / dist) * force;
          pY = (dy / dist) * force;
        }
      }

      n.x = n.baseX + driftX + pX;
      // Keep nodes grounded within view while gently responding to scroll
      n.y = n.baseY + driftY + pY - (scrollOffset * 0.45) % (height * 1.5);
      if (n.y < -100) n.y += height * 1.5;
      if (n.y > height + 100) n.y -= height * 1.5;
    }

    // Update stardust
    for (var s = 0; s < stardust.length; s++) {
      var p = stardust[s];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -20) p.x = width + 20;
      if (p.x > width + 20) p.x = -20;
      if (p.y < -20) p.y = height + 20;
      if (p.y > height + 20) p.y = -20;
    }

    // Update traveling impulses
    for (var m = 0; m < impulses.length; m++) {
      var imp = impulses[m];
      imp.progress += imp.speed;
      if (imp.progress > 1) {
        imp.progress = 0;
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    var time = performance.now() * 0.001;

    // 1. Draw connecting filaments
    for (var c = 0; c < connections.length; c++) {
      var conn = connections[c];
      var a = conn.a;
      var b = conn.b;

      // Only draw if both nodes are within visible vicinity
      if (a.y < -60 && b.y < -60) continue;
      if (a.y > height + 60 && b.y > height + 60) continue;

      ctx.beginPath();
      // Midpoint with subtle curve
      var mx = (a.x + b.x) / 2;
      var my = (a.y + b.y) / 2;
      var cx = mx - (b.y - a.y) * conn.curveFactor;
      var cy = my + (b.x - a.x) * conn.curveFactor;

      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, b.x, b.y);

      // Line appearance
      if (conn.style === "pink") {
        ctx.strokeStyle = COLORS.pinkAlpha(0.24);
        ctx.lineWidth = 1.2;
      } else if (conn.style === "yellow") {
        ctx.strokeStyle = COLORS.yellowAlpha(0.26);
        ctx.lineWidth = 1.2;
      } else if (conn.style === "pink-soft") {
        ctx.strokeStyle = COLORS.pinkAlpha(0.14);
        ctx.lineWidth = 0.9;
      } else if (conn.style === "yellow-soft") {
        ctx.strokeStyle = COLORS.yellowAlpha(0.15);
        ctx.lineWidth = 0.9;
      } else {
        ctx.strokeStyle = COLORS.inkAlpha(0.08);
        ctx.lineWidth = 0.75;
      }

      ctx.stroke();
    }

    // 2. Draw traveling impulses along filaments
    for (var m = 0; m < impulses.length; m++) {
      var imp = impulses[m];
      var conn = imp.conn;
      var a = conn.a;
      var b = conn.b;
      var t = imp.progress;

      // Quadratic bezier point: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
      var mx = (a.x + b.x) / 2;
      var my = (a.y + b.y) / 2;
      var cx = mx - (b.y - a.y) * conn.curveFactor;
      var cy = my + (b.x - a.x) * conn.curveFactor;

      var inv = 1 - t;
      var px = inv * inv * a.x + 2 * inv * t * cx + t * t * b.x;
      var py = inv * inv * a.y + 2 * inv * t * cy + t * t * b.y;

      // Pulse glow
      var grad = ctx.createRadialGradient(px, py, 0, px, py, 7);
      if (imp.color === "yellow") {
        grad.addColorStop(0, "rgba(251, 197, 34, 0.9)");
        grad.addColorStop(0.5, "rgba(251, 197, 34, 0.4)");
        grad.addColorStop(1, "rgba(251, 197, 34, 0)");
      } else {
        grad.addColorStop(0, "rgba(239, 172, 186, 0.9)");
        grad.addColorStop(0.5, "rgba(239, 172, 186, 0.4)");
        grad.addColorStop(1, "rgba(239, 172, 186, 0)");
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();

      // Sharp core
      ctx.fillStyle = COLORS.white;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Draw stardust particles
    for (var s = 0; s < stardust.length; s++) {
      var p = stardust[s];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      if (p.color === "pink") {
        ctx.fillStyle = COLORS.pinkAlpha(p.alpha);
      } else if (p.color === "yellow") {
        ctx.fillStyle = COLORS.yellowAlpha(p.alpha);
      } else {
        ctx.fillStyle = COLORS.inkAlpha(p.alpha * 0.7);
      }
      ctx.fill();
    }

    // 4. Draw Nodes
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.y < -40 || n.y > height + 40) continue;

      var pulse = Math.sin(time * n.pulseSpeed + n.phase);

      if (n.isHub) {
        // Major Luminous Hub
        var haloR = n.size * 3.8 + pulse * 2.5;

        // Outer soft atmospheric bloom
        var haloGrad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloR);
        if (n.color === "pink") {
          haloGrad.addColorStop(0, "rgba(239, 172, 186, 0.32)");
          haloGrad.addColorStop(0.5, "rgba(239, 172, 186, 0.12)");
          haloGrad.addColorStop(1, "rgba(239, 172, 186, 0)");
        } else {
          haloGrad.addColorStop(0, "rgba(251, 197, 34, 0.35)");
          haloGrad.addColorStop(0.5, "rgba(251, 197, 34, 0.14)");
          haloGrad.addColorStop(1, "rgba(251, 197, 34, 0)");
        }

        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
        ctx.fill();

        // Outer ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size * 1.8 + pulse * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = n.color === "pink" ? COLORS.pinkAlpha(0.4) : COLORS.yellowAlpha(0.45);
        ctx.lineWidth = 1;
        ctx.stroke();

        // Node disc
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.white;
        ctx.fill();
        ctx.strokeStyle = n.color === "pink" ? COLORS.pink : COLORS.yellow;
        ctx.lineWidth = 2.0;
        ctx.stroke();

        // Glowing center core
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = n.color === "pink" ? COLORS.pink : COLORS.yellow;
        ctx.fill();

      } else {
        // Satellite / Bridge Node
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size + pulse * 0.3, 0, Math.PI * 2);
        if (n.color === "pink") {
          ctx.fillStyle = COLORS.pink;
          ctx.strokeStyle = COLORS.white;
          ctx.lineWidth = 1.2;
          ctx.fill();
          ctx.stroke();
        } else if (n.color === "yellow") {
          ctx.fillStyle = COLORS.yellow;
          ctx.strokeStyle = COLORS.white;
          ctx.lineWidth = 1.2;
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = COLORS.inkAlpha(0.28);
          ctx.fill();
        }
      }
    }
  }

  function renderStatic() {
    ctx.clearRect(0, 0, width, height);

    // Static filaments
    for (var c = 0; c < connections.length; c++) {
      var conn = connections[c];
      var a = conn.a;
      var b = conn.b;
      ctx.beginPath();
      var mx = (a.baseX + b.baseX) / 2;
      var my = (a.baseY + b.baseY) / 2;
      var cx = mx - (b.baseY - a.baseY) * conn.curveFactor;
      var cy = my + (b.baseX - a.baseX) * conn.curveFactor;
      ctx.moveTo(a.baseX, a.baseY);
      ctx.quadraticCurveTo(cx, cy, b.baseX, b.baseY);
      ctx.strokeStyle = conn.style === "pink" ? COLORS.pinkAlpha(0.2) :
                        conn.style === "yellow" ? COLORS.yellowAlpha(0.2) : COLORS.inkAlpha(0.08);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Static nodes
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      ctx.beginPath();
      ctx.arc(n.baseX, n.baseY, n.size, 0, Math.PI * 2);
      ctx.fillStyle = n.color === "pink" ? COLORS.pink :
                      n.color === "yellow" ? COLORS.yellow : COLORS.inkAlpha(0.25);
      ctx.fill();
    }
  }

  function loop() {
    if (!isVisible) return;
    update();
    render();
    rafId = requestAnimationFrame(loop);
  }

  // Pointer interactions on desktop
  window.addEventListener("pointermove", function (e) {
    mouse.active = true;
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
  }, { passive: true });

  window.addEventListener("pointerleave", function () {
    mouse.active = false;
    mouse.targetX = -9999;
    mouse.targetY = -9999;
  }, { passive: true });

  // Page Visibility handling
  document.addEventListener("visibilitychange", function () {
    isVisible = !document.hidden;
    if (isVisible && !reduceMotion) {
      if (!rafId) loop();
    } else {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  });

  // Resize handler
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  }, { passive: true });

  // Initialize
  resize();
  if (!reduceMotion) {
    loop();
  }
})();
