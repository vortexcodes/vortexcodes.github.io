// ----------------------------------------------------------------------
// simulator.js -- the helmet, without the helmet.
//
// Every LED is drawn in the CAD slot or ear tube it actually occupies,
// inside the helmet's own CAD, and lit by the same engine, the same
// power guard and the same show player that drive the real thing.  The
// tests render them in both languages and compare the results, so a
// preset here is the preset on the helmet to within rounding.
//
// The point of putting it on a web page is the audio.  Play any song
// and the analyser works on it live -- loudness, bands, pitch, onsets,
// tempo -- so an effect can be written and judged against the music
// somebody actually wants to wear it to, with no helmet, no controller
// and nothing installed.
// ----------------------------------------------------------------------

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const M = globalThis.MAU5;
const D = globalThis.MAU5_DATA;

// ---------------------------------------------------------------- data
function dec(b64, C) {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const v = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) v[i] = bin.charCodeAt(i);
  return new C(buf);
}
const geo = { n: D.n, regions: D.regions };
for (const k of Object.keys(D.f32)) geo[k] = dec(D.f32[k], Float32Array);
for (const k of Object.keys(D.i16)) geo[k] = dec(D.i16[k], Int16Array);

const helmet = M.makeHelmet(geo);
const guard = new M.PowerGuard(D.power);
const frame = new Float32Array(helmet.n * 3);
const an = new M.Analyser();
const tracks = new M.TrackCache('mau5-sim-tracks');

const state = {
  preset: 'rainbow', inst: null, params: {}, music: null,
  show: null, showName: '', showT0: null, bri: 1.0, t0: performance.now(),
  spin: true,
};

// ------------------------------------------------------------- the scene
const host = document.getElementById('view');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d10);
const camera = new THREE.PerspectiveCamera(42, 1, 1, 8000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
host.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotateSpeed = 0.7;

scene.add(new THREE.HemisphereLight(0xc8d2dc, 0x101214, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(300, 500, 700);
scene.add(key);

// The map is in the CAD's frame -- +z up, the face looking along -y --
// and three.js wants +y up, so x stays, y becomes z and z becomes -y.
// The same rotation carries the CAD mesh, which shares that frame.
const pos = new Float32Array(helmet.n * 3);
for (let i = 0; i < helmet.n; i++) {
  pos[i*3] = geo.xyz[i*3];
  pos[i*3+1] = geo.xyz[i*3+2];
  pos[i*3+2] = -geo.xyz[i*3+1];
}

// The printed helmet, from the same CAD the LED slots came from.  It
// matters more than it looks: the shell LEDs sit in its slots and the
// ear LEDs inside its tubes, so a map that was wrong would visibly
// float off it.  Drawn dim and slightly see-through, the way white
// PETG reads in a dark room.
// Flat-shaded: the mesh carries no normals (it is positions and
// triangles, nothing else), and per-face lighting needs none -- it
// also reads as a CAD model, which is what it is.
const shellMat = new THREE.MeshStandardMaterial({
  color: 0x9aa3ae, roughness: 0.85, metalness: 0.0, flatShading: true,
  transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
});
let bodyMesh = null;
new GLTFLoader().load('mau5/helmet.glb?v=3b3e687798', (g) => {
  bodyMesh = g.scene;
  bodyMesh.rotation.x = -Math.PI / 2;
  bodyMesh.traverse((o) => { if (o.isMesh) { o.material = shellMat; o.renderOrder = 0; } });
  bodyMesh.visible = $('body').checked;
  scene.add(bodyMesh);
}, undefined, () => { $('body').disabled = true; });

// A soft round sprite, drawn once.  An LED behind 0.8 mm of PETG is a
// glowing disc with a halo, not a point, and additive blending of
// these is what makes a dense patch read as a lit surface rather than
// as 622 dots.
function dot() {
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d').createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  const x = c.getContext('2d');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

const colors = new Float32Array(helmet.n * 3);
const g3 = new THREE.BufferGeometry();
g3.setAttribute('position', new THREE.BufferAttribute(pos, 3));
g3.setAttribute('color', new THREE.BufferAttribute(colors, 3));
// The unlit LEDs, so where they are shows when nothing is on.
const unlit = new THREE.Points(g3, new THREE.PointsMaterial({
  size: 7, color: 0x4a515c, transparent: true, opacity: 0.9, depthWrite: false,
}));
unlit.renderOrder = 1;
scene.add(unlit);

// Then the light, additively and without depth testing.  A shell of
// clear PETG with the LEDs 0.8 mm behind it is translucent -- the far
// side really does show through -- so an LED at the back glowing
// through the front is not a cheat, it is what the thing does.
const points = new THREE.Points(g3, new THREE.PointsMaterial({
  size: 30, map: dot(), vertexColors: true, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  sizeAttenuation: true,
}));
points.renderOrder = 2;
scene.add(points);

// Frame the helmet from the points themselves rather than from
// numbers typed in once: the map has been rebuilt more than once and
// the ears moved by centimetres each time.
let HOME = { pos: new THREE.Vector3(0, 0, 900), tgt: new THREE.Vector3() };
function frameIt() {
  g3.computeBoundingSphere();
  const b = g3.boundingSphere;
  const d = b.radius / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.12;
  HOME = { pos: new THREE.Vector3(b.center.x, b.center.y + b.radius * 0.15,
                                  b.center.z + d),
           tgt: b.center.clone() };
  camera.position.copy(HOME.pos);
  controls.target.copy(HOME.tgt);
  camera.near = Math.max(1, d * 0.01);
  camera.far = d * 10;
  camera.updateProjectionMatrix();
  controls.update();
}

function resize() {
  const w = host.clientWidth, h = host.clientHeight || 520;
  // updateStyle must stay on: with it off the canvas keeps its
  // backing-store size as CSS pixels, so on a 2x display it is drawn
  // twice the size of its container and you see one corner of the
  // helmet in the wrong place.
  renderer.setSize(w, h);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ------------------------------------------------------------- the loop
let frames = 0, lastReport = performance.now();

function showTime(now) {
  if (an.el) return an.el.currentTime;          // the song is the clock
  return state.showT0 === null ? null : (now - state.showT0) / 1000;
}

function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const t = (now - state.t0) / 1000;
  const st = state.show ? showTime(now) : null;

  if (state.show && st !== null) {
    const cue = state.show.frame(st, state.music, frame);
    setText('cue', cue ? cue.preset + (cue.overlay ? ' + ' + cue.overlay.preset : '')
                       : '(gap)');
    setText('clock', mmss(st) + ' / ' + mmss(state.show.duration));
  } else if (state.show) {
    frame.fill(0);                               // chosen, not started
  } else {
    frame.fill(0);
    state.inst.render(helmet, t, state.music, frame);
  }
  // a show's beat pulse goes on after the guard, which would flatten it
  const rep = guard.apply(frame, frame, now / 1000,
                          state.show && st !== null ? state.show.gain : 1);
  // A display lift, and only a display lift.  The guard holds the
  // helmet to about a tenth of full white, which on a real LED is
  // still plainly bright and on a screen is nearly black -- the eye
  // and the sensor disagree about what "dim" means.  The numbers
  // under the view are the real ones; this only makes the picture
  // look like what you would actually see in the room.
  const k = state.bri;
  for (let i = 0; i < helmet.n * 3; i++) {
    colors[i] = Math.pow(frame[i] / 255, 0.45) * k;
  }
  g3.attributes.color.needsUpdate = true;
  frames++;
  if (now - lastReport > 400) {
    setText('fps', (frames * 1000 / (now - lastReport)).toFixed(0));
    frames = 0; lastReport = now;
    setText('ma', rep.total_ma.toFixed(0));
    setText('w', rep.watts.toFixed(1));
    setText('heat', rep.thermal ? rep.thermal.full_pct.toFixed(0) + '%' : '—');
    if (an.running) {
      setText('alvl', (an.level * 100).toFixed(0) + '%');
      setText('apitch', NOTES[Math.round(an.pitch * 12) % 12]);
      setText('abpm', an.bpm ? an.bpm.toFixed(0) : '—');
    }
    showButtons();
  }
  drawScope();
  controls.autoRotate = state.spin;
  controls.update();
  renderer.render(scene, camera);
}

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function $(id) { return document.getElementById(id); }
function setText(id, v) { const e = $(id); if (e) e.textContent = v; }
function mmss(v) {
  v = Math.max(0, Math.round(v));
  return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
}
function pretty(name) { return name.replace(/^deadmau5 - /, ''); }

// ------------------------------------------------------------ effects
function choosePreset(name) {
  leaveShow();
  state.preset = name;
  state.inst = M.make(name, state.params = {}, helmet, D.fonts);
  state.t0 = performance.now();
  for (const b of document.querySelectorAll('#grid button'))
    b.classList.toggle('on', b.dataset.name === name);
  setText('cue', name);
  setText('clock', '—');
  buildParams(name);
}

function buildParams(name) {
  const box = $('params');
  box.innerHTML = '';
  const spec = (D.presets[name] || {}).spec || [];
  for (const s of spec) {
    const row = document.createElement('label');
    row.className = 'row';
    const tag = document.createElement('span');
    tag.textContent = s.name;
    row.appendChild(tag);
    let inp;
    const remake = () => { state.inst = M.make(name, state.params, helmet, D.fonts); };
    // `kind`, as Preset.spec() names it and the phone page reads it.
    // This read `type`, which no spec has, so every parameter fell
    // through to `continue` and the box stayed empty -- and hidden by
    // #params:empty -- for all 38 effects.
    if (s.kind === 'color') {
      inp = document.createElement('input');
      inp.type = 'color';
      const c = s.value || [255, 0, 0];
      inp.value = '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      inp.oninput = () => {
        const h = inp.value;
        state.params[s.name] = [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16),
                                parseInt(h.slice(5,7),16)];
        remake();
      };
    } else if (s.kind === 'bool') {
      inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.checked = !!s.value;
      inp.onchange = () => { state.params[s.name] = inp.checked; remake(); };
    } else if (s.kind === 'number') {
      inp = document.createElement('input');
      inp.type = 'range';
      inp.min = s.min !== undefined ? s.min : 0;
      inp.max = s.max !== undefined ? s.max : 10;
      inp.step = s.step !== undefined ? s.step
               : ((inp.max - inp.min) > 20 ? 1 : 0.05);
      inp.value = s.value;
      inp.oninput = () => { state.params[s.name] = +inp.value; remake(); };
    } else if (s.kind === 'text') {
      inp = document.createElement('input');
      inp.type = 'text';
      inp.value = s.value;
      inp.oninput = () => { state.params[s.name] = inp.value; remake(); };
    } else { continue; }
    row.appendChild(inp);
    box.appendChild(row);
  }
}

// -------------------------------------------------------------- music
function audioOn(kind) {
  state.music = kind === 'none' ? null : M.LiveMusic(an);
  for (const [id, k] of [['afile','file'], ['atab','tab'], ['amic','mic'], ['aoff','none']])
    $(id).classList.toggle('on', kind === k);
  setText('asrc', { file: 'the song', tab: 'your computer\'s audio', mic: 'the microphone',
                    none: 'nothing' }[kind]);
  if (kind === 'none') { setText('alvl', '—'); setText('apitch', '—'); setText('abpm', '—'); }
}

// An effect that ignores music, with music just switched on, looks broken.
const REACTIVE = ['spectrum', 'pitchwheel', 'bloom', 'eq', 'vu', 'beatpulse', 'heartbeat', 'sparkle'];
function listening() {
  if (!state.show && REACTIVE.indexOf(state.preset) < 0) choosePreset('spectrum');
}

// -------------------------------------------------------------- tuning
// Each slider writes straight into the analyser, so a change shows on the next
// tick.  Settings are kept per song, by name, in this browser.
const TUNERS = [
  ['bassTop', 'Bass up to', 60, 400, 5, v => v + ' Hz', 'Where bass stops and mid starts'],
  ['highFrom', 'High from', 800, 6000, 50, v => (v / 1000).toFixed(2) + ' kHz', 'Where mid stops and high starts'],
  ['rise', 'Attack', 0.1, 1, 0.01, v => v.toFixed(2), 'How fast a band jumps up. Higher is snappier'],
  ['fall', 'Release', 0.02, 0.5, 0.01, v => v.toFixed(2), 'How fast a band falls back. Lower is smoother'],
  ['window', 'Range', 6, 30, 1, v => v + ' dB', 'How wide the quiet-to-loud scale can shrink. Lower reacts more to small changes'],
  ['contrast', 'Contrast', 0.4, 3, 0.05, v => v.toFixed(2), 'Above 1, only the loud moments light up. Below 1, everything stays lit'],
  ['beatK', 'Beat threshold', 0.4, 3.5, 0.05, v => v.toFixed(2), 'How far above average a change must be to count as a beat. Raise it if it finds too many'],
  ['beatGap', 'Beat gap', 0.08, 0.6, 0.01, v => Math.round(v * 1000) + ' ms', 'The least time between two beats. Raise it to ignore hi-hats'],
];
let tuneKey = 'mau5tune:default';

function tuneShow() {
  for (const [k, , , , , fmt] of TUNERS) {
    const inp = $('t_' + k);
    if (!inp) continue;
    inp.value = an.tune[k];
    $('o_' + k).textContent = fmt(an.tune[k]);
  }
}

function tuneSave() {
  try { localStorage.setItem(tuneKey, JSON.stringify(an.tune)); } catch (e) {}
  setText('tunesaved', tuneKey === 'mau5tune:default' ? ''
          : 'Saved in this browser for ' + tuneKey.slice(9) + '.');
}

// The settings for this song, if it has been tuned here before.
function tuneFor(name) {
  tuneKey = 'mau5tune:' + (name || 'default');
  Object.assign(an.tune, M.TUNE);
  try { Object.assign(an.tune, JSON.parse(localStorage.getItem(tuneKey) || '{}')); } catch (e) {}
  tuneShow();
  setText('tunesaved', name && localStorage.getItem(tuneKey) ? 'Using your saved settings for ' + name + '.' : '');
}

function buildTuners() {
  const box = $('tuners');
  for (const [k, label, lo, hi, step, fmt, help] of TUNERS) {
    const row = document.createElement('label');
    row.className = 'row';
    row.title = help;
    const tag = document.createElement('span');
    tag.className = 'tn';
    tag.textContent = label;
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = lo; inp.max = hi; inp.step = step; inp.id = 't_' + k;
    const out = document.createElement('output');
    out.id = 'o_' + k;
    inp.oninput = () => {
      an.tune[k] = +inp.value;
      out.textContent = fmt(an.tune[k]);
      tuneSave();
    };
    row.append(tag, inp, out);
    box.appendChild(row);
  }
  $('tunereset').onclick = () => {
    Object.assign(an.tune, M.TUNE);
    try { localStorage.removeItem(tuneKey); } catch (e) {}
    tuneShow();
    setText('tunesaved', '');
  };
  tuneShow();
}

// What the analyser is seeing, drawn the same width as the sliders above it.
const fluxTrail = new Float32Array(240), gateTrail = new Float32Array(240), beatTrail = new Uint8Array(240);
let trailAt = 0, lastBeat = 0;

function drawScope() {
  const cv2 = $('scope');
  const w = cv2.clientWidth * devicePixelRatio, h = 150 * devicePixelRatio;
  if (cv2.width !== w || cv2.height !== h) { cv2.width = w; cv2.height = h; }
  const c = cv2.getContext('2d');
  c.clearRect(0, 0, w, h);
  if (!an.running || !an.freq) return;
  const specH = h * 0.42, barsY = specH + h * 0.03, barsH = h * 0.2, fluxY = barsY + barsH + h * 0.03, fluxH = h - fluxY;
  // spectrum on a log axis, 30 Hz to 12 kHz
  const hz = an.ctx.sampleRate / 2 / an.freq.length;
  const xOf = (f) => Math.log(f / 30) / Math.log(400) * w;
  c.fillStyle = '#d9a35c';
  for (let i = 1; i < an.freq.length; i++) {
    const f = i * hz;
    if (f < 30 || f > 12000) continue;
    const x0 = xOf(f), x1 = xOf(f + hz), v = an.freq[i] / 255 * specH;
    c.fillRect(x0, specH - v, Math.max(1, x1 - x0), v);
  }
  c.strokeStyle = '#46c0aa';
  c.lineWidth = devicePixelRatio;
  for (const f of [an.tune.bassTop, an.tune.highFrom]) {
    c.beginPath(); c.moveTo(xOf(f), 0); c.lineTo(xOf(f), specH); c.stroke();
  }
  // the three bands, as the effects get them
  const shape = (v) => Math.pow(Math.max(v, 0), an.tune.contrast);
  [['bass', '#e4663a'], ['mid', '#46c0aa'], ['high', '#78aaff']].forEach(([k, col], i) => {
    const y = barsY + i * barsH / 3;
    c.fillStyle = '#20252b';
    c.fillRect(0, y, w, barsH / 3 - 2);
    c.fillStyle = col;
    c.fillRect(0, y, w * shape(an.b3[k]), barsH / 3 - 2);
  });
  // change, the beat line, and each beat it called
  if (an.beatAt !== lastBeat) { lastBeat = an.beatAt; beatTrail[trailAt] = 1; }
  else beatTrail[trailAt] = 0;
  fluxTrail[trailAt] = an.flux;
  gateTrail[trailAt] = Math.max(an.fluxMean + an.tune.beatK * an.fluxSd, 0.4);
  trailAt = (trailAt + 1) % fluxTrail.length;
  let top = 1;
  for (let i = 0; i < fluxTrail.length; i++) top = Math.max(top, fluxTrail[i], gateTrail[i]);
  const px = (k) => k / fluxTrail.length * w, py = (v) => fluxY + fluxH - v / top * fluxH;
  for (let k = 0; k < fluxTrail.length; k++) {
    const i = (trailAt + k) % fluxTrail.length;
    if (beatTrail[i]) { c.fillStyle = '#f2f4f5'; c.fillRect(px(k), fluxY, Math.max(2, devicePixelRatio * 2), fluxH); }
  }
  for (const [arr, col] of [[fluxTrail, '#d9a35c'], [gateTrail, '#e4663a']]) {
    c.strokeStyle = col;
    c.beginPath();
    for (let k = 0; k < arr.length; k++) {
      const v = arr[(trailAt + k) % arr.length];
      if (k) c.lineTo(px(k), py(v)); else c.moveTo(px(k), py(v));
    }
    c.stroke();
  }
}

// Titles never match exactly -- a show is named after a file and the
// visitor's copy is named however their library names it -- so this
// compares words, Jaccard over the union, the same rule the phone uses
// to follow Spotify.  Containment would hand "Strobe (Dimension Remix)"
// to the show called "Strobe".
function words(s) {
  return new Set(String(s).toLowerCase()
    .replace(/\.(mp3|m4a|aac|ogg|opus|wav|flac)$/, '')
    .replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter(w => w && w !== 'the' && w !== 'a' && w !== 'with'));
}
function matchShow(filename) {
  let best = '', score = 0;
  const B = words(filename);
  for (const name of Object.keys(D.shows || {})) {
    const A = words(name);
    let n = 0;
    for (const w of A) if (B.has(w)) n++;
    const s = n / (A.size + B.size - n || 1);
    if (s > score) { score = s; best = name; }
  }
  if (score >= 0.5) return best;
  // A bare file name is shorter than a title -- "leavemealone.mp3" --
  // so failing that, the one show whose title holds every word of it.
  if (![...B].some(w => w.length >= 5)) return '';
  const all = Object.keys(D.shows || {}).filter(n => [...B].every(w => words(n).has(w)));
  return all.length === 1 ? all[0] : '';
}

// One entry point for every song, however it arrived.  `forShow` is
// the show it was chosen for, when it came from the show box;
// otherwise the file's name picks the show, if any.
async function playSong(file, forShow) {
  const name = forShow || matchShow(file.name);
  try {
    if (!name) leaveShow();                   // not a show's song: just effects
    else if (name !== state.showName) enterShow(name);
    const el = await an.useFile(file);
    an.setVolume(+$('vol').value / 100);
    audioOn('file');
    tuneFor(file.name.replace(/\.[a-z0-9]+$/i, ''));
    listening();
    el.onended = () => { an.stop(); audioOn('none'); stopShow(); };
    if (name) {
      state.showT0 = null;
      const kept = await tracks.put(name, file);
      setText('showat', 'Playing ' + file.name + (kept
        ? '. This browser keeps it, so Start plays it next time.' : '.'));
      setText('why', 'This song has its own show, which follows the song on its own, so the '
              + 'sliders don\'t change it. Pick an effect to tune one to this song.');
    } else {
      setText('why', 'Playing ' + file.name + '. The analysis is live, so the '
              + 'effects follow it.');
    }
    showButtons();
  } catch (err) { setText('why', String(err.message || err)); }
}

// ------------------------------------------------------------- shows
function enterShow(name) {
  if (an.el) { an.stop(); audioOn('none'); }
  state.show = new M.ShowPlayer(D.shows[name], helmet, D);
  state.showName = name;
  state.showT0 = null;
  $('showpick').value = name;
  $('params').innerHTML = '';
  for (const b of document.querySelectorAll('#grid button')) b.classList.remove('on');
  setText('cue', '—');
  setText('clock', '0:00 / ' + mmss(state.show.duration));
  readyText(name);
  showButtons();
}

// Leaving a show keeps whatever is playing: the song goes on driving
// the effects live, which is what clicking an effect mid-song means.
function leaveShow() {
  if (!state.show) return;
  state.show = null; state.showName = ''; state.showT0 = null;
  $('showpick').value = '';
  setText('cue', state.preset);
  setText('clock', '—');
  for (const b of document.querySelectorAll('#grid button'))
    b.classList.toggle('on', b.dataset.name === state.preset);
  setText('showat', 'Each show was choreographed to one song. Start plays your copy '
          + 'of it; the first time, you pick the file and this browser keeps it.');
  showButtons();
}

function stopShow() {
  if (an.el) { an.stop(); audioOn('none'); }
  state.showT0 = null;
  if (state.showName) readyText(state.showName);
  showButtons();
}

async function readyText(name) {
  const f = await tracks.get(name);
  if (state.showName !== name) return;
  setText('showat', f
    ? 'Ready. Start plays ' + f.name + ', which this browser kept from last time.'
    : 'Built for ' + pretty(name) + '. Start asks for your copy of the song once '
      + 'and keeps it here; it is never uploaded.');
}

function running() { return !!(state.show && (an.el || state.showT0 !== null)); }

function showButtons() {
  const on = !!state.show;
  $('showgo').disabled = !on;
  $('showgo').textContent = running() ? 'Stop' : 'Start';
  $('showgo').classList.toggle('on', running());
  $('showsilent').disabled = !on;
  $('showsilent').classList.toggle('on', on && !an.el && state.showT0 !== null);
  $('showpp').disabled = !an.el;
  $('showpp').textContent = an.el && an.el.paused ? 'Play' : 'Pause';
}

async function startShow() {
  const name = state.showName;
  if (!name) return;
  const f = await tracks.get(name);
  if (f) { await playSong(f, name); return; }
  $('apick').dataset.forShow = name;
  $('apick').click();
}

// ------------------------------------------------------------- wiring
{
  const grid = $('grid');
  for (const name of Object.keys(D.presets)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.title = name;
    b.dataset.name = name;
    b.onclick = () => choosePreset(name);
    grid.appendChild(b);
  }
  const sel = $('showpick');
  for (const name of Object.keys(D.shows || {})) {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = pretty(name);
    sel.appendChild(o);
  }
  sel.onchange = () => { if (sel.value) enterShow(sel.value); else choosePreset(state.preset); };
  $('showgo').onclick = () => { if (running()) stopShow(); else startShow(); };
  $('showsilent').onclick = () => {
    if (!state.show) return;
    if (an.el) { an.stop(); audioOn('none'); }
    state.showT0 = performance.now();
    setText('showat', 'Lights only, no song. Start plays it with the music.');
    showButtons();
  };
  $('showpp').onclick = () => {
    if (!an.el) return;
    if (an.el.paused) an.el.play(); else an.el.pause();
    showButtons();
  };

  $('afile').onclick = () => { $('apick').dataset.forShow = ''; $('apick').click(); };
  $('apick').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    const forShow = e.target.dataset.forShow || '';
    e.target.value = '';
    e.target.dataset.forShow = '';
    if (f) await playSong(f, forShow);
  };
  $('amic').onclick = async () => {
    try {
      leaveShow();
      await an.useMic(); audioOn('mic');
      tuneFor('');
      listening();
      setText('why', 'Listening: anything this device can hear drives the helmet.');
    } catch (err) { setText('why', String(err.message || err)); }
  };
  $('atab').onclick = async () => {
    try {
      leaveShow();
      await an.useTab(); audioOn('tab');
      tuneFor('');
      listening();
      setText('why', 'Following what you shared. It keeps playing where it is, and you can change songs there.');
    } catch (err) {
      audioOn('none');
      // Closing the picker is a choice, and it needs no scolding.
      if (err && err.name === 'NotAllowedError') setText('why', '');
      else setText('why', String(err.message || err));
    }
  };
  an.onended = () => { audioOn('none'); setText('why', 'Sharing stopped.'); };
  // A song dropped anywhere on the helmet, from the desktop or a music folder
  const plate = document.querySelector('.plate');
  for (const ev of ['dragenter', 'dragover']) {
    plate.addEventListener(ev, (e) => { e.preventDefault(); plate.classList.add('drop'); });
  }
  plate.addEventListener('dragleave', () => plate.classList.remove('drop'));
  plate.addEventListener('drop', (e) => {
    e.preventDefault();
    plate.classList.remove('drop');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && (f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(f.name))) playSong(f, '');
    else setText('why', 'That doesn\'t look like a song file.');
  });
  $('aoff').onclick = () => { an.stop(); audioOn('none'); setText('why', ''); stopShow(); };
  $('vol').oninput = (e) => an.setVolume(+e.target.value / 100);
  $('bri').oninput = (e) => { state.bri = +e.target.value / 100; };
  $('spin').onchange = (e) => { state.spin = e.target.checked; };
  $('body').onchange = (e) => { if (bodyMesh) bodyMesh.visible = e.target.checked; };
  $('reset').onclick = () => {
    camera.position.copy(HOME.pos);
    controls.target.copy(HOME.tgt);
  };

  if (!M.Analyser.micPossible()) {
    $('amic').disabled = true;
    $('amic').title = 'needs a secure page';
  }
  if (!M.Analyser.tabPossible()) {
    $('atab').disabled = true;
    $('atab').title = 'this browser cannot share audio; Chrome or Edge on a computer can';
  }
  buildTuners();
  setText('leds', helmet.n);
  setText('budget', D.power.budget_ma);
  setText('npresets', Object.keys(D.presets).length);
}

resize();
frameIt();
choosePreset('rainbow');
audioOn('none');
tick();
