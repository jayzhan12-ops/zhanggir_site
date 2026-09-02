/* ==========================================================================
   IDEA 04 — EDITORIAL. No dependencies.
   One rAF loop drives the cursor and the work plate; everything else is
   event-driven or CSS.
   ========================================================================== */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lerp = function (a, b, n) { return a + (b - a) * n; };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  /* ====================================================== REVEALS ======== */
  var revealables = Array.prototype.slice.call(document.querySelectorAll('.up, .rise'));

  function reveal(el, delay) {
    if (delay) el.style.transitionDelay = delay + 'ms';
    el.classList.add('is-in');
  }

  function revealAll() { revealables.forEach(function (el) { reveal(el, 0); }); }

  function revealWithin(root) {
    Array.prototype.slice.call(root.querySelectorAll('.up, .rise')).forEach(function (el, i) {
      var d = el.hasAttribute('data-d') ? +el.getAttribute('data-d') : i;
      reveal(el, d * 90);
    });
  }

  (function watchReveals() {
    if (reduced || !('IntersectionObserver' in window)) { revealAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var d = el.hasAttribute('data-d') ? +el.getAttribute('data-d') : 0;
        reveal(el, d * 90);
        io.unobserve(el);
      });
    }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });

    revealables.forEach(function (el) {
      /* the intro is handled by the gate so it lands as the curtain lifts */
      if (el.closest('.intro')) return;
      io.observe(el);
    });

    /* If the observer never fires, show the page rather than hide it — but
       leave the intro alone. The gate reveals that when it opens, and a
       visitor can easily sit at the gate longer than this timeout, which
       would burn the intro's reveal behind a closed curtain. */
    setTimeout(function () {
      revealables.forEach(function (el) {
        if (el.closest('.intro')) return;
        reveal(el, 0);
      });
    }, 3500);
  })();

  /* ======================================================== GATE =========
     The page is behind a launch command. Same curtain as the old preloader —
     it slides up and hands the intro its reveal — but it waits for the viewer
     rather than a timer, so there is no timeout that opens it on its own.
  */
  (function gate() {
    var gate  = document.getElementById('gate');
    var intro = document.querySelector('.intro') || document.querySelector('main > section');

    function open() {
      if (gate) { gate.classList.add('done'); }
      document.body.style.removeProperty('overflow');
      if (intro) revealWithin(intro);
      setTimeout(function () { if (gate) gate.style.display = 'none'; }, 1300);
    }

    if (!gate) { if (intro) revealWithin(intro); return; }

    var form  = document.getElementById('gateForm');
    var input = document.getElementById('gateInput');
    var msg   = document.getElementById('gateMsg');
    var cmdEl = document.getElementById('gateCmd');
    var copy  = document.getElementById('gateCopy');
    var skip  = document.getElementById('gateSkip');
    var COMMAND = cmdEl.textContent.trim();

    document.body.style.overflow = 'hidden';
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }

    function norm(s) {
      return String(s).trim().toLowerCase().replace(/^\$\s*/, '').replace(/\s+/g, ' ');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var typed = norm(input.value);
      if (!typed) {
        msg.className = 'gate-msg err';
        msg.textContent = 'nothing entered — copy the command above';
        return;
      }
      if (typed === norm(COMMAND) || typed.indexOf(norm(COMMAND)) !== -1) {
        msg.className = 'gate-msg ok';
        msg.textContent = 'starting portfolio.launch.py …';
        setTimeout(open, reduced ? 0 : 520);
        return;
      }
      msg.className = 'gate-msg err';
      msg.textContent = 'command not found: ' + input.value.trim().split(/\s+/)[0];
      input.select();
    });

    /* clicking the command selects it, for anyone copying by hand */
    cmdEl.addEventListener('click', function () {
      var r = document.createRange();
      r.selectNodeContents(cmdEl);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    });

    copy.addEventListener('click', function () {
      function flash(t) {
        copy.textContent = t;
        setTimeout(function () { copy.textContent = 'Copy'; }, 1500);
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = COMMAND; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(COMMAND).then(
          function () { flash('Copied'); },
          function () { flash(fallback() ? 'Copied' : 'Select it'); }
        );
      } else {
        flash(fallback() ? 'Copied' : 'Select it');
      }
      input.focus();
    });

    skip.addEventListener('click', open);
  })();

  /* ====================================================== CURSOR + PLATE = */
  (function cursorAndPlate() {
    var dot = document.getElementById('curDot');
    var ring = document.getElementById('curRing');
    var label = document.getElementById('curLabel');
    var plate = document.getElementById('plate');
    var rows = Array.prototype.slice.call(document.querySelectorAll('.row'));
    var plates = Array.prototype.slice.call(document.querySelectorAll('.pl'));

    if (!finePointer || reduced) {
      if (dot) dot.remove();
      if (ring) ring.remove();
      if (plate) plate.remove();
      return;
    }

    var mx = -200, my = -200;                 /* raw pointer */
    var rx = -200, ry = -200;                 /* ring, lagged */
    var px = -400, py = -400, lastPx = -400;  /* plate, lagged harder */

    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
    }, { passive: true });

    /* Two hover states: a labelled filled disc only where one is asked for,
       and a plain widened outline for every other link. */
    var hotSel = '[data-cursor]';
    var anySel = 'a, button, [data-cursor]';

    document.addEventListener('mouseover', function (e) {
      if (!e.target.closest) return;
      var any = e.target.closest(anySel);
      if (!any) return;
      var hot = e.target.closest(hotSel);
      ring.classList.toggle('hot', !!hot);
      ring.classList.toggle('grow', !hot);
      label.textContent = hot ? (hot.getAttribute('data-cursor') || '') : '';
    });

    document.addEventListener('mouseout', function (e) {
      if (!e.target.closest) return;
      var any = e.target.closest(anySel);
      if (!any) return;
      if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest(anySel)) return;
      ring.classList.remove('hot');
      ring.classList.remove('grow');
      label.textContent = '';
    });

    /* Which plate to show. The ring is muted for the duration — it would
       otherwise sit as a filled orange disc squarely over the artwork, in the
       same colour, hiding the thing it is advertising. The plate's own VIEW
       tag takes over as the affordance. */
    function showPlate(name) {
      plates.forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-for') === name); });
      plate.classList.add('show');
      ring.classList.add('muted');
    }
    function hidePlate() {
      plate.classList.remove('show');
      ring.classList.remove('muted');
    }
    rows.forEach(function (row) {
      row.addEventListener('mouseenter', function () { showPlate(row.getAttribute('data-plate')); });
      row.addEventListener('mouseleave', hidePlate);
    });

    /* Scrolling slides the rows out from under a stationary pointer without
       firing a single mousemove, so mx/my go stale and no mouseleave ever
       arrives — the plate just hangs there over whatever the scroll brought
       into that spot, usually the section heading. Re-test what is genuinely
       under the pointer on every scroll and correct the plate to match: it
       stays if another row slid into place, and goes away if none did. */
    var scrollCheck = 0;
    window.addEventListener('scroll', function () {
      if (scrollCheck) return;
      scrollCheck = requestAnimationFrame(function () {
        scrollCheck = 0;
        var under = document.elementFromPoint(mx, my);
        var row = under && under.closest ? under.closest('.row') : null;
        if (row) showPlate(row.getAttribute('data-plate'));
        else hidePlate();
      });
    }, { passive: true });

    /* pointer left the window altogether — nothing is hovered any more */
    document.addEventListener('mouseleave', hidePlate);

    (function loop() {
      rx = lerp(rx, mx, .18);
      ry = lerp(ry, my, .18);
      px = lerp(px, mx, .09);
      py = lerp(py, my, .09);

      dot.style.setProperty('--x', mx + 'px');
      dot.style.setProperty('--y', my + 'px');
      ring.style.setProperty('--x', rx + 'px');
      ring.style.setProperty('--y', ry + 'px');

      if (plate) {
        /* tilt into the direction of travel — reads as weight, not decoration */
        var vel = clamp((px - lastPx) * .6, -14, 14);
        lastPx = px;
        plate.style.setProperty('--px', px + 'px');
        plate.style.setProperty('--py', py + 'px');
        plate.style.setProperty('--rot', vel.toFixed(2) + 'deg');
      }
      requestAnimationFrame(loop);
    })();
  })();

  /* ====================================================== MAGNETIC ======= */
  (function magnetic() {
    if (!finePointer || reduced) return;

    /* Kept deliberately gentle, and only ever applied to small controls. On a
       large element the pull scales with distance from centre, so display-size
       text ends up lurching around under the pointer. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-magnetic]'), function (el) {
      var RANGE = 0.2;

      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + (dx * RANGE) + 'px,' + (dy * RANGE) + 'px)';
      });

      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform .55s cubic-bezier(.16,1,.3,1)';
        el.style.transform = '';
        setTimeout(function () { el.style.transition = ''; }, 560);
      });
    });
  })();

  /* ====================================================== COUNTERS ======= */
  (function counters() {
    var nums = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
    if (!nums.length) return;

    /* The real figure ships in the HTML, so the page reads correctly with no
       JS at all. Animating means counting UP TO the value already there —
       never leaving a wrong number on screen if this stalls partway. */
    function run(el) {
      if (el._counted) return;
      el._counted = true;

      var target = +el.getAttribute('data-count');
      if (reduced) { el.textContent = target; return; }

      var start = performance.now(), DUR = 1100, finished = false;

      (function step(now) {
        var t = clamp((now - start) / DUR, 0, 1);
        el.textContent = Math.round((1 - Math.pow(1 - t, 3)) * target);
        if (t < 1) { requestAnimationFrame(step); return; }
        finished = true;
        el.textContent = target;
      })(start);

      /* If rAF stalls — a backgrounded tab, a throttled renderer — the count
         would be frozen at a number that is simply false. Land it regardless. */
      setTimeout(function () { if (!finished) el.textContent = target; }, DUR + 600);
    }

    if (!('IntersectionObserver' in window)) { nums.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        run(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: .6 });
    nums.forEach(function (el) { io.observe(el); });
    setTimeout(function () { nums.forEach(run); }, 4000);
  })();

  /* ====================================================== CLOCK ========== */
  (function clock() {
    var el = document.getElementById('clock');
    if (!el) return;
    function tick() {
      try {
        el.textContent = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'America/Indiana/Indianapolis',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).format(new Date());
      } catch (e) {
        el.textContent = new Date().toTimeString().slice(0, 8);
      }
    }
    tick();
    setInterval(tick, 1000);
  })();

  /* ====================================================== NAV / TOP ====== */

  /* ====================================================== RESUME =========
     On real hosting the plain `download` href does the job. Inside the
     published artifact a relative file does not exist and the sandbox blocks
     page-initiated downloads, so there we hand the bytes to the viewer
     through the downloads capability instead. Absence is the normal case:
     if the capability never resolves, the href is left to do its thing.
  */
  (function resume() {
    var link = document.querySelector('[data-resume]');
    if (!link) return;

    var dl = null;
    if (window.claude && typeof window.claude.use === 'function') {
      try {
        window.claude.use('downloads').then(function (d) { dl = d; }, function () {});
      } catch (e) { /* capability simply unavailable */ }
    }

    function toBytes(b64) {
      var bin = atob(b64), n = bin.length, out = new Uint8Array(n);
      for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
      return out;
    }

    link.addEventListener('click', function (e) {
      if (!dl || !window.__CV_B64) return;      /* let the href handle it */
      e.preventDefault();
      dl.save({ filename: 'Zhanggir-Yessenaliyev-CV.pdf', data: toBytes(window.__CV_B64) })
        .catch(function (err) {
          if (err && err.code === 'declined') return;   /* viewer said no */
          dl = null;                                    /* fall back next click */
        });
    });
  })();


  /* ======================================================== EMAIL ========
     mailto: opens nothing in a sandboxed artifact frame, and nothing on a
     machine with no mail client set up — the button just looks broken. The
     href stays (it is right where a client exists) and is left to fire; we
     additionally put the address on the clipboard and say so, so a click
     always produces a result.
  */
  (function email() {
    var toast = document.getElementById('toast');
    var links = Array.prototype.slice.call(document.querySelectorAll('a[href^="mailto:"]'));
    if (!links.length) return;

    var hideAt = null;
    function say(text) {
      if (!toast) return;
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(hideAt);
      hideAt = setTimeout(function () { toast.classList.remove('show'); }, 2600);
    }

    function copy(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function (resolve, reject) {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        ok ? resolve() : reject();
      });
    }

    links.forEach(function (a) {
      a.addEventListener('click', function () {
        var addr = a.getAttribute('href').replace(/^mailto:/i, '').split('?')[0];
        copy(addr).then(
          function () { say(addr + " — copied to your clipboard"); },
          function () { say("Email: " + addr); }
        );
        /* no preventDefault: if a mail client exists, let it open too */
      });
    });
  })();


  /* =============================================== RESUME AVAILABILITY ===
     The CV is deliberately absent until a phone-free version exists, so the
     link must not sit there 404-ing. Hide it unless there is actually
     something to serve: an embedded copy, or a file that answers a HEAD.
     Opened straight off disk, fetch cannot check — assume present there.
  */
  (function resumeAvailability() {
    var link = document.querySelector('[data-resume]');
    if (!link) return;
    if (window.__CV_B64) return;                 /* embedded copy travels with the page */
    if (location.protocol === 'file:') return;   /* no fetch on file://; trust the folder */

    link.hidden = true;
    fetch(link.getAttribute('href'), { method: 'HEAD' })
      .then(function (r) { if (r.ok) link.hidden = false; })
      .catch(function () { /* stays hidden */ });
  })();

  (function chrome() {
    var nav = document.querySelector('.nav');
    if (nav) {
      var onScroll = function () { nav.classList.toggle('stuck', window.scrollY > 40); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    var top = document.getElementById('toTop');
    if (top) {
      top.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      });
    }
  })();
})();
