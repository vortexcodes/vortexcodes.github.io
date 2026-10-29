// ----------------------------------------------------------------------
// simulator.js -- the helmet, without the helmet.
//
// Every LED is drawn where the camera measured it, in three
// dimensions, and lit by the same engine, the same power guard and
// the same show player that drive the real thing.  Not a mock-up:
// the preset you see here is the preset, to within 0.0002 of a count
// out of 255, because the browser code and the Python are checked
// against each other on every commit.
//
// The point of putting it on a web page is the audio.  Drop in any
// track and the analyser works on it live -- loudness, bands, pitch,
// onsets, tempo -- so an effect can be written and judged against
// the music somebody actually wants to wear it to, with no helmet,
// no controller and nothing installed.
// ----------------------------------------------------------------------

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

const state = {
  preset: 'rainbow', inst: null, params: {}, music: null,
  show: null, showT0: null, bri: 1.0, running: true, t0: performance.now(),
  spin: true,
};

// ------------------------------------------------------------- the scene
const host = document.getElementById('view');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070a);
const camera = new THREE.PerspectiveCamera(42, 1, 1, 8000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
host.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotateSpeed = 0.7;
controls.target.set(0, 90, 0);

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

const pos = new Float32Array(helmet.n * 3);
for (let i = 0; i < helmet.n; i++) {
  pos[i*3] = geo.xyz[i*3];
  pos[i*3+1] = geo.xyz[i*3+2];        // z is up in the map, y is up here
  pos[i*3+2] = -geo.xyz[i*3+1];
}
const colors = new Float32Array(helmet.n * 3);
const g3 = new THREE.BufferGeometry();
g3.setAttribute('position', new THREE.BufferAttribute(pos, 3));
g3.setAttribute('color', new THREE.BufferAttribute(colors, 3));
// The unlit body first, so the shape is there when nothing is on.
const body = new THREE.Points(g3, new THREE.PointsMaterial({
  size: 15, color: 0x1b1b24, transparent: true, opacity: 0.9,
  depthWrite: false,
}));
body.renderOrder = 0;
scene.add(body);

// Then the light, additively and without depth testing.  A shell of
// clear PETG with the LEDs 0.8 mm behind it is translucent -- the far
// side really does show through -- so an LED at the back glowing
// through the front is not a cheat, it is what the thing does.
const points = new THREE.Points(g3, new THREE.PointsMaterial({
  size: 30, map: dot(), vertexColors: true, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  sizeAttenuation: true,
}));
points.renderOrder = 1;
scene.add(points);

// Frame the helmet from the points themselves rather than from
// numbers typed in once: the map has been re-measured twice already
// and the ears moved tens of millimetres each time.
let HOME = { pos: new THREE.Vector3(0, 0, 900), tgt: new THREE.Vector3() };
function frameIt() {
  g3.computeBoundingSphere();
  const b = g3.boundingSphere;
  const d = b.radius / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.35;
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
let frames = 0, lastReport = performance.now(), fps = 0;

function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const t = (now - state.t0) / 1000;

  if (state.running) {
    if (state.show) {
      const st = an.el ? an.el.currentTime
        : (state.showT0 === null ? 0 : (now - state.showT0) / 1000);
      const cue = state.show.frame(st, state.music, frame);
      setText('cue', cue ? cue.preset + (cue.overlay ? ' + ' + cue.overlay.preset : '')
                         : '—');
      setText('clock', mmss(st) + ' / ' + mmss(state.show.duration));
    } else {
      frame.fill(0);
      state.inst.render(helmet, t, state.music, frame);
    }
    const rep = guard.apply(frame, frame, now / 1000);
    // A display lift, and only a display lift.  The guard holds the
    // helmet to about a tenth of full white, which on a real LED is
    // still plainly bright and on a screen is nearly black -- the eye
    // and the sensor disagree about what "dim" means.  The numbers
    // below the view are the real ones; this only makes the picture
    // look like what you would actually see in the room.
    const k = state.bri;
    for (let i = 0; i < helmet.n * 3; i++) {
      colors[i] = Math.pow(frame[i] / 255, 0.45) * k;
    }
    g3.attributes.color.needsUpdate = true;
    frames++;
    if (now - lastReport > 400) {
      fps = frames * 1000 / (now - lastReport);
      frames = 0; lastReport = now;
      setText('fps', fps.toFixed(0));
      setText('ma', rep.total_ma.toFixed(0));
      setText('w', rep.watts.toFixed(1));
      setText('heat', rep.thermal ? rep.thermal.full_pct.toFixed(0) + '%' : '—');
      if (an.running) {
        setText('alvl', (an.level * 100).toFixed(0) + '%');
        setText('apitch', NOTES[Math.round(an.pitch * 12) % 12]);
        setText('abpm', an.bpm ? an.bpm.toFixed(0) : '—');
      }
    }
  }
  controls.autoRotate = state.spin;
  controls.update();
  renderer.render(scene, camera);
}

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const $ = (id) => document.getElementById(id);
function setText(id, v) { const e = $(id); if (e) e.textContent = v; }
function mmss(v) {
  v = Math.max(0, Math.round(v));
  return Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
}

// ------------------------------------------------------------ controls
function choosePreset(name) {
  state.show = null;
  state.preset = name;
  state.inst = M.make(name, state.params = {}, helmet, D.fonts);
  state.t0 = performance.now();
  for (const b of document.querySelectorAll('#grid button'))
    b.classList.toggle('on', b.dataset.name === name);
  $('showpick').value = '';
  setText('cue', name);
  setText('clock', '');
  buildParams(name);
}

function buildParams(name) {
  const box = $('params');
  box.innerHTML = '';
  const spec = (D.presets[name] || {}).spec || [];
  for (const s of spec) {
    const row = document.createElement('label');
    row.className = 'simrow';
    const tag = document.createElement('span');
    tag.textContent = s.name;
    row.appendChild(tag);
    let inp;
    if (s.type === 'color') {
      inp = document.createElement('input');
      inp.type = 'color';
      const c = s.value || [255, 0, 0];
      inp.value = '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      inp.oninput = () => {
        const h = inp.value;
        state.params[s.name] = [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16),
                                parseInt(h.slice(5,7),16)];
        state.inst = M.make(name, state.params, helmet, D.fonts);
      };
    } else if (s.type === 'number') {
      inp = document.createElement('input');
      inp.type = 'range';
      inp.min = s.min !== undefined ? s.min : 0;
      inp.max = s.max !== undefined ? s.max : 10;
      inp.step = (s.max - s.min) > 20 ? 1 : 0.05;
      inp.value = s.value;
      inp.oninput = () => {
        state.params[s.name] = +inp.value;
        state.inst = M.make(name, state.params, helmet, D.fonts);
      };
    } else if (s.type === 'text') {
      inp = document.createElement('input');
      inp.type = 'text';
      inp.value = s.value;
      inp.oninput = () => {
        state.params[s.name] = inp.value;
        state.inst = M.make(name, state.params, helmet, D.fonts);
      };
    } else { continue; }
    row.appendChild(inp);
    box.appendChild(row);
  }
}

function audioOn(kind) {
  state.music = kind === 'none' ? null : M.LiveMusic(an);
  for (const [id, k] of [['afile','file'], ['amic','mic'], ['aoff','none']])
    $(id).classList.toggle('on', kind === k);
  setText('asrc', { file: 'your track', mic: 'microphone', none: 'nothing' }[kind]);
}

// ------------------------------------------------------------- wiring
{
  const grid = $('grid');
  for (const name of Object.keys(D.presets)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.dataset.name = name;
    b.onclick = () => choosePreset(name);
    grid.appendChild(b);
  }
  const sel = $('showpick');
  for (const name of Object.keys(D.shows || {})) {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name.replace(/^deadmau5 - /, '');
    sel.appendChild(o);
  }
  sel.onchange = () => {
    if (!sel.value) { choosePreset(state.preset); return; }
    state.show = new M.ShowPlayer(D.shows[sel.value], helmet, D);
    state.showT0 = performance.now();
    $('params').innerHTML = '';
    for (const b of document.querySelectorAll('#grid button')) b.classList.remove('on');
  };

  $('afile').onclick = () => $('apick').click();
  $('apick').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const el = await an.useFile(f);
      audioOn('file');
      setText('why', 'playing ' + f.name + ' — the analysis is live, so the '
              + 'effects follow this track.');
      el.onended = () => { an.stop(); audioOn('none'); };
    } catch (err) { setText('why', String(err.message || err)); }
  };
  $('amic').onclick = async () => {
    try { await an.useMic(); audioOn('mic');
      setText('why', 'listening — anything this device can hear drives the helmet.');
    } catch (err) { setText('why', String(err.message || err)); }
  };
  $('aoff').onclick = () => { an.stop(); audioOn('none'); setText('why', ''); };
  $('bri').oninput = (e) => { state.bri = +e.target.value / 100; };
  $('spin').onchange = (e) => { state.spin = e.target.checked; };
  $('reset').onclick = () => {
    camera.position.copy(HOME.pos);
    controls.target.copy(HOME.tgt);
  };

  if (!M.Analyser.micPossible()) {
    $('amic').disabled = true;
    $('amic').title = 'needs a secure page';
  }
  setText('leds', helmet.n);
  setText('budget', D.power.budget_ma);
  setText('npresets', Object.keys(D.presets).length);
}

resize();
frameIt();
choosePreset('rainbow');
audioOn('none');
tick();
