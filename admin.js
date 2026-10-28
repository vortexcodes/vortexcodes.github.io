// Site editor. Loaded by site.js when you're signed in or click "Edit site" in the footer.
// Signing in stores a GitHub fine-grained token (this repo only, Contents: read and write) in this browser.
// Every save is one commit to main; GitHub Pages republishes the site about a minute later.
(function () {
  var OWNER = 'vortexcodes', REPO = 'vortexcodes.github.io', BRANCH = 'main';
  var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
  var TOKEN_KEY = 'vx-gh-token', MODE_KEY = 'vx-edit', USER_KEY = 'vx-gh-user';
  var STATUSES = ['In progress', 'Finished', 'Shipped', 'Sold', 'Paused', 'Idea'];
  var el = Site.el;

  function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function token() { return load(TOKEN_KEY); }

  var css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = 'admin.css?v=3';
  document.head.appendChild(css);

  /* ---------- GitHub API ---------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = {
      Authorization: 'Bearer ' + (opts.token || token()),
      Accept: opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(path.indexOf('https:') === 0 ? path : API + path, {
      method: opts.method || 'GET', headers: headers, cache: 'no-store',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        var err = new Error(r.status === 401 ? 'GitHub rejected the key. It may have expired.' :
          r.status === 403 || r.status === 404 ? 'This key can\'t write to ' + REPO + '.' : 'GitHub error ' + r.status + '.');
        err.status = r.status; err.detail = t; throw err;
      });
      return opts.raw ? r.text() : r.json();
    });
  }
  function readJSON(path, ref) {
    return api('/contents/' + path + '?ref=' + ref, { raw: true }).then(JSON.parse);
  }
  function headSha() { return api('/git/ref/heads/' + BRANCH).then(function (r) { return r.object.sha; }); }
  function fetchData(sha) {
    return Promise.all([readJSON('data/projects.json', sha), readJSON('data/log.json', sha)]).then(function (r) {
      return { projects: r[0].projects || [], oldSlugs: r[0].oldSlugs || {}, log: r[1] || [] };
    });
  }
  function serialize(d) {
    return {
      'data/projects.json': JSON.stringify({ oldSlugs: d.oldSlugs, projects: d.projects }, null, 2) + '\n',
      'data/log.json': JSON.stringify(d.log, null, 2) + '\n'
    };
  }

  // Applies `mutate` to the newest data on GitHub and commits it with any new photos, as one commit.
  // If something else committed in between (like the daily check-in), it starts over on top of that.
  function save(message, mutate, uploads) {
    uploads = uploads || [];
    var blobShas = {};
    function attempt(n) {
      var sha, data;
      return headSha().then(function (s) {
        sha = s; return Promise.all([api('/git/commits/' + sha), fetchData(sha)]);
      }).then(function (r) {
        var baseTree = r[0].tree.sha; data = r[1];
        mutate(data);
        return Promise.all(uploads.map(function (u) {
          if (blobShas[u.path]) return null;
          return api('/git/blobs', { method: 'POST', body: { content: u.base64, encoding: 'base64' } })
            .then(function (b) { blobShas[u.path] = b.sha; });
        })).then(function () {
          var files = serialize(data), tree = [];
          Object.keys(files).forEach(function (p) { tree.push({ path: p, mode: '100644', type: 'blob', content: files[p] }); });
          uploads.forEach(function (u) { tree.push({ path: u.path, mode: '100644', type: 'blob', sha: blobShas[u.path] }); });
          return api('/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: tree } });
        });
      }).then(function (t) {
        return api('/git/commits', { method: 'POST', body: { message: message, tree: t.sha, parents: [sha] } });
      }).then(function (c) {
        return api('/git/refs/heads/' + BRANCH, { method: 'PATCH', body: { sha: c.sha } });
      }).then(function () {
        uploads.forEach(function (u) { Site.previews[u.path] = u.dataURL; });
        Site.setData(data); Site.render();
        return data;
      }, function (err) {
        if (err.status === 422 && n < 3) return attempt(n + 1);
        throw err;
      });
    }
    return attempt(1);
  }

  /* ---------- photos ---------- */
  function resize(file) {
    return new Promise(function (resolve, reject) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var max = 1600, w = im.naturalWidth, h = im.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        var dataURL = c.toDataURL('image/jpeg', 0.82);
        resolve({ dataURL: dataURL, base64: dataURL.split(',')[1] });
      };
      im.onerror = function () { URL.revokeObjectURL(u); reject(new Error(file.name + ' isn\'t an image this browser can open. Try a JPEG or PNG.')); };
      im.src = u;
    });
  }
  function stamp() {
    var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
  }

  // Photo list editor. items: [{path, dataURL?, base64?}]. opts.cover: show "Make cover".
  function photoField(paths, opts) {
    var items = (paths || []).map(function (p) { return { path: p }; });
    var cover = opts.cover || null;
    var wrap = el('div', { class: 'ed-photos' });
    var grid = el('div', { class: 'ed-photo-grid' });
    var input = el('input', { type: 'file', accept: 'image/*', multiple: '', class: 'ed-file', id: 'ed-file-' + Math.random().toString(36).slice(2) });
    var add = el('label', { class: 'btn', for: input.id, text: 'Add photos' });
    var status = el('span', { class: 'ed-hint' });
    function move(i, d) { var j = i + d; if (j < 0 || j >= items.length) return; var t = items[i]; items[i] = items[j]; items[j] = t; draw(); }
    function draw() {
      grid.textContent = '';
      if (!items.length) grid.appendChild(el('p', { class: 'ed-hint', text: 'No photos yet.' }));
      items.forEach(function (it, i) {
        var isCover = opts.cover !== undefined && (cover ? cover === it.path : i === 0);
        var fig = el('figure', { class: 'ed-photo' + (isCover ? ' is-cover' : '') }, [
          it.dataURL ? el('img', { src: it.dataURL, alt: '' }) : Site.img(it.path, '', true),
          isCover ? el('span', { class: 'ed-badge', text: 'Cover' }) : null,
          el('div', { class: 'ed-photo-tools' }, [
            el('button', { type: 'button', text: '◀', 'aria-label': 'Move earlier', title: 'Move earlier', onclick: function () { move(i, -1); } }),
            el('button', { type: 'button', text: '▶', 'aria-label': 'Move later', title: 'Move later', onclick: function () { move(i, 1); } }),
            opts.cover !== undefined && !isCover ? el('button', { type: 'button', text: 'Cover', title: 'Use as cover', onclick: function () { cover = it.path; draw(); } }) : null,
            el('button', { type: 'button', text: 'Remove', title: 'Remove photo', onclick: function () { if (cover === it.path) cover = null; items.splice(i, 1); draw(); } })
          ])
        ]);
        grid.appendChild(fig);
      });
    }
    input.onchange = function () {
      var files = Array.prototype.slice.call(input.files); input.value = '';
      if (!files.length) return;
      status.textContent = 'Preparing ' + files.length + (files.length === 1 ? ' photo…' : ' photos…');
      files.reduce(function (pr, f) {
        return pr.then(function () {
          return resize(f).then(function (r) {
            items.push({ path: 'new:' + Math.random().toString(36).slice(2), dataURL: r.dataURL, base64: r.base64 });
            draw();
          });
        });
      }, Promise.resolve()).then(function () { status.textContent = ''; }, function (e) { status.textContent = e.message; });
    };
    draw();
    wrap.appendChild(grid);
    wrap.appendChild(el('div', { class: 'ed-photo-add' }, [input, add, status]));
    return {
      node: wrap,
      // Name new uploads once the final project/date is known: <prefix>-<time>-<n>.jpg
      finalize: function (prefix) {
        var t = stamp(), k = 0;
        items.forEach(function (i) {
          if (i.path.indexOf('new:') !== 0) return;
          var np = prefix + '-' + t + '-' + (++k) + '.jpg';
          if (cover === i.path) cover = np;
          i.path = np;
        });
      },
      paths: function () { return items.map(function (i) { return i.path; }); },
      cover: function () { return cover && items.some(function (i) { return i.path === cover; }) ? cover : (items[0] ? items[0].path : ''); },
      uploads: function () { return items.filter(function (i) { return i.base64; }).map(function (i) { return { path: i.path, base64: i.base64, dataURL: i.dataURL }; }); },
    };
  }

  /* ---------- form helpers ---------- */
  function field(label, input, hint) {
    return el('label', { class: 'ed-field' }, [el('span', { class: 'ed-label', text: label }), input, hint ? el('span', { class: 'ed-hint', text: hint }) : null]);
  }
  function text(v, attrs) { var i = el('input', Object.assign({ type: 'text' }, attrs || {})); i.value = v == null ? '' : v; return i; }
  function area(v, rows, attrs) { var t = el('textarea', Object.assign({ rows: rows || 4 }, attrs || {})); t.value = v || ''; return t; }
  function datalist(id, values) { return el('datalist', { id: id }, values.map(function (v) { return el('option', { value: v }); })); }
  function pairRows(obj, keyLabel, valLabel, keyPh, valPh) {
    var box = el('div', { class: 'ed-pairs' }), rows = el('div');
    function addRow(k, v) {
      var r = el('div', { class: 'ed-pair' });
      var a = text(k, { placeholder: keyPh, 'aria-label': keyLabel }), b = text(v, { placeholder: valPh, 'aria-label': valLabel });
      r.appendChild(a); r.appendChild(b);
      r.appendChild(el('button', { type: 'button', class: 'ed-x', text: 'Remove', onclick: function () { r.remove(); } }));
      rows.appendChild(r);
    }
    (obj || []).forEach(function (kv) { addRow(kv[0], kv[1]); });
    box.appendChild(rows);
    box.appendChild(el('button', { type: 'button', class: 'btn ed-small', text: 'Add row', onclick: function () { addRow('', ''); } }));
    return {
      node: box,
      value: function () {
        return Array.prototype.map.call(rows.children, function (r) {
          var i = r.querySelectorAll('input'); return [i[0].value.trim(), i[1].value.trim()];
        }).filter(function (kv) { return kv[0] && kv[1]; });
      }
    };
  }
  function slugify(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48); }
  function monthLabel(ym) {
    var d = new Date(ym + '-15T12:00:00');
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  // Write-ups are stored as HTML. Plain <p> paragraphs are shown as blank-line-separated text for editing.
  function writeupToText(h) {
    if (!h) return '';
    var m = h.trim().match(/^(<p>[\s\S]*?<\/p>\s*)+$/);
    if (m && !/<(h\d|ul|ol|div|figure|table|blockquote)\b/i.test(h)) {
      return h.trim().replace(/^<p>/, '').replace(/<\/p>$/, '').split(/<\/p>\s*<p>/).join('\n\n');
    }
    return h.trim();
  }
  function textToWriteup(t) {
    t = (t || '').trim();
    if (!t) return '';
    if (/<(p|h\d|ul|ol|div|figure|table|blockquote)\b/i.test(t)) return t;
    return t.split(/\n\s*\n/).map(function (p) { return '<p>' + p.trim().replace(/\n/g, '<br>') + '</p>'; }).join('\n');
  }
  function today() {
    var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10);
  }

  // Copies onto `fresh` only the fields this dialog changed from `orig`, so edits made elsewhere
  // (another device, the daily check-in) to other fields survive.
  function mergeChanges(fresh, orig, out) {
    Object.keys(Object.assign({}, orig, out)).forEach(function (k) {
      if (JSON.stringify(out[k]) === JSON.stringify(orig[k])) return;
      if (out[k] === undefined) delete fresh[k]; else fresh[k] = out[k];
    });
    return fresh;
  }

  /* ---------- dialogs ---------- */
  function sheet(title, body, actions) {
    var dlg = el('dialog', { class: 'ed-sheet', 'aria-label': title });
    var msg = el('p', { class: 'ed-msg', role: 'status' });
    var form = el('form', { method: 'dialog', novalidate: '' }, [
      el('header', { class: 'ed-sheet-head' }, [el('h2', { text: title }),
        el('button', { type: 'button', class: 'ed-close', text: 'Close', onclick: function () { dlg.close(); } })]),
      el('div', { class: 'ed-sheet-body' }, body),
      el('footer', { class: 'ed-sheet-foot' }, [msg, el('div', { class: 'ed-actions' }, actions)])
    ]);
    form.onsubmit = function (e) { e.preventDefault(); };
    dlg.appendChild(form);
    // Esc doesn't throw away a half-filled form; use Close.
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); });
    dlg.addEventListener('close', function () { dlg.remove(); });
    document.body.appendChild(dlg);
    dlg.showModal();
    return { dlg: dlg, msg: function (t, bad) { msg.textContent = t; msg.className = 'ed-msg' + (bad ? ' bad' : ''); } };
  }
  function busy(btns, on) { btns.forEach(function (b) { if (b) b.disabled = on; }); }
  function confirmBtn(label, confirmLabel, fn) {
    var armed = false;
    var b = el('button', { type: 'button', class: 'btn danger', text: label });
    b.onclick = function () {
      if (!armed) { armed = true; b.textContent = confirmLabel; setTimeout(function () { armed = false; b.textContent = label; }, 4000); return; }
      fn(b);
    };
    return b;
  }

  /* ---------- project editor ---------- */
  function editProject(p) {
    var isNew = !p;
    var orig = JSON.parse(JSON.stringify(p || {}));
    p = p || { status: 'In progress', sort: today().slice(0, 7), photos: [], facts: {}, details: [], links: [] };
    var all = Site.data().projects;
    var kinds = Array.from(new Set(all.map(function (x) { return x.kind; }).filter(Boolean)));

    var name = text(p.name, { required: '', placeholder: 'Mau5head v3' });
    var slug = text(p.slug, { placeholder: 'mau5head-v3', pattern: '[a-z0-9-]+' });
    if (!isNew) slug.readOnly = true;
    var slugTouched = false;
    slug.oninput = function () { slugTouched = true; };
    name.oninput = function () { if (isNew && !slugTouched) slug.value = slugify(name.value); };
    var sort = text(p.sort, { type: 'month' });
    var when = text(p.when, { placeholder: 'Fall 2026' });
    var kind = text(p.kind, { list: 'ed-kinds', placeholder: 'Electronics' });
    var status = text(p.status, { list: 'ed-statuses' });
    var featured = el('input', { type: 'checkbox' }); featured.checked = !!p.featured;
    var hidden = el('input', { type: 'checkbox' }); hidden.checked = !!p.hidden;
    var summary = area(p.summary, 3, { placeholder: 'One or two sentences: what it is and what makes it interesting.' });
    var photos = photoField(p.photos, { cover: p.cover || null });
    var facts = pairRows(Object.keys(p.facts || {}).map(function (k) { return [k, p.facts[k]]; }), 'Label', 'Value', 'Controller', 'ESP32-S3');
    var details = area((p.details || []).join('\n'), 5, { placeholder: 'One point per line' });
    var links = pairRows((p.links || []).map(function (l) { return [l.label, l.href]; }), 'Link text', 'Address', 'Code on GitHub', 'https://github.com/…');
    var writeup = area(writeupToText(p.writeup), 10, { placeholder: 'Optional. Leave a blank line between paragraphs.' });
    var note = text(p.note, { placeholder: 'Optional footnote' });

    var saveBtn = el('button', { type: 'submit', class: 'btn primary', text: isNew ? 'Create project' : 'Save changes' });
    var del = isNew ? null : confirmBtn('Delete project', 'Click again to delete', function (b) {
      busy([saveBtn, b], true); s.msg('Deleting…');
      save('Delete project: ' + p.name, function (d) {
        d.projects = d.projects.filter(function (x) { return x.slug !== p.slug; });
      }).then(function () { location.href = 'index.html#all'; }, function (e) { busy([saveBtn, b], false); s.msg(e.message, true); });
    });

    var s = sheet(isNew ? 'New project' : 'Edit ' + p.name, [
      datalist('ed-kinds', kinds), datalist('ed-statuses', STATUSES),
      el('div', { class: 'ed-grid' }, [
        field('Name', name),
        field('Address', slug, isNew ? 'vortex1.dev/project.html?p=…  Can\'t be changed later.' : 'Fixed once created.'),
        field('Month (sets the order)', sort),
        field('When (shown on the site)', when, 'Left blank, it uses the month.'),
        field('Kind', kind),
        field('Status', status)
      ]),
      el('label', { class: 'ed-check' }, [featured, ' Star: show in Selected work on the home page']),
      el('label', { class: 'ed-check' }, [hidden, ' Hide: only you see it, while signed in']),
      field('Summary', summary),
      el('fieldset', { class: 'ed-set' }, [el('legend', { text: 'Photos' }), el('p', { class: 'ed-hint', text: 'First photo is the cover unless you pick one. Photos are resized to 1600 px before upload.' }), photos.node]),
      el('fieldset', { class: 'ed-set' }, [el('legend', { text: 'Specs' }), el('p', { class: 'ed-hint', text: 'Shown in the title block next to the photos.' }), facts.node]),
      field('Details', details, 'One bullet per line.'),
      field('Write-up', writeup, 'Basic HTML like <h3> or <a href="…"> works too.'),
      el('fieldset', { class: 'ed-set' }, [el('legend', { text: 'Links' }), links.node]),
      field('Note', note)
    ], [del, el('span', { class: 'ed-spacer' }), saveBtn]);

    saveBtn.onclick = function () {
      var n = name.value.trim(), sl = slugify(slug.value || n);
      if (!n) return s.msg('Give the project a name.', true), name.focus();
      if (!sl) return s.msg('The address needs letters or numbers.', true), slug.focus();
      if (isNew && all.some(function (x) { return x.slug === sl; })) return s.msg('Another project already uses the address "' + sl + '".', true), slug.focus();
      if (!/^\d{4}-\d{2}$/.test(sort.value)) return s.msg('Pick a month.', true), sort.focus();
      photos.finalize('media/work/' + (isNew ? sl : p.slug));
      var factsObj = {}; facts.value().forEach(function (kv) { factsObj[kv[0]] = kv[1]; });
      var out = Object.assign({}, p, {
        slug: isNew ? sl : p.slug, name: n, sort: sort.value, when: when.value.trim() || monthLabel(sort.value),
        kind: kind.value.trim(), status: status.value.trim(), featured: featured.checked, hidden: hidden.checked,
        summary: summary.value.trim(), cover: photos.cover(), photos: photos.paths(), facts: factsObj,
        details: details.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
        links: links.value().map(function (kv) { return { label: kv[0], href: kv[1] }; }),
        writeup: textToWriteup(writeup.value), note: note.value.trim()
      });
      ['writeup', 'note', 'cover', 'kind', 'status', 'hidden'].forEach(function (k) { if (!out[k]) delete out[k]; });
      ['links', 'details'].forEach(function (k) { if (!out[k].length) delete out[k]; });
      if (!Object.keys(out.facts).length) delete out.facts;
      busy([saveBtn, del], true); s.msg('Saving…');
      save((isNew ? 'Add project: ' : 'Edit project: ') + n, function (d) {
        var i = d.projects.findIndex(function (x) { return x.slug === out.slug; });
        if (isNew && i >= 0) throw new Error('Another project already uses the address "' + out.slug + '".');
        if (!isNew && i < 0) throw new Error('This project was deleted somewhere else. Reload the page.');
        if (isNew) d.projects.push(out); else mergeChanges(d.projects[i], orig, out);
      }, photos.uploads()).then(function () {
        done('Saved ' + n + '.');
        s.dlg.close();
        if (isNew) location.href = Site.url(out);
      }, function (e) { busy([saveBtn, del], false); s.msg(e.message, true); });
    };
    name.focus();
  }

  /* ---------- star / hide ---------- */
  // One click from the project list or page. Starred (featured) projects show in Selected work;
  // hidden ones are left off the public site.
  var FLAGS = {
    featured: ['Star project: ', 'Unstar project: ', ' is starred.', ' is unstarred.'],
    hidden: ['Hide project: ', 'Unhide project: ', ' is hidden.', ' is public again.']
  };
  function toggleFlag(p, key, btn) {
    var on = !p[key], f = FLAGS[key];
    if (btn) btn.disabled = true;
    if (barMsg) barMsg.textContent = 'Saving…';
    save((on ? f[0] : f[1]) + p.name, function (d) {
      var x = d.projects.find(function (x) { return x.slug === p.slug; });
      if (!x) throw new Error('This project was deleted somewhere else. Reload the page.');
      if (on) x[key] = true; else delete x[key];
    }).then(function () { done(p.name + (on ? f[2] : f[3])); }, function (e) {
      if (btn) btn.disabled = false;
      if (barMsg) barMsg.textContent = e.message;
    });
  }

  /* ---------- log entry editor ---------- */
  function sameEntry(a, b) {
    if (a.id || b.id) return a.id === b.id;
    return a.date === b.date && a.project === b.project && a.title === b.title && a.text === b.text;
  }
  function editEntry(e, slug) {
    var isNew = !e;
    var orig = JSON.parse(JSON.stringify(e || {}));
    var projects = Site.projects();
    e = e || { date: today(), project: slug || (projects[0] && projects[0].slug), photos: [] };
    var date = text(e.date, { type: 'date', required: '' });
    var proj = el('select', null, projects.map(function (p) { return el('option', { value: p.slug, text: p.name }); }));
    proj.value = e.project;
    var title = text(e.title, { placeholder: 'Wired the ear LEDs', maxlength: 90 });
    var hours = text(e.hours, { type: 'number', min: '0.25', step: '0.25', inputmode: 'decimal', placeholder: '2.5' });
    var body = area(e.text, 9, { placeholder: 'What you did, why, what went wrong, what you figured out. Your own words.' });
    var photos = photoField(e.photos, {});

    var saveBtn = el('button', { type: 'submit', class: 'btn primary', text: isNew ? 'Post entry' : 'Save changes' });
    var del = isNew ? null : confirmBtn('Delete entry', 'Click again to delete', function (b) {
      busy([saveBtn, b], true); s.msg('Deleting…');
      save('Delete log entry: ' + e.title, function (d) {
        d.log = d.log.filter(function (x) { return !sameEntry(x, e); });
      }).then(function () { done('Entry deleted.'); s.dlg.close(); }, function (err) { busy([saveBtn, b], false); s.msg(err.message, true); });
    });

    var s = sheet(isNew ? 'New log entry' : 'Edit log entry', [
      el('div', { class: 'ed-grid' }, [field('Date', date), field('Project', proj), field('Title', title), field('Hours', hours)]),
      field('What you did', body, 'Leave a blank line between paragraphs.'),
      el('fieldset', { class: 'ed-set' }, [el('legend', { text: 'Photos' }), el('p', { class: 'ed-hint', text: 'Hack Club wants about one photo per 5 hours, at least one per entry.' }), photos.node])
    ], [del, el('span', { class: 'ed-spacer' }), saveBtn]);

    saveBtn.onclick = function () {
      var h = parseFloat(hours.value);
      if (!date.value) return s.msg('Pick a date.', true), date.focus();
      if (!title.value.trim()) return s.msg('Give the entry a title.', true), title.focus();
      if (!(h > 0)) return s.msg('Enter the hours you spent.', true), hours.focus();
      if (!body.value.trim()) return s.msg('Write what you did.', true), body.focus();
      photos.finalize('media/log/' + date.value + '-' + proj.value);
      var out = Object.assign({}, e, {
        id: e.id || date.value + '-' + proj.value + '-' + Math.random().toString(36).slice(2, 6),
        date: date.value, project: proj.value, title: title.value.trim(), hours: h,
        text: body.value.trim(), photos: photos.paths()
      });
      busy([saveBtn, del], true); s.msg('Saving…');
      save((isNew ? 'Log: ' : 'Edit log: ') + out.title, function (d) {
        if (isNew) return d.log.push(out);
        var i = d.log.findIndex(function (x) { return sameEntry(x, e); });
        if (i < 0) throw new Error('This entry was changed somewhere else. Reload the page.');
        mergeChanges(d.log[i], orig, out);
      }, photos.uploads()).then(function () { done(isNew ? 'Entry posted.' : 'Entry saved.'); s.dlg.close(); },
        function (err) { busy([saveBtn, del], false); s.msg(err.message, true); });
    };
    (isNew ? title : body).focus();
  }

  /* ---------- password ---------- */
  // data/login.json holds the GitHub key locked with your password (PBKDF2 + AES-GCM), so any
  // browser can sign in with just the password. The file is public, so the password has to be strong.
  var LOGIN_PATH = 'data/login.json', ITER = 600000, MIN_PW = 10;
  function b64(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))); }
  function unb64(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function deriveKey(pw, salt, iter) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('Password sign-in only works on https://vortex1.dev.'));
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (k) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter }, k,
        { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function lock(tok, pw) {
    var salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(pw, salt, ITER).then(function (k) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(tok));
    }).then(function (ct) { return { v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), key: b64(ct) }; });
  }
  function unlock(box, pw) {
    return deriveKey(pw, unb64(box.salt), box.iter || ITER).then(function (k) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, k, unb64(box.key))
        .catch(function () { throw new Error('Wrong password.'); });
    }).then(function (pt) { return new TextDecoder().decode(pt); });
  }
  // Signed out: read the locked key from the site, or from the repo if Pages hasn't caught up yet.
  function loginBox() {
    function get(u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }); }
    return get(LOGIN_PATH).catch(function () { return null; }).then(function (b) {
      return b || get('https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/' + LOGIN_PATH).catch(function () { return null; });
    });
  }
  function loginSha() {
    return api('/contents/' + LOGIN_PATH + '?ref=' + BRANCH).then(function (f) { return f.sha; }, function (e) {
      if (e.status === 404) return null; throw e;
    });
  }
  function setPassword(pw) {
    return Promise.all([lock(token(), pw), loginSha()]).then(function (r) {
      var body = { message: 'Update the editor password', branch: BRANCH, content: btoa(JSON.stringify(r[0], null, 2) + '\n') };
      if (r[1]) body.sha = r[1];
      return api('/contents/' + LOGIN_PATH, { method: 'PUT', body: body });
    });
  }
  function checkPassword(a, b) {
    if (a.value.length < MIN_PW) return a.focus(), 'Use at least ' + MIN_PW + ' characters.';
    if (a.value !== b.value) return b.focus(), 'The two passwords don\'t match.';
  }
  function passwordFields(label) {
    var a = text('', { type: 'password', autocomplete: 'new-password', minlength: MIN_PW });
    var b = text('', { type: 'password', autocomplete: 'new-password' });
    return { a: a, b: b, nodes: [el('div', { class: 'ed-grid' }, [field(label, a), field('Same password again', b)])] };
  }
  var PW_HELP = 'Your GitHub key gets saved on the site, locked with this password. The locked copy is public, ' +
    'so use at least ' + MIN_PW + ' characters you don\'t use anywhere else. A few random words works well.';

  function passwordSheet(exists) {
    var f = passwordFields(exists ? 'New password' : 'Password');
    var saveBtn = el('button', { type: 'submit', class: 'btn primary', text: 'Save password' });
    var off = exists ? confirmBtn('Turn off password sign-in', 'Click again to turn off', function (b) {
      busy([saveBtn, b], true); s.msg('Turning off…');
      loginSha().then(function (sha) {
        if (sha) return api('/contents/' + LOGIN_PATH, { method: 'DELETE', body: { message: 'Turn off password sign-in', sha: sha, branch: BRANCH } });
      }).then(function () { done('Password sign-in is off.'); s.dlg.close(); }, function (e) { busy([saveBtn, b], false); s.msg(e.message, true); });
    }) : null;
    var s = sheet('Password sign-in', [
      el('p', { text: exists ? 'Password sign-in is on. Any browser can sign in at vortex1.dev/login with your password.' :
        'Set a password and any browser (your phone, a school laptop) can sign in at vortex1.dev/login with just that.' }),
      el('p', { class: 'ed-hint', text: PW_HELP + (exists ? ' Saving also refreshes the key with the one this browser is using.' : '') })
    ].concat(f.nodes), [off, el('span', { class: 'ed-spacer' }), saveBtn]);
    saveBtn.onclick = function () {
      var bad = checkPassword(f.a, f.b);
      if (bad) return s.msg(bad, true);
      busy([saveBtn, off], true); s.msg('Saving…');
      setPassword(f.a.value).then(function () { done('Password saved.'); s.dlg.close(); },
        function (e) { busy([saveBtn, off], false); s.msg(e.message, true); });
    };
    f.a.focus();
  }

  /* ---------- sign in ---------- */
  var TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new?name=vortex1.dev+editor&description=Edits+vortex1.dev+from+the+site&target_name=' + OWNER + '&expires_in=366&contents=write';
  // Resolves to the GitHub login if the key can change the repo.
  function checkKey(t) {
    return api(API, { token: t }).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw new Error('That key can read the repo but not change it. Set Contents to "Read and write".');
      return api('https://api.github.com/user', { token: t }).then(function (u) { return u.login; }, function () { return OWNER; });
    });
  }
  function signedIn(t, login) {
    store(TOKEN_KEY, t); store(USER_KEY, login); store(MODE_KEY, '1');
    if (location.hash === '#edit') history.replaceState(null, '', location.pathname + location.search);
    boot();
  }
  function signIn() {
    loginBox().then(function (box) { if (box) passwordSignIn(box); else keySignIn(false); });
  }
  function passwordSignIn(box) {
    var pw = text('', { type: 'password', autocomplete: 'current-password' });
    var go = el('button', { type: 'submit', class: 'btn primary', text: 'Sign in' });
    var s = sheet('Sign in to edit', [
      el('input', { type: 'text', name: 'username', autocomplete: 'username', value: OWNER, hidden: '' }),
      field('Password', pw),
      el('p', { class: 'ed-hint' }, ['Forgot it, or your GitHub key expired? ',
        el('button', { type: 'button', class: 'ed-x', text: 'Sign in with a GitHub key', onclick: function () { s.dlg.close(); keySignIn(true); } })])
    ], [el('span', { class: 'ed-spacer' }), go]);
    go.onclick = function () {
      if (!pw.value) return s.msg('Type your password.', true), pw.focus();
      busy([go], true); s.msg('Checking…');
      var t;
      unlock(box, pw.value).then(function (k) { t = k; return checkKey(t); }).then(function (login) {
        s.dlg.close(); signedIn(t, login);
      }, function (e) {
        busy([go], false); pw.select();
        s.msg(e.status === 401 ? 'Right password, but the saved GitHub key expired. Sign in with a new GitHub key and set the password again.' : e.message, true);
      });
    };
    pw.focus();
  }
  function keySignIn(hasPassword) {
    var key = text('', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'github_pat_…' });
    var go = el('button', { type: 'submit', class: 'btn primary', text: 'Sign in' });
    var steps = el('ol', { class: 'ed-steps' }, [
      el('li', null, [el('a', { href: TOKEN_URL, target: '_blank', rel: 'noopener', text: 'Make a GitHub key' }), ' (opens GitHub, already filled in).']),
      el('li', { text: 'Under Repository access, choose "Only select repositories" and pick ' + REPO + '.' }),
      el('li', { text: 'Check that Contents is set to "Read and write", then Generate token.' }),
      el('li', { text: 'Copy the key and paste it below.' })
    ]);
    var f = passwordFields(hasPassword ? 'New password (optional)' : 'Password (optional)');
    var s = sheet('Sign in to edit', [
      el('p', { text: 'Editing saves straight to the site\'s GitHub repo, so signing in uses a GitHub key that can only change this one repo.' }),
      steps, field('GitHub key', key, 'Kept in this browser. Sign out removes it.'),
      el('fieldset', { class: 'ed-set' }, [el('legend', { text: 'Sign in with a password next time' }),
        el('p', { class: 'ed-hint', text: (hasPassword ? 'Fill this in to replace the saved key and password. Leave it blank to keep them. ' :
          'Set one and other browsers only need the password, not a key. ') + PW_HELP })].concat(f.nodes))
    ], [el('span', { class: 'ed-spacer' }), go]);
    go.onclick = function () {
      var t = key.value.trim(), pw = f.a.value || f.b.value;
      if (!t) return s.msg('Paste your key first.', true), key.focus();
      var bad = pw && checkPassword(f.a, f.b);
      if (bad) return s.msg(bad, true);
      busy([go], true); s.msg('Checking the key…');
      checkKey(t).then(function (login) {
        if (!pw) return s.dlg.close(), signedIn(t, login);
        store(TOKEN_KEY, t); s.msg('Saving your password…');
        return setPassword(f.a.value).then(function () {
          s.dlg.close(); signedIn(t, login); done('Password saved.');
        }, function (e) {
          s.dlg.close(); signedIn(t, login);
          if (barMsg) barMsg.textContent = 'Signed in, but the password didn\'t save: ' + e.message;
        });
      }, function (e) { busy([go], false); s.msg(e.message, true); });
    };
    key.focus();
  }
  function signOut() {
    store(TOKEN_KEY, null); store(USER_KEY, null); store(MODE_KEY, null);
    if (bar) { bar.remove(); bar = null; document.body.classList.remove('has-edit-bar'); }
    Site.render();
  }

  /* ---------- edit bar ---------- */
  var bar, barMsg, timer;
  function on() { return !!token() && load(MODE_KEY) !== '0'; }
  function done(t) {
    if (!barMsg) return;
    barMsg.textContent = t + ' The public site updates in about a minute.';
    clearTimeout(timer); timer = setTimeout(function () { barMsg.textContent = ''; }, 9000);
  }
  function drawBar() {
    if (!bar) {
      bar = el('div', { class: 'edit-bar', role: 'region', 'aria-label': 'Site editor' });
      document.body.appendChild(bar);
      document.body.classList.add('has-edit-bar');
    }
    bar.textContent = '';
    var toggle = el('button', { type: 'button', class: 'eb-toggle', 'aria-pressed': String(on()), text: on() ? 'Editing on' : 'Editing off' });
    toggle.onclick = function () { store(MODE_KEY, on() ? '0' : '1'); drawBar(); Site.render(); };
    barMsg = el('span', { class: 'eb-msg', role: 'status' });
    bar.appendChild(el('div', { class: 'wrap' }, [
      toggle,
      el('span', { class: 'eb-who', text: 'Signed in as ' + (load(USER_KEY) || OWNER) }),
      barMsg,
      el('button', { type: 'button', class: 'eb-link', text: 'Password', onclick: function () {
        barMsg.textContent = '';
        loginSha().then(function (sha) { passwordSheet(!!sha); }, function (e) { barMsg.textContent = e.message; });
      } }),
      el('button', { type: 'button', class: 'eb-link', text: 'Sign out', onclick: signOut })
    ]));
  }
  function boot() {
    if (!token()) { if (location.hash === '#edit') signIn(); return; }
    drawBar();
    Site.render();
    // Pages can lag a minute behind GitHub, so editing works from the repo's latest copy.
    headSha().then(fetchData).then(function (d) { Site.setData(d); Site.render(); }, function (e) {
      if (e.status === 401) { signOut(); signIn(); }
      else if (barMsg) barMsg.textContent = e.message;
    });
  }

  window.SiteEdit = { boot: boot, on: on, open: function () { token() ? boot() : signIn(); }, editProject: editProject, editEntry: editEntry, toggleFlag: toggleFlag };
})();
