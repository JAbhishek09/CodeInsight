import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import type { PatternFeedback, PredictionStats } from '../types/pattern';

export function usePredictionStats() {
  return useQuery({
    queryKey: ['predictions', 'stats'],
    queryFn: async () => (await api.get('/predictions/stats')).data?.data as PredictionStats,
  });
}

/** Feedback from the latest resolved guess on a problem (extension or app). */
export function useLatestFeedback(slug: string | undefined) {
  return useQuery({
    queryKey: ['predictions', 'latest', slug],
    queryFn: async () => ((await api.get('/predictions/latest', { params: { slug } })).data?.data ?? null) as PatternFeedback | null,
    enabled: Boolean(slug),
  });
}

/** Guess a pattern in the app — resolves immediately with feedback. */
export function useGuessPattern(slug: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (predicted: string) =>
      (await api.post('/predictions', { slug, predicted, source: 'app' })).data?.data?.feedback as PatternFeedback,
    onSuccess: (feedback) => {
      qc.setQueryData(['predictions', 'latest', slug], feedback);
      qc.invalidateQueries({ queryKey: ['predictions', 'stats'] });
    },
  });
}
