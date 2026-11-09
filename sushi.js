// The sushi conveyor in the home page header is a little toy:
//   - drag a piece off the belt and drop it anywhere, or throw it (or off the edge!)
//   - tap a piece and it hops and does a flip
//   - tap the belt anywhere else for a burst of speed
//   - while the pointer is over it, the belt slows down so pieces are easier to catch
// Without this script the plain CSS animation in style.css still runs, just without the toy part.
(function () {
  var svg = document.querySelector('.sushi-line');
  if (!svg || !svg.getScreenCTM || !window.requestAnimationFrame) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var toy = svg.closest('.sushi-toy') || svg.parentNode;
  var tread = svg.querySelector('.sl-tread');
  var spokes = [].slice.call(svg.querySelectorAll('.sl-spokes'));
  var ROLLERS = [[20, 36], [140, 36]];

  // all in viewBox units (the drawing is 160 x 52)
  var BELT_Y = 28.8;         // where a plate's bottom sits on the belt
  var START = 28;            // new pieces drop on here
  var END = 134;             // ...and tip off here
  var LAND_MIN = 16;         // a falling piece lands if it comes down between these
  var LAND_MAX = 136;
  var SPACING = 36;
  var GRAVITY = 420;
  var SPEED = { normal: 18, hover: 6, turbo: 72 };
  var TYPES = ['#sl-salmon', '#sl-maki', '#sl-tamago', '#sl-tuna'];

  var speed = SPEED.normal;
  var hovering = false;
  var turboUntil = 0;
  var travelled = 0;
  var sinceSpawn = SPACING;
  var held = null;

  // three pieces start on the belt, the fourth drops on shortly
  var pieces = [].slice.call(svg.querySelectorAll('.sl-piece')).map(function (el, i) {
    var p = { el: el, x: 118 - i * SPACING, y: BELT_Y, vx: 0, vy: 0, rot: 0, vrot: 0, scale: 1, op: 1, mode: 'ride', falling: false };
    if (p.x < START) { p.mode = 'queue'; p.op = 0; }
    return p;
  });

  svg.classList.add('is-live');

  // ---- the name can be fed: drop a piece on a letter and it eats it ----
  var nameEl = document.querySelector('.site-name');
  var nameText = nameEl ? nameEl.textContent : '';
  var sr = document.documentElement.lang.indexOf('sr') === 0;
  var letters = [];
  var transformed = false;

  function buildName() {
    letters = [];
    nameEl.setAttribute('aria-label', nameText);
    nameEl.textContent = '';
    nameText.split('').forEach(function (ch, i) {
      if (ch === ' ') { nameEl.appendChild(document.createTextNode(' ')); return; }
      var s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i);
      s.textContent = ch;
      nameEl.appendChild(s);
      letters.push(s);
    });
  }
  if (nameEl) buildName();
  var hungry = null;

  // ---- easter egg: feed every letter and the name becomes the Euler–Lagrange equation ----
  function checkFull() {
    if (transformed || !letters.length) return;
    if (letters.every(function (l) { return l.classList.contains('is-fed'); })) {
      transformed = true;
      setTimeout(becomeEquation, 650);
    }
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  // when the heading switches between name and formulas, glide its height so the
  // text below moves smoothly instead of jumping
  function morphHeight(change) {
    var h0 = nameEl.getBoundingClientRect().height;
    change();
    var h1 = nameEl.getBoundingClientRect().height;
    if (Math.abs(h1 - h0) < 1) return;
    nameEl.style.transition = 'none';
    nameEl.style.height = h0 + 'px';
    void nameEl.offsetHeight;
    nameEl.style.transition = 'height 0.75s cubic-bezier(0.65, 0, 0.35, 1)';
    nameEl.style.height = h1 + 'px';
    setTimeout(function () {
      nameEl.style.height = '';
      nameEl.style.transition = '';
    }, 800);
  }

  // 1) the letters are copied onto a floating layer; the other letters spiral away while
  //    N and K fly to their places in two formulas built (hidden) where the name was
  var stopGraphs = null;

  function becomeEquation() {
    var cs = getComputedStyle(nameEl);
    var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#93a9ff';
    var layer = el('div', 'egg-layer');
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    // copies of every letter, floating exactly where the letters are
    var clones = letters.map(function (l) {
      var r = l.getBoundingClientRect();
      var c = el('span', 'egg-ch', l.textContent);
      c.style.left = r.left + 'px';
      c.style.top = r.top + 'px';
      c.style.width = r.width + 'px';
      c.style.height = r.height + 'px';
      c.style.lineHeight = r.height + 'px';
      c.style.font = cs.font;
      c.style.color = getComputedStyle(l).color;
      layer.appendChild(c);
      return { el: c, cx: r.left + r.width / 2, cy: r.top + r.height / 2, gulps: [] };
    });

    // first name -> N, surname -> K
    var kIndex = -1;
    letters.forEach(function (l, i) { if (kIndex < 0 && i > 0 && l.textContent === 'K') kIndex = i; });
    if (kIndex < 0) kIndex = Math.ceil(letters.length / 2);
    var initN = clones[0];
    var initK = clones[kIndex];
    initN.el.classList.add('is-initial');
    initK.el.classList.add('is-initial');
    var others = [];
    clones.forEach(function (it, i) {
      if (it === initN || it === initK) return;
      var homeIndex = i < kIndex ? 0 : kIndex;
      it.home = i < kIndex ? initN : initK;
      it.start = (Math.abs(i - homeIndex) - 1) * 75;  // nearest letters go first
      others.push(it);
    });
    initN.size = kIndex - 1;
    initK.size = letters.length - kIndex - 1;

    // build the formulas (hidden) and find where N and kappa will sit
    morphHeight(buildEquation);
    [[initN, '.eq-init-n'], [initK, '.eq-init-k']].forEach(function (pair) {
      var it = pair[0];
      var tr = nameEl.querySelector(pair[1]).getBoundingClientRect();
      it.s = tr.height / parseFloat(it.el.style.height);
      it.dx = tr.left + tr.width / 2 - it.cx;
      it.dy = tr.top + tr.height / 2 - it.cy;
    });

    var GULP = 760;                       // how long one letter takes to be swallowed
    var STAGGER = 60;                     // letters leave one after another, nearest first
    var absorbEnd = others.reduce(function (m, it) { return Math.max(m, it.start * (STAGGER / 75) + GULP); }, 0);
    var GLIDE_START = absorbEnd - 320;    // initials start moving before the last gulp lands
    var GLIDE = 1150;
    var REVEAL_AT = 0.78;                 // formulas start writing in before the initials land
    var t0 = performance.now();
    var revealed = false;
    var landed = false;
    var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    var easeInOutSine = function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; };
    var bez = function (a, b, c, t) { var u = 1 - t; return u * u * a + 2 * u * t * b + t * t * c; };
    others.forEach(function (it) {
      it.start = it.start * (STAGGER / 75);
      it.lift = 10 + Math.abs(it.home.cx - it.cx) * 0.12; // farther letters arc a little higher
    });

    function frame(now) {
      var t = now - t0;

      // the initials: a springy swell with every gulp, a glow that grows, then a smooth arc
      // to their place in the formulas (computed first, so swallowed letters chase them)
      var f = Math.max(0, Math.min(1, (t - GLIDE_START) / GLIDE));
      var fe = easeInOut(f);
      [initN, initK].forEach(function (it) {
        var swell = it.gulps.reduce(function (a, g) {
          var dt = now - g;
          return a + 0.08 * Math.exp(-dt / 220) * Math.sin(dt / 70);
        }, 0);
        var full = it.size ? it.gulps.length / it.size : 1;
        var lift = 46;
        it.x = bez(0, it.dx * 0.45, it.dx, fe);
        it.y = bez(0, it.dy * 0.2 - lift, it.dy, fe);
        var sc = (1 + swell) * (1 + (it.s - 1) * fe);
        it.el.style.transform = 'translate(' + it.x.toFixed(2) + 'px,' + it.y.toFixed(2) + 'px) scale(' + sc.toFixed(4) + ')';
        it.el.style.textShadow = '0 0 ' + (0.05 + 0.2 * Math.min(1, full)).toFixed(3) + 'em ' + accent;
      });

      // every other letter flows along a curve into its initial's current position
      others.forEach(function (it) {
        var q = Math.max(0, Math.min(1, (t - it.start) / GULP));
        var e = easeInOut(q);
        var hx = it.home.cx + (it.home.x || 0) - it.cx;
        var hy = it.home.cy + (it.home.y || 0) - it.cy;
        var x = bez(0, hx * 0.5, hx, e);
        var y = bez(0, hy * 0.5 - it.lift, hy, e);
        var sc = 1 - 0.8 * e;
        it.el.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) scale(' + sc.toFixed(4) + ')';
        it.el.style.opacity = String(1 - easeInOutSine(Math.max(0, (q - 0.5) / 0.5)));
        if (q >= 1 && !it.done) {
          it.done = true;
          it.home.gulps.push(now);
        }
      });

      if (!revealed && f >= REVEAL_AT) {
        revealed = true;
        reveal(layer, initN, initK);
      }
      if (!landed && f >= 0.97) {
        // N touches down on the real N: hand over without a double image
        landed = true;
        nameEl.classList.add('n-landed');
        initN.el.classList.add('is-gone', 'is-same');
      }
      if (t < GLIDE_START + GLIDE + 50) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // 2) N lands as N, K dissolves into kappa, the rest of both formulas writes in,
  //    and the two little graphs come alive
  function reveal(layer, initN, initK) {
    if (initK) initK.el.classList.add('is-gone'); // K dissolves into kappa (N lands separately)
    nameEl.classList.remove('is-pending');
    setTimeout(function () { layer.remove(); }, 600);
    fillGraphs();
    var note = el('p', 'egg-note',
      sr ? 'Sva slova nahranjena. N je otišlo Bolcmanu, K je postalo krivina. (Klikni na jednačine da vratiš ime.)'
         : 'Every letter fed. N went to Boltzmann, K became curvature. (Click the equations to get my name back.)');
    nameEl.insertAdjacentElement('afterend', note);
    // grow the caption open, so the text below slides down instead of jumping
    var full = note.offsetHeight;
    var mb = getComputedStyle(note).marginBottom;
    note.style.overflow = 'hidden';
    note.style.height = '0px';
    note.style.marginBottom = '0px';
    void note.offsetHeight;
    note.style.transition = 'height 0.6s cubic-bezier(0.65, 0, 0.35, 1), margin-bottom 0.6s cubic-bezier(0.65, 0, 0.35, 1)';
    note.style.height = full + 'px';
    note.style.marginBottom = mb;
    setTimeout(function () { note.style.height = ''; note.style.overflow = ''; note.style.transition = ''; }, 650);
  }

  function buildEquation() {
    nameEl.textContent = '';
    nameEl.classList.add('is-equation', 'is-pending');
    nameEl.setAttribute('aria-label', 'N equals N zero times e to the minus E over k B T, the Boltzmann law. Kappa equals the absolute value of y double prime, over one plus y prime, squared,, to the power three halves: the curvature.');
    nameEl.title = sr ? 'Klikni da vratiš ime' : 'Click to get my name back';
    var grid = el('span', 'eq-grid');
    grid.setAttribute('aria-hidden', 'true');
    var i = 0;
    var bit = function (cls, txt) {
      var b = el('span', 'eq-bit ' + cls, txt);
      b.style.setProperty('--i', i++);
      return b;
    };

    // Boltzmann: N = N0 e^(-E / kB T)
    var f1 = el('span', 'eq-formula');
    f1.appendChild(el('span', 'eq-init eq-init-n', 'N'));
    f1.appendChild(bit('eq-op', '='));
    var n0 = bit('eq-var', 'N');
    n0.appendChild(el('sub', 'eq-sub', '0'));
    f1.appendChild(n0);
    f1.appendChild(bit('eq-e', 'e'));
    var ex = bit('eq-sup', '−E/k');
    ex.appendChild(el('sub', 'eq-sub', 'B'));
    ex.appendChild(document.createTextNode('T'));
    f1.appendChild(ex);
    var g1 = bit('eq-graph eq-graph-bz', null);

    // curvature of a graph y(x): kappa = |y''| / (1 + y'^2)^(3/2)
    var f2 = el('span', 'eq-formula');
    f2.appendChild(el('span', 'eq-init eq-init-k', 'κ'));
    f2.appendChild(bit('eq-op', '='));
    var fr = bit('eq-frac eq-frac-k', null);
    fr.appendChild(el('span', 'eq-num', '|y″|'));
    var den = el('span', 'eq-den');
    den.appendChild(document.createTextNode('(1 + (y′)'));
    den.appendChild(el('sup', 'eq-pow', '2'));
    den.appendChild(document.createTextNode(')'));
    den.appendChild(el('sup', 'eq-pow', '3/2'));
    fr.appendChild(den);
    f2.appendChild(fr);
    var g2 = bit('eq-graph eq-graph-k', null);

    grid.appendChild(f1);
    grid.appendChild(g1);
    grid.appendChild(f2);
    grid.appendChild(g2);
    nameEl.appendChild(grid);
  }

  function fillGraphs() {
    // Boltzmann: the exponential fall-off draws itself, then a bead slides down it and back
    var d = '';
    for (var x = 6; x <= 56; x += 2) {
      d += (x === 6 ? 'M' : 'L') + x + ' ' + (34 - 28 * Math.exp(-(x - 6) / 10)).toFixed(2);
    }
    nameEl.querySelector('.eq-graph-bz').innerHTML =
      '<svg viewBox="0 0 60 42" aria-hidden="true" focusable="false">' +
      '<path class="g-fill" d="' + d + 'L56 36L6 36Z"/>' +
      '<path class="ph-axis" d="M5 2V36H58"/>' +
      '<text class="ph-label" x="-2" y="7">N</text><text class="ph-label" x="54" y="43">E</text>' +
      '<path class="g-curve" pathLength="100" d="' + d + '"/>' +
      '<circle class="ph-dot" r="2.3" style="--d:1.7s">' +
      '<animateMotion dur="3.2s" begin="1.7s" repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1" path="' + d + '"/>' +
      '</circle></svg>';

    // curvature: a wave draws itself, then an osculating circle (radius 1/kappa) rides along it
    var A = 8, L = 7.6;
    var f = function (x) { return 20 + A * Math.sin((x - 6) / L); };
    var wave = '';
    for (var w = 6; w <= 56; w += 1) wave += (w === 6 ? 'M' : 'L') + w + ' ' + f(w).toFixed(2);
    var kg = nameEl.querySelector('.eq-graph-k');
    kg.innerHTML =
      '<svg viewBox="0 0 60 42" aria-hidden="true" focusable="false">' +
      '<path class="g-curve" pathLength="100" d="' + wave + '"/>' +
      '<line class="osc-r" x1="0" y1="0" x2="0" y2="0"/>' +
      '<circle class="osc" r="0"/>' +
      '<circle class="osc-p" r="1.9"/>' +
      '</svg>';
    var circ = kg.querySelector('.osc');
    var rad = kg.querySelector('.osc-r');
    var pt = kg.querySelector('.osc-p');
    [circ, rad, pt].forEach(function (n) { n.style.opacity = 0; });

    var t0 = performance.now() + 1800;
    var alive = true;
    function loop(now) {
      if (!alive) return;
      var t = Math.max(0, now - t0) / 1000;
      var u = (1 - Math.cos(t * Math.PI / 3.5)) / 2; // eases back and forth along the curve
      var x = 8 + 46 * u;
      var y = f(x);
      var d1 = (A / L) * Math.cos((x - 6) / L);
      var d2 = -(A / (L * L)) * Math.sin((x - 6) / L);
      var k = d2 / Math.pow(1 + d1 * d1, 1.5);
      var n = Math.sqrt(1 + d1 * d1);
      var R = Math.abs(1 / k);
      var show = now < t0 ? 0 : Math.max(0, Math.min(1, (30 - R) / 18));
      if (Math.abs(k) > 1e-4) {
        var cxp = x + (-d1 / n) / k;
        var cyp = y + (1 / n) / k;
        circ.setAttribute('cx', cxp.toFixed(2));
        circ.setAttribute('cy', cyp.toFixed(2));
        circ.setAttribute('r', Math.min(R, 60).toFixed(2));
        rad.setAttribute('x1', x.toFixed(2));
        rad.setAttribute('y1', y.toFixed(2));
        rad.setAttribute('x2', cxp.toFixed(2));
        rad.setAttribute('y2', cyp.toFixed(2));
      }
      pt.setAttribute('cx', x.toFixed(2));
      pt.setAttribute('cy', y.toFixed(2));
      circ.style.opacity = (show * 0.85).toFixed(3);
      rad.style.opacity = (show * 0.6).toFixed(3);
      pt.style.opacity = now < t0 ? 0 : 1;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    stopGraphs = function () { alive = false; };
  }

  // 3) going back: the formulas fade, N and kappa glide home (kappa turning back into K),
  //    and the letters flow back out of their initial, nearest first
  var restoring = false;

  function restoreName() {
    if (restoring) return;
    restoring = true;
    if (stopGraphs) { stopGraphs(); stopGraphs = null; }
    var note = nameEl.parentNode.querySelector('.egg-note');
    if (note) {
      note.style.overflow = 'hidden';
      note.style.height = note.offsetHeight + 'px';
      void note.offsetHeight;
      note.style.transition = 'opacity 0.3s ease, height 0.5s cubic-bezier(0.65, 0, 0.35, 1), margin-bottom 0.5s cubic-bezier(0.65, 0, 0.35, 1)';
      note.classList.add('is-clearing');
      note.style.height = '0px';
      note.style.marginBottom = '0px';
    }
    var nFrom = nameEl.querySelector('.eq-init-n').getBoundingClientRect();
    var kFrom = nameEl.querySelector('.eq-init-k').getBoundingClientRect();
    nameEl.classList.add('is-clearing'); // everything but N and kappa fades away

    setTimeout(function () {
      if (note) setTimeout(function () { note.remove(); }, 220); // once it has fully closed
      nameEl.classList.remove('is-equation', 'is-clearing', 'n-landed');
      nameEl.removeAttribute('title');
      morphHeight(function () {
        buildName();
        nameEl.classList.add('is-restoring'); // the letters are in place but invisible for now
      });

      var cs = getComputedStyle(nameEl);
      var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#93a9ff';
      var layer = el('div', 'egg-layer');
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
      var copy = function (ch, r) {
        var c = el('span', 'egg-ch', ch);
        c.style.left = r.left + 'px';
        c.style.top = r.top + 'px';
        c.style.width = r.width + 'px';
        c.style.height = r.height + 'px';
        c.style.lineHeight = r.height + 'px';
        c.style.font = cs.font;
        layer.appendChild(c);
        return c;
      };

      var kIndex = -1;
      letters.forEach(function (l, i) { if (kIndex < 0 && i > 0 && l.textContent === 'K') kIndex = i; });
      if (kIndex < 0) kIndex = Math.ceil(letters.length / 2);
      var items = letters.map(function (l, i) {
        var r = l.getBoundingClientRect();
        return { i: i, r: r, cx: r.left + r.width / 2, cy: r.top + r.height / 2, gulps: [] };
      });
      var N = items[0];
      var K = items[kIndex];
      N.el = copy('N', N.r);
      K.el = copy('K', K.r);
      K.kappa = copy('κ', K.r);
      [N.el, K.el, K.kappa].forEach(function (c) { c.classList.add('is-initial'); });
      N.from = nFrom;
      K.from = kFrom;
      [N, K].forEach(function (it) {
        it.s0 = it.from.height / it.r.height;
        it.dx0 = it.from.left + it.from.width / 2 - it.cx;
        it.dy0 = it.from.top + it.from.height / 2 - it.cy;
      });
      var others = items.filter(function (it) { return it !== N && it !== K; });
      others.forEach(function (it) {
        it.home = it.i < kIndex ? N : K;
        it.order = Math.abs(it.i - (it.i < kIndex ? 0 : kIndex)) - 1;
        it.lift = 10 + Math.abs(it.home.cx - it.cx) * 0.12;
        it.el = copy(letters[it.i].textContent, it.r);
        it.el.style.opacity = '0';
      });

      var GLIDE = 1050;
      var EMERGE = 600;  // letters start leaving the initials while these are still gliding home
      var STAGGER = 60;
      var DUR = 720;
      var lastOrder = others.reduce(function (m, it) { return Math.max(m, it.order); }, 0);
      var END = EMERGE + lastOrder * STAGGER + DUR;
      var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
      var easeSine = function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; };
      var bez = function (a, b, c, t) { var u = 1 - t; return u * u * a + 2 * u * t * b + t * t * c; };
      var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
      var t0 = performance.now();
      var cooled = false;

      function frame(now) {
        var t = now - t0;
        var g = easeInOut(clamp(t / GLIDE));

        [N, K].forEach(function (it) {
          var swell = it.gulps.reduce(function (a, gl) {
            var dt = now - gl;
            return a + 0.06 * Math.exp(-dt / 220) * Math.sin(dt / 70);
          }, 0);
          var x = bez(it.dx0, it.dx0 * 0.55, 0, g);
          var y = bez(it.dy0, it.dy0 * 0.8 - 40, 0, g);
          var sc = (it.s0 + (1 - it.s0) * g) * (1 + swell);
          var tf = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) scale(' + sc.toFixed(4) + ')';
          it.el.style.transform = tf;
          if (it.kappa) it.kappa.style.transform = tf;
          it.nowX = it.cx + x;
          it.nowY = it.cy + y;
          if (!cooled) it.el.style.textShadow = '0 0 ' + (0.2 * (1 - g) + 0.04).toFixed(3) + 'em ' + accent;
        });
        // kappa turns back into K on the way
        var c = easeSine(clamp((g - 0.2) / 0.5));
        K.kappa.style.opacity = String(1 - c);
        K.el.style.opacity = String(c);

        others.forEach(function (it) {
          var q = clamp((t - EMERGE - it.order * STAGGER) / DUR);
          if (q > 0 && !it.out) { it.out = true; it.home.gulps.push(now); }
          var e = easeInOut(q);
          var sx = it.home.nowX - it.cx;
          var sy = it.home.nowY - it.cy;
          var x = bez(sx, sx * 0.5, 0, e);
          var y = bez(sy, sy * 0.5 - it.lift, 0, e);
          var sc = 0.2 + 0.8 * e;
          it.el.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) scale(' + sc.toFixed(4) + ')';
          it.el.style.opacity = String(easeSine(clamp(q / 0.5)));
        });

        // the initials cool back to the normal text colour as the last letters arrive
        if (!cooled && t > END - 500) {
          cooled = true;
          [N.el, K.el].forEach(function (n) { n.style.textShadow = ''; n.classList.add('is-cooling'); });
        }

        if (t < END) {
          requestAnimationFrame(frame);
        } else {
          nameEl.classList.remove('is-restoring');
          layer.remove();
          transformed = false;
          restoring = false;
        }
      }
      requestAnimationFrame(frame);
    }, 340);
  }

  if (nameEl) {
    nameEl.addEventListener('click', function () {
      if (nameEl.classList.contains('is-equation')) restoreName();
    });
  }

  function letterAt(cx, cy) {
    for (var i = 0; i < letters.length; i++) {
      var r = letters[i].getBoundingClientRect();
      if (cx >= r.left - 4 && cx <= r.right + 4 && cy >= r.top - 6 && cy <= r.bottom + 6) return letters[i];
    }
    return null;
  }

  function setHungry(l) {
    if (l === hungry) return;
    if (hungry) hungry.classList.remove('is-hungry');
    hungry = l;
    if (hungry) hungry.classList.add('is-hungry');
  }

  // ---- pointer helpers ----
  function toSvg(e) {
    var m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    var pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  }

  function pieceFor(el) {
    for (var i = 0; i < pieces.length; i++) if (pieces[i].el === el) return pieces[i];
    return null;
  }

  toy.addEventListener('pointerenter', function () { hovering = true; });
  toy.addEventListener('pointerleave', function () { hovering = false; });

  svg.addEventListener('pointerdown', function (e) {
    toy.classList.add('played');
    var p = pieceFor(e.target);
    if (!p || p.mode === 'queue') {
      turboUntil = performance.now() + 1400; // tapped the belt: whoosh
      return;
    }
    e.preventDefault();
    var pt = toSvg(e);
    held = { p: p, id: e.pointerId, dx: p.x - pt.x, dy: p.y - pt.y, sx: pt.x, sy: pt.y, moved: 0, lx: pt.x, ly: pt.y, lt: performance.now(), vx: 0, vy: 0, wasRiding: p.mode === 'ride' };
    p.mode = 'drag';
    p.el.classList.add('is-held');
    toy.classList.add('is-playing');
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  });

  svg.addEventListener('pointermove', function (e) {
    if (!held || e.pointerId !== held.id) return;
    var pt = toSvg(e);
    var now = performance.now();
    var dt = Math.max(1, now - held.lt) / 1000;
    held.vx = held.vx * 0.6 + ((pt.x - held.lx) / dt) * 0.4;
    held.vy = held.vy * 0.6 + ((pt.y - held.ly) / dt) * 0.4;
    held.lx = pt.x; held.ly = pt.y; held.lt = now;
    held.moved = Math.max(held.moved, Math.hypot(pt.x - held.sx, pt.y - held.sy));
    var p = held.p;
    p.x = Math.min(220, Math.max(-600, pt.x + held.dx));
    p.y = Math.min(90, Math.max(-300, pt.y + held.dy));
    setHungry(letterAt(e.clientX, e.clientY));
  });

  function release(e) {
    if (!held || e.pointerId !== held.id) return;
    var p = held.p;
    p.el.classList.remove('is-held');
    toy.classList.remove('is-playing');
    p.mode = 'air';
    p.falling = false;
    var eater = hungry;
    setHungry(null);
    if (eater && held.moved >= 2.5) {
      // dropped on a letter: it flies into the letter's mouth and the letter chomps
      var r = eater.getBoundingClientRect();
      var m = svg.getScreenCTM().inverse();
      var c = new DOMPoint(r.left + r.width / 2, r.top + r.height * 0.6).matrixTransform(m);
      p.mode = 'eaten';
      p.tx = c.x; p.ty = c.y; p.t = 0;
      setTimeout(function () {
        eater.classList.remove('is-chomping');
        void eater.offsetWidth; // restart the animation
        eater.classList.add('is-chomping', 'is-fed');
        checkFull();
      }, 160);
      held = null;
      return;
    }
    if (held.moved < 2.5) {
      // a tap: hop up and do a full flip, carried along by the belt
      var up = 100;
      p.vy = -up;
      p.vx = held.wasRiding ? speed : 0;
      p.vrot = 360 / ((2 * up) / GRAVITY);
    } else {
      // let go after a drag: it keeps the throw's momentum
      p.vx = Math.max(-160, Math.min(160, held.vx));
      p.vy = Math.max(-160, Math.min(160, held.vy));
      p.vrot = p.vx * 1.6;
    }
    held = null;
  }
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);

  // ---- simulation ----
  function step(dt, now) {
    var target = now < turboUntil ? SPEED.turbo : (hovering || held) ? SPEED.hover : SPEED.normal;
    speed += (target - speed) * Math.min(1, dt * (target > speed ? 6 : 3));
    travelled += speed * dt;
    sinceSpawn += speed * dt;

    pieces.forEach(function (p) {
      if (p.mode === 'ride') {
        p.x += speed * dt;
        p.y = BELT_Y;
        if (p.x >= END) {
          // tip over the right roller and fall off
          p.mode = 'air';
          p.falling = true;
          p.vx = speed;
          p.vy = -6;
          p.vrot = 180 + speed * 3;
        }
      } else if (p.mode === 'eaten') {
        p.t += dt / 0.22;
        var k = Math.min(1, p.t);
        p.x += (p.tx - p.x) * Math.min(1, dt * 18);
        p.y += (p.ty - p.y) * Math.min(1, dt * 18);
        p.scale = 1.18 * (1 - k);
        p.op = 1 - k * 0.6;
        if (k >= 1) { p.mode = 'queue'; p.scale = 1; p.fresh = true; } // eaten: it won't be back
        return;
      } else if (p.mode === 'air') {
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        var overBelt = p.x >= LAND_MIN && p.x <= LAND_MAX && !p.falling;
        if (overBelt && p.y >= BELT_Y && p.vy > 0) {
          p.y = BELT_Y;
          if (p.vy > 70) {
            p.vy = -p.vy * 0.28; // small bounce
            p.vx *= 0.4;
            p.rot = ((((p.rot % 360) + 540) % 360) - 180) * 0.25; // settle towards upright
            p.vrot *= 0.2;
          } else {
            p.mode = 'ride';
            p.vy = 0;
            p.vx = 0;
            p.vrot = 0;
            p.rot = 0;
          }
        }
        if (p.y > 46 && !overBelt) p.falling = true;
        if (p.y > 95 || p.x < -80 || p.x > 240) {
          p.mode = 'queue';
          p.op = 0;
        }
      }

      // fading in when dropped on, out when falling off
      if (p.mode === 'queue') p.op = 0;
      else if (p.falling) p.op = Math.max(0, Math.min(1, 1 - (p.y - 34) / 18));
      else p.op = Math.min(1, p.op + dt * 5);

      var targetScale = p.mode === 'drag' ? 1.18 : 1;
      p.scale += (targetScale - p.scale) * Math.min(1, dt * 12);
      if (p.mode === 'drag') {
        var tilt = held ? Math.max(-25, Math.min(25, held.vx * 0.12)) : 0;
        p.rot += (tilt - p.rot) * Math.min(1, dt * 10);
      }
    });

    // drop a waiting piece on at the start once there's room
    var waiting = pieces.filter(function (p) { return p.mode === 'queue'; });
    var crowded = pieces.some(function (p) { return p.mode !== 'queue' && !p.falling && Math.abs(p.x - START) < 16 && p.y > BELT_Y - 20; });
    if (waiting.length && sinceSpawn >= SPACING && !crowded) {
      var p = waiting[0];
      p.falling = false;
      p.vx = 0; p.vy = 0; p.rot = 0; p.vrot = 0; p.op = 0; p.scale = 1;
      if (p.fresh) {
        // a letter ate this one, so the kitchen serves a new, different piece,
        // sliding on at the left end instead of dropping back on
        p.fresh = false;
        var cur = p.el.getAttribute('href');
        var choices = TYPES.filter(function (t) { return t !== cur; });
        p.el.setAttribute('href', choices[Math.floor(Math.random() * choices.length)]);
        p.mode = 'ride';
        p.x = START - 12;
        p.y = BELT_Y;
      } else {
        // thrown or tipped off the end: it drops back on
        p.mode = 'air';
        p.x = START;
        p.y = BELT_Y - 14;
      }
      sinceSpawn = 0;
    }
  }

  function draw() {
    tread.style.strokeDashoffset = String(-(travelled % 6));
    var deg = (travelled / 6) * (180 / Math.PI);
    spokes.forEach(function (s, i) {
      s.setAttribute('transform', 'rotate(' + deg.toFixed(1) + ' ' + ROLLERS[i][0] + ' ' + ROLLERS[i][1] + ')');
    });
    pieces.forEach(function (p) {
      p.el.setAttribute('transform', 'translate(' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ') rotate(' + p.rot.toFixed(1) + ') scale(' + p.scale.toFixed(3) + ')');
      p.el.style.opacity = p.op.toFixed(3);
    });
  }

  // ---- run only while it's on screen ----
  var running = false;
  var onScreen = true;
  var last = 0;

  function frame(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    step(dt, now);
    draw();
    requestAnimationFrame(frame);
  }

  function update() {
    var go = onScreen && !document.hidden;
    if (go && !running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    } else if (!go) {
      running = false;
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      update();
    }).observe(svg);
  }
  document.addEventListener('visibilitychange', update);
  draw();
  update();
})();
