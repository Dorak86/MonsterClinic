// Sprecher-Portraits als animierte 3D-Büsten: Operator, Bolzen, Kurbel, General Grollmann

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeRobot } from '../render/models.js';
import { shared } from '../render/materials.js';

function std(color, r = 0.6, m = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
}

function headGeo() {
  // Kopfprofil: hohe Stirn, längliches Gesicht
  const prof = [[0, -0.46], [0.13, -0.44], [0.21, -0.37], [0.28, -0.22], [0.31, -0.05], [0.32, 0.12], [0.31, 0.27], [0.26, 0.4], [0.16, 0.48], [0, 0.51]];
  const curve = new THREE.SplineCurve(prof.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.LatheGeometry(curve.getPoints(40), 48);
  g.scale(1, 1, 1.12);
  return g;
}

// Haar-/Bartstruktur als Textur
function furTex(base, dark) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, l = 3 + Math.random() * 7, a = Math.PI / 2 + (Math.random() - 0.5) * 0.9;
    g.strokeStyle = Math.random() < 0.5 ? dark : 'rgba(255,220,180,0.25)';
    g.lineWidth = 0.8 + Math.random();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

const SPOTS = {
  op: { x: 0, cam: [1.0, 0.25, 3.6], look: [0, -0.15, 0] },
  bolzen: { x: 10, cam: [11.2, 2.4, 3.9], look: [10.1, 1.72, 0] },
  kurbel: { x: 20, cam: [21.2, 2.45, 4.0], look: [20.1, 1.75, 0] },
  groll: { x: 30, cam: [31.2, 2.5, 4.0], look: [30.1, 1.8, 0] },
};

export class Portrait {
  constructor(canvas, size) {
    this.canvas = canvas;
    this.size = size;
    this.talk = 0;
    this.running = false;
    this.t = 0;
    this.blinkT = 2;
    this.who = 'op';
  }

  init() {
    if (this.r) return;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: !!this.size });
    r.setPixelRatio(this.size ? 1 : Math.min(2, window.devicePixelRatio || 1));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.r = r;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    pm.dispose();
    this.scene = scene;
    this.cam = new THREE.PerspectiveCamera(24, 280 / 340, 0.1, 80);
    const key = new THREE.DirectionalLight(0xffe6cc, 2.6);
    key.position.set(2, 3, 3);
    key.target.position.set(0, 0, 0);
    scene.add(key);
    this.key = key;
    const rim = new THREE.DirectionalLight(0x4aa8ff, 4.5);
    rim.position.set(-2.5, 1.5, -2);
    scene.add(rim);
    this.rim = rim;
    scene.add(new THREE.HemisphereLight(0x9cb8d8, 0x2a2018, 0.9));
    this.subjects = {};
    this.buildOperator();
    this.buildRobots();
    this.resize();
  }

  // ---------- Operator (nach Referenzfoto stilisiert) ----------
  buildOperator() {
    const skin = std(0xe0aa94, 0.55);
    const hairM = std(0xffffff, 0.75, 0, { map: furTex('#32261e', 'rgba(15,9,6,0.7)') });
    const beardM = std(0xffffff, 0.8, 0, { map: furTex('#93522f', 'rgba(70,30,15,0.55)') });
    const stacheM = std(0xffffff, 0.8, 0, { map: furTex('#6e3b22', 'rgba(40,18,8,0.6)') });
    const shirt = std(0xf0d44a, 0.85);
    const navy = std(0x23306a, 0.8);
    const blue = new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0x2f9dff, emissiveIntensity: 2.2 });
    const metal = std(0x6c747e, 0.35, 0.8);
    const black = std(0x121416, 0.4, 0.3);
    const white = std(0xf2f0ec, 0.25);
    const iris = std(0x7f98a8, 0.2);
    const lip = std(0xb0705e, 0.5);
    const root = new THREE.Group();
    root.position.set(SPOTS.op.x, -0.15, 0);
    this.scene.add(root);
    const add = (geo, m, x, y, z, parent = root) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };

    // Gelbes Shirt mit dunkelblauem Kragen
    const torso = add(new THREE.SphereGeometry(1, 48, 32), shirt, 0, -1.08, 0);
    torso.scale.set(0.88, 0.58, 0.46);
    const collar = add(new THREE.TorusGeometry(0.19, 0.04, 16, 48), navy, 0, -0.58, 0.02);
    collar.rotation.x = Math.PI / 2 - 0.25;
    collar.scale.set(1, 1.15, 1);
    // Abzeichen der Blauen Allianz
    const badge = add(new THREE.CircleGeometry(0.07, 6), blue, -0.36, -0.78, 0.38);
    badge.rotation.y = -0.4;

    const head = new THREE.Group();
    head.position.set(0, 0.05, 0);
    root.add(head);
    this.subjects.op = { root, head, kind: 'human' };
    add(new THREE.CylinderGeometry(0.14, 0.16, 0.38, 32), skin, 0, -0.48, -0.02, head);
    add(headGeo(), skin, 0, 0, 0, head);
    for (const side of [-1, 1]) {
      const ear = add(new THREE.SphereGeometry(0.075, 20, 14), skin, side * 0.31, 0.03, -0.02, head);
      ear.scale.set(0.45, 1, 0.75);
    }
    // Augen: blaugrau, ernster Blick
    this.lids = [];
    for (const side of [-1, 1]) {
      const eye = add(new THREE.SphereGeometry(0.058, 24, 16), white, side * 0.12, 0.08, 0.31, head);
      eye.scale.set(1, 0.75, 0.6);
      add(new THREE.SphereGeometry(0.03, 20, 14), iris, side * 0.12, 0.08, 0.343, head);
      add(new THREE.SphereGeometry(0.013, 12, 10), black, side * 0.12, 0.08, 0.36, head);
      const lid = add(new THREE.SphereGeometry(0.065, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin, side * 0.12, 0.085, 0.31, head);
      lid.scale.set(1, 0.3, 0.7);
      this.lids.push(lid);
      // kräftige, gerade Brauen, innen leicht zusammengezogen
      const brow = add(new THREE.CapsuleGeometry(0.02, 0.1, 4, 10), hairM, side * 0.125, 0.165, 0.33, head);
      brow.rotation.z = Math.PI / 2 + side * 0.08;
    }
    // Nase: markant
    const nose = add(new THREE.CapsuleGeometry(0.042, 0.07, 6, 12), skin, 0, -0.01, 0.37, head);
    nose.rotation.x = 0.3;
    add(new THREE.SphereGeometry(0.045, 20, 14), skin, 0, -0.06, 0.38, head);
    // Vollbart, rotbraun
    const beard = add(new THREE.SphereGeometry(0.335, 48, 32, Math.PI / 2 - 1.85, 3.7, Math.PI * 0.5, Math.PI * 0.5), beardM, 0, -0.075, 0.005, head);
    beard.scale.set(0.99, 1.2, 1.1);
    const chin = add(new THREE.SphereGeometry(0.13, 32, 20), beardM, 0, -0.42, 0.17, head);
    chin.scale.set(1.35, 0.75, 1.0);
    // Schnurrbart und Mund
    for (const side of [-1, 1]) {
      const st = add(new THREE.CapsuleGeometry(0.03, 0.1, 6, 12), stacheM, side * 0.065, -0.115, 0.375, head);
      st.rotation.z = Math.PI / 2 + side * 0.3;
    }
    this.mouth = add(new THREE.CapsuleGeometry(0.017, 0.075, 6, 12), lip, 0, -0.165, 0.383, head);
    this.mouth.rotation.z = Math.PI / 2;
    // Haare: kurze Seiten, oben verwuschelt und hochstehend
    const cap = add(new THREE.SphereGeometry(0.37, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.42), hairM, 0, 0.12, -0.02, head);
    cap.scale.set(1.0, 1.12, 1.14);
    const back = add(new THREE.SphereGeometry(0.33, 40, 24), hairM, 0, 0.12, -0.1, head);
    back.scale.set(1.05, 1.08, 0.95);
    // verwuschelte Strähnen: dicke, kurze Büschel, vorne nach oben gestellt
    const tuftGeo = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0);
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const n = new THREE.Vector3();
    for (let i = 0; i < 55; i++) {
      const th = Math.acos(1 - rnd() * 0.5);
      const ph = rnd() * Math.PI * 2;
      n.set(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      const front = n.z > 0.15;
      const s = add(tuftGeo, hairM, n.x * 0.35, 0.12 + n.y * 0.4, n.z * 0.4 - 0.02, head);
      const len = (front ? 0.11 : 0.07) + rnd() * 0.06;
      const r = 0.05 + rnd() * 0.03;
      s.scale.set(r, len, r * 0.8);
      const dir = n.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.8, 0.5, front ? 0.25 : (rnd() - 0.5) * 0.4)).normalize();
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    // Headset
    add(new THREE.TorusGeometry(0.4, 0.022, 12, 48, Math.PI), black, 0, 0.06, -0.03, head);
    for (const side of [-1, 1]) {
      const cup = add(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 32), black, side * 0.36, 0.03, -0.02, head);
      cup.rotation.z = Math.PI / 2;
      const ring = add(new THREE.TorusGeometry(0.07, 0.008, 8, 32), blue, side * 0.4, 0.03, -0.02, head);
      ring.rotation.y = Math.PI / 2;
    }
    const a = new THREE.Vector3(0.37, -0.01, 0.03), b = new THREE.Vector3(0.17, -0.2, 0.36);
    const dir = b.clone().sub(a);
    const boom = add(new THREE.CapsuleGeometry(0.011, dir.length(), 4, 8), metal, 0, 0, 0, head);
    boom.position.copy(a).add(b).multiplyScalar(0.5);
    boom.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    add(new THREE.SphereGeometry(0.026, 16, 12), blue, b.x, b.y, b.z, head);
  }

  // ---------- Roboter-Sprecher ----------
  buildRobots() {
    const mk = (who, type, team) => {
      const o = makeRobot(type, team);
      // eigene Materialien, damit das Visier-Pulsieren nicht ins Spiel durchschlägt
      const glows = [];
      o.traverse((c) => {
        if (c.isMesh) {
          c.material = c.material.clone();
          if (c.material.emissive && c.material.emissiveIntensity > 1) glows.push(c.material);
        }
      });
      o.position.set(SPOTS[who].x, 0, 0);
      o.rotation.y = -0.9;
      this.scene.add(o);
      this.subjects[who] = { root: o, torso: o.userData.torso, glows, kind: 'robot' };
      return o;
    };
    mk('bolzen', 'runner', 1);
    const kurbel = mk('kurbel', 'grenadier', 1);
    const groll = mk('groll', 'grenadier', 2);
    const gold = std(0xd4a63a, 0.3, 0.9);
    const add = (parent, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    // Kurbel: Lesebrille
    const glass = std(0x222222, 0.3, 0.6);
    for (const side of [-1, 1]) {
      const g = add(kurbel.userData.torso, new THREE.TorusGeometry(0.045, 0.008, 8, 24), glass, 0.2, 0.75, side * 0.055);
      g.rotation.y = Math.PI / 2;
    }
    // Grollmann: Generalsmütze, Schulterklappen, Metall-Schnurrbart
    const capM = std(0x5a1410, 0.6);
    const t = groll.userData.torso;
    add(t, new THREE.CylinderGeometry(0.2, 0.17, 0.12, 32), capM, 0, 0.87, 0);
    const brim = add(t, new THREE.CylinderGeometry(0.13, 0.13, 0.015, 32), std(0x111111, 0.4), 0.11, 0.8, 0);
    brim.scale.set(1, 1, 1.4);
    add(t, new THREE.SphereGeometry(0.035, 16, 12), gold, 0.19, 0.87, 0);
    for (const side of [-1, 1]) {
      const ep = add(t, new THREE.BoxGeometry(0.16, 0.025, 0.12), gold, 0, 0.62, side * 0.28);
      ep.rotation.x = side * 0.2;
      const st = add(t, new THREE.CapsuleGeometry(0.018, 0.08, 4, 10), std(0x9aa0a8, 0.3, 0.9), 0.17, 0.67, side * 0.05);
      st.rotation.x = Math.PI / 2 + side * 0.5;
    }
  }

  setSpeaker(who) {
    if (!this.r) this.init();
    this.who = SPOTS[who] ? who : 'op';
    const sp = SPOTS[this.who];
    this.cam.position.set(...sp.cam);
    this.cam.lookAt(...sp.look);
    this.key.position.set(sp.x + 2, 3, 3);
    this.key.target.position.set(sp.x, 1, 0);
    this.key.target.updateMatrixWorld();
    this.rim.position.set(sp.x - 2.5, 2, -2);
    this.rim.color.setHex(this.who === 'groll' ? 0xff5a3a : 0x4aa8ff);
  }

  start() {
    this.init();
    this.resize();
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.frame(Math.min(0.05, (now - last) / 1000));
      last = now;
    };
    requestAnimationFrame(loop);
  }

  resize() {
    const w = this.size || this.canvas.clientWidth || 280, h = this.size || this.canvas.clientHeight || 340;
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  stop() { this.running = false; }

  speak(seconds) { this.talk = Math.max(this.talk, seconds); }

  frame(dt) {
    this.t += dt;
    const t = this.t;
    if (this.talk > 0) this.talk -= dt;
    const talking = this.talk > 0;
    const s = this.subjects[this.who];
    if (s.kind === 'human') {
      s.head.rotation.y = Math.sin(t * 0.6) * 0.07 + Math.sin(t * 1.7) * 0.02;
      s.head.rotation.x = Math.sin(t * 0.9) * 0.025 + (talking ? Math.sin(t * 7) * 0.015 : 0);
      const open = talking ? Math.abs(Math.sin(t * 16)) * 0.9 + Math.abs(Math.sin(t * 9.3)) * 0.4 : 0;
      this.mouth.scale.set(1 + open * 0.6, 1, 1);
      this.blinkT -= dt;
      let lid = 0.3;
      if (this.blinkT < 0.12) lid = 1.0;
      if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 3;
      for (const l of this.lids) l.scale.y = lid;
    } else {
      s.torso.rotation.y = Math.sin(t * 0.7) * 0.08 + (talking ? Math.sin(t * 6) * 0.04 : 0);
      s.torso.rotation.z = Math.sin(t * 1.1) * 0.02 + (talking ? Math.sin(t * 9) * 0.015 : 0);
      const pulse = talking ? 2.5 + Math.abs(Math.sin(t * 14)) * 4 : 2.5 + Math.sin(t * 2) * 0.4;
      for (const m of s.glows) m.emissiveIntensity = pulse;
    }
    this.render();
  }

  render() {
    // Nebel des Krieges für die Portraitszene neutralisieren
    const pt = shared.fowTex.value, ps = shared.fowSize.value.clone();
    if (!this.blank) { this.blank = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat); this.blank.needsUpdate = true; }
    shared.fowTex.value = this.blank;
    shared.fowSize.value.set(1e5, 1e5);
    this.r.render(this.scene, this.cam);
    shared.fowTex.value = pt;
    shared.fowSize.value.copy(ps);
  }

  // Standbild eines Sprechers als Bild (für Funkmeldungen)
  snapshot(who) {
    this.init();
    this.setSpeaker(who);
    this.talk = 0;
    this.frame(0);
    return this.canvas.toDataURL();
  }
}
