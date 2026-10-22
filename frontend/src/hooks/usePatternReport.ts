import { useQuery } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import type { PatternReport } from '../types/pattern';

/** Per-pattern report and mix-up grid for the Analytics "Patterns" tab. */
export function usePatternReport() {
  return useQuery({
    queryKey: ['analytics', 'patterns'],
    queryFn: async () => (await api.get('/analytics/patterns')).data?.data as PatternReport,
  });
}
