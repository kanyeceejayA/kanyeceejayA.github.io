/* Enumerator's Route: plan the walk that counts every household before dusk.
   Map key: . path   ^ hill path (two steps)   h household   E start   = bridge   ~ river   # bush */
(function () {
  'use strict';
  window.AkbrGames = window.AkbrGames || {};

  var LEVELS = [
    { name: 'First parish', map: ['#######', '#E..h.#', '#.#.#.#', '#h...h#', '#######'] },
    { name: 'Two lanes', map: ['#########', '#E...h..#', '#.##.##.#', '#.h#...h#', '#...#h..#', '#########'] },
    { name: 'The river', map: ['##########', '#E..~..h.#', '#.#.~.##.#', '#h..=....#', '#.#.~.#h.#', '#...~..h.#', '##########'] },
    { name: 'Up the hill', map: ['##########', '#E.^^^.h.#', '#.#.#.#^.#', '#.^h^.^^.#', '#h#.#.#.h#', '#...^...h#', '##########'] },
    { name: 'Market day', map: ['###########', '#E..h~h...#', '#.#..~..#.#', '#.#h.=.h#.#', '#..#.~.#..#', '#h...~...h#', '#.#..=..#.#', '#...h~h...#', '###########'] },
    { name: 'Hills and a river', map: ['############', '#E.^^..h.~h#', '#.##.#.#.~.#', '#h..^^.#.=.#', '##.#.#...~h#', '#h.^.h.#.~.#', '#..#...^.=h#', '############'] },
    { name: 'Lakeside', map: ['############', '#E..h..~~~h#', '#.#.#.#~~~.#', '#.h....~~~.#', '#.#.#.#~~~h#', '#h..^..===.#', '#.#.#.#~~~.#', '#...h..~~~h#', '############'] },
    { name: 'The whole village', map: ['#############', '#E...h.^^.h.#', '#.##.#.##.#.#', '#.h..^...h..#', '#.#.##~##.#.#', '#h..~~~~~..h#', '#.#.#~~~#.#.#', '#..h..^..h..#', '#############'] }
  ];
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  var root, api, canvas, ctx, bar, dpr = 1, tile = 32, ox = 0, oy = 0, raf = 0;
  var listeners = [], L = null, mode = 'intro', walkQ = [], walkT = 0, lastTs = 0;

  function on(el, ev, fn) { el.addEventListener(ev, fn); listeners.push([el, ev, fn]); }
  function passable(c) { return '.^hE='.indexOf(c) >= 0; }
  function cost(c) { return c === '^' ? 2 : 1; }
  function hash(n) { var x = Math.sin(n * 91.345 + 7.13) * 43758.5453; return x - Math.floor(x); }
  function progress() { return api.store('route-progress') || {}; }
  function unlocked(i) { return i === 0 || progress()[i - 1] !== undefined; }

  /* ---------- the parish ---------- */
  function dijkstra(m, sx, sy) {
    var H = m.length, W = m[0].length, d = [], prev = [], q = [[0, sx, sy]];
    for (var y = 0; y < H; y++) { d.push([]); prev.push([]); for (var x = 0; x < W; x++) { d[y].push(Infinity); prev[y].push(null); } }
    d[sy][sx] = 0;
    while (q.length) {
      q.sort(function (a, b) { return a[0] - b[0]; });
      var cur = q.shift(), c = cur[0], cx = cur[1], cy = cur[2];
      if (c > d[cy][cx]) continue;
      DIRS.forEach(function (dd) {
        var nx = cx + dd[0], ny = cy + dd[1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !passable(m[ny][nx])) return;
        var nc = c + cost(m[ny][nx]);
        if (nc < d[ny][nx]) { d[ny][nx] = nc; prev[ny][nx] = [cx, cy]; q.push([nc, nx, ny]); }
      });
    }
    return { d: d, prev: prev };
  }
  function shortest(m, start, homes) {
    var pts = [start].concat(homes);
    var D = pts.map(function (p) { var r = dijkstra(m, p[0], p[1]).d; return pts.map(function (q) { return r[q[1]][q[0]]; }); });
    var k = homes.length, FULL = (1 << k) - 1, dp = [];
    for (var mask = 0; mask <= FULL; mask++) { dp.push([]); for (var i = 0; i < k; i++) dp[mask].push(Infinity); }
    for (i = 0; i < k; i++) dp[1 << i][i] = D[0][i + 1];
    for (mask = 1; mask <= FULL; mask++) for (i = 0; i < k; i++) {
      if (!(mask & (1 << i)) || dp[mask][i] === Infinity) continue;
      for (var j = 0; j < k; j++) { if (mask & (1 << j)) continue; var nm = mask | (1 << j); dp[nm][j] = Math.min(dp[nm][j], dp[mask][i] + D[i + 1][j + 1]); }
    }
    return Math.min.apply(null, dp[FULL]);
  }
  /* on a tall screen, lay a wide parish on its side; every walk keeps its length */
  function transpose(m) {
    var out = [];
    for (var x = 0; x < m[0].length; x++) { var row = ''; for (var y = 0; y < m.length; y++) row += m[y][x]; out.push(row); }
    return out;
  }
  function tall() { return !!canvas && canvas.clientHeight > canvas.clientWidth * 1.15; }
  function load(i) {
    var lv = LEVELS[i], m = lv.map, start = null, homes = [];
    if (tall() && m[0].length > m.length) m = transpose(m);
    m.forEach(function (row, y) { for (var x = 0; x < row.length; x++) { if (row[x] === 'E') start = [x, y]; if (row[x] === 'h') homes.push([x, y]); } });
    var par = shortest(m, start, homes);
    L = { i: i, name: lv.name, map: m, W: m[0].length, H: m.length, start: start, homes: homes, par: par,
          limit: Math.ceil(par * 1.3) + 2, pos: start.slice(), steps: 0, counted: [], trail: [start.slice()], undo: [] };
    walkQ = [];
    mode = 'play';
    renderBar(); size();
  }
  function countedAt(x, y) { for (var i = 0; i < L.counted.length; i++) if (L.counted[i][0] === x && L.counted[i][1] === y) return i; return -1; }

  function stepTo(nx, ny, record) {
    var c = L.map[ny][nx];
    if (record !== false) L.undo.push({ pos: L.pos.slice(), steps: L.steps, counted: L.counted.length, trail: L.trail.length });
    L.pos = [nx, ny]; L.steps += cost(c); L.trail.push([nx, ny]);
    if (c === 'h' && countedAt(nx, ny) < 0) L.counted.push([nx, ny]);
    if (L.counted.length === L.homes.length) finishLevel();
    else if (L.steps >= L.limit) { mode = 'dusk'; walkQ = []; renderBar(); }
  }
  function move(dx, dy) {
    if (mode !== 'play' || walkQ.length) return;
    var nx = L.pos[0] + dx, ny = L.pos[1] + dy;
    if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H || !passable(L.map[ny][nx])) return;
    stepTo(nx, ny);
    draw();
  }
  function walkTo(tx, ty) {
    if (mode !== 'play' || walkQ.length || !passable(L.map[ty][tx])) return;
    var r = dijkstra(L.map, L.pos[0], L.pos[1]);
    if (r.d[ty][tx] === Infinity || (tx === L.pos[0] && ty === L.pos[1])) return;
    var path = [], cur = [tx, ty];
    while (cur && !(cur[0] === L.pos[0] && cur[1] === L.pos[1])) { path.unshift(cur); cur = r.prev[cur[1]][cur[0]]; }
    L.undo.push({ pos: L.pos.slice(), steps: L.steps, counted: L.counted.length, trail: L.trail.length });
    walkQ = path; walkT = 0; lastTs = 0; animate();
  }
  function undo() {
    if (mode === 'done' || walkQ.length || !L.undo.length) return;
    var u = L.undo.pop();
    L.pos = u.pos; L.steps = u.steps; L.counted.length = u.counted; L.trail.length = u.trail;
    mode = 'play'; renderBar(); draw();
  }
  function restart() { load(L.i); }
  function finishLevel() {
    mode = 'done'; walkQ = [];
    var p = progress(), prev = p[L.i];
    L.newBest = prev === undefined || L.steps < prev;
    if (L.newBest) { p[L.i] = L.steps; api.store('route-progress', p); }
    renderBar();
  }
  function stars(steps, par) { return steps <= par ? 3 : (steps <= Math.ceil(par * 1.15) ? 2 : 1); }

  function animate() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function step(now) {
      var dt = lastTs ? (now - lastTs) / 1000 : 0; lastTs = now;
      walkT += dt;
      while (walkQ.length && walkT >= 0.09) {
        walkT -= 0.09;
        var n = walkQ.shift();
        stepTo(n[0], n[1], false);
        if (mode !== 'play') { walkQ = []; break; }
      }
      draw();
      if (walkQ.length) raf = requestAnimationFrame(step);
    });
  }

  /* ---------- drawing ---------- */
  function size() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    if (L) {
      tile = Math.floor(Math.min(cw / L.W, (ch - 50) / L.H));
      ox = Math.floor((cw - tile * L.W) / 2); oy = 44 + Math.floor((ch - 44 - tile * L.H) / 2);
    }
    draw();
  }
  function tileRect(x, y) { return [ox + x * tile, oy + y * tile]; }
  function drawTile(x, y, c) {
    var p = tileRect(x, y), X = p[0], Y = p[1], T = tile, r = hash(x * 13 + y * 7 + L.i);
    ctx.fillStyle = '#A9BF7E'; ctx.fillRect(X, Y, T, T);
    if (c === '#') {
      for (var k = 0; k < 3; k++) {
        ctx.fillStyle = k % 2 ? '#5C8A43' : '#6E9A4E';
        ctx.beginPath(); ctx.arc(X + T * (0.25 + hash(r * 3 + k) * 0.5), Y + T * (0.25 + hash(r * 5 + k * 2) * 0.5), T * (0.18 + hash(r + k) * 0.1), 0, 7); ctx.fill();
      }
      return;
    }
    if (c === '~' || c === '=') {
      ctx.fillStyle = '#5FA8CF'; ctx.fillRect(X, Y, T, T);
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = Math.max(1, T / 18);
      for (var w = 0; w < 2; w++) {
        ctx.beginPath(); ctx.moveTo(X + T * 0.15, Y + T * (0.35 + w * 0.3));
        ctx.quadraticCurveTo(X + T * 0.35, Y + T * (0.28 + w * 0.3), X + T * 0.5, Y + T * (0.35 + w * 0.3));
        ctx.quadraticCurveTo(X + T * 0.65, Y + T * (0.42 + w * 0.3), X + T * 0.85, Y + T * (0.35 + w * 0.3)); ctx.stroke();
      }
      if (c === '=') {
        ctx.fillStyle = '#8B5A33'; ctx.fillRect(X, Y + T * 0.18, T, T * 0.64);
        ctx.strokeStyle = '#6B4424'; ctx.lineWidth = Math.max(1, T / 20);
        for (var b = 1; b < 5; b++) { ctx.beginPath(); ctx.moveTo(X + b * T / 5, Y + T * 0.18); ctx.lineTo(X + b * T / 5, Y + T * 0.82); ctx.stroke(); }
      }
      return;
    }
    ctx.fillStyle = c === '^' ? '#BE7F4E' : '#D39A67';
    ctx.fillRect(X + 1, Y + 1, T - 2, T - 2);
    ctx.fillStyle = 'rgba(120,70,40,.18)';
    for (var s = 0; s < 4; s++) ctx.fillRect(X + hash(r * 11 + s) * (T - 4), Y + hash(r * 17 + s) * (T - 4), 2, 2);
    if (c === '^') {
      ctx.strokeStyle = 'rgba(90,50,25,.45)'; ctx.lineWidth = Math.max(1, T / 20);
      for (var a = 0; a < 2; a++) { ctx.beginPath(); ctx.arc(X + T / 2, Y + T * (0.95 + a * 0.2), T * (0.42 - a * 0.1), Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    }
    if (c === 'h') {
      var n = countedAt(x, y), hx = X + T * 0.2, hy = Y + T * 0.3, hw = T * 0.6, hh = T * 0.46;
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.fillRect(hx + 2, hy + 3, hw, hh);
      ctx.fillStyle = '#F4EEE2'; ctx.fillRect(hx, hy, hw, hh);
      ctx.fillStyle = '#B85C38'; ctx.beginPath(); ctx.moveTo(hx - T * 0.06, hy); ctx.lineTo(hx + hw / 2, hy - T * 0.22); ctx.lineTo(hx + hw + T * 0.06, hy); ctx.fill();
      ctx.fillStyle = '#2A4392'; ctx.fillRect(hx + hw * 0.38, hy + hh * 0.45, hw * 0.24, hh * 0.55);
      if (n >= 0) {                                    // the enumerator's chalk mark
        ctx.fillStyle = 'rgba(30,28,25,.55)'; ctx.fillRect(hx + hw * 0.05, hy + hh * 0.08, hw * 0.32, hh * 0.34);
        ctx.fillStyle = '#FFFFFF'; ctx.font = '700 ' + Math.max(9, Math.round(T * 0.2)) + 'px "Atkinson Hyperlegible Next", sans-serif';
        ctx.textAlign = 'center'; ctx.fillText(String(n + 1), hx + hw * 0.21, hy + hh * 0.36); ctx.textAlign = 'left';
      }
    }
  }
  function draw() {
    if (!ctx || !L) return;
    var cw = canvas.clientWidth, ch = canvas.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#8FA769'; ctx.fillRect(0, 0, cw, ch);
    for (var y = 0; y < L.H; y++) for (var x = 0; x < L.W; x++) drawTile(x, y, L.map[y][x]);
    // the route walked so far
    ctx.strokeStyle = '#F2C84B'; ctx.lineWidth = Math.max(2, tile / 9); ctx.setLineDash([tile / 6, tile / 7]); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    L.trail.forEach(function (p, i) { var c = tileRect(p[0], p[1]); if (i) ctx.lineTo(c[0] + tile / 2, c[1] + tile / 2); else ctx.moveTo(c[0] + tile / 2, c[1] + tile / 2); });
    ctx.stroke(); ctx.setLineDash([]);
    // the enumerator
    var e = tileRect(L.pos[0], L.pos[1]), ex = e[0] + tile / 2, ey = e[1] + tile / 2;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(ex, ey + tile * 0.3, tile * 0.22, tile * 0.08, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#2A4392'; ctx.beginPath(); ctx.moveTo(ex - tile * 0.18, ey + tile * 0.3); ctx.lineTo(ex, ey - tile * 0.05); ctx.lineTo(ex + tile * 0.18, ey + tile * 0.3); ctx.fill();
    ctx.fillStyle = '#3B2A20'; ctx.beginPath(); ctx.arc(ex, ey - tile * 0.14, tile * 0.13, 0, 7); ctx.fill();
    ctx.fillStyle = '#F2C84B'; ctx.fillRect(ex + tile * 0.08, ey + tile * 0.02, tile * 0.16, tile * 0.2);
    // the light goes as the steps run out
    var k = Math.min(1, L.steps / L.limit);
    if (k > 0.55) { ctx.fillStyle = 'rgba(28,32,70,' + ((k - 0.55) * 0.9).toFixed(3) + ')'; ctx.fillRect(0, 0, cw, ch); }
    // score line
    ctx.fillStyle = 'rgba(248,246,241,.94)'; ctx.fillRect(0, 0, cw, 40);
    ctx.fillStyle = '#1E1C19';
    ctx.font = '600 14px "Atkinson Hyperlegible Next", sans-serif';
    var score = L.counted.length + ' of ' + L.homes.length + ' counted   Steps ' + L.steps + ' of ' + L.limit;
    var sw = ctx.measureText(score).width;
    ctx.font = '600 16px Fraunces, Georgia, serif';
    var place = 'Parish ' + (L.i + 1) + ': ' + L.name;
    if (ctx.measureText(place).width + sw + 36 > cw) place = 'Parish ' + (L.i + 1);
    ctx.fillText(place, 12, 26);
    ctx.textAlign = 'right'; ctx.font = '600 14px "Atkinson Hyperlegible Next", sans-serif';
    ctx.fillText(score, cw - 12, 26);
    ctx.textAlign = 'left';
    if (mode !== 'play') overlay(cw, ch);
  }
  function fit(text, y, font, size, color, cw) {
    var px = size; ctx.font = font.replace('SIZE', px);
    while (px > 12 && ctx.measureText(text).width > cw - 40) { px--; ctx.font = font.replace('SIZE', px); }
    ctx.fillStyle = color; ctx.fillText(text, cw / 2, y);
  }
  function overlay(cw, ch) {
    ctx.fillStyle = 'rgba(20,18,15,.62)'; ctx.fillRect(0, 0, cw, ch);
    ctx.textAlign = 'center';
    var serif = '600 SIZEpx Fraunces, Georgia, serif', sans = '400 SIZEpx "Atkinson Hyperlegible Next", sans-serif', bold = '700 SIZEpx "Atkinson Hyperlegible Next", sans-serif';
    var cy = ch / 2, tap = api.touchy();
    if (mode === 'intro') {
      fit("Enumerator's Route", cy - 62, serif, 30, '#F8F6F1', cw);
      fit('Walk the parish and count every household.', cy - 24, sans, 16, '#F8F6F1', cw);
      fit('Hills cost two steps. Dusk falls when the steps run out.', cy, sans, 16, '#F8F6F1', cw);
      fit(tap ? 'Tap to start' : 'Press Space to start', cy + 44, bold, 17, '#F2C84B', cw);
    } else if (mode === 'done') {
      var st = stars(L.steps, L.par);
      fit('Parish counted', cy - 64, serif, 30, '#F8F6F1', cw);
      fit(new Array(st + 1).join('★') + new Array(4 - st).join('☆'), cy - 28, bold, 26, '#F2C84B', cw);
      fit('You walked ' + L.steps + ' steps. The shortest route is ' + L.par + '.', cy + 6, sans, 16, '#F8F6F1', cw);
      fit(L.i < LEVELS.length - 1 ? (tap ? 'Tap for the next parish' : 'Press Enter for the next parish, R to try again') : 'That was the whole district. Well walked.', cy + 44, bold, 16, '#F2C84B', cw);
    } else if (mode === 'dusk') {
      var left = L.homes.length - L.counted.length;
      fit('Dusk fell', cy - 40, serif, 30, '#F8F6F1', cw);
      fit(left + (left === 1 ? ' household' : ' households') + ' still to count. Try a shorter route.', cy - 4, sans, 16, '#F8F6F1', cw);
      fit(tap ? 'Tap to try again' : 'Press R to try again, or Z to undo', cy + 36, bold, 16, '#F2C84B', cw);
    }
    ctx.textAlign = 'left';
  }

  /* ---------- the toolbar ---------- */
  function renderBar() {
    if (!bar) return;
    var p = progress();
    var dots = LEVELS.map(function (lv, i) {
      var cls = 'rt-dot' + (i === (L ? L.i : 0) ? ' on' : '') + (p[i] !== undefined ? ' done' : '');
      return '<button type="button" class="' + cls + '" data-level="' + i + '"' + (unlocked(i) ? '' : ' disabled') +
        ' aria-label="Parish ' + (i + 1) + ': ' + lv.name + (p[i] !== undefined ? ', counted in ' + p[i] + ' steps' : '') + '">' + (i + 1) + '</button>';
    }).join('');
    bar.innerHTML = '<div class="rt-levels" role="group" aria-label="Parishes">' + dots + '</div>' +
      '<div class="rt-actions"><button type="button" class="btn small" data-rt="undo">Undo</button>' +
      '<button type="button" class="btn small" data-rt="restart">Start over</button>' +
      (mode === 'done' && L && L.i < LEVELS.length - 1 ? '<button type="button" class="btn small primary" data-rt="next">Next parish</button>' : '') + '</div>';
  }
  function onBar(e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-level')) { var i = Number(b.getAttribute('data-level')); if (unlocked(i)) load(i); return; }
    var a = b.getAttribute('data-rt');
    if (a === 'undo') undo(); else if (a === 'restart') restart(); else if (a === 'next' && L.i < LEVELS.length - 1) load(L.i + 1);
    canvas.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (e.target.closest && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
    var k = e.key, map = { ArrowRight: [1, 0], d: [1, 0], D: [1, 0], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowUp: [0, -1], w: [0, -1], W: [0, -1] };
    if (mode === 'intro' && (k === ' ' || k === 'Enter')) { e.preventDefault(); mode = 'play'; draw(); return; }
    if (map[k]) { e.preventDefault(); move(map[k][0], map[k][1]); return; }
    if (k === 'z' || k === 'Z' || k === 'Backspace') { e.preventDefault(); undo(); return; }
    if (k === 'r' || k === 'R') { restart(); return; }
    if ((k === 'Enter' || k === 'n' || k === 'N') && mode === 'done' && L.i < LEVELS.length - 1) { e.preventDefault(); load(L.i + 1); }
  }
  var press = null;
  function onDown(e) { e.preventDefault(); press = { x: e.clientX, y: e.clientY }; }
  function onUp(e) {
    if (!press) return;
    var dx = e.clientX - press.x, dy = e.clientY - press.y; press = null;
    if (mode === 'intro') { mode = 'play'; draw(); return; }
    if (mode === 'done') { if (L.i < LEVELS.length - 1) load(L.i + 1); return; }
    if (mode === 'dusk') { restart(); return; }
    if (Math.abs(dx) > 22 || Math.abs(dy) > 22) { if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0); else move(0, dy > 0 ? 1 : -1); return; }
    var r = canvas.getBoundingClientRect();
    var tx = Math.floor((e.clientX - r.left - ox) / tile), ty = Math.floor((e.clientY - r.top - oy) / tile);
    if (tx >= 0 && ty >= 0 && tx < L.W && ty < L.H) walkTo(tx, ty);
  }

  window.AkbrGames.route = {
    title: "Enumerator's Route",
    mount: function (el, a) {
      root = el; api = a;
      canvas = document.createElement('canvas');
      canvas.className = 'game-canvas';
      canvas.setAttribute('tabindex', '0');
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', "Enumerator's Route: a village map with paths, households, hills and a river.");
      bar = document.createElement('div'); bar.className = 'rt-bar';
      root.appendChild(canvas); root.appendChild(bar);
      ctx = canvas.getContext('2d');
      var p = progress(), startAt = 0;
      while (startAt < LEVELS.length - 1 && p[startAt] !== undefined) startAt++;
      load(startAt);
      if (startAt === 0 && p[0] === undefined) mode = 'intro';
      renderBar();
      api.setHelp(api.touchy()
        ? 'Tap a spot to walk there, or swipe one step at a time. Count every house before dusk.'
        : 'Arrow keys or WASD to walk, or click a spot. Z undoes a step, R starts over.');
      on(api.dialog, 'keydown', onKey);
      on(canvas, 'pointerdown', onDown);
      on(canvas, 'pointerup', onUp);
      on(bar, 'click', onBar);
      on(window, 'resize', size);
      requestAnimationFrame(function () { size(); canvas.focus({ preventScroll: true }); });
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2]); });
      listeners = []; ctx = null; L = null; bar = null; canvas = null; walkQ = [];
    },
    levels: LEVELS
  };
})();
