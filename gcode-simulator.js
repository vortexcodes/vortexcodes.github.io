// Doron Velta G-code simulator
// Specs sourced from rogerlz/Doron-Velta & FYSETC/FYSETC-Doron_Velta:
//   delta_radius=100.922, arm_length=215, print_radius=100,
//   max Z (endstop)=170, min Z=-25, build plate Ø200x5 alu,
//   170mm Ø heater, 3x 2020 verticals @500mm, 6x 2040 horizontals @235mm,
//   MGN9H 350mm rails, 210mm fisheye rods (arm pivot-to-pivot = 215mm config).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------- Printer constants (mm) ----------
const P = {
    deltaRadius: 100.922298,
    armLength: 215,
    printRadius: 100,
    maxZ: 170,
    minZ: -25,
    bedDiameter: 200,
    bedThickness: 5,
    heaterDiameter: 170,
    towerExtrusion: 20,        // 2020
    horizExtrusion: 20,        // 2040 is 40 high, 20 wide; we'll use 20x40
    horizHeight: 40,
    towerHeight: 500,
    horizLength: 235,
    railLength: 350,           // MGN9H rail
    carriageHeight: 40,
    carriageWidth: 40,
    carriageDepth: 14,
    effectorRadius: 30,        // approximate magball effector
    effectorThickness: 8,
    // Carriage Z range (along the tower). When effector tip is at Z=0,
    // homed carriage Z ~ position_endstop + a bit; we expose endstop=170
    // and let carriage range be [0, towerHeight - 30] roughly.
    carriageMinZ: 5,
    carriageMaxZ: 460,
    // Tower angles (Klipper default): A=210°, B=330°, C=90°
    towerAngles: [210, 330, 90],
};

// ---------- Three.js scene ----------
const viewer = document.getElementById('viewer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.Fog(0x0a0a0a, 600, 1800);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
camera.position.set(380, 320, 500);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 100, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(300, 600, 400);
scene.add(key);
const rim = new THREE.DirectionalLight(0x00ff88, 0.25);
rim.position.set(-400, 200, -300);
scene.add(rim);

// Floor grid
const grid = new THREE.GridHelper(800, 40, 0x224422, 0x111111);
grid.position.y = -P.bedThickness - 1;
scene.add(grid);

// ---------- Build the printer ----------
const mats = {
    alu: new THREE.MeshStandardMaterial({ color: 0x303035, metalness: 0.7, roughness: 0.45 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x9a9aa0, metalness: 0.9, roughness: 0.3 }),
    carriage: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.5, roughness: 0.6 }),
    rod: new THREE.MeshStandardMaterial({ color: 0xc0c0c8, metalness: 0.95, roughness: 0.2 }),
    effector: new THREE.MeshStandardMaterial({ color: 0x222227, metalness: 0.4, roughness: 0.7 }),
    hotend: new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0.85, roughness: 0.3 }),
    bed: new THREE.MeshStandardMaterial({ color: 0x404048, metalness: 0.8, roughness: 0.35 }),
    heater: new THREE.MeshStandardMaterial({ color: 0x553322, metalness: 0.2, roughness: 0.8, emissive: 0x110000 }),
    stepper: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.6, roughness: 0.5 }),
};

const frameGroup = new THREE.Group();
scene.add(frameGroup);

// Returns [three.x, three.z] for a tower at the given gcode-XY angle.
// gcode (x,y) maps to three.js (x, -y) since three.js Y is up.
function towerXY(angleDeg, radius = P.deltaRadius + 18) {
    const a = angleDeg * Math.PI / 180;
    return [Math.cos(a) * radius, -Math.sin(a) * radius];
}

// Vertical 2020 towers
const towerExtBoxes = [];
P.towerAngles.forEach((ang) => {
    const [x, z] = towerXY(ang, P.deltaRadius + 18);
    const geom = new THREE.BoxGeometry(P.towerExtrusion, P.towerHeight, P.towerExtrusion);
    const mesh = new THREE.Mesh(geom, mats.alu);
    mesh.position.set(x, P.towerHeight / 2 - 30, z);
    mesh.userData.angle = ang;
    frameGroup.add(mesh);
    towerExtBoxes.push(mesh);
});

// Top + bottom horizontal 2040 triangles
function addHorizRing(y) {
    for (let i = 0; i < 3; i++) {
        const a1 = P.towerAngles[i];
        const a2 = P.towerAngles[(i + 1) % 3];
        const [x1, z1] = towerXY(a1, P.deltaRadius + 18);
        const [x2, z2] = towerXY(a2, P.deltaRadius + 18);
        const mx = (x1 + x2) / 2;
        const mz = (z1 + z2) / 2;
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        const geom = new THREE.BoxGeometry(len - P.towerExtrusion, P.horizHeight, 20);
        const mesh = new THREE.Mesh(geom, mats.alu);
        mesh.position.set(mx, y, mz);
        mesh.rotation.y = -Math.atan2(dz, dx);
        frameGroup.add(mesh);
    }
}
addHorizRing(-30 + P.horizHeight / 2);                // bottom ring
addHorizRing(P.towerHeight - 30 - P.horizHeight / 2); // top ring

// Stepper motors (top of each tower)
P.towerAngles.forEach((ang) => {
    const [x, z] = towerXY(ang, P.deltaRadius + 18);
    const geom = new THREE.BoxGeometry(42, 42, 42);
    const mesh = new THREE.Mesh(geom, mats.stepper);
    mesh.position.set(x, P.towerHeight - 30 - P.horizHeight - 24, z);
    frameGroup.add(mesh);
});

// Linear rails (inner face of each tower)
P.towerAngles.forEach((ang) => {
    const [x, z] = towerXY(ang, P.deltaRadius + 18 - 10); // offset inward
    const geom = new THREE.BoxGeometry(9, P.railLength, 5);
    const mesh = new THREE.Mesh(geom, mats.rail);
    mesh.position.set(x, P.towerHeight / 2 - 30, z);
    // Rotate rail so its face points to the center
    mesh.lookAt(0, mesh.position.y, 0);
    frameGroup.add(mesh);
});

// Build plate (aluminum disc)
const bedGroup = new THREE.Group();
scene.add(bedGroup);
{
    const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(P.bedDiameter / 2, P.bedDiameter / 2, P.bedThickness, 64),
        mats.bed
    );
    plate.position.y = -P.bedThickness / 2;
    bedGroup.add(plate);

    const heater = new THREE.Mesh(
        new THREE.CylinderGeometry(P.heaterDiameter / 2, P.heaterDiameter / 2, 1.5, 64),
        mats.heater
    );
    heater.position.y = 0.75;
    bedGroup.add(heater);
}

// Carriages (one per tower)
const carriages = P.towerAngles.map((ang) => {
    const grp = new THREE.Group();
    const [x, z] = towerXY(ang, P.deltaRadius + 18 - 10);
    grp.position.set(x, 100, z);
    grp.lookAt(0, 100, 0);
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(P.carriageWidth, P.carriageHeight, P.carriageDepth),
        mats.carriage
    );
    body.position.z = P.carriageDepth / 2;
    grp.add(body);
    grp.userData.angle = ang;
    scene.add(grp);
    return grp;
});

// Effector
const effectorGroup = new THREE.Group();
scene.add(effectorGroup);
{
    const e = new THREE.Mesh(
        new THREE.CylinderGeometry(P.effectorRadius, P.effectorRadius * 0.85, P.effectorThickness, 24),
        mats.effector
    );
    e.position.y = P.effectorThickness / 2;
    effectorGroup.add(e);
    // Hotend cone
    const cone = new THREE.Mesh(new THREE.ConeGeometry(8, 18, 16), mats.hotend);
    cone.position.y = -9;
    cone.rotation.x = Math.PI;
    effectorGroup.add(cone);
    // Tip indicator (the nozzle is the origin of the effector group)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.6 }));
    tip.position.y = -18;
    effectorGroup.add(tip);
}

// Six delta arms (2 per tower) — line segments for performance
const armLines = [];
const armMatNormal = new THREE.LineBasicMaterial({ color: 0xc0c0c8, linewidth: 2 });
const armMatCrash  = new THREE.LineBasicMaterial({ color: 0xff3366, linewidth: 2 });
for (let i = 0; i < 6; i++) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(g, armMatNormal);
    armLines.push(line);
    scene.add(line);
}

// Build envelope (cylinder wireframe)
const envelope = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(P.printRadius, P.printRadius, P.maxZ, 48, 1, true)),
    new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.35 })
);
envelope.position.y = P.maxZ / 2;
envelope.visible = false;
scene.add(envelope);

// Toolpath
const pathPositions = [];
const pathColors = [];
const pathGeom = new THREE.BufferGeometry();
pathGeom.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
pathGeom.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
const pathLine = new THREE.Line(pathGeom, new THREE.LineBasicMaterial({ vertexColors: true }));
scene.add(pathLine);

// ---------- Delta kinematics ----------
// Carriage Z for tower at (tx,ty) given desired effector tip (x,y,z):
//   cz = z + sqrt(arm^2 - (tx-x)^2 - (ty-y)^2)
// Z=0 is the bed top.
function towerXYDelta(angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return [Math.cos(a) * P.deltaRadius, Math.sin(a) * P.deltaRadius];
}
const towerJoint = P.towerAngles.map(towerXYDelta);

function carriageZ(towerIdx, x, y, z) {
    const [tx, ty] = towerJoint[towerIdx];
    const dx = tx - x, dy = ty - y;
    const inside = P.armLength * P.armLength - dx * dx - dy * dy;
    if (inside < 0) return { z: NaN, reach: false };
    return { z: z + Math.sqrt(inside), reach: true };
}

// ---------- G-code parser ----------
function parseGcode(text) {
    const lines = text.split(/\r?\n/);
    const moves = [];
    let absolute = true;
    let pos = { x: 0, y: 0, z: P.maxZ - 5, e: 0, f: 6000 };
    let homed = false;

    for (let i = 0; i < lines.length; i++) {
        let raw = lines[i];
        const semi = raw.indexOf(';');
        if (semi >= 0) raw = raw.slice(0, semi);
        const line = raw.trim();
        if (!line) continue;
        const tokens = line.split(/\s+/);
        const cmd = tokens[0].toUpperCase();
        const args = {};
        for (let t = 1; t < tokens.length; t++) {
            const tok = tokens[t];
            const k = tok[0].toUpperCase();
            const v = parseFloat(tok.slice(1));
            if (!isNaN(v)) args[k] = v;
        }
        if (cmd === 'G90') { absolute = true; continue; }
        if (cmd === 'G91') { absolute = false; continue; }
        if (cmd === 'G28') {
            const next = { x: 0, y: 0, z: P.maxZ, e: pos.e, f: pos.f };
            moves.push({ line: i + 1, type: 'home', from: { ...pos }, to: next, raw: lines[i] });
            pos = next; homed = true; continue;
        }
        if (cmd === 'G92') {
            if ('X' in args) pos.x = args.X;
            if ('Y' in args) pos.y = args.Y;
            if ('Z' in args) pos.z = args.Z;
            if ('E' in args) pos.e = args.E;
            continue;
        }
        if (cmd === 'G0' || cmd === 'G1') {
            const next = { ...pos };
            const apply = (k, lk) => {
                if (k in args) next[lk] = absolute ? args[k] : pos[lk] + args[k];
            };
            apply('X', 'x'); apply('Y', 'y'); apply('Z', 'z');
            apply('E', 'e');
            if ('F' in args) next.f = args.F;
            const isPrint = (next.e > pos.e + 1e-6);
            moves.push({
                line: i + 1, type: isPrint ? 'print' : 'travel',
                from: { ...pos }, to: { ...next }, raw: lines[i]
            });
            pos = next;
            continue;
        }
        // Other M-codes ignored
    }
    return moves;
}

// ---------- Crash detection ----------
function checkPoint(x, y, z) {
    const issues = [];
    const r = Math.hypot(x, y);
    if (r > P.printRadius + 0.01) issues.push(`outside print radius (r=${r.toFixed(1)} > ${P.printRadius})`);
    if (z > P.maxZ + 0.01) issues.push(`above max Z (${z.toFixed(1)} > ${P.maxZ})`);
    if (z < P.minZ - 0.01) issues.push(`below min Z (${z.toFixed(1)} < ${P.minZ})`);
    for (let i = 0; i < 3; i++) {
        const c = carriageZ(i, x, y, z);
        if (!c.reach) { issues.push(`tower ${'ABC'[i]}: unreachable (arm over-extended)`); continue; }
        if (c.z < P.carriageMinZ) issues.push(`tower ${'ABC'[i]}: carriage below limit (${c.z.toFixed(1)})`);
        if (c.z > P.carriageMaxZ) issues.push(`tower ${'ABC'[i]}: carriage above limit (${c.z.toFixed(1)})`);
    }
    return issues;
}

function checkMove(m, samples = 12) {
    const seen = new Set();
    const issues = [];
    for (let s = 0; s <= samples; s++) {
        const t = s / samples;
        const x = m.from.x + (m.to.x - m.from.x) * t;
        const y = m.from.y + (m.to.y - m.from.y) * t;
        const z = m.from.z + (m.to.z - m.from.z) * t;
        for (const iss of checkPoint(x, y, z)) {
            if (!seen.has(iss)) { seen.add(iss); issues.push(iss); }
        }
    }
    return issues;
}

// ---------- Update visuals from effector pos ----------
const _v = new THREE.Vector3();
function setEffector(x, y, z) {
    // Three.js Y is up. G-code Z -> three.js Y; G-code X -> three.js X; G-code Y -> three.js Z (negated for right-handed view)
    effectorGroup.position.set(x, z + 18, -y); // +18 lifts effector body so tip sphere sits at z
    // Wait — we placed the tip at local Y=-18, so the group origin sits 18mm above the tip.
    // Setting group.y = z + 18 means tip sits at world Y = z. Good.

    // Update carriages
    for (let i = 0; i < 3; i++) {
        const [tx, ty] = towerJoint[i];
        const c = carriageZ(i, x, y, z);
        const carriage = carriages[i];
        if (c.reach) {
            // Position carriage along tower at radial position deltaRadius+8 (rail face)
            const ang = P.towerAngles[i] * Math.PI / 180;
            const rR = P.deltaRadius + 8;
            carriage.position.set(Math.cos(ang) * rR, c.z, -Math.sin(ang) * rR);
            carriage.lookAt(0, c.z, 0);
        }
    }

    // Update arms (2 per tower)
    const armSpread = 30; // mm between the two arm pivots, both at carriage and effector
    let crashed = false;
    for (let i = 0; i < 3; i++) {
        const [tx, ty] = towerJoint[i];
        const c = carriageZ(i, x, y, z);
        const ang = P.towerAngles[i] * Math.PI / 180;
        // Perpendicular direction in XY (tangent to tower circle)
        const px = -Math.sin(ang), py = Math.cos(ang);
        // World positions of the two carriage pivots and two effector pivots
        for (let k = 0; k < 2; k++) {
            const sign = k === 0 ? -1 : 1;
            const cwx = tx + px * armSpread * sign;
            const cwy = ty + py * armSpread * sign;
            const cwz = c.reach ? c.z : 100;
            const ewx = x + px * armSpread * sign;
            const ewy = y + py * armSpread * sign;
            const ewz = z;
            const line = armLines[i * 2 + k];
            const positions = line.geometry.attributes.position.array;
            // Three space mapping: gcode X -> three X, gcode Y -> three -Z, gcode Z -> three Y
            positions[0] = cwx; positions[1] = cwz; positions[2] = -cwy;
            positions[3] = ewx; positions[4] = ewz; positions[5] = -ewy;
            line.geometry.attributes.position.needsUpdate = true;
            line.geometry.computeBoundingSphere();
            if (!c.reach) { line.material = armMatCrash; crashed = true; }
            else line.material = armMatNormal;
        }
    }

    // Effector color
    const issues = checkPoint(x, y, z);
    const isCrash = issues.length > 0;
    effectorGroup.children.forEach(child => {
        if (child.material && child.material.emissive) {
            // do not touch hotend cone heavily
        }
    });
    return { issues, crashed: isCrash };
}

// ---------- Simulation loop ----------
let moves = [];
let currentMove = 0;
let moveT = 0;
let playing = false;
let speed = 3.0;
let currentPos = { x: 0, y: 0, z: P.maxZ - 5 };
let issuesByLine = new Map();

function resetSim() {
    currentMove = 0;
    moveT = 0;
    playing = false;
    pathPositions.length = 0;
    pathColors.length = 0;
    updatePathGeometry();
    currentPos = { x: 0, y: 0, z: P.maxZ - 5 };
    setEffector(currentPos.x, currentPos.y, currentPos.z);
    updateHud();
    document.getElementById('btnPause').disabled = true;
    document.getElementById('btnPlay').disabled = false;
}

function updatePathGeometry() {
    pathGeom.setAttribute('position', new THREE.Float32BufferAttribute(pathPositions, 3));
    pathGeom.setAttribute('color', new THREE.Float32BufferAttribute(pathColors, 3));
    pathGeom.computeBoundingSphere();
}

function pushPathSegment(from, to, isCrash, isPrint) {
    pathPositions.push(from.x, from.z, -from.y, to.x, to.z, -to.y);
    let c;
    if (isCrash) c = [1.0, 0.2, 0.4];
    else if (isPrint) c = [0.0, 1.0, 0.53];
    else c = [0.0, 0.55, 0.65];
    for (let i = 0; i < 2; i++) pathColors.push(...c);
    updatePathGeometry();
}

function logMsg(msg, cls = '') {
    const el = document.getElementById('log');
    const ts = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    if (cls) div.className = cls;
    div.textContent = `[${ts}] ${msg}`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
}

function updateHud() {
    document.getElementById('hudPos').textContent =
        `X${currentPos.x.toFixed(1)} Y${currentPos.y.toFixed(1)} Z${currentPos.z.toFixed(1)}`;
    const cz = [0,1,2].map(i => {
        const c = carriageZ(i, currentPos.x, currentPos.y, currentPos.z);
        return c.reach ? c.z.toFixed(0) : '×';
    });
    document.getElementById('hudCar').textContent = cz.join(' / ');
    document.getElementById('hudF').textContent = moves[currentMove]?.to.f?.toFixed(0) || '—';
    document.getElementById('hudLine').textContent = currentMove;
    document.getElementById('hudTotal').textContent = moves.length;
    const issues = checkPoint(currentPos.x, currentPos.y, currentPos.z);
    const statusEl = document.getElementById('hudStatus');
    if (issues.length) {
        statusEl.textContent = '● CRASH: ' + issues[0];
        statusEl.className = 'warn';
    } else if (playing) {
        statusEl.textContent = '● Running';
        statusEl.className = 'ok';
    } else {
        statusEl.textContent = '● Idle';
        statusEl.className = 'ok';
    }
}

function loadGcode(text) {
    moves = parseGcode(text);
    logMsg(`Parsed ${moves.length} moves`, 'info');
    resetSim();
}

function checkAll() {
    issuesByLine = new Map();
    let crashCount = 0;
    for (const m of moves) {
        const iss = checkMove(m);
        if (iss.length) {
            issuesByLine.set(m.line, iss);
            crashCount++;
            logMsg(`Line ${m.line} (${m.raw.trim()}): ${iss.join('; ')}`, 'err');
        }
    }
    if (crashCount === 0) logMsg(`All ${moves.length} moves safe ✓`, 'ok');
    else logMsg(`${crashCount} move(s) would crash`, 'err');
}

// ---------- Main loop ----------
let last = performance.now();
function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (playing && currentMove < moves.length) {
        const m = moves[currentMove];
        const len = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y, m.to.z - m.from.z) || 1;
        const feedMM = (m.to.f || 6000) / 60; // mm/s
        const segDuration = len / feedMM;
        moveT += dt * speed / Math.max(0.001, segDuration);
        if (moveT >= 1) {
            // Finish segment
            const issues = checkMove(m);
            const isCrash = issues.length > 0;
            pushPathSegment(m.from, m.to, isCrash, m.type === 'print');
            if (isCrash) {
                logMsg(`Line ${m.line}: ${issues.join('; ')}`, 'err');
                playing = false;
                document.getElementById('btnPause').disabled = true;
                document.getElementById('btnPlay').disabled = false;
            }
            currentPos = { ...m.to };
            currentMove++;
            moveT = 0;
        } else {
            currentPos = {
                x: m.from.x + (m.to.x - m.from.x) * moveT,
                y: m.from.y + (m.to.y - m.from.y) * moveT,
                z: m.from.z + (m.to.z - m.from.z) * moveT,
            };
        }
        if (currentMove >= moves.length) {
            playing = false;
            document.getElementById('btnPause').disabled = true;
            document.getElementById('btnPlay').disabled = false;
            logMsg('Simulation complete ✓', 'ok');
        }
        setEffector(currentPos.x, currentPos.y, currentPos.z);
        updateHud();
    }

    controls.update();
    renderer.render(scene, camera);
}

// ---------- UI hooks ----------
function resize() {
    const w = viewer.clientWidth;
    const h = viewer.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

document.getElementById('btnPlay').addEventListener('click', () => {
    if (moves.length === 0) loadGcode(document.getElementById('gcode').value);
    if (currentMove >= moves.length) resetSim();
    playing = true;
    document.getElementById('btnPlay').disabled = true;
    document.getElementById('btnPause').disabled = false;
    logMsg('Playing…', 'info');
});
document.getElementById('btnPause').addEventListener('click', () => {
    playing = false;
    document.getElementById('btnPlay').disabled = false;
    document.getElementById('btnPause').disabled = true;
});
document.getElementById('btnReset').addEventListener('click', () => {
    loadGcode(document.getElementById('gcode').value);
});
document.getElementById('btnCheck').addEventListener('click', () => {
    loadGcode(document.getElementById('gcode').value);
    checkAll();
});

document.getElementById('speed').addEventListener('input', (e) => {
    speed = parseFloat(e.target.value);
    document.getElementById('speedVal').textContent = speed.toFixed(1) + '×';
});

document.getElementById('fileInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
        document.getElementById('gcode').value = r.result;
        loadGcode(r.result);
        logMsg(`Loaded ${f.name} (${(f.size/1024).toFixed(1)} KB)`, 'info');
    };
    r.readAsText(f);
});

document.getElementById('tShowPath').addEventListener('change', e => pathLine.visible = e.target.checked);
document.getElementById('tShowEnvelope').addEventListener('change', e => envelope.visible = e.target.checked);
document.getElementById('tShowArms').addEventListener('change', e => armLines.forEach(l => l.visible = e.target.checked));
document.getElementById('tShowFrame').addEventListener('change', e => frameGroup.visible = e.target.checked);

// Init
resize();
loadGcode(document.getElementById('gcode').value);
setEffector(0, 0, P.maxZ - 5);
logMsg('Doron Velta simulator ready. Drag in viewer to orbit.', 'ok');
requestAnimationFrame(animate);
