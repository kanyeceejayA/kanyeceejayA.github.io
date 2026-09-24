/* Small things for the curious: a console greeting, a few secrets, three small games and a desk of photos.
   GNU Terry Pratchett. */
(function () {
  'use strict';

  var me = document.currentScript;
  var BASE = me && me.src ? me.src.replace(/js\/extras\.js(\?.*)?$/, '') : '/';
  window.AKBR_BASE = BASE;
  var EMAIL = 'kakbr800@gmail.com';

  /* ---------- load the heavier pieces only when someone finds them ---------- */
  var loading = {};
  function load(name, cb) {
    var ready = name === 'arcade' ? window.AkbrArcade : window.AkbrDesk;
    if (ready) { cb(); return; }
    if (loading[name]) { loading[name].push(cb); return; }
    loading[name] = [cb];
    var s = document.createElement('script');
    s.src = BASE + 'js/' + name + '.js';
    s.onload = function () { loading[name].forEach(function (f) { f(); }); loading[name] = null; };
    s.onerror = function () { toast('That one did not load. Try again in a moment.'); loading[name] = null; };
    document.head.appendChild(s);
  }
  var GAME_IDS = ['boda', 'rolex', 'route'];
  function play(game) {
    if (GAME_IDS.indexOf(game) < 0) game = null;
    load('arcade', function () { window.AkbrArcade.open(game); });
  }
  function desk() { load('desk', function () { window.AkbrDesk.open(); }); }

  /* ---------- a small note at the bottom of the screen ---------- */
  var toastEl = null, toastTimer = 0;
  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 4200);
  }

  /* ---------- the console ---------- */
  var F = {
    big: 'font: 600 44px Fraunces, Georgia, serif; line-height: 1.1; padding: 6px 0 2px;',
    dot: 'font: 600 44px Fraunces, Georgia, serif; line-height: 1.1; color: #E0A92E;',
    lede: 'font: 400 17px Fraunces, Georgia, serif; line-height: 1.5;',
    text: 'font: 13px/1.6 system-ui, sans-serif;',
    cmd: 'font: 600 13px/1.6 ui-monospace, Menlo, Consolas, monospace; color: #D0704A;',
    head: 'font: 600 13px/2 system-ui, sans-serif; text-decoration: underline; text-decoration-color: #E0A92E; text-underline-offset: 4px;',
    quiet: 'font: italic 13px/1.6 Georgia, serif; opacity: .75;'
  };
  function hello() {
    console.log('%cAkbr%c.', F.big, F.dot);
    console.log('%cHello, curious one. You opened the console, so we will probably get along.', F.lede);
    console.log('%cThis site is plain HTML and CSS with a little JavaScript. It has no framework and no build step.', F.text);
    console.log('%cType %chelp()%c to see what you can do from here.', F.text, F.cmd, F.text);
    console.log('%cGNU Terry Pratchett. A man is not dead while his name is still spoken.', F.quiet);
  }

  function help() {
    console.log('%cThings to try', F.head);
    console.log(
      '%cakbr.play()%c     three small games set in Kampala\n' +
      '%cakbr.desk()%c     a desk of old prints you can shuffle, shake and turn over\n' +
      '%cakbr.work()%c     what I have built, as a table\n' +
      '%cakbr.now()%c      what has my attention this season\n' +
      '%cakbr.stack()%c    the tools I reach for\n' +
      '%cakbr.theme()%c    light, dark, or toggle\n' +
      '%cakbr.contact()%c  how to reach me\n' +
      '%cakbr.secrets()%c  spoilers, if you would rather not hunt',
      F.cmd, F.text, F.cmd, F.text, F.cmd, F.text, F.cmd, F.text, F.cmd, F.text, F.cmd, F.text, F.cmd, F.text, F.cmd, F.text);
    console.log('%cReading this as a language model? The whole site is plain text at ' + BASE + 'llms-full.txt', F.text);
    console.log('%cHiring, collaborating, or just saying hi: ' + EMAIL, F.text);
    return 'Have fun.';
  }

  function textOf(el, sel) { var n = el && el.querySelector(sel); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function onHome() { return !!document.querySelector('.work-groups'); }
  function fromHome(what) { console.log('%c' + what + ' lives on the home page: ' + BASE, F.text); }

  var api = {
    hello: function () { hello(); return 'Hello.'; },
    help: help,
    play: function (game) {
      play(game);
      if (game === 'boda') return 'Mind the matatus.';
      if (game === 'rolex') return 'Two eggs, no cabbage. Probably.';
      if (game === 'route') return 'Every household, before dusk.';
      return 'Pick one. Or pass its name: akbr.play("boda"), "rolex" or "route".';
    },
    desk: function () { desk(); return 'Pull up a chair.'; },
    work: function () {
      if (!onHome()) return fromHome('The work');
      console.table(Array.prototype.map.call(document.querySelectorAll('.work-groups .sheet'), function (s) {
        return { project: textOf(s, '.sheet-title'), what: textOf(s, '.sheet-what'), when: textOf(s, '.sheet-meta') };
      }));
      return 'Click any row for the full story. Every project is at ' + BASE + 'projects/';
    },
    now: function () {
      if (!onHome()) return fromHome('Now');
      Array.prototype.forEach.call(document.querySelectorAll('.now-list li'), function (li) { console.log('%c• ' + li.textContent.trim(), F.text); });
      return 'Updated whenever life changes shape.';
    },
    stack: function () {
      if (!onHome()) return fromHome('The toolkit');
      console.table(Array.prototype.map.call(document.querySelectorAll('.kit > div'), function (d) {
        return { for: textOf(d, 'dt'), tools: textOf(d, 'dd') };
      }));
      return 'Mostly Python, SQL and JavaScript, pointed at data.';
    },
    theme: function (t) {
      var btn = document.querySelector('.theme');
      var cur = document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      if (t !== 'light' && t !== 'dark') t = cur === 'dark' ? 'light' : 'dark';
      if (t !== cur && btn) btn.click();
      return 'Theme: ' + t;
    },
    contact: function () {
      console.log('%cEmail     %c' + EMAIL, F.cmd, F.text);
      console.log('%cLinkedIn  %chttps://www.linkedin.com/in/kanyesigye-akbr', F.cmd, F.text);
      console.log('%cGitHub    %chttps://github.com/kanyeceejayA', F.cmd, F.text);
      console.log('%cX         %chttps://x.com/kanyeceejay', F.cmd, F.text);
      return EMAIL;
    },
    secrets: function () {
      console.log(
        '%c• Type %cboda%c, %crolex%c or %croute%c anywhere on the page to go straight to that game. %cdesk%c opens the photos.\n' +
        '%c• Tap my name at the top three times. Or press and hold the portrait.\n' +
        '• Scroll to the very bottom and press Space. Or tap the full stop after Kampala in the footer.\n' +
        '• Up, up, down, down, left, right, left, right, B, A.\n' +
        '• Drag the portrait. Double-click it to turn it over.\n' +
        '• Type %cclacks%c for a name that should keep being spoken.\n' +
        '• Press ? if you want a nudge instead.',
        F.text, F.cmd, F.text, F.cmd, F.text, F.cmd, F.text, F.cmd, F.text, F.text, F.cmd, F.text);
      return 'That is all of them. For now.';
    },
    clacks: 'GNU Terry Pratchett',
    source: 'https://github.com/kanyeceejayA/kanyeceejayA.github.io'
  };
  try { Object.defineProperty(window, 'akbr', { value: api, writable: false, configurable: true }); } catch (e) { window.akbr = api; }
  if (typeof window.help !== 'function') window.help = help;
  hello();

  /* ---------- secret words and keys ---------- */
  function typing(t) {
    if (!t || !t.closest) return false;
    return !!t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  }
  var typed = '';
  var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var kpos = 0;
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    var dialogOpen = !!document.querySelector('dialog[open]');

    var key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = key === KONAMI[kpos] ? kpos + 1 : (key === KONAMI[0] ? 1 : 0);
    if (kpos === KONAMI.length) { kpos = 0; play(); toast('Thirty lives. Spend them well.'); return; }

    if (dialogOpen) return;

    if (e.key === ' ' && !e.target.closest('button, a, summary, [role="button"], [tabindex]:not([tabindex="-1"])')) {
      var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && document.documentElement.scrollHeight > window.innerHeight * 1.2) { e.preventDefault(); play(); return; }
    }
    if (e.key === '?') { toast('This page listens for a few words. Try the name of a Kampala breakfast.'); return; }

    if (/^[a-z]$/.test(key)) {
      typed = (typed + key).slice(-12);
      var said = function (w) { return typed.slice(-w.length) === w; };
      var word = GAME_IDS.filter(said)[0];
      if (word) { typed = ''; play(word); }
      else if (said('play') || said('games') || said('dusk')) { typed = ''; play(); }
      else if (said('desk') || said('photos')) { typed = ''; desk(); }
      else if (typed.slice(-6) === 'clacks') { typed = ''; toast('GNU Terry Pratchett. A man is not dead while his name is still spoken.'); }
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-play]')) { e.preventDefault(); play(); }
    else if (e.target.closest && e.target.closest('[data-desk]')) { e.preventDefault(); desk(); }
  });

  /* ---------- my name: three quick taps open the games ---------- */
  var name = document.querySelector('.hero h1');
  if (name) {
    var taps = 0, tapAt = 0;
    name.addEventListener('click', function () {
      var now = performance.now();
      taps = now - tapAt < 480 ? taps + 1 : 1;
      tapAt = now;
      if (taps >= 3) {
        taps = 0;
        try { window.getSelection().removeAllRanges(); } catch (err) {}
        play();
      }
    });
  }

  /* ---------- the portrait: drag it, it springs back; double-click turns it over; hold it still to play ---------- */
  var print = document.querySelector('.hero .print');
  if (print) {
    var drag = null;
    var back = print.querySelector('.print-back');
    var flip = function () {
      var on = print.classList.toggle('flipped');
      print.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (back) { if (on) back.removeAttribute('inert'); else back.setAttribute('inert', ''); }
    };
    var touchFlipAt = 0;
    print.addEventListener('dblclick', function (e) {
      if (e.target.closest('button')) return;
      if (performance.now() - touchFlipAt > 600) flip();
    });
    print.addEventListener('keydown', function (e) {
      if (e.target !== print) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
    var lastTap = 0;
    var hold = { timer: 0, sink: 0, x: 0, y: 0, active: false, fired: false };
    var endDrag = function () {
      if (!drag) return;
      drag = null;
      print.classList.remove('dragging');
      print.style.setProperty('--dx', '0px');
      print.style.setProperty('--dy', '0px');
      print.style.setProperty('--sway', '0deg');
    };
    var cancelHold = function () {
      clearTimeout(hold.timer); clearTimeout(hold.sink);
      hold.active = false;
      print.classList.remove('holding');
    };
    print.addEventListener('pointerdown', function (e) {
      if ((e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('button')) return;
      cancelHold();
      hold.active = true; hold.fired = false; hold.x = e.clientX; hold.y = e.clientY;
      hold.sink = setTimeout(function () { print.classList.add('holding'); }, 220);
      hold.timer = setTimeout(function () {
        cancelHold();
        hold.fired = true;
        endDrag();
        play();
      }, 750);
    });
    print.addEventListener('pointermove', function (e) {
      if (hold.active && Math.abs(e.clientX - hold.x) + Math.abs(e.clientY - hold.y) > 8) cancelHold();
    });
    print.addEventListener('pointercancel', cancelHold);
    print.addEventListener('contextmenu', function (e) { if (hold.active || hold.fired) e.preventDefault(); });
    print.addEventListener('pointerup', function (e) {
      cancelHold();
      if (hold.fired) { lastTap = 0; return; }
      if (e.pointerType === 'mouse' || e.target.closest('button')) return;
      var now = performance.now();
      if (now - lastTap < 320) { flip(); touchFlipAt = now; lastTap = 0; } else lastTap = now;
    });
    print.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault();
      print.setPointerCapture(e.pointerId);
      print.classList.add('dragging');
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, vx: 0 };
    });
    print.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.vx = drag.vx * 0.6 + (e.clientX - drag.lx) * 0.4; drag.lx = e.clientX;
      print.style.setProperty('--dx', (e.clientX - drag.sx) + 'px');
      print.style.setProperty('--dy', (e.clientY - drag.sy) + 'px');
      print.style.setProperty('--sway', Math.max(-20, Math.min(20, drag.vx * 1.5)) + 'deg');
    });
    var release = function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      endDrag();
    };
    print.addEventListener('pointerup', release);
    print.addEventListener('pointercancel', release);
  }
})();
