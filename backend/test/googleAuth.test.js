import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import { __setGoogleVerifierForTests } from '../utils/googleIdToken.js';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
let server;
let baseUrl;
let checked; // what the stub was asked to verify

// Stand-in for Google: tokens are 'good:<sub>:<email>[:unverified]'; anything else is rejected
const fakeGoogle = async (idToken, audience) => {
  checked = { idToken, audience };
  const [kind, sub, email, flag] = idToken.split(':');
  if (kind !== 'good' || audience !== CLIENT_ID) throw new Error('Invalid token');
  return { sub, email, email_verified: flag !== 'unverified', name: 'Riya Sharma' };
};

const call = async (method, path, body, token) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const google = (credential, extra = {}) => call('POST', '/api/auth/google', { credential, ...extra });

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
  await User.syncIndexes();
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
  delete process.env.PILOT_INVITE_CODE;
  __setGoogleVerifierForTests(fakeGoogle);
});
afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.PILOT_INVITE_CODE;
});

describe('POST /api/auth/google', () => {
  test('a new Google user gets an account without a password, checked against our client ID', async () => {
    const { status, body } = await google('good:g-1:Riya@Example.com', { targetDailySolved: 3 });
    assert.equal(status, 201);
    assert.equal(checked.audience, CLIENT_ID);
    assert.equal(body.data.email, 'riya@example.com');
    assert.equal(body.data.name, 'Riya Sharma');
    assert.equal(body.data.targetDailySolved, 3);
    assert.ok(body.data.token);

    const user = await User.findOne({ email: 'riya@example.com' }).select('+password').lean();
    assert.equal(user.googleId, 'g-1');
    assert.equal(user.password, undefined);
    assert.equal((await call('GET', '/api/auth/me', null, body.data.token)).status, 200);

    // Signing in again finds the same account
    const again = await google('good:g-1:riya@example.com');
    assert.equal(again.status, 200);
    assert.equal(again.body.data._id, body.data._id);
    assert.equal(await User.countDocuments(), 1);
  });

  test('an existing email account is signed in and linked; its password still works', async () => {
    const reg = await call('POST', '/api/auth/register', { name: 'S', email: 'riya@example.com', password: 'secret123' });
    const { status, body } = await google('good:g-1:riya@example.com');
    assert.equal(status, 200);
    assert.equal(body.data._id, reg.body.data._id);
    assert.equal((await User.findById(reg.body.data._id).lean()).googleId, 'g-1');
    assert.equal((await call('POST', '/api/auth/login', { email: 'riya@example.com', password: 'secret123' })).status, 200);
  });

  test('a Google-only account can’t sign in with a password, and says why without revealing the account', async () => {
    await google('good:g-1:riya@example.com');
    const known = await call('POST', '/api/auth/login', { email: 'riya@example.com', password: 'whatever1' });
    const unknown = await call('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'whatever1' });
    assert.equal(known.status, 401);
    assert.equal(known.body.message, unknown.body.message);
    assert.match(known.body.message, /Continue with Google/);
  });

  test('a new account needs the pilot invite code; existing ones don’t', async () => {
    process.env.PILOT_INVITE_CODE = 'PILOT26';
    const none = await google('good:g-1:new@example.com');
    assert.equal(none.status, 403);
    assert.match(none.body.message, /sign-up page/);
    assert.equal((await google('good:g-1:new@example.com', { invite: 'nope' })).status, 403);
    assert.equal((await google('good:g-1:new@example.com', { invite: ' pilot26 ' })).status, 201);
    assert.equal((await google('good:g-1:new@example.com')).status, 200, 'signing in later needs no code');
  });

  test('bad tokens, unverified emails and a second Google account on one email are refused', async () => {
    assert.equal((await google('forged-token')).status, 401);
    assert.equal((await google('good:g-1:riya@example.com:unverified')).status, 401);
    assert.equal((await call('POST', '/api/auth/google', {})).status, 400);
    await google('good:g-1:riya@example.com');
    assert.equal((await google('good:g-2:riya@example.com')).status, 409);
    assert.equal(await User.countDocuments(), 1);
  });

  test('off unless GOOGLE_CLIENT_ID is set; the config tells the pages', async () => {
    assert.equal((await call('GET', '/api/auth/config')).body.data.googleClientId, CLIENT_ID);
    delete process.env.GOOGLE_CLIENT_ID;
    assert.equal((await call('GET', '/api/auth/config')).body.data.googleClientId, null);
    assert.equal((await google('good:g-1:riya@example.com')).status, 404);
  });
});
