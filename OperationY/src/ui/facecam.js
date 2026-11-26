// HUD-Gesichtskamera: zeigt den Kopf der ausgewählten Einheit live mit LED-Gesicht im Visier

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeRobot } from '../render/models.js';
import { shared } from '../render/materials.js';

export class FaceCam {
  constructor(size = 112) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'facecam';
    this.size = size;
    this.t = 0;
    this.key = null;
  }

  init() {
    if (this.r) return;
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setSize(this.size, this.size, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.r = r;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.4;
    pm.dispose();
    const key = new THREE.DirectionalLight(0xfff0e0, 2.6);
    key.position.set(1.5, 3, 3);
    this.scene.add(key);
    this.rim = new THREE.DirectionalLight(0xff6a4a, 3);
    this.rim.position.set(-2, 2, -2);
    this.scene.add(this.rim);
    this.scene.add(new THREE.HemisphereLight(0xb0c0d0, 0x302820, 0.8));
    this.cam = new THREE.PerspectiveCamera(22, 1, 0.1, 20);
    this.cam.position.set(0.35, 2.0, 1.25);
    this.cam.lookAt(0, 1.8, 0);
    // LED-Gesicht
    const c = document.createElement('canvas');
    c.width = 128; c.height = 64;
    this.ledCtx = c.getContext('2d');
    this.ledTex = new THREE.CanvasTexture(c);
    this.ledTex.colorSpace = THREE.SRGBColorSpace;
    this.ledMat = new THREE.MeshBasicMaterial({ map: this.ledTex, transparent: true, toneMapped: false });
  }

  // Einheit setzen: Robotertyp (bei Fahrzeugen der Fahrer) und Team
  set(type, team) {
    this.init();
    const key = type + team;
    if (key === this.key) return;
    this.key = key;
    if (this.model) this.scene.remove(this.model);
    const o = makeRobot(type, team);
    o.rotation.y = -Math.PI / 2 + 0.3;
    this.scene.add(o);
    o.updateMatrixWorld(true);
    const model = o.userData.model;
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), this.ledMat);
    led.position.set(0, 1.63, 0.2);
    model.add(led);
    led.updateMatrixWorld(true);
    model.getObjectByName('Head').attach(led);
    this.model = o;
    this.mixer = o.userData.mixer;
    this.rim.color.setHex(team === 2 ? 0x4aa8ff : team === 1 ? 0xff6a4a : 0xa0a8b0);
  }

  drawFace(mood) {
    const g = this.ledCtx, W = 128, H = 64, t = this.t;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(10,6,4,0.85)';
    g.fillRect(0, 0, W, H);
    const col = mood === 'panic' ? '#ff6050' : mood === 'grin' ? '#80ff90' : mood === 'empty' ? '#6a5a40' : '#ffc070';
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 5; g.lineCap = 'round';
    const blink = Math.sin(t * 1.7) > 0.97;
    const eye = (x) => {
      if (blink && mood !== 'panic') { g.beginPath(); g.moveTo(x - 9, 24); g.lineTo(x + 9, 24); g.stroke(); return; }
      if (mood === 'panic') { g.beginPath(); g.arc(x + Math.sin(t * 30) * 2, 24, 10, 0, 7); g.stroke(); g.beginPath(); g.arc(x, 24, 3, 0, 7); g.fill(); }
      else if (mood === 'grin') { g.beginPath(); g.arc(x, 28, 9, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      else if (mood === 'bored') { g.fillRect(x - 10, 24, 20, 5); }
      else if (mood === 'empty') { g.fillRect(x - 9, 30, 18, 3); }
      else if (mood === 'angry') { g.beginPath(); g.moveTo(x - 10, 18 + (x < 64 ? 0 : 6)); g.lineTo(x + 10, 18 + (x < 64 ? 6 : 0)); g.stroke(); g.fillRect(x - 6, 26, 12, 6); }
      else { g.fillRect(x - 8, 18, 16, 12); }
    };
    eye(40); eye(88);
    g.beginPath();
    if (mood === 'panic') g.ellipse(64, 50, 8, 6 + Math.abs(Math.sin(t * 12)) * 3, 0, 0, 7);
    else if (mood === 'grin') g.arc(64, 38, 16, 0.2, Math.PI - 0.2);
    else if (mood === 'bored') { g.moveTo(52, 52); g.lineTo(76, 50); }
    else if (mood === 'empty') { g.moveTo(54, 52); g.quadraticCurveTo(64, 46, 74, 52); }
    else if (mood === 'angry') { g.moveTo(50, 54); g.lineTo(78, 54); }
    else { g.moveTo(54, 50); g.lineTo(74, 50); }
    g.stroke();
    if (mood === 'empty') { g.font = 'bold 16px monospace'; g.fillText('z', 100 + Math.sin(t * 2) * 3, 18); g.font = 'bold 11px monospace'; g.fillText('z', 112, 8); }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    this.ledTex.needsUpdate = true;
  }

  render(dt, mood) {
    if (!this.model) return;
    this.t += dt;
    this.drawFace(mood);
    this.mixer.update(dt);
    const head = this.model.userData.head;
    if (mood === 'panic') { head.rotation.y += Math.sin(this.t * 25) * 0.08; head.rotation.x += Math.sin(this.t * 31) * 0.05; }
    else if (mood === 'grin') head.rotation.z += Math.sin(this.t * 6) * 0.06;
    const pt = shared.fowTex.value, ps = shared.fowSize.value.clone();
    if (!this.blank) { this.blank = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat); this.blank.needsUpdate = true; }
    shared.fowTex.value = this.blank;
    shared.fowSize.value.set(1e5, 1e5);
    this.r.render(this.scene, this.cam);
    shared.fowTex.value = pt;
    shared.fowSize.value.copy(ps);
  }
}

// Stimmung einer Einheit aus dem Spielzustand
export function moodOf(u, time) {
  if (!u) return 'neutral';
  if (u.bat != null && u.bat <= 0) return 'empty';
  if (time - u.hitT < 1.6) return 'panic';
  if (time - (u.killT ?? -9) < 3) return 'grin';
  if (u.target) return 'angry';
  if ((u.bat != null && u.bat < 20) || (u.order.kind === 'idle' && (u.idleT > 12 || (u.still || 0) > 12))) return 'bored';
  return 'neutral';
}
