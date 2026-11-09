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
