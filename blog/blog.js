// Blog: lists the posts in posts.json, renders a single post from Markdown,
// and draws the tier lists in tierlists.json on the blog page, one section per list.
// To add a post or edit a tier list, see README.md in the site folder.
(function () {
  var sr = document.documentElement.lang.indexOf('sr') === 0;
  var base = document.querySelector('meta[name="blog-base"]').content; // folder holding posts.json
  var text = sr
    ? { empty: 'Još nema objava. Uskoro.', missing: 'Ova objava ne postoji.', failed: 'Objava trenutno ne može da se učita.' }
    : { empty: 'No posts yet. Check back soon.', missing: 'This post doesn’t exist.', failed: 'This couldn’t be loaded right now.' };
  var tierText = sr
    ? { updated: 'ažurirano', tryLabel: 'Probaj', map: 'Mapa' }
    : { updated: 'updated', tryLabel: 'Try', map: 'Map' };
  var dateFmt = new Intl.DateTimeFormat(sr ? 'sr-Latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  function formatDate(iso) {
    return dateFmt.format(new Date(iso + 'T12:00:00'));
  }

  function loadIndex() {
    return fetch(base + 'posts.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (posts) {
        return posts.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
      });
  }

  // ---- list of posts (blog/index.html) ----
  var list = document.getElementById('post-list');
  var empty = document.getElementById('post-empty');
  if (list) {
    loadIndex().then(function (posts) {
      if (!posts.length) {
        // no posts yet: leave the section out rather than show an empty one
        list.closest('section').hidden = true;
        return;
      }
      posts.forEach(function (p, i) {
        var li = document.createElement('li');
        var head = document.createElement('div');
        head.className = 'entry-head';

        var titleWrap = document.createElement('span');
        var a = document.createElement('a');
        a.className = 'entry-title';
        a.href = 'post.html?p=' + encodeURIComponent(p.slug);
        a.textContent = p.title;
        titleWrap.appendChild(a);
        if (p.lang && p.lang !== (sr ? 'sr' : 'en')) {
          var tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = p.lang.toUpperCase();
          titleWrap.appendChild(tag);
        }

        var time = document.createElement('time');
        time.className = 'meta';
        time.dateTime = p.date;
        time.textContent = formatDate(p.date);

        head.append(titleWrap, time);
        li.appendChild(head);
        if (p.summary) {
          var s = document.createElement('p');
          s.textContent = p.summary;
          li.appendChild(s);
        }
        li.style.animation = 'rise 0.7s var(--ease-out) both';
        li.style.animationDelay = i * 60 + 'ms';
        list.appendChild(li);
      });
    }).catch(function () {
      empty.textContent = text.failed;
      empty.hidden = false;
    });
  }

  // ---- a single post (blog/post.html?p=slug) ----
  var body = document.getElementById('post-body');
  if (body) {
    var slug = new URLSearchParams(location.search).get('p') || '';
    var title = document.getElementById('post-title');

    // the language switch keeps you on the same post
    document.querySelectorAll('[data-keep-query]').forEach(function (a) {
      a.href = a.getAttribute('href') + location.search;
    });

    var showMessage = function (msg) {
      title.textContent = msg;
      body.hidden = true;
    };

    if (!/^[a-z0-9-]+$/.test(slug)) {
      showMessage(text.missing);
    } else {
      loadIndex().then(function (posts) {
        var post = posts.filter(function (p) { return p.slug === slug; })[0];
        if (!post) return showMessage(text.missing);
        document.title = post.title + ' — Nikola Kočović';
        title.textContent = post.title;
        var time = document.getElementById('post-date');
        time.dateTime = post.date;
        time.textContent = formatDate(post.date);
        if (post.lang) body.lang = post.lang === 'sr' ? 'sr-Latn' : post.lang;
        return fetch(base + 'posts/' + slug + '.md', { cache: 'no-cache' })
          .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
          .then(render);
      }).catch(function () { showMessage(text.failed); });
    }
  }

  // ---- tier lists (blog/index.html): one section per list, in the style of the home page ----
  // Each list gets its own section (label on the left), then its places grouped by tier, the tier
  // letter (or the rank, for a numbered list) set large in the margin. Every place shows my note,
  // what to try and a map link, so nothing hides behind a hover.
  var anchor = document.getElementById('tierlists');
  if (anchor) {
    var lang = sr ? 'sr' : 'en';
    var ORDER = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
    // a value may be plain text, or { "en": "...", "sr": "..." }
    var tr = function (v) {
      if (v && typeof v === 'object') return v[lang] || v.en || v.sr || '';
      return v || '';
    };
    var make = function (tag, cls, txt) {
      var el = document.createElement(tag);
      if (cls) el.className = cls;
      if (txt != null) el.textContent = txt;
      return el;
    };
    // "maps": "restoran Beograd" on a list adds a Google Maps search for each place: its name
    // (without any bracketed part) plus those words; an item's own "map" replaces the search
    var mapLink = function (list, item) {
      if (item.link || (!list.maps && !item.map)) return null;
      var q = item.map || (tr(item.name).replace(/\s*\(.*?\)/g, '') + ' ' + list.maps);
      var a = make('a', 'meta place-map', tierText.map + ' ↗');
      a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
      a.target = '_blank';
      a.rel = 'noopener';
      return a;
    };
    var place = function (list, item) {
      if (typeof item === 'string') item = { name: item };
      var li = make('li', 'place');
      var head = make('div', 'entry-head');
      var name = make(item.link ? 'a' : 'span', 'entry-title', tr(item.name));
      if (item.link) name.href = item.link;
      head.appendChild(name);
      var map = mapLink(list, item);
      if (map) head.appendChild(map);
      li.appendChild(head);
      if (item.note) li.appendChild(make('p', null, tr(item.note)));
      if (item.try) {
        var t = make('p', 'place-try');
        t.appendChild(make('span', 'place-try-label', tierText.tryLabel));
        t.appendChild(document.createTextNode(tr(item.try)));
        li.appendChild(t);
      }
      return li;
    };
    var group = function (mark, items, list, rank) {
      var g = make('div', 'tier-group');
      g.dataset.tier = mark;
      g.appendChild(make('span', 'tier-mark' + (rank ? ' is-rank' : ''), mark));
      var ul = make('ul', 'entries places');
      items.forEach(function (item) { ul.appendChild(place(list, item)); });
      if (!items.length) ul.appendChild(make('li', 'place-empty', '—'));
      g.appendChild(ul);
      return g;
    };

    var main = anchor.parentNode;
    var footer = main.querySelector('.footer');
    fetch(base + 'tierlists.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (lists) {
        lists.forEach(function (list) {
          var sec = make('section', 'tierlist');
          if (list.id) sec.id = list.id;
          sec.appendChild(make('h2', null, tr(list.label) || tr(list.title)));
          var body = make('div', 'tierlist-body');
          var head = make('div', 'entry-head tierlist-head');
          head.appendChild(make('h3', null, tr(list.title)));
          if (list.updated) {
            var time = make('time', 'meta', tierText.updated + ' ' + formatDate(list.updated));
            time.dateTime = list.updated;
            head.appendChild(time);
          }
          body.appendChild(head);
          if (list.note) body.appendChild(make('p', 'tierlist-note', tr(list.note)));
          if (list.ranked) {
            list.ranked.forEach(function (item, i) { body.appendChild(group(String(i + 1), [item], list, true)); });
          } else {
            var tiers = list.tiers || {};
            ORDER.filter(function (k) { return k in tiers; })
              .concat(Object.keys(tiers).filter(function (k) { return ORDER.indexOf(k) < 0; }))
              .forEach(function (k) { body.appendChild(group(k, tiers[k] || [], list, false)); });
          }
          sec.appendChild(body);
          main.insertBefore(sec, footer);
          // fade in like the other sections (reading its size first lets the fade start from hidden)
          void sec.offsetWidth;
          sec.classList.add('is-in');
        });
        // the page loaded before the lists existed: if it was opened at one, go there now
        var target = location.hash && document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
      })
      .catch(function () {
        var sec = make('section');
        sec.appendChild(make('h2', null, sr ? 'Liste' : 'Lists'));
        sec.appendChild(make('p', 'empty', text.failed));
        sec.classList.add('is-in');
        main.insertBefore(sec, footer);
      });
  }

  // Markdown -> HTML, with $...$ and $$...$$ math set by KaTeX.
  function render(md) {
    var math = [];
    var stash = function (tex, display) {
      math.push({ tex: tex.trim(), display: display });
      var tag = '<span class="math" data-i="' + (math.length - 1) + '"></span>';
      return display ? '\n\n' + tag + '\n\n' : tag;
    };
    // leave code (```blocks``` and `inline`) alone; take the math out of everything else
    var parts = md.split(/(```[\s\S]*?```|`[^`\n]+`)/);
    for (var i = 0; i < parts.length; i += 2) {
      parts[i] = parts[i]
        .replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) { return stash(tex, true); })
        .replace(/(^|[^\\$])\$(?!\s)([^$\n]+?)(?<!\s)\$/g, function (_, pre, tex) { return pre + stash(tex, false); });
    }
    body.innerHTML = marked.parse(parts.join(''));
    // photos: fade in once loaded; ![alt](photo.jpg "Caption") gets its caption underneath
    body.querySelectorAll('img').forEach(function (img) {
      var shown = function () { img.classList.add('is-loaded'); };
      if (img.complete) shown(); else { img.addEventListener('load', shown); img.addEventListener('error', shown); }
      if (!img.title) return;
      var fig = document.createElement('figure');
      var cap = document.createElement('figcaption');
      cap.textContent = img.title;
      img.removeAttribute('title');
      var p = img.parentNode;
      var alone = p.tagName === 'P' && p.childNodes.length === 1;
      (alone ? p : img).replaceWith(fig);
      fig.append(img, cap);
    });
    if (!math.length) return;

    var cdn = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/';
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = cdn + 'katex.min.css';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = cdn + 'katex.min.js';
    js.onload = function () {
      body.querySelectorAll('span.math').forEach(function (span) {
        var m = math[+span.dataset.i];
        katex.render(m.tex, span, { displayMode: m.display, throwOnError: false });
      });
    };
    document.head.appendChild(js);
  }
})();
