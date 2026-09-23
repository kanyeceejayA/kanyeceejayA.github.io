/* Rolex Rush: run a rolex stand through the lunch rush. */
(function () {
  'use strict';
  window.AkbrGames = window.AkbrGames || {};

  var ROUND = 90, MAXQ = 4;
  var VEG = ['tomato', 'onion', 'cabbage'];
  var SKIN = ['#6B4226', '#8D5524', '#5A3825', '#7B4B2A', '#4A2C1D', '#9C6B43'];
  var SHIRT = ['#2A4392', '#B85C38', '#2F7D4F', '#2C7DA0', '#C99A1F', '#7A4E9C', '#1E1C19'];

  var root, api, raf = 0, last = 0, listeners = [], els = {}, g = null, mode = 'ready';

  function on(el, ev, fn) { el.addEventListener(ev, fn); listeners.push([el, ev, fn]); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function mix(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    var r = ((pa >> 16) & 255) + ((((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
    var gg = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
    var bl = (pa & 255) + (((pb & 255) - (pa & 255)) * t);
    return 'rgb(' + Math.round(r) + ',' + Math.round(gg) + ',' + Math.round(bl) + ')';
  }
  function ramp(stops, p) {
    for (var i = 1; i < stops.length; i++) if (p <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (p - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    return stops[stops.length - 1][1];
  }
  var EGG_RAMP = [[0, '#F7EBAE'], [0.6, '#EFC64E'], [0.95, '#D9A441'], [1.15, '#8B5A2B'], [1.3, '#2E211A']];
  var CHAP_RAMP = [[0, '#F1E6CC'], [1, '#E2BE84'], [1.5, '#B07A3F'], [1.8, '#4A2E1A']];

  function orderText(o) {
    var veg = VEG.filter(function (v) { return o[v]; });
    var eggs = o.eggs + (o.eggs === 1 ? ' egg' : ' eggs');
    if (!veg.length) return eggs + ', plain';
    if (veg.length === 3) return eggs + ', everything';
    return eggs + ', ' + veg.join(' and ');
  }
  function same(a, b) { return a.eggs === b.eggs && VEG.every(function (v) { return !!a[v] === !!b[v]; }); }

  /* ---------- markup ---------- */
  function build() {
    root.innerHTML =
      '<div class="rx" tabindex="-1">' +
        '<div class="rx-top"><span>Served <b data-served>0</b></span><span>Takings <b data-takings>0/=</b></span><span>Lunch ends in <b data-clock>1:30</b></span></div>' +
        '<ol class="rx-queue" aria-label="Customers waiting"></ol>' +
        '<div class="rx-kitchen">' +
          '<section class="rx-station rx-bowl"><h3>Bowl</h3><div class="rx-bowl-dish" aria-live="polite"><span data-bowl>Empty</span></div>' +
            '<div class="rx-row">' +
              '<button type="button" data-act="egg">Egg <kbd>1</kbd></button>' +
              '<button type="button" data-act="tomato">Tomato <kbd>2</kbd></button>' +
              '<button type="button" data-act="onion">Onion <kbd>3</kbd></button>' +
              '<button type="button" data-act="cabbage">Cabbage <kbd>4</kbd></button>' +
              '<button type="button" data-act="clear" class="rx-quiet">Clear <kbd>X</kbd></button>' +
            '</div></section>' +
          '<section class="rx-station rx-pan"><h3>Pan</h3><div class="rx-disc rx-pan-disc"><span class="rx-omelette" data-omelette></span></div>' +
            '<div class="rx-bar"><i class="rx-zone"></i><b data-panbar></b></div>' +
            '<button type="button" data-act="pan" class="rx-main">Pour the eggs <kbd>Space</kbd></button></section>' +
          '<section class="rx-station rx-tawa"><h3>Chapati</h3><div class="rx-disc rx-tawa-disc"><span class="rx-chapati" data-chapati></span></div>' +
            '<div class="rx-bar"><i class="rx-zone chap"></i><b data-chapbar></b></div>' +
            '<button type="button" data-act="chapati" class="rx-main">Warm a chapati <kbd>C</kbd></button></section>' +
          '<section class="rx-station rx-plate"><h3>Ready</h3><div class="rx-disc rx-plate-disc"><span class="rx-rolex" data-rolex></span></div>' +
            '<p class="rx-note" data-note>Roll it, then tap a customer to serve.</p>' +
            '<button type="button" data-act="roll" class="rx-main">Roll it <kbd>R</kbd></button></section>' +
        '</div>' +
        '<div class="rx-overlay" data-overlay></div>' +
      '</div>';
    ['served', 'takings', 'clock', 'bowl', 'omelette', 'panbar', 'chapati', 'chapbar', 'rolex', 'note', 'overlay'].forEach(function (k) {
      els[k] = root.querySelector('[data-' + k + ']');
    });
    els.queue = root.querySelector('.rx-queue');
    els.rx = root.querySelector('.rx');
    els.btn = {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-act]'), function (b) {
      els.btn[b.getAttribute('data-act')] = b;
      on(b, 'click', function (e) { act(b.getAttribute('data-act')); settle(e); });
    });
    on(els.queue, 'click', function (e) {
      var li = e.target.closest('[data-cust]');
      if (li) { serve(Number(li.getAttribute('data-cust'))); settle(e); }
    });
  }

  /* after a mouse or finger press, hand focus back to the stand so Space and Enter stay game keys */
  function settle(e) { if (e && e.detail && els.rx && mode === 'play') els.rx.focus({ preventScroll: true }); }

  /* ---------- the stand ---------- */
  function fresh() {
    g = { t: 0, served: 0, takings: 0, walked: 0, next: 1, arriveIn: 0.5, queue: [], nextId: 1,
          bowl: { eggs: 0, tomato: false, onion: false, cabbage: false },
          pan: null, omelette: null, chapati: null, rolex: null, note: '', noteT: 0 };
  }
  function say(text) { g.note = text; g.noteT = 3; }
  function arrive() {
    if (g.queue.length >= MAXQ) return;
    var o = { eggs: 1 + Math.floor(Math.random() * 3) };
    VEG.forEach(function (v) { o[v] = Math.random() < 0.55; });
    var patience = Math.max(18, 30 - g.t / 9);
    g.queue.push({ id: g.nextId++, order: o, patience: patience, max: patience, skin: pick(SKIN), shirt: pick(SHIRT), mood: '' });
    renderQueue();
  }
  function act(a) {
    if (mode !== 'play') { if (mode === 'ready' || mode === 'over') begin(); return; }
    var b = g.bowl;
    if (a === 'egg') { if (b.eggs < 3) b.eggs++; else say('Three eggs is the most anyone asks for.'); }
    else if (VEG.indexOf(a) >= 0) b[a] = !b[a];
    else if (a === 'clear') { g.bowl = { eggs: 0, tomato: false, onion: false, cabbage: false }; }
    else if (a === 'pan') {
      if (!g.pan) {
        if (!b.eggs) { say('Crack at least one egg into the bowl first.'); return; }
        if (g.omelette) { say('Roll the omelette you have before starting another.'); return; }
        g.pan = { mix: b, p: 0 };
        g.bowl = { eggs: 0, tomato: false, onion: false, cabbage: false };
      } else if (g.pan.p < 0.45) {
        say('Still runny. Give it a moment.');
      } else {
        g.omelette = { mix: g.pan.mix, q: g.pan.p };
        say(g.pan.p <= 0.95 && g.pan.p >= 0.55 ? 'Golden. Perfect.' : (g.pan.p < 0.55 ? 'A little soft, but it will do.' : 'Well done. Nearly too well.'));
        g.pan = null;
      }
    }
    else if (a === 'chapati') {
      if (g.chapati) say('One chapati on the tawa at a time.');
      else g.chapati = { p: 0 };
    }
    else if (a === 'roll') {
      if (g.rolex) { say('Serve the rolex you have first.'); return; }
      if (!g.omelette) { say('Take an omelette off the pan first.'); return; }
      if (!g.chapati || g.chapati.p < 0.6) { say('The chapati needs to be warm.'); return; }
      g.rolex = { mix: g.omelette.mix, q: g.omelette.q };
      g.omelette = null; g.chapati = null;
      say('Rolled. Tap a customer to serve.');
    }
    renderStatic();
  }
  function serve(id) {
    if (mode !== 'play') return;
    if (!g.rolex) { say('Nothing ready yet. Roll one first.'); return; }
    var c = null;
    if (id) c = g.queue.filter(function (q) { return q.id === id; })[0];
    if (!c) c = g.queue.filter(function (q) { return same(q.order, g.rolex.mix); })[0] || g.queue[0];
    if (!c) { say('Nobody in the queue yet.'); return; }
    var price = 1000 + 700 * c.order.eggs, perfect = g.rolex.q >= 0.55 && g.rolex.q <= 0.95;
    if (same(c.order, g.rolex.mix)) {
      var pay = price + (perfect ? 300 : 0) + (c.patience / c.max > 0.5 ? 200 : 0);
      g.takings += pay; g.served++;
      say('Paid ' + api.ugx(pay) + (perfect ? ', with a tip for the golden egg.' : '.'));
    } else {
      var half = Math.round(price / 2 / 100) * 100;
      g.takings += half;
      say('Not what they asked for. They paid ' + api.ugx(half) + ' and grumbled.');
    }
    g.rolex = null;
    g.queue.splice(g.queue.indexOf(c), 1);
    renderQueue(); renderStatic();
  }

  /* ---------- time ---------- */
  function update(dt) {
    g.t += dt;
    if (g.t >= ROUND) { finish(); return; }
    g.arriveIn -= dt;
    if (g.arriveIn <= 0) { arrive(); g.arriveIn = rand(4.2, 7.5) * Math.max(0.55, 1 - g.t / 160); }
    for (var i = g.queue.length - 1; i >= 0; i--) {
      var c = g.queue[i];
      c.patience -= dt;
      if (c.patience <= 0) { g.queue.splice(i, 1); g.walked++; say('Someone gave up and walked off.'); renderQueue(); }
    }
    if (g.pan) {
      g.pan.p += dt / 4.2;
      if (g.pan.p >= 1.3) { g.pan = null; say('Burnt. That one goes to the dogs.'); renderStatic(); }
    }
    if (g.chapati) {
      g.chapati.p += dt / 2.6;
      if (g.chapati.p >= 1.8) { g.chapati = null; say('The chapati charred. Warm another.'); renderStatic(); }
    }
    if (g.noteT > 0) g.noteT -= dt;
  }
  function finish() {
    mode = 'over';
    cancelAnimationFrame(raf);
    var best = api.store('rolex-best') || 0;
    g.newBest = g.takings > best;
    if (g.newBest) api.store('rolex-best', g.takings);
    renderOverlay();
  }

  /* ---------- drawing the stand ---------- */
  function vegDots(m) {
    var out = '';
    VEG.forEach(function (v, i) { if (m[v]) out += '<i class="rx-veg ' + v + ' v' + i + '"></i><i class="rx-veg ' + v + ' w' + i + '"></i>'; });
    return out;
  }
  function bowlText(b) {
    if (!b.eggs && !VEG.some(function (v) { return b[v]; })) return 'Empty';
    return (b.eggs ? b.eggs + (b.eggs === 1 ? ' egg' : ' eggs') : 'No eggs yet') + (VEG.some(function (v) { return b[v]; }) ? ', ' + VEG.filter(function (v) { return b[v]; }).join(', ') : '');
  }
  function renderQueue() {
    els.queue.innerHTML = '';
    g.queue.forEach(function (c) {
      var li = document.createElement('li');
      li.innerHTML = '<button type="button" class="rx-cust" data-cust="' + c.id + '">' +
        '<span class="rx-face" style="--skin:' + c.skin + ';--shirt:' + c.shirt + '"></span>' +
        '<span class="rx-order"></span><span class="rx-wait"><b></b></span></button>';
      li.querySelector('.rx-order').textContent = orderText(c.order);
      li.querySelector('button').setAttribute('aria-label', 'Serve the customer who wants ' + orderText(c.order));
      els.queue.appendChild(li);
    });
    if (!g.queue.length) els.queue.innerHTML = '<li class="rx-empty">No one waiting. It won’t last.</li>';
  }
  function renderStatic() {
    els.bowl.textContent = bowlText(g.bowl);
    ['egg', 'tomato', 'onion', 'cabbage'].forEach(function (k) {
      if (k !== 'egg') els.btn[k].setAttribute('aria-pressed', g.bowl[k] ? 'true' : 'false');
    });
    els.btn.egg.setAttribute('data-count', g.bowl.eggs || '');
    els.btn.pan.innerHTML = (g.pan ? 'Take it off' : 'Pour the eggs') + ' <kbd>Space</kbd>';
    els.omelette.innerHTML = g.pan ? vegDots(g.pan.mix) : (g.omelette ? vegDots(g.omelette.mix) : '');
    els.rolex.className = 'rx-rolex' + (g.rolex ? ' on' : '');
  }
  function renderFrame() {
    var left = Math.max(0, ROUND - g.t);
    els.served.textContent = g.served;
    els.takings.textContent = api.ugx(g.takings);
    els.clock.textContent = Math.floor(left / 60) + ':' + ('0' + Math.floor(left % 60)).slice(-2);
    var pp = g.pan ? g.pan.p : (g.omelette ? g.omelette.q : 0);
    els.omelette.style.opacity = g.pan || g.omelette ? 1 : 0;
    els.omelette.style.background = ramp(EGG_RAMP, pp);
    els.omelette.classList.toggle('lifted', !!g.omelette && !g.pan);
    els.panbar.style.width = Math.min(100, pp / 1.3 * 100) + '%';
    var cp = g.chapati ? g.chapati.p : 0;
    els.chapati.style.opacity = g.chapati ? 1 : 0;
    els.chapati.style.background = ramp(CHAP_RAMP, cp);
    els.chapbar.style.width = Math.min(100, cp / 1.8 * 100) + '%';
    els.note.textContent = g.noteT > 0 ? g.note : (g.rolex ? 'Tap a customer to serve.' : 'Bowl, pan, chapati, roll, serve.');
    Array.prototype.forEach.call(els.queue.querySelectorAll('[data-cust]'), function (b) {
      var c = g.queue.filter(function (q) { return q.id === Number(b.getAttribute('data-cust')); })[0];
      if (!c) return;
      var f = c.patience / c.max, bar = b.querySelector('.rx-wait b');
      bar.style.width = (f * 100) + '%';
      bar.style.background = f < 0.3 ? '#C0392B' : (f < 0.6 ? '#E0A92E' : '#2F7D4F');
      b.classList.toggle('match', !!g.rolex && same(c.order, g.rolex.mix));
    });
  }
  function renderOverlay() {
    var o = els.overlay;
    if (mode === 'play') { o.hidden = true; o.innerHTML = ''; return; }
    o.hidden = false;
    var tap = api.touchy();
    if (mode === 'ready') {
      o.innerHTML = '<div class="rx-card"><h3>Rolex Rush</h3>' +
        '<p>It is lunch hour in Kampala and the queue is growing. Put the right eggs and vegetables in the bowl, fry the omelette until it is golden, warm a chapati, roll it, and serve the customer who asked for it.</p>' +
        '<button type="button" class="btn primary" data-start>Open the stand</button>' +
        (tap ? '' : '<p class="rx-keys">Keys: 1 egg, 2 tomato, 3 onion, 4 cabbage, Space pan, C chapati, R roll, Enter serve.</p>') + '</div>';
    } else {
      o.innerHTML = '<div class="rx-card"><h3>Lunch is over</h3>' +
        '<p>You served ' + g.served + (g.served === 1 ? ' rolex' : ' rolexes') + ' and took ' + api.ugx(g.takings) + '.' +
        (g.walked ? ' ' + g.walked + (g.walked === 1 ? ' customer' : ' customers') + ' walked off.' : ' Nobody walked off.') + '</p>' +
        '<p>' + (g.newBest ? 'That is your best rush yet.' : 'Your best rush: ' + api.ugx(api.store('rolex-best') || 0) + '.') + '</p>' +
        '<button type="button" class="btn primary" data-start>Open again</button></div>';
    }
    var sb = o.querySelector('[data-start]');
    sb.addEventListener('click', begin);
    setTimeout(function () { sb.focus({ preventScroll: true }); }, 30);
  }

  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function step(now) {
      if (mode !== 'play') return;
      var dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      update(dt);
      if (mode === 'play') { renderFrame(); raf = requestAnimationFrame(step); }
    });
  }
  function begin() {
    fresh(); mode = 'play'; last = 0;
    renderOverlay(); renderQueue(); renderStatic(); renderFrame(); loop();
    if (els.rx) els.rx.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (mode !== 'play') return;
    var k = e.key.toLowerCase();
    var map = { '1': 'egg', '2': 'tomato', '3': 'onion', '4': 'cabbage', x: 'clear', backspace: 'clear', ' ': 'pan', c: 'chapati', r: 'roll' };
    if (k === 'enter' && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); serve(0); return; }
    if (map[k] && !(k === ' ' && e.target.closest && e.target.closest('button'))) { e.preventDefault(); act(map[k]); }
  }

  window.AkbrGames.rolex = {
    title: 'Rolex Rush',
    mount: function (el, a) {
      root = el; api = a; mode = 'ready'; fresh(); build(); renderQueue(); renderStatic(); renderFrame(); renderOverlay();
      api.setHelp(api.touchy()
        ? 'Tap the ingredients, then the pan, the chapati, Roll it, and finally the customer.'
        : 'Click or use the keys shown on each button. Enter serves the customer whose order matches.');
      on(api.dialog, 'keydown', onKey);
      on(document, 'visibilitychange', function () { if (document.hidden && mode === 'play') { last = 0; } });
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2]); });
      listeners = []; els = {}; g = null; mode = 'ready';
    }
  };
})();
