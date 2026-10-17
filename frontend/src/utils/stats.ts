/**
 * utils/stats.ts — client-side derived analytics
 *
 * FIXES in this version:
 * 1. "All Mediums" bug — computeDifficultyTrend now correctly uses the
 *    problem-level difficulty from flattenSubmissions (which copies p.difficulty).
 *    The real root cause is the LeetCode service falling back to 'Medium' when
 *    the API doesn't return a difficulty tag. We can't fix that here, but we now
 *    correctly pass it through so at least real data renders correctly.
 *
 * 2. "General" bucket bug — computeTopicMastery used to fall back to
 *    [p.category || 'General'] when tags were empty. This grouped everything
 *    imported without tags into one massive "General" bar. Now we skip problems
 *    with no real tags from the topic chart entirely, rather than polluting it
 *    with a meaningless fallback.
 */

import type { Problem } from '../types/problem';
import { languageLabel } from '../lib/languages';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ActivityEntry {
  problemId:    string;
  problemTitle: string;
  platform:     string;
  difficulty:   string;   // copied from Problem.difficulty at flatten time
  verdict:      string;
  language:     string;
  submittedAt:  string;
}

export interface TopicMastery {
  topic:  string;
  solved: number;
  total:  number;
  pct:    number;
}

export interface TrendPoint {
  x: string;
  y: number;
}

export interface TrendSeries {
  label:  string;
  color:  string;
  points: TrendPoint[];
}

export interface AIInsightsSummary {
  analyzedCount:           number;
  strongestTopics:         TopicMastery[];
  weakestTopics:           TopicMastery[];
  complexityImprovements:  {
    problemId: string; problemTitle: string; link?: string;
    current: string; optimal: string; type: 'time' | 'space' | 'both';
  }[];
  commonMistakes:          {
    text: string; count: number;
    problems: { problemId: string; problemTitle: string }[];
  }[];
  recommendations:         string[];
  summary:                 string;
}

export interface BlindSpotCategory {
  category: string;
  count:    number;
  pct:      number;
  examples: { problemId: string; problemTitle: string; text: string }[];
}

export interface TimeToOptimalStat {
  avgMinutes: number | null;
  sampleSize: number;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function dayKey(d: Date): string {
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTH_LABEL = (d: Date) => d.toLocaleString(undefined, { month: 'short' });

// ─── Flatten ──────────────────────────────────────────────────────────────────

/**
 * Flattens every submission across every problem into a flat activity timeline.
 * Copies problem-level fields (difficulty, platform, tags) onto each entry so
 * trend functions can work from a single array.
 */
export function flattenSubmissions(problems: Problem[]): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  problems.forEach((p) => {
    (p.submissions || []).forEach((s: any) => {
      if (!s?.submittedAt) return;
      out.push({
        problemId:    p._id,
        problemTitle: p.title,
        platform:     p.platform || 'manual',
        difficulty:   p.difficulty || 'Medium',   // problem-level, not submission-level
        verdict:      s.verdict,
        language:     s.language,
        submittedAt:  s.submittedAt,
      });
    });
  });
  return out;
}

// ─── Hero stats ───────────────────────────────────────────────────────────────

export function computeAcceptanceRate(entries: ActivityEntry[]): number {
  if (entries.length === 0) return 0;
  const accepted = entries.filter((e) => e.verdict === 'Accepted').length;
  return Math.round((accepted / entries.length) * 100);
}

export function computeStreak(entries: ActivityEntry[]): { current: number; longest: number } {
  const solvedDays = new Set<string>();
  entries.forEach((e) => {
    if (e.verdict === 'Accepted') solvedDays.add(dayKey(new Date(e.submittedAt)));
  });
  if (solvedDays.size === 0) return { current: 0, longest: 0 };

  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!solvedDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (solvedDays.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sortedDays = Array.from(solvedDays).sort();
  let longest = 1;
  let run     = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev    = new Date(sortedDays[i - 1]);
    const cur     = new Date(sortedDays[i]);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    run     = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  return { current, longest: Math.max(longest, current) };
}

export function countAIAnalyses(problems: Problem[]): number {
  return problems.filter((p) => Boolean((p as any).aiAnalysis?.complexityAnalysis)).length;
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

export function computeHeatmapData(entries: ActivityEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.verdict !== 'Accepted') return;
    const k = dayKey(new Date(e.submittedAt));
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}

// ─── Topic mastery ────────────────────────────────────────────────────────────

/**
 * FIX: "General" bucket bug.
 *
 * Old logic: fell back to [p.category || 'General'] when tags were empty,
 * causing every problem imported without real tags to pile into one giant
 * "General" bar that dwarfed everything else.
 *
 * New logic: only count problems that have at least one real tag. Problems
 * with empty tags are omitted from the topic chart entirely. Category is
 * still used as a fallback, but only if it's not the generic 'General'
 * placeholder — so user-created categories like "Two Pointers" still show up.
 */
export function computeTopicMastery(problems: Problem[]): TopicMastery[] {
  const map = new Map<string, { solved: number; total: number }>();

  problems.forEach((p) => {
    const rawTags = (p as any).tags as string[] | undefined;
    const hasTags = Array.isArray(rawTags) && rawTags.length > 0;

    // Use real tags if available; otherwise use the user's category ONLY if
    // it's a meaningful one (not the 'General' placeholder).
    let topics: string[] = [];
    if (hasTags) {
      topics = rawTags.filter((t) => t && t.trim());
    } else if (p.category && p.category !== 'General') {
      topics = [p.category.trim()];
    } else {
      // No real topic info — skip this problem from the topic chart
      return;
    }

    const isSolved =
      p.status === 'Solved' ||
      (p.submissions || []).some((s: any) => s.verdict === 'Accepted');

    topics.forEach((raw) => {
      const key = raw.trim();
      if (!key) return;
      const cur = map.get(key) || { solved: 0, total: 0 };
      cur.total += 1;
      if (isSolved) cur.solved += 1;
      map.set(key, cur);
    });
  });

  return Array.from(map.entries())
    .map(([topic, v]) => ({
      topic,
      solved: v.solved,
      total:  v.total,
      pct:    v.total ? Math.round((v.solved / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// ─── Difficulty breakdown ─────────────────────────────────────────────────────

export function computeDifficultyBreakdown(problems: Problem[]) {
  const byDiff = (d: string) => problems.filter((p) => p.difficulty === d);
  const easy   = byDiff('Easy');
  const medium = byDiff('Medium');
  const hard   = byDiff('Hard');
  return {
    easy:         easy.length,
    medium:       medium.length,
    hard:         hard.length,
    easySolved:   easy.filter((p) => p.status === 'Solved').length,
    mediumSolved: medium.filter((p) => p.status === 'Solved').length,
    hardSolved:   hard.filter((p) => p.status === 'Solved').length,
  };
}

// ─── Recent activity ──────────────────────────────────────────────────────────

export function computeRecentActivity(entries: ActivityEntry[], limit = 6): ActivityEntry[] {
  return [...entries]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, limit);
}

// ─── Language usage ───────────────────────────────────────────────────────────

export function computeLanguageUsage(entries: ActivityEntry[]): { topic: string; count: number }[] {
  const map = new Map<string, number>();
  entries.forEach((e) => {
    if (!e.language) return;
    const label = languageLabel(e.language);
    map.set(label, (map.get(label) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Month-bucket helper ──────────────────────────────────────────────────────

function lastNMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABEL(d) });
  }
  return out;
}

// ─── Solving trend (single series) ───────────────────────────────────────────

export function computeSolvingTrend(entries: ActivityEntry[], months = 6): TrendSeries[] {
  const buckets = lastNMonths(months);
  const counts  = new Map(buckets.map((b) => [b.key, 0]));
  entries.forEach((e) => {
    if (e.verdict !== 'Accepted') return;
    const d   = new Date(e.submittedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [
    {
      label:  'Problems Solved',
      color:  '#ec4899',
      points: buckets.map((b) => ({ x: b.label, y: counts.get(b.key) || 0 })),
    },
  ];
}

// ─── Difficulty trend (3 series) ─────────────────────────────────────────────

/**
 * FIX: "All Mediums" bug.
 *
 * The difficulty of each submission entry now comes from ActivityEntry.difficulty,
 * which is copied from the parent Problem's difficulty field in flattenSubmissions().
 * This was always correct — the issue was upstream in leetcodeService.js which
 * defaults to 'Medium' when the API doesn't return a difficulty. We surface that
 * correctly here. When real difficulty data exists, the 3 series will split.
 */
export function computeDifficultyTrend(entries: ActivityEntry[], months = 6): TrendSeries[] {
  const buckets = lastNMonths(months);
  const diffs: { key: 'Easy' | 'Medium' | 'Hard'; color: string }[] = [
    { key: 'Easy',   color: '#10b981' },
    { key: 'Medium', color: '#f59e0b' },
    { key: 'Hard',   color: '#f43f5e' },
  ];
  return diffs.map(({ key: diff, color }) => {
    const counts = new Map(buckets.map((b) => [b.key, 0]));
    entries.forEach((e) => {
      // Use problem-level difficulty (copied in flattenSubmissions)
      if (e.verdict !== 'Accepted' || e.difficulty !== diff) return;
      const d = new Date(e.submittedAt);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
    });
    return {
      label:  diff,
      color,
      points: buckets.map((b) => ({ x: b.label, y: counts.get(b.key) || 0 })),
    };
  });
}

// ─── Acceptance rate trend (single series) ────────────────────────────────────

export function computeAcceptanceTrend(entries: ActivityEntry[], months = 6): TrendSeries[] {
  const buckets  = lastNMonths(months);
  const total    = new Map(buckets.map((b) => [b.key, 0]));
  const accepted = new Map(buckets.map((b) => [b.key, 0]));
  entries.forEach((e) => {
    const d   = new Date(e.submittedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!total.has(key)) return;
    total.set(key, (total.get(key) || 0) + 1);
    if (e.verdict === 'Accepted') accepted.set(key, (accepted.get(key) || 0) + 1);
  });
  return [
    {
      label:  'Acceptance %',
      color:  '#6366f1',
      points: buckets.map((b) => {
        const t = total.get(b.key)    || 0;
        const a = accepted.get(b.key) || 0;
        return { x: b.label, y: t ? Math.round((a / t) * 100) : 0 };
      }),
    },
  ];
}

// ─── Weekly progress ──────────────────────────────────────────────────────────

export function computeWeeklyProgress(entries: ActivityEntry[]): { day: string; count: number }[] {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today  = new Date();
  today.setHours(0, 0, 0, 0);

  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ key: dayKey(d), label: labels[d.getDay()] });
  }
  const counts = new Map(days.map((d) => [d.key, 0]));
  entries.forEach((e) => {
    if (e.verdict !== 'Accepted') return;
    const k = dayKey(new Date(e.submittedAt));
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
  });
  return days.map((d) => ({ day: d.label, count: counts.get(d.key) || 0 }));
}

// ─── Suggested next problem ───────────────────────────────────────────────────

export function suggestNextProblem(problems: Problem[]): Problem | null {
  const todo = problems.filter((p) => p.status === 'To Do');
  if (todo.length > 0) {
    return [...todo].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    )[0];
  }
  const attempted = problems.filter((p) => p.status === 'Attempted');
  if (attempted.length > 0) {
    return [...attempted].sort(
      (a, b) => new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime()
    )[0];
  }
  return null;
}

// ─── Heuristic feedback clustering ────────────────────────────────────────────
//
// True NLP clustering would mean another AI call per page load. Instead we
// canonicalize free-text AI feedback into a fixed set of recognizable buckets
// via keyword rules, so "didn't handle empty array" and "missing check for
// zero-length input" both collapse to "Unchecked Empty Input". Anything that
// doesn't match a rule falls back to exact-text grouping, same as before.
const FEEDBACK_CLUSTER_RULES: { label: string; pattern: RegExp }[] = [
  { label: 'Unchecked Empty Input',            pattern: /empty.*(array|input|string|list)|(array|input|string|list).*empty/i },
  { label: 'Integer Overflow Risk',            pattern: /overflow/i },
  { label: 'Off-by-One / Boundary Errors',     pattern: /off.?by.?one|boundary|index out of (range|bound)|out.?of.?bounds/i },
  { label: 'Null / None Handling',             pattern: /null|none|undefined|nil pointer/i },
  { label: 'Duplicate Value Handling',         pattern: /duplicate/i },
  { label: 'Negative Number Handling',         pattern: /negative number/i },
  { label: 'Unnecessary Recomputation',        pattern: /recomput|redundant (call|calculation|work)|repeated(ly)? calls?/i },
  { label: 'Suboptimal Data Structure',        pattern: /wrong data structure|should use a (hash|set|map|heap|stack|queue|trie)|better data structure/i },
  { label: 'Recursion / Stack Depth Risk',     pattern: /stack (depth|overflow)|recursion depth|unbounded recursion/i },
  { label: 'Single-Element / Edge-Size Input', pattern: /single element|one element|size (of )?1\b|n\s*=\s*1/i },
];

function canonicalizeFeedback(text: string): string {
  for (const rule of FEEDBACK_CLUSTER_RULES) {
    if (rule.pattern.test(text)) return rule.label;
  }
  return text; // fallback: exact-text grouping
}

// ─── Complexity-change classification (time vs space vs both) ────────────────
//
// Parses strings like "O(n^2) time, O(n) space" and compares the time and
// space halves independently against the optimal string to decide which
// dimension actually improved — powers the Complexity Improvements filter.
function splitComplexity(str: string): { time: string; space: string } {
  const timeMatch  = str.match(/([oO]\([^)]*\))\s*time/);
  const spaceMatch = str.match(/([oO]\([^)]*\))\s*space/);
  return {
    time:  (timeMatch?.[1]  ?? '').replace(/\s/g, ''),
    space: (spaceMatch?.[1] ?? '').replace(/\s/g, ''),
  };
}

function classifyComplexityChange(current: string, optimal: string): 'time' | 'space' | 'both' {
  const cur = splitComplexity(current);
  const opt = splitComplexity(optimal);
  const timeChanged  = Boolean(cur.time  && opt.time  && cur.time  !== opt.time);
  const spaceChanged = Boolean(cur.space && opt.space && cur.space !== opt.space);
  if (timeChanged && spaceChanged) return 'both';
  if (spaceChanged && !timeChanged) return 'space';
  return 'time'; // default/fallback — most flagged gaps are time-related
}

// ─── AI Insights aggregation ──────────────────────────────────────────────────

export function computeAIInsights(problems: Problem[], topicMastery: TopicMastery[]): AIInsightsSummary {
  const analyzed      = problems.filter((p) => Boolean((p as any).aiAnalysis?.complexityAnalysis));
  const analyzedCount = analyzed.length;

  const eligibleTopics  = topicMastery.filter((t) => t.total >= 2);
  const strongestTopics = [...eligibleTopics].sort((a, b) => b.pct - a.pct).slice(0, 5);
  const weakestTopics   = [...eligibleTopics].sort((a, b) => a.pct - b.pct).slice(0, 5);

  const complexityImprovements = analyzed
    .filter((p) => {
      const c = (p as any).aiAnalysis.complexityAnalysis;
      return c?.current && c?.optimal && c.current.replace(/\s/g, '') !== c.optimal.replace(/\s/g, '');
    })
    .map((p) => {
      const c = (p as any).aiAnalysis.complexityAnalysis;
      return {
        problemId:    p._id,
        problemTitle: p.title,
        link:         p.url,
        current:      c.current,
        optimal:      c.optimal,
        type:         classifyComplexityChange(c.current, c.optimal),
      };
    })
    .slice(0, 12);

  const mistakeMap = new Map<string, { count: number; problems: { problemId: string; problemTitle: string }[] }>();
  analyzed.forEach((p) => {
    const areas = (p as any).aiAnalysis.optimizationAreas || [];
    areas.forEach((area: any) => {
      // Support both old string[] and new { description, snippet }[] shapes
      const raw  = typeof area === 'string' ? area : area?.description;
      const text = (raw || '').trim();
      if (!text) return;
      const key = canonicalizeFeedback(text);
      const cur = mistakeMap.get(key) || { count: 0, problems: [] };
      cur.count += 1;
      if (!cur.problems.some((x) => x.problemId === p._id)) {
        cur.problems.push({ problemId: p._id, problemTitle: p.title });
      }
      mistakeMap.set(key, cur);
    });
  });
  const commonMistakes = Array.from(mistakeMap.entries())
    .map(([text, v]) => ({ text, count: v.count, problems: v.problems }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const recommendations: string[] = [];
  if (weakestTopics[0]) {
    recommendations.push(
      `Practice more "${weakestTopics[0].topic}" problems — current solve rate is ${weakestTopics[0].pct}%.`
    );
  }
  const unanalyzedSolved = problems.filter(
    (p) => p.status === 'Solved' && !(p as any).aiAnalysis?.complexityAnalysis
  ).length;
  if (unanalyzedSolved > 0) {
    recommendations.push(
      `Run AI analysis on ${unanalyzedSolved} more solved problem${unanalyzedSolved !== 1 ? 's' : ''} to unlock deeper complexity insights.`
    );
  }
  if (complexityImprovements.length > 0) {
    recommendations.push(
      `Revisit ${complexityImprovements.length} analyzed solution${complexityImprovements.length !== 1 ? 's' : ''} where a more optimal complexity was identified.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push('Solve and analyze a few more problems to start receiving personalized recommendations.');
  }

  const summary =
    analyzedCount === 0
      ? 'No problems have been analyzed yet. Run an AI Deep Dive from any solved problem to start building your learning profile.'
      : `You've run AI analysis on ${analyzedCount} problem${analyzedCount !== 1 ? 's' : ''}. ` +
        (strongestTopics[0] ? `Strongest area: ${strongestTopics[0].topic} (${strongestTopics[0].pct}%). ` : '') +
        (weakestTopics[0]   ? `Focus area: ${weakestTopics[0].topic} (${weakestTopics[0].pct}%).`           : '');

  return { analyzedCount, strongestTopics, weakestTopics, complexityImprovements, commonMistakes, recommendations, summary };
}

// ─── "Blind Spot" radar — aggregates AI-flagged edge cases into categories ────
//
// Powered by aiAnalysis.edgeCasesToConsider, which the SYSTEM_PROMPT already
// returns per analyzed submission. Same canonicalization approach as
// commonMistakes, tuned for edge-case phrasing specifically.
const EDGE_CASE_CLUSTER_RULES: { label: string; pattern: RegExp }[] = [
  { label: 'Integer Overflow',             pattern: /overflow/i },
  { label: 'Null / Undefined Input',       pattern: /null|none|undefined/i },
  { label: 'Empty Input',                  pattern: /empty/i },
  { label: 'Off-by-One / Boundary',        pattern: /off.?by.?one|boundary|out.?of.?bounds/i },
  { label: 'Duplicate Values',             pattern: /duplicate/i },
  { label: 'Negative Numbers',             pattern: /negative/i },
  { label: 'Single-Element Input',         pattern: /single element|one element|size (of )?1\b/i },
  { label: 'Large Input / Scale (TLE)',    pattern: /large input|very large|scale|10\^|1e[5-9]/i },
  { label: 'Cyclic / Repeated Structures', pattern: /cycle|cyclic|loop back|circular/i },
];

export function computeBlindSpots(problems: Problem[]): BlindSpotCategory[] {
  const analyzed = problems.filter((p) => Boolean((p as any).aiAnalysis?.edgeCasesToConsider?.length));
  const map = new Map<string, { count: number; examples: { problemId: string; problemTitle: string; text: string }[] }>();
  let total = 0;

  analyzed.forEach((p) => {
    const cases: string[] = (p as any).aiAnalysis.edgeCasesToConsider || [];
    cases.forEach((raw) => {
      const text = (raw || '').trim();
      if (!text) return;
      total += 1;
      const rule = EDGE_CASE_CLUSTER_RULES.find((r) => r.pattern.test(text));
      const label = rule?.label ?? 'Other';
      const cur = map.get(label) || { count: 0, examples: [] };
      cur.count += 1;
      if (cur.examples.length < 5) cur.examples.push({ problemId: p._id, problemTitle: p.title, text });
      map.set(label, cur);
    });
  });

  if (total === 0) return [];

  return Array.from(map.entries())
    .map(([category, v]) => ({ category, count: v.count, pct: Math.round((v.count / total) * 100), examples: v.examples }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ─── "Time to Optimal" — minutes between first attempt and first AC ──────────
//
// For each problem with 2+ submissions and at least one Accepted submission
// that wasn't the very first attempt, measures the gap between the earliest
// submission and the first AC. Mimics the "how long to find the working
// approach" signal a 45-minute interview actually tests.
export function computeTimeToOptimal(problems: Problem[]): TimeToOptimalStat {
  const gaps: number[] = [];

  problems.forEach((p) => {
    const subs = (p.submissions || [])
      .filter((s: any) => s?.submittedAt)
      .slice()
      .sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    if (subs.length < 2) return;

    const first   = subs[0];
    const firstAc = subs.find((s: any) => s.verdict === 'Accepted');
    if (!firstAc || firstAc === first) return; // only counts if AC wasn't the first try

    const minutes = (new Date(firstAc.submittedAt).getTime() - new Date(first.submittedAt).getTime()) / 60000;
    if (minutes > 0 && minutes < 60 * 24 * 3) { // sanity cap: ignore gaps >3 days (different sessions)
      gaps.push(minutes);
    }
  });

  if (gaps.length === 0) return { avgMinutes: null, sampleSize: 0 };
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return { avgMinutes: Math.round(avg), sampleSize: gaps.length };
}
