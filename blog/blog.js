// Blog: lists the posts in posts.json, renders a single post from Markdown,
// and draws the tier lists in tierlists.json on the blog page.
// To add a post or edit a tier list, see README.md in the site folder.
(function () {
  var sr = document.documentElement.lang.indexOf('sr') === 0;
  var base = document.querySelector('meta[name="blog-base"]').content; // folder holding posts.json
  var text = sr
    ? { empty: 'Još nema objava. Uskoro.', missing: 'Ova objava ne postoji.', failed: 'Objava trenutno ne može da se učita.' }
    : { empty: 'No posts yet. Check back soon.', missing: 'This post doesn’t exist.', failed: 'This couldn’t be loaded right now.' };
  var tierText = sr
    ? { soon: 'Uskoro.', none: 'Još nema lista.', updated: 'ažurirano', tryLabel: 'Probaj', map: 'Mapa', legend: 'Tačka označava mesta sa jelom koje preporučujem.' }
    : { soon: 'Coming soon.', none: 'No lists yet.', updated: 'updated', tryLabel: 'Try', map: 'Map', legend: 'A dot marks places with a dish I recommend.' };
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
        empty.textContent = text.empty;
        empty.hidden = false;
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

  // ---- tier lists (blog/index.html, the "Tier lists" section) ----
  var tierBox = document.getElementById('tierlists-box');
  if (tierBox) {
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

    // a list with "maps": "restoran Beograd" gets a Google Maps link per place: it searches for
    // the name (without any bracketed part) plus those words; an item's own "map" replaces the search
    var mapLink = function (list, item, cls) {
      if (!list.maps && !item.map) return null;
      var q = item.map || (tr(item.name).replace(/\s*\(.*?\)/g, '') + ' ' + list.maps);
      var a = make('a', cls, tierText.map + ' ↗');
      a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
      a.target = '_blank';
      a.rel = 'noopener';
      return a;
    };

    fetch(base + 'tierlists.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (lists) {
        if (!lists.length) {
          tierBox.appendChild(make('p', 'empty', tierText.none));
          return;
        }
        lists.forEach(function (list) {
          var art = make('article', 'tierlist');
          if (list.id) art.id = list.id;

          var head = make('div', 'tierlist-head');
          head.appendChild(make('h3', null, tr(list.title)));
          if (list.updated) {
            var t = make('time', 'meta', tierText.updated + ' ' + formatDate(list.updated));
            t.dateTime = list.updated;
            head.appendChild(t);
          }
          art.appendChild(head);

          // a numbered list ("ranked": [...]) instead of tiers: 1, 2, 3... with the note shown
          if (list.ranked) {
            if (list.note) art.appendChild(make('p', 'tierlist-note', tr(list.note)));
            var ol = make('ol', 'ranked');
            list.ranked.forEach(function (item, i) {
              if (typeof item === 'string') item = { name: item };
              var li = make('li', 'rank');
              li.style.setProperty('--i', i);
              li.appendChild(make('span', 'rank-n', String(i + 1)));
              var body = make('div', 'rank-body');
              var name = make(item.link ? 'a' : 'span', 'rank-name', tr(item.name));
              if (item.link) name.href = item.link;
              var rm = item.link ? null : mapLink(list, item, 'rank-map');
              if (rm) {
                var head = make('span', 'rank-head');
                head.append(name, rm);
                body.appendChild(head);
              } else body.appendChild(name);
              if (item.note) body.appendChild(make('span', 'rank-note', tr(item.note)));
              li.appendChild(body);
              ol.appendChild(li);
            });
            art.appendChild(ol);
            tierBox.appendChild(art);
            return;
          }

          var tiers = list.tiers || {};
          var keys = ORDER.filter(function (k) { return k in tiers; })
            .concat(Object.keys(tiers).filter(function (k) { return ORDER.indexOf(k) < 0; }));
          var total = 0;
          var board = make('div', 'tiers');
          keys.forEach(function (k, i) {
            var row = make('div', 'tier');
            row.dataset.tier = k;
            row.style.setProperty('--i', i);
            row.appendChild(make('div', 'tier-label', k));
            var ul = make('ul', 'tier-items');
            (tiers[k] || []).forEach(function (item) {
              if (typeof item === 'string') item = { name: item };
              var li = make('li');
              var chip = make(item.link ? 'a' : 'span', 'tier-item', tr(item.name));
              if (item.link) chip.href = item.link;
              var tm = item.link ? null : mapLink(list, item, 'tip-map');
              if (item.note || item.try || tm) {
                // a bubble with my take and what to order, shown on hover, keyboard focus or tap
                chip.classList.add('has-tip');
                if (item.try) chip.classList.add('has-try');
                var tip = make('span', 'tip');
                if (item.note) tip.appendChild(make('span', 'tip-note', tr(item.note)));
                if (item.try) {
                  var t = make('span', 'tip-try');
                  t.appendChild(make('b', null, tierText.tryLabel));
                  t.appendChild(document.createTextNode(' ' + tr(item.try)));
                  tip.appendChild(t);
                }
                if (tm) tip.appendChild(tm);
                chip.appendChild(tip);
                if (!item.link) chip.tabIndex = 0;
                var side = function () {
                  var r = chip.getBoundingClientRect();
                  chip.classList.toggle('tip-right', r.left + r.width / 2 > window.innerWidth / 2);
                };
                chip.addEventListener('pointerenter', side);
                chip.addEventListener('focus', side);
              }
              li.appendChild(chip);
              ul.appendChild(li);
              total++;
            });
            if (!ul.children.length) ul.appendChild(make('li', 'tier-empty', '—'));
            row.appendChild(ul);
            board.appendChild(row);
          });

          var note = tr(list.note) || (total ? '' : tierText.soon);
          if (note) art.appendChild(make('p', 'tierlist-note', note));
          if (board.querySelector('.has-try')) art.appendChild(make('p', 'tier-legend', tierText.legend));
          art.appendChild(board);
          tierBox.appendChild(art);
        });
      })
      .catch(function () { tierBox.appendChild(make('p', 'empty', text.failed)); });
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
