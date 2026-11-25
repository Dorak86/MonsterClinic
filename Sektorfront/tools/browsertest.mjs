// Browsertest: lädt das Spiel, startet Level, prüft Konsolenfehler, macht Screenshots
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.SHOTS || join(root, 'dist/shots');
mkdirSync(outDir, { recursive: true });
const levels = (process.env.LEVELS || '1').split(',').map(Number);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(pathToFileURL(join(root, 'dist/sektorfront.html')).href);
await page.waitForTimeout(4000);
await page.screenshot({ path: join(outDir, 'menu.png') });
for (const lv of levels) {
  await page.evaluate((i) => window.game.start(i - 1, 1, true), lv);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(outDir, `level${lv}-start.png`) });
  // Spieler-KI übernimmt, Simulation vorspulen
  await page.evaluate((steps) => {
    const g = window.game;
    const AI = g.ais[0].constructor;
    g.ais.push(new AI(g.world, 1, 1));
    for (let i = 0; i < steps && !g.world.over; i++) {
      for (const ai of g.ais) ai.update(0.05);
      g.world.step();
      g.handleEvents();
    }
  }, +(process.env.FAST || 2400));
  // Kamera auf Kampfgeschehen
  await page.evaluate(() => {
    const g = window.game, w = g.world;
    const e = w.units.filter((u) => u.team === 1 && !u.dead && u.target && u.cls === 'vehicle');
    const e2 = w.units.filter((u) => u.team === 1 && !u.dead && u.target);
    const u = e[0] || e2[0] || w.units.find((u) => u.team === 1 && !u.dead);
    if (u) g.renderer.lookAt(u.x, u.y, true);
    g.renderer.cam.tdist = 30; g.renderer.cam.dist = 30; g.world.vis[1].fill(1);
    g.selection.clear(); for (const x of w.units.filter((x) => x.team === 1).slice(0, 6)) g.selection.add(x.id);
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(outDir, `level${lv}-battle.png`) });
  const info = await page.evaluate(() => {
    const w = window.game.world;
    return { time: w.time.toFixed(0), units: [w.countUnits(1), w.countUnits(2)], over: w.over, fps: 0 };
  });
  console.log('Level', lv, JSON.stringify(info));
}
// FPS messen
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
console.log('FPS (Software-Rendering):', fps.toFixed(1));
console.log(errors.length ? errors.slice(0, 30).join('\n') : 'Keine Konsolenfehler');
await browser.close();
