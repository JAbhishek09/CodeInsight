/**
 * tutorService.js — "Why did this fail?" for one failed submission.
 *
 * The AI is given the known pattern, its clue and the optimal complexity, so
 * it explains the gap instead of guessing the approach. It must give the
 * smallest useful nudge, never a full solution. One answer per submission is
 * cached and free to re-open; new questions count toward the daily AI limit.
 */

import TutorAnswer from '../models/TutorAnswer.js';
import { generateJson, truncateCode } from './aiService.js';
import { patternByKey } from '../data/patterns.js';
import { problemPatternBySlug } from '../data/problemPatterns.js';
import { md5 } from '../utils/hashCode.js';
import { consumeAiQuota, getAiQuota, refundAiQuota } from '../utils/aiQuota.js';

export const DIAGNOSES = ['wrong-pattern', 'right-pattern-too-slow', 'implementation-bug', 'edge-case', 'other'];

const SYSTEM = `You are a patient algorithms tutor helping a student understand why their LeetCode submission failed.
You are told the problem, the pattern that solves it (when known), the clue in the statement that points to that pattern,
the optimal complexity, the verdict, and the student's code.

Your goal is to teach pattern recognition and debugging — NOT to solve the problem for them.

Return ONLY this JSON object:
{
  "diagnosis": "wrong-pattern" | "right-pattern-too-slow" | "implementation-bug" | "edge-case" | "other",
  "summary": "<one sentence: what went wrong, referring to their actual code with backticks>",
  "nudge": "<the smallest hint that lets them fix it themselves; a question is often best; never paste a full solution>",
  "checks": ["<2-4 concrete things to check in their code or test by hand>"],
  "patternTip": "<one sentence linking the clue in the problem to the pattern, so they recognise it next time>"
}

RULES:
- "wrong-pattern": their approach is a different pattern from the known one (e.g. nested loops / brute force where a sliding window fits).
- "right-pattern-too-slow": right idea, but extra work makes it exceed the time or memory limit.
- "implementation-bug" / "edge-case": the idea is right; the failure is a bug or a missed input case.
- Use the known pattern as ground truth when it is given.
- Refer to the student's identifiers with backticks. Keep summary and nudge under 50 words each.
- Never include more than 2 lines of code anywhere.`;

function buildPrompt({ title, slug, verdict, language, code, map }) {
  const pat = map ? patternByKey.get(map.pattern) : null;
  return [
    `Problem: ${title}${slug ? ` (leetcode.com/problems/${slug})` : ''}`,
    pat ? `Known pattern: ${pat.name}` : 'Known pattern: not mapped — infer it carefully',
    map ? `Clue in the statement: ${map.cue}` : null,
    map ? `Optimal complexity: ${map.complexity}` : null,
    pat ? `Common wrong turns for this pattern: ${pat.wrongTurns.join(' | ')}` : null,
    `Verdict: ${verdict}`,
    `Language: ${language}`,
    '',
    'Student code:',
    '```',
    truncateCode(code),
    '```',
  ].filter((x) => x !== null).join('\n');
}

function sanitise(raw) {
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const answer = {
    diagnosis: DIAGNOSES.includes(raw?.diagnosis) ? raw.diagnosis : 'other',
    summary: str(raw?.summary, 400),
    nudge: str(raw?.nudge, 400),
    checks: Array.isArray(raw?.checks) ? raw.checks.map((c) => str(c, 200)).filter(Boolean).slice(0, 4) : [],
    patternTip: str(raw?.patternTip, 300),
  };
  if (!answer.summary || !answer.nudge) throw new Error('The tutor gave an incomplete answer. Try again.');
  return answer;
}

const view = (doc) => ({
  id: String(doc._id),
  submissionId: doc.submissionId,
  verdict: doc.verdict,
  pattern: doc.patternKey ? { key: doc.patternKey, name: patternByKey.get(doc.patternKey)?.name ?? doc.patternKey } : null,
  answer: doc.answer,
  createdAt: doc.createdAt,
});

/** Failed submissions the tutor can explain (newest first). */
export function failedSubmissions(problem) {
  return [...(problem.submissions ?? [])]
    .filter((s) => s.verdict !== 'Accepted' && s.verdict !== 'Pending' && s.code?.trim())
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

export async function listTutorAnswers(userId, problemId) {
  const docs = await TutorAnswer.find({ user: userId, problem: problemId }).sort({ createdAt: -1 }).limit(20).lean();
  return docs.map(view);
}

/**
 * Explain one failed submission (default: the most recent). Returns the cached
 * answer if this exact code was explained before.
 */
export async function askTutor({ userId, problem, submissionId }) {
  const failed = failedSubmissions(problem);
  const sub = submissionId ? failed.find((s) => String(s.submissionId ?? s._id) === String(submissionId)) : failed[0];
  if (!sub) {
    const err = new Error(submissionId ? 'That submission isn’t a failed attempt with code.' : 'There’s no failed attempt with code to explain.');
    err.statusCode = 400;
    throw err;
  }

  const sid = String(sub.submissionId ?? sub._id);
  const codeHash = md5(sub.code);
  const cached = await TutorAnswer.findOne({ user: userId, problem: problem._id, submissionId: sid, codeHash });
  if (cached) return { ...view(cached), cached: true, quota: await getAiQuota(userId) };

  const map = problem.platform === 'leetcode' ? problemPatternBySlug.get(problem.platformProblemId) : null;
  const { usageId, ...quota } = await consumeAiQuota(userId, 'tutor');

  let answer;
  try {
    answer = sanitise(await generateJson({
      system: SYSTEM,
      prompt: buildPrompt({
        title: problem.title,
        slug: problem.platform === 'leetcode' ? problem.platformProblemId : null,
        verdict: sub.verdict,
        language: sub.language,
        code: sub.code,
        map,
      }),
    }));
  } catch (err) {
    await refundAiQuota(usageId);
    throw err;
  }

  const doc = await TutorAnswer.findOneAndUpdate(
    { user: userId, problem: problem._id, submissionId: sid, codeHash },
    { $set: { verdict: sub.verdict, patternKey: map?.pattern ?? null, answer } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { ...view(doc), cached: false, quota };
}
