// ----------------------------------------------------------------------
// show.js -- the cue lists, run against whatever the room is playing.
//
// A show is three things on the laptop: a cue list, an analysis of the
// track, and the track itself.  Only the cue list comes here.  The five
// analyses are two megabytes and the audio sixty, against about nine
// hundred kilobytes free on the controller -- and it turns out neither
// is needed, because the analysis existed to say where the beats and
// the bands were and the phone is already measuring that from what it
// can hear.
//
// What is lost is the clock.  Nothing on the phone knows where in the
// track you are, so the show is started by hand and runs on its own
// time from there.  That is how a lighting desk works anyway.
//
// A port of mau5show.Player: same crossfade, same dynamics, same beat
// pulse and downbeat accent, same overlay compositing.  And of
// mau5scene.Scenes, which plays a song's own choreography instead of
// its cue list when the show carries one.
// ----------------------------------------------------------------------

(function (root) {
'use strict';

const M = root.MAU5;

function pmod(a, b) { const r = a % b; return r < 0 ? r + b : r; }

// The beat pulse and the downbeat accent, as mau5show.beat_gain and
// mau5show.accent_level -- the reasoning is there, the numbers here
// must stay the same.  In short: the old pulse lasted a third of a
// beat, 115 ms at 174 bpm, which a phone sending a frame every 36-70 ms
// caught at a random height or not at all, so every beat flashed
// differently.  Now it holds its peak for PULSE_HOLD_S first, so some
// frame always lands on the full beat, and the floor between beats
// drops just enough that a beat averages the same as it did -- the
// same current over a song, only placed where it can be seen.
const PULSE_HOLD_S = 0.07;
const ACCENT_PEAK = 0.45;
const ACCENT_WINDOW_S = 0.08;     // isDownbeat's own window

function beatGain(ph, bpm, amp) {
  const spb = 60 / Math.max(bpm || 0, 1e-6);
  const hold = Math.min(PULSE_HOLD_S / spb, 0.25);
  const x = Math.max(0, ph - hold);
  const k = Math.pow(Math.max(0, 1 - x * 3), 2);
  const mean0 = (1 + amp / 9) / (1 + amp);
  const area = hold + 1 / 9;
  const floor = (mean0 - area) / (1 - area);
  if (floor >= 0) return floor + (1 - floor) * k;
  return k * mean0 / area;
}

function accentLevel(bpm) {
  const spb = 60 / Math.max(bpm || 0, 1e-6);
  const win = ACCENT_WINDOW_S / spb;
  const m = Math.min(win, 1 / 6);
  return ACCENT_PEAK * (m - 3 * m * m) / win;
}

// How long one visual cycle of a preset lasts, from its own period
// parameter.  mau5engine.cycle_seconds.
function cycleSeconds(name, params, tbl) {
  const ent = tbl.presets[name];
  if (!ent) return null;
  const key = ent[0], unit = ent[1], mul = ent[2];
  let v = params[key];
  if (v === undefined) {
    const def = M.REGISTRY[name];
    v = def ? def.params[key] : undefined;
  }
  v = Number(v);
  if (!isFinite(v) || v <= 0) return null;
  const base = unit === 's' ? v : (unit === 'hz' ? 1 / v : 60 / v);
  return base * mul;
}

// The time to hand render() so the cycle lands on the beat grid.
function lockTime(music, name, params, t, tbl) {
  const per = cycleSeconds(name, params, tbl);
  if (!music || per === null) return t;
  const spb = 60 / Math.max(music.bpm || 0, 1e-6);
  const want = per / spb;
  let beats = tbl.divisions[0], best = Infinity;
  for (const d of tbl.divisions) {
    const e = Math.abs(Math.log(d / want));
    if (e < best) { best = e; beats = d; }
  }
  return (pmod(music.beatIndex(t), beats) / beats) * per;
}

class ShowPlayer {
  constructor(show, helmet, data) {
    this.show = show;
    this.h = helmet;
    this.tbl = data.lock;
    this.fonts = data.fonts;
    this.fade = show.fade || 0;
    this.accent = !!show.accent;
    this.pulse = show.pulse === undefined ? 0.22 : show.pulse;
    this.gain = 1.0;          // the beat pulse, for the sender to apply after the guard
    this.dyn = show.dynamics === undefined ? 0.72 : show.dynamics;
    this.dynGamma = show.dynamics_gamma === undefined ? 0.7 : show.dynamics_gamma;
    // The laptop decides this from how well the tempo estimate locked
    // onto the track, and mau5show.build writes that verdict into the
    // show as `lock`.  It holds for a TrackDrive, which carries that
    // same analysis' beat grid -- and four of the five shows lock on
    // the laptop, so leaving them free here put every strobe and chase
    // on the phone a fixed fraction of a beat off the kicks (0.75 of a
    // beat on Strobe, whose first beat is at 0.35 s).  Live there is no
    // such confidence to appeal to: the grid is an estimate from
    // onsets, and an effect quantised to a grid that is only
    // approximately where the beats are lands wrong on purpose rather
    // than at random -- which is worse.  So only on an analysed grid.
    this.lock = show.lock === true;
    this.cues = show.cues.slice().sort((a, b) => a.start - b.start);
    this.duration = show.duration || (this.cues.length
      ? this.cues[this.cues.length - 1].end : 0);
    this.cache = new Map();
    this.n = helmet.n;
    this._pool = [];
    this._at = 0;
    // The song's own choreography, when it has one (mau5scene).  ?cues
    // in the page's address, or mode "cues" in the show, keeps the cue
    // list -- and so does a renderer that cannot be built, rather than
    // a helmet left dark.
    const off = show.mode === 'cues'
      || /[?&]cues\b/.test((root.location && root.location.search) || '');
    this.scenes = null;
    if (show.scenes && !off) {
      try { this.scenes = new Scenes(show.scenes, helmet, data); }
      catch (e) { console.warn('scenes off', e); }
    }
  }

  // Scratch buffers: a crossfade renders two cues and each cue may
  // render an overlay, so four deep is enough and nothing allocates
  // inside a frame.
  take() {
    while (this._pool.length <= this._at) {
      this._pool.push(new Float32Array(this.n * 3));
    }
    return this._pool[this._at++];
  }

  cueAt(t) {
    for (const c of this.cues) if (c.start <= t && t < c.end) return c;
    return null;
  }

  one(name, params, t, music, out) {
    const key = name + '|' + JSON.stringify(params);
    let inst = this.cache.get(key);
    if (!inst) {
      inst = M.make(name, params, this.h, this.fonts);
      this.cache.set(key, inst);
    }
    const te = (this.lock && music && music.analysed === true)
      ? lockTime(music, name, params, t, this.tbl) : t;
    out.fill(0);
    inst.render(this.h, te, music, out);
  }

  renderCue(cue, t, music, out) {
    this.one(cue.preset, cue.params || {}, t, music, out);
    const g = cue.gain === undefined ? 1 : cue.gain;
    if (g !== 1) for (let q = 0; q < out.length; q++) out[q] *= g;

    const ov = cue.overlay;
    if (!ov) return;
    let gain = ov.gain === undefined ? 1 : ov.gain;
    if (ov.band && music && music.bandAt) {
      const floor = ov.floor === undefined ? 0.15 : ov.floor;
      const punch = ov.punch === undefined ? true : !!ov.punch;
      gain *= floor + (1 - floor) * music.bandAt(t, ov.band, punch);
    }
    const mark = this._at;
    const lay = this.take();
    this.one(ov.preset, ov.params || {}, t, music, lay);
    for (let q = 0; q < lay.length; q++) lay[q] *= gain;
    const mix = ov.mix || 'add';
    if (mix === 'over') {
      for (let i = 0; i < this.n; i++) {
        const b = i * 3;
        if (Math.max(lay[b], lay[b + 1], lay[b + 2]) > 4) {
          out[b] = lay[b]; out[b + 1] = lay[b + 1]; out[b + 2] = lay[b + 2];
        }
      }
    } else if (mix === 'max') {
      for (let q = 0; q < out.length; q++) if (lay[q] > out[q]) out[q] = lay[q];
    } else {
      for (let q = 0; q < out.length; q++) out[q] += lay[q];
    }
    this._at = mark;
  }

  frame(t, music, out) {
    if (this.scenes) {
      try {
        const r = this.scenes.frame(t, music, out);
        this.gain = this.scenes.gain;
        return r;
      } catch (e) {
        this.scenes = null;
        console.warn('scenes failed, cue list', e);
      }
    }
    this._at = 0;
    this.gain = 1.0;
    const cur = this.cueAt(t);
    if (!cur) { out.fill(0); return null; }
    this.renderCue(cur, t, music, out);

    if (this.fade > 0) {
      const into = t - cur.start;
      if (into < this.fade) {
        const i = this.cues.indexOf(cur);
        if (i > 0) {
          const k = into / this.fade;
          const mark = this._at;
          const tmp = this.take();
          this.renderCue(this.cues[i - 1], t, music, tmp);
          for (let q = 0; q < out.length; q++) {
            out[q] = k * out[q] + (1 - k) * tmp[q];
          }
          this._at = mark;
        }
      }
    }

    if (music) {
      const lvl = cur.level || 0;
      const ph = music.beatPhase(t);
      if (this.dyn > 0) {
        const e = 0.6 * (music.bandAt ? music.bandAt(t, 'bass', false) : music.levelAt(t))
                + 0.4 * music.levelAt(t);
        const k = (1 - this.dyn) + this.dyn * Math.pow(Math.max(e, 0), this.dynGamma);
        for (let q = 0; q < out.length; q++) out[q] *= k;
      }
      // Not multiplied in: the guard flattens a lift on anything loud.
      // Handed over as `gain`, at most 1, for the sender to apply after
      // the guard (mau5show.Player.frame has the whole story).
      if (this.pulse > 0 && lvl >= 1) {
        this.gain = beatGain(ph, music.bpm, this.pulse * (0.4 + 0.3 * lvl));
      }
      // ph < 0.5: isDownbeat is true either side of the bar, and the
      // flash belongs after it
      if (this.accent && lvl >= 2 && ph < 0.5 && music.isDownbeat(t)) {
        const k = accentLevel(music.bpm);
        if (k > 0) for (let q = 0; q < out.length; q++) out[q] += k * 255;
      }
    }
    for (let q = 0; q < out.length; q++) {
      out[q] = out[q] < 0 ? 0 : (out[q] > 255 ? 255 : out[q]);
    }
    return cur;
  }
}

// ----------------------------------------------------------------------
// Scenes -- a song's own choreography, compiled by mau5scene.py.
//
// Every frame is a pure function of t (and, given an analysed track, its
// band curves) on the analysis' beat grid, which is exactly linear for
// every shipped song.  So the clock can be the audio element's own
// currentTime, seeking costs nothing, and the laptop and this page agree
// to the bit: the arithmetic below is mau5scene.Scenes written out in the
// same order, and test_mau5's scenes group holds the two together.
//
// The JSON arrives with every default filled in.  There is no table of
// defaults here to drift from the Python's: what is not in the show is
// an error, and an error drops this player back to the cue list.
//
// Nothing below allocates inside a frame.  Region lists, axis values,
// palettes, preset instances and the accumulator are all made once.
// ----------------------------------------------------------------------
const MIXES = { add: 0, max: 1, over: 2 };
const SHAPES = { p: 0, saw: 1, tri: 2 };
const SIDES = { both: 0, alt: 1, ear1: 2, ear2: 3 };
const SCENE_PRESETS = { text: 1, sprite: 1, eyes: 1 };
const FX_VALUES = {
  fill: [],
  grad: ['scale', 'speed', 'ofs', 'warp', 'wscale', 'wspeed', 'lo', 'hi'],
  sweep: ['speed', 'width', 'soft', 'cgrad', 'from', 'to'],
  sparks: ['rate', 'life', 'spread', 'nbr'],
  blades: ['step', 'rise', 'keep', 'ctip', 'rim'],
  preset: [],
  orb: ['x', 'y', 'rad', 'soft', 'wx', 'wy', 'xf', 'yf', 'xp', 'yp', 'cgrad'],
  twinkle: ['rate', 'sharp', 'spread', 'dens'],
};

function sclamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function shash(x) { return pmod(Math.sin(x) * 43758.5453, 1); }

// A value in one of its four canonical forms -> something cheap to read.
function prepVal(v) {
  if (v && typeof v.n === 'number') return { k: 0, a: v.n };
  if (v && v.ramp) return { k: 1, a: v.ramp[0], b: v.ramp[1] };
  if (v && v.keys) {
    return { k: 2, bars: Float64Array.from(v.keys, e => e[0]),
             vals: Float64Array.from(v.keys, e => e[1]) };
  }
  if (v && v.band) return { k: 3, band: v.band, a: v.lo, b: v.hi, punch: !!v.punch };
  throw new Error('not a scene value: ' + JSON.stringify(v));
}

function valAt(V, p, bar, music, tt) {
  switch (V.k) {
    case 0: return V.a;
    case 1: return V.a + (V.b - V.a) * p;
    case 2: {
      let v = V.vals[0];
      for (let i = 0; i < V.bars.length; i++) {
        if (V.bars[i] <= bar) v = V.vals[i]; else break;
      }
      return v;
    }
    default: {
      const x = (music && music.analysed === true)
        ? music.bandAt(tt, V.band, V.punch) : 0.5;
      return V.a + (V.b - V.a) * x;
    }
  }
}

// A rhythm pattern as a gain: the newest sounding step, held for
// PULSE_HOLD_S so a phone frame always catches its peak, then decaying.
function patGate(lb, pat, step, decay, floor, HB) {
  const L = pat.length;
  const si = Math.floor(lb / step);
  for (let k = 0; k < L; k++) {
    const ch = pat.charCodeAt(pmod(si - k, L));
    if (ch !== 46) {                                  // not '.'
      const amp = ch === 120 ? 1 : 0.5;               // 'x' full, 'o' half
      const age = lb - (si - k) * step;
      const x = Math.max(0, age - HB);
      const e = Math.max(0, 1 - x / decay);
      return floor + (1 - floor) * amp * e * e;
    }
  }
  return floor;
}

function regionMask(h, on) {
  const n = h.n, m = new Uint8Array(n);
  for (const raw of String(on).split('+')) {
    const nm = raw.trim();
    for (let i = 0; i < n; i++) {
      let v;
      switch (nm) {
        case 'all': v = 1; break;
        case 'shell': case 'ears': case 'ear1': case 'ear2':
        case 'tubes': case 'rims': v = h[nm][i]; break;
        case 'tube0': v = h.tube[i] === 0; break;
        case 'tube1': v = h.tube[i] === 1; break;
        case 'tube2': v = h.tube[i] === 2; break;
        case 'left': v = h.shell[i] && h.fa[i] < 0; break;
        case 'right': v = h.shell[i] && h.fa[i] >= 0; break;
        case 'face': v = h.shell[i] && h.py[i] > 28; break;
        case 'jaw': v = h.shell[i] && h.py[i] <= 28; break;
        case 'rim1': v = h.rims[i] && h.ear1[i]; break;
        case 'rim2': v = h.rims[i] && h.ear2[i]; break;
        case 'tubes1': v = h.tubes[i] && h.ear1[i]; break;
        case 'tubes2': v = h.tubes[i] && h.ear2[i]; break;
        default: throw new Error('no region ' + nm);
      }
      if (v) m[i] = 1;
    }
  }
  return m;
}

function listOf(mask, also) {
  const out = [];
  for (let i = 0; i < mask.length; i++) if (mask[i] && (!also || also(i))) out.push(i);
  return Int32Array.from(out);
}

class Scenes {
  constructor(spec, helmet, data) {
    if (spec.v !== 1) throw new Error('scenes v' + spec.v + ' is not v1');
    const h = helmet;
    this.h = h;
    this.n = h.n;
    this.fonts = data && data.fonts;
    this.t0 = spec.grid.t0;
    this.spb = spec.grid.spb;
    this.lead = spec.grid.lead || 0;
    this.holds = spec.grid.holds || [];
    this.nbars = spec.bars;
    this.HB = PULSE_HOLD_S / this.spb;
    this.gain = 1.0;
    this.pal = {};
    for (const k of Object.keys(spec.pal)) {
      const p = spec.pal[k];
      const s = new Float64Array(p.stops.length * 3);
      p.stops.forEach((c, i) => { s[i * 3] = c[0]; s[i * 3 + 1] = c[1]; s[i * 3 + 2] = c[2]; });
      this.pal[k] = { s: s, wrap: !!p.wrap, n: p.stops.length };
    }
    const n = h.n;
    this.al = new Float64Array(n);
    for (let i = 0; i < n; i++) this.al[i] = Math.max(h.along[i], 0);
    this.axes = { x: h.nfa, y: h.nel, r: h.er, a: h.ea, al: this.al, u: h.u };
    this.scenes = spec.scenes.map(sc => ({
      name: sc.name, from: sc.from, to: sc.to, out: sc.out,
      pump: sc.pump ? { pat: sc.pump.pat, step: sc.pump.step, decay: sc.pump.decay,
                        depth: sc.pump.depth } : null,
      layers: sc.layers.map(L => this._layer(L)),
    }));
    this.hits = spec.hits.map(x => ({
      name: x.name, at: x.at, beats: x.beats, layers: x.layers.map(L => this._layer(L)),
    }));
    let most = 1;
    for (const sc of this.scenes.concat(this.hits)) {
      for (const L of sc.layers) if (L.nm > most) most = L.nm;
    }
    this.acc = new Float64Array(n * 3);
    this.K = new Float64Array(most);
    this.C = new Float64Array(most);
    this.rgb = new Float64Array(3);
    this.scratch = new Float64Array(n * 3);
    this.res = { preset: '', overlay: null };
    this._si = 0;                                 // the last scene, to start from
    this._key = -1;
  }

  _layer(L) {
    const h = this.h;
    if (!(L.fx in FX_VALUES)) throw new Error('no scene fx ' + L.fx);
    if (!(L.mix in MIXES)) throw new Error('no mix ' + L.mix);
    if (!this.pal[L.pal]) throw new Error('no palette ' + L.pal);
    const mask = regionMask(h, L.on);
    const idx = listOf(mask);
    const P = {
      fx: L.fx, mix: MIXES[L.mix], idx: idx, nm: idx.length, pal: this.pal[L.pal],
      gain: prepVal(L.gain), c: prepVal(L.c),
      gate: L.gate ? { pat: L.gate.pat, step: L.gate.step, decay: L.gate.decay,
                       floor: L.gate.floor } : null,
      ein: L.env.in, eout: L.env.out,
    };
    for (const k of FX_VALUES[L.fx]) P[k] = prepVal(L[k]);
    if (L.fx === 'grad') {
      P.a = this.axes[L.axis]; P.a2 = this.axes[L.axis2];
      if (!P.a || !P.a2) throw new Error('no axis ' + L.axis + '/' + L.axis2);
      P.saw = L.wave === 'saw';
    } else if (L.fx === 'sweep') {
      P.a = this.axes[L.axis];
      if (!P.a) throw new Error('no axis ' + L.axis);
      P.shape = SHAPES[L.shape];
      P.band = L.mode === 'band';
    } else if (L.fx === 'sparks') {
      P.loop = L.loop; P.seed = L.seed;
    } else if (L.fx === 'blades') {
      P.tubes = [h.ear1, h.ear2].map(ear => [0, 1, 2].map(
        t => listOf(mask, i => h.tube[i] === t && ear[i])));
      P.rims = [h.ear1, h.ear2].map(ear => listOf(mask, i => h.rims[i] && ear[i]));
      P.seq = L.seq.map(x => Int32Array.from(x));
      P.full = L.seq.map(x => x.length === 3 && x.indexOf(0) >= 0
                         && x.indexOf(1) >= 0 && x.indexOf(2) >= 0);
      P.side = SIDES[L.side];
    } else if (L.fx === 'twinkle') {
      const seed = L.seed, each = (k) => {
        const a = new Float64Array(idx.length);
        for (let m = 0; m < idx.length; m++) a[m] = shash(m * k + seed);
        return a;
      };
      P.h1 = each(12.9898); P.h2 = each(78.233); P.h3 = each(37.719); P.h4 = each(91.7);
    } else if (L.fx === 'preset') {
      if (!SCENE_PRESETS[L.name]) throw new Error('no scene preset ' + L.name);
      P.inst = M.make(L.name, L.params, h, this.fonts);
      P.tofs = L.tofs;
    }
    return P;
  }

  // One palette position into this.rgb.
  _pal(P, c) {
    const pl = P.pal, n = pl.n, s = pl.s;
    let i0, i1, f;
    if (pl.wrap) {
      const x = pmod(c, 1) * n;
      const i = Math.floor(x);
      f = x - i;
      i0 = i % n;
      i1 = (i0 + 1) % n;
    } else {
      const x = sclamp(c, 0, 1) * (n - 1);
      const i = Math.min(Math.floor(x), n - 2);
      f = x - i;
      i0 = i; i1 = i + 1;
    }
    const rgb = this.rgb;
    rgb[0] = s[i0 * 3] + (s[i1 * 3] - s[i0 * 3]) * f;
    rgb[1] = s[i0 * 3 + 1] + (s[i1 * 3 + 1] - s[i0 * 3 + 1]) * f;
    rgb[2] = s[i0 * 3 + 2] + (s[i1 * 3 + 2] - s[i0 * 3 + 2]) * f;
  }

  // One LED's contribution: w times the colour in this.rgb, mixed in.
  _put(mix, i, w) {
    const acc = this.acc, rgb = this.rgb, b = i * 3;
    const v0 = w * rgb[0], v1 = w * rgb[1], v2 = w * rgb[2];
    if (mix === 0) { acc[b] += v0; acc[b + 1] += v1; acc[b + 2] += v2; }
    else if (mix === 1) {
      if (v0 > acc[b]) acc[b] = v0;
      if (v1 > acc[b + 1]) acc[b + 1] = v1;
      if (v2 > acc[b + 2]) acc[b + 2] = v2;
    } else if (Math.max(v0, v1, v2) > 4) { acc[b] = v0; acc[b + 1] = v1; acc[b + 2] = v2; }
  }

  _render(P, B, bar, lb, span, p, music, tt) {
    const gate = P.gate
      ? patGate(lb, P.gate.pat, P.gate.step, P.gate.decay, P.gate.floor, this.HB) : 1;
    const ein = P.ein > 0 ? sclamp(lb / P.ein, 0, 1) : 1;
    const eout = P.eout > 0 ? sclamp((span - lb) / P.eout, 0, 1) : 1;
    const G = valAt(P.gain, p, bar, music, tt) * gate * ein * eout;
    if (!(G > 0)) return;
    const c0 = valAt(P.c, p, bar, music, tt);
    const idx = P.idx, nm = P.nm, mix = P.mix;
    switch (P.fx) {
      case 'fill': {
        this._pal(P, c0);
        const w = G * 1;
        for (let m = 0; m < nm; m++) this._put(mix, idx[m], w);
        break;
      }
      case 'grad': {
        const scale = valAt(P.scale, p, bar, music, tt);
        const speed = valAt(P.speed, p, bar, music, tt);
        const ofs = valAt(P.ofs, p, bar, music, tt);
        const warp = valAt(P.warp, p, bar, music, tt);
        const lo = valAt(P.lo, p, bar, music, tt), hi = valAt(P.hi, p, bar, music, tt);
        const wscale = warp !== 0 ? valAt(P.wscale, p, bar, music, tt) : 0;
        const wspeed = warp !== 0 ? valAt(P.wspeed, p, bar, music, tt) : 0;
        const A = P.a, A2 = P.a2, saw = P.saw;
        for (let m = 0; m < nm; m++) {
          const i = idx[m];
          let x = A[i] * scale + B * speed + ofs;
          if (warp !== 0) x = x + warp * Math.sin(2 * Math.PI * (A2[i] * wscale + B * wspeed));
          const f = pmod(x, 1);
          const wv = saw ? f : 1 - Math.abs(2 * f - 1);
          this._pal(P, lo + (hi - lo) * wv);
          this._put(mix, i, G * 1);
        }
        break;
      }
      case 'sweep': {
        const speed = valAt(P.speed, p, bar, music, tt);
        let sh;
        if (P.shape === 0) sh = p;
        else {
          const f = pmod(lb * speed, 1);
          sh = P.shape === 1 ? f : 1 - Math.abs(2 * f - 1);
        }
        const a0 = valAt(P.from, p, bar, music, tt), a1 = valAt(P.to, p, bar, music, tt);
        const pos = a0 + (a1 - a0) * sh;
        const width = valAt(P.width, p, bar, music, tt);
        const soft = valAt(P.soft, p, bar, music, tt);
        const cgrad = valAt(P.cgrad, p, bar, music, tt);
        const A = P.a, band = P.band;
        for (let m = 0; m < nm; m++) {
          const i = idx[m];
          const d = A[i] - pos;
          let k;
          if (band) { const q = 1 - Math.abs(d) / width; k = q > 0 ? q * q : 0; }
          else k = sclamp(0.5 - d / soft, 0, 1);
          this._pal(P, c0 + cgrad * A[i]);
          this._put(mix, i, G * k);
        }
        break;
      }
      case 'sparks': {
        const r = valAt(P.rate, p, bar, music, tt);
        if (r <= 0) return;
        const life = valAt(P.life, p, bar, music, tt);
        const spread = valAt(P.spread, p, bar, music, tt);
        const nbr = valAt(P.nbr, p, bar, music, tt);
        const K = this.K, C = this.C, loop = P.loop, seed = P.seed, HB = this.HB;
        for (let m = 0; m < nm; m++) { K[m] = 0; C[m] = 0; }
        const top = Math.floor(B * r);
        const nb = Math.min(8, Math.ceil(life * r));
        for (let back = 0; back <= nb; back++) {
          const j = top - back;
          const age = B - j / r;
          if (!(age >= 0 && age < life)) continue;
          const jj = loop > 0 ? pmod(j, loop) : j;
          const at = Math.min(Math.floor(shash(jj * 91.7 + seed) * nm), nm - 1);
          const x = Math.max(0, age - HB);
          const e = 1 - x / life;
          const kk = e * e;
          const cc = c0 + spread * shash(jj * 12.9898 + seed);
          if (kk > K[at]) { K[at] = kk; C[at] = cc; }
          const kn = kk * nbr;
          if (at - 1 >= 0 && kn > K[at - 1]) { K[at - 1] = kn; C[at - 1] = cc; }
          if (at + 1 < nm && kn > K[at + 1]) { K[at + 1] = kn; C[at + 1] = cc; }
        }
        // an unlit LED adds nothing under any mix, so only the lit are drawn
        for (let m = 0; m < nm; m++) {
          if (!(K[m] > 0)) continue;
          this._pal(P, C[m]);
          this._put(mix, idx[m], G * K[m]);
        }
        break;
      }
      case 'blades': {
        const st = valAt(P.step, p, bar, music, tt);
        const s = Math.floor(lb / st);
        const q = lb / st - s;
        const si = pmod(s, P.seq.length);
        const set = P.seq[si], full = P.full[si], side = P.side;
        const alt = pmod(s, 2) === 0;
        const e1 = side === 0 || side === 2 || (side === 1 && alt);
        const e2 = side === 0 || side === 3 || (side === 1 && !alt);
        const rise = valAt(P.rise, p, bar, music, tt);
        const keep = valAt(P.keep, p, bar, music, tt);
        const ctip = valAt(P.ctip, p, bar, music, tt);
        const rim = valAt(P.rim, p, bar, music, tt);
        const front = Math.min(q / rise, 1);
        const x = Math.max(0, q * st - this.HB);
        const e = Math.max(0, 1 - x / st);
        const lv = keep + (1 - keep) * e * e;
        const AL = this.al;
        for (let ear = 0; ear < 2; ear++) {
          if (!(ear === 0 ? e1 : e2)) continue;
          for (let t = 0; t < set.length; t++) {
            const ii = P.tubes[ear][set[t]];
            for (let m = 0; m < ii.length; m++) {
              const i = ii[m], al = AL[i];
              const fk = sclamp((front - al) / 0.1 + 0.5, 0, 1);
              const k = fk * lv;
              this._pal(P, c0 + (ctip - c0) * Math.max(0, 1 - Math.abs(front - al) / 0.15));
              this._put(mix, i, G * k);
            }
          }
          if (rim > 0 && full) {
            const ii = P.rims[ear];
            const k = rim * lv;
            this._pal(P, c0);
            for (let m = 0; m < ii.length; m++) this._put(mix, ii[m], G * k);
          }
        }
        break;
      }
      case 'orb': {
        let x0 = valAt(P.x, p, bar, music, tt), y0 = valAt(P.y, p, bar, music, tt);
        const wx = valAt(P.wx, p, bar, music, tt), wy = valAt(P.wy, p, bar, music, tt);
        if (wx !== 0) {
          x0 = x0 + wx * Math.sin(2 * Math.PI * (B * valAt(P.xf, p, bar, music, tt)
                                                 + valAt(P.xp, p, bar, music, tt)));
        }
        if (wy !== 0) {
          y0 = y0 + wy * Math.sin(2 * Math.PI * (B * valAt(P.yf, p, bar, music, tt)
                                                 + valAt(P.yp, p, bar, music, tt)));
        }
        const rad = valAt(P.rad, p, bar, music, tt), soft = valAt(P.soft, p, bar, music, tt);
        const cgrad = valAt(P.cgrad, p, bar, music, tt);
        const PX = this.h.px, PY = this.h.py;
        for (let m = 0; m < nm; m++) {
          const i = idx[m];
          const d = Math.hypot(PX[i] - x0, PY[i] - y0);
          const e = sclamp((rad - d) / soft, 0, 1);
          this._pal(P, c0 + cgrad * d / rad);
          this._put(mix, i, G * (e * e * (3 - 2 * e)));
        }
        break;
      }
      case 'twinkle': {
        const rate = valAt(P.rate, p, bar, music, tt), sharp = valAt(P.sharp, p, bar, music, tt);
        const spread = valAt(P.spread, p, bar, music, tt), dens = valAt(P.dens, p, bar, music, tt);
        for (let m = 0; m < nm; m++) {
          if (!(P.h4[m] < dens)) continue;
          const s = Math.sin(2 * Math.PI * (B * rate * (0.5 + P.h2[m]) + P.h1[m]));
          if (!(s > 0)) continue;
          this._pal(P, c0 + spread * P.h3[m]);
          this._put(mix, idx[m], G * Math.pow(s, sharp));
        }
        break;
      }
      case 'preset': {
        const sc = this.scratch;
        sc.fill(0);
        P.inst.render(this.h, lb * this.spb + P.tofs, null, sc);
        const acc = this.acc;
        for (let m = 0; m < nm; m++) {
          const b = idx[m] * 3;
          const v0 = G * sc[b], v1 = G * sc[b + 1], v2 = G * sc[b + 2];
          if (mix === 0) { acc[b] += v0; acc[b + 1] += v1; acc[b + 2] += v2; }
          else if (mix === 1) {
            if (v0 > acc[b]) acc[b] = v0;
            if (v1 > acc[b + 1]) acc[b + 1] = v1;
            if (v2 > acc[b + 2]) acc[b + 2] = v2;
          } else if (Math.max(v0, v1, v2) > 4) { acc[b] = v0; acc[b + 1] = v1; acc[b + 2] = v2; }
        }
        break;
      }
    }
  }

  _sceneAt(bar) {
    const S = this.scenes;
    const c = S[this._si];
    if (c && c.from <= bar && bar < c.to) return this._si;
    for (let i = 0; i < S.length; i++) {
      if (S[i].from <= bar && bar < S[i].to) { this._si = i; return i; }
    }
    return -1;
  }

  // The beat at a time: the straight grid, stopped at each seam.
  beat(tt) {
    let B = (tt - this.t0) / this.spb;
    for (const [at, beats] of this.holds) {
      if (B > at) B = Math.max(at, B - beats);
    }
    return B;
  }

  frame(t, music, out) {
    const tt = t + this.lead;
    const B = this.beat(tt);
    const bar = B / 4;
    const acc = this.acc;
    this.gain = 1.0;
    acc.fill(0);
    const si = (bar >= -1 && bar < this.nbars) ? this._sceneAt(bar) : -1;
    if (si < 0) {
      out.fill(0);
      this._key = -1;
      this.res.preset = '';
      return this.res;
    }
    const sc = this.scenes[si];
    const lb = B - 4 * sc.from;
    const span = 4 * (sc.to - sc.from);
    const p = sclamp(lb / span, 0, 1);
    for (const P of sc.layers) this._render(P, B, bar, lb, span, p, music, tt);
    // The beat of darkness before a drop: contrast is most of what makes
    // a hit land, and the dark beat banks a little thermal room too.
    if (sc.out > 0 && lb >= span - sc.out) acc.fill(0);
    let h0 = -1, h1 = -1;
    for (let k = 0; k < this.hits.length; k++) {
      const x = this.hits[k];
      const hb = B - 4 * x.at;
      if (0 <= hb && hb < x.beats) {
        const hp = hb / x.beats;
        for (const P of x.layers) this._render(P, B, bar, hb, x.beats, hp, music, tt);
        if (h0 < 0) h0 = k; else { h1 = k; break; }
      }
    }
    const n3 = this.n * 3;
    for (let q = 0; q < n3; q++) {
      const v = acc[q];
      out[q] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
    // After the guard, like the cue lists' beat pulse: on the pattern the
    // frame is at its limit, between it is dimmer, so the rhythm survives
    // a frame the guard has already flattened.
    if (sc.pump) {
      const pp = sc.pump;
      this.gain = 1 - pp.depth + pp.depth * patGate(lb, pp.pat, pp.step, pp.decay, 0, this.HB);
    }
    // The label changes a few times a minute; building it every frame
    // would be the only allocation left.
    const key = si * 1e6 + (h0 + 1) * 1e3 + (h1 + 1);
    if (key !== this._key) {
      this._key = key;
      let lab = sc.name;
      if (h0 >= 0) lab += ' · ' + this.hits[h0].name;
      if (h1 >= 0) lab += ' · ' + this.hits[h1].name;
      this.res.preset = lab;
    }
    return this.res;
  }
}

const api = { ShowPlayer, Scenes, cycleSeconds, lockTime, beatGain, accentLevel };
root.MAU5 = Object.assign(root.MAU5 || {}, api);
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
