// Gelände, Wasser/Lava, Bäume, Felsen, Brücken

import * as THREE from 'three';
import { T } from '../sim/defs.js';
import { fbm, mulberry32 } from '../sim/rng.js';
import { TILE, patchFow, groundDetailTex, heightToNormalTex, mat, canvasTex } from './materials.js';
import { mergeChildren } from './models.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const R = 2; // Vertices pro Feld

function jitter(geo, amt, sy = 1, seed = 1) {
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(Math.round(x * 100) * 12.9898 + Math.round(y * 100) * 78.233 + Math.round(z * 100) * 37.719 + seed) * 43758.5453;
    const f = 1 + ((h - Math.floor(h)) - 0.5) * amt;
    p.setXYZ(i, x * f, y * f * sy, z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Terrain {
  constructor(scene, map, quality) {
    this.map = map;
    this.scene = scene;
    this.quality = quality;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildHeights();
    this.buildMesh();
    this.buildWater();
    this.buildDecor();
    this.buildBridges();
  }

  buildHeights() {
    const { w, h, tiles, seed } = this.map;
    const th = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = tiles[y * w + x];
      const n = fbm(x * 0.15, y * 0.15, seed + 200, 3);
      let v;
      switch (t) {
        case T.ROCK: v = 2.2 + fbm(x * 0.35, y * 0.35, seed + 300, 3) * 3.2; break;
        case T.WATER: case T.BRIDGE: v = -1.6; break;
        case T.ROAD: v = n * 0.12; break;
        default: v = n * 0.55;
      }
      th[y * w + x] = v;
    }
    this.tileH = th;
    const vw = w * R + 1, vh = h * R + 1;
    const vhgt = new Float32Array(vw * vh);
    const tileAt = (x, y) => {
      x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
      return th[y * w + x];
    };
    for (let j = 0; j < vh; j++) for (let i = 0; i < vw; i++) {
      let v;
      if (i % 2 === 1 && j % 2 === 1) {
        v = tileAt((i - 1) / 2, (j - 1) / 2);
      } else if (i % 2 === 0 && j % 2 === 0) {
        const tx = i / 2, ty = j / 2;
        v = (tileAt(tx - 1, ty - 1) + tileAt(tx, ty - 1) + tileAt(tx - 1, ty) + tileAt(tx, ty)) / 4;
      } else if (i % 2 === 0) {
        const tx = i / 2, ty = (j - 1) / 2;
        v = (tileAt(tx - 1, ty) + tileAt(tx, ty)) / 2;
      } else {
        const tx = (i - 1) / 2, ty = j / 2;
        v = (tileAt(tx, ty - 1) + tileAt(tx, ty)) / 2;
      }
      // feine Unebenheit
      v += (fbm(i * 0.5, j * 0.5, seed + 400, 2) - 0.5) * 0.18;
      vhgt[j * vw + i] = v;
    }
    // Wasserufer glätten: Ufer flach abfallen lassen
    this.vw = vw; this.vh = vh; this.vhgt = vhgt;
  }

  heightAt(wx, wz) {
    const fx = (wx / TILE) * R, fz = (wz / TILE) * R;
    const i = Math.max(0, Math.min(this.vw - 2, Math.floor(fx)));
    const j = Math.max(0, Math.min(this.vh - 2, Math.floor(fz)));
    const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fz - j));
    const a = this.vhgt[j * this.vw + i], b = this.vhgt[j * this.vw + i + 1];
    const c = this.vhgt[(j + 1) * this.vw + i], d = this.vhgt[(j + 1) * this.vw + i + 1];
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  // Höhe, auf der Einheiten stehen (Brücken berücksichtigt)
  unitHeight(tx, ty) {
    const { w, h, tiles } = this.map;
    const xi = Math.floor(tx), yi = Math.floor(ty);
    if (xi >= 0 && yi >= 0 && xi < w && yi < h && tiles[yi * w + xi] === T.BRIDGE) return 0.32;
    return Math.max(this.heightAt(tx * TILE, ty * TILE), -0.3);
  }

  buildMesh() {
    const { w, h, tiles, biome, seed } = this.map;
    const vw = this.vw, vh = this.vh;
    const pos = new Float32Array(vw * vh * 3);
    const col = new Float32Array(vw * vh * 3);
    const uv = new Float32Array(vw * vh * 2);
    const c = new THREE.Color();
    const g0 = new THREE.Color(biome.ground[0]), g1 = new THREE.Color(biome.ground[1]), g2 = new THREE.Color(biome.ground[2]);
    const rockC = new THREE.Color(biome.rock), roadC = new THREE.Color(biome.road), forestC = new THREE.Color(biome.forest);
    const bedC = new THREE.Color(biome.lava ? 0x1a0a06 : 0x3a3428);
    const tileType = (x, y) => {
      x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y));
      return tiles[y * w + x];
    };
    const tmp = new THREE.Color();
    for (let j = 0; j < vh; j++) for (let i = 0; i < vw; i++) {
      const k = j * vw + i;
      const wx = (i / R) * TILE, wz = (j / R) * TILE;
      const hgt = this.vhgt[k];
      pos[k * 3] = wx; pos[k * 3 + 1] = hgt; pos[k * 3 + 2] = wz;
      uv[k * 2] = wx / 6; uv[k * 2 + 1] = wz / 6;
      // Farbe: Mischung der angrenzenden Felder
      const txs = i % 2 ? [(i - 1) / 2] : [i / 2 - 1, i / 2];
      const tys = j % 2 ? [(j - 1) / 2] : [j / 2 - 1, j / 2];
      let r = 0, g = 0, b = 0, n = 0;
      for (const ty of tys) for (const tx of txs) {
        const t = tileType(tx, ty);
        const nz = fbm(tx * 0.2 + i * 0.05, ty * 0.2 + j * 0.05, seed + 500, 3);
        if (nz < 0.45) tmp.copy(g0).lerp(g1, nz / 0.45); else tmp.copy(g0).lerp(g2, (nz - 0.45) / 0.55);
        switch (t) {
          case T.ROCK: tmp.copy(rockC).multiplyScalar(0.8 + fbm(i * 0.3, j * 0.3, seed + 7, 2) * 0.5); break;
          case T.WATER: case T.BRIDGE: tmp.copy(bedC); break;
          case T.ROAD: tmp.lerp(roadC, 0.75); break;
          case T.FOREST: tmp.lerp(forestC, 0.55); break;
        }
        r += tmp.r; g += tmp.g; b += tmp.b; n++;
      }
      c.setRGB(r / n, g / n, b / n);
      // Höhenabhängige Aufhellung der Felsspitzen / Schnee
      if (hgt > 2.5) {
        const top = this.map.biomeId === 'ice' ? new THREE.Color(0xf4f8ff) : this.map.biomeId === 'volcano' ? new THREE.Color(0x3a2a24) : rockC.clone().multiplyScalar(1.3);
        c.lerp(top, Math.min(1, (hgt - 2.5) / 3) * 0.7);
      }
      // nasse Ufer
      if (hgt < -0.2 && hgt > -1.4) c.multiplyScalar(0.75);
      const v = 0.92 + Math.random() * 0.12;
      col[k * 3] = c.r * v; col[k * 3 + 1] = c.g * v; col[k * 3 + 2] = c.b * v;
    }
    const idx = [];
    for (let j = 0; j < vh - 1; j++) for (let i = 0; i < vw - 1; i++) {
      const a = j * vw + i, b = a + 1, cc = a + vw, d = cc + 1;
      if ((i + j) % 2) { idx.push(a, cc, b, b, cc, d); } else { idx.push(a, cc, d, a, d, b); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // steile Hänge abdunkeln/felsig färben
    const nrm = geo.attributes.normal.array;
    for (let k = 0; k < vw * vh; k++) {
      const ny = nrm[k * 3 + 1];
      if (ny < 0.75) {
        const f = Math.min(1, (0.75 - ny) * 2.5);
        tmp.setRGB(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]).lerp(rockC, f * 0.6).multiplyScalar(1 - f * 0.2);
        col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
      }
    }
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.93, metalness: 0.0,
      map: groundDetailTex(), normalMap: heightToNormalTex(256, 3), normalScale: new THREE.Vector2(0.9, 0.9),
    });
    if (this.map.biomeId === 'ice') { material.roughness = 0.6; }
    patchFow(material, { territory: true });
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.castShadow = this.quality > 0;
    mesh.name = 'terrain';
    this.mesh = mesh;
    this.group.add(mesh);

    // Rand außerhalb der Karte
    const skirtMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(biome.ground[1]).multiplyScalar(0.28), roughness: 1 });
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), skirtMat);
    skirt.rotation.x = -Math.PI / 2;
    skirt.position.set(w * TILE / 2, -2.2, h * TILE / 2);
    this.group.add(skirt);
  }

  buildWater() {
    const { w, h, biome } = this.map;
    const has = this.map.tiles.some((t) => t === T.WATER || t === T.BRIDGE);
    if (!has) return;
    const geo = new THREE.PlaneGeometry(w * TILE, h * TILE, 1, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(w * TILE / 2, -0.45, h * TILE / 2);
    let material;
    const nTex = heightToNormalTex(256, 4);
    nTex.repeat.set(w / 3, h / 3);
    if (biome.lava) {
      const lavaTex = canvasTex(256, (g, s) => {
        g.fillStyle = '#300800'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 160; i++) {
          const x = Math.random() * s, y = Math.random() * s, r = 6 + Math.random() * 26;
          const gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, `rgba(255,${120 + Math.random() * 100 | 0},20,0.8)`);
          gr.addColorStop(1, 'rgba(255,60,0,0)');
          g.fillStyle = gr;
          for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); }
        }
      }, { repeat: true });
      lavaTex.repeat.set(w / 6, h / 6);
      material = new THREE.MeshStandardMaterial({
        color: 0x200500, emissive: 0xff5a14, emissiveMap: lavaTex, emissiveIntensity: 2.4,
        roughness: 0.7, normalMap: nTex,
      });
      this.lavaTex = lavaTex;
    } else {
      material = new THREE.MeshStandardMaterial({
        color: biome.water, roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.86,
        normalMap: nTex, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4,
      });
    }
    patchFow(material);
    this.waterTex = nTex;
    const water = new THREE.Mesh(geo, material);
    water.receiveShadow = !biome.lava;
    this.water = water;
    this.group.add(water);
  }

  buildDecor() {
    const { w, h, tiles, biome, seed } = this.map;
    const rng = mulberry32(seed + 1234);
    const dummy = new THREE.Object3D();
    const q = this.quality;

    // Felsen
    const rockGeo = jitter(new THREE.IcosahedronGeometry(1, 3), 0.18, 0.7, 3);
    const rockMat = mat(biome.rock, { r: 0.8 });
    const rockSpots = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = tiles[y * w + x];
      if (t === T.ROCK) { if (rng() < 0.55) rockSpots.push([x + rng(), y + rng(), 0.6 + rng() * 0.9]); }
      else if ((t === T.GROUND) && rng() < 0.03) rockSpots.push([x + rng(), y + rng(), 0.15 + rng() * 0.25]);
    }
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockSpots.length);
    rockSpots.forEach(([x, y, s], i) => {
      const wx = x * TILE, wz = y * TILE;
      dummy.position.set(wx, this.heightAt(wx, wz) - s * 0.25, wz);
      dummy.rotation.set(rng() * 0.6, rng() * 6.28, rng() * 0.6);
      dummy.scale.set(s * (0.8 + rng() * 0.6), s * (0.6 + rng() * 0.8), s * (0.8 + rng() * 0.6));
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
      const cc = new THREE.Color(biome.rock).multiplyScalar(0.75 + rng() * 0.5);
      rocks.setColorAt(i, cc);
    });
    rocks.castShadow = true; rocks.receiveShadow = true;
    this.group.add(rocks);

    // Bäume
    const treeSpots = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = tiles[y * w + x];
      if (t === T.FOREST) {
        const k = 1 + (rng() < 0.6 ? 1 : 0);
        for (let i = 0; i < k; i++) treeSpots.push([x + 0.15 + rng() * 0.7, y + 0.15 + rng() * 0.7, 0.62 + rng() * 0.4]);
      } else if (t === T.GROUND && rng() < 0.012) treeSpots.push([x + rng(), y + rng(), 0.7 + rng() * 0.5]);
    }
    const kind = biome.tree;
    let trunkGeo, crownGeo, crown2Geo = null;
    if (kind === 'pine') {
      trunkGeo = new THREE.CylinderGeometry(0.08, 0.14, 1.0, 6).translate(0, 0.5, 0);
      crownGeo = new THREE.ConeGeometry(0.9, 1.8, 14).translate(0, 1.6, 0);
      crown2Geo = new THREE.ConeGeometry(0.65, 1.4, 14).translate(0, 2.5, 0);
    } else if (kind === 'willow') {
      trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1.4, 6).translate(0, 0.7, 0);
      crownGeo = new THREE.IcosahedronGeometry(0.95, 3).scale(1.1, 0.7, 1.1).translate(0, 1.9, 0);
      crown2Geo = new THREE.IcosahedronGeometry(0.7, 3).scale(1, 0.9, 1).translate(0.4, 1.6, 0.3);
    } else if (kind === 'dead') {
      trunkGeo = new THREE.CylinderGeometry(0.05, 0.15, 2.2, 5).translate(0, 1.1, 0);
      crownGeo = new THREE.CylinderGeometry(0.03, 0.07, 1.1, 4).rotateZ(0.9).translate(0.35, 1.5, 0);
      crown2Geo = new THREE.CylinderGeometry(0.03, 0.06, 0.9, 4).rotateZ(-1.0).translate(-0.3, 1.8, 0);
    } else {
      trunkGeo = new THREE.CylinderGeometry(0.1, 0.16, 1.1, 6).translate(0, 0.55, 0);
      crownGeo = new THREE.IcosahedronGeometry(0.95, 3).translate(0, 1.7, 0);
      crown2Geo = new THREE.IcosahedronGeometry(0.6, 3).translate(0.35, 2.2, -0.2);
    }
    if (kind === 'round' || kind === 'willow') { crownGeo = jitter(crownGeo, 0.16, 1, 7); crown2Geo = jitter(crown2Geo, 0.16, 1, 9); }
    const trunkMat = mat(kind === 'dead' ? 0x221a16 : 0x4a3626, { r: 0.9 });
    const crownMat = mat(0xffffff, { r: 0.8 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, kind === 'dead' ? trunkMat : crownMat, treeSpots.length);
    const crowns2 = new THREE.InstancedMesh(crown2Geo, kind === 'dead' ? trunkMat : crownMat, treeSpots.length);
    treeSpots.forEach(([x, y, s], i) => {
      const wx = x * TILE, wz = y * TILE;
      dummy.position.set(wx, this.heightAt(wx, wz) - 0.05, wz);
      dummy.rotation.set((rng() - 0.5) * 0.12, rng() * 6.28, (rng() - 0.5) * 0.12);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      crowns.setMatrixAt(i, dummy.matrix);
      crowns2.setMatrixAt(i, dummy.matrix);
      const cc = new THREE.Color(biome.treeColor[Math.floor(rng() * biome.treeColor.length)]).multiplyScalar(0.85 + rng() * 0.3);
      crowns.setColorAt(i, cc);
      crowns2.setColorAt(i, cc.multiplyScalar(1.1));
    });
    for (const m of [trunks, crowns, crowns2]) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
    this.trees = crowns;

    // Gras-/Buschbüschel als Detail
    if (q > 0 && this.map.biomeId !== 'volcano') {
      const tuftGeo = new THREE.ConeGeometry(0.07, 0.38, 3).translate(0, 0.19, 0);
      const spots = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const t = tiles[y * w + x];
        if ((t === T.GROUND || t === T.FOREST) && !this.map.occ[y * w + x] && fbm(x * 0.2, y * 0.2, seed + 900, 2) > 0.52) {
          // Büschel aus mehreren Halmen
          for (let c = 0; c < 2; c++) {
            const cx = x + rng(), cy = y + rng();
            for (let i = 0; i < 5; i++) spots.push([cx + (rng() - 0.5) * 0.3, cy + (rng() - 0.5) * 0.3]);
          }
        }
      }
      const tuftCol = this.map.biomeId === 'ice' ? 0xb8c4c8 : biome.treeColor[1];
      const tufts = new THREE.InstancedMesh(tuftGeo, mat(0xffffff, { r: 0.9, flat: true }), spots.length);
      spots.forEach(([x, y], i) => {
        const wx = x * TILE, wz = y * TILE;
        dummy.position.set(wx, this.heightAt(wx, wz) - 0.03, wz);
        dummy.rotation.set((rng() - 0.5) * 0.7, rng() * 6.28, (rng() - 0.5) * 0.7);
        const s = 0.6 + rng() * 0.8;
        dummy.scale.set(s, s * (0.7 + rng() * 0.8), s);
        dummy.updateMatrix();
        tufts.setMatrixAt(i, dummy.matrix);
        tufts.setColorAt(i, new THREE.Color(tuftCol).lerp(new THREE.Color(biome.ground[0]), 0.35).multiplyScalar(0.75 + rng() * 0.35));
      });
      tufts.receiveShadow = true;
      this.group.add(tufts);
    }
  }

  buildBridges() {
    const { w, h, tiles } = this.map;
    const deckMat = mat(0x6a5444, { r: 0.8 });
    const railMat = mat(0x3c4046, { r: 0.5, m: 0.6 });
    const pillarMat = mat(0x5a5650, { r: 0.9 });
    const group = new THREE.Group();
    const isB = (x, y) => x >= 0 && y >= 0 && x < w && y < h && tiles[y * w + x] === T.BRIDGE;
    const walk = (x, y) => x >= 0 && y >= 0 && x < w && y < h && tiles[y * w + x] !== T.WATER && tiles[y * w + x] !== T.ROCK;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!isB(x, y)) continue;
      const horiz = (walk(x - 1, y) || isB(x - 1, y)) && (walk(x + 1, y) || isB(x + 1, y));
      const deck = new THREE.Mesh(new THREE.BoxGeometry(TILE * 1.02, 0.25, TILE * 1.02), deckMat);
      deck.position.set((x + 0.5) * TILE, 0.2, (y + 0.5) * TILE);
      deck.castShadow = true; deck.receiveShadow = true;
      group.add(deck);
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(horiz ? TILE : 0.12, 0.35, horiz ? 0.12 : TILE), railMat);
        const off = side * (TILE / 2 - 0.08);
        const needRail = horiz ? !isB(x, y + side) : !isB(x + side, y);
        if (!needRail) continue;
        rail.position.set((x + 0.5) * TILE + (horiz ? 0 : off), 0.5, (y + 0.5) * TILE + (horiz ? off : 0));
        rail.castShadow = true;
        group.add(rail);
      }
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.8, 8), pillarMat);
      pillar.position.set((x + 0.5) * TILE, -0.8, (y + 0.5) * TILE);
      group.add(pillar);
    }
    mergeChildren(group);
    this.group.add(group);
  }

  update(dt, time) {
    if (this.waterTex) {
      this.waterTex.offset.x = time * 0.015;
      this.waterTex.offset.y = time * 0.008;
    }
    if (this.lavaTex) {
      this.lavaTex.offset.x = time * 0.006;
      this.lavaTex.offset.y = Math.sin(time * 0.1) * 0.02;
      this.water.material.emissiveIntensity = 2.2 + Math.sin(time * 1.3) * 0.3;
    }
  }
}
