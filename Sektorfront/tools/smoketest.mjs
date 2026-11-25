// Rauchtest: KI gegen KI auf jedem Level, prüft Fehler, Erreichbarkeit und Spielende
import { World } from '../src/sim/world.js';
import { AI } from '../src/sim/ai.js';
import { LEVELS } from '../src/sim/levels.js';
import { SIM_DT } from '../src/sim/defs.js';
import { findPath } from '../src/sim/path.js';

const maxMinutes = +(process.env.MINUTES || 25);
let failed = 0;
for (const level of LEVELS) {
  const t0 = Date.now();
  const w = new World(level, { difficulty: 1 });
  // Erreichbarkeit: jede Flagge vom Spielerfort aus für Fahrzeuge
  const fort = w.buildings.find((b) => b.type === 'fort' && b.team === 1);
  const unreachable = [];
  for (const s of w.sectors) {
    const p = findPath(w.map, fort.cx, fort.y + fort.h + 1, s.x - 0.5, s.y - 0.5, 'vehicle', 20000);
    const last = p && p[p.length - 1];
    if (!last || Math.hypot(last[0] - s.x, last[1] - s.y) > 2.5) unreachable.push(s.id);
  }
  const a1 = new AI(w, 1, 1), a2 = new AI(w, 2, 1);
  let steps = 0;
  const maxSteps = (maxMinutes * 60) / SIM_DT;
  try {
    while (!w.over && steps < maxSteps) {
      a1.update(SIM_DT); a2.update(SIM_DT);
      w.step();
      w.drainEvents();
      steps++;
    }
  } catch (e) {
    console.error(`Level ${level.id}: FEHLER`, e);
    failed++;
    continue;
  }
  const res = w.over ? `Sieger ${w.over.winner} (${w.over.reason}) nach ${(w.time / 60).toFixed(1)} min` : 'kein Ende';
  const terr = `Gebiet ${Math.round(w.territory(1) * 100)}%/${Math.round(w.territory(2) * 100)}%`;
  console.log(`Level ${level.id} ${level.name.padEnd(14)} ${res.padEnd(34)} ${terr}  Einheiten ${w.countUnits(1)}/${w.countUnits(2)}  gebaut ${w.stats[1].built}/${w.stats[2].built}  ${Date.now() - t0}ms` + (unreachable.length ? `  UNERREICHBAR: ${unreachable}` : ''));
  if (unreachable.length) failed++;
}
if (failed) { console.error(`${failed} Level mit Problemen`); process.exit(1); }
console.log('Rauchtest bestanden');
