import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import type { DrillDeck, DrillStreak, PatternFeedback, TodayPlan } from '../types/pattern';

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function useToday() {
  const tz = timeZone();
  return useQuery({
    queryKey: ['practice', 'today', tz],
    queryFn: async () => (await api.get('/practice/today', { params: { tz } })).data?.data as TodayPlan,
  });
}

export function useCompleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, result }: { id: string; result: 'easy' | 'hard' }) =>
      (await api.post(`/practice/reviews/${id}`, { result })).data?.data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice'] }),
  });
}

/** A guess-the-pattern deck. Kept fixed for the session — "New deck" refetches. */
export function useDrill(pattern: string | null) {
  return useQuery({
    queryKey: ['drill', pattern ?? 'mixed'],
    queryFn: async () => (await api.get('/practice/drill', { params: pattern ? { pattern } : {} })).data?.data as DrillDeck,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

/** Today's drill cards against the daily target, and the drill streak. Refreshed after every answer. */
export function useDrillStreak() {
  const tz = timeZone();
  return useQuery({
    queryKey: ['practice', 'drill-streak', tz],
    queryFn: async () => (await api.get('/practice/drill/streak', { params: { tz } })).data?.data as DrillStreak,
  });
}

export function useDrillAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, predicted, hinted }: { slug: string; predicted: string; hinted: boolean }) =>
      (await api.post('/predictions', { slug, predicted, source: 'drill', hinted })).data?.data?.feedback as PatternFeedback,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['predictions'] });
      qc.invalidateQueries({ queryKey: ['practice'] });
      qc.invalidateQueries({ queryKey: ['analytics', 'patterns'] });
    },
  });
}
