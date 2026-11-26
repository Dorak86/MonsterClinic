import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import a from '../../src/models/vehicle_lighttank.glb';
import b from '../../src/models/vehicle_mediumtank.glb';
import c from '../../src/models/vehicle_heavytank.glb';
import d from '../../src/models/vehicle_transporter.glb';
import e from '../../src/models/vehicle_fueltruck.glb';
import f from '../../src/models/vehicle_launcher.glb';
import g2 from '../../src/models/vehicle_buggy.glb';
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(1400, 700); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8a9aa8);
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(3, 6, 4); scene.add(sun);
const cam = new THREE.PerspectiveCamera(30, 2, 0.1, 100); cam.position.set(4.2, 4.5, 8.5); cam.lookAt(4.2, 0, 0);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const list = [a, b, c, d, e, f, g2];
const params = new URLSearchParams(location.search);
const clip = params.get('clip') || 'Walk', t = +(params.get('t') || 0.25), side = params.get('side');
let done = 0;
list.forEach((buf, i) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (g) => { try {
  const o = g.scene; const W = makeWeather(); o.traverse((m) => { if (m.isMesh && (m.material.name === 'Team' || m.material.name === 'Armor' || m.material.name === 'Dark' || m.material.name.startsWith('Crate'))) { m.material = m.material.clone(); m.material.map = W; if (m.material.name === 'Team' && i >= 4) m.material.color.setHex(0x2a4a8a); } }); o.position.x = (i % 4) * 2.3 + 0.6; o.position.y = i < 4 ? 0.9 : -1.2; o.scale.setScalar(0.62); o.rotation.y = side ? Math.PI / 2 : 0.7; scene.add(o);
  const mixer = new THREE.AnimationMixer(o);
  const a = g.animations.find((c) => c.name === clip);
  if (a) { mixer.clipAction(a).play(); mixer.update(t); }
  if (++done === list.length) { r.render(scene, cam); window.READY = 'ok'; } } catch (err) { window.READY = 'EXC ' + err.message; }
}, (e) => { window.READY = 'ERR ' + e; }));

function makeWeather() {
  if (window._W) return window._W;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  g.fillStyle = '#eeeae4'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) { const x = Math.random() * S, y = Math.random() * S, r = 4 + Math.random() * 20; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, i % 3 ? 'rgba(60,50,40,0.15)' : 'rgba(120,60,25,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return (window._W = t);
}
