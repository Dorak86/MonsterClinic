import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import a from '../../src/models/vehicle_buggy.glb';
import b from '../../src/models/vehicle_lighttank.glb';
import c from '../../src/models/vehicle_heavytank.glb';
import d from '../../src/models/vehicle_launcher.glb';
import e from '../../src/models/robot_flamer.glb';
import f from '../../src/models/robot_laser.glb';
import g2 from '../../src/models/robot_assault.glb';
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(1400, 700); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8a9aa8);
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(3, 6, 4); scene.add(sun);
const cam = new THREE.PerspectiveCamera(30, 2, 0.1, 100); cam.position.set(4.2, 1.6, 7.5); cam.lookAt(4.2, 0.9, 0);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const list = [a, b, c, d, e, f, g2];
const params = new URLSearchParams(location.search);
const clip = params.get('clip') || 'Walk', t = +(params.get('t') || 0.25), side = params.get('side');
let done = 0;
list.forEach((buf, i) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (g) => {
  const o = g.scene; o.position.x = i * 1.45 + 0.2; o.scale.setScalar(i < 4 ? 0.55 : 0.8); o.rotation.y = side ? Math.PI / 2 : 0.7; scene.add(o);
  const mixer = new THREE.AnimationMixer(o);
  const a = g.animations.find((c) => c.name === clip);
  if (a) { mixer.clipAction(a).play(); mixer.update(t); }
  if (++done === list.length) { r.render(scene, cam); window.READY = g.animations.map((c) => c.name + ':' + c.duration.toFixed(2)).join(','); }
}, (e) => { window.READY = 'ERR ' + e; }));
