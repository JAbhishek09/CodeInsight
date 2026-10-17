import { useQuery } from '@tanstack/react-query';
import api from '../api/axiosInstance';

export interface AnalyticsSummary {
  byPlatform: { _id: string; count: number }[];
  verdictDist: { _id: string; count: number }[];
  needsAnalysis: number;
}

export function useAnalytics() {
  const query = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: async () => ((await api.get('/analytics/summary')).data?.data ?? null) as AnalyticsSummary | null,
  });
  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error ? query.error.message : null,
  };
}
