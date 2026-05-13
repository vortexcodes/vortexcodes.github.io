// Doron Velta G-code simulator — improved procedural model + audio synth + STL loader
// Specs from rogerlz/Doron-Velta & FYSETC/FYSETC-Doron_Velta:
//   delta_radius=100.922, arm_length=215, print_radius=100,
//   max Z (endstop)=170, min Z=-25, build plate Ø200x5 alu,
//   170mm Ø heater, 3x 2020 verticals @500mm, 6x 2040 horizontals @235mm,
//   MGN9H 350mm rails, 210mm fisheye rods.
//
// Coordinate convention: gcode (x, y, z) -> three.js (x, z, -y). z=0 is bed surface.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

// ---------- Constants ----------
const P = {
    deltaRadius: 100.922298,
    armLength: 215,
    printRadius: 100,
    maxZ: 170,
    minZ: -25,
    bedDiameter: 200,
    bedThickness: 5,
    heaterDiameter: 170,
    heaterThickness: 1.6,
    peiThickness: 0.8,
    towerExtrusion: 20,
    horizHeightTop: 40,        // 2040
    horizThicknessTop: 20,
    towerHeight: 500,
    horizLength: 235,
    railLength: 350,
    carriageMinZ: 10,
    carriageMaxZ: 460,
    towerAngles: [210, 330, 90],          // Klipper convention
    armRodDiameter: 4,
    armSpread: 30,                         // half-distance between paired arm pivots
    effectorRadius: 28,
    effectorThickness: 6,
    magballDiameter: 9,
    bedHeight: -1,                          // top of PEI sits at y=0 (gcode z=0)
};

// Frame bottom-ring top at y = bottomRingTopY; bed sits just above it
P.bottomRingY = -25;                          // bottom face of bottom 2040 ring
P.bottomRingTop = P.bottomRingY + P.horizHeightTop; // top of bottom 2040 ring
P.bedBaseY = P.bottomRingTop + 6;             // bed plate bottom face
// Adjust so bed PEI surface ends up at y=0 = gcode Z=0
P.bedDeck = P.bedBaseY + P.bedThickness + P.heaterThickness + P.peiThickness;
// We'll instead drive the model UP so bed deck = 0. Compute frame offset:
const FRAME_OFFSET_Y = -P.bedDeck;            // shift whole frame so PEI top is at world Y=0
P.bottomRingY += FRAME_OFFSET_Y;
P.bottomRingTop += FRAME_OFFSET_Y;
P.bedBaseY += FRAME_OFFSET_Y;
P.bedDeck = 0;                                // by construction now
P.towerBottomY = P.bottomRingY;
P.towerTopY = P.towerBottomY + P.towerHeight;

// ---------- Scene ----------
const viewer = document.getElementById('viewer');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101015);
scene.fog = new THREE.Fog(0x101015, 700, 2200);

const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 6000);
camera.position.set(420, 280, 520);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 80, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 100;
controls.maxDistance = 1500;

// ---------- Lighting ----------
scene.add(new THREE.HemisphereLight(0xaaccff, 0x222218, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(450, 700, 350);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -400; key.shadow.camera.right = 400;
key.shadow.camera.top = 400; key.shadow.camera.bottom = -400;
key.shadow.camera.near = 100; key.shadow.camera.far = 1800;
scene.add(key);
const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
fill.position.set(-300, 200, -400);
scene.add(fill);
const rim = new THREE.DirectionalLight(0x00ff88, 0.18);
rim.position.set(0, 200, -500);
scene.add(rim);

// Ground reception (subtle catcher)
{
    const g = new THREE.Mesh(
        new THREE.CircleGeometry(700, 64),
        new THREE.ShadowMaterial({ opacity: 0.45 })
    );
    g.rotation.x = -Math.PI / 2;
    g.position.y = P.towerBottomY - 15;
    g.receiveShadow = true;
    scene.add(g);
}

// Grid + axes
const grid = new THREE.GridHelper(1000, 50, 0x224422, 0x171717);
grid.position.y = P.towerBottomY - 14.5;
scene.add(grid);
const axes = new THREE.AxesHelper(50);
axes.position.y = 0.5;
scene.add(axes);

// ---------- Materials ----------
const mats = {
    alu:      new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.75, roughness: 0.5 }),
    aluLight: new THREE.MeshStandardMaterial({ color: 0xb8b8c0, metalness: 0.85, roughness: 0.35 }),
    rail:     new THREE.MeshStandardMaterial({ color: 0xc0c0c8, metalness: 0.92, roughness: 0.22 }),
    rod:      new THREE.MeshStandardMaterial({ color: 0xd0d0d8, metalness: 0.95, roughness: 0.18 }),
    printed:  new THREE.MeshStandardMaterial({ color: 0x111114, metalness: 0.05, roughness: 0.85 }),
    printedAccent: new THREE.MeshStandardMaterial({ color: 0x00ff88, metalness: 0.05, roughness: 0.7, emissive: 0x002211 }),
    carriage: new THREE.MeshStandardMaterial({ color: 0x0d0d0d, metalness: 0.3, roughness: 0.7 }),
    magball:  new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.95, roughness: 0.15 }),
    effector: new THREE.MeshStandardMaterial({ color: 0x1a1a1f, metalness: 0.45, roughness: 0.6 }),
    hotendBlock: new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 0.7, roughness: 0.4 }),
    nozzle:   new THREE.MeshStandardMaterial({ color: 0xb0a070, metalness: 0.9, roughness: 0.25 }),
    pei:      new THREE.MeshStandardMaterial({ color: 0xe89548, metalness: 0.05, roughness: 0.45 }),
    heater:   new THREE.MeshStandardMaterial({ color: 0x3a1a14, metalness: 0.1, roughness: 0.85, emissive: 0x110200, emissiveIntensity: 0.7 }),
    stepper:  new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.55, roughness: 0.5 }),
    stepperLabel: new THREE.MeshStandardMaterial({ color: 0x16161a, metalness: 0.55, roughness: 0.4 }),
    pulley:   new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.8, roughness: 0.35 }),
    belt:     new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.1, roughness: 0.95 }),
};

// ---------- Helpers ----------
function towerXY(angleDeg, radius) {
    const a = angleDeg * Math.PI / 180;
    return [Math.cos(a) * radius, -Math.sin(a) * radius]; // returns three.js (x, z)
}

const frameGroup = new THREE.Group();
scene.add(frameGroup);

// Outer radius the towers sit at (rail face at deltaRadius, extrusion behind it)
const towerOuterR = P.deltaRadius + 18;

// ---------- Vertical towers ----------
P.towerAngles.forEach((ang) => {
    const [x, z] = towerXY(ang, towerOuterR);
    const geom = new THREE.BoxGeometry(P.towerExtrusion, P.towerHeight, P.towerExtrusion);
    const mesh = new THREE.Mesh(geom, mats.alu);
    mesh.position.set(x, P.towerBottomY + P.towerHeight / 2, z);
    // Orient so flat face points inward
    mesh.lookAt(0, mesh.position.y, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    frameGroup.add(mesh);

    // Subtle T-slot edge lines for visual texture (vertical accent strips)
    const stripeGeom = new THREE.BoxGeometry(2.5, P.towerHeight - 6, 2.5);
    [-1, 1].forEach((s) => {
        const stripe = new THREE.Mesh(stripeGeom, mats.aluLight);
        stripe.position.copy(mesh.position);
        // Move stripe slightly to the inner face left/right edge
        const a = ang * Math.PI / 180;
        const tx = -Math.sin(a) * 8.6 * s;
        const tz = Math.cos(a) * 8.6 * s;
        stripe.position.x += tx;
        stripe.position.z -= tz; // (sign matches our xy->xz mapping with -y)
        // Push slightly outward (toward inner face)
        const ix = -Math.cos(a) * 10.1;
        const iz = Math.sin(a) * 10.1;
        stripe.position.x += ix;
        stripe.position.z -= iz;
        frameGroup.add(stripe);
    });
});

// ---------- Horizontal rings (top + bottom) ----------
function addHorizRing(y, opts = {}) {
    for (let i = 0; i < 3; i++) {
        const a1 = P.towerAngles[i];
        const a2 = P.towerAngles[(i + 1) % 3];
        const [x1, z1] = towerXY(a1, towerOuterR);
        const [x2, z2] = towerXY(a2, towerOuterR);
        const mx = (x1 + x2) / 2;
        const mz = (z1 + z2) / 2;
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        const geom = new THREE.BoxGeometry(len - P.towerExtrusion, opts.h || P.horizHeightTop, opts.t || P.horizThicknessTop);
        const mesh = new THREE.Mesh(geom, mats.alu);
        mesh.position.set(mx, y, mz);
        mesh.rotation.y = -Math.atan2(dz, dx);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        frameGroup.add(mesh);
    }
}
addHorizRing(P.bottomRingY + P.horizHeightTop / 2);
const topRingMidY = P.towerTopY - P.horizHeightTop / 2;
addHorizRing(topRingMidY);

// ---------- Corner blocks (printed parts) — bottom + top ----------
function addCornerBlock(angleDeg, y, big = false) {
    const [x, z] = towerXY(angleDeg, towerOuterR);
    const blockGeom = new THREE.BoxGeometry(big ? 60 : 50, big ? 50 : 40, 36);
    const block = new THREE.Mesh(blockGeom, mats.printed);
    block.position.set(x, y, z);
    block.lookAt(0, y, 0);
    block.castShadow = true;
    frameGroup.add(block);
    return block;
}
P.towerAngles.forEach((ang) => {
    addCornerBlock(ang, P.bottomRingY + P.horizHeightTop / 2, false);
    addCornerBlock(ang, topRingMidY, true);
});

// ---------- Foot pieces ----------
P.towerAngles.forEach((ang) => {
    const [x, z] = towerXY(ang, towerOuterR);
    const foot = new THREE.Mesh(
        new THREE.CylinderGeometry(14, 18, 12, 16),
        mats.printed
    );
    foot.position.set(x, P.towerBottomY - 6, z);
    foot.castShadow = true;
    foot.receiveShadow = true;
    frameGroup.add(foot);
    // Rubber bumper
    const rb = new THREE.Mesh(
        new THREE.CylinderGeometry(10, 12, 4, 16),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 })
    );
    rb.position.set(x, P.towerBottomY - 14, z);
    frameGroup.add(rb);
});

// ---------- NEMA17 steppers + GT2 pulleys at top ----------
P.towerAngles.forEach((ang) => {
    const [x, z] = towerXY(ang, towerOuterR);
    const stepperY = topRingMidY - P.horizHeightTop / 2 - 22;
    const body = new THREE.Mesh(new THREE.BoxGeometry(42, 44, 42), mats.stepper);
    body.position.set(x, stepperY, z);
    body.lookAt(0, stepperY, 0);
    body.castShadow = true;
    frameGroup.add(body);
    // Label patch
    const lbl = new THREE.Mesh(new THREE.BoxGeometry(28, 28, 1), mats.stepperLabel);
    lbl.position.copy(body.position);
    lbl.lookAt(0, stepperY, 0);
    // Offset toward inside face
    const a = ang * Math.PI / 180;
    lbl.position.x -= Math.cos(a) * 21.5;
    lbl.position.z += Math.sin(a) * 21.5;
    frameGroup.add(lbl);
    // GT2 pulley below stepper
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 8, 24), mats.pulley);
    pulley.position.set(x, stepperY - 28, z);
    pulley.lookAt(0, stepperY - 28, 0);
    pulley.rotateX(Math.PI / 2);
    frameGroup.add(pulley);
});

// ---------- Linear rails ----------
// Carriage center at gcode Z=170 (max effector Z) is at worldY ≈ 360.
// Carriage at gcode Z=-25 (min) is at worldY ≈ 165. Rail must span both.
const railCenterY = 205;
P.towerAngles.forEach((ang) => {
    const a = ang * Math.PI / 180;
    const railR = P.deltaRadius + 4;
    const x = Math.cos(a) * railR;
    const z = -Math.sin(a) * railR;
    const rail = new THREE.Mesh(
        new THREE.BoxGeometry(9, P.railLength, 5),
        mats.rail
    );
    rail.position.set(x, railCenterY, z);
    rail.lookAt(0, rail.position.y, 0);
    rail.castShadow = true;
    frameGroup.add(rail);
});

// ---------- Bed assembly ----------
const bedGroup = new THREE.Group();
scene.add(bedGroup);
// Aluminum plate
{
    const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(P.bedDiameter / 2, P.bedDiameter / 2, P.bedThickness, 96),
        mats.aluLight
    );
    plate.position.y = P.bedBaseY + P.bedThickness / 2;
    plate.castShadow = true;
    plate.receiveShadow = true;
    bedGroup.add(plate);
    // Edge chamfer hint
    const edge = new THREE.Mesh(
        new THREE.TorusGeometry(P.bedDiameter / 2 - 0.5, 0.8, 8, 64),
        mats.aluLight
    );
    edge.rotation.x = Math.PI / 2;
    edge.position.y = P.bedBaseY + 0.5;
    bedGroup.add(edge);
}
// Heater pad (AC silicone heater)
{
    const h = new THREE.Mesh(
        new THREE.CylinderGeometry(P.heaterDiameter / 2, P.heaterDiameter / 2, P.heaterThickness, 64),
        mats.heater
    );
    h.position.y = P.bedBaseY + P.bedThickness + P.heaterThickness / 2;
    bedGroup.add(h);
}
// PEI sheet (top surface, gcode Z=0)
{
    const pei = new THREE.Mesh(
        new THREE.CylinderGeometry(P.heaterDiameter / 2 - 1, P.heaterDiameter / 2 - 1, P.peiThickness, 64),
        mats.pei
    );
    pei.position.y = -P.peiThickness / 2;
    pei.receiveShadow = true;
    bedGroup.add(pei);
}
// Bed mount brackets from corner blocks to bed underside (3 arms)
P.towerAngles.forEach((ang) => {
    const a = ang * Math.PI / 180;
    const [cx, cz] = towerXY(ang, towerOuterR);
    const cy = P.bottomRingY + P.horizHeightTop / 2;
    // Point on bed underside near tower
    const bx = Math.cos(a) * (P.bedDiameter / 2 - 12);
    const bz = -Math.sin(a) * (P.bedDiameter / 2 - 12);
    const by = P.bedBaseY - 4;
    const mid = new THREE.Vector3((cx + bx) / 2, (cy + by) / 2, (cz + bz) / 2);
    const len = Math.hypot(bx - cx, by - cy, bz - cz);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(14, 8, len), mats.printed);
    arm.position.copy(mid);
    arm.lookAt(bx, by, bz);
    bedGroup.add(arm);
});

// ---------- Carriages ----------
const carriages = P.towerAngles.map((ang) => {
    const grp = new THREE.Group();
    const a = ang * Math.PI / 180;
    const railR = P.deltaRadius + 4;
    grp.position.set(Math.cos(a) * railR, 100, -Math.sin(a) * railR);
    grp.lookAt(0, 100, 0);
    // Plate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(38, 44, 8), mats.carriage);
    plate.position.z = 4;
    plate.castShadow = true;
    grp.add(plate);
    // Printed extension with arm pivots
    const ext = new THREE.Mesh(new THREE.BoxGeometry(46, 16, 14), mats.printed);
    ext.position.set(0, 0, -1);
    ext.castShadow = true;
    grp.add(ext);
    // Two magball studs (pivots)
    [-1, 1].forEach((s) => {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(P.magballDiameter / 2, 16, 12), mats.magball);
        ball.position.set(P.armSpread * s, 0, -7);
        ball.castShadow = true;
        grp.add(ball);
    });
    grp.userData.angle = ang;
    scene.add(grp);
    return grp;
});

// ---------- Arms (rods + magballs) ----------
// 6 rods, each is a Mesh that we re-position and rotate to span carriage->effector.
const armRods = [];
const armBallsEffector = [];
for (let i = 0; i < 6; i++) {
    const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(P.armRodDiameter / 2, P.armRodDiameter / 2, P.armLength, 12),
        mats.rod
    );
    rod.castShadow = true;
    scene.add(rod);
    armRods.push(rod);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(P.magballDiameter / 2, 16, 12), mats.magball);
    scene.add(ball);
    armBallsEffector.push(ball);
}

// ---------- Effector + hotend ----------
const effectorGroup = new THREE.Group();
scene.add(effectorGroup);
{
    // Hexagonal effector plate
    const hexShape = new THREE.Shape();
    const r = P.effectorRadius;
    for (let i = 0; i < 6; i++) {
        const ang = i * Math.PI / 3;
        const x = Math.cos(ang) * r, y = Math.sin(ang) * r;
        if (i === 0) hexShape.moveTo(x, y); else hexShape.lineTo(x, y);
    }
    const plateGeom = new THREE.ExtrudeGeometry(hexShape, { depth: P.effectorThickness, bevelEnabled: false });
    const plate = new THREE.Mesh(plateGeom, mats.effector);
    plate.rotation.x = -Math.PI / 2;
    plate.castShadow = true;
    effectorGroup.add(plate);
    // Hotend collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 14, 24), mats.printed);
    collar.position.y = -10;
    collar.castShadow = true;
    effectorGroup.add(collar);
    // Heater block (brass-ish)
    const block = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 16), mats.hotendBlock);
    block.position.y = -22;
    block.castShadow = true;
    effectorGroup.add(block);
    // Nozzle
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 16), mats.nozzle);
    nozzle.position.y = -30;
    nozzle.rotation.x = Math.PI;
    effectorGroup.add(nozzle);
    // Tip marker (glowing) — this is the actual gcode nozzle point
    const tip = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.0 })
    );
    tip.position.y = -33.5;
    effectorGroup.add(tip);
    // Magball studs on effector (6 of them, paired around hex)
    for (let i = 0; i < 3; i++) {
        const ang = (P.towerAngles[i] * Math.PI) / 180;
        const px = -Math.sin(ang), pz = Math.cos(ang); // perp in original gcode XY
        [-1, 1].forEach((s) => {
            const wx = px * P.armSpread * s;
            const wy = pz * P.armSpread * s;
            // hex plate is in XZ plane (rotation.x = -PI/2), so effector-local:
            const ball = new THREE.Mesh(new THREE.SphereGeometry(P.magballDiameter / 2, 16, 12), mats.magball);
            // In effector local frame (Y up), arm pivot at offset in XZ
            // gcode->three: x->x, y->-z. So local position = (wx, 0, -wy)
            ball.position.set(wx, 0, -wy);
            effectorGroup.add(ball);
        });
    }
    // Side fan duct (visual flair)
    const fan = new THREE.Mesh(new THREE.BoxGeometry(24, 18, 12), mats.printed);
    fan.position.set(22, -8, 0);
    effectorGroup.add(fan);
}

// ---------- Build envelope ----------
const envelope = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(P.printRadius, P.printRadius, P.maxZ, 48, 1, true)),
    new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.35 })
);
envelope.position.y = P.maxZ / 2;
envelope.visible = false;
scene.add(envelope);

// ---------- Toolpath ----------
const pathPositions = [];
const pathColors = [];
const pathGeom = new THREE.BufferGeometry();
pathGeom.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
pathGeom.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
const pathLine = new THREE.LineSegments(pathGeom, new THREE.LineBasicMaterial({ vertexColors: true }));
scene.add(pathLine);

// ---------- Delta IK ----------
function towerJointPos(angleDeg) {
    const a = angleDeg * Math.PI / 180;
    return [Math.cos(a) * P.deltaRadius, Math.sin(a) * P.deltaRadius]; // gcode XY
}
const towerJoint = P.towerAngles.map(towerJointPos);

function carriageZForXY(towerIdx, x, y, z) {
    const [tx, ty] = towerJoint[towerIdx];
    const dx = tx - x, dy = ty - y;
    const inside = P.armLength * P.armLength - dx * dx - dy * dy;
    if (inside < 0) return { z: NaN, reach: false };
    return { z: z + Math.sqrt(inside), reach: true };
}

// ---------- Crash detection ----------
function checkPoint(x, y, z) {
    const issues = [];
    const r = Math.hypot(x, y);
    if (r > P.printRadius + 0.01) issues.push(`outside print radius (r=${r.toFixed(1)} > ${P.printRadius})`);
    if (z > P.maxZ + 0.01) issues.push(`above max Z (${z.toFixed(1)} > ${P.maxZ})`);
    if (z < P.minZ - 0.01) issues.push(`below min Z (${z.toFixed(1)} < ${P.minZ})`);
    for (let i = 0; i < 3; i++) {
        const c = carriageZForXY(i, x, y, z);
        if (!c.reach) { issues.push(`tower ${'ABC'[i]}: arm over-extended`); continue; }
        if (c.z < P.carriageMinZ) issues.push(`tower ${'ABC'[i]}: carriage below limit`);
        if (c.z > P.carriageMaxZ) issues.push(`tower ${'ABC'[i]}: carriage above limit`);
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
        for (const iss of checkPoint(x, y, z)) if (!seen.has(iss)) { seen.add(iss); issues.push(iss); }
    }
    return issues;
}

// ---------- Effector / arm visuals ----------
const _gtoTHREE = (x, y, z) => new THREE.Vector3(x, z, -y);
let currentCarriageZ = [0, 0, 0];

function setEffector(x, y, z) {
    // Effector group origin = where the hex plate sits. Tip is at local Y=-33.5.
    // We want tip at world (x, z, -y). So group.position.y = z + 33.5.
    effectorGroup.position.set(x, z + 33.5, -y);

    // Carriages: carriage center worldY equals IK carriage Z (both use bed surface as origin).
    for (let i = 0; i < 3; i++) {
        const c = carriageZForXY(i, x, y, z);
        currentCarriageZ[i] = c.reach ? c.z : currentCarriageZ[i];
        const ang = P.towerAngles[i] * Math.PI / 180;
        const railR = P.deltaRadius + 4;
        const cx = Math.cos(ang) * railR;
        const cz = -Math.sin(ang) * railR;
        if (c.reach) {
            const worldY = c.z;
            carriages[i].position.set(cx, worldY, cz);
            carriages[i].lookAt(0, worldY, 0);
        }
    }

    // Arms (6 rods + effector-side magballs)
    let unreachable = false;
    for (let i = 0; i < 3; i++) {
        const c = carriageZForXY(i, x, y, z);
        const ang = P.towerAngles[i] * Math.PI / 180;
        const px = -Math.sin(ang), py = Math.cos(ang); // perp in gcode XY
        const [tx, ty] = towerJoint[i];
        for (let k = 0; k < 2; k++) {
            const s = k === 0 ? -1 : 1;
            const idx = i * 2 + k;
            // Carriage pivot in gcode coords (at tower joint + perp offset)
            const cgx = tx + px * P.armSpread * s;
            const cgy = ty + py * P.armSpread * s;
            const cgz = c.reach ? c.z : (currentCarriageZ[i] || 100);
            // Carriage pivot world Y = c.z directly (both reference bed surface as origin).
            const cgWorld = new THREE.Vector3(cgx, cgz, -cgy);
            // Effector pivot in gcode coords:
            const egx = x + px * P.armSpread * s;
            const egy = y + py * P.armSpread * s;
            const egz = z;
            const egWorld = new THREE.Vector3(egx, egz, -egy);

            // Place magball on effector side
            armBallsEffector[idx].position.copy(egWorld);

            // Place rod cylinder spanning the two points
            const rod = armRods[idx];
            const mid = cgWorld.clone().add(egWorld).multiplyScalar(0.5);
            rod.position.copy(mid);
            const dir = egWorld.clone().sub(cgWorld);
            const length = dir.length();
            // Default cylinder axis is +Y. Align with dir.
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            rod.quaternion.copy(quat);
            // Scale cylinder to actual computed length (visually; physical length is fixed but this reads better)
            rod.scale.set(1, length / P.armLength, 1);
            rod.material = c.reach ? mats.rod : new THREE.MeshStandardMaterial({ color: 0xff3366, metalness: 0.7, roughness: 0.3 });
            if (!c.reach) unreachable = true;
        }
    }

    return { unreachable };
}

// ---------- G-code parser ----------
function parseGcode(text) {
    const lines = text.split(/\r?\n/);
    const moves = [];
    let absolute = true;
    let pos = { x: 0, y: 0, z: P.maxZ - 5, e: 0, f: 6000 };
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
            const k = tokens[t][0].toUpperCase();
            const v = parseFloat(tokens[t].slice(1));
            if (!isNaN(v)) args[k] = v;
        }
        if (cmd === 'G90') { absolute = true; continue; }
        if (cmd === 'G91') { absolute = false; continue; }
        if (cmd === 'G28') {
            const next = { x: 0, y: 0, z: P.maxZ, e: pos.e, f: pos.f };
            moves.push({ line: i + 1, type: 'home', from: { ...pos }, to: next, raw: lines[i] });
            pos = next; continue;
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
            const apply = (k, lk) => { if (k in args) next[lk] = absolute ? args[k] : pos[lk] + args[k]; };
            apply('X', 'x'); apply('Y', 'y'); apply('Z', 'z'); apply('E', 'e');
            if ('F' in args) next.f = args.F;
            const isPrint = (next.e > pos.e + 1e-6);
            moves.push({ line: i + 1, type: isPrint ? 'print' : 'travel',
                from: { ...pos }, to: { ...next }, raw: lines[i] });
            pos = next;
        }
    }
    return moves;
}

// ---------- Stepper audio synth ----------
class StepperAudio {
    constructor() {
        this.ctx = null;
        this.osc = [null, null, null];
        this.gain = [null, null, null];
        this.noiseGain = null;
        this.masterGain = null;
        this.stepsPerMm = 80;
        this.waveform = 'sawtooth';
        this.enabled = false;
        this.volume = 0.25;
        this.prevCarriage = [0, 0, 0];
        this.prevTime = 0;
        this.smoothedFreq = [0, 0, 0];
    }
    _init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
        for (let i = 0; i < 3; i++) {
            const osc = this.ctx.createOscillator();
            osc.type = this.waveform;
            osc.frequency.value = 100;
            const g = this.ctx.createGain();
            g.gain.value = 0;
            osc.connect(g).connect(this.masterGain);
            osc.start();
            this.osc[i] = osc;
            this.gain[i] = g;
        }
        // High-frequency chopper-like noise (TMC ~20-40kHz, audibly modulated by load).
        // We model as filtered white noise around 8kHz.
        const bufSize = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) ch[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        noise.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 5000;
        bp.Q.value = 4;
        const ng = this.ctx.createGain();
        ng.gain.value = 0;
        noise.connect(bp).connect(ng).connect(this.masterGain);
        noise.start();
        this.noiseGain = ng;
    }
    setEnabled(on) {
        this.enabled = on;
        if (on) {
            this._init();
            if (this.ctx) this.ctx.resume();
        } else if (this.ctx) {
            for (let i = 0; i < 3; i++) this.gain[i].gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
            if (this.noiseGain) this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
        }
    }
    setVolume(v) {
        this.volume = v;
        if (this.masterGain) this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
    setWaveform(w) {
        this.waveform = w;
        if (!this.ctx) return;
        for (let i = 0; i < 3; i++) this.osc[i].type = w;
    }
    setStepsPerMm(s) { this.stepsPerMm = s; }
    update(carriageZ, dt) {
        if (!this.enabled || !this.ctx) return [0, 0, 0];
        const freqs = [0, 0, 0];
        let totalVel = 0;
        const safeDt = Math.max(1e-4, dt);
        for (let i = 0; i < 3; i++) {
            const vel = (carriageZ[i] - this.prevCarriage[i]) / safeDt;
            const f = Math.min(8000, Math.abs(vel) * this.stepsPerMm);
            this.smoothedFreq[i] = this.smoothedFreq[i] * 0.6 + f * 0.4;
            freqs[i] = this.smoothedFreq[i];
            totalVel += Math.abs(vel);
            const target = Math.max(20, this.smoothedFreq[i]);
            const tgain = this.smoothedFreq[i] > 30 ? 0.35 : 0;
            this.osc[i].frequency.setTargetAtTime(target, this.ctx.currentTime, 0.012);
            this.gain[i].gain.setTargetAtTime(tgain, this.ctx.currentTime, 0.02);
            this.prevCarriage[i] = carriageZ[i];
        }
        if (this.noiseGain) {
            const ng = Math.min(0.08, totalVel / 1000);
            this.noiseGain.gain.setTargetAtTime(ng, this.ctx.currentTime, 0.03);
        }
        return freqs;
    }
}
const audio = new StepperAudio();

// ---------- Drag-drop STL loader ----------
const stlGroup = new THREE.Group();
scene.add(stlGroup);
const stlLoader = new STLLoader();
const loadedSTLs = [];

function loadSTLFromBuffer(name, buffer) {
    try {
        const geom = stlLoader.parse(buffer);
        geom.center();
        geom.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({ color: 0x00ff88, metalness: 0.2, roughness: 0.5, transparent: true, opacity: 0.85 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Scale check: many STLs are in mm already.
        // Position at origin; user can manipulate via list controls.
        stlGroup.add(mesh);
        loadedSTLs.push({ name, mesh });
        renderSTLList();
        logMsg(`Loaded STL "${name}" (${(buffer.byteLength / 1024).toFixed(1)} KB)`, 'ok');
    } catch (e) {
        logMsg(`Failed to parse STL "${name}": ${e.message}`, 'err');
    }
}

function renderSTLList() {
    const el = document.getElementById('stlList');
    el.innerHTML = '';
    loadedSTLs.forEach((entry, idx) => {
        const row = document.createElement('div');
        row.className = 'stl-row';
        row.innerHTML = `
            <label><input type="checkbox" checked data-idx="${idx}" data-act="vis"> ${entry.name}</label>
            <span class="stl-ctrls">
                <button data-idx="${idx}" data-act="up">↑Y</button>
                <button data-idx="${idx}" data-act="dn">↓Y</button>
                <button data-idx="${idx}" data-act="rot">⟳</button>
                <button data-idx="${idx}" data-act="del">✕</button>
            </span>`;
        el.appendChild(row);
    });
}

document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const idx = t.getAttribute('data-idx');
    const act = t.getAttribute('data-act');
    if (idx == null || !act) return;
    const entry = loadedSTLs[+idx];
    if (!entry) return;
    if (act === 'up') entry.mesh.position.y += 10;
    if (act === 'dn') entry.mesh.position.y -= 10;
    if (act === 'rot') entry.mesh.rotation.y += Math.PI / 12;
    if (act === 'del') { stlGroup.remove(entry.mesh); loadedSTLs.splice(+idx, 1); renderSTLList(); }
});
document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.getAttribute('data-act') !== 'vis') return;
    const idx = +t.getAttribute('data-idx');
    if (loadedSTLs[idx]) loadedSTLs[idx].mesh.visible = t.checked;
});

viewer.addEventListener('dragover', (e) => { e.preventDefault(); viewer.style.outline = '2px dashed #00ff88'; });
viewer.addEventListener('dragleave', () => { viewer.style.outline = ''; });
viewer.addEventListener('drop', (e) => {
    e.preventDefault();
    viewer.style.outline = '';
    for (const f of e.dataTransfer.files) {
        if (!/\.stl$/i.test(f.name)) continue;
        const r = new FileReader();
        r.onload = () => loadSTLFromBuffer(f.name, r.result);
        r.readAsArrayBuffer(f);
    }
});

// ---------- Simulation state ----------
let moves = [];
let currentMove = 0;
let moveT = 0;
let playing = false;
let speed = 3.0;
let currentPos = { x: 0, y: 0, z: P.maxZ - 5 };

function resetSim() {
    currentMove = 0;
    moveT = 0;
    playing = false;
    pathPositions.length = 0;
    pathColors.length = 0;
    updatePathGeometry();
    currentPos = { x: 0, y: 0, z: P.maxZ - 5 };
    setEffector(currentPos.x, currentPos.y, currentPos.z);
    audio.prevCarriage = [...currentCarriageZ];
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
    const c = isCrash ? [1, 0.2, 0.4] : (isPrint ? [0, 1, 0.53] : [0, 0.55, 0.65]);
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

function updateHud(freqs) {
    document.getElementById('hudPos').textContent =
        `X${currentPos.x.toFixed(1)} Y${currentPos.y.toFixed(1)} Z${currentPos.z.toFixed(1)}`;
    const cz = currentCarriageZ.map(v => v.toFixed(0));
    document.getElementById('hudCar').textContent = cz.join(' / ');
    document.getElementById('hudF').textContent = moves[currentMove]?.to.f?.toFixed(0) || '—';
    document.getElementById('hudLine').textContent = currentMove;
    document.getElementById('hudTotal').textContent = moves.length;
    if (freqs) {
        document.getElementById('hudFreq').textContent =
            freqs.map(f => Math.round(f) + 'Hz').join(' / ');
    }
    const issues = checkPoint(currentPos.x, currentPos.y, currentPos.z);
    const statusEl = document.getElementById('hudStatus');
    if (issues.length) { statusEl.textContent = '● CRASH: ' + issues[0]; statusEl.className = 'warn'; }
    else if (playing) { statusEl.textContent = '● Running'; statusEl.className = 'ok'; }
    else { statusEl.textContent = '● Idle'; statusEl.className = 'ok'; }
}

function loadGcode(text) {
    moves = parseGcode(text);
    logMsg(`Parsed ${moves.length} moves`, 'info');
    resetSim();
}

function checkAll() {
    let crashCount = 0;
    for (const m of moves) {
        const iss = checkMove(m);
        if (iss.length) { crashCount++; logMsg(`Line ${m.line} (${m.raw.trim()}): ${iss.join('; ')}`, 'err'); }
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

    let freqs = [0, 0, 0];
    if (playing && currentMove < moves.length) {
        const m = moves[currentMove];
        const len = Math.hypot(m.to.x - m.from.x, m.to.y - m.from.y, m.to.z - m.from.z) || 1;
        const feedMM = (m.to.f || 6000) / 60;
        const segDuration = len / feedMM;
        moveT += dt * speed / Math.max(0.001, segDuration);
        if (moveT >= 1) {
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
        freqs = audio.update(currentCarriageZ, dt);
        updateHud(freqs);
    } else {
        // Idle: ramp audio to silence
        if (audio.enabled) audio.update(currentCarriageZ, dt);
    }

    controls.update();
    renderer.render(scene, camera);
}

// ---------- UI ----------
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
    if (audio.enabled && audio.ctx) audio.ctx.resume();
    logMsg('Playing…', 'info');
});
document.getElementById('btnPause').addEventListener('click', () => {
    playing = false;
    document.getElementById('btnPlay').disabled = false;
    document.getElementById('btnPause').disabled = true;
});
document.getElementById('btnReset').addEventListener('click', () => loadGcode(document.getElementById('gcode').value));
document.getElementById('btnCheck').addEventListener('click', () => { loadGcode(document.getElementById('gcode').value); checkAll(); });

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
        logMsg(`Loaded ${f.name} (${(f.size / 1024).toFixed(1)} KB)`, 'info');
    };
    r.readAsText(f);
});

document.getElementById('tShowPath').addEventListener('change', e => pathLine.visible = e.target.checked);
document.getElementById('tShowEnvelope').addEventListener('change', e => envelope.visible = e.target.checked);
document.getElementById('tShowArms').addEventListener('change', e => {
    armRods.forEach(r => r.visible = e.target.checked);
    armBallsEffector.forEach(b => b.visible = e.target.checked);
});
document.getElementById('tShowFrame').addEventListener('change', e => frameGroup.visible = e.target.checked);
document.getElementById('tShowBed').addEventListener('change', e => bedGroup.visible = e.target.checked);

document.getElementById('btnFrameFront').addEventListener('click', () => {
    camera.position.set(0, 200, 600); controls.target.set(0, 80, 0);
});
document.getElementById('btnFrameTop').addEventListener('click', () => {
    camera.position.set(0.01, 800, 0.01); controls.target.set(0, 0, 0);
});
document.getElementById('btnFrameIso').addEventListener('click', () => {
    camera.position.set(420, 280, 520); controls.target.set(0, 80, 0);
});

// Audio UI
const audioEnable = document.getElementById('audioEnable');
const audioVol = document.getElementById('audioVol');
const audioWave = document.getElementById('audioWave');
const audioSPMM = document.getElementById('audioSPMM');
audioEnable.addEventListener('change', e => audio.setEnabled(e.target.checked));
audioVol.addEventListener('input', e => audio.setVolume(parseFloat(e.target.value)));
audioWave.addEventListener('change', e => audio.setWaveform(e.target.value));
audioSPMM.addEventListener('input', e => audio.setStepsPerMm(parseFloat(e.target.value)));

// STL file picker
document.getElementById('stlInput').addEventListener('change', (e) => {
    for (const f of e.target.files) {
        if (!/\.stl$/i.test(f.name)) continue;
        const r = new FileReader();
        r.onload = () => loadSTLFromBuffer(f.name, r.result);
        r.readAsArrayBuffer(f);
    }
});

// ---------- Init ----------
resize();
loadGcode(document.getElementById('gcode').value);
setEffector(0, 0, P.maxZ - 5);
logMsg('Doron Velta simulator ready. Drag STLs from the Doron-Velta repos onto the viewer.', 'ok');
logMsg('Enable the Acoustic Sim panel to estimate stepper frequency / sound.', 'info');
requestAnimationFrame(animate);
