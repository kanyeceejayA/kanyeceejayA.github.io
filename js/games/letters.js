/* Letter blaster: fly a small ship over the page and shoot its letters.
   Loaded on demand. AkbrLetters.start(root) wraps every letter inside root, AkbrLetters.stop() puts them back. */
(function () {
  'use strict';
  if (window.AkbrLetters) return;

  var root = null, canvas = null, ctx = null, hud = null, countEl = null, msgEl = null;
  var running = false, raf = 0, last = 0, dpr = 1, W = 0, H = 0;
  var letters = [], bullets = [], sparks = [], ship = null, keys = {}, left = 0, total = 0;
  var cooldown = 0, holding = null, startedAt = 0, cleared = false, listeners = [];
  var colors = { ship: '#F2C84B', edge: '#1E1C19', shot: '#2A4392' };
  var touch = window.matchMedia('(hover: none)').matches;

  function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); }

  /* ---------- the letters ---------- */
  function wrap(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || p.closest('script, style, noscript, svg, button, .lt-word, [aria-hidden="true"], [hidden]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var frag = document.createDocumentFragment();
      n.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var word = document.createElement('span');
        word.className = 'lt-word';
        part.split('').forEach(function (ch) {
          var s = document.createElement('span');
          s.className = 'lt';
          s.textContent = ch;
          word.appendChild(s);
        });
        frag.appendChild(word);
      });
      n.parentNode.replaceChild(frag, n);
    });
  }
  function unwrap(el) {
    Array.prototype.forEach.call(el.querySelectorAll('.lt-word'), function (w) {
      var parent = w.parentNode;
      parent.replaceChild(document.createTextNode(w.textContent), w);
      parent.normalize();
    });
  }
  function collect() {
    letters = Array.prototype.map.call(root.querySelectorAll('.lt'), function (el) {
      return { el: el, x: 0, y: 0, w: 0, h: 0, dead: false, color: getComputedStyle(el).color };
    });
    measure();
    letters.forEach(function (L) { if (!L.w || !L.h) L.dead = true; });
    total = left = letters.filter(function (L) { return !L.dead; }).length;
  }
  function measure() {
    var sx = window.scrollX, sy = window.scrollY;
    letters.forEach(function (L) {
      if (L.dead) return;
      var r = L.el.getBoundingClientRect();
      L.x = r.left + sx; L.y = r.top + sy; L.w = r.width; L.h = r.height;
    });
  }

  /* ---------- the ship ---------- */
  function fire() {
    if (cooldown > 0 || bullets.length > 8) return;
    cooldown = 0.13;
    var c = Math.cos(ship.a), s = Math.sin(ship.a);
    bullets.push({ x: ship.x + c * 16, y: ship.y + s * 16, vx: c * 780 + ship.vx * 0.4, vy: s * 780 + ship.vy * 0.4, life: 1.1 });
  }
  function burst(L) {
    L.dead = true;
    left--;
    L.el.classList.add('lt-hit');
    var sx = window.scrollX, sy = window.scrollY;
    var cx = L.x - sx + L.w / 2, cy = L.y - sy + L.h / 2;
    for (var i = 0; i < 9; i++) {
      var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 180;
      sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + Math.random() * 0.4, max: 0.9, color: L.color, r: 1.5 + Math.random() * 2 });
    }
    updateHud();
    if (!left) finish();
  }

  function update(dt) {
    var k = keys;
    if (k.left) ship.a -= 4.6 * dt;
    if (k.right) ship.a += 4.6 * dt;
    ship.thrust = !!k.up;
    if (k.up) { ship.vx += Math.cos(ship.a) * 560 * dt; ship.vy += Math.sin(ship.a) * 560 * dt; }
    var drag = Math.pow(0.4, dt);
    ship.vx *= drag; ship.vy *= drag;
    var sp = Math.hypot(ship.vx, ship.vy);
    if (sp > 520) { ship.vx *= 520 / sp; ship.vy *= 520 / sp; }
    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    if (ship.x < -12) ship.x = W + 12; if (ship.x > W + 12) ship.x = -12;
    if (ship.y < -12) ship.y = H + 12; if (ship.y > H + 12) ship.y = -12;

    if (holding) { ship.a = Math.atan2(holding.y - ship.y, holding.x - ship.x); }
    cooldown -= dt;
    if (k.fire || holding) fire();

    var sx = window.scrollX, sy = window.scrollY;
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      var px = b.x + sx, py = b.y + sy, hit = null;
      for (var j = 0; j < letters.length; j++) {
        var L = letters[j];
        if (L.dead) continue;
        if (px >= L.x - 2 && px <= L.x + L.w + 2 && py >= L.y - 2 && py <= L.y + L.h + 2) { hit = L; break; }
      }
      if (hit) { burst(hit); bullets.splice(i, 1); continue; }
      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) bullets.splice(i, 1);
    }
    for (var n = sparks.length - 1; n >= 0; n--) {
      var p = sparks[n];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt;
      if (p.life <= 0) sparks.splice(n, 1);
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    sparks.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.shot;
    bullets.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill(); });
    if (cleared) return;
    ctx.save();
    ctx.translate(ship.x, ship.y); ctx.rotate(ship.a);
    if (ship.thrust) {
      ctx.fillStyle = '#E8763A';
      ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(-20 - Math.random() * 7, 0); ctx.lineTo(-9, 5); ctx.fill();
    }
    ctx.fillStyle = colors.ship; ctx.strokeStyle = colors.edge; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-11, -10); ctx.lineTo(-6, 0); ctx.lineTo(-11, 10); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function step(now) {
      if (!running) return;
      var dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      update(dt); draw();
      raf = requestAnimationFrame(step);
    });
  }

  /* ---------- the chrome around it ---------- */
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    measure();
  }
  function updateHud() {
    if (countEl) countEl.textContent = left + (left === 1 ? ' letter' : ' letters') + ' left';
  }
  function clock(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function finish() {
    cleared = true;
    msgEl.textContent = 'Page cleared in ' + clock(performance.now() - startedAt) + '.';
    hud.querySelector('[data-stop]').textContent = 'Put it back';
  }

  function onKey(e, down) {
    var map = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ' ': 'fire' };
    if (e.key === 'Escape' && down) { e.preventDefault(); stop(); return; }
    if (map[e.key]) { e.preventDefault(); keys[map[e.key]] = down; }
  }
  function point(e) { return { x: e.clientX, y: e.clientY }; }

  function start(el) {
    if (running) return;
    root = el || document.querySelector('main') || document.body;
    wrap(root);
    collect();
    if (!total) { unwrap(root); return; }
    running = true; cleared = false; bullets = []; sparks = []; keys = {}; holding = null; last = 0;
    startedAt = performance.now();
    document.documentElement.classList.add('blasting');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();

    canvas = document.createElement('canvas');
    canvas.className = 'blast-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d');
    document.body.appendChild(canvas);

    hud = document.createElement('div');
    hud.className = 'blast-hud';
    hud.setAttribute('role', 'status');
    hud.innerHTML = '<span class="blast-count"></span><span class="blast-msg"></span><button type="button" data-stop>Stop</button>';
    countEl = hud.querySelector('.blast-count');
    msgEl = hud.querySelector('.blast-msg');
    msgEl.textContent = touch ? 'Tap to shoot.' : 'Arrows to fly, Space to shoot, Esc to stop.';
    document.body.appendChild(hud);
    hud.querySelector('[data-stop]').addEventListener('click', stop);
    updateHud();

    var css = getComputedStyle(document.documentElement);
    colors.shot = css.getPropertyValue('--pen').trim() || colors.shot;
    colors.ship = css.getPropertyValue('--mark').trim() || colors.ship;
    colors.edge = css.getPropertyValue('--ink').trim() || colors.edge;
    size();
    ship = { x: W / 2, y: H - 90, vx: 0, vy: 0, a: -Math.PI / 2, thrust: false };

    on(window, 'keydown', function (e) { onKey(e, true); });
    on(window, 'keyup', function (e) { onKey(e, false); });
    on(window, 'resize', size);
    on(window, 'scroll', measure, { passive: true });
    on(canvas, 'pointerdown', function (e) { e.preventDefault(); holding = point(e); try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
    on(canvas, 'pointermove', function (e) { if (holding) holding = point(e); });
    on(canvas, 'pointerup', function () { holding = null; });
    on(canvas, 'pointercancel', function () { holding = null; });
    on(canvas, 'wheel', function (e) { window.scrollBy(0, e.deltaY); }, { passive: true });
    loop();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    listeners = [];
    if (canvas) canvas.remove();
    if (hud) hud.remove();
    canvas = hud = ctx = null;
    unwrap(root);
    document.documentElement.classList.remove('blasting');
    letters = []; bullets = []; sparks = [];
  }

  window.AkbrLetters = {
    start: start,
    stop: stop,
    get state() { return { running: running, left: left, total: total, cleared: cleared }; },
    /* for tests: fire one shot straight at a letter */
    aimAt: function (i) {
      var L = letters.filter(function (x) { return !x.dead; })[i || 0];
      if (!L || !ship) return false;
      var tx = L.x - window.scrollX + L.w / 2, ty = L.y - window.scrollY + L.h / 2;
      ship.a = Math.atan2(ty - ship.y, tx - ship.x); cooldown = 0; fire(); return true;
    }
  };
})();
