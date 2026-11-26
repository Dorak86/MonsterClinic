// Partikel, Geschossdarstellung, Explosionslichter, Brandflecken, Trümmer

import * as THREE from 'three';
import { softDotTex, smokeTex, scorchTex, TILE, shared } from './materials.js';

const PVERT = `
attribute float size;
attribute vec4 pcolor;
attribute float rot;
varying vec4 vColor;
varying float vRot;
uniform float scale;
void main() {
  vColor = pcolor;
  vRot = rot;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PFRAG = `
uniform sampler2D tex;
varying vec4 vColor;
varying float vRot;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vRot), co = cos(vRot);
  c = vec2(c.x * co - c.y * s, c.x * s + c.y * co) + 0.5;
  vec4 t = texture2D(tex, c);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.004) discard;
}`;

class ParticlePool {
  constructor(scene, max, tex, additive) {
    this.max = max;
    this.n = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.rot = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: PVERT, fragmentShader: PFRAG,
      uniforms: { tex: { value: tex }, scale: { value: 600 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
    // Partikelzustand
    this.p = [];
  }

  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({
      x: o.x, y: o.y, z: o.z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: 0, max: o.life || 1, s0: o.s0 ?? 1, s1: o.s1 ?? o.s0 ?? 1,
      c0: o.c0, c1: o.c1 || o.c0, a0: o.a0 ?? 1, a1: o.a1 ?? 0,
      g: o.g || 0, drag: o.drag ?? 1, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * (o.spin || 1),
    });
  }

  update(dt) {
    const keep = [];
    let i = 0;
    for (const p of this.p) {
      p.life += dt;
      if (p.life >= p.max) continue;
      const k = p.life / p.max;
      const dr = Math.pow(p.drag, dt);
      p.vx *= dr; p.vy *= dr; p.vz *= dr;
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.g > 0 && p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += p.vr * dt;
      keep.push(p);
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      const c0 = p.c0, c1 = p.c1;
      this.col[i * 4] = c0[0] + (c1[0] - c0[0]) * k;
      this.col[i * 4 + 1] = c0[1] + (c1[1] - c0[1]) * k;
      this.col[i * 4 + 2] = c0[2] + (c1[2] - c0[2]) * k;
      this.col[i * 4 + 3] = p.a0 + (p.a1 - p.a0) * k;
      this.size[i] = p.s0 + (p.s1 - p.s0) * k;
      this.rot[i] = p.rot;
      i++;
    }
    this.p = keep;
    this.geo.setDrawRange(0, i);
    for (const a of ['position', 'pcolor', 'size', 'rot']) this.geo.attributes[a].needsUpdate = true;
  }
}

const C = {
  fire: [1.0, 0.62, 0.22], fireHot: [1.0, 0.92, 0.6], ember: [1.0, 0.35, 0.08],
  smoke: [0.18, 0.17, 0.16], smokeLight: [0.55, 0.53, 0.5], dust: [0.62, 0.55, 0.42],
  spark: [1.0, 0.8, 0.45], water: [0.75, 0.85, 0.95], blue: [0.4, 0.75, 1.0], red: [1.0, 0.45, 0.3],
};

const PROJ_STYLE = {
  tracer: { len: 0.9, w: 0.06, col: new THREE.Color(4, 3.0, 1.4) },
  shell: { len: 0.6, w: 0.14, col: new THREE.Color(5, 3.2, 1.2) },
  rocket: { len: 0.5, w: 0.1, col: new THREE.Color(1.2, 1.2, 1.2) },
  missile: { len: 0.5, w: 0.1, col: new THREE.Color(1.2, 1.2, 1.2) },
  grenade: { len: 0.18, w: 0.16, col: new THREE.Color(0.25, 0.28, 0.2) },
  beam: { len: 0, w: 0, col: new THREE.Color(1, 1, 1) },
};

export class Effects {
  constructor(scene, terrain, quality) {
    this.scene = scene;
    this.terrain = terrain;
    this.quality = quality;
    const mul = quality > 0 ? 1 : 0.5;
    this.glow = new ParticlePool(scene, Math.floor(3000 * mul), softDotTex(), true);
    this.smoke = new ParticlePool(scene, Math.floor(2500 * mul), smokeTex(), false);
    // Geschosse
    const boltGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).rotateZ(Math.PI / 2);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.bolts = new THREE.InstancedMesh(boltGeo, boltMat, 400);
    this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bolts.setColorAt(0, new THREE.Color());
    this.bolts.frustumCulled = false;
    this.bolts.count = 0;
    scene.add(this.bolts);
    this.projs = new Set();
    // Strahlen (Scharfschütze)
    this.beams = [];
    // Lichter
    this.lights = [];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xffaa55, 0, 14, 1.6);
      l.userData = { life: 0, max: 1, peak: 0 };
      scene.add(l);
      this.lights.push(l);
    }
    // Brandflecken
    this.scorchMax = 140;
    const scorchMat = new THREE.MeshBasicMaterial({
      map: scorchTex(), blending: THREE.MultiplyBlending, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, premultipliedAlpha: true,
    });
    this.scorch = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), scorchMat, this.scorchMax);
    this.scorch.count = 0;
    this.scorch.renderOrder = 1;
    this.scorchI = 0;
    this.scorchData = [];
    scene.add(this.scorch);
    // Trümmer
    this.debrisMax = 300;
    this.debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 0.85, metalness: 0.3 }), this.debrisMax);
    this.debris.castShadow = true;
    this.debris.count = 0;
    this.debris.frustumCulled = false;
    this.debrisData = [];
    scene.add(this.debris);
    this.dummy = new THREE.Object3D();
    this.shake = 0;
    this.emitters = []; // dauerhafte Rauchquellen
  }

  W(x, y) { return [x * TILE, y * TILE]; }

  light(x, y, z, color, intensity, life) {
    let best = this.lights[0];
    for (const l of this.lights) if (l.userData.life >= l.userData.max) { best = l; break; } else if (l.intensity < best.intensity) best = l;
    best.position.set(x, y, z);
    best.color.setHex(color);
    best.userData = { life: 0, max: life, peak: intensity };
    best.intensity = intensity;
  }

  muzzle(wx, wy, wz, dirx, dirz, kind, team) {
    const big = kind === 'shell' || kind === 'missile' || kind === 'rocket';
    for (let i = 0; i < (big ? 6 : 2); i++) {
      const s = Math.random() * (big ? 6 : 3);
      this.glow.spawn({ x: wx, y: wy, z: wz, vx: dirx * s + (Math.random() - 0.5), vy: Math.random(), vz: dirz * s + (Math.random() - 0.5), life: 0.08 + Math.random() * 0.06, s0: big ? 2.2 : 0.9, s1: 0.2, c0: C.fireHot, c1: C.fire, a0: 1, a1: 0 });
    }
    if (big) {
      for (let i = 0; i < 4; i++) this.smoke.spawn({ x: wx, y: wy, z: wz, vx: dirx * 1.5 + (Math.random() - 0.5), vy: 0.5 + Math.random() * 0.5, vz: dirz * 1.5 + (Math.random() - 0.5), life: 1 + Math.random(), s0: 1, s1: 3, c0: C.smokeLight, a0: 0.5, a1: 0, drag: 0.4 });
      this.light(wx, wy + 0.3, wz, 0xffb060, 30, 0.12);
    } else if (this.quality > 0 && Math.random() < 0.3) {
      this.light(wx, wy + 0.3, wz, 0xffc080, 6, 0.06);
    }
  }

  addProjectile(p, from) {
    // from: Startpunkt in Weltkoordinaten (Mündung)
    if (p.kind === 'beam') {
      const tx = p.tx * TILE, tz = p.ty * TILE;
      const ty = this.terrain.unitHeight(p.tx, p.ty) + 0.9;
      const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), new THREE.Vector3(tx, ty, tz)]);
      const m = new THREE.LineBasicMaterial({ color: p.team === 1 ? 0x9fdcff : 0xffb0a0, transparent: true, opacity: 1, toneMapped: false });
      const line = new THREE.Line(geo, m);
      this.scene.add(line);
      this.beams.push({ line, life: 0, max: 0.25 });
      return;
    }
    this.projs.add({ p, from: from.clone(), t: 0, trail: 0 });
  }

  impact(e) {
    const wx = e.x * TILE, wz = e.y * TILE;
    const wy = e.water ? -0.4 : this.terrain.unitHeight(e.x, e.y) + 0.1;
    const lava = this.terrain.map.biome.lava;
    if (e.water && !lava) {
      for (let i = 0; i < 10; i++) this.smoke.spawn({ x: wx, y: wy, z: wz, vx: (Math.random() - 0.5) * 2, vy: 3 + Math.random() * 3, vz: (Math.random() - 0.5) * 2, life: 0.7, s0: 0.8, s1: 2, c0: C.water, a0: 0.7, a1: 0, g: 9 });
      return;
    }
    if (e.kind === 'tracer' || e.kind === 'beam') {
      for (let i = 0; i < 3; i++) this.glow.spawn({ x: wx, y: wy + 0.4, z: wz, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 3, vz: (Math.random() - 0.5) * 4, life: 0.2, s0: 0.35, s1: 0.05, c0: C.spark, a0: 1, a1: 0, g: 10 });
      this.smoke.spawn({ x: wx, y: wy + 0.2, z: wz, vy: 0.4, life: 0.5, s0: 0.4, s1: 1.2, c0: C.dust, a0: 0.35, a1: 0 });
      return;
    }
    const size = e.splash ? 0.6 + e.splash * 0.8 : 0.8;
    this.explosion(wx, wy, wz, size, e.kind === 'grenade' ? 0.8 : 1);
  }

  explosion(wx, wy, wz, size = 1, intensity = 1) {
    const n = Math.floor((10 + size * 14) * (this.quality > 0 ? 1 : 0.6));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 4 * size;
      this.glow.spawn({ x: wx, y: wy + 0.3, z: wz, vx: Math.cos(a) * s, vy: 1 + Math.random() * 4 * size, vz: Math.sin(a) * s, life: 0.25 + Math.random() * 0.35, s0: 1.6 * size + Math.random(), s1: 0.3, c0: C.fireHot, c1: C.ember, a0: 1, a1: 0, drag: 0.2 });
    }
    for (let i = 0; i < n * 0.6; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 7 * size;
      this.glow.spawn({ x: wx, y: wy + 0.3, z: wz, vx: Math.cos(a) * s, vy: 3 + Math.random() * 6, vz: Math.sin(a) * s, life: 0.5 + Math.random() * 0.6, s0: 0.25, s1: 0.1, c0: C.spark, c1: C.ember, a0: 1, a1: 0, g: 14, drag: 0.7 });
    }
    for (let i = 0; i < n * 0.7; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 1.6 * size;
      this.smoke.spawn({ x: wx + Math.cos(a) * 0.3, y: wy + 0.4, z: wz + Math.sin(a) * 0.3, vx: Math.cos(a) * s, vy: 0.8 + Math.random() * 1.6, vz: Math.sin(a) * s, life: 1.6 + Math.random() * 1.6, s0: 1.2 * size, s1: 4 * size, c0: C.smoke, c1: C.smokeLight, a0: 0.75, a1: 0, drag: 0.5, spin: 0.6 });
    }
    // Staubring
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.smoke.spawn({ x: wx, y: wy + 0.15, z: wz, vx: Math.cos(a) * 3.5 * size, vy: 0.2, vz: Math.sin(a) * 3.5 * size, life: 0.9, s0: 0.8, s1: 2.4 * size, c0: C.dust, a0: 0.45, a1: 0, drag: 0.15 });
    }
    this.light(wx, wy + 1.2, wz, 0xff8a3a, 60 * size * intensity, 0.35 + size * 0.1);
    this.addScorch(wx, wz, 1.4 * size + 0.6);
    this.shake = Math.min(1, this.shake + size * 0.15 * intensity);
  }

  bigExplosion(wx, wy, wz, size) {
    this.explosion(wx, wy, wz, size * 1.2, 1.5);
    for (let k = 0; k < 4; k++) {
      setTimeout(() => this.explosion(wx + (Math.random() - 0.5) * size * 2, wy, wz + (Math.random() - 0.5) * size * 2, size * 0.6), 120 + k * 160);
    }
    for (let i = 0; i < 10 + size * 4; i++) this.spawnDebris(wx, wy + 0.8, wz, size);
    this.shake = 1;
  }

  spawnDebris(wx, wy, wz, size = 1) {
    if (this.debrisData.length >= this.debrisMax) this.debrisData.shift();
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5 * size;
    this.debrisData.push({
      x: wx, y: wy, z: wz, vx: Math.cos(a) * s, vy: 4 + Math.random() * 7, vz: Math.sin(a) * s,
      rx: Math.random() * 6, ry: Math.random() * 6, vrx: (Math.random() - 0.5) * 12, vry: (Math.random() - 0.5) * 12,
      s: 0.07 + Math.random() * 0.16 * size, life: 0, max: 2.5 + Math.random() * 2.5, smoke: Math.random() < 0.3,
    });
  }

  addScorch(wx, wz, size) {
    const i = this.scorchI++ % this.scorchMax;
    this.scorchData[i] = { x: wx, z: wz, s: size, rot: Math.random() * 6.28, age: 0 };
    this.scorch.count = Math.min(this.scorchMax, Math.max(this.scorch.count, i + 1));
    this.writeScorch(i);
  }

  writeScorch(i) {
    const d = this.scorchData[i];
    const y = this.terrain.heightAt(d.x, d.z) + 0.04;
    this.dummy.position.set(d.x, Math.max(y, -0.35), d.z);
    this.dummy.rotation.set(0, d.rot, 0);
    this.dummy.scale.set(d.s, 1, d.s);
    this.dummy.updateMatrix();
    this.scorch.setMatrixAt(i, this.dummy.matrix);
    this.scorch.instanceMatrix.needsUpdate = true;
  }

  addEmitter(o) {
    // o: {x,y,z, rate, life(s), kind: 'smoke'|'fire'|'chimney'}
    o.acc = 0;
    o.age = 0;
    this.emitters.push(o);
    return o;
  }

  update(dt, time, simAlpha) {
    // Geschosse
    let n = 0;
    const d = this.dummy;
    for (const pr of this.projs) {
      const p = pr.p;
      const k = Math.min(1, (p.t + simAlpha * 0.05) / p.dur);
      if (p.done || k >= 1) { this.projs.delete(pr); continue; }
      const tx = p.tx * TILE, tz = p.ty * TILE;
      const ty = this.terrain.unitHeight(p.tx, p.ty) + (p.kind === 'grenade' || p.kind === 'missile' ? 0.2 : 0.7);
      const x = pr.from.x + (tx - pr.from.x) * k;
      const z = pr.from.z + (tz - pr.from.z) * k;
      const arcH = p.arc ? p.arc * Math.sin(k * Math.PI) * Math.min(1, p.dur) * 2 : 0;
      const y = pr.from.y + (ty - pr.from.y) * k + arcH;
      const st = PROJ_STYLE[p.kind];
      // Richtung
      const dk = 0.02;
      const k2 = Math.min(1, k + dk);
      const nx = pr.from.x + (tx - pr.from.x) * k2, nz = pr.from.z + (tz - pr.from.z) * k2;
      const ny = pr.from.y + (ty - pr.from.y) * k2 + (p.arc ? p.arc * Math.sin(k2 * Math.PI) * Math.min(1, p.dur) * 2 : 0);
      d.position.set(x, y, z);
      d.lookAt(nx, ny, nz);
      d.rotateY(-Math.PI / 2);
      d.scale.set(st.len || 0.2, st.w, st.w);
      d.updateMatrix();
      if (n < 400) {
        this.bolts.setMatrixAt(n, d.matrix);
        this.bolts.setColorAt(n, st.col);
        n++;
      }
      if (p.kind === 'rocket' || p.kind === 'missile') {
        pr.trail += dt;
        while (pr.trail > 0.016) {
          pr.trail -= 0.016;
          this.smoke.spawn({ x, y, z, vx: (Math.random() - 0.5) * 0.3, vy: 0.3, vz: (Math.random() - 0.5) * 0.3, life: 0.9 + Math.random() * 0.5, s0: 0.35, s1: 1.4, c0: C.smokeLight, a0: 0.5, a1: 0, drag: 0.6 });
          this.glow.spawn({ x, y, z, life: 0.08, s0: 0.7, s1: 0.2, c0: C.fireHot, c1: C.fire, a0: 1, a1: 0 });
        }
      } else if (p.kind === 'shell' && Math.random() < 0.5) {
        this.glow.spawn({ x, y, z, life: 0.12, s0: 0.45, s1: 0.05, c0: C.fire, a0: 0.8, a1: 0 });
      }
    }
    this.bolts.count = n;
    this.bolts.instanceMatrix.needsUpdate = true;
    if (this.bolts.instanceColor) this.bolts.instanceColor.needsUpdate = true;

    // Strahlen
    this.beams = this.beams.filter((b) => {
      b.life += dt;
      b.line.material.opacity = 1 - b.life / b.max;
      if (b.life >= b.max) { this.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); return false; }
      return true;
    });

    // Lichter
    for (const l of this.lights) {
      const u = l.userData;
      u.life += dt;
      l.intensity = u.life >= u.max ? 0 : u.peak * Math.pow(1 - u.life / u.max, 2);
    }

    // Trümmer
    let dn = 0;
    this.debrisData = this.debrisData.filter((o) => {
      o.life += dt;
      if (o.life > o.max) return false;
      if (o.y > 0.05 || o.vy > 0) {
        o.vy -= 18 * dt;
        o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
        o.rx += o.vrx * dt; o.ry += o.vry * dt;
        const gh = this.terrain.heightAt(o.x, o.z);
        if (o.y < gh + o.s * 0.5) { o.y = gh + o.s * 0.5; o.vy *= -0.35; o.vx *= 0.5; o.vz *= 0.5; o.vrx *= 0.5; o.vry *= 0.5; if (Math.abs(o.vy) < 0.8) { o.vy = 0; o.vx = 0; o.vz = 0; o.vrx = 0; o.vry = 0; } }
        if (o.smoke && Math.random() < 0.5) this.smoke.spawn({ x: o.x, y: o.y, z: o.z, vy: 0.3, life: 0.8, s0: 0.3, s1: 1, c0: C.smoke, a0: 0.5, a1: 0 });
      }
      const fade = o.life > o.max - 1 ? (o.max - o.life) : 1;
      d.position.set(o.x, o.y - (1 - fade) * 0.3, o.z);
      d.rotation.set(o.rx, o.ry, 0);
      d.scale.setScalar(o.s);
      d.updateMatrix();
      this.debris.setMatrixAt(dn++, d.matrix);
      return true;
    });
    this.debris.count = dn;
    this.debris.instanceMatrix.needsUpdate = true;

    // Dauerquellen
    this.emitters = this.emitters.filter((e) => {
      e.age += dt;
      if (e.life && e.age > e.life) return false;
      if (e.hidden) return true;
      e.acc += dt * e.rate;
      while (e.acc > 1) {
        e.acc -= 1;
        const fade = e.life ? 1 - e.age / e.life : 1;
        if (e.kind === 'fire') {
          this.glow.spawn({ x: e.x + (Math.random() - 0.5) * e.r, y: e.y, z: e.z + (Math.random() - 0.5) * e.r, vx: (Math.random() - 0.5) * 0.5, vy: 1.5 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 0.5, life: 0.4 + Math.random() * 0.4, s0: 1.4 * fade + 0.3, s1: 0.2, c0: C.fireHot, c1: C.ember, a0: 0.9, a1: 0 });
          if (Math.random() < 0.6) this.smoke.spawn({ x: e.x, y: e.y + 0.8, z: e.z, vx: 0.4 + (Math.random() - 0.5) * 0.4, vy: 1.2 + Math.random(), vz: 0.2 + (Math.random() - 0.5) * 0.4, life: 2.5 + Math.random() * 2, s0: 1, s1: 4, c0: C.smoke, a0: 0.55 * fade, a1: 0, drag: 0.8, spin: 0.4 });
        } else if (e.kind === 'chimney') {
          this.smoke.spawn({ x: e.x, y: e.y, z: e.z, vx: 0.5 + (Math.random() - 0.5) * 0.3, vy: 1 + Math.random() * 0.5, vz: 0.25 + (Math.random() - 0.5) * 0.3, life: 3 + Math.random() * 2, s0: 0.5, s1: 3, c0: C.smokeLight, c1: [0.7, 0.7, 0.7], a0: 0.35, a1: 0, drag: 0.85, spin: 0.3 });
        } else if (e.kind === 'ember') {
          this.glow.spawn({ x: e.x + (Math.random() - 0.5) * e.r, y: e.y, z: e.z + (Math.random() - 0.5) * e.r, vx: (Math.random() - 0.5), vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5), life: 1.5 + Math.random() * 2, s0: 0.25, s1: 0.05, c0: C.ember, a0: 1, a1: 0, drag: 0.9 });
        } else if (e.kind === 'mist') {
          this.smoke.spawn({ x: e.x + (Math.random() - 0.5) * e.r, y: e.y, z: e.z + (Math.random() - 0.5) * e.r, vx: 0.3, vy: 0.05, vz: 0.1, life: 6, s0: 4, s1: 8, c0: [0.8, 0.85, 0.8], a0: 0.12, a1: 0, drag: 1 });
        } else if (e.kind === 'snow') {
          this.glow.spawn({ x: e.x + (Math.random() - 0.5) * e.r, y: 14, z: e.z + (Math.random() - 0.5) * e.r, vx: 0.6, vy: -1.6, vz: 0.3, life: 8, s0: 0.18, s1: 0.18, c0: [0.8, 0.85, 0.9], a0: 0.6, a1: 0.6, drag: 1 });
        } else {
          this.smoke.spawn({ x: e.x, y: e.y, z: e.z, vx: 0.4, vy: 1 + Math.random() * 0.6, vz: 0.2, life: 2.5, s0: 0.6, s1: 2.6, c0: C.smoke, a0: 0.5, a1: 0, drag: 0.8 });
        }
      }
      return true;
    });

    this.glow.update(dt);
    this.smoke.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }

  setScale(h) {
    this.glow.mat.uniforms.scale.value = h;
    this.smoke.mat.uniforms.scale.value = h;
  }
}

export { shared };
