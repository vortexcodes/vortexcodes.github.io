/* Saved data and small helpers.
   Everything is saved in this browser (localStorage). Nothing is sent to a server. */

const STORE_KEY = 'ea-study-v1';
const WALL_KEY = 'ea-study-wallpaper';

function defaultData() {
  return {
    onboarded: false,
    tasks: [],   // { id, title, cls, dueDay 'YYYY-MM-DD', dueTime 'HH:MM', importance 1-3, effort minutes, source 'manual'|'canvas'|'sample', done, doneAt, planDay, url, canvasId, notes }
    events: [],  // { id, title, day, time, kind 'event'|'important', source }
    canvas: { feedUrl: '', lastSync: '', direct: false },
    settings: {
      source: 'both',            // 'both' = Canvas + my own tasks, 'manual' = only my own tasks
      notify: false,
      remind: { dayOf: true, before1: true, before3: false, before7: false },
      remindAt: '16:00',
      pomoWork: 15,
      pomoBreak: 5,
      warnings: true,
      tips: true,
      sound: true,
    },
    look: { wall: 'sunset', theme: 'pink', icon: 'sunny', mode: 'auto' },
    layout: {},
    colors: {},  // class name -> color, handed out in order so classes don't share one
    goal: { type: 'login', level: 'medium' },
    progress: { count: 0, loginDay: '', loginStreak: 0, taskDay: '', taskStreak: 0, credited: {}, goalsDone: 0 },
    pets: [],    // { id, breed, name, shown, got }
    notified: {},
    seen: {},
    timer: null,
  };
}

function mergeDefaults(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return saved === undefined ? base : saved;
  const out = Array.isArray(base) ? [] : { ...base };
  for (const k in saved) {
    out[k] = base && typeof base[k] === 'object' && base[k] !== null && !Array.isArray(base[k])
      ? mergeDefaults(base[k], saved[k])
      : saved[k];
  }
  return out;
}

const Store = {
  data: defaultData(),
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (saved) Store.data = mergeDefaults(defaultData(), saved);
    } catch (e) { /* private window or broken data: start fresh */ }
  },
  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(Store.data)); } catch (e) { /* storage full or blocked */ }
  },
  wallpaper() {
    try { return localStorage.getItem(WALL_KEY) || ''; } catch (e) { return ''; }
  },
  setWallpaper(dataUrl) {
    try {
      if (dataUrl) localStorage.setItem(WALL_KEY, dataUrl); else localStorage.removeItem(WALL_KEY);
      return true;
    } catch (e) { return false; }
  },
  reset() {
    try { localStorage.removeItem(STORE_KEY); localStorage.removeItem(WALL_KEY); } catch (e) {}
    Store.data = defaultData();
  },
};

/* Dates are kept as 'YYYY-MM-DD' day keys in local time, and times as 'HH:MM'. */
const pad = n => String(n).padStart(2, '0');
function dayKey(d = new Date()) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseDay(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(k, n) { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); }
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}
function today() { return dayKey(); }
function fmtTime(t) {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + pad(m) + ' ' + ap;
}
function fmtDay(k, long) {
  return parseDay(k).toLocaleDateString(undefined, long
    ? { weekday: 'long', month: 'long', day: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric' });
}
function weekday(k) { return parseDay(k).toLocaleDateString(undefined, { weekday: 'short' }); }
function relDay(k) {
  const n = daysBetween(today(), k);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return 'Overdue · ' + fmtDay(k);
  if (n < 7) return weekday(k);
  return fmtDay(k);
}
// 'today', 'tomorrow', 'on Tue', 'on Mon, Nov 9': for sentences like "do it ___"
function onDay(k) {
  const r = relDay(k);
  return r === 'Today' || r === 'Tomorrow' ? r.toLowerCase() : 'on ' + r;
}
function fmtMinutes(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
