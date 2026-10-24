import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import { __setMailerForTests } from '../utils/mailer.js';
import { allowedOrigins } from '../utils/origins.js';
import { __setGoogleVerifierForTests } from '../utils/googleIdToken.js';

let server;
let baseUrl;
let sent; // emails the fake mailer received

const call = async (method, path, body, headers = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const register = (email, password = 'secret123') => call('POST', '/api/auth/register', { name: 'Riya', email, password });
const forgot = (email, headers) => call('POST', '/api/auth/forgot-password', { email }, headers);
const tokenFrom = (mail) => new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');

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
  sent = [];
  __setMailerForTests(async (mail) => { sent.push(mail); });
});

describe('POST /api/auth/forgot-password', () => {
  test('the link opens the site that asked, and its token sets a new password once', async () => {
    await register('one@example.com');
    const res = await forgot('One@Example.com ', { Origin: baseUrl }); // this site's own page, any case
    assert.equal(res.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'one@example.com');
    assert.ok(sent[0].text.includes(`${baseUrl}/reset-password?token=`), 'link points at the page’s own site');
    assert.ok(sent[0].html.includes(`${baseUrl}/reset-password?token=`));

    const token = tokenFrom(sent[0]);
    assert.equal((await call('POST', '/api/auth/reset-password', { token, newPassword: 'brandnew1' })).status, 200);
    assert.equal((await call('POST', '/api/auth/login', { email: 'one@example.com', password: 'brandnew1' })).status, 200);
    assert.equal((await call('POST', '/api/auth/login', { email: 'one@example.com', password: 'secret123' })).status, 401);
    assert.equal((await call('POST', '/api/auth/reset-password', { token, newPassword: 'again1234' })).status, 400, 'one use only');
  });

  test('without a trusted page, the link uses the configured site, never the request', async () => {
    await register('two@example.com');
    await forgot('two@example.com'); // no Origin (not a browser)
    assert.ok(sent[0].text.includes(`${allowedOrigins[0]}/reset-password?token=`));
    assert.ok(!sent[0].text.includes(baseUrl), 'not the address the request came in on');
  });

  test('an unknown email gets the same answer and no email', async () => {
    await register('three@example.com');
    const known = await forgot('three@example.com');
    const unknown = await forgot('nobody@example.com');
    assert.equal(unknown.status, 200);
    assert.equal(unknown.body.message, known.body.message);
    assert.equal(sent.length, 1);
  });

  test('a Google-only account can add a password this way', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    __setGoogleVerifierForTests(async () => ({ sub: 'g-1', email: 'four@example.com', email_verified: true, name: 'Four' }));
    try {
      await call('POST', '/api/auth/google', { credential: 'x' });
      await forgot('four@example.com', { Origin: baseUrl });
      await call('POST', '/api/auth/reset-password', { token: tokenFrom(sent[0]), newPassword: 'nowapass1' });
      assert.equal((await call('POST', '/api/auth/login', { email: 'four@example.com', password: 'nowapass1' })).status, 200);
    } finally {
      delete process.env.GOOGLE_CLIENT_ID;
      __setGoogleVerifierForTests(null);
    }
  });

  test('says so when email isn’t set up, or when sending fails', async () => {
    await register('five@example.com');
    __setMailerForTests(null);
    const off = await forgot('five@example.com');
    assert.equal(off.status, 503);
    assert.match(off.body.message, /isn’t set up/);

    __setMailerForTests(async () => { throw new Error('quota'); });
    assert.equal((await forgot('five@example.com')).status, 502);
  });

  test('at most 3 reset emails per address per 15 minutes', async () => {
    await register('six@example.com');
    for (let i = 0; i < 3; i += 1) assert.equal((await forgot('six@example.com')).status, 200);
    assert.equal((await forgot('SIX@example.com')).status, 429);
    assert.equal(sent.length, 3);
  });
});
