/* ═══════════════════════════════════════════════════════════
   StudentLife OS — Login FX Engine
   Cursor particles · Orbital academic nodes · Card 3D tilt
   AI orb · Success animation · Micro-interactions
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── CANVAS SETUP ─────────────────────────────────────────
  const canvas = document.getElementById('fx-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = window.innerWidth;
  let H = window.innerHeight;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
  }
  resize();
  window.addEventListener('resize', resize);

  // ── MOUSE TRACKING ───────────────────────────────────────
  let mx = W / 2;
  let my = H / 2;
  let isMoving = false;
  let moveTimer;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    isMoving = true;
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => { isMoving = false; }, 100);
  });

  // ── CURSOR PARTICLE SYSTEM ───────────────────────────────
  const PARTICLE_COLORS = ['#6366f1', '#818cf8', '#06b6d4', '#38bdf8', '#a5b4fc', '#f472b6'];
  const particles = [];

  function spawnParticle() {
    if (!isMoving) return;
    const spread = 8;
    particles.push({
      x:     mx + (Math.random() - 0.5) * spread,
      y:     my + (Math.random() - 0.5) * spread,
      r:     Math.random() * 2.2 + 0.4,
      alpha: Math.random() * 0.5 + 0.4,
      vx:    (Math.random() - 0.5) * 1.2,
      vy:    (Math.random() - 0.5) * 1.2 - 0.4,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      decay: Math.random() * 0.018 + 0.008,
      grow:  false,
    });
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x     += p.vx;
      p.y     += p.vy;
      p.vy    -= 0.018; // slight upward drift
      p.alpha -= p.decay;
      if (p.alpha <= 0) { particles.splice(i, 1); continue; }

      // Outer glow
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      grd.addColorStop(0, hexAlpha(p.color, p.alpha * 0.6));
      grd.addColorStop(1, hexAlpha(p.color, 0));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ── ORBITAL ACADEMIC NODE SYSTEM ─────────────────────────
  // subject nodes orbit slowly around the login card
  const SUBJECTS = [
    { label: 'Physics',         icon: '⚛',  color: '#6366f1', orbit: 0, phase: 0.00 },
    { label: 'Algorithms',      icon: '🔢',  color: '#06b6d4', orbit: 0, phase: 2.09 },
    { label: 'Mathematics',     icon: '∑',   color: '#f472b6', orbit: 0, phase: 4.19 },
    { label: 'Data Structures', icon: '🌲',  color: '#34d399', orbit: 1, phase: 1.05 },
    { label: 'Networks',        icon: '🌐',  color: '#fbbf24', orbit: 1, phase: 3.14 },
  ];

  // orbital ellipse parameters [radiusX, radiusY (in screen coords), angular speed rad/ms]
  const ORBITS = [
    { rx: 210, ry: 62, speed: 0.00045, tilt: 0.30 },
    { rx: 272, ry: 80, speed: -0.00030, tilt: 0.30 },
  ];

  let startTime = null;

  function getCardCenter() {
    const card = document.getElementById('auth-card');
    if (card) {
      const r = card.getBoundingClientRect();
      return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 };
    }
    return { x: W * 0.5, y: H * 0.5 };
  }

  function drawOrbitalSystem(elapsed) {
    const cc = getCardCenter();

    // Draw orbit tracks
    ORBITS.forEach((o, i) => {
      ctx.save();
      ctx.translate(cc.x, cc.y);
      ctx.scale(1, o.tilt);        // squash Y to simulate 3-D tilt
      ctx.beginPath();
      ctx.ellipse(0, 0, o.rx, o.ry / o.tilt, 0, 0, Math.PI * 2);
      ctx.strokeStyle = i === 0
        ? 'rgba(99,102,241,0.14)'
        : 'rgba(6,182,212,0.10)';
      ctx.lineWidth  = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });

    // Draw nodes
    SUBJECTS.forEach(s => {
      const o     = ORBITS[s.orbit];
      const angle = s.phase + elapsed * o.speed;
      // 3-D projected position (tilt in Y)
      const x = cc.x + Math.cos(angle) * o.rx;
      const y = cc.y + Math.sin(angle) * o.ry * o.tilt;

      // depth-based scale (nodes "closer" appear larger when sin > 0)
      const depth = (Math.sin(angle) * 0.5 + 0.5); // 0–1
      const scale = 0.65 + depth * 0.55;
      const rDot  = 4.5 * scale;
      const alpha = 0.35 + depth * 0.65;

      // Glow halo
      const grd = ctx.createRadialGradient(x, y, 0, x, y, 22 * scale);
      grd.addColorStop(0, hexAlpha(s.color, alpha * 0.5));
      grd.addColorStop(1, hexAlpha(s.color, 0));
      ctx.beginPath();
      ctx.arc(x, y, 22 * scale, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(x, y, rDot, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = s.color;
      ctx.shadowBlur  = 10 * scale;
      ctx.fill();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;

      // Label (only when node is "in front" — depth > 0.4)
      if (depth > 0.4) {
        ctx.globalAlpha = (depth - 0.4) / 0.6 * 0.75;
        ctx.font        = `${9 + scale * 3}px "Inter", sans-serif`;
        ctx.fillStyle   = '#e2e8f0';
        ctx.textAlign   = 'center';
        ctx.fillText(s.label, x, y + rDot + 12 * scale);
        ctx.globalAlpha = 1;
      }
    });
  }

  // ── CARD 3-D TILT EFFECT ─────────────────────────────────
  const card = document.getElementById('auth-card');
  const TILT_MAX  = 7;          // max degrees
  const TILT_EASE = 0.12;       // spring factor

  let tiltRX = 0, tiltRY = 0;  // current tilt
  let targetRX = 0, targetRY = 0;

  document.addEventListener('mousemove', e => {
    if (!card) return;
    const r  = card.getBoundingClientRect();
    const cx = r.left + r.width * 0.5;
    const cy = r.top  + r.height * 0.5;
    // Normalized -1 to +1 relative to viewport centre
    const dx = (e.clientX - cx) / (W * 0.5);
    const dy = (e.clientY - cy) / (H * 0.5);
    targetRX = -dy * TILT_MAX;
    targetRY =  dx * TILT_MAX;
  });

  document.addEventListener('mouseleave', () => { targetRX = 0; targetRY = 0; });

  function applyTilt() {
    if (!card) return;
    tiltRX += (targetRX - tiltRX) * TILT_EASE;
    tiltRY += (targetRY - tiltRY) * TILT_EASE;
    card.style.transform =
      `perspective(1000px) rotateX(${tiltRX.toFixed(2)}deg) rotateY(${tiltRY.toFixed(2)}deg) translateZ(4px)`;
  }

  // ── AI ORB ────────────────────────────────────────────────
  // The orb CSS handles the pulsing ring animation.
  // Here we just ensure it's set up (click to open chat demo, etc.)
  const aiOrb = document.getElementById('ai-orb');
  if (aiOrb) {
    aiOrb.addEventListener('click', () => {
      // Could open the demo or scroll to sign-up — for now, focus the email
      const inp = document.getElementById('loginEmail');
      if (inp) { inp.focus(); inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  }

  // ── BUTTON RIPPLE EFFECT ──────────────────────────────────
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', function (e) {
      const glow = this.querySelector('.btn-glow');
      if (!glow) return;
      glow.style.cssText = `left:${e.offsetX}px;top:${e.offsetY}px;opacity:1;transform:scale(0)`;
      requestAnimationFrame(() => {
        glow.style.transition = 'transform 0.55s ease, opacity 0.55s ease';
        glow.style.transform  = 'scale(4)';
        glow.style.opacity    = '0';
      });
    });
  }

  // ── FEATURE CHIP HOVER SPARKLES ───────────────────────────
  document.querySelectorAll('.feature-chip').forEach(chip => {
    chip.addEventListener('mouseenter', e => {
      const r  = chip.getBoundingClientRect();
      const cx = r.left + r.width * 0.5;
      const cy = r.top;
      for (let i = 0; i < 6; i++) {
        particles.push({
          x:     cx + (Math.random() - 0.5) * r.width,
          y:     cy,
          r:     Math.random() * 1.5 + 0.5,
          alpha: 0.7,
          vx:    (Math.random() - 0.5) * 1.5,
          vy:    -Math.random() * 2 - 1,
          color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
          decay: 0.02,
        });
      }
    });
  });

  // ── SUCCESS ANIMATION ────────────────────────────────────
  window.triggerLoginSuccess = function (callback) {
    if (!card) { callback(); return; }

    // Swap form for success overlay
    const form    = card.querySelector('.auth-form');
    const brand   = card.querySelector('.brand');
    const status  = card.querySelector('.card-status-bar');
    const success = document.getElementById('signInSuccess');

    if (form)   { form.style.transition   = 'opacity 0.4s'; form.style.opacity   = '0'; }
    if (brand)  { brand.style.transition  = 'opacity 0.3s'; brand.style.opacity  = '0'; }
    if (status) { status.style.transition = 'opacity 0.3s'; status.style.opacity = '0'; }

    setTimeout(() => {
      if (form)   form.style.display   = 'none';
      if (brand)  brand.style.display  = 'none';
      if (status) status.style.display = 'none';

      if (success) {
        success.classList.remove('hidden');
        success.style.display = 'flex';
      }

      // Burst of particles from card centre
      const cr = card.getBoundingClientRect();
      for (let i = 0; i < 40; i++) {
        const angle = (i / 40) * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        particles.push({
          x:     cr.left + cr.width * 0.5,
          y:     cr.top  + cr.height * 0.5,
          r:     Math.random() * 3 + 1,
          alpha: 1,
          vx:    Math.cos(angle) * speed,
          vy:    Math.sin(angle) * speed,
          color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
          decay: 0.012,
        });
      }

      // Fade card out after success display, then redirect
      setTimeout(() => {
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        card.style.opacity    = '0';
        card.style.transform  = 'perspective(1000px) scale(1.06) translateY(-20px)';
        setTimeout(() => callback(), 650);
      }, 1400);
    }, 450);
  };

  // ── UTILITY ──────────────────────────────────────────────
  function hexAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  // ── MAIN ANIMATION LOOP ──────────────────────────────────
  let prevTime = 0;
  let spawnAcc = 0;

  function frame(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;
    const dt      = ts - prevTime;
    prevTime      = ts;

    ctx.clearRect(0, 0, W, H);

    // Orbital system
    drawOrbitalSystem(elapsed);

    // Cursor particles
    spawnAcc += dt;
    if (spawnAcc > 35 && isMoving) {
      spawnParticle();
      if (dt < 20) spawnParticle(); // extra at high fps
      spawnAcc = 0;
    }
    updateParticles();

    // Card tilt
    applyTilt();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(ts => {
    prevTime = ts;
    requestAnimationFrame(frame);
  });

})();
