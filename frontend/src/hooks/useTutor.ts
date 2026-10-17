import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axiosInstance';
import type { TutorAnswer, TutorState } from '../types/pattern';

export function useTutor(problemId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['tutor', problemId],
    queryFn: async () => (await api.get(`/tutor/${problemId}`)).data?.data as TutorState,
    enabled: Boolean(problemId) && enabled,
  });
}

export function useAskTutor(problemId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submissionId?: string) =>
      (await api.post(`/tutor/${problemId}`, submissionId ? { submissionId } : {})).data?.data as TutorAnswer,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tutor', problemId] }),
  });
}
