import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const res = await build({ entryPoints: ['tools/dev/robotview.js'], bundle: true, write: false, format: 'iife', loader: { '.glb': 'binary' } });
const S = process.argv[2];
writeFileSync(S + '/robotview.html', '<!doctype html><body style="margin:0"><script>' + res.outputFiles[0].text + '</script></body>');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 700 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => console.log('LOG', m.text().slice(0, 200)));
for (const [q, n] of [['clip=Fidget&t=1.8', 'veh']]) {
  await p.goto('file://' + S + '/robotview.html?' + q);
  await p.waitForFunction(() => window.READY, null, { timeout: 480000 });
  console.log(n, await p.evaluate(() => window.READY));
  await p.screenshot({ path: `${S}/rv-${n}.png` });
}
await b.close();
