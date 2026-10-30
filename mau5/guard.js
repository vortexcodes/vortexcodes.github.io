// guard.js -- mau5power's PowerGuard, in the language the phone speaks.
//
// Offline the phone is the only thing between a preset and the strips.
// The Python guard lives in Pixels.send, which nothing here goes
// through, so without this file a browser tab would be free to ask for
// 622 WS2815s at full white: about 11.8 A, against a budget of 1.0 A.
//
// So it is ported, from the same data/cal/power.json the Mac uses --
// the regions, their ceilings, the shed weights, the floors and the
// thermal bucket.  test_mau5.py drives both implementations with the
// same random frames and the same clock and fails if any LED differs.
//
// It is not the only guard.  WLED's own automatic brightness limiter
// is set from the same budget by `mau5offline.py config`, because a
// limiter that a UI bug can skip is not a limiter.  This one shapes
// the frame; that one is the backstop.

'use strict';

(function (root) {

const MA_PER_LED_FULL_WHITE = 19.0;   // WS2815 at 12 V
const MA_PER_LED_STANDBY = 1.0;       // drawn whenever the rail is live

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

class ThermalBudget {
  constructor(o) {
    o = o || {};
    this.sustained_w = o.sustained_w === undefined ? 11.0 : o.sustained_w;
    this.burst_j = o.burst_j === undefined ? 900.0 : o.burst_j;
    this.max_w = o.max_w || null;
    this.standby_w = o.standby_w || 0.0;
    this.ramp = o.ramp === undefined ? 0.30 : o.ramp;
    this.level = 0.0;
    this._last = null;
  }

  allowanceW() {
    const head = 1.0 - this.level / Math.max(this.burst_j, 1e-6);
    const k = clamp(head / Math.max(this.ramp, 1e-6), 0.0, 1.0);
    const sustainedLed = Math.max(this.sustained_w - this.standby_w, 0.0);
    const top = this.max_w ? (this.max_w - this.standby_w) : sustainedLed;
    return sustainedLed + Math.max(top - sustainedLed, 0.0) * k;
  }

  update(ledWatts, now) {
    if (this._last === null) { this._last = now; return this.allowanceW(); }
    const dt = Math.max(0.0, Math.min(now - this._last, 5.0));
    this._last = now;
    this.level += (ledWatts + this.standby_w - this.sustained_w) * dt;
    this.level = clamp(this.level, 0.0, this.burst_j);
    return this.allowanceW();
  }
}

class PowerGuard {
  // `cfg` is data/cal/power.json, unchanged -- the same file the Mac
  // reads, shipped into the bundle so the two cannot drift apart.
  constructor(cfg) {
    this.count = cfg.count | 0;
    this.budget_ma = cfg.budget_ma;
    this.link_ma = cfg.link_ma || 0.0;
    this.default_ceiling = cfg.default_ceiling === undefined ? 32 : cfg.default_ceiling;
    this.regions = (cfg.regions || []).slice().sort((a, b) => a.lo - b.lo);
    const n = this.count;
    this.ceil = new Float32Array(n).fill(this.default_ceiling);
    this.shed = new Float32Array(n).fill(4.0);
    this.floor = new Float32Array(n);
    for (const r of this.regions) {
      const lo = Math.max(0, r.lo), hi = Math.min(n - 1, r.hi);
      for (let i = lo; i <= hi; i++) {
        this.ceil[i] = r.ceiling;
        this.shed[i] = r.shed;
        this.floor[i] = Math.min(r.floor, r.ceiling);
      }
    }
    const th = cfg.thermal;
    this.thermal = th ? new ThermalBudget(th) : null;
    this._per = new Float64Array(n);
    this._fs = new Float64Array(n);
    this._omx = new Float64Array(n);
  }

  frameMa(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i];
    return s / (3 * 255.0) * MA_PER_LED_FULL_WHITE;
  }

  standbyMa() { return this.count * MA_PER_LED_STANDBY; }

  linkLimitMa() {
    if (!this.link_ma) return null;
    return Math.max(0.0, this.link_ma - this.standbyMa());
  }

  // Clamp a frame in place.  `asked` is the untouched render, `out` is
  // the buffer that gets sent; they may be the same array, in which
  // case the "was it lit before the ceiling" test uses the clipped
  // value, exactly as the Python does when handed its own output.
  // gain (at most 1) is applied after every limit -- the beat pulse; see
  // PowerGuard.apply in mau5power.py for why it cannot go in the frame
  apply(asked, out, now, gain) {
    const n = this.count;
    if (out !== asked) out.set(asked.subarray(0, n * 3));
    for (let i = 0; i < n * 3; i++) out[i] = clamp(out[i], 0, 255);
    const askedMa = this.frameMa(out);

    for (let i = 0; i < n; i++) {
      const c = this.ceil[i];
      if (out[i * 3] > c) out[i * 3] = c;
      if (out[i * 3 + 1] > c) out[i * 3 + 1] = c;
      if (out[i * 3 + 2] > c) out[i * 3 + 2] = c;
    }
    const afterCeiling = this.frameMa(out);

    const hit = [];
    for (const r of this.regions) {
      const lo = Math.max(0, r.lo), hi = Math.min(n - 1, r.hi);
      if (hi < lo) continue;
      let s = 0;
      for (let i = lo * 3; i < (hi + 1) * 3; i++) s += out[i];
      const ma = s / (3 * 255.0) * MA_PER_LED_FULL_WHITE;
      if (ma > r.budget_ma && ma > 0) {
        const k = r.budget_ma / ma;
        for (let i = lo * 3; i < (hi + 1) * 3; i++) out[i] *= k;
        hit.push(r.name);
      }
    }
    const afterRegion = this.frameMa(out);

    let budget = this.budget_ma;
    const link = this.linkLimitMa();
    if (link !== null) budget = Math.min(budget, link);
    if (this.thermal) {
      budget = Math.min(budget, Math.max(this.thermal.allowanceW() / 12.0 * 1000.0, 0.0));
    }

    let governed = false, floored = false;
    if (afterRegion > budget && afterRegion > 0) {
      const per = this._per, fs = this._fs, omx = this._omx;
      for (let i = 0; i < n; i++) {
        const r = out[i * 3], g = out[i * 3 + 1], b = out[i * 3 + 2];
        per[i] = (r + g + b) / (3.0 * 255.0) * MA_PER_LED_FULL_WHITE;
        omx[i] = Math.max(r, Math.max(g, b));
        const amx = Math.max(asked[i * 3],
                             Math.max(asked[i * 3 + 1], asked[i * 3 + 2]));
        fs[i] = (amx > 0 && omx[i] > 1e-6) ? clamp(this.floor[i] / omx[i], 0, 1) : 0;
      }
      let floorMa = 0;
      for (let i = 0; i < n; i++) floorMa += per[i] * fs[i];
      if (floorMa > budget) fs.fill(0);
      let loS = 0.0, hiS = 1.0;
      for (let it = 0; it < 40; it++) {
        const mid = (loS + hiS) / 2.0;
        let s = 0;
        for (let i = 0; i < n; i++) s += per[i] * Math.max(Math.pow(mid, this.shed[i]), fs[i]);
        if (s > budget) hiS = mid; else loS = mid;
      }
      for (let i = 0; i < n; i++) {
        const base = Math.pow(loS, this.shed[i]);
        const k = Math.max(base, fs[i]);
        if (fs[i] > base) floored = true;
        out[i * 3] *= k; out[i * 3 + 1] *= k; out[i * 3 + 2] *= k;
      }
      governed = true;
    }

    const g = gain === undefined ? 1.0 : Math.min(Math.max(gain, 0.0), 1.0);
    if (g < 1.0) for (let i = 0; i < n * 3; i++) out[i] *= g;
    const final = this.frameMa(out);
    if (this.thermal) this.thermal.update(final * 12.0 / 1000.0, now);
    // Python's apply returns uint8, which truncates rather than rounds.
    // The frame that leaves here is the frame that goes on the wire, so
    // it has to be the same integers or the two implementations are
    // only approximately the same guard.
    for (let i = 0; i < n * 3; i++) out[i] = Math.trunc(clamp(out[i], 0, 255));
    return {
      asked_ma: askedMa, after_ceiling_ma: afterCeiling,
      after_region_ma: afterRegion, sent_ma: final,
      standby_ma: this.standbyMa(), total_ma: final + this.standbyMa(),
      amps: (final + this.standbyMa()) / 1000.0,
      watts: (final + this.standbyMa()) * 12 / 1000.0,
      ceiling_hit: askedMa > afterCeiling + 0.5,
      regions_hit: hit, governor_hit: governed, floor_hit: floored,
      budget_ma: budget,
      thermal: this.thermal ? {
        level_j: this.thermal.level, burst_j: this.thermal.burst_j,
        full_pct: 100.0 * this.thermal.level / Math.max(this.thermal.burst_j, 1e-6),
        allowance_w: this.thermal.allowanceW(),
      } : null,
    };
  }
}

const api = { PowerGuard, ThermalBudget,
              MA_PER_LED_FULL_WHITE, MA_PER_LED_STANDBY };
root.MAU5 = Object.assign(root.MAU5 || {}, api);
if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof globalThis !== 'undefined' ? globalThis : this);
