import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProblem,
  deleteProblem,
  getProblemById,
  getProblems,
  updateProblem,
  type ProblemPayload,
} from '../api/problems.api';
import { triggerAnalysis } from '../api/analysis.api';
import type { Problem, ProblemStatus } from '../types/problem';

export type { Problem };

export interface ProblemFilters {
  difficulty?: string;
  status?: string;
  platform?: string;
  search?: string;
}

export const problemKeys = {
  all: ['problems'] as const,
  list: (params: Record<string, string> = {}) => ['problems', 'list', params] as const,
  detail: (id: string) => ['problems', 'detail', id] as const,
};

/** Drop empty filter values so `{}` and `{ status: '' }` share a cache entry. */
function toParams(filters: ProblemFilters): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
  return params;
}

/** GET /problems with optional filters → Problem[]. */
export function useProblemList(filters: ProblemFilters = {}) {
  const params = toParams(filters);
  return useQuery({
    queryKey: problemKeys.list(params),
    queryFn: async () => ((await getProblems(params))?.data ?? []) as Problem[],
    placeholderData: keepPreviousData,
  });
}

/** Every tracked problem (no filters) — the source for dashboard/analytics/insights. */
export function useAllProblems() {
  return useProblemList();
}

/** A row from GET /api/problems?view=list — no code or analysis bodies. */
export interface ProblemListItem {
  _id: string;
  title: string;
  platform: string;
  difficulty: string;
  status: ProblemStatus;
  tags: string[];
  url?: string;
  submissionCount: number;
  acceptedCount: number;
  hasCode: boolean;
  hasAiAnalysis: boolean;
  aiStatus: string;
  aiIsStale: boolean;
  latestVerdict: string | null;
  latestLanguage: string | null;
  lastSubmittedAt: string | null;
  firstSolvedAt: string | null;
}

export interface ProblemListPage {
  data: ProblemListItem[];
  page: number;
  limit: number;
  total: number;
}

/** Lightweight, paginated problem list (GET /api/problems?view=list). */
export function useProblemListView(params: Record<string, string | number> = {}) {
  const qs = Object.fromEntries(Object.entries({ view: 'list', ...params }).map(([k, v]) => [k, String(v)]));
  return useQuery({
    queryKey: problemKeys.list(qs),
    queryFn: async () => (await getProblems(qs)) as ProblemListPage,
    placeholderData: keepPreviousData,
  });
}

/** A 'pending' analysis older than this is a dead job (matches the backend). */
export const ANALYSIS_STALE_PENDING_MS = 3 * 60 * 1000;

function isAnalysisRunning(problem: Problem | null | undefined) {
  const meta = problem?.aiAnalysisMeta;
  if (meta?.status !== 'pending') return false;
  const since = meta.pendingSince ? new Date(meta.pendingSince).getTime() : 0;
  return Date.now() - since < ANALYSIS_STALE_PENDING_MS;
}

/** GET /problems/:id → the problem document. Polls while an AI analysis is running. */
export function useProblem(id: string | undefined) {
  return useQuery({
    queryKey: problemKeys.detail(id ?? ''),
    queryFn: async () => ((await getProblemById(id!))?.data ?? null) as Problem | null,
    enabled: Boolean(id),
    refetchInterval: (query) => (isAnalysisRunning(query.state.data) ? 4000 : false),
  });
}

/**
 * POST /analyze/:id. The problem query is the single source of truth: after the
 * request it's refetched, and keeps polling while the backend reports 'pending'.
 */
export function useAnalyzeProblem(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => triggerAnalysis(id!),
    onSettled: () => qc.invalidateQueries({ queryKey: problemKeys.all }),
  });
}

export function useCreateProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProblemPayload) => createProblem(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: problemKeys.all }),
  });
}

export function useUpdateProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProblemPayload> | { status: ProblemStatus } }) =>
      updateProblem(id, data as Partial<ProblemPayload>),
    onSuccess: (_res, { id, data }) => {
      // Patch cached lists immediately, then refetch in the background.
      qc.setQueriesData<Problem[]>({ queryKey: ['problems', 'list'] }, (prev) =>
        prev?.map((p) => (p._id === id ? { ...p, ...data } as Problem : p))
      );
      qc.invalidateQueries({ queryKey: problemKeys.all });
    },
  });
}

export function useDeleteProblem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProblem(id),
    onSuccess: (_res, id) => {
      qc.setQueriesData<Problem[]>({ queryKey: ['problems', 'list'] }, (prev) => prev?.filter((p) => p._id !== id));
      qc.invalidateQueries({ queryKey: problemKeys.all });
    },
  });
}

/**
 * Problems page hook: filtered list (search debounced 300ms) plus delete and
 * status-toggle actions. Errors from the actions are thrown to the caller.
 */
export function useProblems(filters: ProblemFilters = {}) {
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search ?? '');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search ?? ''), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const query = useProblemList({ ...filters, search: debouncedSearch });
  const del = useDeleteProblem();
  const update = useUpdateProblem();

  return {
    problems: query.data ?? [],
    loading: query.isPending,
    fetching: query.isFetching,
    error: query.error ? query.error.message || 'Failed to load problems' : null,
    refetch: query.refetch,
    removeProblem: (id: string) => del.mutateAsync(id).then(() => undefined),
    toggleStatus: (id: string, status: ProblemStatus) =>
      update.mutateAsync({ id, data: { status } }).then(() => undefined),
  };
}
