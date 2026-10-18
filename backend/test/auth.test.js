import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

let server;
let baseUrl;

const call = async (method, path, body, token) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const register = (email) => call('POST', '/api/auth/register', { name: 'S', email, password: 'secret123' });
const login = (email, password = 'secret123') => call('POST', '/api/auth/login', { email, password });

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
beforeEach(clearDb);

describe('sign-up and sign-in', () => {
  test('emails are matched without regard to case or surrounding spaces', async () => {
    assert.equal((await register('Student.One@Example.com')).status, 201);
    assert.equal((await login('student.one@example.com')).status, 200);
    assert.equal((await login('  STUDENT.ONE@EXAMPLE.COM ')).status, 200);
    assert.equal((await register('student.one@example.com')).status, 400, 'same email, different case, is a duplicate');
  });

  test('common real-world addresses are accepted', async () => {
    for (const email of ['a+leetcode@gmail.com', 'first.last@college.academy', 'x@mail.school.info', 'o\'neil@uni.ac.in', 'a_b-c@sub-domain.example.io']) {
      const r = await register(email);
      assert.equal(r.status, 201, `${email}: ${r.body.message}`);
      assert.equal((await login(email)).status, 200, email);
    }
  });

  test('clearly invalid addresses are rejected', async () => {
    for (const email of ['no-at-sign', 'a@b', 'a @b.com', '@example.com']) {
      assert.equal((await register(email)).status, 400, email);
    }
  });

  test('wrong password and unknown email get the same 401', async () => {
    await register('s@example.com');
    const a = await login('s@example.com', 'nope12345');
    const b = await login('ghost@example.com');
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message);
  });
});

describe('session check (GET /api/auth/me)', () => {
  test('a valid token returns the user; bad, missing or orphaned tokens are 401', async () => {
    const user = await User.create({ name: 'S', email: 's@example.com', password: 'secret123' });
    const token = generateToken(user._id.toString());
    assert.equal((await call('GET', '/api/auth/me', null, token)).status, 200);
    assert.equal((await call('GET', '/api/auth/me', null, 'garbage')).status, 401);
    assert.equal((await call('GET', '/api/auth/me')).status, 401);
    await User.deleteOne({ _id: user._id });
    assert.equal((await call('GET', '/api/auth/me', null, token)).status, 401);
  });

  test('a database failure is a server error, not a sign-out', async () => {
    const user = await User.create({ name: 'S', email: 's@example.com', password: 'secret123' });
    const token = generateToken(user._id.toString());
    const original = User.findById;
    User.findById = () => { throw new Error('connection reset'); };
    try {
      const r = await call('GET', '/api/auth/me', null, token);
      assert.equal(r.status, 503);
    } finally {
      User.findById = original;
    }
  });
});
