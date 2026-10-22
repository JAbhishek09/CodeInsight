/**
 * customize.mjs — point a copy of the extension at a deployed CodeInsight.
 * Shared by package.mjs (writes a folder) and the backend's download
 * endpoint (serves a zip).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The extension's source folder. */
export const EXTENSION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every file students need, as posix-style relative path → contents. */
export function readExtensionFiles(root = EXTENSION_ROOT) {
  const files = new Map();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (rel === 'scripts' || rel === 'README.md') continue;
      if (entry.isDirectory()) walk(full);
      else files.set(rel, fs.readFileSync(full));
    }
  };
  walk(root);
  return files;
}

/** https origin of a URL (localhost may use http). */
export function originOf(value, name = 'url') {
  let u;
  try { u = new URL(value); } catch { throw new Error(`--${name} must be a full URL, e.g. https://codeinsight.example.com`); }
  if (u.protocol !== 'https:' && u.hostname !== 'localhost') throw new Error(`--${name} must use https`);
  return u.origin;
}

/**
 * Rewrite the files in place so the extension talks to `api` and its popup
 * links to `app`. Throws if a file no longer has the expected text.
 */
export function customize(files, { api, app = api }) {
  const local = /^http:\/\/localhost/.test(api);
  const rewrite = (file, fn) => {
    const before = files.get(file)?.toString('utf8');
    if (before == null) throw new Error(`${file} is missing from the extension`);
    const after = fn(before);
    if (after === before && !local) throw new Error(`Nothing to change in ${file} — has it moved?`);
    files.set(file, Buffer.from(after, 'utf8'));
  };

  rewrite('manifest.json', (s) => {
    const m = JSON.parse(s);
    m.host_permissions = ['https://leetcode.com/*', `${api}/*`];
    return `${JSON.stringify(m, null, 2)}\n`;
  });
  rewrite('src/background.js', (s) => s.replace(/DEFAULT_API_BASE:(\s*)'http:\/\/localhost:5000'/, `DEFAULT_API_BASE:$1'${api}'`));
  rewrite('popup/popup.html', (s) => s
    .replaceAll('http://localhost:5173', app)
    .replace('placeholder="http://localhost:5000" value="http://localhost:5000"', `placeholder="${api}" value="${api}"`));

  // A localhost build only rewrites to itself, which is fine.
  if (!local) {
    const left = ['manifest.json', 'src/background.js', 'popup/popup.html']
      .filter((f) => /localhost:(5000|5173)/.test(files.get(f).toString('utf8')));
    if (left.length) throw new Error(`Still pointing at localhost: ${left.join(', ')}`);
  }
  return files;
}
