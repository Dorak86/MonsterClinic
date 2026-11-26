// Computergegner: Produktion, Eroberung, Verteidigung, Großangriff

import { UNITS } from './defs.js';

const THINK = [2.6, 1.5, 0.9];

export class AI {
  constructor(world, team, difficulty = 1) {
    this.w = world;
    this.team = team;
    this.enemy = team === 1 ? 2 : 1;
    this.diff = difficulty;
    this.t = 1 + team * 0.3;
    this.tasks = new Map(); // unitId -> { kind, sector, until }
    this.assaultT = 70 - difficulty * 15;
    this.rng = world.rng;
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = THINK[this.diff];
    this.think();
  }

  pick(weights) {
    let sum = 0;
    for (const k in weights) sum += weights[k];
    let r = this.rng() * sum;
    for (const k in weights) { r -= weights[k]; if (r <= 0) return k; }
    return Object.keys(weights)[0];
  }

  think() {
    const w = this.w;
    const mine = [], foes = [];
    for (const u of w.units) {
      if (u.dead) continue;
      if (u.cls === 'prop') continue;
      if (u.team === this.team) mine.push(u);
      else if (u.team === this.enemy) foes.push(u);
    }
    const foeVeh = foes.filter((u) => u.cls === 'vehicle').length;
    const foeRob = foes.length - foeVeh;
    const myRob = mine.filter((u) => u.cls === 'robot').length;

    // Produktion
    for (const b of w.buildings) {
      if (b.team !== this.team || b.destroyed || !b.def.produces) continue;
      if (b.progress > 0.06 && b.produce) continue;
      let choice;
      if (b.type === 'vehicle') {
        choice = this.pick({
          buggy: w.time < 120 ? 3 : 1,
          lighttank: 3,
          mediumtank: 2 + foeVeh * 0.2,
          heavytank: 1 + foeVeh * 0.4 + (this.diff === 2 ? 1 : 0),
          launcher: 1 + (foeRob > 8 ? 1 : 0),
          transporter: 0.4,
          fueltruck: 0.35,
        });
      } else {
        const opts = b.def.produces;
        if (myRob < 5) choice = 'runner';
        else {
          const wts = { runner: 3, assault: 2, grenadier: 1 + foeRob * 0.15, rocketeer: 1 + foeVeh * 0.7 };
          if (opts.includes('sniper')) wts.sniper = 0.6 + foeRob * 0.05 + foeVeh * 0.15;
          if (opts.includes('flamer')) wts.flamer = 0.8 + foeRob * 0.1;
          if (opts.includes('laser')) wts.laser = 0.4 + w.time / 600;
          for (const k of Object.keys(wts)) if (!opts.includes(k)) delete wts[k];
          choice = this.pick(wts);
        }
      }
      w.setProduction(b.id, choice, this.team);
    }

    // abgelaufene Aufgaben
    for (const [id, task] of this.tasks) {
      const u = w.byId.get(id);
      if (!u || u.dead || w.time > task.until) { this.tasks.delete(id); continue; }
      if (task.kind === 'capture' && w.sectors[task.sector].owner === this.team && u.order.kind === 'idle') this.tasks.delete(id);
    }

    const idle = mine.filter((u) => !this.tasks.has(u.id) && u.order.kind === 'idle' && !u.chase && u.cls !== 'prop');

    // Herrenlose Fahrzeuge und unbemannte Geschütze kapern
    const boardables = w.units.filter((v) => !v.dead && v.cls === 'vehicle' && v.team === 0)
      .concat(w.buildings.filter((b) => b.def.manned && b.manned === false && !b.destroyed));
    for (const v of boardables) {
      const vx = v.kind === 'unit' ? v.x : v.cx, vy = v.kind === 'unit' ? v.y : v.cy;
      if ([...this.tasks.values()].some((t) => t.kind === 'board' && t.id === v.id)) continue;
      const r = idle.filter((u) => u.cls === 'robot' && !this.tasks.has(u.id))
        .sort((a, b) => Math.hypot(a.x - vx, a.y - vy) - Math.hypot(b.x - vx, b.y - vy))[0];
      if (r && Math.hypot(r.x - vx, r.y - vy) < 16) {
        w.commandBoard([r.id], v.id, this.team);
        this.tasks.set(r.id, { kind: 'board', id: v.id, until: w.time + 30 });
      }
    }
    // Gesprengte Brücken reparieren
    for (const br of w.bridges) {
      if (!br.destroyed || [...this.tasks.values()].some((t) => t.kind === 'fix' && t.b === br.id)) continue;
      const r = idle.filter((u) => u.cls === 'robot' && !this.tasks.has(u.id))
        .sort((a, b) => Math.hypot(a.x - br.x, a.y - br.y) - Math.hypot(b.x - br.x, b.y - br.y))[0];
      if (r && Math.hypot(r.x - br.x, r.y - br.y) < 22) {
        w.commandFixBridge([r.id], br.id, this.team);
        this.tasks.set(r.id, { kind: 'fix', b: br.id, until: w.time + 40 });
      }
    }

    // Verteidigung: Feinde nahe eigener Gebäude/Flaggen
    const assets = [];
    for (const s of w.sectors) {
      if (s.owner !== this.team) continue;
      let v = 1;
      for (const id of s.buildings) { const b = w.byId.get(id); if (b && !b.destroyed) v = Math.max(v, b.type === 'fort' ? 4 : b.def.produces ? 3 : 1.5); }
      assets.push({ x: s.x, y: s.y, v });
    }
    assets.sort((a, b) => b.v - a.v);
    for (const a of assets) {
      let threat = 0;
      for (const f of foes) if (Math.hypot(f.x - a.x, f.y - a.y) < 9) threat += f.cls === 'vehicle' ? 2 : 1;
      if (!threat) continue;
      // wichtige Sektoren ziehen auch beschäftigte Einheiten ab
      const radius = a.v >= 3 ? 22 : 14;
      const pool = mine.filter((u) => {
        const t = this.tasks.get(u.id);
        if (t && t.kind === 'defend') return false;
        if (t && a.v < 3) return false;
        return u.order.kind !== 'attack' && Math.hypot(u.x - a.x, u.y - a.y) < radius;
      }).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
      const helpers = pool.slice(0, Math.ceil(threat * 1.6) + 1);
      if (helpers.length) {
        w.commandMove(helpers.map((u) => u.id), a.x, a.y, this.team, true);
        for (const u of helpers) this.tasks.set(u.id, { kind: 'defend', until: w.time + 18 });
        for (const u of helpers) { const i = idle.indexOf(u); if (i >= 0) idle.splice(i, 1); }
      }
    }

    // Eroberung
    const targets = [];
    const myFlags = w.sectors.filter((s) => s.owner === this.team);
    for (const s of w.sectors) {
      if (s.owner === this.team) continue;
      let dmin = 1e9;
      for (const m of myFlags) dmin = Math.min(dmin, Math.hypot(m.x - s.x, m.y - s.y));
      let defense = 0;
      for (const f of foes) if (Math.hypot(f.x - s.x, f.y - s.y) < 7) defense += f.cls === 'vehicle' ? 2.5 : 1;
      for (const id of s.buildings) {
        const b = w.byId.get(id);
        if (b && b.def.weapon && !b.destroyed && b.team === this.enemy) defense += b.type === 'fort' ? 8 : 3;
      }
      let value = 0;
      for (const id of s.buildings) {
        const b = w.byId.get(id);
        if (b && !b.destroyed) value += b.def.produces ? 14 : 6;
      }
      if (s.owner === this.enemy) value += 4;
      const score = value - dmin * 0.95 - defense * 3;
      targets.push({ s, score, defense });
    }
    targets.sort((a, b) => b.score - a.score);
    const maxTargets = [2, 3, 3][this.diff];
    let active = new Set([...this.tasks.values()].filter((t) => t.kind === 'capture').map((t) => t.sector));
    for (const tg of targets.slice(0, maxTargets)) {
      if (active.has(tg.s.id)) continue;
      const pool = idle.filter((u) => !this.tasks.has(u.id));
      const robots = pool.filter((u) => u.cls === 'robot').sort((a, b) =>
        Math.hypot(a.x - tg.s.x, a.y - tg.s.y) - Math.hypot(b.x - tg.s.x, b.y - tg.s.y));
      if (!robots.length) break;
      const need = Math.min(robots.length, 2 + Math.ceil(tg.defense * 0.8));
      if (tg.defense > 2 && robots.length < need && this.diff > 0) continue;
      // nicht einzeln in feindliche Sektoren
      if (tg.s.owner === this.enemy && need < 2) continue;
      const squad = robots.slice(0, need);
      const vehicles = pool.filter((u) => u.cls === 'vehicle').sort((a, b) =>
        Math.hypot(a.x - tg.s.x, a.y - tg.s.y) - Math.hypot(b.x - tg.s.x, b.y - tg.s.y)).slice(0, Math.ceil(tg.defense / 2) + 1);
      const lead = squad[0];
      w.commandMove([lead.id], tg.s.x, tg.s.y, this.team, false);
      const rest = squad.slice(1).concat(vehicles);
      if (rest.length) w.commandMove(rest.map((u) => u.id), tg.s.x, tg.s.y + 1, this.team, true);
      for (const u of squad.concat(vehicles)) this.tasks.set(u.id, { kind: 'capture', sector: tg.s.id, until: w.time + 70 });
      active.add(tg.s.id);
    }

    // Großangriff
    this.assaultT -= THINK[this.diff];
    const strength = (arr) => arr.reduce((s, u) => s + (u.cls === 'vehicle' ? 2.5 : 1) * (u.hp / u.maxHp), 0);
    const myS = strength(mine), foeS = strength(foes);
    if (this.assaultT <= 0 && mine.length >= 12 && myS > foeS * 1.4) {
      this.assaultT = 55 - this.diff * 10;
      const fort = w.buildings.find((b) => b.type === 'fort' && b.team === this.enemy && !b.destroyed);
      if (fort) {
        const army = mine.filter((u) => {
          const t = this.tasks.get(u.id);
          return !t || t.kind !== 'defend';
        });
        const keep = Math.floor(army.length * 0.25);
        army.sort((a, b) => Math.hypot(a.x - fort.cx, a.y - fort.cy) - Math.hypot(b.x - fort.cx, b.y - fort.cy));
        const go = army.slice(0, army.length - keep);
        if (go.length) {
          w.commandMove(go.map((u) => u.id), fort.cx, fort.cy + fort.h, this.team, true);
          for (const u of go) this.tasks.set(u.id, { kind: 'assault', until: w.time + 90 });
          // ein Roboter versucht die Fortflagge
          const sec = w.sectors[fort.sector];
          const r = go.find((u) => u.cls === 'robot');
          if (r) w.commandMove([r.id], sec.x, sec.y, this.team, false);
        }
      }
    }

    // übrige untätige Einheiten: zur Frontlinie (nächster eigener Sektor zum Feind)
    if (this.rng() < 0.4) {
      const rest = mine.filter((u) => !this.tasks.has(u.id) && u.order.kind === 'idle' && !u.chase);
      if (rest.length >= 3) {
        const front = myFlags.slice().sort((a, b) => this.nearestFoeFlag(a) - this.nearestFoeFlag(b))[0];
        if (front) {
          const grp = rest.filter((u) => Math.hypot(u.x - front.x, u.y - front.y) > 6);
          if (grp.length) {
            w.commandMove(grp.map((u) => u.id), front.x, front.y, this.team, true);
            for (const u of grp) this.tasks.set(u.id, { kind: 'stage', until: w.time + 25 });
          }
        }
      }
    }
  }

  nearestFoeFlag(s) {
    let d = 1e9;
    for (const o of this.w.sectors) if (o.owner !== this.team) d = Math.min(d, Math.hypot(o.x - s.x, o.y - s.y));
    return d;
  }
}

export { UNITS };
