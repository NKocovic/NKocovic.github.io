// Small enhancements for every page: sections fade in as they scroll into
// view, and "Show more" buttons open and close their lists.
(function () {
  var root = document.documentElement;
  clearTimeout(window.__revealFailsafe);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- reveal on scroll ----
  var targets = Array.prototype.slice.call(
    document.querySelectorAll('main > section, main > article, .footer')
  );

  function showAll() {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  }

  // Wait one frame so a page transition (if any) has had the chance to mark the page.
  requestAnimationFrame(function () {
    if (reduce || !('IntersectionObserver' in window)) return showAll();

    // Coming from another page of the site: what is already on screen appears at once,
    // under the cross-fade; the rest still fades in on scroll.
    if (root.classList.contains('no-intro')) {
      targets = targets.filter(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('instant', 'is-in');
          return false;
        }
        return true;
      });
    }

    var io = new IntersectionObserver(function (entries) {
      var n = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--delay', 120 + n++ * 90 + 'ms');
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });

    targets.forEach(function (el) { io.observe(el); });
  });

  // ---- small easter eggs ----
  var sr = root.lang.indexOf('sr') === 0;

  // the IPhO medal swings like a real pendulum: theta'' = -(g/l) sin(theta) - damping.
  // Click in rhythm and it gains enough energy to loop over the top.
  var medal = document.querySelector('.medal');
  if (medal) {
    var medalNote = medal.parentNode.querySelector('.medal-note');
    var noteText = medalNote ? medalNote.textContent : '';
    var th = 0;
    var om = 0;
    var swinging = false;
    var looped = false;
    var lastT = 0;
    var noteTimer = null;
    var G_L = 49;   // (g / l): a swing period of about 0.9 s
    var DAMP = 1.7;

    var showNote = function (text, ms) {
      if (!medalNote) return;
      medalNote.textContent = text;
      medalNote.classList.add('is-on');
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () { medalNote.classList.remove('is-on'); }, ms);
    };

    var swing = function (now) {
      var dt = Math.min(0.033, (now - lastT) / 1000);
      lastT = now;
      for (var i = 0; i < 4; i++) {
        var h = dt / 4;
        om += (-G_L * Math.sin(th) - DAMP * om) * h;
        th += om * h;
      }
      if (!looped && Math.abs(th) > Math.PI) {
        looped = true;
        showNote('E > 2mgℓ', 2200); // enough energy to go over the top
      }
      var energy = om * om / 2 + G_L * (1 - Math.cos(th));
      if (energy < 0.01) { // under about a degree: let it rest
        th = 0;
        om = 0;
        looped = false;
        swinging = false;
        medal.style.transform = '';
        return;
      }
      medal.style.transform = 'rotate(' + (th * 180 / Math.PI).toFixed(2) + 'deg)';
      requestAnimationFrame(swing);
    };

    medal.addEventListener('click', function () {
      showNote(noteText, 2600);
      if (reduce) return;
      om += 7.5 * (om < 0 ? -1 : 1); // push the way it's already going, like pumping a swing
      if (!swinging) {
        swinging = true;
        lastT = performance.now();
        requestAnimationFrame(swing);
      }
    });
  }

  // "(lol)": a few music notes float up
  document.querySelectorAll('.lol').forEach(function (lol) {
    lol.addEventListener('click', function () {
      if (reduce || !lol.animate) return;
      var r = lol.getBoundingClientRect();
      ['♪', '♫', '♪'].forEach(function (sym, i) {
        var n = document.createElement('span');
        n.className = 'note-fly';
        n.setAttribute('aria-hidden', 'true');
        n.textContent = sym;
        n.style.left = r.left + r.width * (0.3 + 0.2 * i) + 'px';
        n.style.top = r.top - 4 + 'px';
        document.body.appendChild(n);
        var drift = (i - 1) * 14 + (Math.random() - 0.5) * 8;
        n.animate([
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 0 },
          { transform: 'translate(' + drift * 0.3 + 'px, -14px) rotate(' + drift * 0.4 + 'deg)', opacity: 1, offset: 0.2 },
          { transform: 'translate(' + drift + 'px, -46px) rotate(' + drift + 'deg)', opacity: 0 }
        ], { duration: 1300, delay: i * 110, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' })
          .onfinish = function () { n.remove(); };
      });
    });
  });

  // switch to another tab and this one asks you to come back
  var savedTitle = null;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      savedTitle = document.title;
      document.title = sr ? 'Vrati se, suši se hladi 🍣' : 'Come back, the sushi is getting cold 🍣';
    } else if (savedTitle !== null) {
      document.title = savedTitle;
      savedTitle = null;
    }
  });

  // a hello for anyone who opens the developer console
  try {
    console.log(
      '%c' + (sr ? 'Zdravo, radoznali.' : 'Hi there, curious one.'),
      'font: 500 15px Georgia, serif; color: #2648b8;',
      '\n' + (sr ? 'Probaj da nahraniš moje ime sušijem i gurni medalju.' : 'Try feeding my name some sushi, and give the medal a nudge.')
    );
  } catch (err) {}

  // ---- page transition: whichever "Blog" link you click grows into the blog's heading ----
  // (links that jump into the page, like the sushi's #tierlists, skip the morph)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var morphing = document.querySelectorAll('.vt-blog, [data-vt-blog]');
    if (!morphing.length) return;
    morphing.forEach(function (el) { el.style.viewTransitionName = 'none'; });
    if (a.matches('.vt-blog, [data-vt-blog]') && a.getAttribute('href').indexOf('#') < 0) {
      a.style.viewTransitionName = 'blog-title';
    }
  });

  // ---- latest blog posts on the home page ----
  var latest = document.getElementById('latest-posts');
  if (latest) {
    var sr = root.lang.indexOf('sr') === 0;
    var fmt = new Intl.DateTimeFormat(sr ? 'sr-Latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    fetch(latest.dataset.posts + 'posts.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (posts) {
        if (!posts.length) return;
        posts.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
        posts.slice(0, 3).forEach(function (p, i) {
          var li = document.createElement('li');
          var head = document.createElement('div');
          head.className = 'entry-head';
          var a = document.createElement('a');
          a.className = 'entry-title';
          a.href = latest.dataset.link + 'post.html?p=' + encodeURIComponent(p.slug);
          a.textContent = p.title;
          var time = document.createElement('time');
          time.className = 'meta';
          time.dateTime = p.date;
          time.textContent = fmt.format(new Date(p.date + 'T12:00:00'));
          head.append(a, time);
          li.appendChild(head);
          if (p.summary) {
            var s = document.createElement('p');
            s.textContent = p.summary;
            li.appendChild(s);
          }
          li.style.animation = 'rise 0.7s var(--ease-out) both';
          li.style.animationDelay = i * 70 + 'ms';
          latest.appendChild(li);
        });
        latest.hidden = false;
        document.getElementById('blog-teaser').hidden = true;
      })
      .catch(function () {});
  }

  // ---- expandable entries (click a title to show its text) ----
  document.querySelectorAll('.expand-head').forEach(function (btn) {
    var body = document.getElementById(btn.getAttribute('aria-controls'));
    if (!body) return;
    body.inert = true;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      body.classList.toggle('is-open', open);
      body.inert = !open;
    });
  });

  // ---- "Show more" lists ----
  document.querySelectorAll('.more-toggle').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    var label = btn.querySelector('.more-label');
    panel.inert = true;
    panel.querySelectorAll('li').forEach(function (li, i) {
      li.style.setProperty('--i', i);
    });
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
      panel.inert = !open;
      label.textContent = open ? btn.dataset.less : btn.dataset.more;
    });
  });
})();
