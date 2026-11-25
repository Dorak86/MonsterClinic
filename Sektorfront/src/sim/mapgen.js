// Erzeugt aus einer Leveldefinition die Spielkarte (deterministisch)

import { T, BUILDINGS } from './defs.js';
import { mulberry32, fbm } from './rng.js';
import { BIOMES } from './levels.js';
import { Heap } from './path.js';

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function distToPolyline(px, py, pts) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, distToSegment(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return d;
}

function quantile(values, q) {
  const s = Float32Array.from(values).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))];
}

export function generateMap(level) {
  const { w, h, seed } = level;
  const n = w * h;
  const rng = mulberry32(seed);
  const tiles = new Uint8Array(n);
  const sector = new Int16Array(n);
  const occ = new Int32Array(n);
  const biome = BIOMES[level.biome];

  // Sektoren (verzerrtes Voronoi)
  const flags = level.sectors;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let best = 0, bd = 1e9;
      const wob = (fbm(x * 0.13, y * 0.13, seed + 99, 3) - 0.5) * 7;
      const wob2 = (fbm(x * 0.13 + 50, y * 0.13 + 50, seed + 77, 3) - 0.5) * 7;
      for (let s = 0; s < flags.length; s++) {
        const d = Math.hypot(x + 0.5 + wob - flags[s].x, y + 0.5 + wob2 - flags[s].y);
        if (d < bd) { bd = d; best = s; }
      }
      sector[y * w + x] = best;
    }
  }

  // Wald und Fels nach Rauschen, Dichte exakt über Quantile
  const nf = new Float32Array(n), nr = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      nf[y * w + x] = fbm(x * 0.11, y * 0.11, seed + 5, 4);
      nr[y * w + x] = fbm(x * 0.09, y * 0.09, seed + 17, 4) + (fbm(x * 0.4, y * 0.4, seed + 3, 2) - 0.5) * 0.15;
    }
  }
  const tf = level.forest > 0 ? quantile(nf, 1 - level.forest) : 2;
  const tr = level.rocks > 0 ? quantile(nr, 1 - level.rocks) : 2;
  for (let i = 0; i < n; i++) {
    if (nr[i] > tr) tiles[i] = T.ROCK;
    else if (nf[i] > tf) tiles[i] = T.FOREST;
  }
  // Kartenrand: Fels-Saum aus Rauschen
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (e === 0 && fbm(x * 0.3, y * 0.3, seed + 8, 2) > 0.45) tiles[y * w + x] = T.ROCK;
    }
  }

  // Wälle, Flüsse, Seen
  for (const wall of level.walls || []) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wob = (fbm(x * 0.3, y * 0.3, seed + 41, 2) - 0.5) * 1.6;
      if (distToPolyline(x + 0.5, y + 0.5, wall.pts) < wall.w / 2 + wob) tiles[y * w + x] = T.ROCK;
    }
  }
  for (const r of level.rivers || []) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wob = (fbm(x * 0.25, y * 0.25, seed + 33, 2) - 0.5) * 1.2;
      if (distToPolyline(x + 0.5, y + 0.5, r.pts) < r.w / 2 + wob) tiles[y * w + x] = T.WATER;
    }
  }
  for (const [cx, cy, r] of level.lakes || []) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wob = (fbm(x * 0.2, y * 0.2, seed + 61, 3) - 0.5) * r * 0.8;
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) < r + wob) tiles[y * w + x] = T.WATER;
    }
  }

  // Gebäudeplätze
  const buildings = [];
  flags.forEach((s, si) => {
    for (const [type, dx, dy] of s.b) {
      const def = BUILDINGS[type];
      const bx = s.x + dx, by = s.y + dy;
      buildings.push({ type, x: bx, y: by, w: def.w, h: def.h, sector: si });
    }
  });

  const setGround = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    tiles[y * w + x] = T.GROUND;
  };
  // Freiflächen um Flaggen
  flags.forEach((s) => {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy <= 7) setGround(Math.floor(s.x) + dx, Math.floor(s.y) + dy);
    }
  });
  // Freiflächen zwischen Flagge und Gebäude
  for (const b of buildings) {
    const f = flags[b.sector];
    const x0 = Math.min(b.x, Math.floor(f.x)) - 1, x1 = Math.max(b.x + b.w, Math.floor(f.x) + 1);
    const y0 = Math.min(b.y, Math.floor(f.y)) - 1, y1 = Math.max(b.y + b.h, Math.floor(f.y) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setGround(x, y);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      if (x >= 0 && y >= 0 && x < w && y < h) sector[y * w + x] = b.sector;
    }
  }
  // Startpositionen freiräumen
  for (const u of level.units || []) {
    setGround(u[1], u[2]);
  }

  // Nachbarschaft der Sektoren
  const adj = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = sector[y * w + x];
    if (x + 1 < w) { const b = sector[y * w + x + 1]; if (a !== b) adj.set(Math.min(a, b) * 1000 + Math.max(a, b), [Math.min(a, b), Math.max(a, b)]); }
    if (y + 1 < h) { const b = sector[(y + 1) * w + x]; if (a !== b) adj.set(Math.min(a, b) * 1000 + Math.max(a, b), [Math.min(a, b), Math.max(a, b)]); }
  }
  const edges = [...adj.values()].map(([a, b]) => ({ a, b, d: Math.hypot(flags[a].x - flags[b].x, flags[a].y - flags[b].y) }));
  edges.sort((p, q) => p.d - q.d);
  // Kruskal
  const parent = flags.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const roadEdges = [], rest = [];
  for (const e of edges) {
    const ra = find(e.a), rb = find(e.b);
    if (ra !== rb) { parent[ra] = rb; roadEdges.push(e); } else rest.push(e);
  }
  for (let i = 0; i < (level.extraRoads || 0) && i < rest.length; i++) roadEdges.push(rest[i]);

  // Gebäude-Belegung vorläufig für Straßenplanung
  const tmpOcc = new Uint8Array(n);
  for (const b of buildings) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    if (x >= 0 && y >= 0 && x < w && y < h) tmpOcc[y * w + x] = 1;
  }

  const roadTiles = new Uint8Array(n);
  for (const e of roadEdges) {
    const path = roadPath(w, h, tiles, tmpOcc, flags[e.a], flags[e.b]);
    let px = -1, py = -1;
    for (const [x, y] of path) {
      if (px >= 0 && x !== px && y !== py) {
        // 4-Verbindung erzwingen
        const ix = y * w + px;
        if (!tmpOcc[py * w + x]) roadTiles[py * w + x] = 1; else if (!tmpOcc[ix]) roadTiles[ix] = 1;
      }
      roadTiles[y * w + x] = 1;
      px = x; py = y;
    }
  }
  for (let i = 0; i < n; i++) {
    if (!roadTiles[i]) continue;
    tiles[i] = tiles[i] === T.WATER ? T.BRIDGE : T.ROAD;
  }
  // Brücken verbreitern nicht nötig; Felsen neben Straßen abtragen für Lesbarkeit
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (tiles[y * w + x] === T.ROCK) {
      let roads = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && roadTiles[ny * w + nx]) roads++;
      }
      if (roads >= 3) tiles[y * w + x] = T.GROUND;
    }
  }

  // Vereinzelte Wasserfelder (Pfützen ohne Nachbarn) entfernen
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (tiles[i] !== T.WATER) continue;
    let wn = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && (tiles[ny * w + nx] === T.WATER || tiles[ny * w + nx] === T.BRIDGE)) wn++;
    }
    if (wn === 0) tiles[i] = T.GROUND;
  }

  const map = {
    w, h, tiles, sector, occ, biome, biomeId: level.biome, seed,
    sectors: flags.map((s, i) => ({ id: i, x: s.x + 0.5, y: s.y + 0.5, owner: s.o, buildings: [], tiles: 0 })),
    buildingSpots: buildings,
    roadEdges: roadEdges.map((e) => [e.a, e.b]),
    rng,
  };
  for (let i = 0; i < n; i++) map.sectors[sector[i]].tiles++;
  return map;
}

// Straßenverlauf mit Kosten (A* auf 4/8 Nachbarn)
function roadPath(w, h, tiles, occ, a, b) {
  const n = w * h;
  const g = new Float32Array(n).fill(1e9);
  const from = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const sx = Math.floor(a.x), sy = Math.floor(a.y), gx = Math.floor(b.x), gy = Math.floor(b.y);
  const si = sy * w + sx, gi = gy * w + gx;
  const open = new Heap();
  open.push(si, 0);
  g[si] = 0;
  const cost = (i) => {
    if (occ[i]) return 1e6;
    switch (tiles[i]) {
      case T.ROCK: return 9;
      case T.WATER: return 7;
      case T.FOREST: return 2.5;
      case T.ROAD: case T.BRIDGE: return 0.5;
      default: return 1;
    }
  };
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === gi) break;
    const cx = cur % w, cy = (cur / w) | 0;
    for (const [dx, dy, dc] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.5], [-1, 1, 1.5], [1, -1, 1.5], [-1, -1, 1.5]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + dc * cost(ni);
      if (ng < g[ni]) {
        g[ni] = ng; from[ni] = cur;
        open.push(ni, ng + Math.hypot(nx - gx, ny - gy) * 0.9);
      }
    }
  }
  const out = [];
  let c = gi;
  while (c !== -1) { out.push([c % w, (c / w) | 0]); if (c === si) break; c = from[c]; }
  return out.reverse();
}
