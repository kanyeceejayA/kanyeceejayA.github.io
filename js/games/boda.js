/* Boda Dispatch: carry passengers across Kampala before dusk. */
(function () {
  'use strict';
  window.AkbrGames = window.AkbrGames || {};

  var NAMES = ['Wandegeya', 'Kisementi', 'Old Taxi Park', 'Ntinda', 'Kabalagala', 'Nakasero', 'Kansanga', 'Bugolobi'];
  var COLORS = ['#2A4392', '#B85C38', '#2F7D4F', '#2C7DA0', '#B8860B', '#7A4E9C'];
  var DAY = 100, G = 90, M = 58, ROAD = 26, BAND_TOP = 46, BAND_BOTTOM = 44;
  var DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

  var stage, api, canvas, ctx, raf = 0, last = 0, dpr = 1, scale = 1, offX = 0, offY = 0;
  var NX = 7, NY = 5, W = 0, H = 0;
  var s = null, mode = 'ready', listeners = [];

  function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); listeners.push([el, ev, fn, opt]); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function hash(n) { var x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }

  /* ---------- the street grid ---------- */
  function idx(i, j) { return j * NX + i; }
  function ij(n) { return { i: n % NX, j: Math.floor(n / NX) }; }
  function pos(n) { var c = ij(n); return { x: M + c.i * G, y: M + c.j * G }; }
  function key(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
  function neighbor(n, d) {
    var c = ij(n), i = c.i + d.x, j = c.j + d.y;
    if (i < 0 || j < 0 || i >= NX || j >= NY) return -1;
    var m = idx(i, j);
    return s.edges[key(n, m)] ? m : -1;
  }
  function degree(n) { return DIRS.filter(function (d) { return neighbor(n, d) >= 0; }).length; }
  function connected() {
    var seen = {}, q = [0]; seen[0] = true;
    while (q.length) { var n = q.shift(); DIRS.forEach(function (d) { var m = neighbor(n, d); if (m >= 0 && !seen[m]) { seen[m] = true; q.push(m); } }); }
    return Object.keys(seen).length === NX * NY;
  }
  function manhattan(a, b) { var p = ij(a), q = ij(b); return Math.abs(p.i - q.i) + Math.abs(p.j - q.j); }

  function buildCity() {
    var portrait = canvas.clientHeight > canvas.clientWidth * 1.05;
    NX = portrait ? 4 : 7; NY = portrait ? 6 : 5;
    W = 2 * M + G * (NX - 1); H = 2 * M + G * (NY - 1);
    s.edges = {};
    for (var j = 0; j < NY; j++) for (var i = 0; i < NX; i++) {
      if (i < NX - 1) s.edges[key(idx(i, j), idx(i + 1, j))] = true;
      if (j < NY - 1) s.edges[key(idx(i, j), idx(i, j + 1))] = true;
    }
    var remove = portrait ? 2 : 4, tries = 0;
    while (remove > 0 && tries++ < 200) {
      var ks = Object.keys(s.edges), k = pick(ks), ab = k.split('-').map(Number);
      delete s.edges[k];
      if (degree(ab[0]) < 2 || degree(ab[1]) < 2 || !connected()) { s.edges[k] = true; continue; }
      remove--;
    }
    // stages sit on the edge of town, spread apart
    var rim = [];
    for (var n = 0; n < NX * NY; n++) { var c = ij(n); if (c.i === 0 || c.j === 0 || c.i === NX - 1 || c.j === NY - 1) rim.push(n); }
    rim.sort(function () { return Math.random() - 0.5; });
    var names = NAMES.slice().sort(function () { return Math.random() - 0.5; });
    s.stages = [];
    var want = portrait ? 4 : 5;
    rim.forEach(function (n) {
      if (s.stages.length >= want) return;
      if (s.stages.every(function (st) { return manhattan(st.node, n) >= 3; })) {
        s.stages.push({ node: n, name: names[s.stages.length], color: COLORS[s.stages.length % COLORS.length] });
      }
    });
  }

  /* ---------- vehicles ---------- */
  function vpos(v) {
    var p = pos(v.node);
    if (!v.dir) return p;
    return { x: p.x + v.dir.x * v.prog, y: p.y + v.dir.y * v.prog };
  }
  function advance(v, dt, choose) {
    if (!v.dir) {
      var d0 = choose(v);
      if (d0 && neighbor(v.node, d0) >= 0) { v.dir = d0; v.prog = 0; } else return;
    }
    v.prog += v.speed * dt;
    while (v.prog >= G) {
      v.prog -= G;
      v.node = neighbor(v.node, v.dir);
      var d = choose(v);
      if (d && neighbor(v.node, d) >= 0) v.dir = d;
      else if (neighbor(v.node, v.dir) < 0) { v.dir = null; v.prog = 0; break; }
    }
  }
  function chooseBoda(v) { return s.want || v.dir; }
  function chooseMatatu(v) {
    var opts = DIRS.filter(function (d) {
      return neighbor(v.node, d) >= 0 && !(v.dir && d.x === -v.dir.x && d.y === -v.dir.y);
    });
    if (!opts.length) return v.dir ? { x: -v.dir.x, y: -v.dir.y } : null;
    if (v.dir && Math.random() < 0.55 && opts.some(function (d) { return d.x === v.dir.x && d.y === v.dir.y; })) return v.dir;
    return pick(opts);
  }
  function steer(d) {
    s.want = d;
    var b = s.boda;
    if (b.dir && d.x === -b.dir.x && d.y === -b.dir.y) {    // turn around mid-street
      b.node = neighbor(b.node, b.dir);
      b.prog = G - b.prog;
      b.dir = d;
    }
  }

  /* ---------- a day of fares ---------- */
  function newDay() {
    s = { t: 0, fares: 0, trips: 0, want: null, waiting: [], carrying: null, floats: [], spawnIn: 1.2, shake: 0, seed: Math.floor(Math.random() * 997) };
    buildCity();
    var startNode = idx(Math.floor(NX / 2), Math.floor(NY / 2));
    s.boda = { node: startNode, dir: null, prog: 0, speed: 150, stun: 0, cool: 0 };
    s.matatus = [];
    var count = NX > NY ? 3 : 2;
    for (var k = 0; k < count; k++) {
      var n; do { n = Math.floor(Math.random() * NX * NY); } while (manhattan(n, startNode) < 3);
      s.matatus.push({ node: n, dir: null, prog: 0, speed: rand(85, 105) });
    }
    spawn(); spawn();
  }

  function spawn() {
    if (s.waiting.length >= 3) return;
    var taken = {};
    s.stages.forEach(function (st) { taken[st.node] = 1; });
    s.waiting.forEach(function (p) { taken[p.node] = 1; });
    var tries = 0, n;
    do { n = Math.floor(Math.random() * NX * NY); tries++; }
    while ((taken[n] || manhattan(n, s.boda.node) < 2 || degree(n) === 0) && tries < 60);
    if (tries >= 60) return;
    var dests = s.stages.filter(function (st) { return manhattan(st.node, n) >= 2; });
    s.waiting.push({ node: n, dest: pick(dests.length ? dests : s.stages), patience: 22, max: 22 });
  }

  function float(x, y, text, color) { s.floats.push({ x: x, y: y, text: text, color: color, life: 1.4 }); }

  function update(dt) {
    s.t += dt;
    if (s.t >= DAY) { end(); return; }
    var b = s.boda, bp;
    b.cool = Math.max(0, b.cool - dt);
    if (b.stun > 0) b.stun -= dt; else advance(b, dt, chooseBoda);
    bp = vpos(b);
    s.matatus.forEach(function (m) {
      advance(m, dt, chooseMatatu);
      var mp = vpos(m);
      if (b.cool <= 0 && Math.hypot(mp.x - bp.x, mp.y - bp.y) < 20) {
        b.stun = 1.1; b.cool = 2.2; s.shake = 0.35;
        var loss = Math.min(500, s.fares); s.fares -= loss;
        float(bp.x, bp.y - 16, loss ? '-' + api.ugx(loss) : 'Bump!', '#C0392B');
      }
    });
    s.spawnIn -= dt;
    if (s.spawnIn <= 0) { spawn(); s.spawnIn = rand(2.4, 4.8); }
    for (var i = s.waiting.length - 1; i >= 0; i--) {
      var p = s.waiting[i], pp = pos(p.node);
      p.patience -= dt;
      if (p.patience <= 0) { s.waiting.splice(i, 1); float(pp.x, pp.y - 14, 'Gave up', '#6B665D'); continue; }
      if (!s.carrying && Math.hypot(pp.x - bp.x, pp.y - bp.y) < 14) {
        s.carrying = { from: p.node, dest: p.dest, t0: s.t };
        s.waiting.splice(i, 1);
        float(pp.x, pp.y - 16, 'To ' + p.dest.name, p.dest.color);
      }
    }
    if (s.carrying) {
      var dp = pos(s.carrying.dest.node);
      if (Math.hypot(dp.x - bp.x, dp.y - bp.y) < 16) {
        var dist = manhattan(s.carrying.from, s.carrying.dest.node);
        var fare = 1000 + 500 * dist;
        if (s.t - s.carrying.t0 < 4 + dist * 1.1) fare += 500;
        s.fares += fare; s.trips++;
        float(dp.x, dp.y - 18, '+' + api.ugx(fare), '#2F7D4F');
        s.carrying = null;
      }
    }
    s.shake = Math.max(0, s.shake - dt);
    for (var f = s.floats.length - 1; f >= 0; f--) { s.floats[f].life -= dt; s.floats[f].y -= dt * 22; if (s.floats[f].life <= 0) s.floats.splice(f, 1); }
  }

  function end() {
    mode = 'over';
    var best = api.store('boda-best') || 0;
    s.newBest = s.fares > best;
    if (s.newBest) api.store('boda-best', s.fares);
    cancelAnimationFrame(raf);
    draw();
  }

  /* ---------- drawing ---------- */
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = ((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
    var g = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
    var bl = (pa & 255) + (((pb & 255) - (pa & 255)) * t);
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(bl) + ')';
  }

  function drawBlocks() {
    for (var j = 0; j < NY - 1; j++) for (var i = 0; i < NX - 1; i++) {
      var a = pos(idx(i, j)), inset = ROAD / 2 + 5;
      var x = a.x + inset, y = a.y + inset, w = G - inset * 2, h = G - inset * 2, r = hash(i * 31 + j * 17 + s.seed);
      if (r < 0.22) {
        ctx.fillStyle = '#B9C98F'; roundRect(x, y, w, h, 6); ctx.fill();
        for (var t = 0; t < 4; t++) {
          ctx.fillStyle = t % 2 ? '#5E8C4A' : '#6FA055';
          ctx.beginPath(); ctx.arc(x + 12 + hash(r * 9 + t) * (w - 24), y + 12 + hash(r * 7 + t * 3) * (h - 24), 8, 0, 7); ctx.fill();
        }
      } else if (r < 0.34) {
        ctx.fillStyle = '#E4D5B5'; roundRect(x, y, w, h, 6); ctx.fill();
        var stalls = ['#E07A5F', '#F2C84B', '#3D9970', '#2C7DA0', '#B85C38', '#9B5DE5'];
        for (var q = 0; q < 6; q++) {
          ctx.fillStyle = stalls[q];
          ctx.fillRect(x + 6 + (q % 3) * (w - 12) / 3, y + 8 + Math.floor(q / 3) * (h - 16) / 2, (w - 12) / 3 - 4, (h - 16) / 2 - 6);
        }
      } else {
        ctx.fillStyle = '#DED0B4'; roundRect(x, y, w, h, 6); ctx.fill();
        var n = 2 + Math.floor(r * 3);
        for (var k = 0; k < n; k++) {
          var bw = w / 2 - 6, bh = h / 2 - 6, bx = x + 4 + (k % 2) * (w / 2), by = y + 4 + Math.floor(k / 2) * (h / 2);
          ctx.fillStyle = '#F4EEE2'; ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = hash(k + r * 13) > 0.5 ? '#B85C38' : '#8E4A30';
          ctx.fillRect(bx, by, bw, bh * 0.45);
        }
      }
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawRoads() {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#5A544B'; ctx.lineWidth = ROAD;
    Object.keys(s.edges).forEach(function (k) {
      var ab = k.split('-').map(Number), a = pos(ab[0]), b = pos(ab[1]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(244,239,230,.55)'; ctx.lineWidth = 2; ctx.setLineDash([7, 9]);
    Object.keys(s.edges).forEach(function (k) {
      var ab = k.split('-').map(Number), a = pos(ab[0]), b = pos(ab[1]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.setLineDash([]);
  }
  function drawStages() {
    s.stages.forEach(function (st) {
      var p = pos(st.node), c = ij(st.node), target = s.carrying && s.carrying.dest === st;
      var pulse = target ? 6 + Math.sin(s.t * 6) * 3 : 0;
      ctx.fillStyle = st.color; ctx.globalAlpha = target ? 0.35 : 0.18;
      ctx.beginPath(); ctx.arc(p.x, p.y, 20 + pulse, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3; ctx.strokeStyle = st.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, 7); ctx.stroke();
      ctx.font = '700 13px "Atkinson Hyperlegible Next", sans-serif';
      var tw = ctx.measureText(st.name).width + 14;
      var lx = p.x - tw / 2, ly = c.j === 0 ? p.y - 44 : (c.j === NY - 1 ? p.y + 22 : p.y - 44);
      if (c.i === 0 && c.j !== 0 && c.j !== NY - 1) { lx = p.x - tw + 12; ly = p.y - 44; }
      lx = Math.max(4, Math.min(W - tw - 4, lx));
      ctx.fillStyle = st.color; roundRect(lx, ly, tw, 22, 6); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText(st.name, lx + tw / 2, ly + 15); ctx.textAlign = 'left';
    });
  }
  function drawPassenger(p) {
    var pp = pos(p.node), frac = Math.max(0, p.patience / p.max);
    ctx.strokeStyle = '#1E1C19'; ctx.globalAlpha = 0.15; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 15, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = frac < 0.3 ? '#C0392B' : p.dest.color;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 15, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); ctx.stroke();
    ctx.fillStyle = p.dest.color; ctx.beginPath(); ctx.arc(pp.x, pp.y + 3, 6, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#3B2A20'; ctx.beginPath(); ctx.arc(pp.x, pp.y - 6, 4.5, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(pp.x + 7, pp.y - 1); ctx.rotate(-0.6);                    // a waving arm
    ctx.strokeStyle = '#3B2A20'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -8 - Math.sin(s.t * 8) * 2); ctx.stroke();
    ctx.restore();
  }
  function drawMatatu(m) {
    var p = vpos(m), d = m.dir || { x: 1, y: 0 };
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(d.y, d.x));
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(-15, -7, 32, 17);
    ctx.fillStyle = '#F4F4F0'; roundRect(-16, -9, 32, 18, 4); ctx.fill();
    for (var q = 0; q < 8; q++) { ctx.fillStyle = q % 2 ? '#2A4392' : '#F4F4F0'; ctx.fillRect(-14 + q * 3.5, -2, 3.5, 4); }
    ctx.fillStyle = '#2B3340'; ctx.fillRect(9, -7, 5, 14);
    ctx.restore();
  }
  function drawBoda() {
    var b = s.boda, p = vpos(b), d = b.dir || s.lastDir || { x: 1, y: 0 };
    if (b.dir) s.lastDir = b.dir;
    var jig = b.stun > 0 ? Math.sin(s.t * 60) * 2 : 0;
    ctx.save(); ctx.translate(p.x + jig, p.y); ctx.rotate(Math.atan2(d.y, d.x)); ctx.scale(1.3, 1.3);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(-11, -4, 24, 10);
    ctx.fillStyle = '#1E1C19'; roundRect(-12, -3, 24, 6, 3); ctx.fill();
    ctx.fillStyle = '#B85C38'; roundRect(-4, -5, 12, 10, 3); ctx.fill();
    if (s.carrying) { ctx.fillStyle = s.carrying.dest.color; ctx.beginPath(); ctx.arc(-7, 0, 5.5, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#F2C84B'; ctx.beginPath(); ctx.arc(2, 0, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#1E1C19'; ctx.fillRect(10, -5, 3, 10);
    ctx.restore();
    if (s.carrying) {                                                                  // a pointer to the stage
      var dp = pos(s.carrying.dest.node), ang = Math.atan2(dp.y - p.y, dp.x - p.x);
      if (Math.hypot(dp.x - p.x, dp.y - p.y) > 40) {
        ctx.save(); ctx.translate(p.x + Math.cos(ang) * 28, p.y + Math.sin(ang) * 28); ctx.rotate(ang);
        ctx.fillStyle = s.carrying.dest.color; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.fill();
        ctx.restore();
      }
    }
  }

  function draw() {
    if (!ctx) return;
    var cw = canvas.width, ch = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#CDBF9F'; ctx.fillRect(0, 0, cw, ch);
    if (!s) return;
    var shx = s.shake > 0 ? (Math.random() - 0.5) * 6 : 0, shy = s.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (offX + shx), dpr * (offY + shy));
    ctx.fillStyle = '#E8DDC8'; roundRect(0, 0, W, H, 14); ctx.fill();
    drawBlocks(); drawRoads(); drawStages();
    s.waiting.forEach(drawPassenger);
    s.matatus.forEach(drawMatatu);
    drawBoda();
    s.floats.forEach(function (f) {
      ctx.globalAlpha = Math.min(1, f.life); ctx.fillStyle = f.color;
      ctx.font = '700 14px "Atkinson Hyperlegible Next", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    });
    // the light goes
    var k = Math.min(1, s.t / DAY);
    if (k > 0.35) {
      var dk = (k - 0.35) / 0.65;
      ctx.fillStyle = dk < 0.6 ? 'rgba(232,120,60,' + (dk * 0.28) + ')' : 'rgba(22,28,60,' + ((dk - 0.6) * 1.1) + ')';
      ctx.fillRect(-M, -M, W + 2 * M, H + 2 * M);
    }
    // score line, in screen space
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cssW = canvas.clientWidth, left = Math.max(0, DAY - s.t);
    ctx.fillStyle = 'rgba(248,246,241,.92)'; roundRectScreen(8, 8, 170, 30); ctx.fill();
    ctx.fillStyle = 'rgba(248,246,241,.92)'; roundRectScreen(cssW - 140, 8, 132, 30); ctx.fill();
    ctx.fillStyle = '#1E1C19'; ctx.font = '600 16px Fraunces, Georgia, serif';
    ctx.fillText('Fares ' + api.ugx(s.fares), 18, 29);
    ctx.textAlign = 'right'; ctx.font = '600 14px "Atkinson Hyperlegible Next", sans-serif';
    ctx.fillText('Dusk in ' + Math.floor(left / 60) + ':' + ('0' + Math.floor(left % 60)).slice(-2), cssW - 18, 28);
    ctx.textAlign = 'left';
    if (s.carrying && mode === 'play') {
      var label = 'Carrying a passenger to ' + s.carrying.dest.name;
      ctx.font = '600 14px "Atkinson Hyperlegible Next", sans-serif';
      var lw = ctx.measureText(label).width + 24;
      ctx.fillStyle = s.carrying.dest.color; roundRectScreen(cssW / 2 - lw / 2, canvas.clientHeight - 36, lw, 28); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.fillText(label, cssW / 2, canvas.clientHeight - 17); ctx.textAlign = 'left';
    }
    if (mode !== 'play') overlay();
  }
  function roundRectScreen(x, y, w, h) { roundRect(x, y, w, h, 8); }

  function fit(text, y, font, size, color) {
    var cssW = canvas.clientWidth, px = size;
    ctx.font = font.replace('SIZE', px);
    while (px > 12 && ctx.measureText(text).width > cssW - 40) { px--; ctx.font = font.replace('SIZE', px); }
    ctx.fillStyle = color; ctx.fillText(text, cssW / 2, y);
  }
  function overlay() {
    var cssW = canvas.clientWidth, cssH = canvas.clientHeight, cy = cssH / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(20,18,15,.6)'; ctx.fillRect(0, 0, cssW, cssH);
    ctx.textAlign = 'center';
    var serif = '600 SIZEpx Fraunces, Georgia, serif', sans = '400 SIZEpx "Atkinson Hyperlegible Next", sans-serif', bold = '700 SIZEpx "Atkinson Hyperlegible Next", sans-serif';
    var tap = api.touchy();
    if (mode === 'ready') {
      fit('Boda Dispatch', cy - 52, serif, 32, '#F8F6F1');
      fit('Pick up passengers and drop them at their stage.', cy - 16, sans, 16, '#F8F6F1');
      fit('Mind the matatus. The day ends at dusk.', cy + 8, sans, 16, '#F8F6F1');
      fit(tap ? 'Tap to start' : 'Press Space to start', cy + 50, bold, 17, '#F2C84B');
    } else if (mode === 'paused') {
      fit('Paused', cy - 10, serif, 30, '#F8F6F1');
      fit(tap ? 'Tap to carry on' : 'Press Space to carry on', cy + 30, bold, 17, '#F2C84B');
    } else if (mode === 'over') {
      fit('Dusk.', cy - 60, serif, 32, '#F8F6F1');
      fit('You made ' + api.ugx(s.fares) + ' on ' + s.trips + (s.trips === 1 ? ' trip.' : ' trips.'), cy - 22, sans, 17, '#F8F6F1');
      fit(s.newBest ? 'Your best day yet.' : 'Best day: ' + api.ugx(api.store('boda-best') || 0), cy + 4, sans, 17, '#F8F6F1');
      fit(tap ? 'Tap to ride again' : 'Press Space to ride again', cy + 46, bold, 17, '#F2C84B');
    }
    ctx.textAlign = 'left';
  }

  /* ---------- loop and input ---------- */
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function step(now) {
      if (mode !== 'play') { draw(); return; }
      var dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      update(dt);
      draw();
      if (mode === 'play') raf = requestAnimationFrame(step);
    });
  }
  function begin() {
    if (mode === 'paused') { mode = 'play'; last = 0; loop(); return; }
    newDay(); size(); mode = 'play'; last = 0; loop();
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    if (!W) { W = 2 * M + G * 6; H = 2 * M + G * 4; }
    var room = canvas.clientHeight - BAND_TOP - BAND_BOTTOM;
    scale = Math.min((canvas.clientWidth - 16) / W, room / H);
    offX = (canvas.clientWidth - W * scale) / 2;
    offY = BAND_TOP + (room - H * scale) / 2;
    draw();
  }
  function onKey(e) {
    var k = e.key, map = { ArrowRight: 0, d: 0, D: 0, ArrowLeft: 1, a: 1, A: 1, ArrowDown: 2, s: 2, S: 2, ArrowUp: 3, w: 3, W: 3 };
    if (e.target.closest && e.target.closest('button')) return;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); if (mode !== 'play') begin(); return; }
    if (k === 'p' || k === 'P') { if (mode === 'play') { mode = 'paused'; draw(); } else if (mode === 'paused') begin(); return; }
    if (map[k] !== undefined) { e.preventDefault(); if (mode === 'play') steer(DIRS[map[k]]); }
  }
  var press = null;
  function onDown(e) { e.preventDefault(); press = { x: e.clientX, y: e.clientY }; }
  function onUp(e) {
    if (!press) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y; press = null;
    if (mode !== 'play') { begin(); return; }
    if (Math.abs(dx) > 18 || Math.abs(dy) > 18) {
      steer(Math.abs(dx) > Math.abs(dy) ? DIRS[dx > 0 ? 0 : 1] : DIRS[dy > 0 ? 2 : 3]);
      return;
    }
    var r = canvas.getBoundingClientRect();                                       // tap: head that way
    var wx = (e.clientX - r.left - offX) / scale, wy = (e.clientY - r.top - offY) / scale;
    var bp = vpos(s.boda), tx = wx - bp.x, ty = wy - bp.y;
    if (Math.abs(tx) < 6 && Math.abs(ty) < 6) return;
    steer(Math.abs(tx) > Math.abs(ty) ? DIRS[tx > 0 ? 0 : 1] : DIRS[ty > 0 ? 2 : 3]);
  }

  window.AkbrGames.boda = {
    title: 'Boda Dispatch',
    mount: function (el, a) {
      stage = el; api = a; mode = 'ready'; last = 0;
      canvas = document.createElement('canvas');
      canvas.className = 'game-canvas';
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Boda Dispatch: a top-down map of Kampala streets with a boda boda, passengers and stages.');
      stage.appendChild(canvas);
      ctx = canvas.getContext('2d');
      newDay();
      api.setHelp(api.touchy()
        ? 'Tap where you want to go, or swipe. Pick up a passenger, then ride to their stage.'
        : 'Arrow keys or WASD to ride. Pick up a passenger, then ride to their stage. P pauses.');
      on(api.dialog, 'keydown', onKey);
      on(canvas, 'pointerdown', onDown);
      on(canvas, 'pointerup', onUp);
      on(window, 'resize', size);
      on(document, 'visibilitychange', function () { if (document.hidden && mode === 'play') { mode = 'paused'; draw(); } });
      requestAnimationFrame(function () { size(); canvas.focus({ preventScroll: true }); });
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
      listeners = []; ctx = null; s = null;
    }
  };
})();
