import { useQuery } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import type { PatternDetail, PatternsOverview } from '../types/pattern';

export function usePatterns() {
  return useQuery({
    queryKey: ['patterns'],
    queryFn: async () => (await api.get('/patterns')).data?.data as PatternsOverview,
  });
}

export function usePattern(key: string | undefined) {
  return useQuery({
    queryKey: ['patterns', key],
    queryFn: async () => (await api.get(`/patterns/${key}`)).data?.data as PatternDetail,
    enabled: Boolean(key),
  });
}
