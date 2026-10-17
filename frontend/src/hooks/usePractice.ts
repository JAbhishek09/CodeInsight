import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import type { TodayPlan } from '../types/pattern';

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
