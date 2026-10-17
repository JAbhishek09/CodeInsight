import { useQuery } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import type { AiInsightsData } from '../lib/insights';
import type { AnalyticsPlatform } from './useAnalytics';

/** GET /api/analytics/ai-insights — analysis text (no code), coverage, time to accepted. */
export function useAiInsights(platform: AnalyticsPlatform = 'all') {
  return useQuery({
    queryKey: ['analytics', 'ai-insights', platform],
    queryFn: async () =>
      (await api.get('/analytics/ai-insights', { params: { platform } })).data?.data as AiInsightsData,
  });
}
