/**
 * package.mjs — build a copy of the extension that talks to a deployed
 * CodeInsight instead of localhost. See docs/PILOT.md.
 *
 *   node extension/scripts/package.mjs --api https://codeinsight.example.com
 *   node extension/scripts/package.mjs --api https://api.example.com --app https://app.example.com
 *
 * --api   origin of the backend (required, https)
 * --app   origin of the web app, for the popup's link (defaults to --api, i.e.
 *         the backend serves the app with SERVE_CLIENT=true)
 * --out   output folder (default: extension-dist/)
 *
 * Output is an unpacked extension folder: zip it and send it to students,
 * who load it with chrome://extensions → Developer mode → Load unpacked.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

function origin(value, name) {
  let u;
  try { u = new URL(value); } catch { throw new Error(`--${name} must be a full URL, e.g. https://codeinsight.example.com`); }
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') throw new Error(`--${name} must use https`);
  return u.origin;
}

const api = origin(arg('api') ?? '', 'api');
const appUrl = origin(arg('app') ?? api, 'app');
const out = path.resolve(arg('out') ?? path.join(src, '..', 'extension-dist'));

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true, filter: (p) => !p.includes(`${path.sep}scripts`) && !p.endsWith('README.md') });

const rewrite = (file, fn) => {
  const p = path.join(out, file);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after === before) throw new Error(`Nothing to change in ${file} — has it moved?`);
  fs.writeFileSync(p, after);
};

rewrite('manifest.json', (s) => {
  const m = JSON.parse(s);
  m.host_permissions = ['https://leetcode.com/*', `${api}/*`];
  return `${JSON.stringify(m, null, 2)}\n`;
});
rewrite('src/background.js', (s) => s.replace(/DEFAULT_API_BASE:(\s*)'http:\/\/localhost:5000'/, `DEFAULT_API_BASE:$1'${api}'`));
rewrite('popup/popup.html', (s) => s
  .replaceAll('http://localhost:5173', appUrl)
  .replace('placeholder="http://localhost:5000" value="http://localhost:5000"', `placeholder="${api}" value="${api}"`));

const left = ['manifest.json', 'src/background.js', 'popup/popup.html']
  .filter((f) => /localhost:(5000|5173)/.test(fs.readFileSync(path.join(out, f), 'utf8')));
if (left.length) throw new Error(`Still pointing at localhost: ${left.join(', ')}`);

console.log(`Extension for ${api} written to ${out}`);
console.log('Zip that folder and share it with the students.');
