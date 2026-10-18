import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import type { DrillDeck, PatternFeedback, TodayPlan } from '../types/pattern';

export function useToday() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
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

export function useDrillAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, predicted }: { slug: string; predicted: string }) =>
      (await api.post('/predictions', { slug, predicted, source: 'drill' })).data?.data?.feedback as PatternFeedback,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['predictions'] });
      qc.invalidateQueries({ queryKey: ['practice'] });
    },
  });
}
