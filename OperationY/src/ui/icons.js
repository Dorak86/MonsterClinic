// Rendert Einheiten- und Gebäudeportraits einmalig aus den 3D-Modellen

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeRobot, makeVehicle, makeBuilding } from '../render/models.js';
import { shared } from '../render/materials.js';
import { UNITS, BUILDINGS } from '../sim/defs.js';

export function renderIcons() {
  const icons = {};
  const size = 192;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  const prevTex = shared.fowTex.value, prevSize = shared.fowSize.value.clone();
  const blank = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
  blank.needsUpdate = true;
  shared.fowTex.value = blank;
  shared.fowSize.value.set(1e5, 1e5);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x403830, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const OFF = 500;
  const shoot = (obj, dist, h) => {
    obj.position.set(OFF, 0, OFF);
    obj.rotation.y = -0.7;
    scene.add(obj);
    cam.position.set(OFF + dist * 0.75, h + dist * 0.55, OFF + dist * 0.9);
    cam.lookAt(OFF, h * 0.55, OFF);
    r.setClearColor(0x000000, 0);
    r.render(scene, cam);
    scene.remove(obj);
    return canvas.toDataURL();
  };
  for (const type of Object.keys(UNITS)) {
    const u = UNITS[type];
    const obj = u.cls === 'robot' ? makeRobot(type, 1) : makeVehicle(type, 1);
    icons[type] = u.cls === 'robot' ? shoot(obj, 3.2, 1.3) : shoot(obj, 5.6, 1.1);
  }
  for (const type of Object.keys(BUILDINGS)) {
    const b = BUILDINGS[type];
    icons['b_' + type] = shoot(makeBuilding(type, 1), 6 + b.w * 3.2, 1.6 + b.w * 0.6);
  }
  shared.fowTex.value = prevTex;
  shared.fowSize.value.copy(prevSize);
  pm.dispose();
  r.dispose();
  r.forceContextLoss?.();
  return icons;
}

// Eigene Kommandantin für Briefings (stilisiert, frei erfunden)
export function drawPortrait(canvas, seed = 0) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#16222e'); bg.addColorStop(1, '#0a0f14');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // Rasterlinien
  g.strokeStyle = 'rgba(47,157,255,0.08)';
  for (let y = 0; y < H; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  const cx = W / 2;
  // Schultern / Uniform
  g.fillStyle = '#26323e';
  g.beginPath();
  g.moveTo(cx - 95, H); g.quadraticCurveTo(cx - 90, H - 80, cx - 40, H - 95);
  g.lineTo(cx + 40, H - 95); g.quadraticCurveTo(cx + 90, H - 80, cx + 95, H); g.fill();
  g.fillStyle = '#e5452f';
  g.fillRect(cx - 70, H - 70, 26, 5); g.fillRect(cx + 44, H - 70, 26, 5);
  // Kragen
  g.fillStyle = '#1b242d';
  g.beginPath(); g.moveTo(cx - 34, H - 96); g.lineTo(cx, H - 60); g.lineTo(cx + 34, H - 96); g.fill();
  // Hals
  g.fillStyle = '#a77f69';
  g.fillRect(cx - 16, H - 125, 32, 34);
  // Kopf
  g.fillStyle = '#c0937a';
  g.beginPath(); g.ellipse(cx, H - 160, 40, 50, 0, 0, Math.PI * 2); g.fill();
  // Haare (kurz, seitlich)
  g.fillStyle = '#2b1f1a';
  g.beginPath(); g.ellipse(cx - 4, H - 190, 44, 26, -0.1, Math.PI, Math.PI * 2.05); g.fill();
  g.fillRect(cx - 44, H - 192, 10, 40);
  // Visier
  const vg = g.createLinearGradient(cx - 40, 0, cx + 40, 0);
  vg.addColorStop(0, '#0d3c66'); vg.addColorStop(0.5, '#56c0ff'); vg.addColorStop(1, '#0d3c66');
  g.fillStyle = vg;
  g.beginPath(); g.roundRect(cx - 38, H - 172, 76, 18, 8); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(cx - 20, H - 169, 30, 3);
  // Mund
  g.strokeStyle = '#7a4f42'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 10, H - 128); g.lineTo(cx + 10, H - 128); g.stroke();
  // Headset
  g.strokeStyle = '#11161b'; g.lineWidth = 5;
  g.beginPath(); g.arc(cx, H - 165, 46, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.fillStyle = '#11161b'; g.fillRect(cx + 38, H - 170, 10, 22);
  g.strokeStyle = '#11161b'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx + 44, H - 150); g.quadraticCurveTo(cx + 34, H - 128, cx + 14, H - 127); g.stroke();
  // Abzeichen
  g.fillStyle = '#e5452f';
  g.beginPath(); g.moveTo(cx - 60, H - 50); g.lineTo(cx - 50, H - 40); g.lineTo(cx - 60, H - 30); g.lineTo(cx - 70, H - 40); g.fill();
  g.fillStyle = 'rgba(223,230,238,0.7)';
  g.font = '600 12px Segoe UI, sans-serif';
  g.fillText('KDT. VEY · 3. FELDKORPS', 12, 20);
  void seed;
}
