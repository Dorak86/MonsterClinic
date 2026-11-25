// A*-Wegfindung auf dem Feldraster, 8 Richtungen, ohne Eckenschneiden

import { T } from './defs.js';

export function passable(map, x, y, cls) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
  const i = y * map.w + x;
  if (map.occ[i]) return false;
  const t = map.tiles[i];
  if (t === T.GROUND || t === T.ROAD || t === T.BRIDGE) return true;
  if (t === T.FOREST) return cls === 'robot';
  return false;
}

export function tileCost(map, x, y, cls) {
  const t = map.tiles[y * map.w + x];
  if (t === T.FOREST) return 1.7;
  if (t === T.ROAD || t === T.BRIDGE) return cls === 'vehicle' ? 0.8 : 0.9;
  return 1;
}

export class Heap {
  constructor() { this.a = []; this.f = []; }
  push(v, f) {
    const a = this.a, fs = this.f;
    a.push(v); fs.push(f);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (fs[p] <= f) break;
      a[i] = a[p]; fs[i] = fs[p];
      i = p;
    }
    a[i] = v; fs[i] = f;
  }
  pop() {
    const a = this.a, fs = this.f;
    const top = a[0];
    const v = a.pop(), f = fs.pop();
    if (a.length) {
      let i = 0;
      const n = a.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && fs[c + 1] < fs[c]) c++;
        if (fs[c] >= f) break;
        a[i] = a[c]; fs[i] = fs[c];
        i = c;
      }
      a[i] = v; fs[i] = f;
    }
    return top;
  }
  get size() { return this.a.length; }
}

export function nearestPassable(map, x, y, cls, maxR = 12) {
  x = Math.max(0, Math.min(map.w - 1, Math.round(x)));
  y = Math.max(0, Math.min(map.h - 1, Math.round(y)));
  if (passable(map, x, y, cls)) return [x, y];
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx, ny = y + dy;
        if (passable(map, nx, ny, cls)) {
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = [nx, ny]; }
        }
      }
    }
    if (best) return best;
  }
  return null;
}

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

// Liefert Liste von Feldmittelpunkten [[x,y],...] oder null
export function findPath(map, sx, sy, gx, gy, cls, maxNodes = 9000) {
  const w = map.w, h = map.h;
  let start = nearestPassable(map, sx, sy, cls, 3);
  const goal = nearestPassable(map, gx, gy, cls, 14);
  if (!start || !goal) return null;
  const si = start[1] * w + start[0];
  const gi = goal[1] * w + goal[0];
  if (si === gi) return [[goal[0] + 0.5, goal[1] + 0.5]];
  const n = w * h;
  if (!map._g || map._g.length !== n) {
    map._g = new Float32Array(n);
    map._from = new Int32Array(n);
    map._stamp = new Uint32Array(n);
    map._closed = new Uint32Array(n);
    map._gen = 0;
  }
  const g = map._g, from = map._from, stamp = map._stamp, closed = map._closed;
  const gen = ++map._gen;
  const heap = new Heap();
  const hx = goal[0], hy = goal[1];
  const heur = (x, y) => {
    const dx = Math.abs(x - hx), dy = Math.abs(y - hy);
    return (dx + dy) + (1.4142 - 2) * Math.min(dx, dy);
  };
  g[si] = 0; stamp[si] = gen; from[si] = -1;
  heap.push(si, heur(start[0], start[1]));
  let bestI = si, bestH = heur(start[0], start[1]);
  let count = 0;
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === gi) { bestI = gi; break; }
    if (++count > maxNodes) break;
    const cx = cur % w, cy = (cur / w) | 0;
    const hc = heur(cx, cy);
    if (hc < bestH) { bestH = hc; bestI = cur; }
    for (let d = 0; d < 8; d++) {
      const dx = DIRS[d][0], dy = DIRS[d][1];
      const nx = cx + dx, ny = cy + dy;
      if (!passable(map, nx, ny, cls)) continue;
      if (dx && dy && (!passable(map, cx + dx, cy, cls) || !passable(map, cx, cy + dy, cls))) continue;
      const ni = ny * w + nx;
      if (closed[ni] === gen) continue;
      const ng = g[cur] + DIRS[d][2] * tileCost(map, nx, ny, cls);
      if (stamp[ni] !== gen || ng < g[ni]) {
        stamp[ni] = gen; g[ni] = ng; from[ni] = cur;
        heap.push(ni, ng + heur(nx, ny) * 1.02);
      }
    }
  }
  const out = [];
  let c = bestI;
  while (c !== -1 && c !== undefined) {
    out.push([(c % w) + 0.5, ((c / w) | 0) + 0.5]);
    if (c === si) break;
    c = from[c];
  }
  out.reverse();
  return smoothPath(map, out, cls);
}

export function lineWalkable(map, x0, y0, x1, y1, cls) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const steps = Math.ceil(len * 3);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t, y = y0 + dy * t;
    // Breite berücksichtigen
    for (const [ox, oy] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) {
      if (!passable(map, Math.floor(x + ox), Math.floor(y + oy), cls)) return false;
    }
  }
  return true;
}

function smoothPath(map, pts, cls) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = Math.min(pts.length - 1, i + 12);
    while (j > i + 1 && !lineWalkable(map, pts[i][0], pts[i][1], pts[j][0], pts[j][1], cls)) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}
