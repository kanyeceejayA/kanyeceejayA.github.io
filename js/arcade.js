/* Take a break: a small arcade of three Kampala games.
   The picker lives here; each game loads from js/games/ only when it is chosen. */
(function () {
  'use strict';
  if (window.AkbrArcade) return;

  var BASE = window.AKBR_BASE || '';
  var GAMES = [
    { id: 'boda', title: 'Boda Dispatch', blurb: 'Carry passengers across Kampala before dusk.' },
    { id: 'rolex', title: 'Rolex Rush', blurb: 'Run a rolex stand through the lunch rush.' },
    { id: 'route', title: "Enumerator's Route", blurb: 'Plan the walk that counts every household.' },
    { id: 'letters', title: 'Letter Blaster', blurb: 'Shoot the words on the page you were reading.', page: true }
  ];
  var ART = {
    boda: '<svg viewBox="0 0 80 56" aria-hidden="true"><rect width="80" height="56" rx="10" fill="#2C7DA0"/><path d="M0 34h80" stroke="#F8F6F1" stroke-width="10"/><path d="M8 34h10M30 34h10M52 34h10" stroke="#57524A" stroke-width="2"/><circle cx="30" cy="30" r="6" fill="#1E1C19"/><circle cx="50" cy="30" r="6" fill="#1E1C19"/><path d="M30 30h20l-6-9h-8z" fill="#B85C38"/><circle cx="41" cy="16" r="5" fill="#F2C84B"/><circle cx="46" cy="21" r="4" fill="#F8F6F1"/></svg>',
    rolex: '<svg viewBox="0 0 80 56" aria-hidden="true"><rect width="80" height="56" rx="10" fill="#B85C38"/><ellipse cx="40" cy="34" rx="26" ry="12" fill="#2A2622"/><ellipse cx="40" cy="31" rx="21" ry="9" fill="#E9C46A"/><circle cx="33" cy="30" r="2.5" fill="#C0392B"/><circle cx="45" cy="32" r="2.5" fill="#6A994E"/><circle cx="41" cy="27" r="2" fill="#C0392B"/><path d="M22 14c6 4 30 4 36 0" stroke="#F8F6F1" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
    letters: '<svg viewBox="0 0 80 56" aria-hidden="true"><rect width="80" height="56" rx="10" fill="#1E1C19"/><text x="12.0" y="24" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#F8F6F1" text-anchor="middle">L</text><text x="21.4" y="24" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#F8F6F1" text-anchor="middle">E</text><text x="30.8" y="24" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#F8F6F1" text-anchor="middle">T</text><text x="49.6" y="24" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#F8F6F1" text-anchor="middle">E</text><text x="59.0" y="24" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#F8F6F1" text-anchor="middle">R</text><text x="68.4" y="24" font-family="Georgia, serif" font-size="13" font-weight="700" fill="#F8F6F1" text-anchor="middle">S</text><g fill="#F2C84B"><circle cx="40.2" cy="19" r="2.4"/><circle cx="34" cy="14" r="1.3"/><circle cx="46" cy="13" r="1.1"/><circle cx="45" cy="25" r="1.2"/><circle cx="35" cy="26" r="1"/></g><circle cx="40.2" cy="31" r="1.8" fill="#9FB3F6"/><circle cx="40.2" cy="38" r="1.8" fill="#9FB3F6" opacity=".6"/><path d="M40.2 41l5 11-5-3-5 3z" fill="#F2C84B" stroke="#1E1C19" stroke-width="1" stroke-linejoin="round"/></svg>',
    route: '<svg viewBox="0 0 80 56" aria-hidden="true"><rect width="80" height="56" rx="10" fill="#2F7D4F"/><path d="M10 44 L26 44 L26 24 L50 24 L50 12 L68 12" stroke="#C9895A" stroke-width="7" fill="none" stroke-linejoin="round"/><path d="M10 44 L26 44 L26 24 L50 24" stroke="#F2C84B" stroke-width="2" stroke-dasharray="3 3" fill="none"/><rect x="42" y="30" width="12" height="9" fill="#F8F6F1"/><path d="M40 31l8-7 8 7z" fill="#B85C38"/><rect x="60" y="4" width="11" height="8" fill="#F8F6F1"/><path d="M58 5l7.5-6 7.5 6z" fill="#B85C38"/><circle cx="10" cy="44" r="4" fill="#1E1C19"/></svg>'
  };
  var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

  window.AkbrGames = window.AkbrGames || {};
  var dlg, titleEl, backBtn, body, helpEl, current = null, loading = {};

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem('akbr-arcade-' + key) || 'null');
      localStorage.setItem('akbr-arcade-' + key, JSON.stringify(value));
    } catch (e) { return null; }
    return value;
  }
  function touchy() { return window.matchMedia('(hover: none)').matches; }
  function ugx(n) { return Math.round(n).toLocaleString('en-US') + '/='; }

  var api = {
    store: store, touchy: touchy, ugx: ugx,
    setHelp: function (t) { if (helpEl) helpEl.textContent = t || ''; },
    get dialog() { return dlg; },
    back: function () { showPicker(); }
  };

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'modal arcade';
    dlg.setAttribute('aria-labelledby', 'arcade-title');
    dlg.innerHTML =
      '<div class="arcade-head">' +
        '<button class="arcade-back" type="button" hidden>' + BACK + '<span>All games</span></button>' +
        '<h2 id="arcade-title">Take a break</h2>' +
        '<button class="modal-close" type="button" aria-label="Close">' + CLOSE + '</button>' +
      '</div>' +
      '<div class="arcade-body"></div>' +
      '<p class="arcade-help" aria-live="polite"></p>';
    document.body.appendChild(dlg);
    titleEl = dlg.querySelector('#arcade-title');
    backBtn = dlg.querySelector('.arcade-back');
    body = dlg.querySelector('.arcade-body');
    helpEl = dlg.querySelector('.arcade-help');
    backBtn.addEventListener('click', showPicker);
    dlg.querySelector('.modal-close').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
    dlg.addEventListener('close', function () {
      stopCurrent();
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    });
    dlg.addEventListener('keydown', function (e) {
      if (current || e.target.closest('input, textarea')) return;
      var n = parseInt(e.key, 10);
      if (n >= 1 && n <= GAMES.length) { e.preventDefault(); e.stopPropagation(); start(GAMES[n - 1].id); }
    });
  }

  function bestLine(id) {
    if (id === 'boda') { var b = store('boda-best'); return b ? 'Best day: ' + ugx(b) : 'Not played yet'; }
    if (id === 'rolex') { var r = store('rolex-best'); return r ? 'Best rush: ' + ugx(r) : 'Not played yet'; }
    if (id === 'letters') return 'Plays on this page. Esc to stop';
    if (id === 'route') {
      var prog = store('route-progress') || {};
      var done = Object.keys(prog).length;
      return done ? done + ' of 8 parishes counted' : 'Not played yet';
    }
    return '';
  }

  function stopCurrent() {
    if (current && current.unmount) { try { current.unmount(); } catch (e) {} }
    current = null;
  }

  function showPicker() {
    stopCurrent();
    titleEl.textContent = 'Take a break';
    backBtn.hidden = true;
    body.className = 'arcade-body';
    body.innerHTML = '<p class="arcade-intro">Three small games set in Kampala, and one that plays on this page. Pick one.</p><div class="arcade-cards"></div>';
    var cards = body.querySelector('.arcade-cards');
    GAMES.forEach(function (g, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'arcade-card';
      b.innerHTML = '<span class="arcade-art">' + ART[g.id] + '</span>' +
        '<span class="arcade-name"></span><span class="arcade-blurb"></span><span class="arcade-best"></span>' +
        '<span class="arcade-key" aria-hidden="true">' + (i + 1) + '</span>';
      b.querySelector('.arcade-name').textContent = g.title;
      b.querySelector('.arcade-blurb').textContent = g.blurb;
      b.querySelector('.arcade-best').textContent = bestLine(g.id);
      b.addEventListener('click', function () { start(g.id); });
      cards.appendChild(b);
    });
    api.setHelp(touchy() ? 'Tap a game to play.' : 'Click a game, or press 1 to ' + GAMES.length + '.');
    var first = cards.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }

  function load(id, cb) {
    if (window.AkbrGames[id]) { cb(); return; }
    if (loading[id]) { loading[id].push(cb); return; }
    loading[id] = [cb];
    var s = document.createElement('script');
    s.src = BASE + 'js/games/' + id + '.js';
    s.onload = function () { var q = loading[id]; loading[id] = null; q.forEach(function (f) { f(); }); };
    s.onerror = function () { loading[id] = null; api.setHelp('That game did not load. Check your connection and try again.'); };
    document.head.appendChild(s);
  }

  function start(id) {
    var meta = GAMES.filter(function (g) { return g.id === id; })[0];
    if (!meta) return;
    if (meta.page) {
      close();
      load(id, function () { window.AkbrGames[id].start(document.querySelector('main')); });
      return;
    }
    stopCurrent();
    titleEl.textContent = meta.title;
    backBtn.hidden = false;
    body.className = 'arcade-body playing';
    body.innerHTML = '<div class="arcade-stage stage-' + id + '"><p class="arcade-loading">Loading…</p></div>';
    load(id, function () {
      if (!dlg.open) return;
      var stage = body.querySelector('.arcade-stage');
      stage.innerHTML = '';
      current = window.AkbrGames[id];
      current.mount(stage, api);
    });
  }

  function open(gameId) {
    if (!dlg) build();
    Array.prototype.forEach.call(document.querySelectorAll('dialog[open]'), function (d) { if (d !== dlg && d.close) d.close(); });
    if (!dlg.open) dlg.showModal();
    document.body.classList.add('modal-open');
    if (gameId) start(gameId); else showPicker();
  }
  function close() { if (dlg && dlg.open) dlg.close(); }

  window.AkbrArcade = { open: open, close: close, games: GAMES };
})();
