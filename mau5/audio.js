// ----------------------------------------------------------------------
// audio.js -- what the phone can hear, in the shape the presets expect.
//
// The presets already take a `music` object: level_at, beat_phase,
// bands_at and the rest, which on the laptop is a track analysed ahead
// of time by mau5song.  This builds the same interface out of whatever
// the phone is listening to right now, so a preset cannot tell the
// difference and nothing in the engine had to learn about microphones.
//
// Two sources, and which ones exist is not up to us:
//
//   A file the user picks.  Always available.  <input type=file>,
//   decoded by the browser, played out of the phone and tapped on the
//   way past, so what the helmet reacts to is exactly what the room
//   hears, with no latency to guess at.
//
//   The microphone.  Only where getUserMedia exists, and it does not
//   exist on the page the controller serves: that page is plain http,
//   which is not a secure context, so navigator.mediaDevices is
//   undefined -- not blocked, absent.  Nothing in here can change
//   that; see the note in the UI for the two ways round it.
//
// Analysis runs on its own 50 Hz timer rather than in the render loop.
// The render loop is paced by how fast the controller can swallow
// frames, which was measured at single figures on a heavy preset, and
// onsets sampled at 4 Hz are not onsets.
// ----------------------------------------------------------------------

(function (root) {
'use strict';

// Two windows, because the two questions want opposite things.
//
// Onsets want a short one: a kick has to be located to a few tens of
// milliseconds or the helmet lands behind the beat.  Pitch wants a
// long one: at 44.1 kHz a 2048-point FFT has 21.5 Hz bins, and a
// semitone at middle C is 15 Hz -- measured here, a 262 Hz tone
// spread across five pitch classes and the chroma read two semitones
// flat.  8192 points gives 5.4 Hz bins, which resolves a semitone
// down to about 90 Hz, at a window of 186 ms that harmony does not
// move inside anyway.
const FFT_FAST = 1024;              // level, flux, bands
const FFT_SLOW = 8192;              // pitch, centroid
const TICK_MS = 20;                 // 50 Hz analysis, independent of render
const PITCH_LO = 120, PITCH_HI = 2000;
const BAND_LO = 40, BAND_HI = 12000;

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function fract(x) { const r = x % 1; return r < 0 ? r + 1 : r; }

// A level that has to work in a bedroom and in a club, from a
// microphone with no gain control we can reach.  Absolute dB is
// useless for that, so the loud and quiet ends are tracked and the
// reading is placed between them.  Both ends move slowly, and the
// quiet one moves up faster than it moves down, so a gap between
// tracks does not spend thirty seconds re-learning the room.
class AutoGain {
  constructor(lo, hi) {
    this.lo = lo; this.hi = hi; this.init = false;
  }
  push(db) {
    if (!this.init) { this.lo = db - 6; this.hi = db + 6; this.init = true; }
    if (db < this.lo) this.lo += (db - this.lo) * 0.25;
    else this.lo += 0.02;                        // creep up when it is quiet
    if (db > this.hi) this.hi += (db - this.hi) * 0.25;
    else this.hi -= 0.05;
    if (this.hi - this.lo < 9) this.hi = this.lo + 9;   // never amplify noise
    return clamp((db - this.lo) / (this.hi - this.lo), 0, 1);
  }
}

class Analyser {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.src = null;
    this.el = null;
    this.stream = null;
    this.timer = null;
    this.kind = 'none';
    this.err = '';
    this.volume = 1.0;

    this.freq = null;               // Uint8Array, dB-ish 0..255
    this.time = null;
    this.level = 0;
    this.rawDb = -100;
    this.pitch = 0;
    this.centroid = 0.5;
    this.flux = 0;
    this.bpm = 0;
    this.beatAt = 0;                // ctx time of the last beat
    this.period = 0.5;
    this.onsets = 0;

    this._gain = new AutoGain(-60, -20);
    this._prev = null;
    this._fluxHist = new Float32Array(256);
    this._fluxI = 0;
    this._last = [];                // recent onset times
    this._bandCache = {};
    this._bandVal = {};
    this._wanted = new Set();
    // bass / mid / high, the three the shows ask for by name, each
    // with a punch alongside its energy.  Same split as mau5song.BANDS
    // so an overlay riding "high" means the same thing here as it did
    // when the cue list was written.
    this.b3 = { bass: 0, mid: 0, high: 0 };
    this.p3 = { bass: 0, mid: 0, high: 0 };
    this._b3gain = { bass: new AutoGain(-60, -20), mid: new AutoGain(-60, -20),
                     high: new AutoGain(-60, -20) };
    this._b3prev = { bass: 0, mid: 0, high: 0 };
    this._pitchVec = new Float64Array(12);
  }

  get running() { return this.timer !== null; }

  // The track is the only sound the helmet has, so it needs a volume
  // that is not the phone's ringer and not buried in another app.
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.el) this.el.volume = this.volume;
  }

  get position() { return this.el ? this.el.currentTime : null; }
  get paused() { return this.el ? this.el.paused : true; }

  _ctx() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      this.ctx = new C();
      this.node = this.ctx.createAnalyser();
      this.node.fftSize = FFT_FAST;
      this.node.smoothingTimeConstant = 0.3;
      this.slow = this.ctx.createAnalyser();
      this.slow.fftSize = FFT_SLOW;
      this.slow.smoothingTimeConstant = 0.5;
      this.node.connect(this.slow);   // the long window hangs off the short
      this.freq = new Uint8Array(this.node.frequencyBinCount);
      this.sfreq = new Uint8Array(this.slow.frequencyBinCount);
      this.time = new Uint8Array(this.node.fftSize);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  static micPossible() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async useMic() {
    if (!Analyser.micPossible()) {
      throw new Error(window.isSecureContext
        ? 'this browser has no microphone API'
        : 'the microphone needs a secure page, and this one is plain http');
    }
    this.stop();
    const ctx = this._ctx();
    // No processing: AGC and noise suppression are built to flatten
    // exactly the dynamics a light show is trying to follow.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false,
               autoGainControl: false },
    });
    this.src = ctx.createMediaStreamSource(this.stream);
    this.src.connect(this.node);    // not to the speakers: that is feedback
    this.kind = 'mic';
    this._start();
  }

  static tabPossible() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }

  // Whatever another app or tab is playing, where the browser will
  // hand it over.  On a desktop that is a real answer to "follow what
  // Spotify is doing"; on a phone it is not offered by any browser,
  // and no amount of asking changes that -- there is no API for one
  // page to tap another app's audio on Android or iOS.  The honest
  // substitute on a phone is the microphone hearing the speaker.
  async useTab() {
    if (!Analyser.tabPossible()) {
      throw new Error(window.isSecureContext
        ? 'this browser will not share another app\'s audio'
        : 'sharing audio needs a secure page, and this one is plain http');
    }
    this.stop();
    const ctx = this._ctx();
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true, audio: true,
    });
    const audio = stream.getAudioTracks();
    if (!audio.length) {
      stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      throw new Error('that share carried no audio — pick a tab and tick '
                      + '"share tab audio"');
    }
    // The video track is only there because some browsers refuse to
    // share audio without one.  Stop it; the helmet does not care
    // what is on screen and a live capture costs real battery.
    stream.getVideoTracks().forEach(t => {
      try { t.stop(); stream.removeTrack(t); } catch (e) {}
    });
    this.stream = stream;
    this.src = ctx.createMediaStreamSource(stream);
    this.src.connect(this.node);
    this.kind = 'tab';
    audio[0].addEventListener('ended', () => { this.stop(); });
    this._start();
  }

  async useFile(file) {
    this.stop();
    const ctx = this._ctx();
    const el = new Audio();
    el.src = URL.createObjectURL(file);
    el.loop = false;
    el.crossOrigin = 'anonymous';
    this.src = ctx.createMediaElementSource(el);
    this.src.connect(this.node);
    this.node.connect(ctx.destination);   // the phone still plays it
    this.el = el;
    this.kind = 'file';
    el.volume = this.volume;
    await el.play();
    this._start();
    return el;
  }

  _start() {
    this._prev = null;
    this._gain = new AutoGain(-60, -20);
    this._last = [];
    this.onsets = 0;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => { try { this.sample(); } catch (e) {} },
                             TICK_MS);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.el) {
      try { this.el.pause(); URL.revokeObjectURL(this.el.src); } catch (e) {}
      this.el = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
      this.stream = null;
    }
    if (this.src) { try { this.src.disconnect(); } catch (e) {} this.src = null; }
    this.kind = 'none';
    this.level = 0;
  }

  // -- one analysis frame ---------------------------------------------
  sample() {
    const node = this.node, ctx = this.ctx;
    if (!node) return;
    node.getByteFrequencyData(this.freq);
    node.getByteTimeDomainData(this.time);
    this.slow.getByteFrequencyData(this.sfreq);

    let sum = 0;
    for (let i = 0; i < this.time.length; i++) {
      const v = (this.time[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.time.length);
    this.rawDb = 20 * Math.log10(rms + 1e-7);
    this.level = this._gain.push(this.rawDb);

    const sr = ctx.sampleRate, bins = this.freq.length;
    const hz = sr / 2 / bins;

    // spectral flux off the short window, where a kick is an edge
    let flux = 0;
    const prev = this._prev || (this._prev = new Float32Array(bins));
    for (let i = 1; i < bins; i++) {
      const f = i * hz;
      const m = this.freq[i] / 255;
      if (f >= BAND_LO && f <= BAND_HI) {
        const d = m - prev[i];
        if (d > 0) flux += d;
      }
      prev[i] = m;
    }
    this.flux = flux;

    // centroid and pitch off the long one
    const sbins = this.sfreq.length, shz = sr / 2 / sbins;
    let num = 0, den = 0;
    for (let i = 1; i < sbins; i++) {
      const f = i * shz;
      if (f < BAND_LO || f > BAND_HI) continue;
      const m = this.sfreq[i] / 255;
      num += f * m; den += m;
    }
    if (den > 1e-6) {
      const c = num / den;
      this.centroid = clamp(Math.log2(clamp(c, 100, 6000) / 100) / Math.log2(60),
                            0, 1);
    }

    // pitch class profile -> one hue.  Same construction as
    // mau5song.chroma: bin by pitch class, circular mean, so a chord
    // between two classes reads as a colour between them.
    const pv = this._pitchVec;
    pv.fill(0);
    for (let i = 1; i < sbins; i++) {
      const f = i * shz;
      if (f < PITCH_LO || f > PITCH_HI) continue;
      const pc = ((Math.round(12 * Math.log2(f / 440) + 69) % 12) + 12) % 12;
      pv[pc] += this.sfreq[i] / 255;
    }
    let px = 0, py = 0;
    for (let k = 0; k < 12; k++) {
      const a = 2 * Math.PI * k / 12;
      px += pv[k] * Math.cos(a); py += pv[k] * Math.sin(a);
    }
    if (px * px + py * py > 1e-9) {
      const want = fract(Math.atan2(py, px) / (2 * Math.PI));
      // Follow it, do not jump: pitch is a hue, and a hue that flicks
      // across the wheel between two frames reads as a fault.
      const d = ((want - this.pitch + 1.5) % 1) - 0.5;
      this.pitch = fract(this.pitch + d * 0.18);
    }

    this._three(hz, bins);
    this._beats(flux, ctx.currentTime);
    for (const nb of this._wanted) this._bands(nb);
  }

  // The named bands.  Energy is the band against its own history --
  // the top octave carries a twentieth of the bass and would never
  // register otherwise -- and punch is how fast that energy just
  // rose, which is what a hat or a kick is and what an overlay
  // riding a band actually wants.
  _three(hz, bins) {
    const EDGES = { bass: [30, 170], mid: [170, 2200], high: [2200, 10000] };
    for (const name of ['bass', 'mid', 'high']) {
      const [lo, hi] = EDGES[name];
      let s = 0, c = 0;
      for (let i = 1; i < bins; i++) {
        const f = i * hz;
        if (f < lo) continue;
        if (f > hi) break;
        s += this.freq[i] / 255; c++;
      }
      const m = c ? s / c : 0;
      const e = this._b3gain[name].push(20 * Math.log10(m + 1e-4));
      this.b3[name] = e;
      const d = e - this._b3prev[name];
      this._b3prev[name] = e;
      this.p3[name] = Math.max(d > 0 ? d * 6 : 0, this.p3[name] * 0.86);
      if (this.p3[name] > 1) this.p3[name] = 1;
    }
  }

  // Onsets by flux against its own recent distribution, then a tempo
  // from the gaps between them.  Deliberately modest: a wrong tempo is
  // worse than none, so the bpm is only published once enough gaps
  // agree, and beat_phase free-runs from the last onset until then.
  _beats(flux, now) {
    const h = this._fluxHist;
    h[this._fluxI++ % h.length] = flux;
    const n = Math.min(this._fluxI, h.length);
    let mean = 0;
    for (let i = 0; i < n; i++) mean += h[i];
    mean /= Math.max(n, 1);
    let varr = 0;
    for (let i = 0; i < n; i++) { const d = h[i] - mean; varr += d * d; }
    const sd = Math.sqrt(varr / Math.max(n, 1));

    const since = now - this.beatAt;
    if (n > 25 && flux > mean + 1.4 * sd && flux > 0.4 && since > 0.16) {
      this.beatAt = now;
      this.onsets++;
      this._last.push(now);
      if (this._last.length > 24) this._last.shift();
      this._tempo();
    }
  }

  _tempo() {
    const t = this._last;
    if (t.length < 6) return;
    // Fold every gap into one tempo octave, then take the median.  A
    // median rather than a mean because a missed beat doubles one gap
    // and an extra onset halves another, and those are the two things
    // that happen all the time.
    const g = [];
    for (let i = 1; i < t.length; i++) {
      let d = t[i] - t[i - 1];
      while (d > 0.86) d /= 2;
      while (d > 0 && d < 0.34) d *= 2;
      if (d >= 0.34 && d <= 0.86) g.push(d);
    }
    if (g.length < 4) return;
    g.sort((a, b) => a - b);
    const med = g[Math.floor(g.length / 2)];
    const spread = g[g.length - 1] - g[0];
    if (spread > med * 0.55) return;          // the gaps do not agree
    this.period = med;
    this.bpm = 60 / med;
  }

  // Asking for a width registers it: from then on it is recomputed on
  // every analysis frame rather than on every call.  The per-band
  // gain has a memory, and a gain that only advances when the render
  // loop happens to ask would adapt at whatever rate the link allows
  // -- which was measured in single figures.
  bands(nb) {
    if (!this._wanted.has(nb)) { this._wanted.add(nb); this._bands(nb); }
    return this._bandVal[nb] || new Float64Array(nb).fill(0.5);
  }

  _bands(nb) {
    let edges = this._bandCache[nb];
    const bins = this.freq ? this.freq.length : 0;
    if (!bins) return new Float64Array(nb);
    if (!edges) {
      const hz = this.ctx.sampleRate / 2 / bins;
      edges = new Int32Array(nb + 1);
      for (let b = 0; b <= nb; b++) {
        const f = BAND_LO * Math.pow(BAND_HI / BAND_LO, b / nb);
        edges[b] = clamp(Math.round(f / hz), 1, bins - 1);
      }
      this._bandCache[nb] = edges;
      this._bandGain = this._bandGain || {};
      this._bandGain[nb] = [];
      for (let b = 0; b < nb; b++) this._bandGain[nb].push(new AutoGain(-60, -20));
    }
    const out = new Float64Array(nb);
    for (let b = 0; b < nb; b++) {
      let lo = edges[b], hi = Math.max(edges[b + 1], lo + 1), s = 0;
      for (let i = lo; i < hi; i++) s += this.freq[i] / 255;
      const m = s / (hi - lo);
      // Each band against its own history, because the top octave
      // carries a twentieth of the energy of the bass and would
      // otherwise never move -- the same reason band_curves normalises
      // per band on the laptop.
      out[b] = this._bandGain[nb][b].push(20 * Math.log10(m + 1e-4));
    }
    this._bandVal[nb] = out;
    return out;
  }
}

// ----------------------------------------------------------------------
// The Music face.  Deliberately ignores `t` for everything live: the
// presets pass their render clock, and the honest answer to "what is
// the level at time t" from a microphone is "what it is now".  Only
// the beat grid uses a clock, and it uses the audio one.
// ----------------------------------------------------------------------
function LiveMusic(an) {
  return {
    bands: true,
    get bpm() { return an.bpm || 120; },
    levelAt() { return an.level; },
    pitchAt() { return an.pitch; },
    centroidAt() { return an.centroid; },
    bandsAt(t, n) { return an.bands(n); },
    bandAt(t, name, punch) {
      const src = punch ? an.p3 : an.b3;
      const v = src[name];
      return v === undefined ? an.level : v;
    },
    beatPhase() {
      if (!an.ctx) return 0;
      const p = an.period > 0 ? an.period : 0.5;
      return fract((an.ctx.currentTime - an.beatAt) / p);
    },
    beatIndex() {
      if (!an.ctx) return 0;
      const p = an.period > 0 ? an.period : 0.5;
      return (an.ctx.currentTime - an.beatAt) / p;
    },
    isDownbeat() {
      if (!an.ctx) return false;
      return (an.ctx.currentTime - an.beatAt) < 0.08;
    },
  };
}

// ----------------------------------------------------------------------
// TrackCache -- the song for each show, kept on this device.
//
// A show is half a show without its track, and the track cannot come
// with it: the controller has a megabyte or two of flash, and the
// songs are not ours to put on a web server.  So the first time a show
// is started the page asks for the file, and keeps it in IndexedDB
// under the show's name.  After that, starting the show is the whole
// interaction -- the song plays and the lights follow it.
//
// IndexedDB works on plain http, which matters: the controller cannot
// serve anything else.  Storage is per origin, so the controller's own
// access point and the home network are two caches, and a browser may
// evict either under pressure; a miss just asks again.
// ----------------------------------------------------------------------
class TrackCache {
  constructor(name) {
    this.name = name || 'mau5-tracks';
    this.db = null;
  }

  _open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      if (typeof indexedDB === 'undefined') {
        rej(new Error('this browser keeps no files for pages'));
        return;
      }
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('tracks');
      req.onsuccess = () => { this.db = req.result; res(this.db); };
      req.onerror = () => rej(req.error);
    });
  }

  async _tx(mode, fn) {
    const db = await this._open();
    return new Promise((res, rej) => {
      const tx = db.transaction('tracks', mode);
      const out = fn(tx.objectStore('tracks'));
      tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  }

  // A File back, or null.  Never throws: no cache is the same as a miss.
  async get(show) {
    try {
      const rec = await this._tx('readonly', (st) => st.get(show));
      if (!rec || !rec.blob) return null;
      return new File([rec.blob], rec.name || show, { type: rec.blob.type });
    } catch (e) { return null; }
  }

  async put(show, file) {
    try {
      await this._tx('readwrite', (st) => st.put({ name: file.name, blob: file }, show));
      return true;
    } catch (e) { return false; }   // full, private mode, or no IndexedDB
  }

  async forget(show) {
    try { await this._tx('readwrite', (st) => st.delete(show)); } catch (e) {}
  }
}

const api = { Analyser, LiveMusic, AutoGain, TrackCache };
root.MAU5 = Object.assign(root.MAU5 || {}, api);
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
