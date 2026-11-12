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

  // ---- easter egg: feed every letter and a message appears under the name ----
  // The letters do a little wave, the message slides open under the name and the letters go
  // back to normal, so they can be fed all over again. Click the name or the message to close it.
  var note = null;

  function checkFull() {
    if (!letters.length) return;
    if (letters.every(function (l) { return l.classList.contains('is-fed'); })) setTimeout(celebrate, 450);
  }

  function celebrate() {
    letters.forEach(function (l) {
      l.classList.remove('is-cheering');
      void l.offsetWidth; // restart the wave
      l.classList.add('is-cheering');
      l.classList.remove('is-fed');
    });
    if (note) return;
    note = document.createElement('p');
    note.className = 'egg-note';
    note.setAttribute('role', 'status');
    note.textContent = sr ? 'Čestitam, nemaš posla' : 'Congrats, you are jobless';
    nameEl.insertAdjacentElement('afterend', note);
    // grow it open, so the text below slides down instead of jumping
    var full = note.offsetHeight;
    note.style.height = '0px';
    void note.offsetHeight;
    note.style.height = full + 'px';
    setTimeout(function () { if (note) note.style.height = ''; }, 700);
    note.addEventListener('click', closeNote);
  }

  function closeNote() {
    if (!note) return;
    var n = note;
    note = null;
    n.style.height = n.offsetHeight + 'px';
    void n.offsetHeight;
    n.classList.add('is-leaving');
    n.style.height = '0px';
    setTimeout(function () { n.remove(); }, 600);
  }

  if (nameEl) nameEl.addEventListener('click', closeNote);

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
