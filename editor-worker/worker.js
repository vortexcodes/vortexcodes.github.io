// vortex1.dev editor login (Cloudflare Worker).
//
// The site's editor signs in here with a username and password. This worker keeps the GitHub key,
// so it never reaches the browser, and passes the editor's GitHub calls through after checking
// the sign-in. Wrong passwords are counted, and sign-in locks for an hour after too many.
//
// Settings in the Cloudflare dashboard (Worker > Settings > Variables and Secrets / Bindings):
//   GITHUB_TOKEN     secret  fine-grained GitHub key: only vortexcodes.github.io, Contents read and write
//   EDITOR_PASSWORD  secret  the password for signing in
//   LOGINS           KV namespace binding, used to count wrong passwords
// Changing EDITOR_PASSWORD or GITHUB_TOKEN signs out every device.

const USER = 'vortex1';
const REPO = 'vortexcodes/vortexcodes.github.io';
const ORIGINS = ['https://vortex1.dev', 'https://www.vortex1.dev', 'https://vortexcodes.github.io'];
const SESSION_DAYS = 30;
const MAX_FAILS_PER_IP = 5;    // per hour, per address
const MAX_FAILS_TOTAL = 30;    // per hour, everyone together
const WINDOW_SECONDS = 3600;

// The only GitHub calls the editor needs. Anything else is refused.
const ROUTES = [
  ['GET', /^git\/ref\/heads\/main$/],
  ['GET', /^git\/commits\/[0-9a-f]{40}$/],
  ['GET', /^contents\/data\/(projects|log)\.json$/],
  ['POST', /^git\/blobs$/],
  ['POST', /^git\/trees$/],
  ['POST', /^git\/commits$/],
  ['PATCH', /^git\/refs\/heads\/main$/],
];
// Files the editor may write. Site code (HTML, JS, CSS) can't be changed through here.
const WRITABLE = /^(data\/(projects|log)\.json|media\/(work|log)\/[A-Za-z0-9._-]+\.jpg)$/;

const enc = new TextEncoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = !origin || ORIGINS.includes(origin) || origin === env.EXTRA_ORIGIN;
    const cors = origin && allowed ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, X-GitHub-Api-Version',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    } : {};
    const reply = (body, status = 200, extra = {}) => new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors, ...extra } });

    if (!allowed) return reply({ error: 'This site isn\'t allowed to use the editor.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.GITHUB_TOKEN || !env.EDITOR_PASSWORD) return reply({ error: 'The editor login isn\'t set up yet.' }, 503);

    // Strip an optional mount prefix, e.g. vortex1.dev/editor-api/login
    const path = url.pathname.replace(/^\/editor-api/, '').replace(/^\/+/, '');

    if (path === 'login' && request.method === 'POST') return login(request, env, reply);

    const session = await readSession(request, env);
    if (!session) return reply({ error: 'Sign in again.' }, 401);

    if (path === 'session' && request.method === 'GET') return reply({ user: session.u, expires: session.exp });

    if (path.startsWith('gh/')) return proxy(request, env, path.slice(3), url.search, reply);

    return reply({ error: 'Not found.' }, 404);
  },
};

/* ---------- sign-in ---------- */

async function login(request, env, reply) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipKey = 'fail:' + ip, allKey = 'fail:all';
  let ipFails = 0, allFails = 0;
  if (env.LOGINS) {
    [ipFails, allFails] = await Promise.all([env.LOGINS.get(ipKey), env.LOGINS.get(allKey)]).then(v => v.map(n => +n || 0));
  }
  if (ipFails >= MAX_FAILS_PER_IP || allFails >= MAX_FAILS_TOTAL) {
    return reply({ error: 'Too many wrong passwords. Sign-in is locked for up to an hour.' }, 429);
  }

  let body = {};
  try { body = await request.json(); } catch (e) {}
  const okUser = await same(String(body.username || '').trim().toLowerCase(), USER);
  const okPass = await same(String(body.password || ''), env.EDITOR_PASSWORD);

  if (!okUser || !okPass) {
    if (env.LOGINS) {
      try {
        await Promise.all([
          env.LOGINS.put(ipKey, String(ipFails + 1), { expirationTtl: WINDOW_SECONDS }),
          env.LOGINS.put(allKey, String(allFails + 1), { expirationTtl: WINDOW_SECONDS }),
        ]);
      } catch (e) {
        // Can't count the try (e.g. KV write limit reached): refuse sign-ins rather than allow unlimited guesses.
        return reply({ error: 'Sign-in is paused. Try again later.' }, 429);
      }
    }
    await new Promise(r => setTimeout(r, 800));
    return reply({ error: 'Wrong username or password.' }, 401);
  }

  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const payload = b64url(enc.encode(JSON.stringify({ u: USER, exp })));
  const sig = b64url(await hmac(env, payload));
  return reply({ token: payload + '.' + sig, user: USER, expires: exp });
}

async function readSession(request, env) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
  if (!m) return null;
  const good = b64url(await hmac(env, m[1]));
  if (!(await same(good, m[2]))) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(unb64url(m[1])));
    return s.exp > Date.now() / 1000 ? s : null;
  } catch (e) { return null; }
}

// Sessions are signed with a key made from both secrets, so changing either signs everyone out.
async function hmac(env, data) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('vortex1-editor\n' + env.GITHUB_TOKEN + '\n' + env.EDITOR_PASSWORD));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, enc.encode(data));
}

// Constant-time comparison (compares hashes so length doesn't leak).
async function same(a, b) {
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i];
  return d === 0;
}

/* ---------- GitHub pass-through ---------- */

async function proxy(request, env, ghPath, search, reply) {
  const method = request.method;
  if (!ROUTES.some(([m, re]) => m === method && re.test(ghPath))) return reply({ error: 'That GitHub call isn\'t allowed.' }, 403);

  let body;
  if (method !== 'GET') {
    let json;
    try { json = await request.json(); } catch (e) { return reply({ error: 'Bad request.' }, 400); }
    if (ghPath === 'git/trees') {
      const bad = (json.tree || []).find(t => !WRITABLE.test(t.path || '') || t.mode !== '100644' || t.type !== 'blob');
      if (bad) return reply({ error: 'The editor can\'t change ' + (bad.path || 'that file') + '.' }, 403);
    }
    if (ghPath === 'git/refs/heads/main') json.force = false;
    body = JSON.stringify(json);
  }

  const res = await fetch('https://api.github.com/repos/' + REPO + '/' + ghPath + (method === 'GET' ? search : ''), {
    method,
    body,
    headers: {
      'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'Accept': request.headers.get('Accept') || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vortex1-editor',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  // A GitHub 401 means the stored key is bad, not the user's sign-in; report it differently.
  if (res.status === 401) return reply({ error: 'The GitHub key saved in Cloudflare has expired or was revoked.' }, 502);
  return reply(await res.text(), res.status, { 'Content-Type': res.headers.get('Content-Type') || 'application/json' });
}

/* ---------- helpers ---------- */

function b64url(buf) {
  let s = '';
  new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
}
