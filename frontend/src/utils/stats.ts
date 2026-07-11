/**
 * utils/stats.ts
 *
 * Client-side derived analytics. CodeInsight's `GET /api/problems` already
 * returns full Problem documents (incl. embedded `submissions[]`, `tags`,
 * `aiAnalysis`), so most "analytics platform" metrics — streaks, heatmap,
 * topic mastery, trends — can be computed here without new backend routes.
 *
 * Anything that *would* benefit from a dedicated backend aggregation
 * (e.g. semantic clustering of AI-written "common mistakes" text, or a
 * real problem-catalog-based recommendation engine) is called out with a
 * `TODO(backend)` comment at the point it's approximated client-side.
 */

import { Problem } from '../components/ProblemCard';

// ─── Shared types ───────────────────────────────────────────────────────────

export interface ActivityEntry {
  problemId: string;
  problemTitle: string;
  platform: string;
  difficulty: string;
  verdict: string;
  language: string;
  submittedAt: string;
}

export interface TopicMastery {
  topic: string;
  solved: number;
  total: number;
  pct: number;
}

export interface TrendPoint {
  x: string;
  y: number;
}

export interface TrendSeries {
  label: string;
  color: string;
  points: TrendPoint[];
}

export interface AIInsightsSummary {
  analyzedCount: number;
  strongestTopics: TopicMastery[];
  weakestTopics: TopicMastery[];
  complexityImprovements: { problemId: string; problemTitle: string; current: string; optimal: string }[];
  commonMistakes: { text: string; count: number }[];
  recommendations: string[];
  summary: string;
}

// ─── Date helpers ───────────────────────────────────────────────────────────

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTH_LABEL = (d: Date) => d.toLocaleString(undefined, { month: 'short' });

// ─── Flatten ────────────────────────────────────────────────────────────────

/** Flattens every submission across every problem into a single activity timeline. */
export function flattenSubmissions(problems: Problem[]): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  problems.forEach((p) => {
    (p.submissions || []).forEach((s: any) => {
      if (!s?.submittedAt) return;
      out.push({
        problemId: p._id,
        problemTitle: p.title,
        platform: p.platform || 'manual',
        difficulty: p.difficulty,
        verdict: s.verdict,
        language: s.language,
        submittedAt: s.submittedAt,
      });
    });
  });
  return out;
}

// ─── Hero stats ─────────────────────────────────────────────────────────────

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

  // Current streak — walk backward from today. If today has no solve yet,
  // start counting from yesterday so an in-progress streak isn't shown as broken.
  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!solvedDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (solvedDays.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak — scan all solved days for the longest consecutive run.
  const sortedDays = Array.from(solvedDays).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const cur = new Date(sortedDays[i]);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86400000);
    run = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  return { current, longest: Math.max(longest, current) };
}

export function countAIAnalyses(problems: Problem[]): number {
  return problems.filter((p) => Boolean((p as any).aiAnalysis?.complexityAnalysis)).length;
}

// ─── Heatmap ────────────────────────────────────────────────────────────────

/** date(YYYY-MM-DD) → count of Accepted submissions that day. */
export function computeHeatmapData(entries: ActivityEntry[]): Record<string, number> {
  const map: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.verdict !== 'Accepted') return;
    const k = dayKey(new Date(e.submittedAt));
    map[k] = (map[k] || 0) + 1;
  });
  return map;
}

// ─── Topic mastery ──────────────────────────────────────────────────────────

export function computeTopicMastery(problems: Problem[]): TopicMastery[] {
  const map = new Map<string, { solved: number; total: number }>();
  problems.forEach((p) => {
    const topics = (p as any).tags?.length ? (p as any).tags : [p.category || 'General'];
    const isSolved =
      p.status === 'Solved' || (p.submissions || []).some((s: any) => s.verdict === 'Accepted');
    topics.forEach((raw: string) => {
      const key = (raw || '').trim();
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
      total: v.total,
      pct: v.total ? Math.round((v.solved / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

// ─── Difficulty breakdown ───────────────────────────────────────────────────

export function computeDifficultyBreakdown(problems: Problem[]) {
  const byDiff = (d: string) => problems.filter((p) => p.difficulty === d);
  const easy = byDiff('Easy');
  const medium = byDiff('Medium');
  const hard = byDiff('Hard');
  return {
    easy: easy.length,
    medium: medium.length,
    hard: hard.length,
    easySolved: easy.filter((p) => p.status === 'Solved').length,
    mediumSolved: medium.filter((p) => p.status === 'Solved').length,
    hardSolved: hard.filter((p) => p.status === 'Solved').length,
  };
}

// ─── Recent activity ────────────────────────────────────────────────────────

export function computeRecentActivity(entries: ActivityEntry[], limit = 6): ActivityEntry[] {
  return [...entries]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, limit);
}

// ─── Language usage ─────────────────────────────────────────────────────────

const LANGUAGE_LABELS: Record<string, string> = {
  cpp: 'C++',
  c: 'C',
  java: 'Java',
  python3: 'Python 3',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  golang: 'Go',
  rust: 'Rust',
  kotlin: 'Kotlin',
};

export function computeLanguageUsage(entries: ActivityEntry[]): { topic: string; count: number }[] {
  const map = new Map<string, number>();
  entries.forEach((e) => {
    if (!e.language) return;
    const label = LANGUAGE_LABELS[e.language] || e.language;
    map.set(label, (map.get(label) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Month-bucket helper (shared by trend series below) ────────────────────

function lastNMonths(n: number): { key: string; label: string }[] {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_LABEL(d) });
  }
  return out;
}

// ─── Solving trend (single series — accepted submissions / month) ─────────

export function computeSolvingTrend(entries: ActivityEntry[], months = 6): TrendSeries[] {
  const buckets = lastNMonths(months);
  const counts = new Map(buckets.map((b) => [b.key, 0]));
  entries.forEach((e) => {
    if (e.verdict !== 'Accepted') return;
    const d = new Date(e.submittedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [
    {
      label: 'Problems Solved',
      color: '#ec4899',
      points: buckets.map((b) => ({ x: b.label, y: counts.get(b.key) || 0 })),
    },
  ];
}

// ─── Difficulty trend (3 series — Easy/Medium/Hard accepted / month) ──────

export function computeDifficultyTrend(entries: ActivityEntry[], months = 6): TrendSeries[] {
  const buckets = lastNMonths(months);
  const diffs: Array<{ key: 'Easy' | 'Medium' | 'Hard'; color: string }> = [
    { key: 'Easy', color: '#10b981' },
    { key: 'Medium', color: '#f59e0b' },
    { key: 'Hard', color: '#f43f5e' },
  ];
  return diffs.map(({ key: diff, color }) => {
    const counts = new Map(buckets.map((b) => [b.key, 0]));
    entries.forEach((e) => {
      if (e.verdict !== 'Accepted' || e.difficulty !== diff) return;
      const d = new Date(e.submittedAt);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
    });
    return {
      label: diff,
      color,
      points: buckets.map((b) => ({ x: b.label, y: counts.get(b.key) || 0 })),
    };
  });
}

// ─── Acceptance rate trend (single series — % accepted / month) ───────────

export function computeAcceptanceTrend(entries: ActivityEntry[], months = 6): TrendSeries[] {
  const buckets = lastNMonths(months);
  const total = new Map(buckets.map((b) => [b.key, 0]));
  const accepted = new Map(buckets.map((b) => [b.key, 0]));
  entries.forEach((e) => {
    const d = new Date(e.submittedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!total.has(key)) return;
    total.set(key, (total.get(key) || 0) + 1);
    if (e.verdict === 'Accepted') accepted.set(key, (accepted.get(key) || 0) + 1);
  });
  return [
    {
      label: 'Acceptance Rate',
      color: '#6366f1',
      points: buckets.map((b) => {
        const t = total.get(b.key) || 0;
        const a = accepted.get(b.key) || 0;
        return { x: b.label, y: t ? Math.round((a / t) * 100) : 0 };
      }),
    },
  ];
}

// ─── Weekly progress (matches WeeklyLineChart's { day, count } shape) ─────

export function computeWeeklyProgress(entries: ActivityEntry[]): { day: string; count: number }[] {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
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

// ─── Suggested next problem ─────────────────────────────────────────────────

/**
 * Suggests a problem to work on next from the user's own tracked list.
 *
 * TODO(backend): once a global problem catalog / recommendation endpoint
 * exists, this should fall back to suggesting *new* problems (matched to
 * the user's weakest topic) when there's nothing queued locally — for now
 * it can only recommend from what the user has already tracked.
 */
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

// ─── AI Insights aggregation ────────────────────────────────────────────────

export function computeAIInsights(problems: Problem[], topicMastery: TopicMastery[]): AIInsightsSummary {
  const analyzed = problems.filter((p) => Boolean((p as any).aiAnalysis?.complexityAnalysis));
  const analyzedCount = analyzed.length;

  const eligibleTopics = topicMastery.filter((t) => t.total >= 2);
  const strongestTopics = [...eligibleTopics].sort((a, b) => b.pct - a.pct).slice(0, 5);
  const weakestTopics = [...eligibleTopics].sort((a, b) => a.pct - b.pct).slice(0, 5);

  const complexityImprovements = analyzed
    .filter((p) => {
      const c = (p as any).aiAnalysis.complexityAnalysis;
      return c?.current && c?.optimal && c.current.replace(/\s/g, '') !== c.optimal.replace(/\s/g, '');
    })
    .map((p) => ({
      problemId: p._id,
      problemTitle: p.title,
      current: (p as any).aiAnalysis.complexityAnalysis.current,
      optimal: (p as any).aiAnalysis.complexityAnalysis.optimal,
    }))
    .slice(0, 6);

  // TODO(backend): exact-string frequency is a rough proxy for "common mistakes".
  // A server-side endpoint that clusters semantically-similar AI feedback across
  // problems (e.g. via embeddings) would surface real patterns instead of only
  // catching verbatim repeats.
  const mistakeMap = new Map<string, number>();
  analyzed.forEach((p) => {
    ((p as any).aiAnalysis.optimizationAreas || []).forEach((area: string) => {
      const key = (area || '').trim();
      if (!key) return;
      mistakeMap.set(key, (mistakeMap.get(key) || 0) + 1);
    });
  });
  const commonMistakes = Array.from(mistakeMap.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

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
        (weakestTopics[0] ? `Focus area: ${weakestTopics[0].topic} (${weakestTopics[0].pct}%).` : '');

  return { analyzedCount, strongestTopics, weakestTopics, complexityImprovements, commonMistakes, recommendations, summary };
}
