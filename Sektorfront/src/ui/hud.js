// HUD: Statusleiste, Minikarte, Auswahl-/Produktionspanel, Meldungen, Overlay

import { UNITS, BUILDINGS, T, productionFactor, UNIT_CAP } from '../sim/defs.js';
import { TEAM_CSS } from '../render/materials.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(icons) {
    this.icons = icons;
    this.overlay = $('overlay');
    this.og = this.overlay.getContext('2d');
    this.mm = $('minimap');
    this.mg = this.mm.getContext('2d');
    this.panel = $('panel');
    this.msgs = $('msgs');
    this.panelKey = '';
    this.mmT = 0;
    this.lastEvent = null;
    this.onMinimap = null;
    this.onPanel = null;
    this.mmDown = false;
    this.mm.addEventListener('mousedown', (e) => this.mmClick(e, true));
    this.mm.addEventListener('mousemove', (e) => { if (this.mmDown) this.mmClick(e, false); });
    window.addEventListener('mouseup', () => { this.mmDown = false; });
    this.mm.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.overlay.width = window.innerWidth * dpr;
    this.overlay.height = window.innerHeight * dpr;
    this.og.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setWorld(world, renderer) {
    this.w = world;
    this.r = renderer;
    const map = world.map;
    const maxW = window.innerWidth < 900 ? 150 : 220;
    const s = Math.min(maxW / map.w, 170 / map.h);
    this.mmScale = s;
    const dpr = window.devicePixelRatio || 1;
    this.mm.width = Math.round(map.w * s * dpr);
    this.mm.height = Math.round(map.h * s * dpr);
    this.mm.style.width = map.w * s + 'px';
    this.mm.style.height = map.h * s + 'px';
    this.mg.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    this.buildMinimapBase();
    this.panelKey = '';
    this.msgs.innerHTML = '';
  }

  buildMinimapBase() {
    const { w, h, tiles, biome } = this.w.map;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const hex = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const cols = {
      [T.GROUND]: hex(biome.ground[0]), [T.ROAD]: hex(biome.road), [T.ROCK]: hex(biome.rock),
      [T.WATER]: hex(biome.lava ? 0xd24a10 : biome.water), [T.FOREST]: hex(biome.forest), [T.BRIDGE]: hex(0x8a6a50),
    };
    for (let i = 0; i < w * h; i++) {
      const cc = cols[tiles[i]];
      const v = tiles[i] === T.ROCK ? 0.7 : 0.85;
      img.data[i * 4] = cc[0] * v; img.data[i * 4 + 1] = cc[1] * v; img.data[i * 4 + 2] = cc[2] * v; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.mmBase = c;
    this.mmFog = document.createElement('canvas');
    this.mmFog.width = w; this.mmFog.height = h;
    this.mmFogImg = this.mmFog.getContext('2d').createImageData(w, h);
  }

  mmClick(e, down) {
    if (!this.w) return;
    const rect = this.mm.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.mmScale, y = (e.clientY - rect.top) / this.mmScale;
    if (e.button === 2 && down) { this.onMinimap?.('order', x, y); return; }
    if (e.button === 0 || !down) {
      this.mmDown = true;
      this.onMinimap?.('look', x, y);
    }
  }

  message(text, kind = 'info', x, y) {
    const d = document.createElement('div');
    d.className = kind;
    d.textContent = text;
    if (x !== undefined) {
      this.lastEvent = [x, y];
      d.title = 'Klicken zum Hinspringen';
      d.addEventListener('click', () => this.r.lookAt(x, y));
    }
    this.msgs.prepend(d);
    while (this.msgs.children.length > 5) this.msgs.lastChild.remove();
    setTimeout(() => { d.style.opacity = '0'; }, 5500);
    setTimeout(() => d.remove(), 6200);
  }

  // ---------- Statusleiste ----------
  updateTop() {
    const w = this.w;
    const tp = w.territory(1), te = w.territory(2);
    $('terr-p').style.width = tp * 100 + '%';
    $('terr-e').style.width = te * 100 + '%';
    const n = w.sectors.length;
    $('terr-txt').textContent = `${w.sectors.filter((s) => s.owner === 1).length} : ${w.sectors.filter((s) => s.owner === 2).length} / ${n}`;
    $('st-units').textContent = `${w.countUnits(1)}/${UNIT_CAP}`;
    $('st-prod').textContent = Math.round(100 / productionFactor(tp)) + ' %';
    const t = Math.floor(w.time);
    $('st-clock').textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  // ---------- Minikarte ----------
  drawMinimap() {
    const w = this.w, { w: mw, h: mh } = w.map;
    const g = this.mg;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.mmBase, 0, 0);
    // Gebietsfärbung
    g.globalAlpha = 0.28;
    const sec = w.map.sector;
    for (let y = 0; y < mh; y++) {
      let run = 0, startX = 0, cur = -1;
      for (let x = 0; x <= mw; x++) {
        const o = x < mw ? w.sectors[sec[y * mw + x]].owner : -1;
        if (o !== cur) {
          if (cur > 0) { g.fillStyle = TEAM_CSS[cur]; g.fillRect(startX, y, run, 1); }
          cur = o; startX = x; run = 0;
        }
        run++;
      }
    }
    g.globalAlpha = 1;
    // Nebel
    const vis = w.vis[1], exp = w.explored[1];
    const d = this.mmFogImg.data;
    for (let i = 0; i < mw * mh; i++) {
      d[i * 4 + 3] = vis[i] ? 0 : exp[i] ? 110 : 220;
      d[i * 4] = 8; d[i * 4 + 1] = 10; d[i * 4 + 2] = 14;
    }
    this.mmFog.getContext('2d').putImageData(this.mmFogImg, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.mmFog, 0, 0);
    // Gebäude
    for (const b of w.buildings) {
      if (!exp[Math.floor(b.cy) * mw + Math.floor(b.cx)]) continue;
      g.fillStyle = b.destroyed ? '#333' : TEAM_CSS[b.team];
      g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = '#000'; g.lineWidth = 0.25;
      g.strokeRect(b.x, b.y, b.w, b.h);
    }
    // Flaggen
    for (const s of w.sectors) {
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(s.x, s.y, 0.9, 0, 7); g.fill();
      g.fillStyle = TEAM_CSS[s.owner];
      g.beginPath(); g.arc(s.x, s.y, 0.6, 0, 7); g.fill();
    }
    // Einheiten
    for (const u of w.units) {
      if (u.dead) continue;
      if (u.team !== 1 && !w.isVisible(1, u.x, u.y)) continue;
      g.fillStyle = u.team === 1 ? '#7cc4ff' : u.team === 2 ? '#ff6a5a' : '#bbb';
      const s = u.cls === 'vehicle' ? 1.3 : 0.9;
      g.fillRect(u.x - s / 2, u.y - s / 2, s, s);
    }
    // Sichtbereich der Kamera
    const pts = [[0, 44], [window.innerWidth, 44], [window.innerWidth, window.innerHeight], [0, window.innerHeight]].map(([x, y]) => this.r.screenToTile(x, y));
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1 / this.mmScale;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.stroke();
  }

  // ---------- Panel ----------
  updatePanel(selection) {
    const w = this.w;
    const objs = [...selection].map((id) => w.byId.get(id)).filter((o) => o && !o.dead && (o.kind === 'unit' || !o.destroyed || true));
    let key = objs.map((o) => o.id + ':' + o.team + (o.kind === 'building' ? (o.produce || '-') + o.destroyed : '')).join(',');
    if (key !== this.panelKey) {
      this.panelKey = key;
      this.buildPanel(objs);
    }
    // laufende Werte
    for (const el of this.panel.querySelectorAll('[data-hp]')) {
      const o = w.byId.get(+el.dataset.hp);
      if (!o) continue;
      const f = Math.max(0, o.hp / o.maxHp);
      el.firstChild.style.width = f * 100 + '%';
      el.firstChild.style.background = f > 0.6 ? 'var(--ok)' : f > 0.3 ? 'var(--warn)' : 'var(--enemy)';
    }
    for (const el of this.panel.querySelectorAll('[data-hptext]')) {
      const o = w.byId.get(+el.dataset.hptext);
      if (o) el.textContent = `${Math.ceil(o.hp)} / ${o.maxHp}`;
    }
    for (const el of this.panel.querySelectorAll('.pbtn')) {
      const b = w.byId.get(+el.dataset.b);
      const prog = el.querySelector('.prog');
      if (b && b.produce === el.dataset.type) prog.style.width = b.progress * 100 + '%';
      else prog.style.width = '0';
      const t = el.querySelector('.t');
      if (b && el.dataset.type) {
        const time = UNITS[el.dataset.type].build * productionFactor(w.territory(b.team));
        t.textContent = Math.round(time) + ' s';
      }
    }
    const blk = this.panel.querySelector('.blocked');
    if (blk) {
      const b = w.byId.get(+blk.dataset.b);
      blk.hidden = !(b && b.blocked);
    }
  }

  buildPanel(objs) {
    const p = this.panel;
    p.innerHTML = '';
    if (!objs.length) return;
    const img = (key) => this.icons[key] ? `<img src="${this.icons[key]}" alt="">` : '';
    if (objs.length === 1) {
      const o = objs[0];
      const teamName = o.team === 1 ? 'Eigene Einheit' : o.team === 2 ? 'Feind' : 'Herrenlos';
      if (o.kind === 'unit') {
        const d = UNITS[o.type];
        const extra = o.team === 0 ? '<p class="desc" style="color:var(--warn)">Herrenlos – einen Roboter auswählen und per Rechtsklick einsteigen lassen.</p>' : '';
        p.innerHTML = `<div class="icon">${img(o.type)}</div>
          <div><h3>${d.name} <span class="muted" style="font-size:12px;font-weight:400">· ${teamName}</span></h3>
          <p class="desc">${d.desc}</p>${extra}
          <div class="hpbar" data-hp="${o.id}"><div></div></div>
          <div class="kv" style="margin-top:6px"><span>Struktur</span><span data-hptext="${o.id}"></span>
          <span>Reichweite</span><span>${weaponRange(d)}</span><span>Panzerung</span><span>${armorName(d.armor)}</span></div></div>`;
      } else {
        const d = BUILDINGS[o.type];
        let html = `<div class="icon">${img('b_' + o.type)}</div><div style="flex:1"><h3>${d.name}${o.destroyed ? ' (zerstört)' : ''} <span class="muted" style="font-size:12px;font-weight:400">· ${o.team === 1 ? 'Eigenes Gebäude' : o.team === 2 ? 'Feind' : 'Neutral'}</span></h3>
          <p class="desc">${d.desc}</p>
          <div class="hpbar" data-hp="${o.id}"><div></div></div>`;
        if (d.produces && o.team === 1 && !o.destroyed) {
          html += '<div class="prodgrid">';
          for (const t of d.produces) {
            html += `<button class="pbtn ${o.produce === t ? 'on' : ''}" data-b="${o.id}" data-type="${t}" title="${UNITS[t].desc}">${img(t)}<span>${UNITS[t].name}</span><span class="t"></span><span class="prog"></span></button>`;
          }
          html += `<button class="pbtn ${o.produce ? '' : 'on'}" data-b="${o.id}" data-type="" title="Produktion anhalten"><span style="font-size:28px;line-height:52px">❚❚</span><span>Anhalten</span><span class="t"></span><span class="prog"></span></button>`;
          html += '</div><p class="desc blocked" data-b="' + o.id + '" style="color:var(--warn)" hidden>Einheitenlimit erreicht.</p><p class="desc" style="margin:4px 0 0">Rechtsklick auf das Gelände setzt den Sammelpunkt.</p>';
        } else if (d.produces && o.team === 0) {
          html += '<p class="desc" style="color:var(--warn)">Erobern Sie die Flagge dieses Sektors, um das Werk zu übernehmen.</p>';
        }
        html += '</div>';
        p.innerHTML = html;
        for (const btn of p.querySelectorAll('.pbtn')) {
          btn.addEventListener('click', () => this.onPanel?.('produce', +btn.dataset.b, btn.dataset.type || null));
          // Zeitangabe für Anhalten-Button leer
        }
      }
      return;
    }
    // Mehrfachauswahl
    const groups = new Map();
    for (const o of objs) {
      if (o.kind !== 'unit') continue;
      groups.set(o.type, (groups.get(o.type) || 0) + 1);
    }
    let html = `<div style="flex:1"><h3>${objs.length} Einheiten</h3><p class="desc">Klick auf ein Symbol wählt nur diesen Typ.</p><div class="groupgrid">`;
    for (const [t, n] of groups) html += `<button class="gbtn" data-type="${t}" title="${UNITS[t].name}">${img(t)}<span>${n}</span></button>`;
    html += '</div></div>';
    p.innerHTML = html;
    for (const btn of p.querySelectorAll('.gbtn')) btn.addEventListener('click', () => this.onPanel?.('subselect', btn.dataset.type));
  }

  // ---------- Overlay ----------
  drawOverlay(selection, box, hoverId, alpha) {
    const g = this.og;
    g.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const w = this.w;
    const bar = (x, y, wd, f, col) => {
      g.fillStyle = 'rgba(0,0,0,0.65)';
      g.fillRect(x - wd / 2 - 1, y - 1, wd + 2, 5);
      g.fillStyle = col || (f > 0.6 ? '#66ffa0' : f > 0.3 ? '#ffb347' : '#ff4532');
      g.fillRect(x - wd / 2, y, wd * f, 3);
    };
    const zoom = 42 / this.r.cam.dist;
    for (const u of w.units) {
      if (u.dead || !u.team) continue;
      const show = selection.has(u.id) || u.hp < u.maxHp || hoverId === u.id;
      if (!show) continue;
      if (u.team !== 1 && !w.isVisible(1, u.x, u.y)) continue;
      const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
      const [sx, sy, sz] = this.r.tileToScreen(x, y, u.cls === 'robot' ? 2.4 : 2.2);
      if (sz > 1) continue;
      bar(sx, sy, (u.cls === 'robot' ? 22 : 34) * Math.min(1.4, zoom), u.hp / u.maxHp, u.team === 2 && !selection.has(u.id) ? '#ff6a5a' : null);
    }
    for (const b of w.buildings) {
      if (b.destroyed) continue;
      const sel = selection.has(b.id);
      const [sx, sy, sz] = this.r.tileToScreen(b.cx, b.cy, b.type === 'fort' ? 5.5 : 4.2);
      if (sz > 1 || sx < -50 || sy < -50 || sx > window.innerWidth + 50 || sy > window.innerHeight + 50) continue;
      if (sel || b.hp < b.maxHp || hoverId === b.id) bar(sx, sy, 50 * Math.min(1.3, zoom), b.hp / b.maxHp);
      if (b.team === 1 && b.produce && b.def.produces) {
        bar(sx, sy + 7, 50 * Math.min(1.3, zoom), b.progress, '#2f9dff');
      }
      if (sel && b.rally && b.team === 1) {
        const [rx, ry] = this.r.tileToScreen(b.rally[0], b.rally[1], 0.1);
        const [bx, by] = this.r.tileToScreen(b.cx, b.y + b.h, 0.2);
        g.strokeStyle = 'rgba(102,255,160,0.7)';
        g.setLineDash([6, 5]);
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(rx, ry); g.stroke();
        g.setLineDash([]);
        g.fillStyle = '#66ffa0';
        g.beginPath(); g.arc(rx, ry, 4, 0, 7); g.fill();
      }
    }
    // Wegziele der Auswahl
    g.strokeStyle = 'rgba(102,255,160,0.35)';
    g.lineWidth = 1;
    for (const id of selection) {
      const u = w.byId.get(id);
      if (!u || u.kind !== 'unit' || u.team !== 1 || !u.path || u.pi >= u.path.length) continue;
      if (u.order.kind === 'idle') continue;
      const goal = u.path[u.path.length - 1];
      const [ax, ay] = this.r.tileToScreen(u.x, u.y, 0.1);
      const [bx, by] = this.r.tileToScreen(goal[0], goal[1], 0.1);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    }
    if (box) {
      g.strokeStyle = '#66ffa0';
      g.lineWidth = 1;
      g.fillStyle = 'rgba(102,255,160,0.08)';
      const x = Math.min(box[0], box[2]), y = Math.min(box[1], box[3]);
      const bw = Math.abs(box[2] - box[0]), bh = Math.abs(box[3] - box[1]);
      g.fillRect(x, y, bw, bh);
      g.strokeRect(x + 0.5, y + 0.5, bw, bh);
    }
  }
}

function weaponRange(d) {
  const wpn = { rifle: 5, grenade: 5.5, bazooka: 6, longrifle: 9, mg: 5.5, cannon: 6.5, twincannon: 7, salvo: 11 }[d.weapon];
  return wpn ? `${wpn} Felder` : '–';
}

function armorName(a) {
  return { light: 'leicht', medium: 'mittel', heavy: 'schwer', structure: 'Gebäude' }[a];
}
