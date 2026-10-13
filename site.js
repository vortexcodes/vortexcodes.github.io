// Renders the home page, project pages and build log from data/projects.js and data/log.js.
(function () {
  var P = (window.PROJECTS || []).slice().sort(function (a, b) { return b.sort.localeCompare(a.sort); });
  var L = (window.LOG || []).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
  var bySlug = {}; P.forEach(function (p) { bySlug[p.slug] = p; });

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function url(p) { return 'project.html?p=' + encodeURIComponent(p.slug); }
  function fmtDate(s) {
    var d = new Date(s + 'T12:00:00');
    return isNaN(d) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function hrs(n) { return (Math.round(n * 10) / 10).toString(); }
  function logFor(slug) { return L.filter(function (e) { return e.project === slug; }); }

  /* ---------- lightbox ---------- */
  var lb, lbImg, lbCount, lbList = [], lbIdx = 0;
  function openLightbox(list, i) {
    if (!lb) {
      lb = el('dialog', { class: 'lightbox', 'aria-label': 'Photo viewer' });
      var inner = el('div', { class: 'lb-inner' });
      lbImg = el('img', { alt: '' });
      lbCount = el('div', { class: 'lb-count' });
      var close = el('button', { class: 'lb-close', type: 'button', text: 'Close' });
      var prev = el('button', { class: 'lb-prev', type: 'button', text: 'Previous', 'aria-label': 'Previous photo' });
      var next = el('button', { class: 'lb-next', type: 'button', text: 'Next', 'aria-label': 'Next photo' });
      close.onclick = function () { lb.close(); };
      prev.onclick = function () { show(lbIdx - 1); };
      next.onclick = function () { show(lbIdx + 1); };
      inner.onclick = function (e) { if (e.target === inner) lb.close(); };
      lb.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') show(lbIdx - 1);
        if (e.key === 'ArrowRight') show(lbIdx + 1);
      });
      inner.appendChild(lbImg);
      [inner, close, prev, next, lbCount].forEach(function (n) { lb.appendChild(n); });
      document.body.appendChild(lb);
    }
    lbList = list; show(i);
    lb.querySelector('.lb-prev').hidden = lb.querySelector('.lb-next').hidden = list.length < 2;
    if (lb.showModal) lb.showModal(); else window.open(list[i].src, '_blank');
  }
  function show(i) {
    lbIdx = (i + lbList.length) % lbList.length;
    lbImg.src = lbList[lbIdx].src; lbImg.alt = lbList[lbIdx].alt;
    lbCount.textContent = (lbIdx + 1) + ' of ' + lbList.length;
  }
  function gallery(photos, label, videos) {
    var g = el('div', { class: 'gallery' });
    var list = photos.map(function (src, i) { return { src: src, alt: label + ', photo ' + (i + 1) }; });
    list.forEach(function (ph, i) {
      var b = el('button', { type: 'button', 'aria-label': 'Open ' + ph.alt });
      b.appendChild(el('img', { src: ph.src, alt: ph.alt, loading: i ? 'lazy' : 'eager' }));
      b.onclick = function () { openLightbox(list, i); };
      g.appendChild(b);
    });
    (videos || []).forEach(function (src) {
      var v = el('video', { controls: '', preload: 'metadata', playsinline: '' });
      v.appendChild(el('source', { src: src, type: 'video/mp4' }));
      g.appendChild(v);
    });
    return g;
  }

  /* ---------- home ---------- */
  function renderHome() {
    var grid = document.getElementById('work-grid');
    if (grid) P.filter(function (p) { return p.featured; }).forEach(function (p) {
      grid.appendChild(el('a', { class: 'item', href: url(p) }, [
        el('div', { class: 'shot' }, [el('img', { src: p.cover, alt: p.name, loading: 'lazy' })]),
        el('h3', { text: p.name }),
        el('p', { text: p.when + ', ' + p.kind.toLowerCase() })
      ]));
    });
    var body = document.getElementById('index-body');
    if (body) P.forEach(function (p) {
      body.appendChild(el('tr', null, [
        el('td', { text: p.when }),
        el('td', null, [el('a', { href: url(p), text: p.name }), el('span', { class: 'sum', text: p.summary })]),
        el('td', { class: 'kind', text: p.kind }),
        el('td', { class: 'status' }, [el('span', { class: 'status-dot', 'data-s': p.status }), p.status])
      ]));
    });
    var latest = document.getElementById('latest-log');
    if (latest) {
      if (!L.length) latest.appendChild(emptyLog());
      else latest.appendChild(logList(L.slice(0, 3)));
    }
  }

  /* ---------- project page ---------- */
  function renderProject() {
    var root = document.getElementById('project');
    if (!root) return;
    var slug = new URLSearchParams(location.search).get('p') || '';
    var p = bySlug[slug] || bySlug[(window.OLD_SLUGS || {})[slug]];
    if (!p) {
      document.title = 'Project not found | Jones Anderson';
      root.appendChild(el('div', { class: 'page-head' }, [
        el('h1', { text: 'Not found' }),
        el('p', null, ['There is no project called "' + slug + '". ', el('a', { href: 'index.html', text: 'See all work' }), '.'])
      ]));
      return;
    }
    document.title = p.name + ' | Jones Anderson';
    var meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = p.summary;

    root.appendChild(el('p', { class: 'crumb' }, [el('a', { href: 'index.html#all', text: 'All work' })]));
    root.appendChild(el('div', { class: 'proj-head' }, [el('h1', { text: p.name }), el('p', { class: 'lede', text: p.summary })]));

    var gal = el('div', { class: 'proj-gal' });
    if (p.photos && p.photos.length) gal.appendChild(gallery(p.photos, p.name, p.videos));
    else gal.appendChild(el('p', { class: 'no-photos', text: 'Photos coming soon.' }));

    var prose = el('div', { class: 'prose' });
    if (p.writeup) { prose.appendChild(el('h2', { text: 'How I built it' })); prose.appendChild(el('div', { html: p.writeup })); }
    if (p.details && p.details.length) {
      prose.appendChild(el(p.writeup ? 'h3' : 'h2', { text: 'Details' }));
      prose.appendChild(el('ul', null, p.details.map(function (t) { return el('li', { text: t }); })));
    }
    if (p.note) prose.appendChild(el('p', { class: 'note', text: p.note }));
    var entries = logFor(p.slug);
    if (entries.length) {
      prose.appendChild(el('h2', { text: 'Build log', style: 'margin-top:48px' }));
      prose.appendChild(logList(entries, true));
    }

    // title block
    var dl = el('dl');
    var rows = [['Made by', 'Jones Anderson'], ['When', p.when], ['Kind', p.kind], ['Status', p.status]];
    Object.keys(p.facts || {}).forEach(function (k) { rows.push([k, p.facts[k]]); });
    rows.forEach(function (r) { dl.appendChild(el('dt', { text: r[0] })); dl.appendChild(el('dd', { text: r[1] })); });
    var idx = P.indexOf(p) + 1;
    var tHours = entries.reduce(function (s, e) { return s + (+e.hours || 0); }, 0);
    var side = el('aside', { class: 'proj-side' }, [el('div', { class: 'proj-side-in' }, [
      el('div', { class: 'titleblock' }, [
        el('div', { class: 'tb-name', text: p.name }), dl,
        el('div', { class: 'tb-foot' }, [
          el('span', { text: 'Sheet ' + idx + ' of ' + P.length }),
          el('span', { text: entries.length ? hrs(tHours) + ' h logged' : 'vortex1.dev' })
        ])
      ])
    ])]);
    var sideIn = side.firstChild;
    if (p.links && p.links.length) sideIn.appendChild(el('ul', { class: 'side-links' }, p.links.map(function (l) {
      var ext = /^https?:/.test(l.href);
      return el('li', null, [el('a', ext ? { href: l.href, text: l.label, target: '_blank', rel: 'noopener' } : { href: l.href, text: l.label })]);
    })));

    root.appendChild(el('div', { class: 'proj-body' }, [gal, side, prose.childNodes.length ? prose : null]));

    var prev = P[P.indexOf(p) - 1], next = P[P.indexOf(p) + 1];
    var nav = el('nav', { class: 'proj-nav', 'aria-label': 'More projects' });
    if (prev) nav.appendChild(el('a', { href: url(prev) }, [el('span', { text: 'Newer' }), el('strong', { text: prev.name })]));
    if (next) nav.appendChild(el('a', { class: 'next', href: url(next) }, [el('span', { text: 'Older' }), el('strong', { text: next.name })]));
    root.appendChild(nav);
  }

  /* ---------- build log ---------- */
  function emptyLog() {
    return el('div', { class: 'empty' }, [
      el('h3', { text: 'No entries yet' }),
      el('p', { text: 'After each build session I post what I did, what broke, and how long it took. The first entries will show up here.' })
    ]);
  }
  function logList(entries, hideProject) {
    var ol = el('ol', { class: 'log' });
    entries.forEach(function (e) {
      var p = bySlug[e.project];
      var bodyKids = [el('h3', { text: e.title || 'Build session' })];
      if (!hideProject && p) bodyKids.push(el('a', { class: 'proj', href: url(p), text: p.name }));
      if (e.text) bodyKids.push(el('p', { text: e.text }));
      if (e.photos && e.photos.length) bodyKids.push(gallery(e.photos, e.title || 'Build photo'));
      ol.appendChild(el('li', { class: 'entry' }, [
        el('div', { class: 'when' }, [el('strong', { text: fmtDate(e.date) }), e.hours ? hrs(+e.hours) + ' hours' : '']),
        el('div', null, bodyKids)
      ]));
    });
    return ol;
  }
  function renderLog() {
    var root = document.getElementById('log-root');
    if (!root) return;
    var sel = document.getElementById('log-filter');
    var sum = document.getElementById('log-summary');
    var used = P.filter(function (p) { return logFor(p.slug).length; });
    used.forEach(function (p) { sel.appendChild(el('option', { value: p.slug, text: p.name })); });
    function draw() {
      var list = sel.value ? logFor(sel.value) : L;
      var h = list.reduce(function (s, e) { return s + (+e.hours || 0); }, 0);
      var n = new Set(list.map(function (e) { return e.project; })).size;
      sum.textContent = list.length
        ? hrs(h) + ' hours over ' + list.length + (list.length === 1 ? ' session' : ' sessions') + ' on ' + n + (n === 1 ? ' project' : ' projects') + '.'
        : 'Nothing logged yet.';
      root.textContent = '';
      root.appendChild(list.length ? logList(list, !!sel.value) : emptyLog());
    }
    sel.onchange = draw;
    sel.parentElement.hidden = !used.length;
    draw();
  }

  renderHome(); renderProject(); renderLog();
})();
