// Spielsimulation: Einheiten, Gebäude, Geschosse, Sektoren, Produktion, Sicht

import { T, TEAM, UNITS, BUILDINGS, WEAPONS, DAMAGE, UNIT_CAP, SIM_DT, productionFactor } from './defs.js';
import { generateMap } from './mapgen.js';
import { findPath, nearestPassable, passable } from './path.js';

const DEFAULT_PROD = { fort: 'runner', robot: 'runner', vehicle: 'lighttank' };

function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export class World {
  constructor(level, opts = {}) {
    this.level = level;
    this.map = generateMap(level);
    this.rng = this.map.rng;
    this.tick = 0;
    this.time = 0;
    this.nextId = 1;
    this.units = [];
    this.buildings = [];
    this.projectiles = [];
    this.byId = new Map();
    this.events = [];
    this.pathQueue = [];
    this.over = null;
    this.difficulty = opts.difficulty ?? 1; // 0 leicht, 1 normal, 2 schwer
    // Bautempo je Team
    const aiMul = [0.8, 1.0, 1.25][this.difficulty] * (level.aiLevel ?? 1);
    this.speedMul = { 1: 1, 2: aiMul };
    if (opts.speedMul) Object.assign(this.speedMul, opts.speedMul);
    this.sectors = this.map.sectors;
    this.stats = {
      1: { built: 0, lost: 0, kills: 0, captures: 0 },
      2: { built: 0, lost: 0, kills: 0, captures: 0 },
    };
    const n = this.map.w * this.map.h;
    this.vis = { 1: new Uint8Array(n), 2: new Uint8Array(n) };
    this.explored = { 1: new Uint8Array(n), 2: new Uint8Array(n) };
    this.attackNotice = { 1: -99, 2: -99 };

    for (const spot of this.map.buildingSpots) {
      const sec = this.sectors[spot.sector];
      this.addBuilding(spot.type, spot.x, spot.y, sec.owner, spot.sector);
    }
    for (const [type, x, y, team] of level.units || []) {
      const cls = UNITS[type].cls;
      const p = nearestPassable(this.map, x, y, cls, 6) || [x, y];
      this.addUnit(type, p[0] + 0.5, p[1] + 0.5, team);
    }
    this.updateVisibility();
  }

  // ---------- Erzeugung ----------
  addUnit(type, x, y, team) {
    const def = UNITS[type];
    const u = {
      id: this.nextId++, kind: 'unit', type, def, cls: def.cls, team,
      x, y, px: x, py: y, angle: team === TEAM.ENEMY ? Math.PI : 0, turret: team === TEAM.ENEMY ? Math.PI : 0,
      hp: def.hp, maxHp: def.hp, radius: def.radius,
      path: null, pi: 0, order: { kind: 'idle' }, target: null, cd: Math.random() * 0.5, salvo: 0, salvoT: 0,
      gx: x, gy: y, stuckT: 0, sx: x, sy: y, repaths: 0, moving: false, scanT: Math.random() * 0.3,
      walk: 0, recoil: 0, driver: def.cls === 'vehicle' ? 'runner' : null, born: this.time,
      needPath: false, dest: null, hitT: -9,
    };
    this.units.push(u);
    this.byId.set(u.id, u);
    return u;
  }

  addBuilding(type, x, y, team, sector) {
    const def = BUILDINGS[type];
    const b = {
      id: this.nextId++, kind: 'building', type, def, team, x, y, w: def.w, h: def.h,
      cx: x + def.w / 2, cy: y + def.h / 2, hp: def.hp, maxHp: def.hp, sector,
      produce: def.produces && team ? DEFAULT_PROD[type] : null, progress: 0, rally: null,
      cd: 0, turret: team === TEAM.ENEMY ? Math.PI : 0, destroyed: false, salvo: 0, hitT: -9,
    };
    for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) {
      if (xx >= 0 && yy >= 0 && xx < this.map.w && yy < this.map.h) this.map.occ[yy * this.map.w + xx] = b.id;
    }
    this.buildings.push(b);
    this.byId.set(b.id, b);
    this.sectors[sector].buildings.push(b.id);
    return b;
  }

  emit(e) { this.events.push(e); }

  // ---------- Befehle ----------
  ownUnits(ids, team) {
    const out = [];
    for (const id of ids) {
      const u = this.byId.get(id);
      if (u && u.kind === 'unit' && !u.dead && u.team === team) out.push(u);
    }
    return out;
  }

  commandMove(ids, x, y, team, attackMove = false) {
    const us = this.ownUnits(ids, team);
    if (!us.length) return;
    const slots = this.formationSlots(us, x, y);
    us.forEach((u, i) => {
      const s = slots[i];
      u.order = { kind: attackMove ? 'amove' : 'move', x: s[0], y: s[1] };
      u.target = null;
      this.requestPath(u, s[0], s[1]);
    });
  }

  commandAttack(ids, targetId, team) {
    const t = this.byId.get(targetId);
    if (!t || t.dead || t.destroyed) return;
    for (const u of this.ownUnits(ids, team)) {
      u.order = { kind: 'attack', id: targetId };
      u.target = targetId;
      const tx = t.kind === 'building' ? t.cx : t.x, ty = t.kind === 'building' ? t.cy : t.y;
      this.requestPath(u, tx, ty);
    }
  }

  commandBoard(ids, vehicleId, team) {
    const v = this.byId.get(vehicleId);
    if (!v || v.dead || v.team !== TEAM.NEUTRAL || v.kind !== 'unit') return;
    // nur ein Roboter steigt ein: der nächstgelegene
    const robots = this.ownUnits(ids, team).filter((u) => u.cls === 'robot');
    if (!robots.length) return;
    robots.sort((a, b) => Math.hypot(a.x - v.x, a.y - v.y) - Math.hypot(b.x - v.x, b.y - v.y));
    const r = robots[0];
    r.order = { kind: 'board', id: vehicleId };
    r.target = null;
    this.requestPath(r, v.x, v.y);
    if (robots.length > 1) this.commandMove(robots.slice(1).map((u) => u.id), v.x, v.y + 1.5, team);
  }

  commandStop(ids, team) {
    for (const u of this.ownUnits(ids, team)) {
      u.order = { kind: 'idle' };
      u.path = null; u.target = null; u.needPath = false;
      u.gx = u.x; u.gy = u.y;
    }
  }

  setProduction(bid, type, team) {
    const b = this.byId.get(bid);
    if (!b || b.team !== team || b.destroyed || !b.def.produces) return;
    if (type !== null && !b.def.produces.includes(type)) return;
    if (b.produce !== type) { b.produce = type; b.progress = 0; }
  }

  setRally(bid, x, y, team) {
    const b = this.byId.get(bid);
    if (!b || b.team !== team || !b.def.produces) return;
    b.rally = [x, y];
  }

  formationSlots(us, x, y) {
    const taken = new Set();
    const slots = [];
    const sorted = us.map((u, i) => ({ u, i })).sort((a, b) =>
      Math.hypot(a.u.x - x, a.u.y - y) - Math.hypot(b.u.x - x, b.u.y - y));
    const res = new Array(us.length);
    for (const { u, i } of sorted) {
      const cx = Math.floor(x), cy = Math.floor(y);
      let found = null;
      for (let r = 0; r < 12 && !found; r++) {
        let best = null, bd = 1e9;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cx + dx, ny = cy + dy;
          const key = ny * 10000 + nx;
          if (taken.has(key) || !passable(this.map, nx, ny, u.cls)) continue;
          if (u.cls === 'vehicle' && (taken.has(key + 1) || taken.has(key - 1) || taken.has(key + 10000) || taken.has(key - 10000))) continue;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = [nx, ny, key]; }
        }
        if (best) found = best;
      }
      if (found) {
        taken.add(found[2]);
        res[i] = [found[0] + 0.5, found[1] + 0.5];
      } else res[i] = [x, y];
    }
    slots.push(...res);
    return slots;
  }

  requestPath(u, x, y) {
    u.dest = [x, y];
    u.needPath = true;
    u.repaths = 0;
    u.stuckT = 0;
    if (!this.pathQueue.includes(u)) this.pathQueue.push(u);
  }

  // ---------- Simulation ----------
  step() {
    if (this.over) return;
    this.tick++;
    this.time += SIM_DT;
    const dt = SIM_DT;

    // Wege berechnen (Budget)
    let budget = 14;
    while (budget-- > 0 && this.pathQueue.length) {
      const u = this.pathQueue.shift();
      if (u.dead || !u.needPath) continue;
      u.needPath = false;
      u.path = findPath(this.map, u.x - 0.5, u.y - 0.5, u.dest[0] - 0.5, u.dest[1] - 0.5, u.cls);
      u.pi = 0;
      if (u.path && u.path.length) {
        // letzten Wegpunkt exakt auf Ziel, falls begehbar
        const last = u.path[u.path.length - 1];
        if (Math.hypot(last[0] - u.dest[0], last[1] - u.dest[1]) < 1 && passable(this.map, Math.floor(u.dest[0]), Math.floor(u.dest[1]), u.cls)) {
          u.path[u.path.length - 1] = [u.dest[0], u.dest[1]];
        }
      }
      u.sx = u.x; u.sy = u.y;
    }

    for (const u of this.units) {
      if (u.dead) continue;
      u.px = u.x; u.py = u.y;
      if (u.team === TEAM.NEUTRAL) continue;
      this.updateUnit(u, dt);
    }
    this.separate();
    for (const b of this.buildings) {
      if (b.destroyed || !b.team) continue;
      if (b.def.weapon) this.updateGun(b, dt);
      if (b.def.produces) this.updateProduction(b, dt);
    }
    this.updateProjectiles(dt);
    this.updateSectors();
    if (this.tick % 5 === 0) this.updateVisibility();
    if (this.tick % 10 === 0) this.repair(dt * 10);
    // Tote entfernen
    if (this.tick % 20 === 0) {
      this.units = this.units.filter((u) => {
        if (u.dead) { this.byId.delete(u.id); return false; }
        return true;
      });
    }
  }

  countUnits(team) {
    let c = 0;
    for (const u of this.units) if (!u.dead && u.team === team) c++;
    return c;
  }

  territory(team) {
    let c = 0;
    for (const s of this.sectors) if (s.owner === team) c++;
    return c / this.sectors.length;
  }

  isEnemy(a, b) { return a && b && a !== b; }

  // Sucht ein Ziel in Reichweite r
  findTarget(src, x, y, r, weapon, team) {
    let best = null, bs = -1e9;
    const w = WEAPONS[weapon];
    for (const o of this.units) {
      if (o.dead || !this.isEnemy(team, o.team)) continue;
      const d = Math.hypot(o.x - x, o.y - y) - o.radius;
      if (d > r || (w.minRange && d < w.minRange)) continue;
      const eff = DAMAGE[w.kind][o.def.armor];
      let s = eff * 10 - d + (src.target === o.id ? 3 : 0) + (1 - o.hp / o.maxHp) * 2;
      // Gebäude schützen zuerst die eigene Flagge
      if (src.kind === 'building' && o.cls === 'robot') {
        const sec = this.sectors[src.sector];
        if (Math.abs(o.x - sec.x) < 2 && Math.abs(o.y - sec.y) < 2) s += 25;
      }
      if (s > bs) { bs = s; best = o; }
    }
    for (const b of this.buildings) {
      if (b.destroyed || !this.isEnemy(team, b.team)) continue;
      const d = this.distToBuilding(x, y, b);
      if (d > r || (w.minRange && d < w.minRange)) continue;
      const eff = DAMAGE[w.kind].structure;
      const s = eff * 6 - d - 4 + (src.target === b.id ? 8 : 0) + (b.def.weapon ? 3 : 0);
      if (s > bs) { bs = s; best = b; }
    }
    return best;
  }

  distToBuilding(x, y, b) {
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
    const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
    return Math.hypot(dx, dy);
  }

  distTo(u, t) {
    if (t.kind === 'building') return this.distToBuilding(u.x, u.y, t);
    return Math.hypot(t.x - u.x, t.y - u.y) - t.radius;
  }

  alive(t) { return t && !t.dead && !t.destroyed; }

  updateUnit(u, dt) {
    const def = u.def;
    const wpn = WEAPONS[def.weapon];
    u.cd -= dt;
    u.recoil = Math.max(0, u.recoil - dt * 4);

    // Zielwahl
    u.scanT -= dt;
    let tgt = u.target ? this.byId.get(u.target) : null;
    if (!this.alive(tgt)) { tgt = null; u.target = null; }
    if (u.order.kind === 'attack') {
      const ot = this.byId.get(u.order.id);
      if (!this.alive(ot)) { u.order = { kind: 'idle' }; u.gx = u.x; u.gy = u.y; u.path = null; }
      else tgt = ot;
    }
    if (u.order.kind !== 'board' && u.scanT <= 0) {
      u.scanT = 0.3;
      if (u.order.kind !== 'attack') {
        const inRange = this.findTarget(u, u.x, u.y, wpn.range, def.weapon, u.team);
        if (inRange) tgt = inRange;
        else if (u.order.kind === 'idle' || u.order.kind === 'amove') {
          // in Sichtweite verfolgen (Leine zur Wachposition)
          const seen = this.findTarget(u, u.x, u.y, Math.min(def.sight, wpn.range + 3), def.weapon, u.team);
          const leash = u.order.kind === 'idle' ? 7 : 99;
          if (seen && Math.hypot(u.gx - u.x, u.gy - u.y) < leash) {
            tgt = seen;
            if (!u.path || u.chase !== seen.id) {
              u.chase = seen.id;
              const tx = seen.kind === 'building' ? seen.cx : seen.x, ty = seen.kind === 'building' ? seen.cy : seen.y;
              this.requestPath(u, tx, ty);
            }
          } else tgt = null;
        } else tgt = null;
      }
      u.target = tgt ? tgt.id : null;
    }

    // Bewegung
    let wantMove = false;
    if (u.order.kind === 'attack' && tgt) {
      const d = this.distTo(u, tgt);
      if (d > wpn.range * 0.92) {
        wantMove = true;
        if (!u.path && !u.needPath) {
          const tx = tgt.kind === 'building' ? tgt.cx : tgt.x, ty = tgt.kind === 'building' ? tgt.cy : tgt.y;
          this.requestPath(u, tx, ty);
        } else if (tgt.kind === 'unit' && u.dest && Math.hypot(u.dest[0] - tgt.x, u.dest[1] - tgt.y) > 2.5 && !u.needPath) {
          this.requestPath(u, tgt.x, tgt.y);
        }
      } else {
        u.path = null;
      }
    } else if (u.chase && tgt && tgt.id === u.chase) {
      const d = this.distTo(u, tgt);
      if (d <= wpn.range * 0.9) { u.path = null; }
      else wantMove = true;
    } else if (u.order.kind === 'idle' && u.chase) {
      // zurück zur Wachposition
      u.chase = null;
      if (Math.hypot(u.gx - u.x, u.gy - u.y) > 1.5) this.requestPath(u, u.gx, u.gy);
    }
    if (u.order.kind === 'move' || u.order.kind === 'amove' || u.order.kind === 'board') wantMove = true;
    if (u.order.kind === 'amove' && tgt && this.distTo(u, tgt) <= wpn.range) wantMove = false;

    if (u.order.kind === 'board') {
      const v = this.byId.get(u.order.id);
      if (!v || v.dead || v.team !== TEAM.NEUTRAL) { u.order = { kind: 'idle' }; u.gx = u.x; u.gy = u.y; u.path = null; }
      else if (Math.hypot(v.x - u.x, v.y - u.y) < v.radius + 0.7) {
        v.team = u.team;
        v.driver = u.type;
        v.order = { kind: 'idle' };
        v.gx = v.x; v.gy = v.y;
        v.angle = v.angle || 0;
        u.dead = true;
        this.emit({ t: 'board', x: v.x, y: v.y, team: u.team, vid: v.id, uid: u.id });
        return;
      }
    }

    u.moving = false;
    if (wantMove && u.path && u.pi < u.path.length) {
      this.moveAlong(u, dt);
    } else if (wantMove && !u.path && !u.needPath && (u.order.kind === 'move' || u.order.kind === 'amove')) {
      // kein Weg gefunden
      this.finishOrder(u);
    } else if (u.path && u.pi >= u.path.length) {
      u.path = null;
      if (u.order.kind === 'move' || u.order.kind === 'amove') this.finishOrder(u);
    }
    if (u.order.kind === 'idle' && !u.chase && u.path && u.pi < u.path.length) this.moveAlong(u, dt);

    // Feuern
    if (tgt) {
      const tx = tgt.kind === 'building' ? Math.max(tgt.x, Math.min(u.x, tgt.x + tgt.w)) : tgt.x;
      const ty = tgt.kind === 'building' ? Math.max(tgt.y, Math.min(u.y, tgt.y + tgt.h)) : tgt.y;
      const aim = Math.atan2(ty - u.y, tx - u.x);
      const d = this.distTo(u, tgt);
      if (u.cls === 'vehicle') {
        const rate = 4 * dt;
        const ad = angDiff(u.turret, aim);
        u.turret += Math.max(-rate, Math.min(rate, ad));
      } else if (!u.moving) {
        u.angle = aim;
        u.turret = aim;
      } else {
        u.turret = aim;
      }
      const aligned = Math.abs(angDiff(u.turret, aim)) < 0.25;
      if (d <= wpn.range && (!wpn.minRange || d >= wpn.minRange) && aligned) {
        if (u.cd <= 0) {
          u.cd = wpn.cd * (0.9 + Math.random() * 0.2);
          if (wpn.salvo) { u.salvo = wpn.salvo; u.salvoT = 0; }
          else this.fire(u, tgt, wpn, def.weapon);
        }
      }
    } else if (u.cls === 'vehicle') {
      const ad = angDiff(u.turret, u.angle);
      u.turret += Math.max(-2 * dt, Math.min(2 * dt, ad));
    } else if (!u.moving) {
      u.turret = u.angle;
    }
    if (u.salvo > 0) {
      u.salvoT -= dt;
      if (u.salvoT <= 0) {
        if (tgt) this.fire(u, tgt, wpn, def.weapon);
        u.salvo--;
        u.salvoT = 0.18;
        if (!tgt) u.salvo = 0;
      }
    }
  }

  finishOrder(u) {
    u.order = { kind: 'idle' };
    u.gx = u.x; u.gy = u.y;
    u.path = null;
    u.chase = null;
  }

  moveAlong(u, dt) {
    const wp = u.path[u.pi];
    const dx = wp[0] - u.x, dy = wp[1] - u.y;
    const dist = Math.hypot(dx, dy);
    const last = u.pi === u.path.length - 1;
    if (dist < (last ? 0.12 : 0.45)) {
      u.pi++;
      return;
    }
    const tile = this.map.tiles[Math.floor(u.y) * this.map.w + Math.floor(u.x)];
    let sp = u.def.speed;
    if (tile === T.FOREST) sp *= 0.6;
    if ((tile === T.ROAD || tile === T.BRIDGE) && u.cls === 'vehicle') sp *= 1.15;
    const want = Math.atan2(dy, dx);
    if (u.cls === 'vehicle') {
      const ad = angDiff(u.angle, want);
      const tr = (u.def.turnRate || 3) * dt;
      u.angle += Math.max(-tr, Math.min(tr, ad));
      const f = Math.max(0, Math.cos(ad));
      if (Math.abs(ad) > 1.1) sp = 0; else sp *= f * f;
      const step = Math.min(dist, sp * dt);
      this.tryMove(u, Math.cos(u.angle) * step, Math.sin(u.angle) * step);
    } else {
      u.angle = want;
      const step = Math.min(dist, sp * dt);
      this.tryMove(u, (dx / dist) * step, (dy / dist) * step);
    }
    u.moving = true;
    u.walk += sp * dt;
    // Feststecken erkennen
    u.stuckT += dt;
    if (u.stuckT > 1.4) {
      const prog = Math.hypot(u.x - u.sx, u.y - u.sy);
      if (prog < 0.35) {
        u.repaths++;
        const goal = u.path[u.path.length - 1];
        if (u.repaths > 3 || Math.hypot(goal[0] - u.x, goal[1] - u.y) < 1.6) {
          u.path = null;
          if (u.order.kind !== 'attack' && u.order.kind !== 'board') this.finishOrder(u);
        } else {
          const rp = u.repaths;
          this.requestPath(u, u.dest ? u.dest[0] : goal[0], u.dest ? u.dest[1] : goal[1]);
          u.repaths = rp;
        }
      }
      u.stuckT = 0;
      u.sx = u.x; u.sy = u.y;
    }
  }

  tryMove(u, mx, my) {
    const nx = u.x + mx, ny = u.y + my;
    if (passable(this.map, Math.floor(nx), Math.floor(ny), u.cls)) { u.x = nx; u.y = ny; return; }
    if (passable(this.map, Math.floor(nx), Math.floor(u.y), u.cls)) { u.x = nx; return; }
    if (passable(this.map, Math.floor(u.x), Math.floor(ny), u.cls)) { u.y = ny; }
  }

  separate() {
    const us = this.units;
    const n = us.length;
    // einfaches Raster für Nachbarschaft
    const cell = 2;
    const grid = new Map();
    for (let i = 0; i < n; i++) {
      const u = us[i];
      if (u.dead) continue;
      const k = ((u.x / cell) | 0) * 1000 + ((u.y / cell) | 0);
      let a = grid.get(k);
      if (!a) grid.set(k, (a = []));
      a.push(u);
    }
    for (const u of us) {
      if (u.dead) continue;
      const gx = (u.x / cell) | 0, gy = (u.y / cell) | 0;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const a = grid.get((gx + ox) * 1000 + gy + oy);
        if (!a) continue;
        for (const o of a) {
          if (o.id <= u.id) continue;
          const dx = o.x - u.x, dy = o.y - u.y;
          const min = (u.radius + o.radius) * 0.9;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 < 1e-6) {
            if (d2 < 1e-6) { o.x += 0.01; }
            continue;
          }
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const px = (dx / d) * push, py = (dy / d) * push;
          // bewegliche Einheiten weichen eher aus; neutrale Fahrzeuge stehen fest
          const wu = u.team === 0 ? 0 : (u.moving ? 0.35 : 0.65);
          const wo = o.team === 0 ? 0 : (o.moving ? 0.35 : 0.65);
          const tot = wu + wo || 1;
          this.tryMove(u, -px * 2 * wu / tot, -py * 2 * wu / tot);
          this.tryMove(o, px * 2 * wo / tot, py * 2 * wo / tot);
        }
      }
    }
  }

  updateGun(b, dt) {
    const wpn = WEAPONS[b.def.weapon];
    b.cd -= dt;
    b.scanT = (b.scanT || 0) - dt;
    let tgt = b.target ? this.byId.get(b.target) : null;
    if (!this.alive(tgt) || this.distTo({ x: b.cx, y: b.cy }, tgt) > wpn.range + 1) tgt = null;
    if (b.scanT <= 0) {
      b.scanT = 0.35;
      tgt = this.findTarget(b, b.cx, b.cy, wpn.range + b.w / 2, b.def.weapon, b.team);
      b.target = tgt ? tgt.id : null;
    }
    if (!tgt) return;
    const aim = Math.atan2(tgt.y - b.cy, tgt.x - b.cx);
    const ad = angDiff(b.turret, aim);
    b.turret += Math.max(-3 * dt, Math.min(3 * dt, ad));
    if (Math.abs(ad) < 0.2 && b.cd <= 0) {
      b.cd = wpn.cd;
      this.fire(b, tgt, wpn, b.def.weapon);
    }
  }

  fire(src, tgt, wpn, wname) {
    const sx = src.kind === 'building' ? src.cx : src.x;
    const sy = src.kind === 'building' ? src.cy : src.y;
    let tx, ty;
    if (tgt.kind === 'building') {
      tx = Math.max(tgt.x + 0.3, Math.min(sx, tgt.x + tgt.w - 0.3));
      ty = Math.max(tgt.y + 0.3, Math.min(sy, tgt.y + tgt.h - 0.3));
    } else {
      // Vorhalt für bewegte Ziele
      const tt = Math.hypot(tgt.x - sx, tgt.y - sy) / wpn.speed;
      tx = tgt.x + (tgt.x - tgt.px) / SIM_DT * tt * 0.8;
      ty = tgt.y + (tgt.y - tgt.py) / SIM_DT * tt * 0.8;
    }
    if (wpn.salvo || wpn.splash) {
      const spread = wpn.salvo ? 0.9 : 0.25;
      tx += (Math.random() - 0.5) * spread;
      ty += (Math.random() - 0.5) * spread;
    }
    const dist = Math.hypot(tx - sx, ty - sy);
    const dur = Math.max(0.05, dist / wpn.speed);
    const p = {
      sx, sy, x: sx, y: sy, tx, ty, t: 0, dur, wpn, wname, team: src.team, tid: tgt.id, src: src.id,
      arc: wpn.arc || 0, kind: wpn.proj,
    };
    this.projectiles.push(p);
    if (src.kind === 'unit') src.recoil = 1;
    else src.recoil = 1;
    this.emit({ t: 'shot', x: sx, y: sy, tx, ty, angle: Math.atan2(ty - sy, tx - sx), w: wname, team: src.team, src: src.id, proj: p });
  }

  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.y = p.sy + (p.ty - p.sy) * k;
      if (k >= 1) this.impact(p);
      else keep.push(p);
    }
    this.projectiles = keep;
  }

  impact(p) {
    const w = p.wpn;
    p.done = true;
    if (w.splash) {
      for (const o of this.units) {
        if (o.dead || !this.isEnemy(p.team, o.team)) continue;
        const d = Math.hypot(o.x - p.tx, o.y - p.ty) - o.radius * 0.5;
        if (d < w.splash) this.damage(o, w.dmg * (1 - (Math.max(0, d) / w.splash) * 0.6), w.kind, p.team);
      }
      for (const b of this.buildings) {
        if (b.destroyed || !this.isEnemy(p.team, b.team)) continue;
        if (this.distToBuilding(p.tx, p.ty, b) < w.splash * 0.6) this.damage(b, w.dmg, w.kind, p.team);
      }
    } else {
      const t = this.byId.get(p.tid);
      if (this.alive(t)) {
        const d = t.kind === 'building' ? this.distToBuilding(p.tx, p.ty, t) : Math.hypot(t.x - p.tx, t.y - p.ty);
        if (d < (t.kind === 'building' ? 0.6 : t.radius + 0.55)) this.damage(t, w.dmg, w.kind, p.team);
      }
    }
    const tile = this.map.tiles[Math.floor(p.ty) * this.map.w + Math.floor(p.tx)];
    this.emit({ t: 'impact', x: p.tx, y: p.ty, kind: p.kind, w: p.wname, splash: w.splash || 0, water: tile === T.WATER });
  }

  damage(e, amount, kind, byTeam) {
    if (e.dead || e.destroyed) return;
    const armor = e.kind === 'building' ? 'structure' : e.def.armor;
    e.hp -= amount * DAMAGE[kind][armor];
    e.hitT = this.time;
    if (e.team && this.time - this.attackNotice[e.team] > 12) {
      const important = e.kind === 'building' || e.cls === 'vehicle';
      if (important) {
        this.attackNotice[e.team] = this.time;
        this.emit({ t: 'underattack', team: e.team, x: e.kind === 'building' ? e.cx : e.x, y: e.kind === 'building' ? e.cy : e.y, what: e.kind === 'building' ? e.def.name : 'Einheiten' });
      }
    }
    if (e.hp <= 0) {
      e.hp = 0;
      if (e.kind === 'unit') this.killUnit(e, byTeam);
      else this.destroyBuilding(e, byTeam);
    }
  }

  killUnit(u, byTeam) {
    u.dead = true;
    if (this.stats[u.team]) this.stats[u.team].lost++;
    if (this.stats[byTeam]) this.stats[byTeam].kills++;
    this.emit({ t: 'death', x: u.x, y: u.y, cls: u.cls, type: u.type, team: u.team, id: u.id, angle: u.angle });
    if (u.cls === 'vehicle' && u.team && this.rng() < 0.35) {
      const p = nearestPassable(this.map, u.x - 0.5, u.y - 0.5, 'robot', 3);
      if (p) {
        const r = this.addUnit(u.driver || 'runner', p[0] + 0.5, p[1] + 0.5, u.team);
        r.angle = u.angle;
        this.emit({ t: 'eject', x: r.x, y: r.y, team: u.team, id: r.id });
      }
    }
  }

  destroyBuilding(b, byTeam) {
    b.destroyed = true;
    b.produce = null;
    this.emit({ t: 'bdestroy', id: b.id, x: b.cx, y: b.cy, type: b.type, team: b.team, size: Math.max(b.w, b.h) });
    if (b.type === 'fort') this.gameOver(b.team === TEAM.PLAYER ? TEAM.ENEMY : TEAM.PLAYER, 'fort');
  }

  updateProduction(b, dt) {
    if (!b.produce) return;
    if (this.countUnits(b.team) >= UNIT_CAP) { b.blocked = true; return; }
    b.blocked = false;
    const def = UNITS[b.produce];
    const time = def.build * productionFactor(this.territory(b.team)) / (this.speedMul[b.team] || 1);
    b.progress += dt / time;
    if (b.progress >= 1) {
      b.progress = 0;
      const ex = b.cx, ey = b.y + b.h + 0.6;
      const p = nearestPassable(this.map, ex - 0.5, ey - 0.5, def.cls, 6);
      if (!p) return;
      const u = this.addUnit(b.produce, p[0] + 0.5, p[1] + 0.5, b.team);
      u.angle = Math.PI / 2; u.turret = u.angle;
      if (this.stats[b.team]) this.stats[b.team].built++;
      this.emit({ t: 'spawn', id: u.id, x: u.x, y: u.y, team: b.team, type: b.produce, from: b.id });
      const r = b.rally || [b.cx + (this.rng() - 0.5) * 3, b.y + b.h + 2.5];
      this.commandMove([u.id], r[0], r[1], b.team);
    }
  }

  updateSectors() {
    if (this.tick % 2) return;
    const dt = SIM_DT * 2;
    for (const s of this.sectors) {
      let teams = 0;
      for (const u of this.units) {
        if (u.dead || u.cls !== 'robot' || !u.team) continue;
        if (Math.abs(u.x - s.x) < 1.0 && Math.abs(u.y - s.y) < 1.0) teams |= u.team;
      }
      if ((teams === 1 || teams === 2) && s.owner !== teams) {
        if (s.capTeam !== teams) { s.capTeam = teams; s.capT = 0; }
        s.capT += dt;
        if (s.capT >= this.captureTime(s)) {
          s.capT = 0; s.capTeam = 0;
          this.captureSector(s, teams);
        }
      } else if (s.capT > 0) {
        s.capT = Math.max(0, s.capT - dt * 2);
        if (s.capT === 0) s.capTeam = 0;
      }
    }
  }

  captureTime(s) {
    let t = 1;
    for (const id of s.buildings) {
      const b = this.byId.get(id);
      if (!b || b.destroyed) continue;
      if (b.type === 'fort') return 12;
      if (b.def.produces) t = Math.max(t, 2.5);
    }
    return t;
  }

  captureSector(s, team) {
    const prev = s.owner;
    s.owner = team;
    if (this.stats[team]) this.stats[team].captures++;
    let hasFort = null;
    for (const id of s.buildings) {
      const b = this.byId.get(id);
      if (!b) continue;
      if (b.type === 'fort' && !b.destroyed && b.team && b.team !== team) hasFort = b;
      b.team = team;
      b.target = null;
      b.progress = 0;
      b.rally = null;
      b.produce = b.def.produces && !b.destroyed ? DEFAULT_PROD[b.type] : null;
    }
    this.emit({ t: 'capture', sector: s.id, team, prev, x: s.x, y: s.y });
    if (hasFort) this.gameOver(team, 'flag');
    this.checkGoal();
  }

  repair(dt) {
    for (const u of this.units) {
      if (u.dead || !u.team || u.hp >= u.maxHp || u.moving) continue;
      if (this.time - u.hitT < 4) continue;
      for (const b of this.buildings) {
        if (b.destroyed || b.team !== u.team || !b.def.produces) continue;
        const makesMine = b.def.produces.some((t) => UNITS[t].cls === u.cls);
        if (!makesMine) continue;
        if (this.distToBuilding(u.x, u.y, b) < 3.5) {
          u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.04 * dt);
          u.repairing = this.time;
          break;
        }
      }
    }
  }

  updateVisibility() {
    const { w, h } = this.map;
    for (const team of [1, 2]) {
      const vis = this.vis[team], exp = this.explored[team];
      vis.fill(0);
      const mark = (cx, cy, r) => {
        const r2 = r * r;
        const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
        const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
        for (let y = y0; y <= y1; y++) {
          const dy = y + 0.5 - cy;
          for (let x = x0; x <= x1; x++) {
            const dx = x + 0.5 - cx;
            if (dx * dx + dy * dy <= r2) { const i = y * w + x; vis[i] = 1; exp[i] = 1; }
          }
        }
      };
      for (const u of this.units) if (!u.dead && u.team === team) mark(u.x, u.y, u.def.sight);
      for (const b of this.buildings) if (!b.destroyed && b.team === team) mark(b.cx, b.cy, b.def.sight + b.w / 2);
      for (const s of this.sectors) if (s.owner === team) mark(s.x, s.y, 3);
    }
  }

  isVisible(team, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= this.map.w || yi >= this.map.h) return false;
    return this.vis[team][yi * this.map.w + xi] === 1;
  }

  // Sonderziel eines Levels: bestimmte Gebäude besitzen
  checkGoal() {
    const g = this.level.goal;
    if (!g || g.type !== 'own' || this.over) return;
    const need = this.buildings.filter((b) => g.types.includes(b.type) && !b.destroyed);
    if (need.length && need.every((b) => b.team === TEAM.PLAYER)) this.gameOver(TEAM.PLAYER, 'goal');
  }

  gameOver(winner, reason) {
    if (this.over) return;
    this.over = { winner, reason, time: this.time };
    this.emit({ t: 'gameover', winner, reason });
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
