// Szene, Kamera, Licht, Nachbearbeitung, Abgleich mit der Simulation

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TILE, shared, TEAM_COLORS } from './materials.js';
import { Terrain } from './terrain.js';
import { Effects } from './effects.js';
import { makeRobot, makeVehicle, makeBuilding, makeRuin, makeFlag, wreckify, makeBarrel } from './models.js';
import { T } from '../sim/defs.js';

function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class Renderer {
  constructor(canvas, quality = 1) {
    this.canvas = canvas;
    this.quality = quality;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, quality > 0 ? 2 : 1.25));
    r.shadowMap.enabled = true;
    r.shadowMap.type = quality > 0 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.r = r;
    const pm = new THREE.PMREMGenerator(r);
    this.envMap = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 600);
    this.cam = { x: 0, z: 0, dist: 34, yaw: 0, pitch: 0.95, tx: 0, tz: 0, tdist: 34 };
    this.world = null;
  }

  setQuality(q) {
    this.quality = q;
  }

  // ---------- Level aufbauen ----------
  load(world) {
    this.dispose();
    this.world = world;
    const map = world.map;
    const biome = map.biome;
    const scene = new THREE.Scene();
    this.scene = scene;
    scene.background = new THREE.Color(biome.sky);
    scene.fog = new THREE.Fog(biome.fog, 90, 230);
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.35;

    // Licht
    const hemi = new THREE.HemisphereLight(biome.hemiSky, biome.hemiGround, 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(biome.sun, biome.sunI);
    sun.castShadow = true;
    const ss = this.quality > 0 ? 4096 : 1024;
    sun.shadow.mapSize.set(ss, ss);
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;
    this.sunOffset = new THREE.Vector3(-38, 60, -26);

    // Nebel-des-Krieges-Textur
    const n = map.w * map.h;
    this.fowData = new Uint8Array(n);
    this.fowCur = new Float32Array(n).fill(235);
    this.fowTex = new THREE.DataTexture(this.fowData, map.w, map.h, THREE.RedFormat, THREE.UnsignedByteType);
    this.fowTex.magFilter = THREE.LinearFilter;
    this.fowTex.minFilter = THREE.LinearFilter;
    this.fowTex.needsUpdate = true;
    shared.fowTex.value = this.fowTex;
    shared.fowSize.value.set(map.w * TILE, map.h * TILE);
    // Gebietsfärbung
    this.terData = new Uint8Array(n * 4);
    this.terTex = new THREE.DataTexture(this.terData, map.w, map.h, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.terTex.magFilter = THREE.LinearFilter;
    this.terTex.minFilter = THREE.LinearFilter;
    shared.terTex.value = this.terTex;

    this.terrain = new Terrain(scene, map, this.quality);
    this.effects = new Effects(scene, this.terrain, this.quality);
    this.entities = new Map(); // id -> {obj, ...}
    this.wrecks = [];
    this.flags = [];
    for (const s of world.sectors) {
      const f = makeFlag();
      const wx = s.x * TILE, wz = s.y * TILE;
      f.position.set(wx, this.terrain.unitHeight(s.x, s.y), wz);
      scene.add(f);
      this.flags.push({ obj: f, sector: s, phase: Math.random() * 6 });
    }
    this.borderGroup = new THREE.Group();
    scene.add(this.borderGroup);
    this.updateTerritory();

    // Auswahlringe
    this.ringGeo = new THREE.RingGeometry(0.85, 1.0, 32).rotateX(-Math.PI / 2);
    this.rings = [];
    this.markers = [];
    // Umgebungseffekte
    const bid = map.biomeId;
    const cx = map.w * TILE / 2, cz = map.h * TILE / 2;
    if (bid === 'volcano') {
      for (let y = 0; y < map.h; y += 4) for (let x = 0; x < map.w; x += 4) {
        if (map.tiles[y * map.w + x] === T.WATER) this.effects.addEmitter({ kind: 'ember', x: x * TILE, y: -0.3, z: y * TILE, r: 6, rate: 2 });
      }
    } else if (bid === 'ice') {
      this.snow = this.effects.addEmitter({ kind: 'snow', x: cx, y: 14, z: cz, r: 70, rate: 40 });
    } else if (bid === 'swamp') {
      for (let i = 0; i < 10; i++) this.effects.addEmitter({ kind: 'mist', x: Math.random() * map.w * TILE, y: 0.6, z: Math.random() * map.h * TILE, r: 20, rate: 0.6 });
    }
    // Gebäude
    for (const b of world.buildings) this.syncBuilding(b, true);

    // Nachbearbeitung
    this.setupComposer();
    this.resize();
    const fort = world.buildings.find((b) => b.type === 'fort' && b.team === 1);
    if (fort) this.lookAt(fort.cx, fort.cy + 4, true);
  }

  setupComposer() {
    const size = this.r.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.quality > 0 ? 4 : 2 });
    this.composer = new EffectComposer(this.r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.45, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  dispose() {
    if (!this.scene) return;
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.();
    });
    this.composer?.dispose?.();
    this.scene = null;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.menuView) this.setMenuView(true);
    if (this.composer) {
      this.composer.setSize(w, h);
      this.composer.setPixelRatio(this.r.getPixelRatio());
    }
    if (this.effects) this.effects.setScale(h * this.r.getPixelRatio() * 0.9);
  }

  // ---------- Kamera ----------
  lookAt(tx, ty, instant = false) {
    this.cam.tx = tx * TILE; this.cam.tz = ty * TILE;
    if (instant) { this.cam.x = this.cam.tx; this.cam.z = this.cam.tz; }
  }

  // Menüansicht: flachere Kamera, Bildmitte nach rechts verschoben (Platz für das Menü)
  setMenuView(on) {
    this.menuView = on;
    const w = window.innerWidth, h = window.innerHeight;
    if (on && w > 900) this.camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  pan(dx, dz) {
    const c = Math.cos(this.cam.yaw), s = Math.sin(this.cam.yaw);
    const k = this.cam.dist / 40;
    this.cam.tx += (dx * c - dz * s) * k;
    this.cam.tz += (dx * s + dz * c) * k;
  }

  zoom(f) {
    this.cam.tdist = Math.max(this.follow ? 6 : 12, Math.min(85, this.cam.tdist * f));
  }

  updateCamera(dt) {
    const c = this.cam;
    const map = this.world.map;
    // Action-Kamera: folgt einer Einheit von schräg hinten
    const fu = this.follow ? this.world.byId.get(this.follow) : null;
    if (this.follow && (!fu || fu.dead)) this.follow = null;
    if (fu) {
      c.tx = fu.x * TILE; c.tz = fu.y * TILE;
      const wantYaw = Math.atan2(Math.cos(fu.angle), -Math.sin(fu.angle));
      let d = wantYaw - c.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      c.yaw += d * Math.min(1, dt * 2.5);
      c.tdist = 11;
    }
    const m = Math.min(10, c.dist * 0.25);
    c.tx = Math.max(m, Math.min(map.w * TILE - m, c.tx));
    c.tz = Math.max(m * 1.6, Math.min(map.h * TILE - m * 0.5, c.tz));
    const k = 1 - Math.pow(0.0005, dt);
    c.x += (c.tx - c.x) * k;
    c.z += (c.tz - c.z) * k;
    c.dist += (c.tdist - c.dist) * k;
    const pitch = this.menuView ? 0.5 : this.follow ? 0.42 : 0.78 + (c.dist - 16) / 69 * 0.32;
    const gy = this.terrain.unitHeight(c.x / TILE, c.z / TILE);
    const sh = this.effects.shake * 0.35;
    const ox = Math.sin(c.yaw) * Math.cos(pitch) * c.dist;
    const oz = Math.cos(c.yaw) * Math.cos(pitch) * c.dist;
    this.camera.position.set(c.x - ox + (Math.random() - 0.5) * sh, gy + Math.sin(pitch) * c.dist, c.z + oz + (Math.random() - 0.5) * sh);
    this.camera.lookAt(c.x, gy, c.z);
    // Sonne folgt der Kamera
    const span = Math.max(40, c.dist * 1.1);
    this.sun.shadow.camera.left = -span; this.sun.shadow.camera.right = span;
    this.sun.shadow.camera.top = span; this.sun.shadow.camera.bottom = -span;
    this.sun.shadow.camera.updateProjectionMatrix();
    // Texelraster stabilisieren
    const step = (span * 2) / this.sun.shadow.mapSize.x;
    const sx = Math.round(c.x / step) * step, sz = Math.round(c.z / step) * step;
    this.sun.position.set(sx + this.sunOffset.x, this.sunOffset.y, sz + this.sunOffset.z);
    this.sun.target.position.set(sx, 0, sz);
    if (this.snow) { this.snow.x = c.x; this.snow.z = c.z; }
  }

  // Bildschirm -> Feldkoordinaten
  screenToTile(sx, sy) {
    const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    let h = 0;
    let p = null;
    for (let i = 0; i < 3; i++) {
      const t = (h - o.y) / d.y;
      p = o.clone().addScaledVector(d, t);
      h = this.terrain.unitHeight(p.x / TILE, p.z / TILE);
    }
    return [p.x / TILE, p.z / TILE];
  }

  tileToScreen(x, y, hOff = 0) {
    const v = new THREE.Vector3(x * TILE, this.terrain.unitHeight(x, y) + hOff, y * TILE);
    v.project(this.camera);
    return [(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight, v.z];
  }

  // ---------- Gebiete ----------
  updateTerritory() {
    const map = this.world.map;
    const { w, h } = map;
    for (let i = 0; i < w * h; i++) {
      const s = this.world.sectors[map.sector[i]];
      const c = TEAM_COLORS[s.owner];
      this.terData[i * 4] = c.r * 255; this.terData[i * 4 + 1] = c.g * 255; this.terData[i * 4 + 2] = c.b * 255;
      this.terData[i * 4 + 3] = s.owner ? 255 : 60;
    }
    this.terTex.needsUpdate = true;
    // Grenzlinien
    for (const c of this.borderGroup.children) c.geometry.dispose();
    this.borderGroup.clear();
    const pos = [], col = [];
    const tc = new THREE.Color();
    const push = (x0, z0, x1, z1, nx, nz, owner) => {
      // gestrichelt: jedes zweite Teilstück auslassen
      const mx = Math.floor((x0 + x1) / 2 / TILE), mz = Math.floor((z0 + z1) / 2 / TILE);
      if ((mx + mz) % 2) return;
      // schmales Band auf dem Boden, um 0.12 nach innen versetzt
      const off = 0.16, wd = 0.14;
      const ax = x0 + nx * off, az = z0 + nz * off, bx = x1 + nx * off, bz = z1 + nz * off;
      const cx = ax + nx * wd, cz = az + nz * wd, dx = bx + nx * wd, dz = bz + nz * wd;
      const hy = (x, z) => Math.max(this.terrain.heightAt(x, z), -0.4) + 0.08;
      const pts = [[ax, az], [bx, bz], [dx, dz], [ax, az], [dx, dz], [cx, cz]];
      tc.copy(TEAM_COLORS[owner]).multiplyScalar(owner ? 2.2 : 0.9);
      for (const [x, z] of pts) { pos.push(x, hy(x, z), z); col.push(tc.r, tc.g, tc.b); }
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = map.sector[y * w + x];
      const oa = this.world.sectors[a].owner;
      if (x + 1 < w) {
        const b = map.sector[y * w + x + 1];
        if (a !== b) {
          const ob = this.world.sectors[b].owner;
          const X = (x + 1) * TILE, Z0 = y * TILE, Z1 = (y + 1) * TILE;
          push(X, Z0, X, Z1, -1, 0, oa);
          push(X, Z0, X, Z1, 1, 0, ob);
        }
      }
      if (y + 1 < h) {
        const b = map.sector[(y + 1) * w + x];
        if (a !== b) {
          const ob = this.world.sectors[b].owner;
          const Z = (y + 1) * TILE, X0 = x * TILE, X1 = (x + 1) * TILE;
          push(X0, Z, X1, Z, 0, -1, oa);
          push(X0, Z, X1, Z, 0, 1, ob);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 1;
    this.borderGroup.add(mesh);
    // Flaggenfarben
    for (const f of this.flags) {
      const c = TEAM_COLORS[f.sector.owner];
      const ud = f.obj.userData;
      ud.cloth.material.color.copy(c);
      ud.cloth.material.emissive.copy(c).multiplyScalar(f.sector.owner ? 0.5 : 0.1);
      ud.ring.material.color.copy(c).multiplyScalar(f.sector.owner ? 2.5 : 1);
    }
  }

  updateFow(dt) {
    const vis = this.world.vis[1], exp = this.world.explored[1];
    const n = vis.length;
    const k = Math.min(1, dt * 6);
    for (let i = 0; i < n; i++) {
      const target = vis[i] ? 0 : exp[i] ? 140 : 238;
      this.fowCur[i] += (target - this.fowCur[i]) * k;
      this.fowData[i] = this.fowCur[i];
    }
    this.fowTex.needsUpdate = true;
  }

  // ---------- Objekte ----------
  syncBuilding(b, initial = false) {
    let e = this.entities.get(b.id);
    const ruined = b.destroyed;
    const key = (ruined ? 'ruin' : b.team) + '';
    if (e && e.key === key) return e;
    if (e) { this.scene.remove(e.obj); }
    const obj = ruined ? makeRuin(b.type, b.w, b.h) : makeBuilding(b.type, b.team);
    const wx = b.cx * TILE, wz = b.cy * TILE;
    let gh = 0;
    for (const [ox, oz] of [[0, 0], [-0.8, -0.8], [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8]]) gh += this.terrain.heightAt(wx + ox * b.w, wz + oz * b.h);
    obj.position.set(wx, gh / 5 - 0.05, wz);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(obj);
    const old = e;
    e = { obj, key, b, turretAngle: old ? old.turretAngle : b.turret, emitters: [] };
    if (old) for (const em of old.emitters) em.life = 0.001;
    if (!ruined) {
      for (const c of obj.userData.chimneys || []) {
        const p = new THREE.Vector3(c[0], c[1], c[2]).add(obj.position);
        e.emitters.push(this.effects.addEmitter({ kind: 'chimney', x: p.x, y: p.y, z: p.z, rate: 3 }));
      }
    } else {
      e.emitters.push(this.effects.addEmitter({ kind: 'fire', x: wx, y: obj.position.y + 0.6, z: wz, r: b.w * 1.2, rate: 14, life: 40 }));
      if (!initial) this.effects.bigExplosion(wx, obj.position.y + 1, wz, Math.max(b.w, b.h) * 0.9);
    }
    this.entities.set(b.id, e);
    return e;
  }

  createUnit(u) {
    const obj = u.cls === 'prop' ? makeBarrel() : u.cls === 'robot' ? makeRobot(u.type, u.team) : makeVehicle(u.type, u.team);
    this.scene.add(obj);
    const e = { obj, u, team: u.team, angle: u.angle, turret: u.turret, born: performance.now(), fire: 0, smokeT: 0 };
    this.entities.set(u.id, e);
    return e;
  }

  addWreck(ev) {
    const obj = makeVehicle(ev.type, 0);
    wreckify(obj);
    const wx = ev.x * TILE, wz = ev.y * TILE;
    obj.position.set(wx, this.terrain.unitHeight(ev.x, ev.y), wz);
    obj.rotation.y = -ev.angle;
    const tu = obj.userData.turret;
    if (tu) { tu.rotation.y = (Math.random() - 0.5) * 2; tu.rotation.z = (Math.random() - 0.5) * 0.3; tu.position.y += 0.12; }
    obj.traverse((c) => { if (c.name === 'Driver' || c.name === 'Gunner') c.visible = false; });
    obj.rotation.z = (Math.random() - 0.5) * 0.08;
    this.scene.add(obj);
    const em = this.effects.addEmitter({ kind: 'fire', x: wx, y: obj.position.y + 0.8, z: wz, r: 0.8, rate: 10, life: 14 });
    this.effects.addEmitter({ kind: 'smoke', x: wx, y: obj.position.y + 1, z: wz, rate: 1.2, life: 60 });
    // Wracks bleiben als Kampfspuren liegen (älteste verschwinden bei sehr vielen)
    this.wrecks.push({ obj, life: 0, max: Infinity, em, ux: ev.x, uy: ev.y });
    if (this.wrecks.length > 40) { const old = this.wrecks.shift(); this.scene.remove(old.obj); }
  }

  // ---------- Ereignisse ----------
  handleEvent(ev) {
    const w = this.world;
    const vis = (x, y) => w.isVisible(1, x, y);
    switch (ev.t) {
      case 'shot': {
        const src = this.entities.get(ev.src);
        let from;
        if (src && src.obj) {
          from = this.muzzlePos(src, ev);
        } else {
          from = new THREE.Vector3(ev.x * TILE, this.terrain.unitHeight(ev.x, ev.y) + 1, ev.y * TILE);
        }
        if (vis(ev.x, ev.y) || vis(ev.tx, ev.ty)) {
          this.effects.addProjectile(ev.proj, from);
          const dx = Math.cos(ev.angle), dz = Math.sin(ev.angle);
          this.effects.muzzle(from.x, from.y, from.z, dx, dz, ev.proj.kind, ev.team);
        }
        break;
      }
      case 'impact':
        if (vis(ev.x, ev.y)) {
          if (ev.kind === 'flame') {
            const wx = ev.x * TILE, wz = ev.y * TILE;
            this.effects.addEmitter({ kind: 'fire', x: wx, y: this.terrain.unitHeight(ev.x, ev.y) + 0.1, z: wz, r: 1.2, rate: 8, life: 4 });
            this.effects.addScorch(wx, wz, 1.4);
          } else this.effects.impact(ev);
        }
        break;
      case 'death': {
        const e = this.entities.get(ev.id);
        if (e) { this.scene.remove(e.obj); this.entities.delete(ev.id); }
        const wx = ev.x * TILE, wz = ev.y * TILE, wy = this.terrain.unitHeight(ev.x, ev.y);
        if (!vis(ev.x, ev.y)) break;
        if (ev.cls === 'vehicle') {
          this.effects.explosion(wx, wy + 0.5, wz, 1.6, 1.4);
          for (let i = 0; i < 6; i++) this.effects.spawnDebris(wx, wy + 0.8, wz, 0.8);
          this.addWreck(ev);
        } else {
          this.effects.explosion(wx, wy + 0.4, wz, 0.55, 0.6);
          for (let i = 0; i < 3; i++) this.effects.spawnDebris(wx, wy + 0.8, wz, 0.4);
        }
        break;
      }
      case 'bdestroy': {
        const b = w.byId.get(ev.id);
        if (b) this.syncBuilding(b);
        break;
      }
      case 'capture':
        this.updateTerritory();
        for (const id of w.sectors[ev.sector].buildings) {
          const b = w.byId.get(id);
          if (b) this.syncBuilding(b);
        }
        {
          const s = w.sectors[ev.sector];
          const wx = s.x * TILE, wz = s.y * TILE;
          const c = ev.team === 1 ? [1.0, 0.45, 0.3] : [0.4, 0.75, 1.0];
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            this.effects.glow.spawn({ x: wx, y: 0.4, z: wz, vx: Math.cos(a) * 5, vy: 0.5 + Math.random(), vz: Math.sin(a) * 5, life: 0.8, s0: 0.8, s1: 0.1, c0: c, a0: 1, a1: 0, drag: 0.3 });
          }
          this.effects.light(wx, 2, wz, ev.team === 1 ? 0xff5533 : 0x4aa8ff, 40, 0.6);
        }
        break;
      case 'board': {
        if (ev.turret) { const b = w.byId.get(ev.vid); if (b) this.syncBuilding(b); break; }
        const v = this.entities.get(ev.vid);
        if (v) { this.scene.remove(v.obj); this.entities.delete(ev.vid); }
        break;
      }
      case 'driverKilled': {
        if (ev.turret) { const b = w.byId.get(ev.id); if (b) this.syncBuilding(b); }
        if (!vis(ev.x, ev.y)) break;
        const wx = ev.x * TILE, wz = ev.y * TILE, wy = this.terrain.unitHeight(ev.x, ev.y) + 1.4;
        for (let i = 0; i < 14; i++) this.effects.glow.spawn({ x: wx, y: wy, z: wz, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, life: 0.5, s0: 0.35, s1: 0.05, c0: [0.6, 0.85, 1.0], a0: 1, a1: 0, g: 8 });
        this.effects.smoke.spawn({ x: wx, y: wy, z: wz, vy: 1, life: 1.5, s0: 0.5, s1: 1.8, c0: [0.3, 0.3, 0.3], a0: 0.6, a1: 0 });
        break;
      }
      case 'barrel': {
        const e = ev.id > 0 ? this.entities.get(ev.id) : null;
        if (e) { this.scene.remove(e.obj); this.entities.delete(ev.id); }
        if (!vis(ev.x, ev.y)) break;
        const wx = ev.x * TILE, wz = ev.y * TILE, wy = this.terrain.unitHeight(ev.x, ev.y);
        this.effects.bigExplosion(wx, wy + 0.5, wz, ev.big ? 2.6 : 1.4);
        this.effects.addEmitter({ kind: 'fire', x: wx, y: wy + 0.2, z: wz, r: 1.6, rate: 14, life: 6 });
        break;
      }
      case 'bridge': {
        this.terrain.setBridge(ev.id, !ev.destroyed);
        const wx = ev.x * TILE, wz = ev.y * TILE;
        if (ev.destroyed) {
          this.effects.bigExplosion(wx, 0.3, wz, 1.8);
          for (let i = 0; i < 20; i++) this.effects.spawnDebris(wx + (Math.random() - 0.5) * 3, 0.6, wz + (Math.random() - 0.5) * 3, 1.2);
        } else {
          for (let i = 0; i < 30; i++) this.effects.glow.spawn({ x: wx + (Math.random() - 0.5) * 4, y: 0.6, z: wz + (Math.random() - 0.5) * 4, vy: 2, life: 0.8, s0: 0.4, s1: 0.05, c0: [1, 0.8, 0.4], a0: 1, a1: 0 });
        }
        break;
      }
    }
  }

  muzzlePos(e, ev) {
    const obj = e.obj;
    const ud = obj.userData;
    obj.updateMatrixWorld(true);
    let bar = null;
    if (ud.kind === 'vehicle' && ud.muzzles?.length) {
      ud.barrelIdx = ((ud.barrelIdx || 0) + 1) % ud.muzzles.length;
      ud.barrels[ud.barrelIdx].userData.kick = e.u?.type === 'heavytank' ? 0.15 : 1;
      if (e.u?.type === 'heavytank') ud.spin = 1;
      return ud.muzzles[ud.barrelIdx].getWorldPosition(new THREE.Vector3());
    }
    if (ud.kind === 'vehicle' || ud.kind === 'building') {
      if (ud.barrels && ud.barrels.length) {
        ud.barrelIdx = ((ud.barrelIdx || 0) + 1) % ud.barrels.length;
        bar = ud.barrels[ud.barrelIdx];
        bar.userData.kick = 1;
      }
    } else if (ud.kind === 'robot') {
      const sh = ud.actions.Shoot;
      sh.reset(); sh.setEffectiveWeight(1); sh.play();
      return ud.muzzle.getWorldPosition(new THREE.Vector3());
    }
    if (!bar) return new THREE.Vector3(ev.x * TILE, this.terrain.unitHeight(ev.x, ev.y) + 1, ev.y * TILE);
    const p = new THREE.Vector3(ud.muzzleLen || 0.6, 0, 0);
    return bar.localToWorld(p);
  }

  // ---------- Bild ----------
  frame(dt, alpha, selection, time) {
    const w = this.world;
    shared.time.value = time;
    this.updateCamera(dt);
    this.updateFow(dt);
    this.terrain.update(dt, time);
    const seen = new Set();
    for (const u of w.units) {
      if (u.dead) continue;
      seen.add(u.id);
      let e = this.entities.get(u.id);
      if (!e || e.team !== u.team) {
        if (e) this.scene.remove(e.obj);
        e = this.createUnit(u);
      }
      const visible = u.team === 1 || w.isVisible(1, u.x, u.y) || (u.team === 0 && w.explored[1][Math.floor(u.y) * w.map.w + Math.floor(u.x)]);
      e.obj.visible = visible;
      const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
      const gy = this.terrain.unitHeight(x, y);
      e.obj.position.set(x * TILE, gy, y * TILE);
      const sm = 1 - Math.pow(0.0001, dt);
      e.angle = angLerp(e.angle, u.angle, u.cls === 'robot' ? Math.min(1, sm * 2) : 1);
      e.turret = angLerp(e.turret, u.turret, Math.min(1, sm * 2));
      e.obj.rotation.y = -e.angle;
      const ud = e.obj.userData;
      // Spawn-Animation
      const age = (performance.now() - e.born) / 1000;
      if (age < 0.5) {
        const s = 0.3 + 0.7 * (age / 0.5);
        e.obj.scale.setScalar((ud.scale || 1) * s);
      } else e.obj.scale.setScalar(ud.scale || 1);
      if (!visible) continue;
      if (ud.kind === 'prop') continue;
      if (ud.kind === 'robot') {
        const moving = Math.hypot(u.x - u.px, u.y - u.py) > 0.001;
        // Leerlauf: gelegentlich umschauen, strecken, Steine treten
        ud.still = moving ? 0 : (ud.still || 0) + dt;
        if (ud.still > 9 && Math.random() < dt * 0.12 && ud.actions.Fidget && !ud.actions.Fidget.isRunning()) {
          const f = ud.actions.Fidget;
          f.setLoop(THREE.LoopOnce, 1); f.reset(); f.setEffectiveWeight(1); f.play();
          ud.still = 0;
        }
        if (moving && ud.actions.Fidget?.isRunning()) ud.actions.Fidget.stop();
        // weiche Überblendung Stand <-> Lauf, Schrittfrequenz passend zur Geschwindigkeit
        ud.walkW += ((moving ? 1 : 0) - ud.walkW) * Math.min(1, dt * 8);
        ud.actions.Walk.setEffectiveWeight(ud.walkW);
        ud.actions.Idle.setEffectiveWeight(1 - ud.walkW);
        ud.actions.Walk.timeScale = u.def.speed / 2.0;
        ud.mixer.update(dt);
      } else {
        if (ud.turret) ud.turret.rotation.y = -(e.turret - e.angle);
        for (const b of ud.barrels) {
          b.userData.kick = Math.max(0, (b.userData.kick || 0) - dt * 4);
          if (b.userData.base) b.position.copy(b.userData.base).addScaledVector(b.userData.dir, -b.userData.kick * 0.22);
        }
        // Gatling dreht sich beim Feuern und läuft langsam aus
        if (ud.spin > 0 && ud.barrels[0]?.userData.dir) {
          ud.barrels[0].rotateOnAxis(ud.barrels[0].userData.dir, dt * 22 * ud.spin);
          ud.spin = Math.max(0, ud.spin - dt * 1.2);
        }
        const moving = Math.hypot(u.x - u.px, u.y - u.py) > 0.001;
        if (moving) {
          for (const wh of ud.wheels) wh.rotation.x += dt * 9;
          if (ud.trackMat) ud.trackMat.map.offset.y -= dt * 1.5;
          ud.hull.rotation.z = Math.sin(time * 18 + u.id) * 0.008;
          // Staub
          if (Math.random() < dt * 14 && w.map.biomeId !== 'swamp') {
            const ex = e.obj.position.x - Math.cos(e.angle) * 1.1, ez = e.obj.position.z - Math.sin(e.angle) * 1.1;
            this.effects.smoke.spawn({ x: ex, y: gy + 0.2, z: ez, vx: (Math.random() - 0.5), vy: 0.4, vz: (Math.random() - 0.5), life: 1.2, s0: 0.6, s1: 2.2, c0: w.map.biomeId === 'ice' ? [0.9, 0.92, 0.95] : [0.6, 0.53, 0.42], a0: 0.3, a1: 0, drag: 0.5 });
          }
        }
        // beschädigt: Rauch
        if (u.hp < u.maxHp * 0.45) {
          e.smokeT += dt;
          if (e.smokeT > 0.12) {
            e.smokeT = 0;
            this.effects.smoke.spawn({ x: e.obj.position.x, y: gy + 1.2, z: e.obj.position.z, vx: 0.3, vy: 1.2, vz: 0.1, life: 1.6, s0: 0.5, s1: 1.8, c0: [0.1, 0.1, 0.1], a0: 0.5, a1: 0, drag: 0.7 });
            if (u.hp < u.maxHp * 0.25) this.effects.glow.spawn({ x: e.obj.position.x, y: gy + 1, z: e.obj.position.z, vy: 1, life: 0.3, s0: 0.9, s1: 0.2, c0: [1, 0.6, 0.2], a0: 1, a1: 0 });
          }
        }
      }
    }
    for (const [id, e] of this.entities) {
      if (e.u && !seen.has(id)) { this.scene.remove(e.obj); this.entities.delete(id); }
    }
    // Gebäude
    for (const b of w.buildings) {
      const e = this.syncBuilding(b);
      const ud = e.obj.userData;
      if (ud.turret) {
        e.turretAngle = angLerp(e.turretAngle, b.turret, Math.min(1, dt * 10));
        ud.turret.rotation.y = -e.turretAngle;
        for (const br of ud.barrels) {
          br.userData.kick = Math.max(0, (br.userData.kick || 0) - dt * 3);
          br.position.x = (br.userData.baseX ??= br.position.x) - br.userData.kick * 0.3;
        }
      }
      if (ud.spin) ud.spin.rotation.y += dt * 1.2;
      for (const em of e.emitters) {
        em.hidden = !w.explored[1][Math.floor(b.cy) * w.map.w + Math.floor(b.cx)];
        if (em.kind === 'chimney') em.rate = b.produce && b.team ? 4 : 0.5;
      }
    }
    // Flaggen
    for (const f of this.flags) {
      const ud = f.obj.userData;
      const pos = ud.cloth.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = ud.base[i * 3], by = ud.base[i * 3 + 1];
        const wv = Math.sin(time * 4 + bx * 4 + f.phase) * 0.12 * bx + Math.sin(time * 7 + bx * 7) * 0.03 * bx;
        pos.setXYZ(i, bx, by - bx * 0.06, wv);
      }
      pos.needsUpdate = true;
      ud.cloth.geometry.computeVertexNormals();
      ud.ring.rotation.z = time * 0.5;
      const s = f.sector;
      if (s.capT > 0 && s.capTeam) {
        ud.cap.visible = true;
        const frac = Math.min(1, s.capT / w.captureTime(s));
        ud.cap.geometry.dispose();
        ud.cap.geometry = new THREE.RingGeometry(1.15, 1.45, 48, 1, 0, Math.max(0.01, frac * Math.PI * 2));
        ud.cap.material.color.copy(TEAM_COLORS[s.capTeam]).multiplyScalar(2.5);
      } else ud.cap.visible = false;
    }
    // Wracks
    this.wrecks = this.wrecks.filter((wr) => {
      wr.life += dt;
      if (wr.life > wr.max - 4) wr.obj.position.y -= dt * 0.4; // (unbegrenzt: bleibt liegen)
      wr.obj.visible = w.explored[1][Math.floor(wr.uy) * w.map.w + Math.floor(wr.ux)] === 1;
      if (wr.life > wr.max) { this.scene.remove(wr.obj); return false; }
      return true;
    });
    // Auswahlringe
    this.updateRings(selection, time, dt);
    this.effects.update(dt, time, alpha);
    this.composer.render(dt);
  }

  updateRings(selection, time, dt) {
    let i = 0;
    const take = () => {
      if (!this.rings[i]) {
        const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
        m.renderOrder = 4;
        this.scene.add(m);
        this.rings[i] = m;
      }
      return this.rings[i++];
    };
    for (const id of selection) {
      const o = this.world.byId.get(id);
      if (!o || o.dead) continue;
      const r = take();
      r.visible = true;
      if (o.kind === 'unit') {
        const e = this.entities.get(id);
        if (!e) { r.visible = false; continue; }
        r.position.set(e.obj.position.x, e.obj.position.y + 0.08, e.obj.position.z);
        const s = o.cls === 'robot' ? 0.8 : o.radius * 2.6;
        r.scale.setScalar(s);
      } else {
        const e = this.entities.get(id);
        r.position.set(o.cx * TILE, e.obj.position.y + 0.35, o.cy * TILE);
        r.scale.setScalar(Math.max(o.w, o.h) * 1.6);
      }
      const team = o.team;
      r.material.color.setHex(team === 1 ? 0x66ffa0 : team === 2 ? 0x4aa0ff : 0xc8c8c8);
      r.material.opacity = 0.7 + Math.sin(time * 6) * 0.2;
    }
    for (; i < this.rings.length; i++) this.rings[i].visible = false;
    // Befehlsmarker
    this.markers = this.markers.filter((m) => {
      m.life += dt;
      const k = m.life / 0.6;
      m.mesh.scale.setScalar(1.6 * (1 - k) + 0.3);
      m.mesh.material.opacity = 1 - k;
      if (k >= 1) { this.scene.remove(m.mesh); m.mesh.material.dispose(); return false; }
      return true;
    });
  }

  marker(x, y, color = 0x66ffa0) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false }));
    m.position.set(x * TILE, this.terrain.unitHeight(x, y) + 0.1, y * TILE);
    m.renderOrder = 4;
    this.scene.add(m);
    this.markers.push({ mesh: m, life: 0 });
  }
}
