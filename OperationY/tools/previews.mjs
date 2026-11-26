// Rendert Vorschaubilder aller Level mit der Spiel-Engine und legt sie nach src/previews
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(pathToFileURL(join(root, 'dist/operation-y.html')).href);
await page.waitForFunction(() => window.game, null, { timeout: 120000 });
const lines = [];
for (let i = 0; i < 8; i++) {
  const url = await page.evaluate((k) => window.game.renderPreview(k), i);
  const file = `level${i + 1}.jpg`;
  writeFileSync(join(root, 'src/previews', file), Buffer.from(url.split(',')[1], 'base64'));
  lines.push(`import l${i + 1} from './${file}';`);
  console.log('Vorschau', i + 1);
}
lines.push(`export default { ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${n}: l${n}`).join(', ')} };`);
writeFileSync(join(root, 'src/previews/index.js'), lines.join('\n') + '\n');
await browser.close();
