/* Akbr Kanyesigye, personal site: theme, menu, section tracking, small touches. */
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;

  /* ---------- theme ---------- */
  var themeBtn = document.querySelector('.theme');
  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'dark' || set === 'light') return set;
    return mq.matches ? 'dark' : 'light';
  }
  function labelTheme() {
    if (!themeBtn) return;
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    themeBtn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    themeBtn.setAttribute('title', 'Switch to ' + next + ' theme');
    Array.prototype.forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (meta) {
      meta.setAttribute('content', currentTheme() === 'dark' ? '#15181E' : '#ECE9E2');
    });
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
      labelTheme();
    });
    mq.addEventListener && mq.addEventListener('change', labelTheme);
    labelTheme();
  }

  /* ---------- mobile menu ---------- */
  var menuBtn = document.querySelector('.menu-btn');
  var menu = document.getElementById('menu');
  var lastFocus = null;

  var backdrop = document.querySelector('.menu-backdrop');
  var menuLabel = menuBtn && menuBtn.querySelector('.menu-label');
  function setMenuLabel(text) {
    if (menuLabel) menuLabel.textContent = text; else if (menuBtn) menuBtn.textContent = text;
  }
  function openMenu() {
    if (!menu) return;
    lastFocus = document.activeElement;
    menu.hidden = false;
    if (backdrop) backdrop.hidden = false;
    requestAnimationFrame(function () {
      menu.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
    });
    menuBtn.setAttribute('aria-expanded', 'true');
    setMenuLabel('Close');
    body.classList.add('menu-open');
    var first = menu.querySelector('a, button');
    if (first) first.focus({ preventScroll: true });
  }
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menu.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    setMenuLabel('Menu');
    body.classList.remove('menu-open');
    var done = function () { menu.hidden = true; if (backdrop) backdrop.hidden = true; };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 380);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  if (backdrop) backdrop.addEventListener('click', closeMenu);
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      menu.hidden ? openMenu() : closeMenu();
    });
    menu.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a && a.getAttribute('href') && a.getAttribute('href').charAt(0) === '#') closeMenu();
      else if (e.target.closest('[data-play], [data-desk]')) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) closeMenu();
      if (e.key === 'Tab' && !menu.hidden) {
        var items = menu.querySelectorAll('a, button');
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- work: group by ---------- */
  var work = document.querySelector('.work');
  var groupsWrap = work && work.querySelector('.work-groups');
  if (work && groupsWrap) {
    var items = Array.prototype.slice.call(groupsWrap.querySelectorAll('.sheet')).map(function (el) {
      return { el: el, audience: el.getAttribute('data-audience'), year: el.getAttribute('data-year'), kind: el.getAttribute('data-kind') };
    });
    var KIND_ORDER = ['AI', 'Data platforms', 'Web platforms', 'Mobile apps', 'Products and open source'];
    var TONES = ['pen', 'clay', 'leaf', 'sky', 'mark'];
    items.forEach(function (it, i) {
      var el = it.el;
      var titleEl = el.querySelector('.sheet-title');
      var title = titleEl ? titleEl.textContent.trim() : 'Project';
      var shot = el.querySelector('.sheet-media img');
      var thumb = document.createElement('span');
      thumb.className = 'sheet-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      if (shot) {
        var t = document.createElement('img');
        t.src = shot.getAttribute('data-thumb') || shot.getAttribute('src'); t.alt = ''; t.loading = 'lazy'; t.width = 96; t.height = 56;
        thumb.appendChild(t);
      } else {
        thumb.classList.add('tone-' + TONES[i % TONES.length]);
        thumb.textContent = el.getAttribute('data-mono') || title.charAt(0);
      }
      var cta = document.createElement('span');
      cta.className = 'sheet-cta'; cta.setAttribute('aria-hidden', 'true'); cta.textContent = 'View details';
      var open = document.createElement('button');
      open.type = 'button'; open.className = 'sheet-open';
      open.setAttribute('aria-haspopup', 'dialog');
      open.setAttribute('aria-label', title + ', view details');
      open.addEventListener('click', function () { openProject(el, open); });
      el.appendChild(thumb); el.appendChild(cta); el.appendChild(open);
      Array.prototype.forEach.call(el.querySelectorAll('.sheet-body a'), function (a) { a.setAttribute('tabindex', '-1'); });
    });
    work.classList.add('rows');
    var groupBtns = Array.prototype.slice.call(work.querySelectorAll('[data-group]'));

    function groupItems(key) {
      var order = [], map = {};
      items.forEach(function (it) {
        var k = it[key] || 'Other';
        if (!map[k]) { map[k] = []; order.push(k); }
        map[k].push(it);
      });
      if (key === 'year') order.sort(function (a, b) { return Number(b) - Number(a); });
      if (key === 'kind') order.sort(function (a, b) { return KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b); });
      return order.map(function (k) { return { label: k, items: map[k] }; });
    }
    function renderGroups(key) {
      groupsWrap.innerHTML = '';
      groupItems(key).forEach(function (g) {
        var block = document.createElement('div'); block.className = 'group-block';
        var h = document.createElement('h3'); h.className = 'group'; h.textContent = g.label;
        var sheets = document.createElement('div'); sheets.className = 'sheets';
        g.items.forEach(function (it) { it.el.classList.add('fresh'); sheets.appendChild(it.el); });
        block.appendChild(h); block.appendChild(sheets); groupsWrap.appendChild(block);
      });
      setTimeout(function () { items.forEach(function (it) { it.el.classList.remove('fresh'); }); }, 600);
    }
    function press(btns, active) {
      btns.forEach(function (b) { b.setAttribute('aria-pressed', b === active ? 'true' : 'false'); });
    }
    function findBtn(btns, attr, value) {
      for (var i = 0; i < btns.length; i++) if (btns[i].getAttribute(attr) === value) return btns[i];
      return null;
    }
    function setGroup(key, save) {
      var btn = findBtn(groupBtns, 'data-group', key);
      if (!btn) return;
      press(groupBtns, btn);
      renderGroups(key);
      if (save) { try { localStorage.setItem('work-group', key); } catch (e) {} }
    }
    groupBtns.forEach(function (b) { b.addEventListener('click', function () { setGroup(b.getAttribute('data-group'), true); }); });
    try {
      var g0 = localStorage.getItem('work-group');
      if (g0 && g0 !== 'audience') setGroup(g0, false);
    } catch (e) {}
  }

  /* ---------- which section am I in ---------- */
  var where = document.querySelector('.where');
  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id][data-title]'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('a[data-nav]'));

  function setCurrent(id, title) {
    if (where) where.textContent = title || '';
    updateRail(id, title);
    navLinks.forEach(function (a) {
      var on = a.getAttribute('href') === '#' + id;
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }
  if (sections.length && 'IntersectionObserver' in window) {
    var visible = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible.set(en.target, en.isIntersecting ? en.intersectionRatio : 0); });
      var best = null, bestRatio = 0;
      sections.forEach(function (s) {
        var r = visible.get(s) || 0;
        if (r > bestRatio) { best = s; bestRatio = r; }
      });
      if (best) setCurrent(best.id, best.getAttribute('data-title'));
      else if (window.scrollY < 200) setCurrent('', '');
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.01, 0.1, 0.25, 0.5] });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- land on a role, course, paper or project and show it ---------- */
  var FLASHABLE = '.entry, .edu li, .sheet';
  function flash(id) {
    var el = id && document.getElementById(id);
    if (!el || !el.matches(FLASHABLE)) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    var d = el.querySelector('details');
    if (d) d.open = true;
  }
  function goTo(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.matches('.work.rows .sheet')) { openProject(el, null); return; }
    revealRole(el);
    el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    if (history.replaceState) history.replaceState(null, '', '#' + id);
    setTimeout(function () { flash(id); }, 380);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.closest('dialog')) return;
    var id = a.getAttribute('href').slice(1);
    var el = id && document.getElementById(id);
    if (el && el.matches(FLASHABLE)) { e.preventDefault(); goTo(id); }
  });
  if (location.hash.length > 1) {
    var hashId = location.hash.slice(1);
    /* an old link to a project that now lives only on the projects page */
    if (/^p-/.test(hashId) && !document.getElementById(hashId) && document.querySelector('.hero')) {
      location.replace('projects/' + location.hash);
    }
    setTimeout(function () {
      var target = document.getElementById(hashId);
      if (target && target.matches('.work.rows .sheet')) openProject(target, null);
      else if (target && revealRole(target)) goTo(hashId);
      else flash(hashId);
    }, 300);
  }

  /* ---------- years strip: scrub readout and two-way highlight ---------- */
  var grid = document.querySelector('.years-grid');
  var bars = Array.prototype.slice.call(document.querySelectorAll('.years-grid .bar'));
  var readoutWhen = document.querySelector('.readout-when');
  var readoutWhat = document.querySelector('.readout-what');
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var COLS = 144, NOW_COL = 141; /* column 1 is January 2015; 141 is September 2026 */
  var hintWhen = readoutWhen ? readoutWhen.textContent : '';
  var hintWhat = readoutWhat ? readoutWhat.textContent : '';

  function barSpan(bar) {
    return { s: parseInt(bar.style.getPropertyValue('--s'), 10), e: parseInt(bar.style.getPropertyValue('--e'), 10) };
  }
  function colLabel(col) {
    var idx = col - 1;
    return MONTHS[idx % 12] + ' ' + (2015 + Math.floor(idx / 12));
  }
  function scrubTo(clientX) {
    var rect = grid.getBoundingClientRect();
    var x = Math.min(Math.max(clientX - rect.left, 0), rect.width - 0.01);
    var col = Math.min(Math.floor(x / rect.width * COLS) + 1, NOW_COL);
    grid.style.setProperty('--cursor', ((col - 0.5) / COLS * 100) + '%');
    grid.classList.add('scrubbing');
    var names = [];
    bars.forEach(function (b) {
      var sp = barSpan(b);
      var on = col >= sp.s && col < sp.e;
      b.classList.toggle('is-on', on);
      if (on) names.push(b.getAttribute('data-name'));
    });
    if (readoutWhen) readoutWhen.textContent = colLabel(col) + (col === NOW_COL ? ', now' : '');
    if (readoutWhat) readoutWhat.textContent = names.length ? names.join(', ') : 'Between things.';
  }
  function scrubEnd() {
    grid.classList.remove('scrubbing');
    bars.forEach(function (b) { b.classList.remove('is-on'); });
    if (readoutWhen) readoutWhen.textContent = hintWhen;
    if (readoutWhat) readoutWhat.textContent = hintWhat;
  }
  if (grid && bars.length) {
    grid.addEventListener('pointermove', function (e) { scrubTo(e.clientX); });
    grid.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') scrubTo(e.clientX); });
    grid.addEventListener('pointerleave', scrubEnd);
    grid.addEventListener('pointercancel', scrubEnd);
    document.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') setTimeout(scrubEnd, 900); });

    bars.forEach(function (bar) {
      var id = bar.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;
      bar.addEventListener('pointerenter', function () { target.classList.add('is-hot'); });
      bar.addEventListener('pointerleave', function () { target.classList.remove('is-hot'); });
      bar.addEventListener('focus', function () { target.classList.add('is-hot'); });
      bar.addEventListener('blur', function () { target.classList.remove('is-hot'); });
      target.addEventListener('pointerenter', function () { bar.classList.add('is-hot'); grid.classList.add('has-hot'); });
      target.addEventListener('pointerleave', function () { bar.classList.remove('is-hot'); grid.classList.remove('has-hot'); });
    });
  }

  /* ---------- experience: a few roles at first, compact or summary ---------- */
  var xp = document.getElementById('experience');
  var xpBtns = Array.prototype.slice.call(document.querySelectorAll('[data-xp-view]'));
  var xpDetails = Array.prototype.slice.call(document.querySelectorAll('#experience .entry details'));
  function setXpView(v, save) {
    if (!xp) return;
    if (v !== 'summary') v = 'compact';
    xpBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-xp-view') === v ? 'true' : 'false'); });
    xp.classList.toggle('xp-compact', v === 'compact');
    xpDetails.forEach(function (d) { d.open = false; });
    if (save) { try { localStorage.setItem('xp-view', v); } catch (e) {} }
  }
  xpBtns.forEach(function (b) { b.addEventListener('click', function () { setXpView(b.getAttribute('data-xp-view'), true); }); });
  var xpStart = 'compact';
  try { var v0 = localStorage.getItem('xp-view'); if (v0 === 'summary' || v0 === 'full') xpStart = 'summary'; } catch (e) {}
  setXpView(xpStart, false);

  var XP_FEW = 4, xpAllBtn = null;
  var xpEntries = xp ? Array.prototype.slice.call(xp.querySelectorAll('.entry')) : [];
  function setFewRoles(few) {
    if (!xpAllBtn) return;
    xp.classList.toggle('xp-few', few);
    xpAllBtn.setAttribute('aria-expanded', few ? 'false' : 'true');
    xpAllBtn.textContent = few ? 'Show all ' + xpEntries.length + ' roles' : 'Show fewer roles';
  }
  /* if a link or a bar points at a hidden role, show them all first; true when it changed anything */
  function revealRole(el) {
    if (!xp || !xpAllBtn || !xp.classList.contains('xp-few') || !el.classList.contains('xp-more')) return false;
    setFewRoles(false);
    return true;
  }
  if (xp && xpEntries.length > XP_FEW + 1) {
    xpEntries.forEach(function (li, i) { if (i >= XP_FEW) li.classList.add('xp-more'); });
    Array.prototype.forEach.call(xp.querySelectorAll('.chapter'), function (ch) {
      if (!ch.querySelector('.entry:not(.xp-more)')) ch.classList.add('xp-more-chapter');
    });
    var xpRow = document.createElement('p');
    xpRow.className = 'xp-all';
    xpAllBtn = document.createElement('button');
    xpAllBtn.type = 'button';
    xpAllBtn.className = 'see-more';
    xpAllBtn.addEventListener('click', function () {
      var few = !xp.classList.contains('xp-few');
      setFewRoles(few);
      if (few) xpRow.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
    xpRow.appendChild(xpAllBtn);
    var chapters = xp.querySelectorAll('.chapter');
    var lastChapter = chapters[chapters.length - 1];
    lastChapter.parentNode.insertBefore(xpRow, lastChapter.nextSibling);
    setFewRoles(true);
  }

  /* ---------- story pop-ups ---------- */
  var lastOpener = null;
  function openModal(id, opener) {
    var d = document.getElementById(id);
    if (!d) return;
    Array.prototype.forEach.call(document.querySelectorAll('dialog.modal[open]'), function (o) {
      if (o !== d) { if (typeof o.close === 'function') o.close(); else o.removeAttribute('open'); }
    });
    if (opener) lastOpener = opener;
    if (d.open) return;
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
    body.classList.add('modal-open');
  }
  function closeModal(d, returnFocus) {
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
    if (!document.querySelector('dialog.modal[open]')) body.classList.remove('modal-open');
    if (returnFocus && lastOpener && lastOpener.focus) lastOpener.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var opener = e.target.closest && e.target.closest('[data-modal]');
    if (opener) { e.preventDefault(); openModal(opener.getAttribute('data-modal'), opener); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('dialog.modal'), function (d) {
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-close]')) { closeModal(d, true); return; }
      var a = e.target.closest('a[href^="#"]');
      if (a) {
        e.preventDefault();
        closeModal(d, false);
        goTo(a.getAttribute('href').slice(1));
      }
    });
    d.addEventListener('close', function () {
      if (!document.querySelector('dialog.modal[open]')) body.classList.remove('modal-open');
      if (d.id === 'm-project' && /^#p-/.test(location.hash) && history.replaceState) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    });
  });

  /* ---------- screenshots in notes open larger in place ---------- */
  var shot = null;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.article .body a.zoom');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || typeof HTMLDialogElement !== 'function') return;
    e.preventDefault();
    if (!shot) {
      shot = document.createElement('dialog');
      shot.className = 'modal shot-modal';
      shot.setAttribute('aria-label', 'Screenshot');
      shot.innerHTML = '<div class="modal-inner"><button class="modal-close" type="button" data-close aria-label="Close">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<figure class="modal-media"><img alt=""><figcaption></figcaption></figure></div>';
      document.body.appendChild(shot);
      shot.addEventListener('click', function (ev) { if (ev.target === shot || ev.target.closest('[data-close]')) closeModal(shot, true); });
      shot.addEventListener('close', function () { if (!document.querySelector('dialog.modal[open]')) body.classList.remove('modal-open'); });
    }
    var img = a.querySelector('img'), fig = a.closest('figure'), cap = fig && fig.querySelector('figcaption');
    shot.querySelector('img').src = a.getAttribute('href');
    shot.querySelector('img').alt = img ? img.alt : '';
    shot.querySelector('figcaption').textContent = cap ? cap.textContent : '';
    var nw = (img && img.naturalWidth) || Number(img && img.getAttribute('width')) || 1200;
    var nh = (img && img.naturalHeight) || Number(img && img.getAttribute('height')) || 800;
    var k = Math.min(1, (window.innerWidth - 24) / nw, (window.innerHeight - 120) / nh);
    shot.style.width = Math.round(nw * k) + 'px';
    lastOpener = a;
    shot.showModal();
    body.classList.add('modal-open');
  });

  function openProject(el, opener) {
    var dlg = document.getElementById('m-project');
    var box = dlg && dlg.querySelector('.pm-content');
    if (!box) return;
    box.innerHTML = '';
    var shot = el.querySelector('.sheet-media img');
    if (shot) {
      var fig = document.createElement('figure');
      fig.className = 'pm-media';
      var big = document.createElement('img');
      big.src = shot.getAttribute('src'); big.alt = shot.getAttribute('alt') || '';
      big.width = shot.naturalWidth || Number(shot.getAttribute('width')) || 1200;
      big.height = shot.naturalHeight || Number(shot.getAttribute('height')) || 750;
      fig.appendChild(big); box.appendChild(fig);
    }
    var detail = el.querySelector('.sheet-body').cloneNode(true);
    detail.className = 'modal-body pm-body';
    Array.prototype.forEach.call(detail.querySelectorAll('[tabindex]'), function (n) { n.removeAttribute('tabindex'); });
    var h = detail.querySelector('.sheet-title');
    if (h) {
      var h2 = document.createElement('h2');
      h2.className = 'sheet-title'; h2.id = 'm-project-t'; h2.innerHTML = h.innerHTML;
      h.parentNode.replaceChild(h2, h);
    }
    var meta = detail.querySelector('.sheet-meta');
    if (meta) meta.className = 'modal-meta';
    box.appendChild(detail);
    dlg.classList.toggle('wide', !!shot);
    openModal('m-project', opener);
    if (history.replaceState) history.replaceState(null, '', '#' + el.id);
    dlg.scrollTop = 0;
  }

  function openDetail(parts, opener) {
    var dlg = document.getElementById('m-project');
    var box = dlg && dlg.querySelector('.pm-content');
    if (!box) return;
    box.innerHTML = '';
    var detail = document.createElement('div');
    detail.className = 'modal-body pm-body';
    var h2 = document.createElement('h2');
    h2.className = 'sheet-title'; h2.id = 'm-project-t'; h2.textContent = parts.title;
    detail.appendChild(h2);
    if (parts.meta) {
      var m = document.createElement('p'); m.className = 'modal-meta'; m.textContent = parts.meta;
      detail.appendChild(m);
    }
    parts.nodes.forEach(function (n) { if (n) detail.appendChild(n); });
    box.appendChild(detail);
    dlg.classList.remove('wide');
    openModal('m-project', opener);
    dlg.scrollTop = 0;
  }
  function textOf(el, sel) { var n = el.querySelector(sel); return n ? n.textContent.trim() : ''; }
  function cloneOf(el, sel, cls) {
    var n = el.querySelector(sel);
    if (!n) return null;
    var c = n.cloneNode(true);
    if (cls) c.className = cls;
    Array.prototype.forEach.call(c.querySelectorAll('[tabindex]'), function (x) { x.removeAttribute('tabindex'); });
    return c;
  }
  function addRowOpener(row, label, onOpen) {
    var cta = document.createElement('span');
    cta.className = 'row-cta'; cta.setAttribute('aria-hidden', 'true'); cta.textContent = 'View details';
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'row-open';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-label', label + ', view details');
    btn.addEventListener('click', function () { onOpen(btn); });
    row.appendChild(cta); row.appendChild(btn);
  }

  /* papers: compact rows by default, or everything in full */
  var papers = document.getElementById('papers');
  if (papers) {
    Array.prototype.forEach.call(papers.querySelectorAll('.edu li'), function (li) {
      addRowOpener(li, textOf(li, '.what'), function (btn) {
        var when = textOf(li, '.when'), grade = textOf(li, '.grade');
        var authors = document.createElement('p');
        authors.className = 'modal-authors'; authors.textContent = textOf(li, '.inst');
        openDetail({
          title: textOf(li, '.what'),
          meta: grade ? when + ', ' + grade.toLowerCase() : when,
          nodes: [authors, cloneOf(li, '.note', 'modal-note')]
        }, btn);
      });
    });
    var ppBtns = Array.prototype.slice.call(document.querySelectorAll('[data-pp-view]'));
    var setPpView = function (v, save) {
      ppBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pp-view') === v ? 'true' : 'false'); });
      papers.classList.toggle('pp-compact', v === 'compact');
      if (save) { try { localStorage.setItem('pp-view', v); } catch (e) {} }
    };
    ppBtns.forEach(function (b) { b.addEventListener('click', function () { setPpView(b.getAttribute('data-pp-view'), true); }); });
    try { if (localStorage.getItem('pp-view') === 'full') setPpView('full', false); } catch (e) {}
  }

  /* roles: in the compact view, a role opens its full story */
  Array.prototype.forEach.call(document.querySelectorAll('#experience .entry'), function (li) {
    addRowOpener(li, textOf(li, 'h4'), function (btn) {
      var list = li.querySelector('details ul');
      var listCopy = list ? list.cloneNode(true) : null;
      openDetail({
        title: textOf(li, 'h4'),
        meta: textOf(li, '.when') + ', ' + textOf(li, '.org'),
        nodes: [cloneOf(li, '.gist', 'modal-gist'), listCopy, cloneOf(li, '.entry-links', 'modal-links')]
      }, btn);
    });
  });

  /* back, forward or a pasted link to a project opens it */
  window.addEventListener('hashchange', function () {
    var id = location.hash.slice(1);
    var t = document.getElementById(id);
    if (t && t.matches('.work.rows .sheet')) openProject(t, null);
    else if (!t && /^p-/.test(id) && document.querySelector('.hero')) location.assign('projects/' + location.hash);
  });

  /* ---------- section rail and jump pill ---------- */
  var railSections = Array.prototype.slice.call(document.querySelectorAll('main section[id][data-title]'));
  var rail = null, jump = null, jumpBtn = null, jumpList = null, jumpLabel = null;
  if (railSections.length > 3) {
    rail = document.createElement('nav');
    rail.className = 'rail';
    rail.setAttribute('aria-label', 'Sections on this page');
    var rol = document.createElement('ol');
    jump = document.createElement('div');
    jump.className = 'secnav';
    jump.innerHTML = '<button class="secnav-btn" type="button" aria-expanded="false" aria-controls="secnav-list">' +
      '<svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle class="ring-bg" cx="18" cy="18" r="15"/><circle class="ring-fg" cx="18" cy="18" r="15"/></svg>' +
      '<span class="secnav-label">Sections</span></button><ol class="secnav-list" id="secnav-list" hidden></ol>';
    jumpBtn = jump.querySelector('.secnav-btn');
    jumpList = jump.querySelector('.secnav-list');
    jumpLabel = jump.querySelector('.secnav-label');
    railSections.forEach(function (sec) {
      var name = sec.getAttribute('data-title');
      var li = document.createElement('li');
      li.innerHTML = '<a href="#' + sec.id + '" data-rail="' + sec.id + '"><span class="tick" aria-hidden="true"></span><span class="lbl"></span></a>';
      li.querySelector('.lbl').textContent = name;
      rol.appendChild(li);
      var li2 = document.createElement('li');
      li2.innerHTML = '<a href="#' + sec.id + '" data-rail="' + sec.id + '"></a>';
      li2.firstChild.textContent = name;
      jumpList.appendChild(li2);
    });
    rail.appendChild(rol);
    body.appendChild(rail);
    body.appendChild(jump);

    var closeJump = function () { jumpList.hidden = true; jumpBtn.setAttribute('aria-expanded', 'false'); };
    jumpBtn.addEventListener('click', function () {
      var open = jumpList.hidden;
      jumpList.hidden = !open;
      jumpBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    jumpList.addEventListener('click', function (e) { if (e.target.closest('a')) closeJump(); });
    document.addEventListener('click', function (e) { if (!jump.contains(e.target)) closeJump(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !jumpList.hidden) { closeJump(); jumpBtn.focus(); } });

    var ticking = false;
    var hero = document.querySelector('.hero');
    var onScroll = function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      jump.style.setProperty('--p', pct.toFixed(3));
      var past = window.scrollY > (hero ? hero.offsetHeight * 0.6 : 300);
      rail.classList.toggle('show', past);
      jump.classList.toggle('show', past);
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }
  function updateRail(id, title) {
    if (!rail) return;
    var seen = false;
    Array.prototype.forEach.call(document.querySelectorAll('[data-rail]'), function (a) {
      a.classList.remove('is-active', 'is-past');
    });
    var order = railSections.map(function (s) { return s.id; });
    var idx = order.indexOf(id);
    Array.prototype.forEach.call(document.querySelectorAll('[data-rail]'), function (a) {
      var i = order.indexOf(a.getAttribute('data-rail'));
      if (i === idx) { a.classList.add('is-active'); a.setAttribute('aria-current', 'true'); seen = true; }
      else { a.removeAttribute('aria-current'); if (idx > -1 && i < idx) a.classList.add('is-past'); }
    });
    if (jumpLabel) jumpLabel.textContent = title || 'Sections';
  }

  /* ---------- hearts on notes ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-heart]'), function (btn) {
    var key = 'heart:' + btn.getAttribute('data-heart');
    var label = btn.querySelector('.heart-label');
    var paint = function (on) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (label) label.textContent = on ? 'You hearted this' : 'Heart this note';
    };
    var on0 = false;
    try { on0 = localStorage.getItem(key) === '1'; } catch (e) {}
    paint(on0);
    btn.addEventListener('click', function () {
      var on = btn.getAttribute('aria-pressed') !== 'true';
      paint(on);
      btn.classList.remove('beat'); void btn.offsetWidth; if (on) btn.classList.add('beat');
      try { if (on) localStorage.setItem(key, '1'); else localStorage.removeItem(key); } catch (e) {}
    });
  });

  /* ---------- comments on notes: not live yet, so offer email instead ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.comment-form'), function (form) {
    var status = form.querySelector('.form-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var text = form.elements.comment.value.trim();
      if (!name || !text) {
        status.textContent = 'Add your name and a comment first.';
        (name ? form.elements.comment : form.elements.name).focus();
        return;
      }
      var note = form.getAttribute('data-note') || document.title;
      var href = 'mailto:kakbr800@gmail.com?subject=' + encodeURIComponent('Comment on "' + note + '"') +
        '&body=' + encodeURIComponent(text + '\n\n' + name);
      status.innerHTML = '';
      status.appendChild(document.createTextNode('Comments aren\'t live on the site yet, so this wasn\'t posted. '));
      var a = document.createElement('a');
      a.href = href; a.textContent = 'Send it to me by email instead';
      status.appendChild(a);
      status.appendChild(document.createTextNode(', and I\'ll add it here.'));
    });
  });

  /* ---------- copy the email address ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    var label = btn.textContent;
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function (ok) {
        btn.textContent = ok ? 'Copied' : 'Press Ctrl+C to copy';
        setTimeout(function () { btn.textContent = label; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  });

  /* ---------- hero reveal ---------- */
  function ready() { root.classList.add('ready'); }
  if (document.fonts && document.fonts.ready) {
    var t = setTimeout(ready, 900);
    document.fonts.ready.then(function () { clearTimeout(t); ready(); });
  } else {
    ready();
  }

  /* ---------- footer year ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('footer [data-year]'), function (y) {
    y.textContent = String(new Date().getFullYear());
  });
})();
