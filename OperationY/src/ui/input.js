// Maus- und Tastatursteuerung

import { TEAM } from '../sim/defs.js';

export class Input {
  constructor(game) {
    this.g = game;
    this.keys = new Set();
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false, sx: 0, sy: 0, inside: true };
    this.box = null;
    this.groups = {};
    this.lastGroupKey = { k: null, t: 0 };
    this.lastClick = { t: 0, id: null };
    this.aMode = false;
    this.hoverId = null;
    const c = document.getElementById('gl');
    c.addEventListener('mousedown', (e) => this.down(e));
    window.addEventListener('mousemove', (e) => this.move(e));
    window.addEventListener('mouseup', (e) => this.up(e));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.g.renderer.zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    document.addEventListener('mouseenter', () => { this.mouse.inside = true; });
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.keys.clear());
  }

  get active() { return this.g.state === 'play'; }

  pickAt(sx, sy) {
    const w = this.g.world, r = this.g.renderer;
    let best = null, bd = 1e9;
    const zoom = 42 / r.cam.dist;
    for (const u of w.units) {
      if (u.dead) continue;
      if (u.team === TEAM.ENEMY && !w.isVisible(1, u.x, u.y)) continue;
      if (u.team === TEAM.NEUTRAL && !w.explored[1][Math.floor(u.y) * w.map.w + Math.floor(u.x)]) continue;
      const [px, py, pz] = r.tileToScreen(u.x, u.y, u.cls === 'robot' ? 0.9 : 0.8);
      if (pz > 1) continue;
      const d = Math.hypot(px - sx, py - sy);
      const rad = (u.cls === 'robot' ? 16 : 26) * Math.max(0.6, zoom);
      if (d < rad && d < bd) { bd = d; best = u; }
    }
    if (best) return best;
    const [tx, ty] = r.screenToTile(sx, sy);
    const xi = Math.floor(tx), yi = Math.floor(ty);
    if (xi >= 0 && yi >= 0 && xi < w.map.w && yi < w.map.h) {
      const id = w.map.occ[yi * w.map.w + xi];
      if (id) {
        const b = w.byId.get(id);
        if (b && w.explored[1][yi * w.map.w + xi]) return b;
      }
    }
    return null;
  }

  down(e) {
    if (!this.active) return;
    this.g.audio.init();
    this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    if (e.button === 0) {
      this.mouse.down = true;
      this.mouse.sx = e.clientX; this.mouse.sy = e.clientY;
      this.box = null;
    } else if (e.button === 2) {
      this.order(e.clientX, e.clientY);
    }
  }

  move(e) {
    this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    this.mouse.inside = true;
    if (!this.active) return;
    if (this.mouse.down) {
      if (Math.hypot(e.clientX - this.mouse.sx, e.clientY - this.mouse.sy) > 6) {
        this.box = [this.mouse.sx, this.mouse.sy, e.clientX, e.clientY];
      }
    }
  }

  up(e) {
    if (!this.active || e.button !== 0 || !this.mouse.down) { this.mouse.down = false; return; }
    this.mouse.down = false;
    const g = this.g;
    const sel = g.selection;
    if (this.box) {
      const [x0, y0, x1, y1] = this.box;
      const minx = Math.min(x0, x1), maxx = Math.max(x0, x1), miny = Math.min(y0, y1), maxy = Math.max(y0, y1);
      const picked = [];
      for (const u of g.world.units) {
        if (u.dead || u.team !== TEAM.PLAYER) continue;
        const [px, py] = g.renderer.tileToScreen(u.x, u.y, 0.6);
        if (px >= minx && px <= maxx && py >= miny && py <= maxy) picked.push(u.id);
      }
      if (!e.shiftKey) sel.clear();
      for (const id of picked) sel.add(id);
      if (picked.length) g.audio.play('select');
      this.box = null;
      return;
    }
    const o = this.pickAt(e.clientX, e.clientY);
    const now = performance.now();
    if (o && o.kind === 'unit' && o.team === TEAM.PLAYER && this.lastClick.id === o.id && now - this.lastClick.t < 350) {
      // Doppelklick: alle des Typs im Bild
      for (const u of g.world.units) {
        if (u.dead || u.team !== TEAM.PLAYER || u.type !== o.type) continue;
        const [px, py, pz] = g.renderer.tileToScreen(u.x, u.y, 0.6);
        if (pz < 1 && px >= 0 && py >= 0 && px <= innerWidth && py <= innerHeight) sel.add(u.id);
      }
      g.audio.play('select');
      return;
    }
    this.lastClick = { t: now, id: o ? o.id : null };
    if (!e.shiftKey) sel.clear();
    if (o && o.kind === 'unit' && o.team === TEAM.PLAYER) g.quip(o.id, 'select');
    if (o) {
      if (e.shiftKey && sel.has(o.id)) sel.delete(o.id);
      else if (e.shiftKey && (o.team !== TEAM.PLAYER || o.kind === 'building')) { /* nur eigene Einheiten ergänzen */ }
      else sel.add(o.id);
      g.audio.play('select');
    }
  }

  order(sx, sy) {
    const g = this.g, w = g.world;
    const ids = [...g.selection].filter((id) => {
      const o = w.byId.get(id);
      return o && !o.dead && o.team === TEAM.PLAYER;
    });
    if (!ids.length) return;
    const first = w.byId.get(ids[0]);
    const [tx, ty] = g.renderer.screenToTile(sx, sy);
    if (first.kind === 'building') {
      if (first.def.produces) {
        w.setRally(first.id, tx, ty, TEAM.PLAYER);
        g.renderer.marker(tx, ty, 0x66ffa0);
        g.audio.play('order');
      }
      return;
    }
    const units = ids.filter((id) => w.byId.get(id).kind === 'unit');
    const target = this.pickAt(sx, sy);
    if (target && target.team === TEAM.ENEMY && !(target.kind === 'building' && target.destroyed)) {
      w.commandAttack(units, target.id, TEAM.PLAYER);
      g.quip(units[0], 'attack');
      g.renderer.marker(target.kind === 'building' ? target.cx : target.x, target.kind === 'building' ? target.cy : target.y, 0xff5040);
    } else if (target && target.kind === 'unit' && target.team === TEAM.NEUTRAL && units.some((id) => w.byId.get(id).cls === 'robot')) {
      w.commandBoard(units, target.id, TEAM.PLAYER);
      g.quip(units.find((id) => w.byId.get(id).cls === 'robot'), 'board');
      g.renderer.marker(target.x, target.y, 0xffd060);
    } else {
      w.commandMove(units, tx, ty, TEAM.PLAYER, this.aMode || this.keys.has('KeyF'));
      g.quip(units[0], 'move');
      g.renderer.marker(tx, ty, this.aMode || this.keys.has('KeyF') ? 0xffb347 : 0x66ffa0);
    }
    this.aMode = false;
    g.audio.play('order');
  }

  key(e, down) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    const g = this.g;
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    if (!down) return;
    if (g.state === 'play' || g.state === 'pause') {
      if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); g.togglePause(); return; }
    }
    if (!this.active) return;
    const w = g.world;
    const digit = /^Digit([1-9])$/.exec(e.code);
    if (digit) {
      const k = digit[1];
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.groups[k] = [...g.selection].filter((id) => { const o = w.byId.get(id); return o && o.kind === 'unit' && o.team === 1; });
        g.hud.message(`Gruppe ${k} gespeichert (${this.groups[k].length})`, 'info');
      } else if (this.groups[k]) {
        const alive = this.groups[k].filter((id) => { const o = w.byId.get(id); return o && !o.dead && o.team === 1; });
        this.groups[k] = alive;
        g.selection.clear();
        for (const id of alive) g.selection.add(id);
        const now = performance.now();
        if (this.lastGroupKey.k === k && now - this.lastGroupKey.t < 400 && alive.length) {
          const u = w.byId.get(alive[0]);
          g.renderer.lookAt(u.x, u.y);
        }
        this.lastGroupKey = { k, t: now };
      }
      return;
    }
    switch (e.code) {
      case 'KeyX': w.commandStop([...g.selection], 1); g.audio.play('order'); break;
      case 'KeyH': {
        const f = w.buildings.find((b) => b.type === 'fort' && b.team === 1);
        if (f) g.renderer.lookAt(f.cx, f.cy + 3);
        break;
      }
      case 'Space': e.preventDefault(); if (g.hud.lastEvent) g.renderer.lookAt(...g.hud.lastEvent); break;
      case 'Equal': case 'NumpadAdd': case 'BracketRight': g.setSpeed(2); break;
      case 'Minus': case 'NumpadSubtract': case 'Slash': g.setSpeed(1); break;
      case 'KeyF': this.aMode = true; break;
    }
  }

  update(dt) {
    if (!this.active) return;
    const r = this.g.renderer;
    const sp = 40 * dt;
    let dx = 0, dz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dz -= sp;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dz += sp;
    if (this.keys.has('KeyA')) dx -= sp;
    if (this.keys.has('ArrowLeft')) dx -= sp;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += sp;
    if (this.keys.has('KeyQ')) r.cam.yaw -= dt * 1.4;
    if (this.keys.has('KeyE')) r.cam.yaw += dt * 1.4;
    if (this.g.options.edge && this.mouse.inside && !this.mouse.down) {
      const m = 6;
      if (this.mouse.x < m) dx -= sp;
      if (this.mouse.x > innerWidth - m) dx += sp;
      if (this.mouse.y < m) dz -= sp;
      if (this.mouse.y > innerHeight - m) dz += sp;
    }
    if (dx || dz) r.pan(dx, dz);
    const h = this.pickAt(this.mouse.x, this.mouse.y);
    this.hoverId = h ? h.id : null;
    const c = document.getElementById('gl');
    let cur = 'default';
    if (h && h.team === TEAM.ENEMY && this.g.selection.size) cur = 'crosshair';
    else if (h && h.team === TEAM.NEUTRAL && h.kind === 'unit') cur = 'alias';
    else if (h) cur = 'pointer';
    c.style.cursor = cur;
  }
}
