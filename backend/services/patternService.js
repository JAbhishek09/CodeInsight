/**
 * patternService.js — the pattern knowledge base joined with one student's
 * progress. See docs/PATTERN_MVP_PLAN.md.
 */

import Problem from '../models/Problem.js';
import { PATTERNS, patternByKey } from '../data/patterns.js';
import { PROBLEM_PATTERNS, problemPatternBySlug } from '../data/problemPatterns.js';

/** solved | attempted | todo for one stored problem (same rule as the list view). */
function statusOf(doc) {
  const subs = doc.submissions ?? [];
  if (subs.some((s) => s.verdict === 'Accepted')) return 'solved';
  if (doc.status === 'Solved' && (doc.platform === 'manual' || subs.length === 0)) return 'solved';
  if (subs.length > 0 || doc.status === 'Attempted') return 'attempted';
  return 'todo';
}

/** slug → { status, problemId } for this student's LeetCode problems in the map. */
export async function progressBySlug(userId, slugs) {
  const docs = await Problem.find(
    { user: userId, platform: 'leetcode', platformProblemId: { $in: slugs } },
    { platformProblemId: 1, status: 1, platform: 1, 'submissions.verdict': 1 }
  ).lean();
  return new Map(docs.map((d) => [d.platformProblemId, { status: statusOf(d), problemId: String(d._id) }]));
}

const summary = (p) => ({ key: p.key, name: p.name, short: p.short, level: p.level, requires: p.requires });

export async function listPatterns(userId) {
  const progress = await progressBySlug(userId, PROBLEM_PATTERNS.map((p) => p.slug));
  const patterns = PATTERNS.map((pat) => {
    const problems = PROBLEM_PATTERNS.filter((p) => p.pattern === pat.key);
    let solved = 0, attempted = 0;
    for (const p of problems) {
      const s = progress.get(p.slug)?.status;
      if (s === 'solved') solved += 1;
      else if (s === 'attempted') attempted += 1;
    }
    return { ...summary(pat), total: problems.length, solved, attempted };
  });
  return {
    patterns,
    totals: {
      problems: PROBLEM_PATTERNS.length,
      solved: patterns.reduce((n, p) => n + p.solved, 0),
      attempted: patterns.reduce((n, p) => n + p.attempted, 0),
    },
  };
}

export async function getPattern(userId, key) {
  const pat = patternByKey.get(key);
  if (!pat) return null;
  const problems = PROBLEM_PATTERNS.filter((p) => p.pattern === key || p.secondary === key);
  const progress = await progressBySlug(userId, problems.map((p) => p.slug));
  const order = { Easy: 0, Medium: 1, Hard: 2 };
  return {
    ...pat,
    problems: problems
      .map((p) => ({
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        cue: p.cue,
        complexity: p.complexity,
        primary: p.pattern === key,
        url: `https://leetcode.com/problems/${p.slug}/`,
        status: progress.get(p.slug)?.status ?? 'todo',
        problemId: progress.get(p.slug)?.problemId ?? null,
      }))
      .sort((a, b) => order[a.difficulty] - order[b.difficulty]),
  };
}

/** The pattern info shown on a problem page, or null if the problem isn't mapped. */
export function patternForProblem(problem) {
  if (problem?.platform !== 'leetcode') return null;
  const m = problemPatternBySlug.get(problem.platformProblemId);
  if (!m) return null;
  const pat = patternByKey.get(m.pattern);
  return {
    key: pat.key,
    name: pat.name,
    short: pat.short,
    cue: m.cue,
    complexity: m.complexity,
    secondary: m.secondary ? { key: m.secondary, name: patternByKey.get(m.secondary)?.name ?? m.secondary } : null,
  };
}
