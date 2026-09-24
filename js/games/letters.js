/* Letter Blaster: fly a small ship over the page and shoot its letters.
   Loaded on demand. AkbrLetters.start(root) wraps every visible letter inside root in <blast-l> elements,
   which no stylesheet targets, so the page looks the same; stop() puts the plain text back. */
(function () {
  'use strict';
  if (window.AkbrLetters) return;

  var ROW = 80;                                       /* height of the buckets letters are sorted into */
  var root = null, canvas = null, ctx = null, hud = null, countEl = null, msgEl = null, soundBtn = null;
  var running = false, raf = 0, last = 0, dpr = 1, W = 0, H = 0;
  var letters = [], rows = {}, bullets = [], sparks = [], pops = [], ship = null, keys = {}, left = 0, total = 0;
  var cooldown = 0, holding = null, startedAt = 0, cleared = false, listeners = [], combo = 0, comboT = 0, guardUntil = 0;
  var colors = { ship: '#F2C84B', edge: '#1E1C19', shot: '#2A4392' };
  var touch = window.matchMedia('(hover: none)').matches;

  function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); }

  /* ---------- sound, made on the fly with Web Audio ---------- */
  var audio = null, master = null, noiseBuf = null, rumble = null, rumbleGain = null;
  var soundOn = true;
  try { soundOn = localStorage.getItem('akbr-arcade-sound') !== 'off'; } catch (e) {}

  function wake() {
    if (!soundOn) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio) {
      audio = new AC();
      var comp = audio.createDynamicsCompressor();
      master = audio.createGain(); master.gain.value = 0.55;
      master.connect(comp); comp.connect(audio.destination);
      noiseBuf = audio.createBuffer(1, audio.sampleRate * 0.6, audio.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (audio.state === 'suspended') audio.resume();
  }
  function live() { return soundOn && audio && audio.state === 'running'; }
  function tone(type, f0, f1, dur, vol, delay) {
    if (!live()) return;
    var t = audio.currentTime + (delay || 0);
    var o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function hiss(dur, freq, vol) {
    if (!live()) return;
    var t = audio.currentTime;
    var src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
    src.buffer = noiseBuf;
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.1;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
  }
  var sfx = {
    start: function () { tone('triangle', 330, 660, 0.16, 0.12); tone('triangle', 495, 990, 0.16, 0.1, 0.09); },
    shot: function () { tone('square', 1300, 190, 0.1, 0.05); },
    hit: function () {
      var lift = Math.pow(2, Math.min(combo, 12) / 12);
      hiss(0.11, 1500 + Math.random() * 1500, 0.4);
      tone('triangle', 540 * lift, 300 * lift, 0.09, 0.07);
    },
    clear: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone('triangle', f, f * 1.01, 0.26, 0.11, i * 0.1); }); }
  };
  function thrustSound(onNow) {
    if (!live()) { onNow = false; }
    if (onNow && !rumble) {
      rumble = audio.createBufferSource(); rumble.buffer = noiseBuf; rumble.loop = true;
      var f = audio.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      rumbleGain = audio.createGain(); rumbleGain.gain.value = 0.0001;
      rumble.connect(f); f.connect(rumbleGain); rumbleGain.connect(master);
      rumble.start();
      rumbleGain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.08);
    } else if (!onNow && rumble) {
      var r = rumble, g = rumbleGain;
      rumble = rumbleGain = null;
      if (audio) {
        g.gain.setValueAtTime(g.gain.value, audio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.12);
        r.stop(audio.currentTime + 0.15);
      }
    }
  }
  function setSound(onNow) {
    soundOn = onNow;
    try { localStorage.setItem('akbr-arcade-sound', onNow ? 'on' : 'off'); } catch (e) {}
    if (onNow) wake(); else thrustSound(false);
    if (soundBtn) {
      soundBtn.setAttribute('aria-pressed', onNow ? 'true' : 'false');
      soundBtn.textContent = onNow ? 'Sound on' : 'Sound off';
    }
  }

  /* ---------- the letters ---------- */
  var fixedCache = null;
  function pinned(el) {
    /* letters inside fixed or sticky boxes move with the screen, so they are left alone */
    for (var n = el; n && n !== root; n = n.parentElement) {
      if (fixedCache.has(n)) return fixedCache.get(n);
      var pos = getComputedStyle(n).position;
      if (pos === 'fixed' || pos === 'sticky') { fixedCache.set(n, true); return true; }
    }
    fixedCache.set(el, false);
    return false;
  }
  function wrap(el) {
    fixedCache = new Map();
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        if (!p || p.closest('script, style, noscript, svg, button, dialog, canvas, blast-w, [aria-hidden="true"], [hidden], [inert]')) return NodeFilter.FILTER_REJECT;
        if (pinned(p)) return NodeFilter.FILTER_REJECT;
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
        var word = document.createElement('blast-w');
        part.split('').forEach(function (ch) {
          var s = document.createElement('blast-l');
          s.textContent = ch;
          word.appendChild(s);
        });
        frag.appendChild(word);
      });
      n.parentNode.replaceChild(frag, n);
    });
  }
  function unwrap(el) {
    Array.prototype.forEach.call(el.querySelectorAll('blast-w'), function (w) {
      var parent = w.parentNode;
      parent.replaceChild(document.createTextNode(w.textContent), w);
      parent.normalize();
    });
  }
  function collect() {
    var styles = new Map();
    letters = Array.prototype.map.call(root.querySelectorAll('blast-l'), function (el) {
      var p = el.parentNode.parentNode, st = styles.get(p);
      if (!st) {
        var cs = getComputedStyle(p);
        st = { color: cs.color, font: cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily, hidden: cs.visibility === 'hidden' || cs.opacity === '0' };
        styles.set(p, st);
      }
      return { el: el, ch: el.textContent, x: 0, y: 0, w: 0, h: 0, dead: st.hidden, color: st.color, font: st.font };
    });
    measure();
    total = left = letters.filter(function (L) { return !L.dead; }).length;
  }
  function measure() {
    var sx = window.scrollX, sy = window.scrollY;
    rows = {};
    letters.forEach(function (L) {
      if (L.dead) return;
      var r = L.el.getBoundingClientRect();
      L.x = r.left + sx; L.y = r.top + sy; L.w = r.width; L.h = r.height;
      if (!L.w || !L.h) { if (!L.gone) { L.dead = true; } return; }
      var a = Math.floor(L.y / ROW), b = Math.floor((L.y + L.h) / ROW);
      for (var k = a; k <= b; k++) (rows[k] = rows[k] || []).push(L);
    });
  }

  /* ---------- the ship ---------- */
  function fire() {
    if (cooldown > 0 || bullets.length > 8) return;
    cooldown = 0.13;
    var c = Math.cos(ship.a), s = Math.sin(ship.a);
    bullets.push({ x: ship.x + c * 16, y: ship.y + s * 16, vx: c * 780 + ship.vx * 0.4, vy: s * 780 + ship.vy * 0.4, life: 1.1 });
    sfx.shot();
  }
  function burst(L) {
    L.dead = true; L.gone = true;
    left--;
    L.el.className = 'hit';
    combo = comboT > 0 ? combo + 1 : 0;
    comboT = 0.6;
    var cx = L.x - window.scrollX + L.w / 2, cy = L.y - window.scrollY + L.h / 2;
    pops.push({ ch: L.ch, font: L.font, color: L.color, x: cx, y: cy, t: 0, spin: (Math.random() - 0.5) * 3 });
    for (var i = 0; i < 9; i++) {
      var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 180;
      sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + Math.random() * 0.4, max: 0.9, color: L.color, r: 1.5 + Math.random() * 2 });
    }
    sfx.hit();
    updateHud();
    if (!left) finish();
  }
  function hitTest(px, py) {
    var bucket = rows[Math.floor(py / ROW)];
    if (!bucket) return null;
    for (var j = 0; j < bucket.length; j++) {
      var L = bucket[j];
      if (!L.dead && px >= L.x - 2 && px <= L.x + L.w + 2 && py >= L.y - 2 && py <= L.y + L.h + 2) return L;
    }
    return null;
  }

  function update(dt) {
    var k = keys;
    if (k.left) ship.a -= 4.6 * dt;
    if (k.right) ship.a += 4.6 * dt;
    if (!!k.up !== ship.thrust) thrustSound(!!k.up);
    ship.thrust = !!k.up;
    if (k.up) { ship.vx += Math.cos(ship.a) * 560 * dt; ship.vy += Math.sin(ship.a) * 560 * dt; }
    var drag = Math.pow(0.4, dt);
    ship.vx *= drag; ship.vy *= drag;
    var sp = Math.hypot(ship.vx, ship.vy);
    if (sp > 520) { ship.vx *= 520 / sp; ship.vy *= 520 / sp; }
    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    if (ship.x < -12) ship.x = W + 12; if (ship.x > W + 12) ship.x = -12;
    if (ship.y < -12) ship.y = H + 12; if (ship.y > H + 12) ship.y = -12;

    if (holding) ship.a = Math.atan2(holding.y - ship.y, holding.x - ship.x);
    cooldown -= dt;
    comboT -= dt;
    if (!cleared && (k.fire || holding)) fire();

    var sx = window.scrollX, sy = window.scrollY;
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      var hit = hitTest(b.x + sx, b.y + sy);
      if (hit) { burst(hit); bullets.splice(i, 1); continue; }
      if (b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) bullets.splice(i, 1);
    }
    for (var n = sparks.length - 1; n >= 0; n--) {
      var p = sparks[n];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt;
      if (p.life <= 0) sparks.splice(n, 1);
    }
    for (var m = pops.length - 1; m >= 0; m--) { pops[m].t += dt; if (pops[m].t > 0.45) pops.splice(m, 1); }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    pops.forEach(function (p) {
      var k = p.t / 0.45, scale = k < 0.35 ? 1 + k * 2 : 1.7 - (k - 0.35) * 2.4;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.translate(p.x, p.y - k * 14); ctx.rotate(p.spin * k); ctx.scale(Math.max(0.1, scale), Math.max(0.1, scale));
      ctx.font = p.font; ctx.fillStyle = k < 0.35 ? colors.ship : p.color;
      ctx.fillText(p.ch, 0, 0);
      ctx.restore();
    });
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
    thrustSound(false);
    sfx.clear();
    msgEl.textContent = 'Page cleared in ' + clock(performance.now() - startedAt) + '.';
    hud.querySelector('[data-stop]').textContent = 'Put it back';
  }

  var KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ' ': 'fire' };
  function onKey(e, down) {
    if (e.key === 'Escape' && down) { e.preventDefault(); stop(); return; }
    if (KEYMAP[e.key]) {
      e.preventDefault(); e.stopPropagation();
      keys[KEYMAP[e.key]] = down;
      if (down) wake();
    }
  }
  function point(e) { return { x: e.clientX, y: e.clientY }; }

  function start(el) {
    if (running) return;
    root = el || document.querySelector('main') || document.body;
    wrap(root);
    collect();
    if (!total) { unwrap(root); return; }
    running = true; cleared = false; bullets = []; sparks = []; pops = []; keys = {}; holding = null; last = 0; combo = 0;
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
    hud.innerHTML = '<span class="blast-count"></span><span class="blast-msg"></span>' +
      '<button type="button" class="blast-sound" aria-pressed="true">Sound on</button><button type="button" data-stop>Stop</button>';
    countEl = hud.querySelector('.blast-count');
    msgEl = hud.querySelector('.blast-msg');
    soundBtn = hud.querySelector('.blast-sound');
    msgEl.textContent = touch ? 'Tap or hold to shoot, swipe to scroll.' : 'Arrows to fly, Space to shoot, Esc to stop.';
    document.body.appendChild(hud);
    /* the finger that started the game may lift over the bar, so ignore it for a moment */
    guardUntil = performance.now() + 700;
    hud.querySelector('[data-stop]').addEventListener('click', function () { if (performance.now() > guardUntil) stop(); });
    soundBtn.addEventListener('click', function () { if (performance.now() > guardUntil) setSound(!soundOn); });
    setSound(soundOn);
    updateHud();

    var css = getComputedStyle(document.documentElement);
    colors.shot = css.getPropertyValue('--pen').trim() || colors.shot;
    colors.ship = css.getPropertyValue('--mark').trim() || colors.ship;
    colors.edge = css.getPropertyValue('--ink').trim() || colors.edge;
    size();
    ship = { x: W / 2, y: H - hud.offsetHeight - 70, vx: 0, vy: 0, a: -Math.PI / 2, thrust: false };

    wake();
    sfx.start();
    on(window, 'keydown', function (e) { onKey(e, true); }, true);
    on(window, 'keyup', function (e) { onKey(e, false); }, true);
    on(window, 'resize', size);
    on(canvas, 'pointerdown', function (e) {
      wake();
      holding = point(e);
      if (e.pointerType === 'mouse') { e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    });
    on(canvas, 'pointermove', function (e) { if (holding) holding = point(e); });
    on(canvas, 'pointerup', function () { holding = null; wake(); });
    on(canvas, 'pointercancel', function () { holding = null; });
    on(canvas, 'wheel', function (e) { window.scrollBy(0, e.deltaY); }, { passive: true });
    loop();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
    thrustSound(false);
    listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
    listeners = [];
    if (canvas) canvas.remove();
    if (hud) hud.remove();
    canvas = hud = ctx = soundBtn = null;
    unwrap(root);
    document.documentElement.classList.remove('blasting');
    letters = []; rows = {}; bullets = []; sparks = []; pops = [];
  }

  var api = {
    start: start,
    stop: stop,
    get state() { return { running: running, left: left, total: total, cleared: cleared, sound: soundOn, audio: audio ? audio.state : 'none' }; },
    /* for tests: fire one shot straight at a letter that is on screen */
    aimAt: function (i) {
      var sy = window.scrollY, onScreen = letters.filter(function (x) { return !x.dead && x.y - sy > 0 && x.y - sy < H; });
      var L = onScreen[i || 0];
      if (!L || !ship) return false;
      var tx = L.x - window.scrollX + L.w / 2, ty = L.y - sy + L.h / 2;
      ship.a = Math.atan2(ty - ship.y, tx - ship.x); cooldown = 0; fire(); return true;
    }
  };
  window.AkbrLetters = api;
  /* the arcade lists it as a game that plays on the page itself */
  window.AkbrGames = window.AkbrGames || {};
  window.AkbrGames.letters = { title: 'Letter Blaster', pageGame: true, start: start };
})();
