import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import { startDb, stopDb } from './helpers.js';
import app from '../app.js';
import { createZip } from '../utils/zip.js';

let server;
let baseUrl;

/** Read a zip back: name → contents (checks each entry's CRC). */
function unzip(buf) {
  const out = new Map();
  let p = 0;
  while (buf.readUInt32LE(p) === 0x04034b50) {
    const method = buf.readUInt16LE(p + 8);
    const crc = buf.readUInt32LE(p + 14);
    const size = buf.readUInt32LE(p + 18);
    const nameLen = buf.readUInt16LE(p + 26);
    const extraLen = buf.readUInt16LE(p + 28);
    const name = buf.subarray(p + 30, p + 30 + nameLen).toString('utf8');
    const body = buf.subarray(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size);
    const data = method === 8 ? zlib.inflateRawSync(body) : Buffer.from(body);
    assert.equal(zlib.crc32(data), crc, `CRC of ${name}`);
    out.set(name, data);
    p += 30 + nameLen + extraLen + size;
  }
  assert.equal(buf.readUInt32LE(buf.length - 22), 0x06054b50, 'end of central directory');
  assert.equal(buf.readUInt16LE(buf.length - 22 + 10), out.size, 'entry count');
  return out;
}

before(async () => {
  await startDb();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await stopDb();
});

describe('zip writer', () => {
  test('round-trips stored and deflated entries', () => {
    const files = new Map([['a.txt', Buffer.from('x')], ['dir/b.txt', Buffer.from('hello '.repeat(200))]]);
    const back = unzip(createZip(files));
    assert.deepEqual([...back.keys()], ['a.txt', 'dir/b.txt']);
    assert.equal(back.get('dir/b.txt').toString(), 'hello '.repeat(200));
  });
});

describe('GET /api/extension/download', () => {
  test('serves the extension in one folder, pointed at this server, without signing in', async () => {
    const res = await fetch(`${baseUrl}/api/extension/download`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/zip');
    assert.match(res.headers.get('content-disposition'), /codeinsight-extension\.zip/);

    const files = unzip(Buffer.from(await res.arrayBuffer()));
    const names = [...files.keys()];
    assert.ok(names.every((n) => n.startsWith('codeinsight-extension/')), 'one top folder to pick in Load unpacked');
    for (const f of ['manifest.json', 'src/background.js', 'src/picker.js', 'popup/popup.html', 'popup/popup.js']) {
      assert.ok(files.has(`codeinsight-extension/${f}`), f);
    }
    assert.ok(!names.some((n) => n.includes('/scripts/') || n.endsWith('README.md')), 'no build scripts');

    const manifest = JSON.parse(files.get('codeinsight-extension/manifest.json'));
    assert.deepEqual(manifest.host_permissions, ['https://leetcode.com/*', `${baseUrl}/*`]);
    assert.match(files.get('codeinsight-extension/src/background.js').toString(), new RegExp(`DEFAULT_API_BASE:\\s*'${baseUrl}'`));
    assert.match(files.get('codeinsight-extension/popup/popup.html').toString(), new RegExp(`value="${baseUrl}"`));
  });
});
