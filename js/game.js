/* Count before dusk: a small hidden game.
   An enumerator runs a Kampala road with a census tablet. Jump the potholes,
   duck the marabou storks, count every household. The light goes as you run. */
(function () {
  'use strict';
  if (window.AkbrGame) return;

  var VH = 300;            // virtual height; the world is drawn in these units
  var GROUND = VH - 52;    // y of the road surface
  var BEST_KEY = 'akbr-game-best';

  var dlg, canvas, ctx, help;
  var VW = 760, scale = 1, dpr = 1;
  var raf = 0, lastTs = 0;
  var state = 'ready';     // ready | play | paused | over
  var night = false;       // started from the Konami code
  var g = {};              // game state

  function best() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { return 0; } }
  function saveBest(n) { try { localStorage.setItem(BEST_KEY, String(n)); } catch (e) {} }
  function touchy() { return window.matchMedia('(hover: none)').matches; }

  function reset() {
    g = {
      t: 0, dist: 0, counted: 0, speed: 300, phase: night ? 0.88 : 0,
      spawnIn: 1.4, houseIn: 0.9, things: [], bits: [], cause: '',
      p: { y: 0, vy: 0, duck: false, onGround: true, cycle: 0 }
    };
  }

  /* ---------- building the dialog ---------- */
  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'modal game-modal';
    dlg.setAttribute('aria-labelledby', 'game-title');
    dlg.innerHTML =
      '<div class="game-head">' +
        '<h2 id="game-title">Count before dusk</h2>' +
        '<button class="modal-close" type="button" aria-label="Close the game">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>' +
      '<canvas class="game-canvas" role="img" aria-label="A running game: jump the potholes, duck the marabou storks, collect the houses."></canvas>' +
      '<p class="game-help"></p>';
    document.body.appendChild(dlg);
    canvas = dlg.querySelector('canvas');
    ctx = canvas.getContext('2d');
    help = dlg.querySelector('.game-help');
    canvas.setAttribute('tabindex', '0');
    canvas.autofocus = true;

    dlg.querySelector('.modal-close').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('close', stop);
    dlg.addEventListener('keydown', onKey);
    dlg.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('resize', function () { if (dlg.open) size(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state === 'play') { state = 'paused'; draw(); }
    });
  }

  function size() {
    var cssW = canvas.clientWidth || 700, cssH = canvas.clientHeight || 300;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = cssH / VH;
    VW = cssW / scale;
    draw();
  }

  function setHelp() {
    help.textContent = touchy()
      ? 'Tap the right side to jump. Hold the left side to duck.'
      : 'Space or ↑ to jump. ↓ to duck. Esc to leave.';
  }

  /* ---------- controls ---------- */
  function startOrJump() {
    if (state === 'ready' || state === 'over') { reset(); state = 'play'; lastTs = 0; loop(); return; }
    if (state === 'paused') { state = 'play'; lastTs = 0; loop(); return; }
    jump();
  }
  function jump() {
    var p = g.p;
    if (p.onGround && !p.duck) { p.vy = -820; p.onGround = false; }
  }
  function onKey(e) {
    var k = e.key;
    if (e.target.closest && e.target.closest('.modal-close')) return;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'Enter') {
      e.preventDefault(); startOrJump();
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      e.preventDefault(); if (state === 'play') g.p.duck = true;
    } else if (k === 'p' || k === 'P') {
      if (state === 'play') { state = 'paused'; draw(); } else if (state === 'paused') startOrJump();
    }
  }
  function onKeyUp(e) {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { if (g.p) g.p.duck = false; }
  }
  var duckPointer = null;
  function onPointerDown(e) {
    e.preventDefault();
    if (state !== 'play') { startOrJump(); return; }
    var r = canvas.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.4) { g.p.duck = true; duckPointer = e.pointerId; }
    else jump();
  }
  function onPointerUp(e) {
    if (duckPointer === e.pointerId) { g.p.duck = false; duckPointer = null; }
  }

  /* ---------- the loop ---------- */
  function loop(ts) {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function step(now) {
      if (state !== 'play') { draw(); return; }
      var dt = lastTs ? Math.min((now - lastTs) / 1000, 1 / 30) : 1 / 60;
      lastTs = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(step);
    });
  }
  function stop() {
    cancelAnimationFrame(raf);
    if (state === 'play') state = 'paused';
    document.body.classList.remove('modal-open');
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function update(dt) {
    var p = g.p;
    g.t += dt;
    g.speed = 300 + Math.min(430, g.t * 8.5);
    var dx = g.speed * dt;
    g.dist += dx;
    g.phase = Math.min(1, (night ? 0.88 : 0) + g.t / 90);

    // runner
    p.vy += 2600 * dt * (p.duck && !p.onGround ? 1.8 : 1);
    p.y += p.vy * dt;
    if (p.y >= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
    p.cycle += dt * g.speed / 38;

    // spawn obstacles
    g.spawnIn -= dt;
    if (g.spawnIn <= 0) {
      var storkOk = g.t > 9;
      var roll = Math.random();
      if (storkOk && roll < 0.34) {
        var high = Math.random() < 0.3;
        g.things.push({ kind: 'stork', x: VW + 40, y: high ? GROUND - 128 : GROUND - 62, w: 50, h: 24, flap: rand(0, 6), high: high, vx: rand(40, 90) });
      } else {
        var w = rand(34, 62 + Math.min(30, g.t));
        g.things.push({ kind: 'hole', x: VW + 20, w: w });
        if (g.t > 25 && Math.random() < 0.18) g.things.push({ kind: 'hole', x: VW + 20 + w + rand(150, 190), w: rand(30, 44) });
      }
      g.spawnIn = rand(0.9, 1.6) * Math.max(0.72, 440 / (g.speed + 60));
    }
    // spawn houses to count
    g.houseIn -= dt;
    if (g.houseIn <= 0) {
      var clear = g.things.every(function (o) { return o.kind === 'house' || Math.abs(o.x - (VW + 30)) > 90; });
      if (clear) {
        var air = Math.random() < 0.45;
        g.things.push({ kind: 'house', x: VW + 30, y: air ? GROUND - 112 : GROUND - 20, bob: rand(0, 6) });
        g.houseIn = rand(0.7, 1.7);
      } else g.houseIn = 0.2;
    }

    // move and collide
    var ph = p.duck ? 30 : 56;
    var box = { l: 90 - 10, r: 90 + 10, t: GROUND + p.y - ph, b: GROUND + p.y };
    for (var i = g.things.length - 1; i >= 0; i--) {
      var o = g.things[i];
      o.x -= dx + (o.kind === 'stork' ? o.vx * dt : 0);
      if (o.kind === 'stork') o.flap += dt * 9;
      if (o.x < -140) { g.things.splice(i, 1); continue; }
      if (o.kind === 'hole') {
        var inHole = p.onGround && box.r - 4 > o.x + 10 && box.l + 4 < o.x + o.w - 10;
        if (inHole) return crash('Pothole. Kampala claims another runner.');
      } else if (o.kind === 'stork') {
        var sl = o.x - o.w / 2 + 8, sr = o.x + o.w / 2 - 8, st = o.y - o.h / 2 + 5, sb = o.y + o.h / 2 - 3;
        if (box.r > sl && box.l < sr && box.t < sb && box.b > st) return crash('A marabou stork had other plans.');
      } else if (o.kind === 'house') {
        var hy = o.y + Math.sin(g.t * 3 + o.bob) * 3;
        if (box.r > o.x - 13 && box.l < o.x + 13 && box.t < hy + 12 && box.b > hy - 14) {
          g.counted++;
          g.bits.push({ x: o.x, y: hy - 18, life: 1 });
          g.things.splice(i, 1);
        }
      }
    }
    for (var j = g.bits.length - 1; j >= 0; j--) {
      g.bits[j].life -= dt * 1.4; g.bits[j].y -= dt * 40;
      if (g.bits[j].life <= 0) g.bits.splice(j, 1);
    }
  }

  function crash(why) {
    state = 'over';
    g.cause = why;
    if (g.counted > best()) { saveBest(g.counted); g.newBest = true; }
    cancelAnimationFrame(raf);
    draw();
  }

  /* ---------- drawing ---------- */
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
    var gg = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
    var bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
    return 'rgb(' + r + ',' + gg + ',' + bl + ')';
  }
  function tri(day, dusk, nite, ph) { return ph < 0.5 ? mix(day, dusk, ph * 2) : mix(dusk, nite, (ph - 0.5) * 2); }
  function hash(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

  function hillY(x, off, base, amp, f) {
    var u = x + off;
    return base - amp * (0.55 + 0.45 * Math.sin(u * f)) - amp * 0.3 * Math.sin(u * f * 2.3 + 1.3);
  }

  function drawHills(off, base, amp, f, col, withHouses, ph) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (var x = 0; x <= VW + 8; x += 8) ctx.lineTo(x, hillY(x, off, base, amp, f));
    ctx.lineTo(VW, GROUND); ctx.closePath(); ctx.fill();
    if (!withHouses) return;
    var step = 34, k0 = Math.floor(off / step);
    for (var k = k0; k < k0 + VW / step + 2; k++) {
      if (hash(k) < 0.42) continue;
      var hx = k * step - off + hash(k + 7) * 14;
      var hy = hillY(hx, off, base, amp, f) + 5;
      var hw = 9 + hash(k + 3) * 5, hh = 6 + hash(k + 5) * 3;
      ctx.fillStyle = tri('#EFE6D6', '#E7C7A6', '#3A3D55', ph);
      ctx.fillRect(hx, hy - hh, hw, hh);
      ctx.fillStyle = tri('#B85C38', '#A24E33', '#4B2E2A', ph);
      ctx.beginPath(); ctx.moveTo(hx - 1.5, hy - hh); ctx.lineTo(hx + hw / 2, hy - hh - 5); ctx.lineTo(hx + hw + 1.5, hy - hh); ctx.fill();
      if (ph > 0.62 && hash(k + 11) > 0.35) { ctx.fillStyle = '#F2C84B'; ctx.fillRect(hx + hw / 2 - 1.5, hy - hh + 2, 3, 3); }
    }
  }

  function drawRunner(ph) {
    var p = g.p || { y: 0, duck: false, cycle: 0, onGround: true };
    var ink = ph > 0.6 ? '#F4EFE6' : '#1E1C19';
    var x = 90, feet = GROUND + p.y;
    var c = p.cycle, run = p.onGround ? 1 : 0.25;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = ink; ctx.lineWidth = 4;
    if (p.duck) {
      ctx.beginPath(); ctx.moveTo(x - 10, feet); ctx.lineTo(x - 2, feet - 12); ctx.lineTo(x + 8, feet); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 2, feet - 12); ctx.lineTo(x + 14, feet - 22); ctx.stroke();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x + 20, feet - 25, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#F2C84B'; ctx.fillRect(x + 8, feet - 18, 10, 7);
    } else {
      var hip = feet - 24, sh = feet - 44;
      var l1 = Math.sin(c) * 13 * run, l2 = -l1;
      ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x + l1 * 0.6, hip + 12); ctx.lineTo(x + l1, feet); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x + l2 * 0.6, hip + 12); ctx.lineTo(x + l2 - 2, feet); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, hip); ctx.lineTo(x + 3, sh); ctx.stroke();
      var a = Math.sin(c + Math.PI) * 10 * run;
      ctx.beginPath(); ctx.moveTo(x + 3, sh + 3); ctx.lineTo(x + 3 - a * 0.5, sh + 12); ctx.lineTo(x + 3 - a, sh + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 3, sh + 3); ctx.lineTo(x + 10, sh + 10); ctx.lineTo(x + 17, sh + 6); ctx.stroke();
      ctx.fillStyle = '#F2C84B'; ctx.save(); ctx.translate(x + 18, sh + 5); ctx.rotate(-0.35); ctx.fillRect(-4, -6, 10, 13); ctx.restore();
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x + 5, sh - 9, 7, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawStork(o, ph) {
    ctx.save(); ctx.translate(o.x, o.y);
    var wing = Math.sin(o.flap) * 12;
    ctx.fillStyle = ph > 0.6 ? '#3B3E4A' : '#2B2A2A';
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(-4, -16 - wing, 14, -20 - wing); ctx.lineTo(8, -2); ctx.fill();
    ctx.fillStyle = ph > 0.6 ? '#9A9AA3' : '#8C8A84';
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#EDEAE3'; ctx.beginPath(); ctx.ellipse(-2, 4, 12, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#E9A6A0'; ctx.beginPath(); ctx.ellipse(-17, 5, 4, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ph > 0.6 ? '#B8B2A6' : '#6E6A64';
    ctx.beginPath(); ctx.arc(-19, -5, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#D9CFA0'; ctx.beginPath(); ctx.moveTo(-22, -6); ctx.lineTo(-40, -1); ctx.lineTo(-22, -2); ctx.fill();
    ctx.strokeStyle = ph > 0.6 ? '#B8B2A6' : '#6E6A64'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12, 4); ctx.lineTo(30, 9); ctx.moveTo(12, 6); ctx.lineTo(29, 13); ctx.stroke();
    ctx.restore();
  }

  function drawHouse(o, ph) {
    var y = o.y + Math.sin(g.t * 3 + o.bob) * 3;
    ctx.save(); ctx.translate(o.x, y);
    ctx.shadowColor = 'rgba(242,200,75,.55)'; ctx.shadowBlur = ph > 0.5 ? 14 : 6;
    ctx.fillStyle = '#F8F6F1'; ctx.fillRect(-11, -8, 22, 17);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#B85C38'; ctx.beginPath(); ctx.moveTo(-14, -7); ctx.lineTo(0, -19); ctx.lineTo(14, -7); ctx.fill();
    ctx.fillStyle = '#2A4392'; ctx.fillRect(-3, 0, 6, 9);
    ctx.fillStyle = '#F2C84B'; ctx.fillRect(5, -4, 4, 4);
    ctx.restore();
  }

  function drawHole(o, ph) {
    var y = GROUND + 6;
    ctx.fillStyle = ph > 0.6 ? '#0E0F16' : '#2A2622';
    ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, y, o.w / 2, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = ph > 0.6 ? 'rgba(242,200,75,.35)' : 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.ellipse(o.x + o.w / 2 - 4, y + 1, o.w / 4, 2, 0, 0, 7); ctx.fill();
  }

  function draw() {
    if (!ctx) return;
    var ph = g.phase || (night ? 0.88 : 0);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    // sky
    var sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, tri('#F3E5C4', '#E48A5B', '#161C36', ph));
    sky.addColorStop(1, tri('#FBF4E4', '#F6C58E', '#343A63', ph));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
    // sun or moon
    var sunY = 60 + ph * 190;
    if (ph < 0.8) { ctx.fillStyle = tri('#F2C84B', '#F08A4B', '#C0532F', Math.min(1, ph * 1.3)); ctx.beginPath(); ctx.arc(VW - 120, sunY, 26, 0, 7); ctx.fill(); }
    if (ph > 0.6) {
      ctx.globalAlpha = Math.min(1, (ph - 0.6) * 3);
      ctx.fillStyle = '#F4EFE6'; ctx.beginPath(); ctx.arc(140, 64, 16, 0, 7); ctx.fill();
      ctx.fillStyle = tri('#F3E5C4', '#E48A5B', '#1C2340', ph); ctx.beginPath(); ctx.arc(147, 59, 14, 0, 7); ctx.fill();
      for (var s = 0; s < 28; s++) { ctx.fillStyle = '#F4EFE6'; ctx.fillRect(hash(s) * VW, hash(s + 40) * 120, 1.6, 1.6); }
      ctx.globalAlpha = 1;
    }
    var d = g.dist || 0;
    drawHills(d * 0.12, GROUND - 70, 42, 0.006, tri('#D7C9A8', '#C79A7E', '#262B48', ph), false, ph);
    drawHills(d * 0.3, GROUND - 22, 46, 0.011, tri('#BBA77F', '#A9796A', '#1E2340', ph), true, ph);
    // road with a murram edge
    ctx.fillStyle = tri('#B5643C', '#9B5134', '#4A2A24', ph); ctx.fillRect(0, GROUND - 3, VW, 5);
    ctx.fillStyle = tri('#57524A', '#4B4540', '#191A22', ph); ctx.fillRect(0, GROUND + 2, VW, VH - GROUND);
    ctx.fillStyle = ph > 0.6 ? 'rgba(242,200,75,.7)' : 'rgba(248,246,241,.75)';
    var dashOff = d % 60;
    for (var x = -dashOff; x < VW; x += 60) ctx.fillRect(x, GROUND + 28, 28, 3);

    (g.things || []).forEach(function (o) {
      if (o.kind === 'hole') drawHole(o, ph);
    });
    (g.things || []).forEach(function (o) {
      if (o.kind === 'house') drawHouse(o, ph);
      else if (o.kind === 'stork') drawStork(o, ph);
    });
    drawRunner(ph);
    (g.bits || []).forEach(function (b) {
      ctx.globalAlpha = Math.max(0, b.life);
      ctx.fillStyle = '#F2C84B'; ctx.font = '700 18px "Atkinson Hyperlegible Next", sans-serif';
      ctx.fillText('+1', b.x - 8, b.y);
      ctx.globalAlpha = 1;
    });

    // score line
    var ink = ph > 0.55 ? '#F4EFE6' : '#1E1C19';
    ctx.fillStyle = ink;
    ctx.font = '600 20px Fraunces, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('Counted ' + (g.counted || 0), 18, 32);
    ctx.textAlign = 'right';
    ctx.font = '500 15px "Atkinson Hyperlegible Next", sans-serif';
    ctx.fillText(((g.dist || 0) / 6000).toFixed(1) + ' km   Best ' + best(), VW - 18, 30);
    ctx.textAlign = 'left';

    if (state !== 'play') overlay(ph);
  }

  function fit(text, y, weight, size, family, color) {
    var px = size;
    ctx.font = weight + ' ' + px + 'px ' + family;
    while (px > 12 && ctx.measureText(text).width > VW - 36) { px -= 1; ctx.font = weight + ' ' + px + 'px ' + family; }
    ctx.fillStyle = color;
    ctx.fillText(text, VW / 2, y);
  }
  function overlay(ph) {
    ctx.fillStyle = 'rgba(20,18,15,.55)'; ctx.fillRect(0, 0, VW, VH);
    ctx.textAlign = 'center';
    var tap = touchy(), serif = 'Fraunces, Georgia, serif', sans = '"Atkinson Hyperlegible Next", sans-serif';
    var cream = '#F8F6F1', gold = '#F2C84B';
    if (state === 'ready') {
      fit(night ? 'Count after dark' : 'Count before dusk', 104, '600', 34, serif, cream);
      fit('Jump the potholes. Duck the marabou storks.', 140, '400', 16, sans, cream);
      fit('Count every house you pass.', 162, '400', 16, sans, cream);
      fit(tap ? 'Tap to start' : 'Press Space to start', 200, '600', 17, sans, gold);
    } else if (state === 'paused') {
      fit('Paused', 120, '600', 30, serif, cream);
      fit(tap ? 'Tap to carry on' : 'Space to carry on', 160, '600', 17, sans, gold);
    } else if (state === 'over') {
      var n = g.counted;
      fit(g.cause, 96, '600', 28, serif, cream);
      fit('You counted ' + n + (n === 1 ? ' household' : ' households') + ' in ' + (g.dist / 6000).toFixed(1) + ' km.', 134, '400', 17, sans, cream);
      fit(g.newBest ? 'That is a new best.' : 'Your best is ' + best() + '.', 160, '400', 17, sans, cream);
      fit(tap ? 'Tap to run again' : 'Space to run again', 200, '600', 17, sans, gold);
    }
    ctx.textAlign = 'left';
  }

  /* ---------- open and close ---------- */
  function open(opts) {
    night = !!(opts && opts.night);
    if (!dlg) build();
    document.querySelectorAll('dialog[open]').forEach(function (d) { if (d !== dlg && d.close) d.close(); });
    reset(); state = 'ready'; setHelp();
    dlg.querySelector('#game-title').textContent = night ? 'Count after dark' : 'Count before dusk';
    if (!dlg.open) dlg.showModal();
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { size(); canvas.focus({ preventScroll: true }); });
  }
  function close() { if (dlg && dlg.open) dlg.close(); }

  window.AkbrGame = { open: open, close: close };
})();
