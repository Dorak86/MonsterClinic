// Kommandantin Vey als animierte 3D-Büste (eigene Figur, aus Grundkörpern modelliert)

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

function std(color, r = 0.6, m = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });
}

function headGeo() {
  // Kopfprofil als Drehkörper: schmales Kinn, breiter Schädel
  const pts = [];
  const prof = [[0, -0.44], [0.12, -0.42], [0.2, -0.36], [0.27, -0.22], [0.31, -0.05], [0.33, 0.1], [0.32, 0.24], [0.27, 0.36], [0.17, 0.44], [0, 0.47]];
  for (const [x, y] of prof) pts.push(new THREE.Vector2(x, y));
  const curve = new THREE.SplineCurve(pts);
  const g = new THREE.LatheGeometry(curve.getPoints(40), 48);
  g.scale(1, 1, 1.12);
  return g;
}

export class Portrait {
  constructor(canvas) {
    this.canvas = canvas;
    this.talk = 0;
    this.running = false;
    this.t = 0;
    this.blinkT = 2;
  }

  init() {
    if (this.r) return;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setSize(this.canvas.clientWidth || 280, this.canvas.clientHeight || 340, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.r = r;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    this.scene = scene;
    const cam = new THREE.PerspectiveCamera(24, (this.canvas.clientWidth || 280) / (this.canvas.clientHeight || 340), 0.1, 50);
    cam.position.set(1.0, 0.3, 3.5);
    cam.lookAt(0, -0.12, 0);
    this.cam = cam;
    const key = new THREE.DirectionalLight(0xffe6cc, 2.6);
    key.position.set(2, 2, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x4aa8ff, 4.5);
    rim.position.set(-2.5, 1.2, -2);
    scene.add(rim);
    const fill = new THREE.HemisphereLight(0x9cb8d8, 0x2a2018, 0.8);
    scene.add(fill);
    this.build();
  }

  build() {
    const skin = std(0xc8957a, 0.55, 0, { sheen: 0 });
    const hair = std(0x2a1d17, 0.7);
    const uni = std(0x2b3440, 0.75, 0.1);
    const uniDark = std(0x1a2028, 0.8);
    const blue = new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0x2f9dff, emissiveIntensity: 2.2 });
    const metal = std(0x6c747e, 0.35, 0.8);
    const black = std(0x101214, 0.4, 0.3);
    const white = std(0xf2f0ec, 0.25);
    const iris = std(0x3d6a7a, 0.2);
    const lip = std(0x9e5d52, 0.5);
    const root = new THREE.Group();
    root.position.y = -0.15;
    this.scene.add(root);
    const add = (geo, m, x, y, z, parent = root) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };

    // Schultern und Uniform
    const torso = add(new THREE.SphereGeometry(1, 48, 32), uni, 0, -1.05, 0);
    torso.scale.set(0.85, 0.55, 0.45);
    for (const side of [-1, 1]) {
      const board = add(new THREE.CapsuleGeometry(0.07, 0.28, 8, 16), uniDark, side * 0.55, -0.62, 0);
      board.rotation.z = Math.PI / 2 + side * 0.32;
      const stripe = add(new THREE.CapsuleGeometry(0.018, 0.22, 4, 8), blue, side * 0.56, -0.57, 0.06);
      stripe.rotation.z = Math.PI / 2 + side * 0.32;
    }
    const collar = add(new THREE.CylinderGeometry(0.2, 0.27, 0.2, 40, 1, true), uniDark, 0, -0.55, 0);
    collar.material = uniDark.clone(); collar.material.side = THREE.DoubleSide;
    // Abzeichen
    const badge = add(new THREE.OctahedronGeometry(0.06, 0), blue, -0.32, -0.78, 0.36);
    badge.scale.set(1, 1, 0.3);

    // Kopf-Gruppe (bewegt sich)
    const head = new THREE.Group();
    head.position.set(0, 0.08, 0);
    root.add(head);
    this.head = head;
    add(new THREE.CylinderGeometry(0.13, 0.15, 0.35, 32), skin, 0, -0.46, -0.02, head);
    add(headGeo(), skin, 0, 0, 0, head);
    for (const side of [-1, 1]) {
      const ear = add(new THREE.SphereGeometry(0.07, 20, 14), skin, side * 0.31, 0.02, -0.02, head);
      ear.scale.set(0.45, 1, 0.75);
    }
    // Augen
    this.lids = [];
    for (const side of [-1, 1]) {
      const eye = add(new THREE.SphereGeometry(0.065, 24, 16), white, side * 0.115, 0.07, 0.3, head);
      eye.scale.set(1, 0.85, 0.6);
      add(new THREE.SphereGeometry(0.032, 20, 14), iris, side * 0.115, 0.07, 0.335, head);
      add(new THREE.SphereGeometry(0.014, 12, 10), black, side * 0.115, 0.07, 0.355, head);
      const lid = add(new THREE.SphereGeometry(0.072, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin, side * 0.115, 0.075, 0.3, head);
      lid.scale.set(1, 0.15, 0.7);
      this.lids.push(lid);
      const brow = add(new THREE.CapsuleGeometry(0.014, 0.08, 4, 8), hair, side * 0.12, 0.16, 0.315, head);
      brow.rotation.z = Math.PI / 2 - side * 0.12;
    }
    // Nase, Mund
    const nose = add(new THREE.CapsuleGeometry(0.03, 0.08, 6, 12), skin, 0, 0.0, 0.36, head);
    nose.rotation.x = 0.35;
    this.mouth = add(new THREE.CapsuleGeometry(0.018, 0.08, 6, 12), lip, 0, -0.14, 0.33, head);
    this.mouth.rotation.z = Math.PI / 2;
    // Haare: kurzer Schnitt mit Pony
    const cap = add(new THREE.SphereGeometry(0.36, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.44), hair, 0, 0.06, -0.02, head);
    cap.scale.set(1.0, 1.28, 1.12);
    const back = add(new THREE.SphereGeometry(0.33, 40, 24), hair, 0, 0.1, -0.1, head);
    back.scale.set(1.06, 1.08, 0.95);
    const fringe = add(new THREE.SphereGeometry(0.2, 32, 16), hair, -0.06, 0.31, 0.22, head);
    fringe.scale.set(1.35, 0.42, 0.75);
    fringe.rotation.set(0.35, 0, 0.22);
    // Headset: Bügel über den Kopf von Ohr zu Ohr
    add(new THREE.TorusGeometry(0.39, 0.022, 12, 48, Math.PI), black, 0, 0.04, -0.03, head);
    for (const side of [-1, 1]) {
      const cup = add(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 32), black, side * 0.36, 0.02, -0.02, head);
      cup.rotation.z = Math.PI / 2;
      const ring = add(new THREE.TorusGeometry(0.07, 0.008, 8, 32), blue, side * 0.4, 0.02, -0.02, head);
      ring.rotation.y = Math.PI / 2;
    }
    // Mikrofonarm vom rechten Ohr zum Mundwinkel
    {
      const a = new THREE.Vector3(0.37, -0.02, 0.03), b = new THREE.Vector3(0.15, -0.17, 0.3);
      const dir = b.clone().sub(a);
      const boom = add(new THREE.CapsuleGeometry(0.011, dir.length(), 4, 8), metal, 0, 0, 0, head);
      boom.position.copy(a).add(b).multiplyScalar(0.5);
      boom.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      add(new THREE.SphereGeometry(0.026, 16, 12), blue, b.x, b.y, b.z, head);
    }
    // taktisches Monokel über dem rechten Auge
    const mono = add(new THREE.TorusGeometry(0.075, 0.01, 10, 40), metal, -0.115, 0.07, 0.36, head);
    void mono;
    const lens = add(new THREE.CircleGeometry(0.07, 32), new THREE.MeshStandardMaterial({ color: 0x4ab8ff, emissive: 0x1a6aaa, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, roughness: 0.05 }), -0.115, 0.07, 0.362, head);
    void lens;
    const arm = add(new THREE.CapsuleGeometry(0.01, 0.2, 4, 8), metal, -0.24, 0.08, 0.27, head);
    arm.rotation.set(0, 0.9, Math.PI / 2);
  }

  start(text, onDone) {
    this.init();
    this.resize();
    this.running = true;
    this.text = text || '';
    this.typed = 0;
    this.onDone = onDone;
    const loop = () => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.frame(1 / 60);
    };
    loop();
  }

  resize() {
    const w = this.canvas.clientWidth || 280, h = this.canvas.clientHeight || 340;
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  stop() { this.running = false; }

  frame(dt) {
    this.t += dt;
    const t = this.t;
    if (this.talk > 0) this.talk -= dt;
    // Kopfbewegung
    this.head.rotation.y = Math.sin(t * 0.6) * 0.08 + Math.sin(t * 1.7) * 0.02;
    this.head.rotation.x = Math.sin(t * 0.9) * 0.03 + (this.talk > 0 ? Math.sin(t * 7) * 0.015 : 0);
    // Mund
    const open = this.talk > 0 ? Math.abs(Math.sin(t * 16)) * 0.9 + Math.abs(Math.sin(t * 9.3)) * 0.4 : 0;
    this.mouth.scale.set(1 + open * 0.55, 1 - open * 0.1, 1);
    // Blinzeln
    this.blinkT -= dt;
    let lid = 0.15;
    if (this.blinkT < 0.12) lid = 1.0;
    if (this.blinkT < 0) this.blinkT = 2.5 + Math.random() * 3;
    for (const l of this.lids) l.scale.y = lid;
    this.r.render(this.scene, this.cam);
  }

  speak(seconds) { this.talk = Math.max(this.talk, seconds); }
}
