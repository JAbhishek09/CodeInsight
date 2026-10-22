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
 * Output is an unpacked extension folder. Students don't need it: the
 * deployed site serves the same thing as a zip (Profile → Connections →
 * Browser extension → Download). Use this for testing a build locally.
 */

import fs from 'node:fs';
import path from 'node:path';
import { EXTENSION_ROOT, customize, originOf, readExtensionFiles } from './customize.mjs';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };

try {
  const api = originOf(arg('api') ?? '', 'api');
  const app = originOf(arg('app') ?? api, 'app');
  const out = path.resolve(arg('out') ?? path.join(EXTENSION_ROOT, '..', 'extension-dist'));

  const files = customize(readExtensionFiles(), { api, app });
  fs.rmSync(out, { recursive: true, force: true });
  for (const [rel, data] of files) {
    const p = path.join(out, ...rel.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
  }
  console.log(`Extension for ${api} written to ${out}`);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
