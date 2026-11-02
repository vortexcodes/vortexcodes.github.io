/* The app: home screen, widgets, popups, settings, reminders and the lock.
   Buttons say what they do with data-act="name"; the functions are in Actions below. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ICONS = {
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.4" stroke-width="3.6" stroke-dasharray="3.3 3.3"/><circle cx="12" cy="12" r="6.4"/><circle cx="12" cy="12" r="2.6"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 7.7-1.6"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M14 6.5l3 3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  folder: '<svg viewBox="0 0 104 84" aria-hidden="true"><path d="M6 14a8 8 0 0 1 8-8h22l8 9h46a8 8 0 0 1 8 8v47a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z" fill="var(--icon)"/><path d="M6 14a8 8 0 0 1 8-8h22l8 9h46a8 8 0 0 1 8 8v47a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z" fill="#000" opacity=".12"/><rect x="16" y="16" width="72" height="30" rx="4" fill="#fff" opacity=".95"/><rect x="22" y="22" width="40" height="3" rx="1.5" fill="#d0c8d8"/><rect x="22" y="29" width="54" height="3" rx="1.5" fill="#d0c8d8"/><path d="M6 32a8 8 0 0 1 8-8h76a8 8 0 0 1 8 8v38a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z" fill="var(--icon)"/><path d="M6 32a8 8 0 0 1 8-8h76a8 8 0 0 1 8 8v4H6z" fill="#fff" opacity=".2"/></svg>',
};

const WALLS = {
  sunset: 'linear-gradient(135deg, #ffb4a2, #e5989b 45%, #b5838d)',
  lavender: 'linear-gradient(160deg, #e0c3fc, #8ec5fc)',
  ocean: 'linear-gradient(160deg, #a1c4fd, #c2e9fb)',
  mint: 'linear-gradient(160deg, #d4fc79, #96e6a1)',
  peach: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
  night: 'radial-gradient(circle at 20% 20%, #4b3a8a, transparent 45%), radial-gradient(circle at 80% 75%, #7a2d6a, transparent 45%), linear-gradient(160deg, #141e30, #243b55)',
};
const THEMES = { pink: '#e64980', lavender: '#7950f2', sky: '#1c7ed6', mint: '#0ca678', peach: '#f76707', berry: '#ae3ec9' };
const ICON_COLORS = {
  sunny: ['#ffd43b', '#5c3d00'], pink: ['#f783ac', '#ffffff'], sky: ['#4dabf7', '#ffffff'], mint: ['#38d9a9', '#08443a'],
  lilac: ['#9775fa', '#ffffff'], coral: ['#ff8787', '#ffffff'], white: ['#ffffff', '#3a2f45'],
};
const EFFORTS = [15, 20, 30, 45, 60, 90, 120, 180];

/* ---------- Popups ---------- */

const Layer = {
  stack: [],
  // kind 'modal' sits in the middle with a dim background; 'pop' sits next to its corner button
  open({ id, kind = 'modal', cls = '', at = '', render, mount, closable = true, onClose, state = {} }) {
    if (id) Layer.close(Layer.find(id));
    if (kind === 'pop') Layer.stack.filter(L => L.kind === 'pop').forEach(Layer.close);
    const layer = document.createElement('div');
    layer.className = `layer ${kind} ${at ? 'at-' + at : ''}`;
    const card = document.createElement('div');
    card.className = 'card ' + cls;
    card.setAttribute('role', 'dialog');
    card.tabIndex = -1;
    layer.appendChild(card);
    $('#layers').appendChild(layer);
    const L = { id, kind, layer, card, render, mount, closable, onClose, state };
    L.refresh = () => {
      const sc = card.querySelector('.scroll');
      const top = sc ? sc.scrollTop : card.scrollTop;
      card.innerHTML = render(L);
      const sc2 = card.querySelector('.scroll');
      if (sc2) sc2.scrollTop = top; else card.scrollTop = top;
      if (mount) mount(L);
    };
    if (kind === 'modal') layer.addEventListener('pointerdown', e => { if (e.target === layer && L.closable) Layer.close(L); });
    Layer.stack.push(L);
    L.refresh();
    card.focus({ preventScroll: true });
    return L;
  },
  close(L) {
    if (!L) return;
    L.layer.remove();
    Layer.stack = Layer.stack.filter(x => x !== L);
    if (L.onClose) L.onClose();
  },
  find(id) { return Layer.stack.find(L => L.id === id); },
  top() { return Layer.stack[Layer.stack.length - 1]; },
  of(el) { return Layer.stack.find(L => L.card.contains(el)); },
  refreshAll() { Layer.stack.forEach(L => L.refresh()); },
};

const Nudge = {
  show({ id = '', icon = '💡', title, body = '', list, why, acts = [], warn, timeout }) {
    if (id && $(`#nudges [data-nid="${id}"]`)) return null;
    const el = document.createElement('div');
    el.className = 'nudge' + (warn ? ' warn' : '');
    el.dataset.nid = id;
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="ic" aria-hidden="true">${icon}</span><button class="x" aria-label="Close">×</button><b>${esc(title)}</b>`
      + (body ? `<p>${body}</p>` : '')
      + (list ? `<ol>${list.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : '')
      + (why ? `<p class="why">${esc(why)}</p>` : '')
      + '<div class="acts"></div>';
    acts.filter(Boolean).forEach(a => {
      const b = document.createElement(a.href ? 'a' : 'button');
      b.className = 'btn sm' + (a.primary ? ' primary' : '');
      b.textContent = a.label;
      if (a.href) { b.href = a.href; b.target = '_blank'; b.rel = 'noopener'; }
      b.addEventListener('click', () => { if (a.fn) a.fn(); if (!a.href) el.remove(); });
      el.querySelector('.acts').appendChild(b);
    });
    el.querySelector('.x').addEventListener('click', () => el.remove());
    const box = $('#nudges');
    box.appendChild(el);
    while (box.children.length > 2) box.firstChild.remove();
    if (timeout) setTimeout(() => el.remove(), timeout);
    return el;
  },
};

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

/* ---------- Looks: wallpaper and colors ---------- */

const Look = {
  apply() {
    const l = Store.data.look, root = document.documentElement;
    root.style.setProperty('--accent', THEMES[l.theme] || THEMES.pink);
    const [icon, ink] = ICON_COLORS[l.icon] || ICON_COLORS.sunny;
    root.style.setProperty('--icon', icon);
    root.style.setProperty('--icon-ink', ink);
    root.dataset.mode = l.mode;
    const photo = l.wall === 'photo' ? Store.wallpaper() : '';
    $('#wall').style.background = photo ? `center / cover no-repeat url("${photo}")` : (WALLS[l.wall] || WALLS.sunset);
  },
  // Shrinks a photo so it fits in browser storage
  async photo(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let q = 0.85, data = c.toDataURL('image/jpeg', q);
      while (data.length > 1.2e6 && q > 0.4) { q -= 0.15; data = c.toDataURL('image/jpeg', q); }
      return data;
    } finally { URL.revokeObjectURL(url); }
  },
};

/* ---------- Home screen ---------- */

const Home = {
  recent: new Set(), // tasks just checked off, kept on screen for a moment so you see them crossed out
  init() {
    Home.drag($('#w-todo'), 'todo', () => Todo.open());
    Home.drag($('#w-folder'), 'folder', () => Classes.open());
    window.addEventListener('resize', Home.place);
    Home.render();
    Home.place();
  },
  render() {
    const typing = document.activeElement && document.activeElement.closest('#w-todo .quick-add');
    const draft = $('#w-todo input[name="title"]') ? $('#w-todo input[name="title"]').value : '';
    const list = Tasks.sorted(Tasks.all().filter(t => !t.done || Home.recent.has(t.id))).slice(0, 5);
    const open = Tasks.open();
    const dueToday = open.filter(t => t.dueDay && t.dueDay <= today()).length;
    $('#w-todo').innerHTML = `
      <header><h2>To-do</h2><span>${open.length ? `${open.length} left${dueToday ? ` · ${dueToday} due today` : ''}` : ''}</span></header>
      <ul class="mini-list">${list.length ? list.map(t => {
        const lvl = Tasks.level(t);
        return `<li class="${t.done ? 'done' : ''}">
          <button class="check" data-act="toggle" data-id="${t.id}" aria-label="Done: ${esc(t.title)}">${ICONS.check}</button>
          <div class="t"><div>${esc(t.title)}</div><small class="lvl-${lvl}">${esc(Tasks.dueLabel(t))}</small>${t.cls ? `<small> · ${esc(t.cls)}</small>` : ''}</div>
        </li>`;
      }).join('') : '<li class="empty">Nothing to do. Add something below!</li>'}</ul>
      <form class="quick-add" data-form="quick"><input name="title" placeholder="Add a task…" aria-label="Add a task" autocomplete="off"><button class="btn primary sm" aria-label="Add">+</button></form>
      <div class="widget-hint">Tap the list to open it · drag to move</div>`;
    $('#w-todo input[name="title"]').value = draft;
    if (typing) $('#w-todo input[name="title"]').focus();
    const classes = Tasks.classes().length;
    $('#w-folder').innerHTML = `${ICONS.folder}<span class="label">Classes</span>${classes ? `<span class="folder-count">${classes}</span>` : ''}`;
    Home.rewardBar();
    Home.clockBadge();
  },
  rewardBar() {
    const st = Rewards.status();
    const pet = Store.data.pets.find(p => p.shown) || Store.data.pets[0];
    const icon = { login: '🔥', streak: '✅', tasks: '⭐' }[Store.data.goal.type] || '🔥';
    $('#btn-rewards').innerHTML = `${pet ? Pets.img(pet.breed, 32) : '<span style="font-size:24px">🎁</span>'}
      <span class="reward-meter"><b>${icon} ${st.count}/${st.target} ${esc(Rewards.goal().short)}</b><span class="meter"><i style="width:${st.pct * 100}%"></i></span></span>`;
    $('#btn-rewards').setAttribute('aria-label', `Rewards: ${st.count} of ${st.target} ${Rewards.goal().short}`);
  },
  clockBadge() {
    const s = Timer.s();
    const badge = $('#btn-clock .clock-badge');
    const show = s.running || Timer.left() < s.length;
    badge.hidden = !show;
    badge.textContent = Timer.fmt(Timer.left());
    badge.classList.toggle('break', s.mode === 'pomo' && s.phase === 'break');
  },
  // Widgets remember where you dragged them (as a fraction of the screen, so it works after resizing)
  place() {
    const W = window.innerWidth, H = window.innerHeight, narrow = W < 700;
    const defaults = {
      folder: narrow ? { x: 16, y: 80 } : { x: W * 0.2, y: H * 0.3 },
      todo: narrow ? { x: 16, y: 210 } : { x: W * 0.5, y: H * 0.18 },
    };
    const els = ['todo', 'folder'].map(key => {
      const el = $(`[data-widget="${key}"]`);
      const saved = Store.data.layout[Home.layoutKey(key)];
      const w = el.offsetWidth, h = el.offsetHeight;
      let x, y;
      if (saved) { x = saved.fx * (W - w); y = saved.fy * (H - h); } else ({ x, y } = defaults[key]);
      Home.move(el, x, y);
      return el;
    });
    // Squeezed onto a smaller screen and now overlapping? Put them back where they start.
    const [a, b] = els.map(el => el.getBoundingClientRect());
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
      els.forEach((el, i) => Home.move(el, defaults[i ? 'folder' : 'todo'].x, defaults[i ? 'folder' : 'todo'].y));
    }
  },
  // Phones and computers remember widget spots separately
  layoutKey(key) { return window.innerWidth < 700 ? key + '-phone' : key; },
  move(el, x, y) {
    const W = window.innerWidth, H = window.innerHeight;
    el.style.left = Math.max(8, Math.min(W - el.offsetWidth - 8, x)) + 'px';
    el.style.top = Math.max(72, Math.min(H - el.offsetHeight - 8, y)) + 'px';
  },
  drag(el, key, onOpen) {
    let s = null, dragged = false;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('input, button, a, form')) return;
      const r = el.getBoundingClientRect();
      s = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, id: e.pointerId, moved: false };
    });
    el.addEventListener('pointermove', e => {
      if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.moved) {
        if (Math.hypot(dx, dy) < 6 || Lock.on) return;
        s.moved = true;
        el.classList.add('dragging');
        el.setPointerCapture(e.pointerId);
      }
      Home.move(el, s.left + dx, s.top + dy);
    });
    const end = e => {
      if (!s || e.pointerId !== s.id) return;
      if (s.moved) {
        el.classList.remove('dragging');
        const W = window.innerWidth, H = window.innerHeight;
        Store.data.layout[Home.layoutKey(key)] = { fx: el.offsetLeft / Math.max(1, W - el.offsetWidth), fy: el.offsetTop / Math.max(1, H - el.offsetHeight) };
        Store.save();
        dragged = true;
        setTimeout(() => { dragged = false; }, 50);
      }
      s = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', e => {
      if (dragged || e.target.closest('input, button, a, form')) return;
      onOpen();
    });
    el.addEventListener('keydown', e => {
      if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); }
    });
  },
};

/* ---------- Task rows (used in the to-do list and in each class) ---------- */

function taskRow(t, L) {
  const lvl = t.done ? '' : Tasks.level(t);
  const shown = t.done || Home.recent.has(t.id);
  const editing = L && L.state.editing === t.id;
  return `<li class="task ${lvl} ${shown ? 'done' : ''}" data-id="${t.id}">
      <button class="check" data-act="toggle" data-id="${t.id}" aria-label="${t.done ? 'Not done' : 'Done'}: ${esc(t.title)}">${ICONS.check}</button>
      <div class="body" data-act="edit" data-id="${t.id}" role="button" tabindex="0" aria-expanded="${editing}">
        <div class="title">${esc(t.title)}</div>
        <div class="meta">
          ${t.cls ? `<span class="chip"><i class="dot" style="background:${Tasks.color(t.cls)}"></i>${esc(t.cls)}</span>` : ''}
          <span class="${lvl ? 'lvl-' + lvl : ''}">${esc(Tasks.dueLabel(t))}</span>
          <span>~${fmtMinutes(t.effort || 30)}</span>
          ${t.planDay && !t.done ? `<span class="chip">Do it ${esc(onDay(t.planDay))}</span>` : ''}
          ${t.source === 'canvas' ? '<span class="chip">Canvas</span>' : ''}${t.source === 'sample' ? '<span class="chip">Sample</span>' : ''}
        </div>
      </div>
      <div class="tools">
        <button class="imp imp-${t.importance}" data-act="imp" data-id="${t.id}" title="How important? Tap to change">${['', 'Low', 'Med', 'High'][t.importance]}</button>
        <button class="icon-btn" data-act="tip" data-id="${t.id}" aria-label="Tips to get started" title="How do I start?">${ICONS.bulb}</button>
        ${/^https?:\/\//i.test(t.url) ? `<a class="icon-btn hide-sm" href="${esc(t.url)}" target="_blank" rel="noopener" aria-label="Open in Canvas" title="Open in Canvas">${ICONS.link}</a>` : ''}
      </div>
    </li>${editing ? editPanel(t) : ''}`;
}

function editPanel(t) {
  const fromCanvas = t.source === 'canvas';
  const ro = fromCanvas ? 'readonly title="Comes from Canvas"' : '';
  return `<li class="edit" data-id="${t.id}">
    <label class="field">Task<input data-field="title" value="${esc(t.title)}" ${ro}></label>
    <div class="row">
      <label class="field">Class<input data-field="cls" list="class-list" value="${esc(t.cls)}" ${ro}></label>
      <label class="field">Due date<input type="date" data-field="dueDay" value="${t.dueDay}" ${ro}></label>
      <label class="field">Time<input type="time" data-field="dueTime" value="${t.dueTime}" ${ro}></label>
    </div>
    <div class="row">
      <label class="field">Time it takes<select data-field="effort">${EFFORTS.map(m => `<option value="${m}" ${m === t.effort ? 'selected' : ''}>${fmtMinutes(m)}</option>`).join('')}${EFFORTS.includes(t.effort) ? '' : `<option selected value="${t.effort}">${fmtMinutes(t.effort)}</option>`}</select></label>
      <label class="field">Plan to do it on<input type="date" data-field="planDay" value="${t.planDay}"></label>
    </div>
    <label class="field">Notes<textarea data-field="notes">${esc(t.notes)}</textarea></label>
    ${fromCanvas ? '<p class="note">Name, class and due date come from Canvas and update when you sync.</p>' : ''}
    <div class="row"><button class="btn primary sm" data-act="editDone">Done</button>
      ${fromCanvas ? '' : `<button class="btn sm ghost" data-act="del" data-id="${t.id}">Delete task</button>`}</div>
  </li>`;
}

function classList() {
  return `<datalist id="class-list">${Tasks.classes().map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>`;
}

/* ---------- The big to-do list (opens from the widget) ---------- */

const Todo = {
  open() {
    Layer.open({ id: 'todo', cls: 'lg', render: Todo.render, state: { view: 'list', adding: false, month: today().slice(0, 8) + '01', sel: today() } });
    setTimeout(() => { Todo.warn(); Todo.nextUp(); }, 400);
  },
  render(L) {
    const st = L.state;
    const open = Tasks.open();
    const week = open.filter(t => t.dueDay && daysBetween(today(), t.dueDay) <= 6);
    const mins = week.filter(t => t.cls).reduce((m, t) => m + (t.effort || 30), 0);
    return `<div class="bar">
        <h2>To-do</h2>
        <div class="seg" role="group" aria-label="View">
          <button data-act="todoView" data-v="list" aria-pressed="${st.view === 'list'}">List</button>
          <button data-act="todoView" data-v="cal" aria-pressed="${st.view === 'cal'}">Calendar</button>
        </div>
        <button class="btn primary" data-act="todoAdd">+ Add task</button>
        <button class="x" data-act="close" aria-label="Close">×</button>
      </div>
      <div class="scroll">
        <div class="summary">
          <span class="chip">${open.length} to do</span>
          ${(n => n ? `<span class="chip lvl-urgent">${n} due today or late</span>` : '<span class="chip lvl-later">Nothing due today</span>')(open.filter(t => t.dueDay && t.dueDay <= today()).length)}
          <span class="chip">~${fmtMinutes(mins)} of schoolwork this week</span>
        </div>
        ${st.adding ? Todo.addForm() : ''}
        ${st.view === 'list' ? Todo.list(L) : Cal.render(L)}
        ${classList()}
      </div>`;
  },
  addForm(day) {
    return `<form class="add-form" data-form="add">
      <div class="row">
        <label class="field" style="flex:2 1 240px">What do you need to do?<input name="title" required placeholder="Chapter 5 worksheet, clean my room…" autocomplete="off"></label>
        <label class="field">Class (leave empty if not school)<input name="cls" list="class-list" autocomplete="off"></label>
      </div>
      <div class="row">
        <label class="field">Due date<input type="date" name="dueDay" value="${day || ''}"></label>
        <label class="field">Time<input type="time" name="dueTime"></label>
        <label class="field">Importance<select name="importance"><option value="">Guess for me</option><option value="1">Low</option><option value="2">Medium</option><option value="3">High</option></select></label>
        <label class="field">Time it takes<select name="effort"><option value="">Guess for me</option>${EFFORTS.map(m => `<option value="${m}">${fmtMinutes(m)}</option>`).join('')}</select></label>
      </div>
      <div class="row"><button class="btn primary">Add task</button><button type="button" class="btn ghost" data-act="todoAdd">Cancel</button></div>
    </form>`;
  },
  list(L) {
    const all = Tasks.all();
    const open = all.filter(t => !t.done || Home.recent.has(t.id));
    if (!all.length) {
      const pet = Store.data.pets[0];
      return `<div class="empty-state">${pet ? Pets.img(pet.breed, 72) : ''}<p>No tasks yet.</p>
        <p><button class="btn primary" data-act="todoAdd">Add your first task</button> <button class="btn" data-act="openSettings" data-v="canvas">Connect Canvas</button></p></div>`;
    }
    const n = t => t.dueDay ? daysBetween(today(), t.dueDay) : null;
    const groups = [
      ['Late', t => n(t) !== null && n(t) < 0], ['Today', t => n(t) === 0], ['Tomorrow', t => n(t) === 1],
      ['This week', t => n(t) >= 2 && n(t) <= 6], ['Later', t => n(t) >= 7], ['No due date', t => n(t) === null],
    ];
    const done = all.filter(t => t.done && !Home.recent.has(t.id));
    return groups.map(([name, test]) => {
      const items = Tasks.sorted(open.filter(test));
      return items.length ? `<h3 class="group-title">${name}</h3><ul class="task-list">${items.map(t => taskRow(t, L)).join('')}</ul>` : '';
    }).join('') + (done.length ? `<details class="done-list"><summary>Done (${done.length})</summary>
      <ul class="task-list">${done.map(t => taskRow(t, L)).join('')}</ul>
      <p><button class="btn sm ghost" data-act="clearDone">Clear done tasks</button></p></details>` : '');
  },
  // Too much on one day? Suggest moving something, based on research about homework load
  warn() {
    if (!Store.data.settings.warnings) return;
    const seen = Store.data.seen;
    const heavy = Tasks.heavyDays(14).find(l => seen['warn:' + l.day] !== today());
    if (!heavy) return;
    seen['warn:' + heavy.day] = today();
    Store.save();
    const move = Tasks.suggestMove(heavy);
    const over = heavy.minutes > 180;
    Nudge.show({
      id: 'warn-' + heavy.day, icon: '⚠️', warn: true,
      title: `${over ? 'Heavy day' : 'Lots due'}: ${relDay(heavy.day)}`,
      body: `${heavy.count} assignment${heavy.count > 1 ? 's' : ''}, about ${fmtMinutes(heavy.minutes)} of work.`
        + (move ? ` Try doing <b>${esc(move.task.title)}</b> ${esc(onDay(move.day))} instead.` : ' Start the biggest one early, or ask your teacher about an extension.'),
      why: over
        ? 'Why: in a Stanford study of students at high-achieving high schools, more homework went with more stress and health problems, and students averaged about 3 hours a night (Galloway, Conner & Pope, 2013).'
        : 'Why: spreading work out means less to do the night before.',
      acts: [move && { label: `Do it ${onDay(move.day)}`, primary: true, fn: () => { Tasks.update(move.task.id, { planDay: move.day }); App.refresh(); toast(`Planned for ${onDay(move.day)}`); } },
        { label: 'Not now' }],
    });
  },
  // Advice for the most important task, once a day
  nextUp() {
    if (!Store.data.settings.tips || !Layer.find('todo')) return;
    const t = Tasks.sorted(Tasks.open())[0];
    if (!t || Store.data.seen['tip:' + t.id] === today()) return;
    Store.data.seen['tip:' + t.id] = today();
    Store.save();
    const tip = Tasks.tip(t);
    Nudge.show({
      id: 'next-' + t.id, icon: '👉', title: `Next up: ${t.title}`, timeout: 15000,
      body: `First step: ${esc(tip.steps[0])}`,
      acts: [{ label: `Start ${Store.data.settings.pomoWork} min focus`, primary: true, fn: () => { Timer.focus(); Clock.open(); } },
        { label: 'More tips', fn: () => showTip(t) }],
    });
  },
};

function showTip(t) {
  const tip = Tasks.tip(t);
  Nudge.show({
    id: 'tip-' + t.id, icon: '💡', title: tip.title, body: `For <b>${esc(t.title)}</b>:`, list: tip.steps, why: tip.why,
    acts: [
      { label: `Start ${Store.data.settings.pomoWork} min focus`, primary: true, fn: () => { Timer.focus(); Clock.open(); } },
      tip.action === 'plan' && t.dueDay && Tasks.studyPlan(t).length && { label: 'Make me a study plan', fn: () => { Tasks.addPlan(t); App.refresh(); toast('Study sessions added to your to-do'); } },
      tip.action === 'steps' && { label: 'Split into steps', fn: () => { Tasks.addSteps(t); App.refresh(); toast('Steps added to your to-do'); } },
      tip.link && { label: tip.link.label, href: tip.link.url },
    ],
  });
}

/* ---------- Calendar view ---------- */

const Cal = {
  render(L) {
    const st = L.state;
    const first = parseDay(st.month);
    const start = addDays(st.month, -first.getDay());
    const weeks = Math.ceil((first.getDay() + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7);
    const tasks = Tasks.all();
    const cells = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i);
      const items = tasks.filter(t => t.dueDay === d);
      const evs = Events.on(d);
      const load = Tasks.loadOn(d);
      const heavy = load.minutes > 180 || load.count >= 4;
      const chips = items.slice(0, 3).map(t => `<span class="it" style="background:${Tasks.color(t.cls)};${t.done ? 'opacity:.45;text-decoration:line-through' : ''}">${esc(t.title)}</span>`).join('')
        + evs.slice(0, 2).map(e => `<span class="ev">${e.kind === 'important' ? '★' : '•'} ${esc(e.title)}</span>`).join('');
      const more = items.length + evs.length - Math.min(3, items.length) - Math.min(2, evs.length);
      cells.push(`<button class="day ${d.slice(0, 7) !== st.month.slice(0, 7) ? 'other' : ''} ${d === today() ? 'today' : ''} ${d === st.sel ? 'sel' : ''} ${heavy ? 'heavy' : ''}"
        data-act="calDay" data-v="${d}" aria-label="${fmtDay(d, true)}: ${items.length} tasks, ${evs.length} events${heavy ? ', heavy day' : ''}">
        <span class="num">${parseDay(d).getDate()}${heavy ? ' ⚠️' : ''}</span>${chips}${more > 0 ? `<span class="more">+${more} more</span>` : ''}</button>`);
    }
    const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="dow">${d}</div>`).join('');
    return `<div class="cal-wrap"><div>
        <div class="cal-head">
          <h3>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
          <button class="btn sm" data-act="calMove" data-v="-1" aria-label="Previous month">‹</button>
          <button class="btn sm" data-act="calMove" data-v="0">Today</button>
          <button class="btn sm" data-act="calMove" data-v="1" aria-label="Next month">›</button>
        </div>
        <div class="cal">${dows}${cells.join('')}</div>
        <p class="note">⚠️ marks a heavy day: over 3 hours of schoolwork or 4+ things due.</p>
      </div>${Cal.side(L)}</div>`;
  },
  side(L) {
    const d = L.state.sel;
    const items = Tasks.sorted(Tasks.all().filter(t => t.dueDay === d));
    const evs = Events.on(d);
    const load = Tasks.loadOn(d);
    return `<aside class="side">
      <h3>${fmtDay(d, true)}</h3>
      ${load.minutes ? `<p class="note" style="margin:0">About ${fmtMinutes(load.minutes)} of schoolwork planned or due.</p>` : ''}
      ${items.length || evs.length ? `<ul>
        ${evs.map(e => `<li>${e.kind === 'important' ? '★' : '•'}<span>${e.time ? fmtTime(e.time) + ' · ' : ''}${esc(e.title)}</span>${e.source === 'canvas' ? '' : `<button class="icon-btn" data-act="delEvent" data-id="${e.id}" aria-label="Delete ${esc(e.title)}">×</button>`}</li>`).join('')}
        ${items.map(t => `<li class="${t.done ? 'done' : ''}"><button class="check" data-act="toggle" data-id="${t.id}" aria-label="Done: ${esc(t.title)}">${ICONS.check}</button><span class="title">${esc(t.title)}${t.cls ? ` <small style="color:var(--muted)">· ${esc(t.cls)}</small>` : ''}</span></li>`).join('')}
      </ul>` : '<p class="note" style="margin:0">Nothing on this day yet.</p>'}
      <form data-form="event" class="add-form" style="margin:0">
        <label class="field">Add to this day<input name="title" required placeholder="Event, important date or task" autocomplete="off"></label>
        <div class="row">
          <label class="field">Type<select name="kind"><option value="event">Event</option><option value="important">Important date</option><option value="task">Task due</option></select></label>
          <label class="field">Time<input type="time" name="time"></label>
        </div>
        <button class="btn primary sm">Add</button>
      </form>
    </aside>`;
  },
};

/* ---------- Classes (opens from the folder) ---------- */

const Classes = {
  open(cls) {
    const L = Layer.open({ id: 'classes', cls: 'lg', render: Classes.render, state: { cls: cls || null } });
    if (cls) Classes.guideNudge(L);
  },
  render(L) {
    return L.state.cls ? Classes.detail(L) : Classes.dashboard();
  },
  dashboard() {
    const classes = Tasks.classes();
    const body = classes.length ? `<div class="class-grid">${classes.map(c => {
      const open = Tasks.byDate(c.tasks.filter(t => !t.done));
      const week = open.filter(t => t.dueDay && daysBetween(today(), t.dueDay) <= 6).length;
      const next = open[0];
      const color = Tasks.color(c.name);
      return `<button class="class-card" data-act="openClass" data-v="${esc(c.name)}">
        <span class="band" style="background:linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #fff))">${esc(c.name)}</span>
        <span class="info"><span><b>${week}</b> due this week · ${open.length} to do</span>
        <small>${next ? `Next: ${esc(next.title)} · ${esc(Tasks.dueLabel(next))}` : 'All caught up!'}</small></span>
      </button>`;
    }).join('')}</div>` : `<div class="empty-state"><p style="font-size:40px;margin:0">📂</p><p>No classes yet.</p>
      <p><button class="btn primary" data-act="openSettings" data-v="canvas">Connect Canvas</button> <button class="btn" data-act="sampleAdd">Try pretend classes</button></p>
      <p class="note">Tasks you add with a class name show up here too.</p></div>`;
    return `<div class="bar"><h2>Classes</h2><button class="x" data-act="close" aria-label="Close">×</button></div><div class="scroll">${body}</div>`;
  },
  // The test or big assignment to build a study guide for
  guideFor(name) {
    const open = Tasks.byDate(Tasks.all().filter(t => t.cls === name && !t.done && t.dueDay && t.dueDay >= today()));
    const soon = t => daysBetween(today(), t.dueDay) <= 21;
    return open.find(t => soon(t) && ['test', 'quiz'].includes(kindOf(t.title).key))
      || open.find(t => soon(t) && ['project', 'essay'].includes(kindOf(t.title).key));
  },
  detail(L) {
    const name = L.state.cls;
    const tasks = Tasks.all().filter(t => t.cls === name);
    const open = Tasks.byDate(tasks.filter(t => !t.done || Home.recent.has(t.id)));
    const done = tasks.filter(t => t.done && !Home.recent.has(t.id));
    const g = Classes.guideFor(name);
    let guide = '';
    if (g && ['test', 'quiz'].includes(kindOf(g.title).key)) {
      const plan = Tasks.studyPlan(g);
      const review = Tasks.byDate(tasks.filter(t => t.id !== g.id && t.dueDay && t.dueDay < g.dueDay && daysBetween(t.dueDay, g.dueDay) <= 21 && !t.title.startsWith('Study for ')));
      guide = `<div class="aside-card" id="guide">
        <h3>📘 Study guide: ${esc(g.title)}</h3>
        <p class="note" style="margin-top:0">${esc(Tasks.dueLabel(g))} · made from your assignments in this class</p>
        ${plan.length ? `<b>Your plan</b><ol>${plan.map(s => `<li><b>${esc(relDay(s.day))}:</b> ${esc(s.text)}</li>`).join('')}</ol>` : '<p>It\'s today! Do a quick self-quiz on the hard parts.</p>'}
        ${review.length ? `<b>Go back over</b><ul>${review.slice(0, 6).map(t => `<li>${esc(t.title)}</li>`).join('')}</ul>` : ''}
        <p class="note">Why: testing yourself beats rereading (Roediger & Karpicke, 2006), and a few short sessions on different days beat one cram (Cepeda et al., 2006).</p>
        ${plan.length ? `<button class="btn sm primary" data-act="addPlan" data-id="${g.id}">Add plan to my to-do</button>` : ''}
      </div>`;
    } else if (g) {
      guide = `<div class="aside-card" id="guide">
        <h3>🗂️ Plan for: ${esc(g.title)}</h3>
        <p class="note" style="margin-top:0">${esc(Tasks.dueLabel(g))}</p>
        <ol class="steps">${Tasks.tip(g).steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <button class="btn sm primary" data-act="addSteps" data-id="${g.id}">Split into steps with due dates</button>
      </div>`;
    }
    const sources = Tasks.sources(name);
    return `<div class="bar">
        <button class="btn sm" data-act="openClass" data-v="">‹ All classes</button>
        <h2><i class="dot" style="background:${Tasks.color(name)};width:14px;height:14px"></i> ${esc(name)}</h2>
        <button class="x" data-act="close" aria-label="Close">×</button>
      </div>
      <div class="scroll"><div class="class-view">
        <div>
          <h3 class="group-title" style="margin-top:0">Assignments by due date</h3>
          ${open.length ? `<ul class="task-list">${open.map(t => taskRow(t, L)).join('')}</ul>` : '<p class="note">Nothing left for this class. Nice!</p>'}
          ${done.length ? `<details class="done-list"><summary>Done (${done.length})</summary><ul class="task-list">${done.map(t => taskRow(t, L)).join('')}</ul></details>` : ''}
          <form class="add-form" data-form="add" style="margin-top:14px">
            <input type="hidden" name="cls" value="${esc(name)}">
            <div class="row"><label class="field" style="flex:2 1 200px">Add an assignment to ${esc(name)}<input name="title" required autocomplete="off"></label>
            <label class="field">Due<input type="date" name="dueDay"></label></div>
            <button class="btn primary sm">Add</button>
          </form>
        </div>
        <div>
          ${guide}
          <div class="aside-card">
            <h3>🔗 Recommended sources</h3>
            <ul>${sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>
            <p class="note">Picked from the class name. Always check what your teacher wants you to use.</p>
          </div>
        </div>
      </div>${classList()}</div>`;
  },
  guideNudge(L) {
    const g = Classes.guideFor(L.state.cls);
    if (!g) return;
    const isTest = ['test', 'quiz'].includes(kindOf(g.title).key);
    Nudge.show({
      id: 'guide-' + g.id, icon: isTest ? '📘' : '🗂️', title: isTest ? 'Study guide ready' : 'Plan ready',
      body: `For <b>${esc(g.title)}</b> (${esc(Tasks.dueLabel(g))}).`, timeout: 9000,
      acts: [{ label: 'Show me', primary: true, fn: () => { const el = $('#guide'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('glow'); setTimeout(() => el.classList.remove('glow'), 2000); } } }],
    });
  },
};

/* ---------- Clock ---------- */

const Clock = {
  open() {
    if (Layer.find('clock')) return;
    Layer.open({ id: 'clock', kind: 'pop', at: 'tl', render: Clock.render });
  },
  render() {
    const s = Timer.s(), pomo = s.mode === 'pomo', st = Store.data.settings;
    const adj = [-600, -300, 300, 600];
    return `<button class="x" data-act="close" aria-label="Close">×</button>
      <h2>Clock</h2>
      <p class="sub" data-now>${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
      <div style="text-align:center"><div class="seg" role="group" aria-label="Mode">
        <button data-act="timerMode" data-v="timer" aria-pressed="${!pomo}">Timer</button>
        <button data-act="timerMode" data-v="pomo" aria-pressed="${pomo}">Pomodoro</button>
      </div></div>
      ${pomo ? `<div class="timer-phase ${s.phase}" style="margin-top:12px">${s.phase === 'work' ? '📚 Work' : '☕ Break'} · round ${s.rounds + (s.phase === 'work' ? 1 : 0)}</div>` : ''}
      <div class="big-timer" data-left aria-live="off">${Timer.fmt(Timer.left())}</div>
      <div class="meter"><i data-meter style="width:${Clock.pct()}%"></i></div>
      <div class="timer-btns">
        <button class="btn primary" data-act="timerToggle">${s.running ? 'Pause' : 'Start'}</button>
        <button class="btn" data-act="timerRestart">Restart</button>
      </div>
      <div class="timer-btns">${adj.map(a => `<button class="btn sm" data-act="timerAdj" data-v="${a}">${a < 0 ? '−' : '+'}${Math.abs(a) / 60}:00</button>`).join('')}</div>
      <p class="note" style="text-align:center">${pomo ? `${st.pomoWork} min work, then ${st.pomoBreak} min break, over and over. Change the times in Settings.` : 'Use the + and − buttons to set the time.'}</p>`;
  },
  pct() { const s = Timer.s(); return s.length ? 100 - Timer.left() / s.length * 100 : 0; },
  tick() {
    const L = Layer.find('clock');
    if (!L) return;
    const left = $('[data-left]', L.card), meter = $('[data-meter]', L.card), now = $('[data-now]', L.card);
    if (left) left.textContent = Timer.fmt(Timer.left());
    if (meter) meter.style.width = Clock.pct() + '%';
    if (now) now.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  },
};

/* ---------- Settings ---------- */

const Settings = {
  canvasBlocked: false,
  open(section) {
    const L = Layer.open({ id: 'settings', render: Settings.render, mount: Settings.mount });
    if (section) setTimeout(() => { const el = $(`[data-section="${section}"]`, L.card); if (el) el.scrollIntoView({ block: 'start' }); }, 50);
  },
  render() {
    const d = Store.data, st = d.settings, c = d.canvas;
    const chk = (path, label) => `<label class="chip-check"><input type="checkbox" data-set="${path}" ${get(path) ? 'checked' : ''}> ${label}</label>`;
    const sw = (path, label, sub) => `<label class="switch"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" data-set="${path}" ${get(path) ? 'checked' : ''}></label>`;
    const hasCanvas = d.tasks.some(t => t.source === 'canvas');
    const feed = Canvas.feedUrl(c.feedUrl || '');
    return `<button class="x" data-act="close" aria-label="Close">×</button>
      <h2>Settings</h2>
      <p class="sub">Everything saves by itself, in this browser.</p>

      <h3 data-section="reminders">🔔 Reminders</h3>
      ${sw('settings.notify', 'Push notifications', 'Get a heads-up before things are due')}
      <div class="checks">${chk('settings.remind.dayOf', 'The day it\'s due')}${chk('settings.remind.before1', '1 day before')}${chk('settings.remind.before3', '3 days before')}${chk('settings.remind.before7', '1 week before')}</div>
      <label class="field" style="max-width:220px">Remind me at<input type="time" data-set="settings.remindAt" value="${st.remindAt}"></label>
      <p class="note">Reminders show up while this page is open in a tab (it can be in the background). Browsers can't send them when it's closed.</p>

      <h3 data-section="canvas">📚 Where your tasks come from</h3>
      <div class="seg" role="group" aria-label="Task source">
        <button data-act="source" data-v="both" aria-pressed="${st.source === 'both'}">Canvas + my own tasks</button>
        <button data-act="source" data-v="manual" aria-pressed="${st.source === 'manual'}">Only my own tasks</button>
      </div>
      ${st.source === 'both' ? `
        <ol class="steps" style="margin-top:12px">
          <li>In Canvas, open <b>Calendar</b>.</li>
          <li>Click <b>Calendar Feed</b> (bottom of the right side) and copy the link.</li>
          <li>Paste it here and press <b>Sync</b>.</li>
        </ol>
        <div class="row">
          <label class="field" style="flex:3 1 240px">Canvas calendar feed link<input data-set="canvas.feedUrl" value="${esc(c.feedUrl)}" placeholder="https://….instructure.com/feeds/calendars/user_….ics" autocomplete="off"></label>
          <button class="btn primary" data-act="sync">Sync</button>
        </div>
        <p class="note">${c.lastSync ? `Last synced ${new Date(c.lastSync).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${c.direct ? ' · syncs by itself when you open the app' : ''}.` : 'Not synced yet.'} The link is private: it's only saved in this browser.</p>
        <div class="drop" data-drop>
          ${Settings.canvasBlocked ? '<p style="margin-top:0"><b>Your school\'s Canvas doesn\'t let other websites read the feed directly,</b> so use the file instead:</p>' : '<p style="margin-top:0">Sync not working? Use the file instead:</p>'}
          <p>${/^https?:\/\//i.test(feed) ? `<a href="${esc(feed)}" target="_blank" rel="noopener">Open your feed link</a>` : 'Open your feed link'} (it downloads a calendar file), then drop the file here or</p>
          <label class="btn sm">Choose file<input type="file" accept=".ics,text/calendar" data-file="ics" hidden></label>
          <p class="note">Do this again whenever you want new assignments.</p>
        </div>
        ${hasCanvas ? '<p><button class="btn sm ghost" data-act="canvasRemove">Remove Canvas tasks</button></p>' : ''}` : '<p class="note">Canvas tasks are hidden. Add your own tasks from the to-do list.</p>'}

      <h3 data-section="timer">⏱️ Pomodoro times</h3>
      <div class="row">
        <label class="field">Work (minutes)<input type="number" min="1" max="120" data-set="settings.pomoWork" value="${st.pomoWork}"></label>
        <label class="field">Break (minutes)<input type="number" min="1" max="60" data-set="settings.pomoBreak" value="${st.pomoBreak}"></label>
      </div>

      <h3 data-section="goal">🎁 Goal and rewards</h3>
      <div class="row">
        <label class="field">Goal<select data-act-change="goal" name="type">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${d.goal.type === k ? 'selected' : ''}>${g.label}</option>`).join('')}</select></label>
        <label class="field">How hard<select data-act-change="goal" name="level">${Object.entries(LEVELS).map(([k, n]) => `<option value="${k}" ${d.goal.level === k ? 'selected' : ''}>${n}: ${GOALS[d.goal.type].targets[k]} ${GOALS[d.goal.type].short}</option>`).join('')}</select></label>
      </div>
      <p class="note">Harder goals win rarer, cuter pets. Changing your goal starts its progress over.</p>

      <h3>✨ Helpers</h3>
      ${sw('settings.warnings', 'Workload warnings', 'Pop up when one day has too much on it')}
      ${sw('settings.tips', 'Tips for getting started', 'Advice for your next task when you open the list')}
      ${sw('settings.sound', 'Sounds', 'Timer chime and check-off pop')}

      <h3>🧹 Data</h3>
      <p>${Sample.has() ? '<button class="btn sm" data-act="sampleRemove">Remove pretend classes</button>' : '<button class="btn sm" data-act="sampleAdd">Try pretend classes</button>'}
        <button class="btn sm ghost" data-act="resetAll">Start over</button></p>`;
  },
  mount(L) {
    const drop = $('[data-drop]', L.card);
    if (!drop) return;
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = e.dataTransfer.files[0];
      if (f) importIcs(f);
    });
  },
};

function get(path) { return path.split('.').reduce((o, k) => o && o[k], Store.data); }
function set(path, value) {
  const keys = path.split('.'), last = keys.pop();
  keys.reduce((o, k) => o[k], Store.data)[last] = value;
  Store.save();
}

async function importIcs(file) {
  try {
    const r = await Canvas.importFile(file);
    toast(`Canvas: ${r.added} new, ${r.updated} updated`);
    App.refresh();
  } catch (e) { toast('That doesn\'t look like a Canvas calendar file (.ics)'); }
}

/* ---------- Customize (pen button) ---------- */

const Customize = {
  render() {
    const l = Store.data.look, photo = Store.wallpaper();
    return `<button class="x" data-act="close" aria-label="Close">×</button>
      <h2>Customize</h2>
      <h3>Wallpaper</h3>
      <div class="swatches">
        ${Object.entries(WALLS).map(([k, bg]) => `<button class="swatch" style="background:${bg}" data-act="look" data-k="wall" data-v="${k}" aria-pressed="${l.wall === k}" aria-label="${k} wallpaper"></button>`).join('')}
        ${photo ? `<button class="swatch" style="background-image:url('${photo}')" data-act="look" data-k="wall" data-v="photo" aria-pressed="${l.wall === 'photo'}" aria-label="My photo"></button>` : ''}
        <label class="swatch upload" title="Upload a photo" aria-label="Upload a photo">+<input type="file" accept="image/*" data-file="wall" hidden></label>
      </div>
      ${photo ? '<p><button class="btn sm ghost" data-act="wallRemove">Remove my photo</button></p>' : '<p class="note">Tap + to use your own photo.</p>'}
      <h3>App color</h3>
      <div class="swatches">${Object.entries(THEMES).map(([k, c]) => `<button class="swatch round-sw" style="background:${c}" data-act="look" data-k="theme" data-v="${k}" aria-pressed="${l.theme === k}" aria-label="${k}"></button>`).join('')}</div>
      <h3>Icon color</h3>
      <div class="swatches">${Object.entries(ICON_COLORS).map(([k, [c]]) => `<button class="swatch round-sw" style="background:${c}" data-act="look" data-k="icon" data-v="${k}" aria-pressed="${l.icon === k}" aria-label="${k}"></button>`).join('')}</div>
      <h3>Light or dark</h3>
      <div class="seg" role="group">${[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([k, n]) => `<button data-act="look" data-k="mode" data-v="${k}" aria-pressed="${l.mode === k}">${n}</button>`).join('')}</div>
      <p><button class="btn sm ghost" data-act="resetLayout">Put the widgets back</button></p>`;
  },
};

/* ---------- Rewards (the bar in the top right) ---------- */

const RewardsView = {
  render() {
    const st = Rewards.status(), p = Store.data.progress, level = Store.data.goal.level;
    const odds = ODDS[level];
    return `<button class="x" data-act="close" aria-label="Close">×</button>
      <h2>Rewards</h2>
      <p class="sub">Goal: ${esc(Rewards.describe())} (${LEVELS[level]})</p>
      <div class="meter" style="height:14px"><i style="width:${st.pct * 100}%"></i></div>
      <p class="note">${st.count} of ${st.target} ${esc(Rewards.goal().short)} · Open-the-app streak: ${p.loginStreak} · Task streak: ${p.taskStreak} · Goals finished: ${p.goalsDone}</p>
      <div class="odds">${TIERS.map((t, i) => odds[i] ? `<span class="chip" style="color:${t.color}">${t.name} ${odds[i]}%</span>` : '').join('')}</div>
      <p><button class="btn sm" data-act="openSettings" data-v="goal">Change goal</button></p>
      <h3>Your pets (${Store.data.pets.length})</h3>
      ${Store.data.pets.map(pet => {
        const b = BREEDS[pet.breed], t = TIERS[b.tier];
        return `<div class="pet-row">
          ${Pets.img(pet.breed, 44)}
          <div class="who"><input class="name" data-pet-name="${pet.id}" value="${esc(pet.name)}" aria-label="Pet name" maxlength="20">
            <div class="tier" style="color:${t.color}">${t.name} · ${esc(b.name)}</div></div>
          <label class="switch" style="border:0;padding:0" title="Show on screen"><input type="checkbox" data-pet-show="${pet.id}" ${pet.shown ? 'checked' : ''} aria-label="Show ${esc(pet.name)} on screen"></label>
          <button class="btn sm" data-act="findPet" data-id="${pet.id}" ${pet.shown ? '' : 'disabled'}>Find</button>
        </div>`;
      }).join('') || '<p class="note">No pets yet.</p>'}
      <p class="note">Tap a pet on the screen to make it hop. Finish your goal to win another one.</p>`;
  },
};

/* ---------- First visit: pick a pet, a goal and where tasks come from ---------- */

const Onboard = {
  open() {
    Layer.open({ id: 'onboard', closable: false, render: Onboard.render, state: { step: 0, species: '', breed: '', name: Pets.randomName(), type: 'login', level: 'medium' } });
  },
  render(L) {
    const s = L.state;
    const dots = `<div class="dots">${[0, 1, 2, 3].map(i => `<i class="${i === s.step ? 'on' : ''}"></i>`).join('')}</div>`;
    if (s.step === 0) return `<h2>Welcome! 👋</h2>
      <p class="sub">This is your home base for getting stuff done: a to-do list, your classes, a focus timer, and a pet buddy who cheers you on. First, pick your buddy.</p>
      <div class="choice-grid">
        <button class="choice" data-act="ob" data-k="species" data-v="cat">${Pets.img('cat-tabby', 64)}Cat</button>
        <button class="choice" data-act="ob" data-k="species" data-v="dog">${Pets.img('dog-golden', 64)}Dog</button>
      </div>${dots}`;
    if (s.step === 1) return `<h2>Pick your ${s.species}</h2>
      <p class="sub">You can win more pets later.</p>
      <div class="choice-grid">${STARTERS[s.species].map(b => `<button class="choice" data-act="ob" data-k="breed" data-v="${b}" aria-pressed="${s.breed === b}">${Pets.img(b, 64)}${esc(BREEDS[b].name)}</button>`).join('')}</div>
      <label class="field" style="margin-top:14px">Name<input data-ob-name value="${esc(s.name)}" maxlength="20"></label>
      <p style="text-align:right;margin-bottom:0"><button class="btn ghost" data-act="ob" data-k="step" data-v="0">Back</button> <button class="btn primary" data-act="ob" data-k="step" data-v="2" ${s.breed ? '' : 'disabled'}>Next</button></p>${dots}`;
    if (s.step === 2) return `<h2>Choose a goal</h2>
      <p class="sub">Reach it to win a surprise pet. Harder goals win rarer, cuter ones.</p>
      <div class="choice-grid">${Object.entries(GOALS).map(([k, g]) => `<button class="choice" data-act="ob" data-k="type" data-v="${k}" aria-pressed="${s.type === k}">${{ login: '🔥', streak: '✅', tasks: '⭐' }[k]} ${esc(g.label)}</button>`).join('')}</div>
      <h3>How hard?</h3>
      <div class="choice-grid">${Object.entries(LEVELS).map(([k, n]) => `<button class="choice" data-act="ob" data-k="level" data-v="${k}" aria-pressed="${s.level === k}">${n}<small>${GOALS[s.type].targets[k]} ${GOALS[s.type].short}</small><small>${TIERS.map((t, i) => ODDS[k][i] ? `${t.name} ${ODDS[k][i]}%` : '').filter(Boolean).join(' · ')}</small></button>`).join('')}</div>
      <p style="text-align:right;margin-bottom:0"><button class="btn ghost" data-act="ob" data-k="step" data-v="1">Back</button> <button class="btn primary" data-act="ob" data-k="step" data-v="3">Next</button></p>${dots}`;
    return `<h2>Where do your tasks come from?</h2>
      <p class="sub">You can change this any time in Settings.</p>
      <div class="choice-grid">
        <button class="choice" data-act="obDone" data-v="canvas">📚 Sync with Canvas<small>Your assignments, plus your own tasks</small></button>
        <button class="choice" data-act="obDone" data-v="sample">🧪 Try it out<small>Start with pretend classes</small></button>
        <button class="choice" data-act="obDone" data-v="manual">✍️ My own tasks<small>Type them in yourself</small></button>
      </div>
      <p style="margin-bottom:0"><button class="btn ghost" data-act="ob" data-k="step" data-v="2">Back</button></p>${dots}`;
  },
  finish(L, how) {
    const s = L.state;
    const name = (s.name || '').trim() || Pets.randomName();
    Pets.adopt(s.breed, name);
    Rewards.setGoal(s.type, s.level);
    Store.data.onboarded = true;
    Store.data.settings.source = how === 'manual' ? 'manual' : 'both';
    if (how === 'sample') Sample.add();
    Store.save();
    Rewards.visit();
    Layer.close(L);
    App.refresh();
    toast(`Say hi to ${name}!`);
    if (how === 'canvas') Settings.open('canvas');
  },
};

/* ---------- Reminders (notifications) ---------- */

const Reminders = {
  async enable() {
    if (!('Notification' in window)) { toast('This browser can\'t show notifications'); return false; }
    const p = await Notification.requestPermission();
    if (p !== 'granted') { toast('Notifications are blocked. Allow them in your browser\'s site settings.'); return false; }
    return true;
  },
  check() {
    const st = Store.data.settings;
    if (!st.notify) return;
    const now = new Date(), t = today(), hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    const offs = [[7, 'before7'], [3, 'before3'], [1, 'before1'], [0, 'dayOf']].filter(([, k]) => st.remind[k]).map(([n]) => n);
    const due = [];
    Tasks.open().forEach(task => {
      if (!task.dueDay || task.dueDay < t) return;
      let fire = null;
      offs.forEach(n => {
        const day = addDays(task.dueDay, -n);
        let at = st.remindAt;
        if (n === 0 && task.dueTime && task.dueTime <= at) at = pad(Math.max(0, +task.dueTime.slice(0, 2) - 2)) + task.dueTime.slice(2);
        if (day < t || (day === t && hm >= at)) fire = n;
      });
      if (fire === null || Store.data.notified[task.id + ':' + fire]) return;
      offs.forEach(n => { if (n >= fire) Store.data.notified[task.id + ':' + n] = 1; });
      due.push({ task, n: fire });
    });
    if (!due.length) return;
    Store.save();
    const label = ({ task, n }) => (n === 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : `Due in ${daysBetween(t, task.dueDay)} days`) + ': ' + task.title;
    if (due.length <= 2) due.forEach(d => Reminders.send(label(d), [d.task.cls, Tasks.dueLabel(d.task)].filter(Boolean).join(' · ')));
    else Reminders.send(`${due.length} things coming up`, due.slice(0, 3).map(label).join('\n') + (due.length > 3 ? '\n…' : ''));
  },
  async send(title, body) {
    const ok = Store.data.settings.notify && 'Notification' in window && Notification.permission === 'granted';
    if (ok) {
      try {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) { await reg.showNotification(title, { body, tag: title }); return; }
        new Notification(title, { body });
        return;
      } catch (e) { /* fall through to the in-page popup */ }
    }
    Nudge.show({ icon: '⏰', title, body: esc(body).replace(/\n/g, '<br>'), timeout: 15000 });
  },
};

/* ---------- Lock: click once to lock the screen on this page, double-click to unlock ---------- */

const Lock = {
  on: false,
  at: 0,
  hintTimer: 0,
  init() {
    const btn = $('#btn-lock');
    btn.addEventListener('click', () => {
      if (!Lock.on) return Lock.lock();
      clearTimeout(Lock.hintTimer);
      Lock.hintTimer = setTimeout(() => toast('Double-click the lock to unlock'), 320);
    });
    btn.addEventListener('dblclick', () => {
      clearTimeout(Lock.hintTimer);
      if (Lock.on && Date.now() - Lock.at > 500) Lock.unlock();
    });
    document.addEventListener('fullscreenchange', Lock.pill);
    document.addEventListener('webkitfullscreenchange', Lock.pill);
    window.addEventListener('beforeunload', e => { if (Lock.on) { e.preventDefault(); e.returnValue = ''; } });
  },
  full() { return document.fullscreenElement || document.webkitFullscreenElement; },
  enterFull() {
    const el = document.documentElement;
    try { const r = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (r && r.catch) r.catch(() => {}); } catch (e) {}
  },
  lock() {
    Lock.on = true;
    Lock.at = Date.now();
    Lock.enterFull();
    Lock.paint();
    toast('Locked in! Double-click the lock to unlock.');
  },
  unlock() {
    Lock.on = false;
    if (Lock.full()) { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} }
    Lock.paint();
    toast('Unlocked');
  },
  paint() {
    const btn = $('#btn-lock');
    btn.classList.toggle('locked', Lock.on);
    btn.innerHTML = Lock.on ? ICONS.lock : ICONS.unlock;
    btn.setAttribute('aria-label', Lock.on ? 'Locked. Double-click to unlock' : 'Lock screen on this page');
    btn.title = Lock.on ? 'Double-click to unlock' : 'Lock (stay on this page)';
    document.body.classList.toggle('is-locked', Lock.on);
    Lock.pill();
  },
  pill() {
    const pill = $('#lock-pill');
    pill.hidden = !Lock.on;
    pill.innerHTML = '🔒 Focus lock is on' + (Lock.full() ? '' : ' <button data-act="lockFull">Full screen</button>');
  },
};

/* ---------- Every button's action ---------- */

const Actions = {
  close: el => Layer.close(Layer.of(el)),
  toggle(el) {
    const id = el.dataset.id;
    const t = Tasks.toggle(id);
    if (!t) return;
    if (t.done) {
      Chime.pop();
      Home.recent.add(id);
      setTimeout(() => { Home.recent.delete(id); App.refresh(); }, 1200);
    }
    App.refresh();
  },
  imp(el) {
    const t = Tasks.get(el.dataset.id);
    Tasks.update(t.id, { importance: t.importance % 3 + 1 });
    App.refresh();
  },
  tip: el => showTip(Tasks.get(el.dataset.id)),
  edit(el) {
    const L = Layer.of(el);
    L.state.editing = L.state.editing === el.dataset.id ? null : el.dataset.id;
    L.refresh();
  },
  editDone(el) { const L = Layer.of(el); L.state.editing = null; App.refresh(); },
  del(el) {
    const t = Tasks.get(el.dataset.id);
    if (!confirm(`Delete "${t.title}"?`)) return;
    Tasks.remove(t.id);
    App.refresh();
  },
  clearDone() { Tasks.clearDone(); App.refresh(); },
  todoView(el) { const L = Layer.of(el); L.state.view = el.dataset.v; L.refresh(); },
  todoAdd(el) {
    const L = Layer.of(el);
    L.state.adding = !L.state.adding;
    L.refresh();
    if (L.state.adding) { L.card.querySelector('.scroll').scrollTop = 0; $('[data-form="add"] input[name="title"]', L.card).focus(); }
  },
  calMove(el) {
    const L = Layer.of(el), v = +el.dataset.v;
    if (!v) { L.state.month = today().slice(0, 8) + '01'; L.state.sel = today(); } else {
      const d = parseDay(L.state.month);
      d.setMonth(d.getMonth() + v);
      L.state.month = dayKey(d);
    }
    L.refresh();
  },
  calDay(el) { const L = Layer.of(el); L.state.sel = el.dataset.v; L.refresh(); },
  delEvent(el) { Events.remove(el.dataset.id); App.refresh(); },
  openClass(el) {
    const L = Layer.of(el);
    L.state.cls = el.dataset.v || null;
    L.state.editing = null;
    L.refresh();
    if (L.state.cls) Classes.guideNudge(L);
  },
  addPlan(el) { Tasks.addPlan(Tasks.get(el.dataset.id)); App.refresh(); toast('Study sessions added to your to-do'); },
  addSteps(el) { Tasks.addSteps(Tasks.get(el.dataset.id)); App.refresh(); toast('Steps added to your to-do'); },
  openSettings(el) { Layer.close(Layer.of(el)); Settings.open(el.dataset.v); },
  source(el) { set('settings.source', el.dataset.v); App.refresh(); },
  async sync() {
    try {
      const r = await Canvas.sync();
      Settings.canvasBlocked = false;
      toast(`Canvas synced: ${r.added} new, ${r.updated} updated`);
    } catch (e) {
      if (e.message === 'nourl') { toast('Paste your Canvas feed link first'); return; }
      Settings.canvasBlocked = true;
      toast('Canvas blocked the sync. Use the file instead (below).');
    }
    App.refresh();
  },
  canvasRemove() { if (confirm('Remove all tasks and events from Canvas?')) { Canvas.removeAll(); App.refresh(); } },
  sampleAdd(el) { Sample.add(); App.refresh(); toast('Pretend classes added'); },
  sampleRemove() { Sample.remove(); App.refresh(); toast('Pretend classes removed'); },
  resetAll() {
    if (!confirm('Start over? This deletes your tasks, pets and settings in this browser.')) return;
    Store.reset();
    location.reload();
  },
  look(el) {
    Store.data.look[el.dataset.k] = el.dataset.v;
    Store.save();
    Look.apply();
    App.refresh();
  },
  wallRemove() { Store.setWallpaper(''); if (Store.data.look.wall === 'photo') Store.data.look.wall = 'sunset'; Store.save(); Look.apply(); App.refresh(); },
  resetLayout() { Store.data.layout = {}; Store.save(); Home.place(); },
  findPet(el) {
    Layer.close(Layer.of(el));
    PetLayer.find(el.dataset.id);
  },
  timerMode(el) { Timer.setMode(el.dataset.v); App.refresh(); },
  timerToggle() { Timer.toggle(); App.refresh(); },
  timerRestart() { Timer.restart(); App.refresh(); },
  timerAdj(el) { Timer.adjust(+el.dataset.v); App.refresh(); },
  lockFull() { Lock.enterFull(); },
  ob(el) {
    const L = Layer.of(el), s = L.state, k = el.dataset.k, v = el.dataset.v;
    const name = $('[data-ob-name]', L.card);
    if (name) s.name = name.value;
    if (k === 'species') { s.species = v; s.breed = STARTERS[v][0]; s.step = 1; }
    else if (k === 'step') s.step = +v;
    else s[k] = v;
    L.refresh();
  },
  obDone(el) { Onboard.finish(Layer.of(el), el.dataset.v); },
};

const Forms = {
  quick(form) {
    const title = form.title.value.trim();
    if (!title) return;
    form.title.value = '';
    Tasks.add({ title });
    App.refresh();
    $('#w-todo input[name="title"]').focus();
  },
  add(form) {
    const f = Object.fromEntries(new FormData(form));
    if (!f.title.trim()) return;
    const t = Tasks.add({ title: f.title, cls: f.cls, dueDay: f.dueDay, dueTime: f.dueTime, importance: +f.importance || 0, effort: +f.effort || 0 });
    const L = Layer.of(form);
    if (L && L.id === 'todo') L.state.adding = false;
    App.refresh();
    toast('Added!');
    if (t.cls && t.dueDay) setTimeout(Todo.warn, 300);
  },
  event(form) {
    const f = Object.fromEntries(new FormData(form));
    const L = Layer.of(form);
    if (f.kind === 'task') Tasks.add({ title: f.title, dueDay: L.state.sel, dueTime: f.time });
    else Events.add({ title: f.title, day: L.state.sel, time: f.time, kind: f.kind });
    App.refresh();
  },
};

/* ---------- Start up ---------- */

const App = {
  init() {
    Store.load();
    Look.apply();
    $('#btn-settings').innerHTML = ICONS.gear;
    $('#btn-clock').insertAdjacentHTML('afterbegin', ICONS.clock);
    $('#btn-pen').innerHTML = ICONS.pen;
    Lock.paint();
    Home.init();
    PetLayer.init();
    Lock.init();
    App.events();
    if (!Store.data.onboarded) Onboard.open();
    else {
      Rewards.visit();
      App.refresh();
      const c = Store.data.canvas;
      if (c.direct && c.feedUrl && Store.data.settings.source === 'both' && Date.now() - new Date(c.lastSync || 0) > 36e5) {
        Canvas.sync().then(App.refresh).catch(() => {});
      }
    }
    App.day = today();
    setInterval(App.tick, 1000);
    setTimeout(Reminders.check, 3000);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  },
  tick() {
    Timer.tick();
    Home.clockBadge();
    Clock.tick();
    if (new Date().getSeconds() === 0) {
      Reminders.check();
      if (App.day !== today()) { App.day = today(); Rewards.visit(); App.refresh(); }
    }
  },
  refresh() {
    Home.render();
    Layer.refreshAll();
  },
  // Timer finished, etc.: a popup, plus a notification if the tab is in the background
  alert(title, body) {
    Nudge.show({ icon: '⏰', title, body: esc(body), timeout: 10000 });
    if (document.hidden) Reminders.send(title, body);
    Home.render();
    const clock = Layer.find('clock');
    if (clock) clock.refresh();
  },
  celebrate(pet) {
    const b = BREEDS[pet.breed], t = TIERS[b.tier];
    Chime.play(2);
    Layer.open({
      id: 'celebrate',
      render: () => `<div class="celebrate">
        <h2>Goal complete! 🎉</h2>
        <p class="sub">You won a new pet.</p>
        ${Pets.img(pet.breed, 128)}
        <div class="tier" style="color:${t.color}">${t.name} · ${esc(b.name)}</div>
        <label class="field" style="max-width:240px;margin:12px auto">Name<input data-pet-name="${pet.id}" value="${esc(pet.name)}" maxlength="20"></label>
        <button class="btn primary" data-act="close">Yay!</button>
      </div>`,
    });
    App.refresh();
  },
  events() {
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = Actions[el.dataset.act];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const L = Layer.top();
        if (L && L.closable) Layer.close(L);
      }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
    });
    document.addEventListener('submit', e => {
      const form = e.target.closest('[data-form]');
      if (!form) return;
      e.preventDefault();
      Forms[form.dataset.form](form);
    });
    document.addEventListener('change', async e => {
      const el = e.target;
      if (el.dataset.set) {
        const path = el.dataset.set;
        let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.max(+el.min || 1, Math.min(+el.max || 999, Math.round(+el.value) || 1)) : el.value;
        if (path === 'settings.notify' && v) { v = await Reminders.enable(); el.checked = v; }
        set(path, v);
        if (path.startsWith('settings.pomo')) { el.value = v; Timer.settingsChanged(); Home.clockBadge(); }
        if (path === 'settings.notify' && v) Reminders.check();
      } else if (el.dataset.field) {
        const id = el.closest('[data-id]').dataset.id;
        Tasks.update(id, { [el.dataset.field]: el.dataset.field === 'effort' ? +el.value : el.value });
        Home.render();
      } else if (el.dataset.actChange === 'goal') {
        const card = el.closest('.card');
        const type = $('select[name="type"]', card).value, level = $('select[name="level"]', card).value;
        if (Store.data.progress.count && !confirm('Changing your goal starts its progress over. OK?')) { App.refresh(); return; }
        Rewards.setGoal(type, level);
        App.refresh();
      } else if (el.dataset.petShow) {
        const pet = Store.data.pets.find(p => p.id === el.dataset.petShow);
        pet.shown = el.checked;
        Store.save();
        PetLayer.sync();
        App.refresh();
      } else if (el.dataset.petName) {
        const pet = Store.data.pets.find(p => p.id === el.dataset.petName);
        pet.name = el.value.trim() || pet.name;
        Store.save();
        PetLayer.sync();
      } else if (el.dataset.file === 'ics' && el.files[0]) {
        importIcs(el.files[0]);
      } else if (el.dataset.file === 'wall' && el.files[0]) {
        try {
          const data = await Look.photo(el.files[0]);
          if (!Store.setWallpaper(data)) { toast('That photo is too big to save. Try a smaller one.'); return; }
          Store.data.look.wall = 'photo';
          Store.save();
          Look.apply();
          App.refresh();
        } catch (err) { toast('Couldn\'t open that photo. Try a JPG or PNG.'); }
      }
    });
    // Popovers close when you click somewhere else
    document.addEventListener('pointerdown', e => {
      const L = Layer.top();
      if (!L || L.kind !== 'pop' || L.card.contains(e.target) || e.target.closest('.corner, #nudges')) return;
      Layer.close(L);
    });
    $('#btn-settings').addEventListener('click', () => (Layer.find('settings') ? Layer.close(Layer.find('settings')) : Settings.open()));
    $('#btn-clock').addEventListener('click', () => (Layer.find('clock') ? Layer.close(Layer.find('clock')) : Clock.open()));
    $('#btn-pen').addEventListener('click', () => (Layer.find('look') ? Layer.close(Layer.find('look')) : Layer.open({ id: 'look', kind: 'pop', at: 'br', render: Customize.render })));
    $('#btn-rewards').addEventListener('click', () => (Layer.find('rewards') ? Layer.close(Layer.find('rewards')) : Layer.open({ id: 'rewards', kind: 'pop', at: 'tr', render: RewardsView.render })));
  },
};

App.init();
