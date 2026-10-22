// Serving the built web app (SERVE_CLIENT=true). Runs in its own process, so
// the env set here is read when app.js loads.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-dist-'));
fs.mkdirSync(path.join(dist, 'assets'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><div id="root"></div><script type="module" src="/assets/index-NEW1.js"></script>');
fs.writeFileSync(path.join(dist, 'assets', 'index-NEW1.js'), 'console.log("new build")');
fs.writeFileSync(path.join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
process.env.SERVE_CLIENT = 'true';
process.env.CLIENT_DIST = dist;

let server;
let base;

before(async () => {
  const { default: app } = await import('../app.js');
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(dist, { recursive: true, force: true });
});

describe('serving the built app', () => {
  test('page routes get index.html, never cached, so a deploy shows up on the next load', async () => {
    for (const p of ['/', '/home', '/patterns/two-pointers', '/problems/6ad9be40d0e74d14873acabd']) {
      const res = await fetch(base + p);
      assert.equal(res.status, 200, p);
      assert.match(res.headers.get('content-type'), /text\/html/);
      assert.equal(res.headers.get('cache-control'), 'no-cache');
      assert.match(await res.text(), /index-NEW1\.js/);
    }
  });

  test('build files are served with a long, immutable cache', async () => {
    const res = await fetch(`${base}/assets/index-NEW1.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
    assert.match(res.headers.get('cache-control'), /max-age=31536000.*immutable/);
  });

  test("an old build's file is a 404, not the app's HTML", async () => {
    // What an open tab asks for after a deploy replaced its build
    const res = await fetch(`${base}/assets/PatternDetailPage-OLD123.js`);
    assert.equal(res.status, 404);
    assert.doesNotMatch(res.headers.get('content-type'), /html/);
    assert.equal(await res.text(), 'Not found');
  });

  test('other missing files 404 too; root files and the API still work', async () => {
    assert.equal((await fetch(`${base}/missing-logo.png`)).status, 404);
    assert.equal((await fetch(`${base}/favicon.svg`)).status, 200);
    const api = await fetch(`${base}/api/nope`);
    assert.equal(api.status, 404);
    assert.match(api.headers.get('content-type'), /json/);
  });
});
