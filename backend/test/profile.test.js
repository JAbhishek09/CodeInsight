import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

let server;
let baseUrl;
let user;
let token;

const put = async (body, auth = true) => {
  const res = await fetch(`${baseUrl}/api/auth/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

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
beforeEach(async () => {
  await clearDb();
  user = await User.create({ name: 'Old Name', email: 'p@example.com', password: 'secret123', targetDailySolved: 1 });
  token = generateToken(user._id.toString());
});

describe('PUT /api/auth/profile', () => {
  test('updates name and daily goal, never returns the password', async () => {
    const r = await put({ name: '  New Name  ', targetDailySolved: 3 });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.name, 'New Name');
    assert.equal(r.body.data.targetDailySolved, 3);
    assert.equal('password' in r.body.data, false);
    const saved = await User.findById(user._id);
    assert.equal(saved.targetDailySolved, 3);
  });

  test('rejects bad values and empty updates', async () => {
    assert.equal((await put({ targetDailySolved: 0 })).status, 400);
    assert.equal((await put({ targetDailySolved: 2.5 })).status, 400);
    assert.equal((await put({ targetDailySolved: 21 })).status, 400);
    assert.equal((await put({ name: '   ' })).status, 400);
    assert.equal((await put({ name: 'x'.repeat(51) })).status, 400);
    assert.equal((await put({})).status, 400);
  });

  test('cannot change other fields like email', async () => {
    await put({ name: 'Ok', email: 'hacker@example.com' });
    const saved = await User.findById(user._id);
    assert.equal(saved.email, 'p@example.com');
  });

  test('requires auth', async () => {
    assert.equal((await put({ name: 'x' }, false)).status, 401);
  });
});
