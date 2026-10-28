// Renders the home page, project pages and build log from data/projects.json and data/log.json.
// When signed in (see admin.js), the same renderers draw edit buttons.
(function () {
  var RAW = { projects: [], log: [], oldSlugs: {} };
  var P = [], L = [], bySlug = {};
  var previews = {}; // path -> data URL for photos uploaded this session (before Pages rebuilds)
  var REPO_RAW = 'https://raw.githubusercontent.com/vortexcodes/vortexcodes.github.io/main/';

  function setData(d) {
    RAW = { projects: d.projects || [], log: d.log || [], oldSlugs: d.oldSlugs || {} };
    P = RAW.projects.slice().sort(function (a, b) { return (b.sort || '').localeCompare(a.sort || ''); });
    L = RAW.log.map(function (e, i) { return { e: e, i: i }; })
      .sort(function (a, b) { return (b.e.date || '').localeCompare(a.e.date || '') || b.i - a.i; })
      .map(function (x) { return x.e; });
    bySlug = {}; P.forEach(function (p) { bySlug[p.slug] = p; });
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (attrs[k] == null) continue;
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k === 'onclick') n.onclick = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  // Photo src: a fresh upload shows from memory; anything not on Pages yet falls back to the repo copy.
  function img(path, alt, lazy) {
    var i = el('img', { src: previews[path] || path, alt: alt, loading: lazy ? 'lazy' : 'eager' });
    i.onerror = function () { if (!/^https?:|^data:/.test(path) && i.src.indexOf(REPO_RAW) < 0) i.src = REPO_RAW + path; };
    return i;
  }
  function url(p) { return 'project.html?p=' + encodeURIComponent(p.slug); }
  function fmtDate(s) {
    var d = new Date(s + 'T12:00:00');
    return isNaN(d) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function hrs(n) { return (Math.round(n * 10) / 10).toString(); }
  function logFor(slug) { return L.filter(function (e) { return e.project === slug; }); }
  function editing() { return !!(window.SiteEdit && window.SiteEdit.on()); }
  // Hidden projects, and their log entries, only show while you're signed in with editing on.
  function shown() { return editing() ? P : P.filter(function (p) { return !p.hidden; }); }
  function shownLog() { return editing() ? L : L.filter(function (e) { var p = bySlug[e.project]; return !(p && p.hidden); }); }
  function hiddenTag(p) { return p.hidden ? el('span', { class: 'tag-hidden', text: 'Hidden' }) : null; }
  function flagBtns(p) {
    return [
      editBtn(p.featured ? '★ Starred' : '☆ Star', function () { SiteEdit.toggleFlag(p, 'featured', this); }, p.featured ? 'on' : ''),
      editBtn(p.hidden ? 'Unhide' : 'Hide', function () { SiteEdit.toggleFlag(p, 'hidden', this); }, p.hidden ? 'on' : '')
    ];
  }
  function editBtn(label, fn, cls) {
    return el('button', { type: 'button', class: 'edit-btn' + (cls ? ' ' + cls : ''), text: label, onclick: fn });
  }
  function clear(n) { if (n) n.textContent = ''; return n; }

  /* ---------- lightbox ---------- */
  var lb, lbImg, lbCount, lbList = [], lbIdx = 0;
  function openLightbox(list, i) {
    if (!lb) {
      lb = el('dialog', { class: 'lightbox', 'aria-label': 'Photo viewer' });
      var inner = el('div', { class: 'lb-inner' });
      lbImg = el('img', { alt: '' });
      lbImg.onerror = function () {
        var path = lbList[lbIdx] && lbList[lbIdx].src;
        if (path && !/^https?:|^data:/.test(path) && lbImg.src.indexOf(REPO_RAW) < 0) lbImg.src = REPO_RAW + path;
      };
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
    lbImg.src = previews[lbList[lbIdx].src] || lbList[lbIdx].src; lbImg.alt = lbList[lbIdx].alt;
    lbCount.textContent = (lbIdx + 1) + ' of ' + lbList.length;
  }
  function gallery(photos, label, videos) {
    var g = el('div', { class: 'gallery' });
    var list = photos.map(function (src, i) { return { src: src, alt: label + ', photo ' + (i + 1) }; });
    list.forEach(function (ph, i) {
      var b = el('button', { type: 'button', 'aria-label': 'Open ' + ph.alt });
      b.appendChild(img(ph.src, ph.alt, i > 0));
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
    var V = shown();
    var grid = clear(document.getElementById('work-grid'));
    if (grid) V.filter(function (p) { return p.featured; }).forEach(function (p) {
      grid.appendChild(el('a', { class: 'item' + (p.hidden ? ' is-hidden' : ''), href: url(p) }, [
        el('div', { class: 'shot' }, [p.cover ? img(p.cover, p.name, true) : null]),
        el('h3', null, [p.name, hiddenTag(p)]),
        el('p', { text: [p.when, (p.kind || '').toLowerCase()].filter(Boolean).join(', ') })
      ]));
    });
    var body = clear(document.getElementById('index-body'));
    if (body) V.forEach(function (p) {
      body.appendChild(el('tr', { class: p.hidden ? 'is-hidden' : null }, [
        el('td', { text: p.when }),
        el('td', null, [el('a', { href: url(p), text: p.name }), hiddenTag(p), el('span', { class: 'sum', text: p.summary }),
          editing() ? el('span', { class: 'row-tools' }, flagBtns(p)) : null]),
        el('td', { class: 'kind', text: p.kind }),
        el('td', { class: 'status' }, [el('span', { class: 'status-dot', 'data-s': p.status }), p.status || ''])
      ]));
    });
    var tools = document.getElementById('home-edit');
    if (body && !tools) {
      tools = el('div', { id: 'home-edit', class: 'edit-row' });
      document.getElementById('all').insertBefore(tools, document.querySelector('#all .index-wrap'));
    }
    if (tools) {
      clear(tools);
      if (editing()) tools.appendChild(editBtn('New project', function () { SiteEdit.editProject(null); }, 'primary'));
    }
    var latest = clear(document.getElementById('latest-log'));
    var LV = shownLog();
    if (latest) latest.appendChild(LV.length ? logList(LV.slice(0, 3)) : emptyLog());
  }

  /* ---------- project page ---------- */
  function renderProject() {
    var root = clear(document.getElementById('project'));
    if (!root) return;
    var slug = new URLSearchParams(location.search).get('p') || '';
    var p = bySlug[slug] || bySlug[RAW.oldSlugs[slug]];
    var V = shown();
    if (!p || V.indexOf(p) < 0) {
      document.title = 'Project not found | Jones Anderson';
      root.appendChild(el('div', { class: 'page-head' }, [
        el('h1', { text: 'Not found' }),
        el('p', null, ['There is no project called "' + slug + '". ', el('a', { href: 'index.html', text: 'See all work' }), '.'])
      ]));
      return;
    }
    document.title = p.name + ' | Jones Anderson';
    var meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = p.summary || '';

    root.appendChild(el('p', { class: 'crumb' }, [el('a', { href: 'index.html#all', text: 'All work' })]));
    var head = el('div', { class: 'proj-head' }, [el('h1', { text: p.name }), el('p', { class: 'lede', text: p.summary })]);
    if (editing()) head.appendChild(el('div', { class: 'edit-row' }, [
      editBtn('Edit project', function () { SiteEdit.editProject(p); }, 'primary'),
      editBtn('Add log entry', function () { SiteEdit.editEntry(null, p.slug); })
    ].concat(flagBtns(p))));
    if (p.hidden) head.appendChild(el('p', { class: 'hidden-note', text: 'Hidden. Visitors get "Not found" here and the project is left off every list. Only you see it, while signed in.' }));
    root.appendChild(head);

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

    var dl = el('dl');
    var rows = [['Made by', 'Jones Anderson'], ['When', p.when], ['Kind', p.kind], ['Status', p.status]];
    Object.keys(p.facts || {}).forEach(function (k) { rows.push([k, p.facts[k]]); });
    rows.forEach(function (r) { if (r[1]) { dl.appendChild(el('dt', { text: r[0] })); dl.appendChild(el('dd', { text: r[1] })); } });
    var idx = V.indexOf(p) + 1;
    var tHours = entries.reduce(function (s, e) { return s + (+e.hours || 0); }, 0);
    var side = el('aside', { class: 'proj-side' }, [el('div', { class: 'proj-side-in' }, [
      el('div', { class: 'titleblock' }, [
        el('div', { class: 'tb-name', text: p.name }), dl,
        el('div', { class: 'tb-foot' }, [
          el('span', { text: 'Sheet ' + idx + ' of ' + V.length }),
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

    var prev = V[idx - 2], next = V[idx];
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
      if (e.text) e.text.split(/\n\s*\n/).forEach(function (para) { bodyKids.push(el('p', { text: para })); });
      if (e.photos && e.photos.length) bodyKids.push(gallery(e.photos, e.title || 'Build photo'));
      if (editing()) bodyKids.push(el('div', { class: 'edit-row' }, [editBtn('Edit entry', function () { SiteEdit.editEntry(e); })]));
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
    var keep = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    var used = shown().filter(function (p) { return logFor(p.slug).length; });
    used.forEach(function (p) { sel.appendChild(el('option', { value: p.slug, text: p.name })); });
    sel.value = used.some(function (p) { return p.slug === keep; }) ? keep : '';
    var tools = document.getElementById('log-edit');
    if (!tools) { tools = el('div', { id: 'log-edit', class: 'edit-row' }); root.parentNode.insertBefore(tools, root); }
    clear(tools);
    if (editing()) tools.appendChild(editBtn('New entry', function () { SiteEdit.editEntry(null, sel.value); }, 'primary'));
    function draw() {
      var list = sel.value ? logFor(sel.value) : shownLog();
      var h = list.reduce(function (s, e) { return s + (+e.hours || 0); }, 0);
      var n = new Set(list.map(function (e) { return e.project; })).size;
      sum.textContent = list.length
        ? hrs(h) + ' hours over ' + list.length + (list.length === 1 ? ' session' : ' sessions') + ' on ' + n + (n === 1 ? ' project' : ' projects') + '.'
        : 'Nothing logged yet.';
      clear(root);
      root.appendChild(list.length ? logList(list, !!sel.value) : emptyLog());
    }
    sel.onchange = draw;
    sel.parentElement.hidden = !used.length;
    draw();
  }

  function render() { renderHome(); renderProject(); renderLog(); }

  /* ---------- sign-in link + loading ---------- */
  function loadEditor(then) {
    if (window.SiteEdit) return then && then();
    var s = document.createElement('script');
    s.src = 'admin.js?v=3'; s.onload = function () { then && then(); };
    document.body.appendChild(s);
  }
  var footNav = document.querySelector('.site-foot nav');
  if (footNav) footNav.appendChild(el('a', { href: '#edit', text: 'Edit site', onclick: function (e) {
    e.preventDefault(); loadEditor(function () { SiteEdit.open(); });
  } }));

  window.Site = {
    el: el, img: img, url: url, render: render, setData: setData, previews: previews,
    data: function () { return RAW; }, projects: function () { return P; }
  };

  function signedIn() { try { return !!localStorage.getItem('vx-gh-token'); } catch (e) { return false; } }
  Promise.all([
    fetch('data/projects.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
    fetch('data/log.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
  ]).then(function (res) {
    setData({ projects: res[0].projects, oldSlugs: res[0].oldSlugs, log: res[1] });
    render();
  }).catch(function () {
    var r = document.getElementById('project') || document.getElementById('work-grid') || document.getElementById('log-root');
    if (r) r.appendChild(el('p', { text: 'Projects did not load. Refresh the page to try again.' }));
  }).then(function () {
    if (signedIn() || location.hash === '#edit') loadEditor(function () { SiteEdit.boot(); });
  });
})();
