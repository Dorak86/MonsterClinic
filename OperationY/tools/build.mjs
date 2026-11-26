// Bündelt das Spiel zu einer einzigen, offline lauffähigen HTML-Datei
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');
const res = await build({
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  target: ['es2022'],
  write: false,
  legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const font = (w) => `@font-face{font-family:"Chakra Petch";font-weight:${w};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,${readFileSync(join(root, `src/fonts/chakra-petch-${w}.woff2`)).toString('base64')}) format("woff2")}`;
const css = readFileSync(join(root, 'src/style.css'), 'utf8').replace('/*__FONTS__*/', () => font(500) + font(700));
let html = readFileSync(join(root, 'src/index.html'), 'utf8');
html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist/operation-y.html');
writeFileSync(out, html);
console.log(`${out}  ${(html.length / 1024).toFixed(0)} KB`);
// Variante ohne Dokumentgerüst (für Plattformen, die es selbst ergänzen)
const artIdx = process.argv.indexOf('--artifact');
if (artIdx > 0) {
  const frag = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '')
    .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
    .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '')
    .replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '');
  writeFileSync(process.argv[artIdx + 1], frag);
  console.log('Fragment:', process.argv[artIdx + 1]);
}
