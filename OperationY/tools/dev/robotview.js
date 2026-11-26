import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import runner from '../../assets/robot_runner.glb';
import grenadier from '../../assets/robot_grenadier.glb';
import rocketeer from '../../assets/robot_rocketeer.glb';
import sniper from '../../assets/robot_sniper.glb';
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(1400, 700); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8a9aa8);
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(3, 6, 4); scene.add(sun);
const cam = new THREE.PerspectiveCamera(30, 2, 0.1, 100); cam.position.set(4.2, 1.6, 7.5); cam.lookAt(4.2, 0.9, 0);
const loader = new GLTFLoader();
const list = [runner, grenadier, rocketeer, sniper];
const params = new URLSearchParams(location.search);
const clip = params.get('clip') || 'Walk', t = +(params.get('t') || 0.25), side = params.get('side');
let done = 0;
list.forEach((buf, i) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (g) => {
  const o = g.scene; o.position.x = i * 2.6 + 0.3; o.rotation.y = side ? Math.PI / 2 : 0.5; scene.add(o);
  const mixer = new THREE.AnimationMixer(o);
  const a = g.animations.find((c) => c.name === clip);
  if (a) { mixer.clipAction(a).play(); mixer.update(t); }
  if (++done === 4) { r.render(scene, cam); window.READY = g.animations.map((c) => c.name + ':' + c.duration.toFixed(2)).join(','); }
}, (e) => { window.READY = 'ERR ' + e; }));
