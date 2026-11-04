/* The website's own settings, and the admins who can change them.
   - data/site.json: the name, welcome message, announcement banner and starting look everyone sees.
   - data/admins.json: who can sign in as an admin. Each admin's password locks their own copy of one shared
     GitHub key (PBKDF2 + AES-GCM, like Jones's editor), so the file can be public. Owners can add and remove admins.
   Every save is one commit to main; GitHub Pages republishes about a minute later. */

const GH = { owner: 'vortexcodes', repo: 'vortexcodes.github.io', branch: 'main', dir: 'emma-and-alisa/' };
const GH_API = `https://api.github.com/repos/${GH.owner}/${GH.repo}`;
const KEY_URL = `https://github.com/settings/personal-access-tokens/new?name=Work+in+Progress+admin&description=Edits+vortex1.dev%2Femma-and-alisa&target_name=${GH.owner}&expires_in=366&contents=write`;
const SITE_DEFAULTS = {
  name: 'Work in Progress',
  welcome: 'This is your home base for getting stuff done: a to-do list, your classes, a focus timer, and a pet buddy who cheers you on.',
  announcement: '',
  look: { wall: 'sunset', theme: 'pink', icon: 'sunny', mode: 'auto' },
};
const ADMIN_KEY = 'ea-admin', SITE_CACHE = 'ea-site';
const PW_ITER = 600000, MIN_PW = 10;

/* ---------- What everyone sees ---------- */

const Site = {
  data: JSON.parse(JSON.stringify(SITE_DEFAULTS)),
  async load() {
    try { const cached = JSON.parse(localStorage.getItem(SITE_CACHE) || 'null'); if (cached) Site.set(cached); } catch (e) {}
    let fresh = null;
    // Admins read straight from GitHub so a save shows up right away; everyone else gets the published file
    if (Admin.session()) { try { fresh = (await Admin.read('data/site.json')).data; } catch (e) {} }
    if (!fresh) { try { const r = await fetch('data/site.json', { cache: 'no-cache' }); if (r.ok) fresh = await r.json(); } catch (e) {} }
    if (fresh) Site.set(fresh, true);
  },
  set(d, keep) {
    Site.data = { ...SITE_DEFAULTS, ...d, look: { ...SITE_DEFAULTS.look, ...(d.look || {}) } };
    if (keep) { try { localStorage.setItem(SITE_CACHE, JSON.stringify(Site.data)); } catch (e) {} }
    Site.apply();
  },
  apply() {
    document.title = Site.data.name;
    $('#wordmark').textContent = Site.data.name;
    Look.apply();
    Site.banner();
    const ob = Layer.find('onboard');
    if (ob) ob.refresh();
  },
  banner() {
    const text = Site.data.announcement.trim(), el = $('#banner');
    el.hidden = !text || Store.data.seen['ann:' + text] === 1;
    el.innerHTML = text ? `<span aria-hidden="true">📣</span> <span>${esc(text)}</span><button class="x" data-act="bannerClose" aria-label="Hide announcement">×</button>` : '';
  },
};

/* ---------- Admin sign-in and GitHub ---------- */

const b64 = buf => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0));

const Admin = {
  s: undefined,
  session() {
    if (Admin.s === undefined) {
      try { Admin.s = JSON.parse(sessionStorage.getItem(ADMIN_KEY) || localStorage.getItem(ADMIN_KEY) || 'null'); } catch (e) { Admin.s = null; }
    }
    return Admin.s;
  },
  isOwner() { const s = Admin.session(); return !!s && s.role === 'owner'; },
  remember(s, keep) {
    Admin.s = s;
    try {
      sessionStorage.removeItem(ADMIN_KEY);
      localStorage.removeItem(ADMIN_KEY);
      if (s) (keep ? localStorage : sessionStorage).setItem(ADMIN_KEY, JSON.stringify(s));
    } catch (e) {}
  },
  signOut() { Admin.remember(null); App.refresh(); toast('Signed out of admin'); },

  async api(path, { method = 'GET', body, token } = {}) {
    const res = await fetch(path.startsWith('https:') ? path : GH_API + path, {
      method, cache: 'no-store',
      headers: {
        Authorization: 'Bearer ' + (token || Admin.session().token),
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = new Error(res.status === 401 ? 'GitHub rejected the key. It may have expired; ask Jones for a new one.'
        : res.status === 403 || res.status === 404 ? 'This key can\'t change the website.'
        : res.status === 409 ? 'Someone else saved at the same time. Try again.' : `GitHub error ${res.status}.`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  },
  async read(path) {
    try {
      const f = await Admin.api(`/contents/${GH.dir}${path}?ref=${GH.branch}`);
      return { data: JSON.parse(new TextDecoder().decode(unb64(f.content))), sha: f.sha };
    } catch (e) {
      if (e.status === 404) return { data: null, sha: null };
      throw e;
    }
  },
  write(path, data, message, sha) {
    const body = { message, branch: GH.branch, content: b64(new TextEncoder().encode(JSON.stringify(data, null, 2) + '\n')) };
    if (sha) body.sha = sha;
    return Admin.api(`/contents/${GH.dir}${path}`, { method: 'PUT', body });
  },
  // Read the newest copy, change it, save it (once more if someone saved in between)
  async change(path, fn, message) {
    for (let i = 0; ; i++) {
      const { data, sha } = await Admin.read(path);
      const next = fn(data);
      try { await Admin.write(path, next, message, sha); return next; } catch (e) { if (e.status !== 409 || i) throw e; }
    }
  },
  // The admin list as published (no key needed to read it)
  async list() {
    const get = async u => { try { const r = await fetch(u, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
    const d = await get('data/admins.json') || await get(`https://raw.githubusercontent.com/${GH.owner}/${GH.repo}/${GH.branch}/${GH.dir}data/admins.json`);
    return d && Array.isArray(d.admins) ? d.admins : [];
  },
  async checkKey(token) {
    const repo = await Admin.api(GH_API, { token });
    if (!repo.permissions || !repo.permissions.push) throw new Error('That key can read the website but not change it. Set Contents to "Read and write".');
  },

  async derive(pw, salt, iter) {
    if (!(window.crypto && crypto.subtle)) throw new Error('Admin sign-in only works on https://vortex1.dev.');
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async lock(token, pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await Admin.derive(pw, salt, PW_ITER), new TextEncoder().encode(token));
    return { kdf: 'PBKDF2-SHA256', iter: PW_ITER, salt: b64(salt), iv: b64(iv), key: b64(ct) };
  },
  async unlock(box, pw) {
    const k = await Admin.derive(pw, unb64(box.salt), box.iter || PW_ITER);
    try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, k, unb64(box.key))); } catch (e) { throw new Error('Wrong password.'); }
  },

  // First owner: a GitHub key from Jones, a name and a password
  async setup(token, name, pw, keep) {
    await Admin.checkKey(token.trim());
    Admin.remember({ name, role: 'owner', token: token.trim() }, keep);
    try {
      const entry = { name, role: 'owner', added: today(), ...(await Admin.lock(token.trim(), pw)) };
      await Admin.change('data/admins.json', d => ({ admins: [...((d && d.admins) || []).filter(a => !same(a.name, name)), entry] }), `${Site.data.name}: ${name} set up admin`);
    } catch (e) { Admin.remember(null); throw e; }
  },
  async signIn(name, pw, keep) {
    const me = (await Admin.list()).find(a => same(a.name, name));
    if (!me) throw new Error('No admin with that name.');
    const token = await Admin.unlock(me, pw);
    await Admin.checkKey(token);
    Admin.remember({ name: me.name, role: me.role, token }, keep);
  },
  // Everyone forgot their password: sign in with a GitHub key and reset things
  async keySignIn(token, name, keep) {
    await Admin.checkKey(token.trim());
    Admin.remember({ name, role: 'owner', token: token.trim() }, keep);
  },
  async addAdmin(name, pw, role) {
    const me = Admin.session();
    const entry = { name, role, added: today(), ...(await Admin.lock(me.token, pw)) };
    await Admin.change('data/admins.json', d => {
      const list = (d && d.admins) || [];
      if (list.some(a => same(a.name, name))) throw new Error(`There's already an admin called ${name}.`);
      return { admins: [...list, entry] };
    }, `${Site.data.name}: ${me.name} added ${name} as ${role === 'owner' ? 'an owner' : 'an admin'}`);
  },
  async removeAdmin(name) {
    const me = Admin.session();
    await Admin.change('data/admins.json', d => {
      const list = ((d && d.admins) || []).filter(a => !same(a.name, name));
      if (!list.some(a => a.role === 'owner')) throw new Error('There has to be at least one owner.');
      return { admins: list };
    }, `${Site.data.name}: ${me.name} removed ${name} as admin`);
  },
  async changePassword(pw) {
    const me = Admin.session();
    const box = await Admin.lock(me.token, pw);
    await Admin.change('data/admins.json', d => {
      const list = (d && d.admins) || [];
      const mine = list.find(a => same(a.name, me.name));
      if (mine) Object.assign(mine, box);
      else list.push({ name: me.name, role: me.role, added: today(), ...box });
      return { admins: list };
    }, `${Site.data.name}: ${me.name} changed their admin password`);
  },
  async saveSite(data) {
    const me = Admin.session();
    const next = await Admin.change('data/site.json', d => ({ ...SITE_DEFAULTS, ...(d || {}), ...data }), `${data.name}: website settings updated by ${me.name}`);
    Site.set(next, true);
  },
};
const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
function pwProblem(a, b) {
  if (a.length < MIN_PW) return `Use at least ${MIN_PW} characters. A few random words works well.`;
  if (a !== b) return 'The two passwords don\'t match.';
  return '';
}

/* ---------- Admin screens ---------- */

const AdminUI = {
  open() {
    if (Admin.session()) return AdminUI.panel();
    const L = Layer.open({ id: 'admin', render: AdminUI.signInView, state: { list: null, useKey: false } });
    Admin.list().then(list => { L.state.list = list; L.refresh(); });
  },
  signInView(L) {
    const { list, useKey } = L.state;
    const keep = `<label class="chip-check"><input type="checkbox" name="keep"> Keep me signed in on this device</label>`;
    const head = `<button class="x" data-act="close" aria-label="Close">×</button><h2>🛠️ Admin</h2>`;
    if (!list) return head + '<p class="sub">Loading…</p>';
    if (!list.length || useKey) return `${head}
      <p class="sub">${list.length ? 'Sign in with a GitHub key, then reset passwords from the admin panel.' : 'No admins yet. Set up the first one (that\'s you, as an owner).'}</p>
      <form class="add-form" data-form="${list.length ? 'adminKey' : 'adminSetup'}">
        <label class="field">GitHub key<input name="token" type="password" required autocomplete="off" placeholder="github_pat_…"></label>
        <p class="note" style="margin:0">Jones makes this on GitHub (<a href="${KEY_URL}" target="_blank" rel="noopener">pre-filled form</a>: this repository only, Contents: read and write). It's never shown to anyone after this.</p>
        <label class="field">Your name<input name="name" required maxlength="20" placeholder="First name or nickname" autocomplete="off"></label>
        ${list.length ? '' : `<div class="row"><label class="field">Password<input name="pw" type="password" required autocomplete="new-password"></label>
        <label class="field">Same password again<input name="pw2" type="password" required autocomplete="new-password"></label></div>`}
        ${keep}
        <div class="row"><button class="btn primary">${list.length ? 'Sign in' : 'Set up admin'}</button>${list.length ? '<button type="button" class="btn ghost" data-act="adminUseKey">Back</button>' : ''}</div>
        <p class="note form-msg" role="status"></p>
      </form>`;
    return `${head}
      <p class="sub">Admins can change the website's name, welcome message, announcement and starting look.</p>
      <form class="add-form" data-form="adminSignIn">
        <label class="field">Name<select name="name">${list.map(a => `<option>${esc(a.name)}</option>`).join('')}</select></label>
        <label class="field">Password<input name="pw" type="password" required autocomplete="current-password"></label>
        ${keep}
        <div class="row"><button class="btn primary">Sign in</button></div>
        <p class="note form-msg" role="status"></p>
      </form>
      <p class="note">Not on the list? Ask an owner to add you. Everyone forgot their password? <button class="btn sm ghost" data-act="adminUseKey">Use a GitHub key</button></p>`;
  },
  panel() {
    const L = Layer.open({ id: 'admin', render: AdminUI.panelView, state: { list: null } });
    AdminUI.reloadList(L);
  },
  reloadList(L) {
    Admin.read('data/admins.json').then(r => { L.state.list = (r.data && r.data.admins) || []; L.refresh(); }, e => { L.state.error = e.message; L.refresh(); });
  },
  panelView(L) {
    const me = Admin.session(), d = Site.data, owner = Admin.isOwner();
    const opts = (obj, cur) => Object.keys(obj).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${k[0].toUpperCase() + k.slice(1)}</option>`).join('');
    const list = L.state.list;
    return `<button class="x" data-act="close" aria-label="Close">×</button>
      <h2>🛠️ Admin</h2>
      <p class="sub">Signed in as <b>${esc(me.name)}</b> (${me.role === 'owner' ? 'owner' : 'admin'}). Saving changes the live website for everyone.</p>

      <h3>The website</h3>
      <form class="add-form" data-form="adminSite">
        <label class="field">Name<input name="name" required maxlength="40" value="${esc(d.name)}"></label>
        <label class="field">Welcome message (the first thing new visitors read)<textarea name="welcome" maxlength="300">${esc(d.welcome)}</textarea></label>
        <label class="field">Announcement (a banner everyone sees; leave empty for none)<input name="announcement" maxlength="160" value="${esc(d.announcement)}" placeholder="New: pick your own wallpaper with the pen button!"></label>
        <div class="row">
          <label class="field">Starting wallpaper<select name="wall">${opts(WALLS, d.look.wall)}</select></label>
          <label class="field">App color<select name="theme">${opts(THEMES, d.look.theme)}</select></label>
          <label class="field">Icon color<select name="icon">${opts(ICON_COLORS, d.look.icon)}</select></label>
          <label class="field">Light or dark<select name="mode">${opts({ auto: 1, light: 1, dark: 1 }, d.look.mode)}</select></label>
        </div>
        <p class="note" style="margin:0">New visitors start with this look. Anyone who picked their own keeps theirs.</p>
        <div class="row"><button class="btn primary">Save to the website</button></div>
        <p class="note form-msg" role="status"></p>
      </form>

      <h3>Admins</h3>
      ${L.state.error ? `<p class="note">${esc(L.state.error)}</p>` : !list ? '<p class="note">Loading…</p>' : `<ul class="admin-list">${list.map(a => `<li>
          <span><b>${esc(a.name)}</b>${same(a.name, me.name) ? ' (you)' : ''}<small>${a.role === 'owner' ? 'Owner' : 'Admin'} · added ${esc(a.added || '')}</small></span>
          ${owner && !same(a.name, me.name) ? `<button class="btn sm ghost" data-act="adminRemove" data-v="${esc(a.name)}">Remove</button>` : ''}
        </li>`).join('') || '<li>No one yet.</li>'}</ul>`}
      ${owner ? `<form class="add-form" data-form="adminAdd">
        <b>Make someone an admin</b>
        <div class="row">
          <label class="field">Their name<input name="name" required maxlength="20" placeholder="First name or nickname" autocomplete="off"></label>
          <label class="field">Role<select name="role"><option value="admin">Admin: can edit the website</option><option value="owner">Owner: can also add and remove admins</option></select></label>
        </div>
        <div class="row">
          <label class="field">A password for them<input name="pw" type="password" required autocomplete="new-password"></label>
          <label class="field">Same password again<input name="pw2" type="password" required autocomplete="new-password"></label>
        </div>
        <p class="note" style="margin:0">Tell them the password in person. They can change it after signing in. This list is public, so use first names or nicknames.</p>
        <div class="row"><button class="btn primary">Add admin</button></div>
        <p class="note form-msg" role="status"></p>
      </form>` : '<p class="note">Only owners can add or remove admins.</p>'}

      <h3>You</h3>
      <form class="add-form" data-form="adminPassword">
        <div class="row">
          <label class="field">New password<input name="pw" type="password" required autocomplete="new-password"></label>
          <label class="field">Same password again<input name="pw2" type="password" required autocomplete="new-password"></label>
        </div>
        <div class="row"><button class="btn">Change my password</button> <button type="button" class="btn ghost" data-act="adminSignOut">Sign out</button></div>
        <p class="note form-msg" role="status"></p>
      </form>
      <p class="note">How it works: every admin's password unlocks the same GitHub key, and that key can change this whole repository, including Jones's site. Only make people admins you trust. Removing someone stops their sign-in. If they might have saved the key, ask Jones to delete it on GitHub and make a new one.</p>`;
  },
};

// Runs a form's async job: shows progress and errors in the form, and blocks double clicks
async function adminJob(form, busyText, job) {
  const msg = $('.form-msg', form), btns = $$('button', form);
  btns.forEach(b => { b.disabled = true; });
  msg.textContent = busyText;
  try {
    await job();
    return true;
  } catch (e) {
    msg.textContent = e.message;
    btns.forEach(b => { b.disabled = false; });
    return false;
  }
}

Object.assign(Forms, {
  async adminSetup(form) {
    const f = Object.fromEntries(new FormData(form)), name = f.name.trim();
    const bad = pwProblem(f.pw, f.pw2);
    if (bad) { $('.form-msg', form).textContent = bad; return; }
    if (await adminJob(form, 'Setting up… (this takes a few seconds)', () => Admin.setup(f.token, name, f.pw, !!f.keep))) {
      toast(`You're an owner now, ${name}!`);
      App.refresh();
      AdminUI.panel();
    }
  },
  async adminSignIn(form) {
    const f = Object.fromEntries(new FormData(form));
    if (await adminJob(form, 'Signing in…', () => Admin.signIn(f.name, f.pw, !!f.keep))) {
      toast(`Hi ${Admin.session().name}!`);
      App.refresh();
      Site.load();
      AdminUI.panel();
    }
  },
  async adminKey(form) {
    const f = Object.fromEntries(new FormData(form));
    if (await adminJob(form, 'Checking the key…', () => Admin.keySignIn(f.token, f.name.trim(), !!f.keep))) {
      App.refresh();
      AdminUI.panel();
    }
  },
  async adminSite(form) {
    const f = Object.fromEntries(new FormData(form));
    const data = { name: f.name.trim(), welcome: f.welcome.trim(), announcement: f.announcement.trim(), look: { wall: f.wall, theme: f.theme, icon: f.icon, mode: f.mode } };
    if (await adminJob(form, 'Saving…', () => Admin.saveSite(data))) {
      toast('Saved! Everyone sees it in about a minute.');
      App.refresh();
    }
  },
  async adminAdd(form) {
    const f = Object.fromEntries(new FormData(form)), name = f.name.trim();
    const bad = pwProblem(f.pw, f.pw2);
    if (bad) { $('.form-msg', form).textContent = bad; return; }
    if (await adminJob(form, `Adding ${name}…`, () => Admin.addAdmin(name, f.pw, f.role))) {
      toast(`${name} is an admin now`);
      AdminUI.reloadList(Layer.of(form));
    }
  },
  async adminPassword(form) {
    const f = Object.fromEntries(new FormData(form));
    const bad = pwProblem(f.pw, f.pw2);
    if (bad) { $('.form-msg', form).textContent = bad; return; }
    if (await adminJob(form, 'Saving…', () => Admin.changePassword(f.pw))) {
      toast('Password changed');
      AdminUI.reloadList(Layer.of(form));
    }
  },
});

Object.assign(Actions, {
  adminOpen(el) {
    const L = Layer.of(el);
    if (L && L.id !== 'admin') Layer.close(L);
    AdminUI.open();
  },
  adminUseKey(el) { const L = Layer.of(el); L.state.useKey = !L.state.useKey; L.refresh(); },
  async adminRemove(el) {
    const name = el.dataset.v, L = Layer.of(el);
    if (!confirm(`Remove ${name} as an admin?`)) return;
    el.disabled = true;
    try { await Admin.removeAdmin(name); toast(`${name} isn't an admin anymore`); } catch (e) { toast(e.message); }
    AdminUI.reloadList(L);
  },
  adminSignOut(el) { Layer.close(Layer.of(el)); Admin.signOut(); },
  bannerClose() { Store.data.seen['ann:' + Site.data.announcement.trim()] = 1; Store.save(); Site.banner(); },
});
