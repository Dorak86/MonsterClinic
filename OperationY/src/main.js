// Einstieg: Menüs, Spielschleife, Speicherstand, Tutorial

import { World } from './sim/world.js';
import { AI } from './sim/ai.js';
import { LEVELS, BIOMES } from './sim/levels.js';
import { generateMap } from './sim/mapgen.js';
import { SIM_DT, T, UNITS, BUILDINGS } from './sim/defs.js';
import { Renderer } from './render/renderer.js';
import { loadRobotModels } from './render/models.js';
import PREVIEWS from './previews/index.js';
import { TILE } from './render/materials.js';
import { Hud } from './ui/hud.js';
import { Input } from './ui/input.js';
import { renderIcons } from './ui/icons.js';
import { Portrait } from './ui/portrait.js';
import { CAST, BRIEFINGS, EPILOGUE, OUTRO, RADIO, QUIPS, pick } from './story.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'operation-y.v1';
const OLD_SAVE_KEY = 'sektorfront.v1';

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || localStorage.getItem(OLD_SAVE_KEY) || '{}');
    return { unlocked: s.unlocked || 1, best: s.best || {}, options: { quality: 1, sfx: 0.7, music: 0.35, edge: true, ...(s.options || {}) } };
  } catch (e) {
    return { unlocked: 1, best: {}, options: { quality: 1, sfx: 0.7, music: 0.35, edge: true } };
  }
}
function storeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* privat */ }
}

const TIPS = [
  { text: 'Linksklick wählt eine Einheit, Ziehen mit gedrückter Maustaste wählt mehrere. Mit WASD, Mausrad und Q/E steuern Sie die Kamera.', done: (g) => g.selection.size > 0 },
  { text: 'Rechtsklick auf eine Flagge schickt Ihre Roboter dorthin. Ein Roboter auf der Flagge erobert den Sektor samt Gebäuden.', done: (g) => g.world.sectors.filter((s) => s.owner === 1).length >= 2 },
  { text: 'Sichern Sie das Roboterwerk im Norden. Klicken Sie es danach an und wählen Sie, was gebaut wird.', done: (g) => g.world.buildings.some((b) => b.type === 'robot' && b.team === 1) },
  { text: 'Mehr Gebiet bedeutet schnellere Produktion (Anzeige „Bautempo“ oben). Das Fahrzeugwerk in der Mitte liefert Panzer.', done: (g) => g.world.buildings.some((b) => b.type === 'vehicle' && b.team === 1) },
  { text: 'Einsatzziel: alle drei Fabriken und den Kontrollturm der Blauen im Nordosten einnehmen. Alternativ siegt, wer das feindliche Fort zerstört.', done: () => false },
];

class Game {
  constructor() {
    this.save = loadSave();
    this.options = this.save.options;
    this.audio = new Audio();
    this.audio.setVolumes(this.options.sfx, this.options.music);
    this.state = 'menu';
    this.selection = new Set();
    this.speed = 1;
    this.levelIndex = 0;
    this.difficulty = 1;
    this.prevScreen = 'menu';
    this.renderer = new Renderer($('gl'), this.options.quality);
    this.icons = renderIcons();
    this.faces = {};
    try {
      const fc = document.createElement('canvas');
      fc.width = fc.height = 112;
      const fp = new Portrait(fc, 112);
      for (const who of Object.keys(CAST)) this.faces[who] = fp.snapshot(who);
      fp.r.dispose();
    } catch (e) { console.warn('Portraits', e); }
    this.radioQ = [];
    this.radioT = 0;
    this.hud = new Hud(this.icons);
    this.input = new Input(this);
    this.hud.onMinimap = (kind, x, y) => {
      if (kind === 'look') this.renderer.lookAt(x, y);
      else if (kind === 'order') {
        const ids = [...this.selection].filter((id) => { const o = this.world.byId.get(id); return o && o.kind === 'unit' && o.team === 1; });
        if (ids.length) { this.world.commandMove(ids, x, y, 1, this.input.keys.has('KeyF')); this.audio.play('order'); }
      }
    };
    this.hud.onPanel = (kind, a, b) => {
      if (kind === 'produce') { this.world.setProduction(a, b, 1); this.audio.play('click'); }
      else if (kind === 'selectBuilding') {
        const b = this.world.byId.get(a);
        if (b) { this.selection.clear(); this.selection.add(a); this.renderer.lookAt(b.cx, b.cy + 2); this.audio.play('click'); }
      } else if (kind === 'unload') {
        this.world.commandUnload([a], 1); this.audio.play('order');
      } else if (kind === 'subselect') {
        for (const id of [...this.selection]) { const o = this.world.byId.get(id); if (!o || o.type !== a) this.selection.delete(id); }
      }
    };
    window.addEventListener('resize', () => { this.renderer.resize(); this.hud.resize(); });
    this.bindMenus();
    try { if (matchMedia('(pointer: coarse)').matches) $('touchnote').hidden = false; } catch (e) { /* egal */ }
    this.showScreen('menu');
    this.menuScene();
    this.last = performance.now();
    this.acc = 0;
    this.time = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------- Menüs ----------
  bindMenus() {
    document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      this.audio.init();
      this.audio.play('click');
      const to = b.dataset.go;
      if (to === 'help' || to === 'options') this.prevScreen = this.state === 'pause' ? 'pause' : 'menu';
      this.showScreen(to);
    }));
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
      this.audio.play('click');
      this.showScreen(this.prevScreen);
    }));
    $('br-dialog').addEventListener('click', () => {
      const d = this.dialog;
      if (d && !d.typing && d.i + 1 >= d.lines.length) {
        if (this.epilogMode) { this.epilogMode = false; $('br-start').hidden = false; $('br-diff').parentElement.hidden = false; this.showScreen('menu'); return; }
        $('br-start').click(); return;
      }
      this.dialogNext?.();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !$('scr-briefing').hidden) { e.preventDefault(); $('br-dialog').click(); }
    });
    $('br-start').addEventListener('click', () => { this.audio.init(); this.difficulty = +$('br-diff').value; this.start(this.levelIndex, this.difficulty, true); });
    $('pa-resume').addEventListener('click', () => this.togglePause());
    $('pa-restart').addEventListener('click', () => this.start(this.levelIndex, this.difficulty, this.campaign));
    $('pa-quit').addEventListener('click', () => this.toMenu());
    $('btn-pause').addEventListener('click', () => this.togglePause());
    $('btn-speed').addEventListener('click', () => this.setSpeed(this.speed === 1 ? 2 : 1));
    $('end-retry').addEventListener('click', () => this.start(this.levelIndex, this.difficulty, this.campaign));
    $('end-menu').addEventListener('click', () => this.toMenu());
    $('end-next').addEventListener('click', () => {
      if (this.levelIndex + 1 < LEVELS.length) this.briefing(this.levelIndex + 1);
      else this.epilogue();
    });
    $('tipclose').addEventListener('click', () => { this.tipsOff = true; $('tipbox').hidden = true; });
    // Optionen
    $('op-quality').value = String(this.options.quality);
    $('op-sfx').value = this.options.sfx;
    $('op-music').value = this.options.music;
    $('op-edge').checked = this.options.edge;
    const saveOpts = () => {
      this.options.quality = +$('op-quality').value;
      this.options.sfx = +$('op-sfx').value;
      this.options.music = +$('op-music').value;
      this.options.edge = $('op-edge').checked;
      this.audio.setVolumes(this.options.sfx, this.options.music);
      storeSave(this.save);
    };
    for (const id of ['op-quality', 'op-sfx', 'op-music', 'op-edge']) $(id).addEventListener('input', saveOpts);
  }

  showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== 'scr-' + name; });
    if (name !== 'briefing') { this.portrait?.stop(); clearInterval(this.typeTimer); }
    this.renderer.setMenuView?.(name === 'menu' && this.demo);
    if (name === 'campaign') this.buildCampaign();
    if (name === 'skirmish') this.buildSkirmish();
  }

  thumb(level) {
    const c = document.createElement('canvas');
    const map = generateMap(level);
    const s = 4;
    c.width = map.w * s; c.height = map.h * s;
    const g = c.getContext('2d');
    const b = map.biome;
    const col = { [T.GROUND]: b.ground[0], [T.ROAD]: b.road, [T.ROCK]: b.rock, [T.WATER]: b.lava ? 0xd24a10 : b.water, [T.FOREST]: b.forest, [T.BRIDGE]: 0x8a6a50 };
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      g.fillStyle = '#' + col[map.tiles[y * map.w + x]].toString(16).padStart(6, '0');
      g.fillRect(x * s, y * s, s, s);
    }
    for (const sp of map.buildingSpots) {
      const o = map.sectors[sp.sector].owner;
      g.fillStyle = o === 1 ? '#e5452f' : o === 2 ? '#3b8fff' : '#bfc6cc';
      g.fillRect(sp.x * s, sp.y * s, sp.w * s, sp.h * s);
    }
    for (const sec of map.sectors) {
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(sec.x * s, sec.y * s, 4, 0, 7); g.fill();
      g.fillStyle = sec.owner === 1 ? '#e5452f' : sec.owner === 2 ? '#3b8fff' : '#888';
      g.beginPath(); g.arc(sec.x * s, sec.y * s, 2.6, 0, 7); g.fill();
    }
    return c;
  }

  levelCard(level, i, onPick, locked) {
    const b = document.createElement('button');
    b.className = 'card' + (locked ? ' locked' : '');
    b.disabled = locked;
    const best = this.save.best[level.id];
    const img = PREVIEWS[level.id];
    b.innerHTML = `<div class="shot"${img ? ` style="background-image:url(${img})"` : ''}>
        <span class="num">${String(level.id).padStart(2, '0')}</span>
        ${locked ? '<span class="lock">Gesperrt</span>' : best ? `<span class="done">Bestzeit ${fmt(best)}</span>` : ''}
      </div>
      <div class="ci"><div class="cn">${level.name}</div><div class="cm">${level.place || BIOMES[level.biome].name}</div></div>`;
    if (!locked) b.addEventListener('click', () => { this.audio.init(); this.audio.play('click'); onPick(i); });
    return b;
  }

  // Vorschaubild eines Levels (wird beim Bauen erzeugt)
  renderPreview(i) {
    const level = LEVELS[i];
    this.demo = true;
    this.world = new World(level, { difficulty: 1 });
    this.ais = [new AI(this.world, 1, 1), new AI(this.world, 2, 1)];
    this.renderer.load(this.world);
    for (let k = 0; k < 520; k++) { for (const a of this.ais) a.update(0.05); this.world.step(); this.renderer.handleEvent && this.world.drainEvents().forEach((e) => this.renderer.handleEvent(e)); }
    this.world.vis[1].fill(1); this.world.explored[1].fill(1);
    this.renderer.setMenuView(false);
    const fort = this.world.buildings.find((b) => b.type === 'fort' && b.team === 1);
    const cx = this.world.map.w / 2, cy = this.world.map.h / 2;
    const fighters = this.world.units.filter((u) => !u.dead && u.target);
    const f = fighters[0];
    const tx = f ? f.x : fort.cx + (cx - fort.cx) * 0.4, ty = f ? f.y : fort.cy + (cy - fort.cy) * 0.4;
    this.renderer.lookAt(tx, ty, true);
    this.renderer.cam.yaw = 0.35;
    this.renderer.cam.dist = this.renderer.cam.tdist = 30;
    this.state = 'preview';
    for (let k = 0; k < 6; k++) this.renderer.frame(0.05, 1, new Set(), 10 + k * 0.05);
    const src = this.renderer.r.domElement;
    const c = document.createElement('canvas');
    c.width = 640; c.height = 360;
    const g = c.getContext('2d');
    const sw = src.width, sh = src.height, ar = 16 / 9;
    const cw = Math.min(sw, sh * ar), ch = cw / ar;
    g.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, 640, 360);
    return c.toDataURL('image/jpeg', 0.82);
  }

  buildCampaign() {
    const list = $('camp-list');
    list.innerHTML = '';
    LEVELS.forEach((l, i) => list.appendChild(this.levelCard(l, i, (k) => this.briefing(k), i + 1 > this.save.unlocked)));
  }

  buildSkirmish() {
    const list = $('sk-list');
    list.innerHTML = '';
    LEVELS.forEach((l, i) => list.appendChild(this.levelCard(l, i, (k) => this.start(k, +$('sk-diff').value, false), i + 1 > this.save.unlocked)));
  }

  briefing(i) {
    this.levelIndex = i;
    this.epilogMode = false;
    $('br-start').hidden = false;
    $('br-diff').parentElement.hidden = false;
    const l = LEVELS[i];
    $('br-title').textContent = `Einsatz ${l.id}: ${l.name}`;
    $('br-meta').textContent = `${BIOMES[l.biome].name} · ${l.w}×${l.h} Felder · ${l.sectors.length} Sektoren`;
    $('br-diff').value = String(this.difficulty);
    this.showScreen('briefing');
    if (!this.portrait) this.portrait = new Portrait($('portrait'));
    try { this.portrait.start(); } catch (e) { console.warn(e); }
    this.playDialog(BRIEFINGS[l.id] || [], () => {});
  }

  epilogue() {
    this.toMenu();
    $('br-title').textContent = 'Epilog: Krieg nur an Feiertagen';
    $('br-meta').textContent = 'Kampagne abgeschlossen · Der Krieg ist beendet';
    this.showScreen('briefing');
    $('br-start').hidden = true;
    $('br-diff').parentElement.hidden = true;
    this.epilogMode = true;
    try { this.portrait ??= new Portrait($('portrait')); this.portrait.start(); } catch (e) { console.warn(e); }
    this.playDialog(EPILOGUE, () => {});
  }

  // Dialog Zeile für Zeile; Klick oder Leertaste: Zeile vervollständigen bzw. weiter
  playDialog(lines, onEnd) {
    this.dialog = { lines, i: -1, onEnd };
    const next = () => {
      const d = this.dialog;
      if (!d) return;
      const el = $('br-text');
      if (d.typing) { clearInterval(this.typeTimer); d.typing = false; el.textContent = d.lines[d.i].text; return; }
      if (d.i + 1 >= d.lines.length) { $('br-next').textContent = 'Einsatz beginnen ▸'; d.onEnd?.(); return; }
      d.i++;
      const line = d.lines[d.i];
      const cast = CAST[line.who];
      $('br-name').textContent = cast.name;
      $('br-role').textContent = cast.role;
      $('br-dialog').classList.toggle('groll', CAST[line.who].side === 'blue');
      $('br-count').textContent = `${d.i + 1} / ${d.lines.length}`;
      $('br-next').textContent = d.i + 1 >= d.lines.length ? 'Einsatz beginnen ▸' : 'Weiter ▸';
      this.portrait?.setSpeaker(line.who);
      clearInterval(this.typeTimer);
      el.textContent = '';
      let n = 0;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = line.text; this.portrait?.speak(1.5); return; }
      d.typing = true;
      this.typeTimer = setInterval(() => {
        n += 2;
        el.textContent = line.text.slice(0, n);
        this.portrait?.speak(0.15);
        if (n >= line.text.length) { clearInterval(this.typeTimer); d.typing = false; }
      }, 26);
    };
    this.dialogNext = next;
    next();
  }

  // Hintergrund im Menü: langsam kreisende Kamera über Level 1 mit KI gegen KI
  menuScene() {
    this.world = new World(LEVELS[1], { difficulty: 1 });
    this.ais = [new AI(this.world, 1, 1), new AI(this.world, 2, 1)];
    this.renderer.load(this.world);
    this.world.vis[1].fill(1);
    this.world.explored[1].fill(1);
    this.demo = true;
    this.renderer.cam.tdist = 30;
    this.renderer.cam.dist = 30;
    this.renderer.lookAt(this.world.map.w / 2, this.world.map.h / 2, true);
    this.demoFocusT = 0;
    this.renderer.setMenuView(this.state === 'menu');
  }

  updateDemoCamera(dt) {
    this.demoFocusT -= dt;
    if (this.demoFocusT > 0) return;
    this.demoFocusT = 9;
    const w = this.world;
    const fighters = w.units.filter((u) => !u.dead && u.target);
    const pool = fighters.length ? fighters : w.units.filter((u) => !u.dead);
    const u = pool[Math.floor(Math.random() * pool.length)];
    if (u) this.renderer.lookAt(u.x, u.y);
    this.renderer.cam.tdist = 22 + Math.random() * 12;
  }

  // ---------- Spiel ----------
  start(i, difficulty, campaign) {
    this.showScreen('loading');
    setTimeout(() => {
      try {
        this.levelIndex = i;
        this.difficulty = difficulty;
        this.campaign = campaign;
        const level = LEVELS[i];
        this.renderer.quality = this.options.quality;
        this.world = new World(level, { difficulty });
        this.ais = [new AI(this.world, 2, difficulty)];
        this.renderer.load(this.world);
        this.hud.setWorld(this.world, this.renderer);
        this.selection.clear();
        this.input.groups = {};
        this.speed = 1;
        $('btn-speed').textContent = '1×';
        this.demo = false;
        this.renderer.setMenuView(false);
        this.renderer.cam.tdist = 34;
        this.acc = 0;
        this.ended = false;
        this.tipIdx = level.tips ? 0 : -1;
        this.tipsOff = false;
        $('tipbox').hidden = true;
        $('hud').hidden = false;
        this.showScreen('none');
        this.state = 'play';
        this.audio.init();
        this.audio.startMusic(i);
        this.hud.message(`Einsatz ${level.id}: ${level.name}`, 'info');
        this.radioQ = []; this.radioT = 1.5; $('radio').hidden = true;
        this.radio(RADIO.start);
        this.idleT = 60 + Math.random() * 40;
      } catch (e) {
        console.error(e);
        $('err-text').textContent = String(e && e.message || e);
        this.showScreen('error');
      }
    }, 30);
  }

  toMenu() {
    this.state = 'menu';
    $('hud').hidden = true;
    this.audio.stopMusic();
    this.selection.clear();
    this.hud.og.clearRect(0, 0, innerWidth, innerHeight);
    this.menuScene();
    this.showScreen('menu');
  }

  togglePause() {
    if (this.state === 'play') { this.state = 'pause'; this.showScreen('pause'); }
    else if (this.state === 'pause') { this.state = 'play'; this.showScreen('none'); }
  }

  setSpeed(s) {
    this.speed = s;
    $('btn-speed').textContent = s + '×';
  }

  radio(pool, chance = 1) {
    if (this.demo || Math.random() > chance) return;
    const line = Array.isArray(pool) ? pick(pool) : pool;
    if (this.radioQ.length > 2) return;
    if (this.radioQ.some((l) => l.text === line.text)) return;
    this.radioQ.push(line);
  }

  updateRadio(dt) {
    const box = $('radio');
    this.radioT -= dt;
    if (this.radioT > 0) return;
    if (!this.radioQ.length) { box.hidden = true; return; }
    const line = this.radioQ.shift();
    $('radio-face').src = this.faces[line.who] || '';
    $('radio-who').textContent = CAST[line.who].name;
    $('radio-text').textContent = line.text;
    box.classList.toggle('groll', CAST[line.who].side === 'blue');
    box.hidden = false;
    this.radioT = 3 + line.text.length * 0.045;
    this.audio.play('radio');
  }

  quip(id, kind) {
    const u = this.world.byId.get(id);
    if (!u || u.kind !== 'unit') return;
    const now = performance.now();
    if (now - (this.lastQuip || 0) < 900) return;
    this.lastQuip = now;
    const text = kind === 'select' ? pick(QUIPS.select[u.type] || QUIPS.move) : pick(QUIPS[kind] || QUIPS.move);
    this.hud.bubble(id, text);
  }

  handleEvents() {
    const w = this.world;
    for (const ev of w.drainEvents()) {
      this.renderer.handleEvent(ev);
      if (this.demo) continue;
      const vis = (x, y) => w.isVisible(1, x, y);
      switch (ev.t) {
        case 'shot': if (vis(ev.x, ev.y)) this.audio.play(ev.proj.wpn.sound, ev.x, ev.y, 0.8); break;
        case 'impact': if (vis(ev.x, ev.y) && ev.splash > 0.5) this.audio.play('explode', ev.x, ev.y, 0.5); break;
        case 'death':
          if (vis(ev.x, ev.y)) this.audio.play(ev.cls === 'vehicle' ? 'explode' : 'thump', ev.x, ev.y, ev.cls === 'vehicle' ? 1 : 0.5);
          this.selection.delete(ev.id);
          break;
        case 'bdestroy':
          this.audio.play('bigexplode', ev.x, ev.y, 1.2);
          this.hud.message(`${BUILDINGS[ev.type].name} ${ev.team === 1 ? 'verloren' : 'zerstört'}`, ev.team === 1 ? 'bad' : 'good', ev.x, ev.y);
          this.radio(ev.team === 1 ? RADIO.ownDestroy : RADIO.bdestroy, 0.9);
          break;
        case 'capture': {
          const s = w.sectors[ev.sector];
          const names = s.buildings.map((id) => w.byId.get(id)).filter((b) => b && !b.destroyed).map((b) => b.def.name);
          const what = names.length ? ` (${names.join(', ')})` : '';
          const factory = s.buildings.some((id) => { const b = w.byId.get(id); return b && !b.destroyed && b.def.produces && b.type !== 'fort'; });
          if (ev.team === 1) { this.audio.play('capture'); this.hud.message(`Sektor erobert${what}`, 'good', ev.x, ev.y); this.radio(factory ? RADIO.factory : RADIO.capture, factory ? 1 : 0.4); }
          else if (ev.prev === 1) { this.audio.play('lost'); this.hud.message(`Sektor verloren${what}!`, 'bad', ev.x, ev.y); this.radio(RADIO.lost, 0.8); }
          else { if (names.length) this.hud.message(`Gegner übernimmt ${names.join(', ')}`, 'bad', ev.x, ev.y); this.radio(RADIO.enemyCapture, 0.25); }
          break;
        }
        case 'underattack':
          if (ev.team === 1) { this.audio.play('alarm'); this.hud.message(`${ev.what} unter Beschuss`, 'bad', ev.x, ev.y); this.radio(RADIO.attacked, 0.5); }
          break;
        case 'spawn':
          if (ev.team === 1) { this.audio.play('spawn', ev.x, ev.y, 0.6); }
          break;
        case 'board':
          if (ev.team === 1) { this.audio.play('board'); this.hud.message('Fahrzeug übernommen', 'good', ev.x, ev.y); this.radio(RADIO.board); }
          else { this.hud.message('Gegner übernimmt ein herrenloses Fahrzeug', 'bad', ev.x, ev.y); this.radio(RADIO.enemyBoard, 0.6); }
          break;
        case 'driverKilled':
          if (ev.by === 1) { this.hud.message(ev.turret ? 'Geschützschütze ausgeschaltet – Geschütz kapern!' : 'Fahrer ausgeschaltet – Fahrzeug kapern!', 'good', ev.x, ev.y); this.radio(RADIO.driverKilled, 0.8); }
          else if (ev.by === 2) { this.hud.message(ev.turret ? 'Unser Geschützschütze wurde getroffen' : 'Ein Fahrer wurde ausgeschaltet', 'bad', ev.x, ev.y); this.radio(RADIO.driverLost, 0.6); }
          this.audio.play('sniper', ev.x, ev.y, 0.8);
          break;
        case 'barrel':
          this.audio.play('bigexplode', ev.x, ev.y, 1);
          if (vis(ev.x, ev.y)) this.radio(RADIO.barrel, 0.3);
          break;
        case 'bridge':
          if (ev.destroyed) { this.audio.play('bigexplode', ev.x, ev.y, 1.2); this.hud.message('Brücke gesprengt', 'bad', ev.x, ev.y); this.radio(RADIO.bridgeDown, 0.8); }
          else { this.audio.play('capture'); this.hud.message('Brücke repariert', 'good', ev.x, ev.y); if (ev.team === 1) this.radio(RADIO.bridgeUp, 0.8); }
          break;
        case 'embark':
          if (ev.team === 1) this.audio.play('board', ev.x, ev.y, 0.7);
          break;
        case 'disembark':
          if (ev.team === 1) { this.audio.play('order'); if (ev.ids[0]) this.hud.bubble(ev.ids[0], pick(QUIPS.disembark)); }
          break;
        case 'impatient':
          if (ev.team === 1) { this.hud.bubble(ev.id, pick(QUIPS.impatient)); }
          break;
        case 'eject':
          if (ev.team === 1) this.radio(RADIO.eject, 0.3);
          break;
        case 'gameover':
          this.endGame(ev);
          break;
      }
    }
  }

  endGame(ev) {
    if (this.ended) return;
    this.ended = true;
    const win = ev.winner === 1;
    const w = this.world;
    const level = LEVELS[this.levelIndex];
    if (win) {
      if (this.campaign || true) this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, level.id + 1));
      const prev = this.save.best[level.id];
      if (!prev || w.time < prev) this.save.best[level.id] = Math.floor(w.time);
      storeSave(this.save);
    }
    setTimeout(() => {
      this.state = 'end';
      this.audio.stopMusic();
      this.audio.play(win ? 'capture' : 'lost');
      $('end-title').textContent = win ? 'Sieg' : 'Niederlage';
      $('end-title').className = win ? 'win' : 'lose';
      const reasons = {
        fort: win ? 'Das feindliche Fort wurde zerstört.' : 'Ihr Fort wurde zerstört.',
        flag: win ? 'Die Flagge des feindlichen Forts ist in Ihrer Hand.' : 'Der Feind hat die Flagge Ihres Forts erobert.',
        goal: 'Einsatzziel erfüllt: ' + (level.goal?.text || '') + '.',
        annihilation: win ? 'Der Gegner hat keine Einheiten und keine Fabriken mehr.' : 'Sie haben keine Einheiten und keine Fabriken mehr.',
      };
      $('end-reason').textContent = reasons[ev.reason] + ' Spielzeit ' + fmt(w.time) + '.';
      const s1 = w.stats[1], s2 = w.stats[2];
      $('end-stats').innerHTML = `<tr><th></th><th class="p">Sie</th><th class="e">Gegner</th></tr>
        <tr><td>Einheiten gebaut</td><td>${s1.built}</td><td>${s2.built}</td></tr>
        <tr><td>Einheiten verloren</td><td>${s1.lost}</td><td>${s2.lost}</td></tr>
        <tr><td>Abschüsse</td><td>${s1.kills}</td><td>${s2.kills}</td></tr>
        <tr><td>Sektoren erobert</td><td>${s1.captures}</td><td>${s2.captures}</td></tr>
        <tr><td>Gebiet am Ende</td><td>${Math.round(w.territory(1) * 100)} %</td><td>${Math.round(w.territory(2) * 100)} %</td></tr>`;
      const last = this.levelIndex + 1 >= LEVELS.length;
      $('end-next').hidden = !win || (last && !this.campaign);
      $('end-next').textContent = last ? 'Epilog ansehen' : 'Nächster Einsatz';
      const q = pick(win ? OUTRO.win : OUTRO.lose)[0];
      $('end-face').src = this.faces[q.who] || '';
      $('end-who').textContent = CAST[q.who].name;
      $('end-text').textContent = q.text;
      $('end-quote').classList.toggle('groll', CAST[q.who].side === 'blue');
      $('radio').hidden = true;
      this.showScreen('end');
    }, 2500);
  }

  updateTips() {
    if (this.tipIdx < 0 || this.tipsOff) return;
    const tip = TIPS[this.tipIdx];
    if (!tip) { $('tipbox').hidden = true; return; }
    if (tip.done(this)) { this.tipIdx++; return; }
    $('tipbox').hidden = false;
    $('tiptext').textContent = tip.text;
  }

  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    this.time += dt;
    if (!this.world) return;
    const running = this.state === 'play' || (this.state === 'menu' && this.demo) || (this.state === 'end');
    if (running) {
      this.acc += dt * (this.demo ? 1 : this.speed);
      let steps = 0;
      while (this.acc >= SIM_DT && steps < 8) {
        for (const ai of this.ais) ai.update(SIM_DT);
        this.world.step();
        this.acc -= SIM_DT;
        steps++;
        if (this.demo && this.world.over) { this.menuScene(); break; }
      }
      if (steps >= 8) this.acc = 0;
      this.handleEvents();
    }
    if (this.demo) {
      this.renderer.cam.yaw += dt * 0.05;
      this.updateDemoCamera(dt);
      this.world.vis[1].fill(1);
    }
    this.input.update(dt);
    // Hörerposition
    this.audio.listener.x = this.renderer.cam.x / TILE;
    this.audio.listener.y = this.renderer.cam.z / TILE;
    this.audio.listener.zoom = this.renderer.cam.dist / 42;
    const alpha = Math.min(1, this.acc / SIM_DT);
    for (const id of [...this.selection]) { const o = this.world.byId.get(id); if (!o || o.dead) this.selection.delete(id); }
    this.renderer.frame(dt, running ? alpha : 1, this.demo ? new Set() : this.selection, this.time);
    if (!this.demo && (this.state === 'play' || this.state === 'pause')) {
      this.hudT = (this.hudT || 0) - dt;
      if (this.hudT <= 0) {
        this.hudT = 0.2;
        this.hud.updateTop();
        this.hud.drawMinimap();
        this.hud.updateFactories();
        this.updateTips();
      }
      if (this.state === 'play') {
        this.updateRadio(dt);
        this.idleT -= dt * this.speed;
        if (this.idleT <= 0) { this.idleT = 70 + Math.random() * 50; this.radio(RADIO.idle); }
      }
      this.hud.updatePanel(this.selection);
      this.hud.drawOverlay(this.selection, this.input.box, this.input.hoverId, alpha);
    }
  }
}

function fmt(s) {
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function boot() {
  try {
    const test = document.createElement('canvas').getContext('webgl2');
    if (!test) throw new Error('WebGL2 wird von diesem Browser nicht unterstützt.');
    await loadRobotModels();
    window.game = new Game();
  } catch (e) {
    console.error(e);
    document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== 'scr-error'; });
    $('err-text').textContent = String(e && e.message || e);
  }
}
boot();

export { UNITS };
