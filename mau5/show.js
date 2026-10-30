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
// pulse and downbeat accent, same overlay compositing.
// ----------------------------------------------------------------------

(function (root) {
'use strict';

const M = root.MAU5;

function pmod(a, b) { const r = a % b; return r < 0 ? r + b : r; }

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
    // onto the track.  Live there is no such confidence to appeal to,
    // and an effect quantised to a grid that is only approximately
    // where the beats are lands wrong on purpose rather than at
    // random -- which is worse.  So: only if the show insists.
    this.lock = show.lock === true;
    this.cues = show.cues.slice().sort((a, b) => a.start - b.start);
    this.duration = show.duration || (this.cues.length
      ? this.cues[this.cues.length - 1].end : 0);
    this.cache = new Map();
    this.n = helmet.n;
    this._pool = [];
    this._at = 0;
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
    const te = (this.lock && music)
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
        const k = Math.pow(Math.max(0, 1 - ph * 3), 2);
        const amp = this.pulse * (0.4 + 0.3 * lvl);
        this.gain = (1 + amp * k) / (1 + amp);
      }
      if (this.accent && lvl >= 2 && music.isDownbeat(t)) {
        const k = Math.max(0, 1 - ph * 6) * 0.45;
        if (k > 0) for (let q = 0; q < out.length; q++) out[q] += k * 255;
      }
    }
    for (let q = 0; q < out.length; q++) {
      out[q] = out[q] < 0 ? 0 : (out[q] > 255 ? 255 : out[q]);
    }
    return cur;
  }
}

const api = { ShowPlayer, cycleSeconds, lockTime };
root.MAU5 = Object.assign(root.MAU5 || {}, api);
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
