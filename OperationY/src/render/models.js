// Prozedurale 3D-Modelle für Roboter, Fahrzeuge, Gebäude und Flaggen (eigene Entwürfe)

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, TEAM_COLORS, panelTex, treadTex, patchFow } from './materials.js';

let PANEL = null, TREAD = null;
function textures() {
  if (!PANEL) { PANEL = panelTex(); TREAD = treadTex(); }
}

const geoCache = new Map();
function G(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const rbox = (w, h, d, r = 0.06, s = 3) => G(`rb${w},${h},${d},${r},${s}`, () => new RoundedBoxGeometry(w, h, d, s, r));
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, n = 20) => G(`c${rt},${rb},${h},${n}`, () => new THREE.CylinderGeometry(rt, rb, h, n));
const cylR = (ax, rt, rb, h, n = 20) => G(`cr${ax}${rt},${rb},${h},${n}`, () => new THREE.CylinderGeometry(rt, rb, h, n)[ax === 'z' ? 'rotateZ' : 'rotateX'](Math.PI / 2));
const sph = (r, ws = 20, hs = 14) => G(`s${r},${ws}`, () => new THREE.SphereGeometry(r, ws, hs));
const sphS = (x, y, z) => G(`ss${x},${y},${z}`, () => new THREE.SphereGeometry(1, 24, 16).scale(x, y, z));
const caps = (r, len, ax = 'y') => G(`cp${r},${len},${ax}`, () => {
  const g = new THREE.CapsuleGeometry(r, len, 6, 16);
  if (ax === 'x') g.rotateZ(Math.PI / 2); else if (ax === 'z') g.rotateX(Math.PI / 2);
  return g;
});

const teamMats = new Map();
export function teamMat(team, kind = 'paint') {
  const key = team + kind;
  if (teamMats.has(key)) return teamMats.get(key);
  textures();
  const tc = TEAM_COLORS[team];
  let m;
  if (kind === 'paint') {
    const c = tc.clone().lerp(new THREE.Color(0x8a9096), team === 0 ? 0.2 : 0.35);
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.55, map: PANEL });
  } else if (kind === 'glow') {
    m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: tc, emissiveIntensity: team === 0 ? 0.4 : 3.2, roughness: 0.4 });
  } else if (kind === 'dark') {
    m = new THREE.MeshStandardMaterial({ color: tc.clone().multiplyScalar(0.3), roughness: 0.6, metalness: 0.4 });
  }
  patchFow(m);
  teamMats.set(key, m);
  return m;
}

function metal(c = 0x6c7278) { textures(); return mat(c, { r: 0.4, m: 0.75, map: PANEL }); }
const darkMetal = () => mat(0x2a2d31, { r: 0.5, m: 0.7 });
const rubber = () => mat(0x1c1c1e, { r: 0.95, m: 0.0 });

function mesh(geo, material, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// ---------------- Roboter ----------------
function buildRobot(type, team) {
  // Eigenes Design: kräftiger Kampfroboter mit Kapsel-Gliedmaßen, Kugelgelenken und Visierhelm
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  const paint = teamMat(team, 'paint'), glow = teamMat(team, 'glow'), dk = darkMetal(), mt = metal(0x8a9098);
  const joint = mat(0x3a3f46, { r: 0.35, m: 0.8 });
  const heavy = type === 'grenadier';
  const slim = type === 'sniper';
  const bw = heavy ? 1.12 : slim ? 0.9 : 1;
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.name = side < 0 ? 'legL' : 'legR';
    hip.position.set(0, 0.6, side * 0.13 * bw);
    mesh(sph(0.075, 16, 12), joint, 0, 0, 0, hip);
    mesh(caps(0.06 * bw, 0.2), dk, 0, -0.15, 0, hip);
    mesh(sph(0.065, 16, 12), joint, 0.01, -0.3, 0, hip);
    mesh(caps(0.085 * bw, 0.16), paint, 0.015, -0.43, 0, hip);
    mesh(rbox(0.26, 0.09, 0.17 * bw, 0.04, 4), dk, 0.05, -0.56, 0, hip);
    body.add(hip);
  }
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 0.6;
  body.add(torso);
  // Becken + Rumpf
  mesh(sphS(0.17 * bw, 0.1, 0.2 * bw), dk, 0, 0.06, 0, torso);
  mesh(caps(0.07, 0.08), joint, 0, 0.16, 0, torso);
  mesh(sphS(0.21 * bw, 0.22, 0.25 * bw), paint, 0.01, 0.36, 0, torso);
  mesh(rbox(0.12, 0.22, 0.3 * bw, 0.05, 4), mt, 0.15 * bw, 0.36, 0, torso);
  mesh(caps(0.018, 0.16, 'x'), glow, 0.215 * bw, 0.4, 0, torso);
  mesh(caps(0.018, 0.16, 'x'), glow, 0.215 * bw, 0.34, 0, torso);
  // Schulterpanzer
  for (const side of [-1, 1]) {
    mesh(sphS(0.12 * bw, 0.09, 0.12), paint, 0, 0.52, side * 0.27 * bw, torso);
    mesh(caps(0.012, 0.12), glow, 0.06, 0.55, side * 0.33 * bw, torso);
  }
  // Rucksack
  mesh(rbox(0.16, 0.28, 0.3 * bw, 0.06, 4), dk, -0.22 * bw, 0.38, 0, torso);
  mesh(cyl(0.045, 0.045, 0.06, 16), glow, -0.31 * bw, 0.44, 0, torso);
  if (type === 'sniper') mesh(cyl(0.008, 0.012, 0.5, 12), dk, -0.26, 0.7, -0.09, torso);
  // Helm
  const head = new THREE.Group();
  head.userData.flatten = true;
  head.position.set(0.02, 0.64, 0);
  torso.add(head);
  mesh(caps(0.05, 0.04), joint, 0, -0.04, 0, head);
  if (type === 'rocketeer') {
    mesh(sphS(0.15, 0.14, 0.15), paint, 0, 0.1, 0, head);
    for (const side of [-1, 1]) mesh(cylR('x', 0.06, 0.06, 0.05, 16), dk, 0, 0.1, side * 0.15, head);
    mesh(caps(0.035, 0.16, 'z'), glow, 0.13, 0.1, 0, head);
  } else if (type === 'grenadier') {
    mesh(sphS(0.17, 0.13, 0.17), paint, 0, 0.1, 0, head);
    mesh(rbox(0.22, 0.04, 0.05, 0.02, 3), mt, -0.01, 0.23, 0, head);
    mesh(rbox(0.1, 0.07, 0.26, 0.03, 3), dk, 0.12, 0.05, 0, head);
    mesh(caps(0.028, 0.18, 'z'), glow, 0.14, 0.12, 0, head);
  } else if (type === 'sniper') {
    mesh(sphS(0.12, 0.13, 0.13), paint, 0, 0.1, 0, head);
    mesh(cylR('z', 0.045, 0.05, 0.09, 16), dk, 0.12, 0.11, 0.05, head);
    mesh(cylR('z', 0.035, 0.035, 0.02, 16), glow, 0.17, 0.11, 0.05, head);
    mesh(caps(0.02, 0.06, 'z'), glow, 0.11, 0.11, -0.05, head);
  } else {
    mesh(sphS(0.14, 0.13, 0.14), paint, 0, 0.1, 0, head);
    mesh(rbox(0.06, 0.035, 0.14, 0.015, 3), mt, 0.07, 0.21, 0, head);
    mesh(caps(0.03, 0.15, 'z'), glow, 0.125, 0.1, 0, head);
  }
  // Arme + Waffe
  const arms = new THREE.Group();
  arms.name = 'arms';
  arms.position.set(0, 0.46, 0);
  torso.add(arms);
  for (const side of [-1, 1]) {
    mesh(caps(0.055 * bw, 0.12), dk, 0.04, -0.06, side * 0.28 * bw, arms);
    mesh(sph(0.055, 14, 10), joint, 0.08, -0.15, side * 0.27 * bw, arms);
    mesh(caps(0.06 * bw, 0.16, 'x'), paint, 0.18, -0.16, side * 0.2 * bw, arms);
  }
  const gun = new THREE.Group();
  gun.name = 'gun';
  gun.userData.flatten = true;
  gun.position.set(0.26, -0.12, 0.1);
  arms.add(gun);
  let muzzle = 0.6;
  if (type === 'rocketeer') {
    gun.position.set(0.05, 0.12, 0.25);
    mesh(cylR('z', 0.085, 0.085, 0.8, 20), mt, 0.1, 0, 0, gun);
    mesh(cylR('z', 0.1, 0.09, 0.12, 20), dk, -0.28, 0, 0, gun);
    mesh(cylR('z', 0.095, 0.095, 0.05, 20), glow, 0.5, 0, 0, gun);
    mesh(rbox(0.12, 0.1, 0.04, 0.02, 3), dk, 0.15, -0.1, 0, gun);
    muzzle = 0.55;
  } else if (type === 'grenadier') {
    mesh(rbox(0.36, 0.14, 0.12, 0.04, 3), dk, 0.1, 0, 0, gun);
    mesh(cyl(0.1, 0.1, 0.13, 20), mt, 0.04, -0.07, 0, gun);
    mesh(cylR('z', 0.055, 0.055, 0.32, 16), mt, 0.38, 0.02, 0, gun);
    mesh(cylR('z', 0.06, 0.06, 0.03, 16), glow, 0.53, 0.02, 0, gun);
    muzzle = 0.55;
  } else if (type === 'sniper') {
    mesh(rbox(0.42, 0.08, 0.07, 0.03, 3), dk, 0.12, 0, 0, gun);
    mesh(cylR('z', 0.022, 0.022, 0.6, 20), mt, 0.58, 0.01, 0, gun);
    mesh(cylR('z', 0.032, 0.032, 0.18, 16), dk, 0.12, 0.075, 0, gun);
    mesh(cylR('z', 0.025, 0.025, 0.01, 16), glow, 0.215, 0.075, 0, gun);
    muzzle = 0.88;
  } else {
    mesh(rbox(0.38, 0.1, 0.08, 0.03, 3), dk, 0.12, 0, 0, gun);
    mesh(cylR('z', 0.028, 0.028, 0.22, 20), mt, 0.4, 0.01, 0, gun);
    mesh(rbox(0.08, 0.12, 0.05, 0.02, 3), dk, 0.08, -0.08, 0, gun);
    muzzle = 0.52;
  }
  root.userData = { kind: 'robot', muzzleLen: muzzle, scale: 1.55 };
  root.scale.setScalar(1.55);
  return root;
}

// ---------------- Fahrzeuge ----------------
function wheel(r, wdt) {
  const g = new THREE.Group();
  mesh(cylR('x', r, r, wdt, 16), rubber(), 0, 0, 0, g);
  mesh(cylR('x', r * 0.55, r * 0.55, wdt + 0.02, 16), metal(0x9098a0), 0, 0, 0, g);
  return g;
}

function tracks(len, hgt, wdt, z, parent) {
  textures();
  const tm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: TREAD.clone(), roughness: 0.9 });
  tm.map.repeat.set(1, 4);
  tm.map.needsUpdate = true;
  patchFow(tm);
  for (const side of [-1, 1]) {
    const t = mesh(rbox(len, hgt, wdt, 0.08), tm, 0, hgt / 2, side * z, parent);
    t.userData.track = true;
    for (let i = 0; i < 4; i++) {
      mesh(cylR('x', hgt * 0.32, hgt * 0.32, wdt + 0.04, 20), darkMetal(), -len / 2 + 0.25 + i * (len - 0.5) / 3, hgt * 0.45, side * z, parent);
    }
  }
  return tm;
}

function buildVehicle(type, team) {
  const root = new THREE.Group();
  const hull = new THREE.Group();
  hull.name = 'hull';
  root.add(hull);
  const paint = teamMat(team, 'paint'), glow = teamMat(team, 'glow'), dk = darkMetal(), mt = metal(0x6a7078);
  const turret = new THREE.Group();
  turret.name = 'turret';
  const barrels = [];
  const wheels = [];
  let trackMat = null, muzzle = 1;
  if (type === 'buggy') {
    mesh(rbox(1.9, 0.35, 1.1, 0.12), paint, 0, 0.55, 0, hull);
    mesh(rbox(0.8, 0.3, 0.95, 0.1), dk, -0.2, 0.85, 0, hull);
    mesh(box(0.06, 0.1, 0.9), glow, 0.95, 0.6, 0, hull);
    // Überrollbügel
    for (const z of [-0.42, 0.42]) mesh(cyl(0.04, 0.04, 0.6, 12), mt, -0.45, 1.05, z, hull);
    mesh(cylR('x', 0.04, 0.04, 0.88, 12), mt, -0.45, 1.35, 0, hull);
    for (const [x, z] of [[0.62, 0.62], [0.62, -0.62], [-0.62, 0.62], [-0.62, -0.62]]) {
      const wh = wheel(0.32, 0.26);
      wh.position.set(x, 0.32, z);
      hull.add(wh);
      wheels.push(wh);
    }
    turret.position.set(0.15, 1.05, 0);
    mesh(cyl(0.16, 0.2, 0.18, 20), dk, 0, 0, 0, turret);
    const b = new THREE.Group();
    b.position.set(0.1, 0.06, 0);
    mesh(rbox(0.38, 0.14, 0.14, 0.03), mt, 0.12, 0, 0, b);
    mesh(cylR('z', 0.03, 0.03, 0.4, 12), dk, 0.48, 0, 0, b);
    turret.add(b);
    barrels.push(b);
    muzzle = 0.75;
  } else if (type === 'lighttank') {
    trackMat = tracks(2.3, 0.5, 0.42, 0.6, hull);
    mesh(rbox(2.2, 0.45, 1.25, 0.12), paint, 0, 0.72, 0, hull);
    mesh(box(0.05, 0.08, 1.1), glow, 1.1, 0.75, 0, hull);
    mesh(box(1.6, 0.04, 0.05), glow, -0.1, 0.96, 0.6, hull);
    mesh(box(1.6, 0.04, 0.05), glow, -0.1, 0.96, -0.6, hull);
    turret.position.set(-0.05, 1.12, 0);
    mesh(rbox(1.0, 0.36, 0.85, 0.12), paint, 0, 0, 0, turret);
    mesh(box(0.3, 0.12, 0.3), dk, -0.3, 0.22, 0.2, turret);
    const b = new THREE.Group();
    b.position.set(0.45, 0.02, 0);
    mesh(cylR('z', 0.07, 0.08, 1.2, 20), mt, 0.6, 0, 0, b);
    mesh(cylR('z', 0.1, 0.1, 0.16, 20), dk, 1.2, 0, 0, b);
    turret.add(b);
    barrels.push(b);
    muzzle = 1.7;
  } else if (type === 'heavytank') {
    trackMat = tracks(2.8, 0.62, 0.52, 0.78, hull);
    mesh(rbox(2.7, 0.55, 1.6, 0.14), paint, 0, 0.88, 0, hull);
    for (const side of [-1, 1]) mesh(rbox(2.4, 0.3, 0.12, 0.05), dk, 0, 0.62, side * 1.05, hull);
    mesh(box(0.05, 0.1, 1.4), glow, 1.36, 0.9, 0, hull);
    turret.position.set(-0.2, 1.38, 0);
    mesh(rbox(1.35, 0.48, 1.2, 0.16), paint, 0, 0, 0, turret);
    mesh(rbox(0.5, 0.2, 0.5, 0.06), dk, -0.35, 0.32, -0.25, turret);
    mesh(box(0.04, 0.1, 0.9), glow, 0.68, 0.05, 0, turret);
    for (const z of [-0.2, 0.2]) {
      const b = new THREE.Group();
      b.position.set(0.6, 0.02, z);
      mesh(cylR('z', 0.08, 0.09, 1.4, 20), mt, 0.7, 0, 0, b);
      mesh(cylR('z', 0.11, 0.11, 0.18, 20), dk, 1.4, 0, 0, b);
      turret.add(b);
      barrels.push(b);
    }
    muzzle = 2.1;
  } else if (type === 'launcher') {
    mesh(rbox(2.3, 0.4, 1.25, 0.1), dk, 0, 0.62, 0, hull);
    mesh(rbox(0.75, 0.6, 1.2, 0.12), paint, 0.72, 1.05, 0, hull);
    mesh(box(0.05, 0.2, 1.0), glow, 1.1, 1.1, 0, hull);
    for (const [x, z] of [[0.75, 0.62], [0.75, -0.62], [-0.1, 0.62], [-0.1, -0.62], [-0.8, 0.62], [-0.8, -0.62]]) {
      const wh = wheel(0.3, 0.24);
      wh.position.set(x, 0.3, z);
      hull.add(wh);
      wheels.push(wh);
    }
    turret.position.set(-0.45, 1.0, 0);
    mesh(cyl(0.3, 0.35, 0.16, 20), mt, 0, 0, 0, turret);
    const b = new THREE.Group();
    b.position.set(0, 0.35, 0);
    b.rotation.z = 0.35;
    mesh(rbox(1.2, 0.5, 0.9, 0.08), paint, 0, 0, 0, b);
    for (const [yy, zz] of [[0.12, 0.22], [0.12, -0.22], [-0.12, 0.22], [-0.12, -0.22]]) {
      mesh(cylR('z', 0.09, 0.09, 0.06, 20), glow, 0.6, yy, zz, b);
    }
    turret.add(b);
    barrels.push(b);
    muzzle = 0.8;
  }
  hull.add(turret);
  barrels.forEach((b, i) => { b.name = 'barrel' + i; });
  wheels.forEach((w, i) => { w.name = 'wheel' + i; });
  void trackMat;
  root.userData = { kind: 'vehicle', muzzleLen: muzzle, nb: barrels.length, nw: wheels.length };
  return root;
}

// ---------------- Gebäude ----------------
function buildBuilding(type, team) {
  const root = new THREE.Group();
  const paint = teamMat(team, 'paint'), glow = teamMat(team, 'glow'), dk = darkMetal();
  const concrete = mat(0x8c8a84, { r: 0.92 });
  const concreteDark = mat(0x5e5c58, { r: 0.95 });
  const mt = metal(0x7a8088);
  const ud = { kind: 'building', turret: null, barrels: [], spin: null, chimneys: [] };
  const named = () => {
    if (ud.turret) ud.turret.name = 'turret';
    ud.barrels.forEach((b, i) => { b.name = 'barrel' + i; });
    if (ud.spin) ud.spin.name = 'spin';
  };
  if (type === 'fort') {
    // Grundfläche 6x6 m
    mesh(rbox(6, 0.6, 6, 0.2), concreteDark, 0, 0.3, 0, root);
    mesh(rbox(5.0, 1.6, 5.0, 0.3), concrete, 0, 1.3, 0, root);
    for (const [x, z] of [[2.4, 2.4], [-2.4, 2.4], [2.4, -2.4], [-2.4, -2.4]]) {
      mesh(cyl(0.75, 0.9, 2.6, 8), concrete, x, 1.3, z, root);
      mesh(cyl(0.8, 0.8, 0.2, 8), paint, x, 2.7, z, root);
      mesh(cyl(0.3, 0.3, 0.12, 20), glow, x, 2.86, z, root);
    }
    for (const side of [-1, 1]) {
      mesh(box(4.2, 0.12, 0.08), glow, 0, 1.6, side * 2.52, root);
      mesh(box(0.08, 0.12, 4.2), glow, side * 2.52, 1.6, 0, root);
    }
    mesh(rbox(2.6, 0.5, 2.6, 0.15), paint, 0, 2.35, 0, root);
    const tur = new THREE.Group();
    tur.position.set(0, 2.9, 0);
    mesh(rbox(1.6, 0.6, 1.4, 0.18), paint, 0, 0, 0, tur);
    mesh(box(0.06, 0.12, 1.0), glow, 0.8, 0.05, 0, tur);
    for (const z of [-0.3, 0.3]) {
      const b = new THREE.Group();
      b.position.set(0.7, 0.05, z);
      mesh(cylR('z', 0.1, 0.12, 1.8, 20), mt, 0.9, 0, 0, b);
      mesh(cylR('z', 0.14, 0.14, 0.2, 20), dk, 1.8, 0, 0, b);
      tur.add(b);
      ud.barrels.push(b);
    }
    root.add(tur);
    ud.turret = tur;
    // Antenne
    mesh(cyl(0.03, 0.05, 2.4, 12), mt, -1.9, 3.8, -1.9, root);
    mesh(sph(0.1), glow, -1.9, 5.0, -1.9, root);
    ud.muzzleLen = 1.9;
  } else if (type === 'robot') {
    // 6x4 m
    mesh(rbox(6, 0.3, 4, 0.1), concreteDark, 0, 0.15, 0, root);
    mesh(rbox(5.4, 1.8, 3.4, 0.15), concrete, 0, 1.15, 0, root);
    const roof = mesh(G('roofR', () => new THREE.CylinderGeometry(1.75, 1.75, 5.5, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2)), paint, 0, 2.05, 0, root);
    roof.scale.set(1, 0.5, 1);
    // Tor (Vorderseite = +z)
    mesh(box(2.2, 1.4, 0.1), mat(0x222428, { r: 0.4, m: 0.6 }), 0, 0.95, 1.72, root);
    mesh(box(2.4, 0.1, 0.12), glow, 0, 1.72, 1.74, root);
    for (const x of [-1.2, 1.2]) mesh(box(0.1, 1.4, 0.12), glow, x, 0.95, 1.74, root);
    for (const x of [-2.0, 2.0]) {
      mesh(cyl(0.22, 0.28, 1.6, 20), mt, x, 2.6, -1.1, root);
      ud.chimneys.push([x, 3.5, -1.1]);
    }
    mesh(rbox(1.0, 0.5, 0.7, 0.08), dk, 2.2, 0.55, 1.6, root);
  } else if (type === 'vehicle') {
    // 6x6 m
    mesh(rbox(6, 0.3, 6, 0.1), concreteDark, 0, 0.15, 0, root);
    mesh(rbox(5.6, 2.4, 4.8, 0.2), concrete, 0, 1.4, -0.4, root);
    mesh(rbox(5.8, 0.4, 5.0, 0.12), paint, 0, 2.75, -0.4, root);
    mesh(box(3.2, 2.0, 0.1), mat(0x1e2024, { r: 0.4, m: 0.7 }), 0, 1.2, 2.02, root);
    for (let i = 0; i < 5; i++) mesh(box(3.2, 0.05, 0.06), mat(0x3a3e44, { r: 0.5, m: 0.6 }), 0, 0.4 + i * 0.4, 2.06, root);
    mesh(box(3.5, 0.12, 0.14), glow, 0, 2.3, 2.06, root);
    // Kran
    mesh(box(0.25, 2.8, 0.25), mt, 2.5, 3.0, 2.2, root);
    mesh(box(0.2, 0.2, 2.6), mt, 2.5, 4.3, 1.0, root);
    mesh(cyl(0.3, 0.3, 0.8, 20), dk, -2.0, 3.3, -2.0, root);
    ud.chimneys.push([-2.0, 3.8, -2.0]);
    // Lichter
    mesh(sph(0.12), glow, 2.5, 4.5, 2.2, root);
  } else if (type === 'radar') {
    mesh(rbox(1.8, 0.3, 1.8, 0.1), concreteDark, 0, 0.15, 0, root);
    for (const [x, z] of [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]]) {
      const leg = mesh(cyl(0.05, 0.07, 3.2, 12), mt, x * 0.6, 1.8, z * 0.6, root);
      leg.rotation.set(z * 0.18, 0, -x * 0.18);
    }
    mesh(cyl(0.22, 0.22, 0.4, 20), dk, 0, 3.4, 0, root);
    const spin = new THREE.Group();
    spin.position.set(0, 3.7, 0);
    const dish = mesh(G('dish', () => new THREE.SphereGeometry(1.0, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.32)), mat(0xd8dade, { r: 0.35, m: 0.5 }), 0, 0, 0, spin);
    dish.material.side = THREE.DoubleSide;
    dish.rotation.z = Math.PI / 2 + 0.3;
    dish.position.x = 0.6;
    mesh(sph(0.1), glow, 0.25, 0.1, 0, spin);
    root.add(spin);
    ud.spin = spin;
  } else if (type === 'turret') {
    mesh(cyl(0.95, 1.05, 0.9, 24), concrete, 0, 0.45, 0, root);
    mesh(cyl(1.0, 1.0, 0.12, 20), paint, 0, 0.95, 0, root);
    const tur = new THREE.Group();
    tur.position.set(0, 1.25, 0);
    mesh(rbox(1.1, 0.5, 0.9, 0.15), paint, 0, 0, 0, tur);
    mesh(box(0.06, 0.1, 0.6), glow, 0.55, 0.05, 0, tur);
    const b = new THREE.Group();
    b.position.set(0.5, 0.05, 0);
    mesh(cylR('z', 0.08, 0.09, 1.2, 20), mt, 0.6, 0, 0, b);
    tur.add(b);
    ud.barrels.push(b);
    root.add(tur);
    ud.turret = tur;
    ud.muzzleLen = 1.2;
  }
  named();
  root.userData = { kind: 'building', chimneys: ud.chimneys, muzzleLen: ud.muzzleLen || 1, nb: ud.barrels.length };
  return root;
}

// ---------- Zusammenführen und Vorlagen ----------
const ATTRS = ['position', 'normal', 'uv'];
let STD = null;
function stdMat() {
  if (!STD) {
    textures();
    STD = patchFow(new THREE.MeshStandardMaterial({ vertexColors: true, map: PANEL, roughness: 0.5, metalness: 0.45 }));
  }
  return STD;
}

function flatten(group) {
  for (const c of [...group.children]) {
    if (c.children.length) flatten(c);
    if (c.userData.flatten) {
      c.updateMatrix();
      for (const m of [...c.children]) {
        if (!m.isMesh) continue;
        m.updateMatrix();
        m.matrix.premultiply(c.matrix);
        m.matrix.decompose(m.position, m.quaternion, m.scale);
        group.add(m);
      }
    }
  }
}

export function mergeChildren(group, top = true) {
  if (top) flatten(group);
  const buckets = new Map();
  for (const c of [...group.children]) {
    if (c.isMesh && c.children.length === 0) {
      const m = c.material;
      const glow = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0;
      const key = (glow || c.userData.track || m.side !== THREE.FrontSide || m.transparent || !m.isMeshStandardMaterial) ? m : 'std';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(c);
    } else if (c.children.length) mergeChildren(c, false);
  }
  for (const [key, list] of buckets) {
    if (list.length < 2 && key !== 'std') continue;
    const geos = list.map((c) => {
      c.updateMatrix();
      const g = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone());
      for (const k of Object.keys(g.attributes)) if (!ATTRS.includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(c.matrix);
      if (key === 'std') {
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3);
        const cc = c.material.color;
        for (let i = 0; i < n; i++) { col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mm = new THREE.Mesh(merged, key === 'std' ? stdMat() : key);
    mm.castShadow = true; mm.receiveShadow = true;
    if (list.every((c) => c.userData.track)) mm.userData.track = true;
    for (const c of list) group.remove(c);
    group.add(mm);
  }
}

const templates = new Map();
function instance(key, build) {
  if (!templates.has(key)) {
    const t = build();
    mergeChildren(t);
    templates.set(key, t);
  }
  return templates.get(key).clone();
}

export function makeRobot(type, team) {
  const o = instance('r' + type + team, () => buildRobot(type, team));
  const ud = o.userData;
  ud.body = o.getObjectByName('body');
  ud.legs = [o.getObjectByName('legL'), o.getObjectByName('legR')];
  ud.torso = o.getObjectByName('torso');
  ud.arms = o.getObjectByName('arms');
  ud.gun = o.getObjectByName('gun');
  return o;
}

export function makeVehicle(type, team) {
  const o = instance('v' + type + team, () => buildVehicle(type, team));
  const ud = o.userData;
  ud.hull = o.getObjectByName('hull');
  ud.turret = o.getObjectByName('turret');
  ud.barrels = [];
  for (let i = 0; i < ud.nb; i++) ud.barrels.push(o.getObjectByName('barrel' + i));
  ud.wheels = [];
  for (let i = 0; i < ud.nw; i++) ud.wheels.push(o.getObjectByName('wheel' + i));
  ud.barrelIdx = 0;
  ud.trackMat = null;
  o.traverse((c) => {
    if (c.isMesh && c.userData.track) {
      if (!ud.trackMat) { ud.trackMat = patchFow(c.material.clone()); ud.trackMat.map = c.material.map.clone(); ud.trackMat.map.needsUpdate = true; }
      c.material = ud.trackMat;
    }
  });
  return o;
}

export function makeBuilding(type, team) {
  const o = instance('b' + type + team, () => buildBuilding(type, team));
  const ud = o.userData;
  ud.turret = o.getObjectByName('turret') || null;
  ud.spin = o.getObjectByName('spin') || null;
  ud.barrels = [];
  for (let i = 0; i < ud.nb; i++) ud.barrels.push(o.getObjectByName('barrel' + i));
  return o;
}

export function makeRuin(type, w, h) {
  const root = new THREE.Group();
  const c = mat(0x3a3836, { r: 1 });
  const c2 = mat(0x24221f, { r: 1 });
  const W = w * 2, H = h * 2;
  mesh(box(W * 0.95, 0.35, H * 0.95), c2, 0, 0.17, 0, root);
  const n = 6 + w * h;
  for (let i = 0; i < n; i++) {
    const s = 0.3 + Math.random() * 0.8;
    const m = mesh(G('rubble', () => new THREE.DodecahedronGeometry(1, 0)), Math.random() < 0.5 ? c : c2,
      (Math.random() - 0.5) * W * 0.8, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * H * 0.8, root);
    m.scale.set(s, s * 0.6, s);
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
  }
  for (let i = 0; i < 3; i++) {
    const m = mesh(box(0.3, 1 + Math.random() * 1.5, 0.3), c, (Math.random() - 0.5) * W * 0.7, 0.8, (Math.random() - 0.5) * H * 0.7, root);
    m.rotation.z = (Math.random() - 0.5) * 0.6;
  }
  mergeChildren(root);
  return root;
}

// ---------------- Flagge ----------------
export function makeFlag() {
  const root = new THREE.Group();
  const pad = mesh(cyl(1.0, 1.15, 0.16, 24), mat(0x55585c, { r: 0.6, m: 0.5 }), 0, 0.08, 0, root);
  pad.castShadow = false;
  mesh(cyl(0.05, 0.06, 3.2, 16), metal(0xb8bcc2), 0, 1.6, 0, root);
  mesh(sph(0.09), metal(0xd0d4d8), 0, 3.25, 0, root);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.18;
  root.add(ring);
  const capMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
  const cap = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.4, 48, 1, 0, 0.01), capMat);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = 0.2;
  cap.visible = false;
  root.add(cap);
  // Tuch
  const clothGeo = new THREE.PlaneGeometry(1.3, 0.8, 10, 4);
  clothGeo.translate(0.65, 0, 0);
  const clothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8, emissive: 0x000000, emissiveIntensity: 0.6 });
  patchFow(clothMat);
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.position.set(0.04, 2.8, 0);
  cloth.castShadow = true;
  root.add(cloth);
  root.userData = { cloth, ring, cap, base: clothGeo.attributes.position.array.slice() };
  return root;
}

// Wrack: graue Kopie eines Modells
export function wreckify(obj) {
  const m = mat(0x1e1c1a, { r: 1, m: 0.2 });
  obj.traverse((o) => { if (o.isMesh) o.material = m; });
  return obj;
}
