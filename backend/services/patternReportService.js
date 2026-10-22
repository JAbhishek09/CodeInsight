/**
 * patternReportService.js — the Analytics "Patterns" tab: for each pattern,
 * how much is solved, how often it is spotted, how solutions fail, and the
 * single biggest gap; plus the mix-up grid (actual pattern × guess).
 * See docs/PATTERN_MVP_PLAN.md ("Analytics becomes pattern-based").
 */

import Problem from '../models/Problem.js';
import Prediction from '../models/Prediction.js';
import { PATTERNS, PATTERN_KEYS } from '../data/patterns.js';
import { PROBLEM_PATTERNS, problemPatternBySlug } from '../data/problemPatterns.js';
import { contrastTip } from '../data/patternContrasts.js';
import { statusOf } from './patternService.js';

const UNSURE = 'unsure';
const SLOW = new Set(['TLE', 'MLE']);
const CRASH = new Set(['RE', 'CE']);
const ratio = (n, d) => (d ? n / d : null);

/**
 * The one thing most worth fixing for a pattern, in priority order:
 * not spotting it → too slow → right idea, wrong details → left unfinished.
 */
export function gapOf(p) {
  const started = p.solved + p.attempted + p.recognition.attempts > 0;
  if (!started) return 'not-started';
  if (p.recognition.attempts >= 3 && p.recognition.accuracy < 0.6) return 'recognition';
  const { wrongAnswer, slow } = p.failures;
  if (slow >= 2 && slow >= wrongAnswer) return 'speed';
  if (wrongAnswer >= 2 && (p.firstSubmit.rate ?? 1) < 0.5) return 'edge-cases';
  if (p.attempted >= 2 && p.attempted >= p.solved) return 'unfinished';
  return 'on-track';
}

export async function buildPatternReport(userId) {
  const slugs = PROBLEM_PATTERNS.map((m) => m.slug);
  const [docs, preds] = await Promise.all([
    Problem.find(
      { user: userId, platform: 'leetcode', platformProblemId: { $in: slugs } },
      { platformProblemId: 1, platform: 1, status: 1, 'submissions.verdict': 1, 'submissions.submittedAt': 1 }
    ).lean(),
    Prediction.find(
      { user: userId, resolvedAt: { $ne: null }, actual: { $ne: null } },
      { actual: 1, predicted: 1, isCorrect: 1 }
    ).lean(),
  ]);

  const rows = new Map(PATTERNS.map((p) => [p.key, {
    key: p.key,
    name: p.name,
    level: p.level,
    total: PROBLEM_PATTERNS.filter((m) => m.pattern === p.key).length,
    solved: 0,
    attempted: 0,
    recognition: { attempts: 0, correct: 0, accuracy: null },
    submissions: 0,
    failures: { wrongAnswer: 0, slow: 0, crash: 0 },
    firstSubmit: { solved: 0, accepted: 0, rate: null },
    attemptsToAccept: null,
  }]));
  const triesToAccept = new Map(PATTERN_KEYS.map((k) => [k, []]));

  // ── Solving: status, how submissions fail, first-try acceptance ──────────
  for (const d of docs) {
    const key = problemPatternBySlug.get(d.platformProblemId)?.pattern;
    const r = rows.get(key);
    if (!r) continue;
    const status = statusOf(d);
    if (status === 'solved') r.solved += 1;
    else if (status === 'attempted') r.attempted += 1;

    const subs = [...(d.submissions ?? [])].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    r.submissions += subs.length;
    for (const s of subs) {
      if (s.verdict === 'Wrong Answer') r.failures.wrongAnswer += 1;
      else if (SLOW.has(s.verdict)) r.failures.slow += 1;
      else if (CRASH.has(s.verdict)) r.failures.crash += 1;
    }
    const firstAc = subs.findIndex((s) => s.verdict === 'Accepted');
    if (firstAc >= 0) {
      r.firstSubmit.solved += 1;
      if (firstAc === 0) r.firstSubmit.accepted += 1;
      triesToAccept.get(key).push(firstAc + 1);
    }
  }

  // ── Recognition + the mix-up grid (rows: actual, columns: guess) ────────
  const columns = [...PATTERN_KEYS, UNSURE];
  const counts = PATTERN_KEYS.map(() => columns.map(() => 0));
  for (const p of preds) {
    const r = rows.get(p.actual);
    if (!r) continue;
    r.recognition.attempts += 1;
    if (p.isCorrect) r.recognition.correct += 1;
    // A guess of the secondary pattern counts as right, so it sits on the diagonal
    const col = p.isCorrect ? p.actual : (columns.includes(p.predicted) ? p.predicted : null);
    if (col) counts[PATTERN_KEYS.indexOf(p.actual)][columns.indexOf(col)] += 1;
  }

  for (const r of rows.values()) {
    r.recognition.accuracy = ratio(r.recognition.correct, r.recognition.attempts);
    r.firstSubmit.rate = ratio(r.firstSubmit.accepted, r.firstSubmit.solved);
    const tries = triesToAccept.get(r.key);
    r.attemptsToAccept = tries.length ? tries.reduce((a, b) => a + b, 0) / tries.length : null;
    r.gap = gapOf(r);
  }

  const mixups = [];
  PATTERN_KEYS.forEach((actual, i) => columns.forEach((guess, j) => {
    if (guess === actual || guess === UNSURE || counts[i][j] === 0) return;
    mixups.push({ actual, predicted: guess, count: counts[i][j], tip: contrastTip(actual, guess) });
  }));
  mixups.sort((a, b) => b.count - a.count || PATTERN_KEYS.indexOf(a.actual) - PATTERN_KEYS.indexOf(b.actual));

  const list = [...rows.values()];
  const sum = (f) => list.reduce((n, r) => n + f(r), 0);
  const guesses = sum((r) => r.recognition.attempts);
  const firstSolved = sum((r) => r.firstSubmit.solved);

  return {
    totals: {
      keyProblems: PROBLEM_PATTERNS.length,
      solved: sum((r) => r.solved),
      attempted: sum((r) => r.attempted),
      recognition: { attempts: guesses, correct: sum((r) => r.recognition.correct), accuracy: ratio(sum((r) => r.recognition.correct), guesses) },
      firstSubmit: { solved: firstSolved, accepted: sum((r) => r.firstSubmit.accepted), rate: ratio(sum((r) => r.firstSubmit.accepted), firstSolved) },
      failures: {
        wrongAnswer: sum((r) => r.failures.wrongAnswer),
        slow: sum((r) => r.failures.slow),
        crash: sum((r) => r.failures.crash),
      },
    },
    patterns: list,
    matrix: { rows: PATTERN_KEYS, columns, counts },
    mixups,
  };
}
