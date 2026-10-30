// engine.js -- mau5engine's presets, in the language the phone speaks.
//
// This is a port, not a reimplementation, and the difference matters.
// Every function below is a transliteration of the same-named class in
// mau5engine.py, kept in the same order, with the same parameter names
// and defaults, so the two can be read side by side.  test_mau5.py
// renders every preset in both languages at several times and fails if
// any channel differs by more than one count, which is the only thing
// keeping that claim true.
//
// The geometry is not recomputed here.  Helmet's derived arrays --
// nfa, nel, u, px, py and the region masks -- are exported from Python
// by mau5offline.py and read back as typed arrays, so the port cannot
// disagree about where an LED is.  It can only disagree about what
// colour to paint it, which is what the cross-check tests.

'use strict';

(function (root) {

// ----------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function fract(x) { const r = x % 1; return r < 0 ? r + 1 : r; }

// numpy's % on negatives returns a positive remainder; JS's does not.
function pmod(a, b) { const r = a % b; return r < 0 ? r + b : r; }

// One HSV sample -> [r,g,b] in 0..255.  mau5engine.hsv, scalar form.
function hsv(h, s, v) {
  s = s === undefined ? 1 : s;
  v = v === undefined ? 1 : v;
  h = fract(h);
  const i6 = Math.floor(h * 6);
  const f = h * 6 - i6;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const i = pmod(i6, 6);
  let r, g, b;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }
  return [r * 255, g * 255, b * 255];
}

// The one random-ish function the presets share.  Python computes it in
// double precision; so does JS, and Math.sin agrees with libm closely
// enough that the seeds land in the same place.
function hashSin(x) { return fract(Math.sin(x) * 43758.5453); }

// Music drive in 0..1, or a steady default when there is no track.
// Offline there never is one, so every reactive preset falls back to
// the same default its Python twin does rather than sitting still.
function beat(music, t, dflt) {
  if (!music) return dflt === undefined ? 0 : dflt;
  return music.levelAt(t);
}

// Where the harmony sits, as a hue in 0..1 that wraps, and how bright
// the spectrum is.  Both are optional on a music source: a pre-analysed
// track has them, a bare level meter does not, and a preset rendered
// with none at all takes the caller's default.
function pitch(music, t, dflt) {
  if (!music || !music.pitchAt) return dflt === undefined ? 0 : dflt;
  return music.pitchAt(t);
}

function centroid(music, t, dflt) {
  if (!music || !music.centroidAt) return dflt === undefined ? 0.5 : dflt;
  return music.centroidAt(t);
}

// ----------------------------------------------------------------------
// the helmet
// ----------------------------------------------------------------------
// `data` is what mau5offline.py exports: the derived arrays, already
// normalised, plus the region runs.  Nothing is computed from the raw
// positions here, deliberately -- see the note at the top.
function makeHelmet(data) {
  const n = data.n;
  const h = {
    n: n,
    px: data.px, py: data.py, depth: data.depth,
    nx: data.nx, ny: data.ny, nfa: data.nfa, nel: data.nel,
    u: data.u, fa: data.fa, group: data.group, xyz: data.xyz,
    ea: data.ea, er: data.er,
    // ear tube 0..2 and height up it 0..1; -1 on the shell (mau5engine)
    tube: data.tube || new Int16Array(n).fill(-1),
    along: data.along || new Float32Array(n).fill(-1),
  };
  const mk = () => new Uint8Array(n);
  h.shell = mk(); h.ear1 = mk(); h.ear2 = mk();
  h.tubes = mk(); h.rims = mk(); h.ears = mk();
  for (const [lo, hi, name] of data.regions) {
    for (let i = lo; i <= hi; i++) {
      if (name === 'shell') h.shell[i] = 1;
      if (name.startsWith('ear1')) { h.ear1[i] = 1; h.ears[i] = 1; }
      if (name.startsWith('ear2')) { h.ear2[i] = 1; h.ears[i] = 1; }
      if (name.endsWith('tubes')) h.tubes[i] = 1;
      if (name.endsWith('rim')) h.rims[i] = 1;
    }
  }
  h.mask = function (names) {
    const m = new Uint8Array(n);
    for (const nm of names) {
      const src = h[nm];
      if (!src) continue;
      for (let i = 0; i < n; i++) if (src[i]) m[i] = 1;
    }
    return m;
  };
  h.axis = function (name) {
    return { fa: h.nfa, el: h.nel, x: h.nx, y: h.ny, u: h.u }[name];
  };
  return h;
}

// ----------------------------------------------------------------------
// glyphs
// ----------------------------------------------------------------------
// FONT5x7 and SPRITES come over in the data bundle; the rasterising and
// the gather/scatter are the parts that have to agree with Python.

function textBitmap(fonts, text, spacing) {
  spacing = spacing === undefined ? 1 : spacing;
  const cols = [];
  for (const ch of text.toUpperCase()) {
    const g = fonts.font[ch] || fonts.font['?'] || [0, 0, 0, 0, 0];
    for (const c of g) {
      const col = [];
      for (let r = 0; r < 7; r++) col.push((c >> r) & 1);
      cols.push(col);
    }
    for (let k = 0; k < spacing; k++) cols.push([0, 0, 0, 0, 0, 0, 0]);
  }
  if (!cols.length) cols.push([0, 0, 0, 0, 0, 0, 0]);
  // (7, w), transposed out of the column list, as numpy does
  const w = cols.length;
  const bm = { rows: 7, cols: w, d: new Uint8Array(7 * w) };
  for (let c = 0; c < w; c++)
    for (let r = 0; r < 7; r++) bm.d[r * w + c] = cols[c][r];
  return bm;
}

function glyphBitmap(fonts, ch) {
  const g = fonts.font[ch.toUpperCase()] || fonts.font['?'] || [0, 0, 0, 0, 0];
  const bm = { rows: 7, cols: 5, d: new Uint8Array(35) };
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 5; c++) bm.d[r * 5 + c] = (g[c] >> r) & 1;
  return bm;
}

function digitBitmap(fonts, ch) {
  const rows = fonts.digit3x5[ch] || fonts.digit3x5['0'];
  const bm = { rows: rows.length, cols: rows[0].length,
               d: new Uint8Array(rows.length * rows[0].length) };
  for (let r = 0; r < bm.rows; r++)
    for (let c = 0; c < bm.cols; c++) bm.d[r * bm.cols + c] = rows[r][c] !== ' ' ? 1 : 0;
  return bm;
}

function spriteBitmap(fonts, name) {
  const rows = fonts.sprites[name];
  const bm = { rows: rows.length, cols: rows[0].length,
               d: new Uint8Array(rows.length * rows[0].length) };
  for (let r = 0; r < bm.rows; r++)
    for (let c = 0; c < bm.cols; c++) bm.d[r * bm.cols + c] = rows[r][c] !== '.' ? 1 : 0;
  return bm;
}

// Draw a bitmap onto the LEDs, by gather and by scatter.  The comment
// in mau5engine.paint explains why both halves are needed; this is the
// same algorithm, including the order the scatter resolves ties in --
// argmin takes the first minimum, so the loop below uses a strict <.
function paint(bm, rowf, colf, mask, n, wrap, reach, rowW) {
  reach = reach === undefined ? 1.4 : reach;
  rowW = rowW === undefined ? 1.0 : rowW;
  const rows = bm.rows, cols = bm.cols;
  const lit = new Uint8Array(n);
  const idx = [];
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    if (!(rowf[i] >= 0 && rowf[i] < rows)) continue;
    if (!wrap && !(colf[i] >= 0 && colf[i] < cols)) continue;
    idx.push(i);
  }
  if (!idx.length) return lit;

  const occupied = new Uint8Array(rows * cols);
  for (const i of idx) {
    const r = Math.floor(rowf[i]);
    const c = wrap ? pmod(Math.floor(colf[i]), cols) : Math.floor(colf[i]);
    lit[i] = bm.d[r * cols + c];
    occupied[r * cols + c] = 1;
  }

  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (!bm.d[rr * cols + cc] || occupied[rr * cols + cc]) continue;
      let best = Infinity, who = -1;
      for (const i of idx) {
        const lr = rowf[i];
        const lc = wrap ? pmod(colf[i], cols) : colf[i];
        const dr = (lr - (rr + 0.5)) * rowW, dc = lc - (cc + 0.5);
        const d = Math.hypot(dr, dc);
        if (d < best) { best = d; who = i; }
      }
      if (who >= 0 && best <= reach) lit[who] = 1;
    }
  }
  return lit;
}

// ----------------------------------------------------------------------
// the library
// ----------------------------------------------------------------------
const REGISTRY = {};

// Every preset is {name, params, render(h, t, music, out)} where `out`
// is a Float32Array(n*3) the caller owns.  Writing into a buffer rather
// than allocating one keeps the phone from collecting garbage 25 times
// a second, which shows up as dropped frames and nothing else.
function def(name, params, render, init) {
  REGISTRY[name] = { name: name, params: params, render: render, init: init };
}

function fill(out, n, rgb, k) {
  k = k === undefined ? 1 : k;
  for (let i = 0; i < n; i++) {
    out[i * 3] = rgb[0] * k; out[i * 3 + 1] = rgb[1] * k; out[i * 3 + 2] = rgb[2] * k;
  }
}

function zero(out) { out.fill(0); }

def('solid', { color: [255, 40, 0], parts: ['shell', 'ears'] },
  function (h, t, music, out) {
    zero(out);
    const m = h.mask(this.p.parts);
    const c = this.p.color;
    for (let i = 0; i < h.n; i++) if (m[i]) {
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

def('breathe', { color: [255, 60, 0], period: 6.0, floor: 0.12 },
  function (h, t, music, out) {
    const f = this.p.floor;
    const k = f + (1 - f) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / this.p.period));
    fill(out, h.n, this.p.color, k);
  });

def('rainbow', { period: 8.0, wrap: 1.0, axis: 'fa', sat: 1.0 },
  function (h, t, music, out) {
    const a = h.axis(this.p.axis), w = this.p.wrap, s = this.p.sat;
    const off = t / this.p.period;
    for (let i = 0; i < h.n; i++) {
      const c = hsv(a[i] * w - off, s, 1.0);
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

def('scanner', { color: [0, 220, 255], period: 2.4, width: 0.22, bounce: true },
  function (h, t, music, out) {
    const ph = fract(t / this.p.period);
    const pos = this.p.bounce ? (1 - Math.abs(2 * ph - 1)) : ph;
    const c = this.p.color, w = this.p.width;
    for (let i = 0; i < h.n; i++) {
      const d = Math.abs(h.nfa[i] - pos);
      let k = clamp(1 - d / w, 0, 1); k *= k;
      out[i * 3] = k * c[0]; out[i * 3 + 1] = k * c[1]; out[i * 3 + 2] = k * c[2];
    }
  });

def('wipe', { a: [255, 0, 80], b: [0, 60, 255], period: 4.0, axis: 'el', soft: 0.12 },
  function (h, t, music, out) {
    const v = h.axis(this.p.axis), edge = fract(t / this.p.period);
    const A = this.p.a, B = this.p.b, s = this.p.soft;
    for (let i = 0; i < h.n; i++) {
      const k = clamp((v[i] - edge) / s + 0.5, 0, 1);
      out[i * 3] = k * B[0] + (1 - k) * A[0];
      out[i * 3 + 1] = k * B[1] + (1 - k) * A[1];
      out[i * 3 + 2] = k * B[2] + (1 - k) * A[2];
    }
  });

def('strobe', { color: [255, 255, 255], hz: 8.0, duty: 0.18 },
  function (h, t, music, out) {
    const on = fract(t * this.p.hz) < this.p.duty;
    fill(out, h.n, this.p.color, on ? 1 : 0);
  });

def('twinkle', { color: [255, 230, 180], density: 0.18, period: 2.2 },
  function (h, t, music, out) {
    const c = this.p.color, dens = this.p.density, per = this.p.period;
    for (let i = 0; i < h.n; i++) {
      const seed = hashSin(i * 12.9898);
      const ph = fract(t / per + seed);
      let k = Math.pow(Math.sin(ph * Math.PI), 8);
      k = clamp(k, 0, 1);
      if (!(seed < dens + 0.5 * (1 - dens))) k = 0;
      out[i * 3] = k * c[0]; out[i * 3 + 1] = k * c[1]; out[i * 3 + 2] = k * c[2];
    }
  });

def('comet', { color: [255, 120, 0], period: 3.0, tail: 0.16 },
  function (h, t, music, out) {
    const head = fract(t / this.p.period), c = this.p.color, tail = this.p.tail;
    for (let i = 0; i < h.n; i++) {
      const d = pmod(head - i / h.n, 1.0);
      const k = Math.exp(-d / tail);
      out[i * 3] = k * c[0]; out[i * 3 + 1] = k * c[1]; out[i * 3 + 2] = k * c[2];
    }
  });

def('ripple', { color: [0, 200, 255], period: 2.6, width: 0.14,
                origin: [0.0, 40.0, 173.0] },
  function (h, t, music, out) {
    const o = this.p.origin, c = this.p.color, w = this.p.width;
    const r = new Float64Array(h.n);
    let rmax = 0;
    for (let i = 0; i < h.n; i++) {
      const dx = h.xyz[i * 3] - o[0], dy = h.xyz[i * 3 + 1] - o[1],
            dz = h.xyz[i * 3 + 2] - o[2];
      r[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (r[i] > rmax) rmax = r[i];
    }
    const ph = fract(t / this.p.period);
    for (let i = 0; i < h.n; i++) {
      let k = clamp(1 - Math.abs(r[i] / (rmax || 1) - ph) / w, 0, 1); k *= k;
      out[i * 3] = k * c[0]; out[i * 3 + 1] = k * c[1]; out[i * 3 + 2] = k * c[2];
    }
  });

def('plasma', { speed: 0.35, scale: 2.4, sat: 0.95 },
  function (h, t, music, out) {
    const s = this.p.scale, sp = this.p.speed, sat = this.p.sat;
    for (let i = 0; i < h.n; i++) {
      const v = Math.sin(h.nfa[i] * s * Math.PI + t * sp * 2)
              + Math.sin(h.nel[i] * s * Math.PI * 1.3 - t * sp * 1.7)
              + Math.sin((h.nfa[i] + h.nel[i]) * s * Math.PI * 0.8 + t * sp);
      const c = hsv(v / 6.0 + 0.5, sat, 1.0);
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

def('fire', { speed: 1.1, cool: 0.55 },
  function (h, t, music, out) {
    const sp = this.p.speed, cool = this.p.cool;
    for (let i = 0; i < h.n; i++) {
      const n1 = Math.sin(h.nfa[i] * 11.0 + t * sp * 3.1 + i * 0.07);
      const n2 = Math.sin(h.nel[i] * 7.0 - t * sp * 2.3);
      let heat = clamp(0.5 + 0.5 * (n1 * 0.6 + n2 * 0.4), 0, 1);
      heat *= clamp(1.15 - h.nel[i] * cool, 0, 1.15);
      out[i * 3] = clamp(heat * 2.2, 0, 1) * 255;
      out[i * 3 + 1] = clamp(heat * 1.4 - 0.35, 0, 1) * 255;
      out[i * 3 + 2] = clamp(heat * 1.2 - 0.85, 0, 1) * 255;
    }
  });

def('earspin', { color: [255, 0, 160], bed: [20, 0, 40], period: 1.6, width: 0.22 },
  function (h, t, music, out) {
    fill(out, h.n, this.p.bed);
    const ph = fract(t / this.p.period), c = this.p.color, w = this.p.width;
    for (let i = 0; i < h.n; i++) {
      if (!(h.rims[i] && (h.ear1[i] || h.ear2[i]))) continue;
      const d = Math.abs(pmod(h.u[i] - ph + 0.5, 1.0) - 0.5);
      let k = clamp(1 - d / w, 0, 1); k *= k;
      out[i * 3] = k * c[0]; out[i * 3 + 1] = k * c[1]; out[i * 3 + 2] = k * c[2];
    }
  });

def('tubepulse', { color: [0, 255, 200], period: 1.2, shell: [0, 12, 18] },
  function (h, t, music, out) {
    fill(out, h.n, this.p.shell);
    const k = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / this.p.period);
    const c = this.p.color, g = 0.25 + 0.75 * k;
    for (let i = 0; i < h.n; i++) if (h.tubes[i]) {
      out[i * 3] = c[0] * g; out[i * 3 + 1] = c[1] * g; out[i * 3 + 2] = c[2] * g;
    }
  });

def('police', { hz: 2.5 },
  function (h, t, music, out) {
    const on = Math.trunc(t * this.p.hz) % 2;
    zero(out);
    for (let i = 0; i < h.n; i++) {
      if (h.fa[i] < 0) { if (on) out[i * 3] = 255; }
      else if (!on) out[i * 3 + 2] = 255;
    }
  });

def('eq', { bands: 12, lo: [0, 80, 255], hi: [255, 0, 120] },
  function (h, t, music, out) {
    const nb = this.p.bands, LO = this.p.lo, HI = this.p.hi;
    const amp = new Float64Array(nb);
    if (music && music.bandsAt) {
      const a = music.bandsAt(t, nb);
      for (let b = 0; b < nb; b++) amp[b] = a[b];
    } else {
      for (let b = 0; b < nb; b++) amp[b] = 0.5 + 0.5 * Math.sin(t * 2.0 + b * 0.9);
    }
    for (let i = 0; i < h.n; i++) {
      const band = clamp(Math.trunc(h.nfa[i] * nb), 0, nb - 1);
      const e = h.nel[i];
      const k = e <= amp[band] ? 1 : 0;
      out[i * 3] = k * (LO[0] * (1 - e) + HI[0] * e);
      out[i * 3 + 1] = k * (LO[1] * (1 - e) + HI[1] * e);
      out[i * 3 + 2] = k * (LO[2] * (1 - e) + HI[2] * e);
    }
  });

def('beatpulse', { color: [255, 30, 0], floor: 0.10 },
  function (h, t, music, out) {
    const f = this.p.floor;
    fill(out, h.n, this.p.color, f + (1 - f) * beat(music, t, 0.5));
  });

def('text', { text: 'DEADMAU5', color: [255, 160, 0], bg: [0, 0, 0],
              speed: 70.0, y_lo: 28.0, y_hi: 145.0, cell: 16.7,
              loop: true, gap: 6 },
  function (h, t, music, out) {
    let bm = textBitmap(this.fonts, this.p.text, 1);
    if (this.p.loop) {
      const w = bm.cols + this.p.gap;
      const d = new Uint8Array(bm.rows * w);
      for (let r = 0; r < bm.rows; r++)
        for (let c = 0; c < bm.cols; c++) d[r * w + c] = bm.d[r * bm.cols + c];
      bm = { rows: bm.rows, cols: w, d: d };
    }
    fill(out, h.n, this.p.bg);
    const hi = this.p.y_hi, lo = this.p.y_lo, rows = bm.rows;
    const ry = new Float64Array(h.n), rx = new Float64Array(h.n);
    const mask = new Uint8Array(h.n);
    for (let i = 0; i < h.n; i++) {
      ry[i] = (hi - h.py[i]) / Math.max(hi - lo, 1e-6) * rows;
      rx[i] = h.px[i] / this.p.cell + t * this.p.speed / this.p.cell;
      mask[i] = h.shell[i] && h.py[i] > 0 ? 1 : 0;
    }
    const lit = paint(bm, ry, rx, mask, h.n, this.p.loop ? bm.cols : 0);
    const c = this.p.color;
    for (let i = 0; i < h.n; i++) if (lit[i]) {
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

def('sprite', { sprite: 'smile', color: [0, 255, 255], bg: [0, 0, 0],
                y_lo: 20.0, y_hi: 160.0, x_half: 150.0, blink: 0.0 },
  function (h, t, music, out) {
    const bm = spriteBitmap(this.fonts, this.p.sprite);
    fill(out, h.n, this.p.bg);
    if (this.p.blink && fract(t * this.p.blink) > 0.5) return;
    const hi = this.p.y_hi, lo = this.p.y_lo, xh = this.p.x_half;
    const ry = new Float64Array(h.n), rx = new Float64Array(h.n);
    const mask = new Uint8Array(h.n);
    for (let i = 0; i < h.n; i++) {
      ry[i] = (hi - h.py[i]) / Math.max(hi - lo, 1e-6) * bm.rows;
      rx[i] = (h.px[i] + xh) / (2 * xh) * bm.cols;
      mask[i] = h.shell[i] && h.py[i] > 0 ? 1 : 0;
    }
    const lit = paint(bm, ry, rx, mask, h.n, 0);
    const c = this.p.color;
    for (let i = 0; i < h.n; i++) if (lit[i]) {
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

def('eyes', { color: [0, 255, 255], period: 5.0, size: 58.0, y: 95.0,
              spread: 78.0, blink_every: 4.0 },
  function (h, t, music, out) {
    zero(out);
    const look = Math.sin(2 * Math.PI * t / this.p.period) * 30.0;
    const blink = pmod(t, this.p.blink_every) < 0.18;
    const c = this.p.color, size = this.p.size, yy = this.p.y;
    for (const side of [-1, 1]) {
      const cx = side * this.p.spread + look;
      for (let i = 0; i < h.n; i++) {
        const d = Math.hypot(h.px[i] - cx, (h.py[i] - yy) * 1.25);
        let k = Math.pow(clamp(1 - d / size, 0, 1), 0.6);
        if (blink) k *= clamp(1 - Math.abs(h.py[i] - yy) / 10.0, 0, 1);
        out[i * 3] += k * c[0]; out[i * 3 + 1] += k * c[1]; out[i * 3 + 2] += k * c[2];
      }
    }
    for (let i = 0; i < h.n; i++) {
      if (!h.shell[i]) { out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = 0; continue; }
      for (let k = 0; k < 3; k++) out[i * 3 + k] = clamp(out[i * 3 + k], 0, 255);
    }
  });

def('matrix', { color: [0, 255, 70], columns: 24, speed: 0.55, tail: 0.30 },
  function (h, t, music, out) {
    const c = this.p.color, tail = this.p.tail, n = h.n;
    const col = new Int32Array(n);
    let strips = false;
    for (let i = 0; i < n; i++) {
      col[i] = h.shell[i] ? h.group[i] : -1;
      if (h.shell[i] && h.group[i] >= 0) strips = true;
    }
    if (!strips) {                                  // no strips: azimuth bins
      const nb = Math.trunc(this.p.columns);
      for (let i = 0; i < n; i++)
        col[i] = h.shell[i] ? clamp(Math.trunc(h.nfa[i] * nb), 0, nb - 1) : -1;
    }
    let first = -1;
    for (let i = 0; i < n; i++) if (col[i] > first) first = col[i];
    first += 1;                                     // ear tubes after the strips
    const pos = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (h.tube[i] >= 0) {
        col[i] = first + h.tube[i] + 3 * (h.ear2[i] ? 1 : 0);
        pos[i] = 1.0 - h.along[i];
      } else {
        pos[i] = 1.0 - h.nel[i];                    // 0 at the top
      }
    }
    let nc = 0;
    for (let i = 0; i < n; i++) if (col[i] + 1 > nc) nc = col[i] + 1;
    const head = new Float64Array(nc);
    for (let b = 0; b < nc; b++) {
      const seed = hashSin(b * 78.233);
      head[b] = pmod(t * this.p.speed * (0.6 + seed) + seed, 1.4) - 0.2;
    }
    for (let i = 0; i < n; i++) {
      let k = 0;
      if (col[i] >= 0) {
        const d = head[col[i]] - pos[i];
        if (d >= 0) k = Math.exp(-d / tail);
      }
      if (h.rims[i]) k = 0.08;
      out[i * 3] = k * c[0]; out[i * 3 + 1] = k * c[1]; out[i * 3 + 2] = k * c[2];
    }
  });

def('spiral', { period: 3.0, arms: 3, sat: 1.0, tight: 1.6 },
  function (h, t, music, out) {
    const off = t / this.p.period, arms = this.p.arms, tight = this.p.tight;
    for (let i = 0; i < h.n; i++) {
      const ang = Math.atan2(h.py[i] - 30.0, h.px[i]) / (2 * Math.PI);
      const rad = Math.hypot(h.px[i], h.py[i] - 30.0) / 260.0;
      const c = hsv(ang * arms + rad * tight - off, this.p.sat, 1.0);
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

def('pinwheel', { period: 2.0, sectors: 6, color: [255, 255, 255], bg: [0, 0, 0] },
  function (h, t, music, out) {
    fill(out, h.n, this.p.bg);
    const off = t / this.p.period, c = this.p.color, sec = this.p.sectors;
    for (let i = 0; i < h.n; i++) {
      const ang = pmod(Math.atan2(h.py[i] - 30.0, h.px[i]) / (2 * Math.PI) - off, 1.0);
      if (pmod(ang * sec, 1.0) < 0.5) {
        out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
      }
    }
  });

def('heartbeat', { color: [255, 0, 40], bpm: 62.0, floor: 0.06 },
  function (h, t, music, out) {
    const ph = fract(t * this.p.bpm / 60.0);
    let k = 0;
    for (const [at, amp] of [[0.00, 1.0], [0.18, 0.62]]) {
      const d = ph - at;
      if (d >= 0 && d < 0.14) k = Math.max(k, amp * Math.exp(-d / 0.045));
    }
    const f = this.p.floor;
    fill(out, h.n, this.p.color, f + (1 - f) * k);
  });

def('confetti', { rate: 14.0, fade: 0.55, sat: 0.9 },
  function (h, t, music, out) {
    zero(out);
    const step = 1.0 / Math.max(this.p.rate, 0.1);
    const k0 = Math.trunc(t / step);
    for (let back = 0; back < 6; back++) {
      const kk = k0 - back;
      if (kk < 0) continue;
      const r = hashSin(kk * 91.7);
      const who = Math.trunc(r * h.n);
      const amp = Math.exp(-(t - kk * step) / this.p.fade);
      if (amp < 0.01) continue;
      const col = hsv(r, this.p.sat, 1.0);
      const lo = Math.max(0, who - 2), hi = Math.min(h.n, who + 3);
      for (let i = lo; i < hi; i++)
        for (let c = 0; c < 3; c++)
          out[i * 3 + c] = Math.max(out[i * 3 + c], col[c] * amp);
    }
  });

def('lightning', { color: [210, 225, 255], every: 3.2, bed: [0, 0, 6] },
  function (h, t, music, out) {
    fill(out, h.n, this.p.bed);
    const ph = pmod(t, this.p.every);
    let k = 0;
    for (const [at, amp] of [[0.0, 1.0], [0.11, 0.55], [0.17, 0.8]]) {
      const d = ph - at;
      if (d >= 0 && d < 0.09) k = Math.max(k, amp * (1 - d / 0.09));
    }
    if (k > 0) {
      const seed = Math.trunc(t / this.p.every);
      const side = fract(Math.sin(seed * 12.9) * 43758.5);
      const c = this.p.color;
      for (let i = 0; i < h.n; i++) {
        if (h.nfa[i] > side - 0.42 && h.nfa[i] < side + 0.42) {
          out[i * 3] = c[0] * k; out[i * 3 + 1] = c[1] * k; out[i * 3 + 2] = c[2] * k;
        }
      }
    }
  });

def('wave', { color: [0, 160, 255], period: 2.2, length: 0.55, axis: 'fa', floor: 0.0 },
  function (h, t, music, out) {
    const a = h.axis(this.p.axis), c = this.p.color, f = this.p.floor;
    const len = this.p.length, off = t / this.p.period;
    for (let i = 0; i < h.n; i++) {
      const v = Math.sin(2 * Math.PI * (a[i] / len - off));
      const k = clamp(f + (1 - f) * (0.5 + 0.5 * v), 0, 1);
      out[i * 3] = k * c[0]; out[i * 3 + 1] = k * c[1]; out[i * 3 + 2] = k * c[2];
    }
  });

def('gradient', { a: [255, 0, 90], b: [0, 120, 255], axis: 'el', period: 0.0 },
  function (h, t, music, out) {
    const src = h.axis(this.p.axis), A = this.p.a, B = this.p.b;
    const off = this.p.period ? t / this.p.period : 0;
    for (let i = 0; i < h.n; i++) {
      const v = this.p.period ? fract(src[i] + off) : src[i];
      out[i * 3] = v * B[0] + (1 - v) * A[0];
      out[i * 3 + 1] = v * B[1] + (1 - v) * A[1];
      out[i * 3 + 2] = v * B[2] + (1 - v) * A[2];
    }
  });

def('chase', { color: [255, 200, 0], period: 1.4, width: 0.22, reverse: false },
  function (h, t, music, out) {
    const ph = fract(t / this.p.period), c = this.p.color, w = this.p.width;
    for (let i = 0; i < h.n; i++) {
      const u = this.p.reverse ? 1.0 - h.u[i] : h.u[i];
      const d = Math.abs(pmod(u - ph + 0.5, 1.0) - 0.5);
      let k = clamp(1 - d / w, 0, 1); k *= k;
      out[i * 3] = k * c[0]; out[i * 3 + 1] = k * c[1]; out[i * 3 + 2] = k * c[2];
    }
  });

def('vu', { lo: [0, 255, 80], hi: [255, 30, 0], peak: true, decay: 1.6 },
  function (h, t, music, out) {
    const lvl = beat(music, t, 0.5 + 0.5 * Math.sin(t * 2.3));
    if (this.s.last === null || t < this.s.last) this.s.peak = lvl;
    else this.s.peak = Math.max(lvl, this.s.peak - (t - this.s.last) / this.p.decay);
    this.s.last = t;
    const LO = this.p.lo, HI = this.p.hi;
    for (let i = 0; i < h.n; i++) {
      const e = h.nel[i], on = e <= lvl ? 1 : 0;
      out[i * 3] = on * (LO[0] * (1 - e) + HI[0] * e);
      out[i * 3 + 1] = on * (LO[1] * (1 - e) + HI[1] * e);
      out[i * 3 + 2] = on * (LO[2] * (1 - e) + HI[2] * e);
      if (this.p.peak && Math.abs(e - this.s.peak) < 0.035) {
        out[i * 3] = 255; out[i * 3 + 1] = 255; out[i * 3 + 2] = 255;
      }
    }
  }, function () { return { peak: 0.0, last: null }; });

def('sparkle', { bed: [40, 0, 60], glitter: [255, 255, 255], density: 0.10, rate: 7.0 },
  function (h, t, music, out) {
    fill(out, h.n, this.p.bed);
    const drive = beat(music, t, 1.0);
    const k = Math.trunc(t * this.p.rate);
    const thr = this.p.density * (0.35 + 0.65 * drive), g = this.p.glitter;
    for (let i = 0; i < h.n; i++) {
      if (hashSin(i * 12.9898 + k * 7.13) < thr) {
        out[i * 3] = g[0]; out[i * 3 + 1] = g[1]; out[i * 3 + 2] = g[2];
      }
    }
  });

def('countdown', { from: 5, step: 1.0, color: [255, 40, 0], flash: [255, 255, 255],
                   y_hi: 168.0, y_lo: 40.0, x_half: 95.0, loop: 2.0, face: '5x7' },
  function (h, t, music, out) {
    const span = this.p.from * this.p.step + 0.8;
    if (this.p.loop > 0) t = pmod(t, span + this.p.loop);
    const n = Math.trunc(this.p.from) - Math.trunc(t / this.p.step);
    if (n <= 0) {
      const k = Math.max(0.0, 1.0 - (t - this.p.from * this.p.step) / 0.8);
      fill(out, h.n, this.p.flash, k);
      return;
    }
    const ch = String(n).slice(-1);
    const bm = this.p.face === '5x7' ? glyphBitmap(this.fonts, ch)
                                     : digitBitmap(this.fonts, ch);
    zero(out);
    const hi = this.p.y_hi, lo = this.p.y_lo, xh = this.p.x_half;
    const ry = new Float64Array(h.n), rx = new Float64Array(h.n);
    const mask = new Uint8Array(h.n);
    for (let i = 0; i < h.n; i++) {
      ry[i] = (hi - h.py[i]) / Math.max(hi - lo, 1e-6) * bm.rows;
      rx[i] = (h.px[i] + xh) / (2.0 * xh) * bm.cols;
      mask[i] = h.shell[i] && h.py[i] > 0 ? 1 : 0;
    }
    const lit = paint(bm, ry, rx, mask, h.n, 0);
    const c = this.p.color;
    for (let i = 0; i < h.n; i++) if (lit[i]) {
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

def('split', { shell: 'plasma', ears: 'chase',
               shell_color: [255, 60, 0], ear_color: [0, 220, 255] },
  function (h, t, music, out) {
    zero(out);
    const a = this.s.a, b = this.s.b;
    a.render(h, t, music, this.s.buf);
    for (let i = 0; i < h.n; i++) if (h.shell[i])
      for (let c = 0; c < 3; c++) out[i * 3 + c] = this.s.buf[i * 3 + c];
    b.render(h, t, music, this.s.buf);
    for (let i = 0; i < h.n; i++) if (h.ears[i])
      for (let c = 0; c < 3; c++) out[i * 3 + c] = this.s.buf[i * 3 + c];
  },
  function (h, p, fonts) {
    return { a: make(p.shell, accepts(p.shell, { color: p.shell_color }), h, fonts),
             b: make(p.ears, accepts(p.ears, { color: p.ear_color }), h, fonts),
             buf: new Float32Array(h.n * 3) };
  });

def('alignbar', { axis: 'y', period: 14.0, thickness: 14.0,
                  color: [255, 255, 255], edge: [255, 0, 0],
                  bounce: true, hold: 0.0, grid: 0.0, grid_color: [0, 40, 80] },
  function (h, t, music, out) {
    const v = { y: h.py, x: h.px, z: h.depth }[this.p.axis];
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < h.n; i++) { if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i]; }
    let pos;
    if (this.p.hold) pos = lo + (hi - lo) * this.p.hold;
    else {
      let ph = fract(t / this.p.period);
      if (this.p.bounce) ph = 1.0 - Math.abs(2 * ph - 1);
      pos = lo + (hi - lo) * ph;
    }
    zero(out);
    const half = this.p.thickness / 2.0;
    const C = this.p.color, E = this.p.edge, G = this.p.grid_color, g = this.p.grid;
    for (let i = 0; i < h.n; i++) {
      if (g && Math.abs(v[i] / g - Math.round(v[i] / g)) * g < 1.2) {
        out[i * 3] = G[0]; out[i * 3 + 1] = G[1]; out[i * 3 + 2] = G[2];
      }
      const d = Math.abs(v[i] - pos);
      if (d <= half) {
        const c = d > half * 0.62 ? E : C;
        out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
      }
    }
  });

def('stripid', { sat: 1.0, value: 1.0, cycle: 7 },
  function (h, t, music, out) {
    const cyc = this.p.cycle;
    for (let i = 0; i < h.n; i++) {
      const g = h.group[i] >= 0 ? h.group[i] : 68 + (i % 4);
      const c = hsv(pmod(g, cyc) / cyc, this.p.sat, this.p.value);
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

// ----------------------------------------------------------------------
// construction
// ----------------------------------------------------------------------
// Preset.accepts: filter a loose dict down to what a preset takes, and
// redirect a colour offered to a preset that spells it differently.
function accepts(name, kw) {
  const spec = REGISTRY[name];
  if (!spec) return {};
  const out = {};
  for (const k of Object.keys(kw || {})) {
    if (k in spec.params) out[k] = kw[k];
    else if (k === 'color') {
      for (const alt of ['a', 'lo', 'color'])
        if (alt in spec.params && !(alt in out)) { out[alt] = kw[k]; break; }
    }
  }
  return out;
}

function make(name, params, h, fonts) {
  const spec = REGISTRY[name];
  if (!spec) throw new Error('no preset ' + name);
  const p = Object.assign({}, spec.params);
  for (const k of Object.keys(params || {})) {
    if (!(k in p)) throw new Error(name + ' has no parameter ' + k);
    p[k] = params[k];
  }
  const inst = { name: name, p: p, fonts: fonts, s: null };
  inst.s = spec.init ? spec.init(h, p, fonts) : null;
  inst.render = spec.render;
  return inst;
}


// ----------------------------------------------------------------------
// Listening presets.  Ports of Spectrum, PitchWheel and Bloom; see the
// note above them in mau5engine.py for what each one is showing.
// ----------------------------------------------------------------------

def('spectrum', { bands: 16, spread: 0.30, cap: 0.055, fall: 0.75, tilt: 0.45, sat: 1.0 },
  function (h, t, music, out) {
    const nb = Math.max(1, Math.trunc(this.p.bands));
    const amp = new Float64Array(nb);
    if (music && music.bands) {
      const a = music.bandsAt(t, nb);
      for (let b = 0; b < nb; b++) amp[b] = clamp(a[b], 0, 1);
    } else {
      for (let b = 0; b < nb; b++) amp[b] = 0.5 + 0.45 * Math.sin(t * 2.1 + b * 0.7);
    }
    let hold = this.s.hold;
    if (!hold || hold.length !== nb || this.s.last === null || t < this.s.last) {
      hold = this.s.hold = Float64Array.from(amp);
    } else {
      const d = this.p.fall * (t - this.s.last);
      for (let b = 0; b < nb; b++) hold[b] = Math.max(amp[b], hold[b] - d);
    }
    this.s.last = t;
    const hue0 = pitch(music, t, fract(t * 0.11));
    const tilt = this.p.tilt, sat = this.p.sat, cap = this.p.cap;
    for (let i = 0; i < h.n; i++) {
      const nfa = h.nfa[i], nel = h.nel[i];
      let b = Math.trunc(nfa * nb);
      if (b < 0) b = 0; else if (b > nb - 1) b = nb - 1;
      const lvl = amp[b];
      const v = nel <= lvl ? tilt + (1 - tilt) * nel / Math.max(lvl, 1e-3) : 0;
      if (Math.abs(nel - hold[b]) <= cap) {
        out[i * 3] = 255; out[i * 3 + 1] = 255; out[i * 3 + 2] = 255;
      } else {
        const c = hsv(hue0 + nfa * this.p.spread, sat, clamp(v, 0, 1));
        out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
      }
    }
  }, function () { return { hold: null, last: null }; });

def('pitchwheel', { width: 0.085, shellmix: 0.22, sat: 1.0, floor: 0.10 },
  function (h, t, music, out) {
    const pc = pitch(music, t, fract(t * 0.11));
    const lvl = this.p.floor + (1 - this.p.floor)
      * beat(music, t, 0.55 + 0.45 * Math.sin(t * 1.7));
    for (let i = 0; i < h.n; i++) {
      const d = Math.abs(pmod(h.ea[i] - pc + 0.5, 1) - 0.5);
      const k = clamp(1 - d / this.p.width, 0, 1);
      const v = clamp((h.shell[i] ? this.p.shellmix : k * k) * lvl, 0, 1);
      const c = hsv(pc, this.p.sat, v);
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

def('bloom', { rings: 2, width: 0.20, span: 0.35, sat: 1.0, floor: 0.05 },
  function (h, t, music, out) {
    const ph = music ? music.beatPhase(t) : fract(t * 1.4);
    const lvl = beat(music, t, 0.5 + 0.5 * Math.sin(t * 2.0));
    const hue = pitch(music, t, fract(t * 0.11))
      + this.p.span * centroid(music, t, 0.5);
    const nr = Math.max(1, Math.trunc(this.p.rings));
    const base = this.p.floor + (1 - this.p.floor) * lvl;
    for (let i = 0; i < h.n; i++) {
      let k = 0;
      for (let j = 0; j < nr; j++) {
        const r = pmod(ph + j / nr, 1);
        const q = clamp(1 - Math.abs(h.er[i] - r) / this.p.width, 0, 1);
        if (q * q > k) k = q * q;
      }
      const c = hsv(hue, this.p.sat, clamp(base * k, 0, 1));
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
    }
  });

def('blades', { color: [0, 170, 255], tip: [255, 255, 255], bed: [0, 8, 18],
                period: 1.935, rise: 0.35, keep: 0.18 },
  function (h, t, music, out) {
    const c = this.p.color, tip = this.p.tip, bed = this.p.bed;
    const rise = this.p.rise, keep = this.p.keep;
    const cyc = pmod(t / this.p.period, 1.0) * 4.0;
    const slot = Math.trunc(cyc), p = cyc - slot;
    fill(out, h.n, bed);
    if (slot < 3) {
      const front = Math.min(p / rise, 1.0);
      const level = 1.0 - (1.0 - keep) * Math.min(Math.max((p - rise) / (1.0 - rise), 0.0), 1.0);
      for (let i = 0; i < h.n; i++) {
        const tb = h.tube[i];
        if (tb >= 0 && tb < slot) {
          for (let k = 0; k < 3; k++) out[i * 3 + k] = c[k] * keep;
        } else if (tb === slot && h.along[i] <= front) {
          const hot = clamp(1.0 - (front - h.along[i]) / 0.15, 0, 1) * (p < rise ? 1.0 : 0.0);
          for (let k = 0; k < 3; k++)
            out[i * 3 + k] = (1 - hot) * (c[k] * level) + hot * (tip[k] * level);
        }
        if (h.rims[i]) for (let k = 0; k < 3; k++) out[i * 3 + k] = c[k] * 0.10;
      }
    } else {
      const k = 1.0 - p;
      for (let i = 0; i < h.n; i++) {
        for (let j = 0; j < 3; j++) {
          if (h.tube[i] >= 0) out[i * 3 + j] = 0.5 * (c[j] + tip[j]) * k;
          else if (h.rims[i]) out[i * 3 + j] = tip[j] * k * k;
          else if (h.shell[i]) out[i * 3 + j] = bed[j] + c[j] * 0.30 * k * k;
        }
      }
    }
  });

const api = { hsv, hashSin, paint, makeHelmet, make, accepts, REGISTRY,
              textBitmap, glyphBitmap, digitBitmap, spriteBitmap, fract, pmod };
root.MAU5 = Object.assign(root.MAU5 || {}, api);
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
