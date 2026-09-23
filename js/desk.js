/* The desk: a hidden table of prints. Drag them, shake one to develop it,
   double-click or press Enter to turn it over. Add a print by adding a line to PRINTS. */
(function () {
  'use strict';
  if (window.AkbrDesk) return;

  var BASE = (window.AKBR_BASE || '');
  var PRINTS = [
    { src: 'images/akbr.jpg', front: 'Kampala, 2024', back: 'The official one. You just turned a photo over on a website. I respect that.' },
    { src: 'images/desk/suit.jpg', front: 'Suit day', back: 'Three pieces, one tie, and a railing to lean on.' },
    { src: 'images/akbr-kanyesigye-talks-to-he-president-museveni.jpg', front: 'State House, 2019', back: 'The handshake at the launch of the 4th Industrial Revolution Taskforce, April 2019.' },
    { src: 'images/desk/kampala-night.jpg', front: 'Kampala after dark', back: 'The city from up high. Somewhere down there, a census tablet is syncing.' },
    { src: 'images/desk/kampala-day.jpg', front: 'Kampala by day', back: 'Red roofs to the horizon. Every one of those households was counted in 2024.' }
  ];

  var dlg, table, z = 10, devTimer = 0, loaded = 0;

  function build() {
    dlg = document.createElement('dialog');
    dlg.className = 'desk';
    dlg.setAttribute('aria-labelledby', 'desk-title');
    dlg.innerHTML =
      '<div class="desk-bar">' +
        '<h2 id="desk-title">The desk</h2>' +
        '<p class="desk-hint">' + (window.matchMedia('(hover: none)').matches
          ? 'Drag the prints. Give one a shake to develop it. Double-tap one to turn it over.'
          : 'Drag the prints. Give one a shake to develop it. Double-click, or press Enter, to turn one over.') + '</p>' +
        '<div class="desk-actions">' +
          '<button type="button" class="btn small desk-shuffle">Shuffle</button>' +
          '<button type="button" class="btn small primary desk-close">Close</button>' +
        '</div>' +
      '</div>' +
      '<div class="desk-table" role="list"></div>';
    document.body.appendChild(dlg);
    table = dlg.querySelector('.desk-table');
    dlg.querySelector('.desk-close').addEventListener('click', close);
    dlg.querySelector('.desk-shuffle').addEventListener('click', function () { deal(true); });
    dlg.addEventListener('close', function () {
      clearInterval(devTimer);
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    });

    PRINTS.forEach(function (p, i) {
      var el = document.createElement('div');
      el.className = 'dprint';
      el.setAttribute('role', 'listitem');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', 'Photo: ' + p.front + '. Enter turns it over, arrow keys move it.');
      el.innerHTML =
        '<div class="dcard">' +
          '<figure class="dface dfront"><img alt="" draggable="false" decoding="async"><figcaption></figcaption></figure>' +
          '<div class="dface dback"><p></p><span class="dstamp">Kampala</span></div>' +
        '</div>';
      var img = el.querySelector('img');
      img.src = BASE + p.src;
      img.alt = p.front;
      img.addEventListener('load', function () {
        el.classList.toggle('wide', img.naturalWidth > img.naturalHeight * 1.15);
        loaded++;
        if (loaded === PRINTS.length && dlg.open) deal(true);   // re-deal once every print knows its real size
      });
      el.querySelector('figcaption').textContent = p.front;
      el.querySelector('.dback p').textContent = p.back;
      el._dev = 0;
      wire(el);
      table.appendChild(el);
    });
  }

  function setDev(el, v) {
    el._dev = Math.max(0, Math.min(1, v));
    el.style.setProperty('--dev', el._dev.toFixed(3));
  }

  function deal(animate) {
    var prints = Array.prototype.slice.call(table.children);
    var W = table.clientWidth, H = table.clientHeight, n = prints.length;
    var cols = Math.max(1, Math.round(Math.sqrt(n * W / Math.max(H, 1))));
    var rows = Math.ceil(n / cols);
    var cells = [];
    for (var i = 0; i < rows * cols; i++) cells.push(i);
    for (var j = cells.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)); var tmp = cells[j]; cells[j] = cells[k]; cells[k] = tmp; }
    var cw = W / cols, ch = H / rows;
    prints.forEach(function (el, idx) {
      var w = el.offsetWidth || 220, h = el.offsetHeight || 260;
      var cell = cells[idx], cx = (cell % cols + 0.5) * cw, cy = (Math.floor(cell / cols) + 0.5) * ch;
      var x = cx - w / 2 + (Math.random() - 0.5) * cw * 0.3;
      var y = cy - h / 2 + (Math.random() - 0.5) * ch * 0.3;
      x = Math.max(8, Math.min(W - w - 8, x));
      y = Math.max(8, Math.min(H - h * 0.75, y));
      el.classList.toggle('dealing', !!animate);
      move(el, x, y, (Math.random() - 0.5) * 20);
      el.style.zIndex = String(++z);
    });
    if (animate) setTimeout(function () { prints.forEach(function (el) { el.classList.remove('dealing'); }); }, 650);
  }

  function move(el, x, y, rot) {
    el._x = x; el._y = y; if (rot !== undefined) el._r = rot;
    el.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + (el._r || 0) + 'deg)';
  }

  function flip(el) {
    el.classList.toggle('flipped');
    setDev(el, Math.max(el._dev, 0.6));
  }

  function wire(el) {
    var drag = null, lastTap = 0, touchFlipAt = 0;
    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      el.style.zIndex = String(++z);
      el.classList.add('lifted');
      el._rTemp = undefined;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: el._x, y0: el._y, lx: e.clientX, lt: performance.now(), vx: 0, moved: 0, lastDir: 0 };
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var now = performance.now(), dt = Math.max(1, now - drag.lt);
      var dx = e.clientX - drag.lx;
      drag.vx = dx / dt;
      var dir = dx > 2 ? 1 : dx < -2 ? -1 : 0;
      if (dir && drag.lastDir && dir !== drag.lastDir) setDev(el, el._dev + 0.09);   // a shake develops the print
      if (dir) drag.lastDir = dir;
      drag.lx = e.clientX; drag.lt = now;
      drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy));
      var tilt = Math.max(-18, Math.min(18, (el._r || 0) + drag.vx * 2));
      el._rTemp = tilt;
      el._x = drag.x0 + e.clientX - drag.sx; el._y = drag.y0 + e.clientY - drag.sy;
      el.style.transform = 'translate(' + el._x + 'px,' + el._y + 'px) rotate(' + tilt + 'deg) scale(1.03)';
    });
    function end(e) {
      if (!drag || e.pointerId !== drag.id) return;
      el.classList.remove('lifted');
      if (drag.moved < 6) {
        var now = performance.now();
        if (e.pointerType !== 'mouse' && now - lastTap < 320) { flip(el); touchFlipAt = now; lastTap = 0; }
        else lastTap = now;
      }
      el._r = Math.max(-16, Math.min(16, (el._rTemp !== undefined ? el._rTemp : el._r || 0) * 0.7));
      move(el, el._x, el._y);
      drag = null;
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', function () { if (performance.now() - touchFlipAt > 600) flip(el); });
    el.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 40 : 12;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(el); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(el, el._x - step, el._y); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(el, el._x + step, el._y); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(el, el._x, el._y - step); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(el, el._x, el._y + step); }
      else if (e.key === 'r' || e.key === 'R') { move(el, el._x, el._y, (el._r || 0) + 8); }
      el.style.zIndex = String(++z);
    });
  }

  function open() {
    if (!dlg) build();
    document.querySelectorAll('dialog[open]').forEach(function (d) { if (d !== dlg && d.close) d.close(); });
    if (!dlg.open) dlg.showModal();
    document.body.classList.add('modal-open');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    Array.prototype.forEach.call(table.children, function (el) { el.classList.remove('flipped'); setDev(el, reduce ? 1 : 0); });
    requestAnimationFrame(function () { deal(false); requestAnimationFrame(function () { deal(true); }); });
    clearInterval(devTimer);
    devTimer = setInterval(function () {                 // prints develop slowly on their own
      var done = true;
      Array.prototype.forEach.call(table.children, function (el) {
        if (el._dev < 1) { setDev(el, el._dev + 0.018); done = false; }
      });
      if (done) clearInterval(devTimer);
    }, 100);
  }
  function close() { if (dlg && dlg.open) dlg.close(); }

  window.AkbrDesk = { open: open, close: close, prints: PRINTS };
})();
