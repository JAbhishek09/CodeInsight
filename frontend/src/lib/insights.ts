/**
 * Turns the AI analyses returned by GET /api/analytics/ai-insights into
 * patterns: complexity gaps, recurring feedback themes and edge-case blind
 * spots. Free text is grouped with keyword rules — no extra AI call.
 */

export interface AnalyzedProblem {
  _id: string;
  title: string;
  url: string | null;
  platform: string;
  difficulty: string | null;
  tags: string[];
  generatedAt: string | null;
  isStale: boolean;
  complexity: { current: string; optimal: string };
  feedback: string[];
  edgeCases: string[];
}

export interface AiInsightsData {
  platform: string;
  counts: { solved: number; withCode: number; analyzed: number; stale: number; readyToReview: number };
  timeToAccepted: { sampleSize: number; avgMinutes: number | null; medianMinutes: number | null };
  analyzed: AnalyzedProblem[];
}

export interface Theme {
  label: string;
  /** Number of analyses that mention this theme (each problem counted once). */
  problems: { _id: string; title: string; text: string }[];
}

export interface ComplexityGap {
  problem: AnalyzedProblem;
  kind: 'time' | 'space' | 'both';
}

// ── Grouping rules ────────────────────────────────────────────────────────────

const FEEDBACK_RULES: { label: string; pattern: RegExp }[] = [
  { label: 'Unchecked empty input',          pattern: /empty.*(array|input|string|list)|(array|input|string|list).*empty/i },
  { label: 'Integer overflow risk',          pattern: /overflow/i },
  { label: 'Off-by-one or boundary errors',  pattern: /off.?by.?one|boundary|index out of (range|bound)|out.?of.?bounds/i },
  { label: 'Null or missing values',         pattern: /\bnull\b|\bnone\b|undefined|nil pointer/i },
  { label: 'Duplicate values',               pattern: /duplicate/i },
  { label: 'Negative numbers',               pattern: /negative number/i },
  { label: 'Repeated work',                  pattern: /recomput|redundant|repeated(ly)?|re-?process|unnecessary (copy|copies|work|loop)/i },
  { label: 'Better data structure available', pattern: /data structure|use a (hash|set|map|heap|stack|queue|trie|deque)|hash ?map|hash ?set|unordered_/i },
  { label: 'Extra memory you can avoid',     pattern: /extra (space|memory)|in.?place|auxiliary|space complexity/i },
  { label: 'String building cost',           pattern: /string (concat|build|copy)|stringbuilder|\+= .*string|substr/i },
  { label: 'Sorting when not needed',        pattern: /sort(ing)? (is )?(not needed|unnecessary)|avoid sort/i },
  { label: 'Recursion depth risk',           pattern: /stack (depth|overflow)|recursion depth|unbounded recursion/i },
];

const EDGE_CASE_RULES: { label: string; pattern: RegExp }[] = [
  { label: 'Integer overflow',          pattern: /overflow|int_max|int_min|2\^31|large (sum|product|value)/i },
  { label: 'Empty input',               pattern: /empty/i },
  { label: 'Null or missing input',     pattern: /\bnull\b|\bnone\b|undefined|nullptr/i },
  { label: 'Single element',            pattern: /single (element|node|character|char|digit|item)|one element|size (of )?1\b|length (of )?1\b|`?\bn`?\s*(=|==|is)\s*1\b/i },
  { label: 'Boundaries and off-by-one', pattern: /off.?by.?one|boundar|out.?of.?bounds|first (or|and) last|edge of the/i },
  { label: 'Duplicates',                pattern: /duplicate|repeated (value|element)|same value/i },
  { label: 'Negative numbers',          pattern: /negative/i },
  { label: 'Large input size',          pattern: /large input|very large|maximum (size|constraint)|10\^[4-9]|1e[4-9]|time limit/i },
  { label: 'Cycles',                    pattern: /cycle|cyclic|circular/i },
  { label: 'Skewed or unbalanced trees', pattern: /skewed|unbalanced|degenerate|linked.?list.?like/i },
  { label: 'All values the same',       pattern: /all (the )?(same|equal|identical)/i },
  { label: 'Sorted or reversed input',  pattern: /already sorted|reverse(d)? sorted|descending order|ascending order/i },
  { label: 'Nested structures',         pattern: /nested|nesting/i },
  { label: 'Extreme values',            pattern: /extreme|smallest|largest|\b(min|max)(imum)?\b.{0,25}\b(value|digit|cost|number)s?\b/i },
];

function groupThemes(
  problems: AnalyzedProblem[],
  pick: (p: AnalyzedProblem) => string[],
  rules: { label: string; pattern: RegExp }[]
): { themes: Theme[]; other: number } {
  const map = new Map<string, Theme>();
  let other = 0;
  for (const p of problems) {
    const seen = new Set<string>();
    for (const text of pick(p)) {
      const rule = rules.find((r) => r.pattern.test(text));
      if (!rule) { other += 1; continue; }
      if (seen.has(rule.label)) continue; // count each problem once per theme
      seen.add(rule.label);
      const t = map.get(rule.label) ?? { label: rule.label, problems: [] };
      t.problems.push({ _id: p._id, title: p.title, text });
      map.set(rule.label, t);
    }
  }
  const themes = [...map.values()].sort((a, b) => b.problems.length - a.problems.length);
  return { themes, other };
}

export const feedbackThemes = (problems: AnalyzedProblem[]) => groupThemes(problems, (p) => p.feedback, FEEDBACK_RULES);
export const edgeCaseThemes = (problems: AnalyzedProblem[]) => groupThemes(problems, (p) => p.edgeCases, EDGE_CASE_RULES);

// ── Complexity gaps ───────────────────────────────────────────────────────────

/** "O(n^2) time, O(n) space" → { time: 'o(n^2)', space: 'o(n)' } */
function splitComplexity(str: string) {
  const norm = (s?: string) => (s ?? '').replace(/\s/g, '').toLowerCase();
  const time = str.match(/(O\([^)]*\))\s*time/i)?.[1];
  const space = str.match(/(O\([^)]*\))\s*space/i)?.[1];
  return { time: norm(time), space: norm(space), whole: norm(str) };
}

export function complexityGaps(problems: AnalyzedProblem[]): ComplexityGap[] {
  const gaps: ComplexityGap[] = [];
  for (const p of problems) {
    const cur = splitComplexity(p.complexity.current);
    const opt = splitComplexity(p.complexity.optimal);
    if (!cur.whole || !opt.whole || cur.whole === opt.whole) continue;
    const time = !!(cur.time && opt.time && cur.time !== opt.time);
    const space = !!(cur.space && opt.space && cur.space !== opt.space);
    if (!time && !space && cur.time && opt.time) continue; // only wording differs
    gaps.push({ problem: p, kind: time && space ? 'both' : space ? 'space' : 'time' });
  }
  return gaps;
}

/** "18 min", "2 h 5 min". */
export function formatMinutes(m: number | null): string {
  if (m === null) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}
