/**
 * pilotReport.js — recognition accuracy week over week for every pilot
 * student, plus the whole group. See docs/PILOT.md.
 *
 *   node scripts/pilotReport.js --weeks 3 --tz Asia/Kolkata
 *   node scripts/pilotReport.js --weeks 3 --emails a@x.com,b@y.com --out reports/pilot.csv
 *
 * The console shows names only; the CSV (when --out is given) includes
 * emails, so keep it out of git (reports/ is ignored).
 *
 * "First try" = the first guess a student ever made on a problem. It is the
 * headline measure: repeat drills of a problem already seen are excluded.
 */

import 'dotenv/config';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Prediction from '../models/Prediction.js';
import { isValidTimeZone } from '../services/analyticsService.js';
import { patternByKey } from '../data/patterns.js';
import { weeklyRecognition } from '../services/pilotService.js';

const MIN_ATTEMPTS = 5; // weeks with fewer first-try guesses are too noisy to compare

function args() {
  const a = process.argv.slice(2);
  const get = (k, d) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
  const weeks = Number.parseInt(get('weeks', '3'), 10);
  const tz = get('tz', 'UTC');
  if (!(weeks >= 1 && weeks <= 26)) throw new Error('--weeks must be 1–26');
  if (!isValidTimeZone(tz)) throw new Error(`Unknown time zone: ${tz}`);
  return { weeks, tz, out: get('out', null), emails: get('emails', null)?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) };
}

const pct = (x) => (x == null ? '   —' : `${String(Math.round(x * 100)).padStart(3)}%`);
const cell = (w) => `${pct(w.firstTry.accuracy)} (${String(w.firstTry.attempts).padStart(2)})`;
const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));

async function main() {
  const { weeks, tz, out, emails } = args();
  if (process.env.DNS_SERVERS !== 'system') dns.setServers((process.env.DNS_SERVERS || '1.1.1.1').split(','));
  await mongoose.connect(process.env.MONGO_URI);

  const ids = emails
    ? (await User.find({ email: { $in: emails } }, { _id: 1 }).lean()).map((u) => u._id)
    : await Prediction.distinct('user', { resolvedAt: { $gte: new Date(Date.now() - (weeks + 1) * 7 * 864e5) } });
  const users = await User.find({ _id: { $in: ids } }, { name: 1, email: 1 }).sort({ name: 1 }).lean();
  if (users.length === 0) { console.log('No students with guesses in this period.'); return; }

  const now = new Date();
  const rows = [];
  for (const u of users) rows.push({ u, w: await weeklyRecognition(u._id, { tz, weeks, now }) });

  // Group totals per week
  const group = rows[0].w.map((_, i) => {
    const sum = (f) => rows.reduce((n, r) => n + f(r.w[i]), 0);
    const ftA = sum((w) => w.firstTry.attempts), ftC = sum((w) => w.firstTry.correct);
    const a = sum((w) => w.attempts), c = sum((w) => w.correct);
    return { weekStart: rows[0].w[i].weekStart, attempts: a, correct: c, accuracy: a ? c / a : null,
      firstTry: { attempts: ftA, correct: ftC, accuracy: ftA ? ftC / ftA : null } };
  });

  const change = (w) => {
    const ok = w.filter((x) => x.firstTry.attempts >= MIN_ATTEMPTS);
    if (ok.length < 2) return '      n/a';
    const d = ok.at(-1).firstTry.accuracy - ok[0].firstTry.accuracy;
    return `${d >= 0 ? '+' : ''}${Math.round(d * 100)} pts`.padStart(9);
  };

  const nameW = Math.max(7, ...users.map((u) => u.name.length));
  console.log(`\nFirst-try recognition accuracy by week (Mon–Sun, ${tz}) — accuracy (guesses)\n`);
  console.log(`${'Student'.padEnd(nameW)}  ${group.map((g) => g.weekStart.padEnd(10)).join('  ')}  change`);
  for (const { u, w } of rows) console.log(`${u.name.padEnd(nameW)}  ${w.map(cell).join('  ')}  ${change(w)}`);
  console.log(`${'Group'.padEnd(nameW)}  ${group.map(cell).join('  ')}  ${change(group)}`);
  console.log(`\n"change" compares the first and last week with at least ${MIN_ATTEMPTS} first-try guesses.`);

  // What the group mixes up most in this period: actual pattern → wrong guess
  const mixups = await Prediction.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) }, resolvedAt: { $gte: new Date(`${group[0].weekStart}T00:00:00Z`) }, isCorrect: false } },
    { $group: { _id: { actual: '$actual', predicted: '$predicted' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 5 },
  ]);
  if (mixups.length) {
    const name = (k) => patternByKey.get(k)?.name ?? k;
    console.log('\nMost common mix-ups (actual → guessed):');
    for (const m of mixups) console.log(`  ${String(m.n).padStart(3)}×  ${name(m._id.actual)} → ${name(m._id.predicted)}`);
  }

  if (out) {
    const header = ['student', 'email', 'week_start', 'first_try_guesses', 'first_try_correct', 'first_try_accuracy',
      'all_guesses', 'all_correct', 'all_accuracy', 'drill', 'extension', 'app', 'active_days'];
    const lines = [header.join(',')];
    for (const { u, w } of rows) {
      for (const x of w) {
        lines.push([u.name, u.email, x.weekStart, x.firstTry.attempts, x.firstTry.correct, x.firstTry.accuracy?.toFixed(3),
          x.attempts, x.correct, x.accuracy?.toFixed(3), x.bySource.drill, x.bySource.extension, x.bySource.app, x.activeDays].map(csvCell).join(','));
      }
    }
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, `${lines.join('\n')}\n`);
    console.log(`Wrote ${lines.length - 1} rows to ${out}`);
  }
}

main()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
