/**
 * diagnosisService.js — rule-based "what went wrong" for one problem.
 *
 * Cheap and deterministic: it reads the submission history, the known pattern
 * (if mapped) and the student's latest guess. The AI tutor is only for when
 * the student asks why a specific attempt failed. See docs/PATTERN_MVP_PLAN.md.
 */

import { patternByKey } from '../data/patterns.js';
import { problemPatternBySlug } from '../data/problemPatterns.js';

const SLOW = new Set(['TLE', 'MLE']);
const CRASH = new Set(['RE', 'CE']);
const SHAKY_ATTEMPTS = 4;   // accepted only after this many tries → review later
const STUCK_ATTEMPTS = 3;   // this many failures without an accept → offer help
const REVIEW_AFTER_DAYS = 7;

/**
 * @param problem  Problem document (lean or hydrated) with submissions
 * @param feedback latest pattern-guess feedback for this problem, or null
 * @returns {{ status, attempts, signals[], checklist[], reviewOn, pattern }}
 *   status: 'clean' | 'solved-with-struggle' | 'stuck' | 'in-progress' | 'none'
 */
export function diagnoseProblem(problem, feedback = null) {
  const subs = [...(problem.submissions ?? [])]
    .filter((s) => s.submittedAt)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  const map = problem.platform === 'leetcode' ? problemPatternBySlug.get(problem.platformProblemId) : null;
  const pat = map ? patternByKey.get(map.pattern) : null;
  const pattern = pat ? { key: pat.key, name: pat.name, complexity: map.complexity } : null;

  if (subs.length === 0) {
    return { status: 'none', attempts: 0, signals: [], checklist: [], reviewOn: null, pattern };
  }

  const firstAcIdx = subs.findIndex((s) => s.verdict === 'Accepted');
  const solved = firstAcIdx !== -1;
  const beforeAc = solved ? subs.slice(0, firstAcIdx) : subs;
  const count = (set) => beforeAc.filter((s) => set.has(s.verdict)).length;
  const slow = count(SLOW);
  const wrong = beforeAc.filter((s) => s.verdict === 'Wrong Answer').length;
  const crashes = count(CRASH);
  const triesToAc = solved ? firstAcIdx + 1 : null;

  const signals = [];
  let checklist = [];

  // Recognition (from the student's guess)
  if (feedback?.outcome === 'missed' || feedback?.outcome === 'wrong-approach') {
    signals.push({
      type: 'recognition-miss',
      severity: 'high',
      title: 'Pattern not recognised',
      detail: `You guessed ${feedback.predictedName}; it’s ${feedback.pattern?.name}. The clue: ${feedback.pattern?.cue}.`,
    });
  } else if (feedback?.outcome === 'recognised' || feedback?.outcome === 'right-pattern-bug') {
    signals.push({ type: 'recognised', severity: 'good', title: 'Pattern recognised', detail: `You spotted ${feedback.pattern?.name} before coding.` });
  }

  // Too slow → usually the wrong approach for this problem
  if (slow > 0) {
    signals.push({
      type: 'too-slow',
      severity: 'high',
      title: slow === 1 ? 'Time or memory limit exceeded' : `${slow} time/memory limit failures`,
      detail: pattern
        ? `Your approach was slower than the optimal ${pattern.complexity}. That usually means a different pattern (${pattern.name}) or repeated work inside a loop.`
        : 'Your approach was slower than needed — look for repeated work inside loops or a better data structure.',
    });
  }

  // Wrong answers → the idea may be fine; check the edges
  if (wrong >= 2) {
    signals.push({
      type: 'wrong-answers',
      severity: 'medium',
      title: `${wrong} wrong answers`,
      detail: 'The idea may be right — wrong answers usually come from edge cases and boundaries.',
    });
    checklist = pat?.edgeChecklist ?? ['Empty and single-element input', 'Boundaries and off-by-one', 'Duplicates', 'Overflow'];
  }

  if (crashes > 0) {
    signals.push({
      type: 'crashes',
      severity: 'medium',
      title: crashes === 1 ? 'Runtime or compile error' : `${crashes} runtime/compile errors`,
      detail: 'Check index bounds, empty containers before access, and recursion depth.',
    });
  }

  let status;
  let reviewOn = null;
  if (!solved) {
    status = subs.length >= STUCK_ATTEMPTS ? 'stuck' : 'in-progress';
    if (status === 'in-progress' && signals.every((s) => s.severity === 'good')) {
      // e.g. a single wrong answer — no pattern of mistakes yet, but worth a look
      const last = subs[subs.length - 1].verdict;
      signals.push({
        type: 'not-accepted',
        severity: 'medium',
        title: 'Not accepted yet',
        detail: `Your last attempt got ${last}. Ask the tutor for a nudge, or try again first.`,
      });
    }
    if (status === 'stuck') {
      signals.push({
        type: 'stuck',
        severity: 'high',
        title: `${subs.length} attempts without an accept`,
        detail: pattern ? `Revisit the ${pattern.name} pattern, or ask the tutor why your last attempt failed.` : 'Ask the tutor why your last attempt failed.',
      });
    }
  } else if (triesToAc >= SHAKY_ATTEMPTS) {
    status = 'solved-with-struggle';
    const last = new Date(subs[firstAcIdx].submittedAt);
    reviewOn = new Date(last.getTime() + REVIEW_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    signals.push({
      type: 'shaky',
      severity: 'medium',
      title: `Accepted after ${triesToAc} tries`,
      detail: 'Solve it again from scratch in a week to make sure the idea sticks.',
    });
  } else {
    status = 'clean';
    if (triesToAc === 1) signals.push({ type: 'clean', severity: 'good', title: 'Solved on the first try', detail: 'Nice — no failed attempts.' });
  }

  return { status, attempts: subs.length, triesToAc, signals, checklist, reviewOn, pattern };
}
