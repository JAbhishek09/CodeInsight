/**
 * mailer.js — sends the app's emails (password-reset links). Two ways, picked
 * by which settings exist:
 *
 *   Gmail API over HTTPS — GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
 *     GMAIL_REFRESH_TOKEN (gmail.send scope) and EMAIL_FROM. Works on hosts
 *     that block SMTP, such as Render's free plan.
 *   SMTP through Gmail — EMAIL_USERNAME and EMAIL_PASSWORD (an app password).
 *     For local development or a host that allows SMTP.
 */

import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';

const gmailApiSettings = () => {
  const { GMAIL_CLIENT_ID: id, GMAIL_CLIENT_SECRET: secret, GMAIL_REFRESH_TOKEN: refreshToken } = process.env;
  return id && secret && refreshToken ? { id, secret, refreshToken } : null;
};
const smtpSettings = () => {
  const { EMAIL_USERNAME: user, EMAIL_PASSWORD: pass } = process.env;
  return user && pass ? { user, pass } : null;
};

// Tests: undefined = the real senders, null = "not set up", a function = fake sender
let testSender;
export function __setMailerForTests(sender) { testSender = sender; }

/** Whether this server can send email at all. */
export const mailConfigured = () =>
  (testSender !== undefined ? Boolean(testSender) : Boolean(gmailApiSettings() || smtpSettings()));

// One OAuth client, so its access token is reused until it expires
let gmailAuth = null;
function gmailClient({ id, secret, refreshToken }) {
  if (!gmailAuth) {
    gmailAuth = new OAuth2Client(id, secret);
    gmailAuth.setCredentials({ refresh_token: refreshToken });
  }
  return gmailAuth;
}

// Builds the raw RFC 822 message the Gmail API expects
const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });

async function sendWithGmailApi(settings, message) {
  const { token } = await gmailClient(settings).getAccessToken();
  const { message: raw } = await composer.sendMail(message);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: raw.toString('base64url') }),
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function sendWithSmtp(settings, message) {
  await nodemailer.createTransport({ service: 'Gmail', auth: settings }).sendMail(message);
}

/** Send one email. Throws if email isn't set up or the send fails. */
export async function sendMail({ to, subject, text, html }) {
  if (testSender !== undefined) {
    if (!testSender) throw new Error('Email isn’t set up.');
    return testSender({ to, subject, text, html });
  }
  const address = process.env.EMAIL_FROM || process.env.EMAIL_USERNAME;
  const message = { ...(address ? { from: { name: 'CodeInsight', address } } : {}), to, subject, text, html };
  const gmail = gmailApiSettings();
  if (gmail) return sendWithGmailApi(gmail, message);
  const smtp = smtpSettings();
  if (smtp) return sendWithSmtp(smtp, message);
  throw new Error('Email isn’t set up: set GMAIL_* (Gmail API) or EMAIL_USERNAME and EMAIL_PASSWORD (SMTP).');
}
