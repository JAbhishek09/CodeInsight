import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { mailSetupReport } from '../utils/mailer.js';

const GMAIL = { GMAIL_CLIENT_ID: 'id-123', GMAIL_CLIENT_SECRET: 'secret-456', GMAIL_REFRESH_TOKEN: 'token-789' };

describe('startup email report', () => {
  test('all three Gmail settings: Gmail API, even when pasted with quotes or spaces', () => {
    assert.equal(mailSetupReport({ ...GMAIL, EMAIL_FROM: 'me@gmail.com' }), 'Password-reset email: Gmail API.');
    assert.match(mailSetupReport({ ...GMAIL, GMAIL_REFRESH_TOKEN: '  "token-789"\n' }), /^Password-reset email: Gmail API/);
    assert.match(mailSetupReport(GMAIL), /EMAIL_FROM not set/);
  });

  test('names what is missing or empty, and look-alike names that explain it', () => {
    const env = {
      GMAIL_CLIENT_ID: 'id-123', GMAIL_CLIENT_SECRET: ' ', 'GMAIL_REFRESH_TOKEN ': 'token-789', GMAIL_CLIENTID: 'x',
      'email from': 'me@gmail.com', SUPPORT_EMAIL: 'help@example.com', // the second is unrelated
    };
    const report = mailSetupReport(env);
    assert.equal(report,
      'Password-reset email is OFF: missing GMAIL_CLIENT_SECRET (empty), GMAIL_REFRESH_TOKEN; '
      + 'similar names found: "GMAIL_REFRESH_TOKEN ", "GMAIL_CLIENTID", "email from".');
  });

  test('SMTP when only the SMTP pair is set', () => {
    assert.match(mailSetupReport({ EMAIL_USERNAME: 'me@gmail.com', EMAIL_PASSWORD: 'app-pass' }), /SMTP/);
  });

  test('never prints a value', () => {
    for (const env of [{ ...GMAIL }, { GMAIL_CLIENT_ID: 'id-123', GMAIL_REFRESH_TOKEN_X: 'token-789' }]) {
      const report = mailSetupReport(env);
      for (const v of ['id-123', 'secret-456', 'token-789']) assert.ok(!report.includes(v), `leaked ${v}`);
    }
  });
});
