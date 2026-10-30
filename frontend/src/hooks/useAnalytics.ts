import { useQuery } from '@tanstack/react-query';
import api from '../api/axiosInstance';

// Mirrors GET /api/analytics/summary — see backend/docs/analytics-api.md
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Div1' | 'Div2' | 'Div3' | 'unrated' | 'unknown';
type Verdict = 'Accepted' | 'Wrong Answer' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'Pending';

export type AnalyticsPlatform = 'all' | 'leetcode' | 'codeforces';

interface SolvedCount { total: number; solved: number }

export interface AnalyticsSummary {
  platform: AnalyticsPlatform;
  timezone: string;
  generatedAt: string;
  range: { from: string; to: string };
  totals: {
    problems: number;
    solved: number;
    attempted: number;
    solvedUndated: number;
    submissions: number;
    acceptedSubmissions: number;
    acceptanceRate: number | null;
    aiAnalyzed: number;
    aiStale: number;
  };
  byDifficulty: Record<Difficulty, SolvedCount>;
  byPlatform: Record<'leetcode' | 'codeforces' | 'manual', SolvedCount>;
  /** byDifficulty only on days with solves. */
  solvedByDay: { date: string; count: number; byDifficulty?: Partial<Record<Difficulty, number>> }[];
  solvedByMonth: { month: string; total: number; byDifficulty: Record<Difficulty, number> }[];
  submissionsByDay: { date: string; count: number; accepted: number }[];
  streak: { current: number; longest: number; activeToday: boolean; lastActiveDay: string | null };
  today: { date: string; solved: number; target: number; remaining: number; goalMet: boolean };
  topics: { tag: string; total: number; solved: number; attempted: number }[];
  /** LeetCode tags are being fetched in the background for problems that came without them; ask again soon. */
  topicsLoading?: boolean;
  languages: { language: string; count: number }[];
  verdicts: Record<Verdict, number> & { other?: number };
}

export function useAnalytics(platform: AnalyticsPlatform = 'all') {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const query = useQuery({
    queryKey: ['analytics', 'summary', platform, tz],
    queryFn: async () =>
      ((await api.get('/analytics/summary', { params: { platform, tz } })).data?.data ?? null) as AnalyticsSummary | null,
  });
  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error ? query.error.message : null,
    fetching: query.isFetching,
    refetch: query.refetch,
  };
}
