import { useState, useEffect, useCallback, useRef } from 'react';
import { getProblems, deleteProblem, updateProblem } from '../api/problems.api';

export interface Problem {
  _id: string;
  title: string;
  url?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Div1' | 'Div2' | 'Div3' | 'unrated';
  status: 'Solved' | 'Attempted' | 'To Do';
  category: string;
  notes?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  platform: 'leetcode' | 'codeforces' | 'manual';
  createdAt?: string;
  updatedAt?: string;
  submissions?: any[];
  tags?: string[];
  aiAnalysis?: any;
  aiAnalysisStatus?: 'idle' | 'pending' | 'ready' | 'error';
}

interface Filters {
  difficulty?: string;
  status?: string;
  platform?: string;
  search?: string;
}

export function useProblems(filters: Filters = {}) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the free-text search so we don't fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search ?? '');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search ?? ''), 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  // Monotonic request id — responses from superseded requests are ignored so a
  // slow, stale response can't overwrite a newer one.
  const requestIdRef = useRef(0);

  const fetchProblems = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      // Always pass params object (even if empty) — avoids undefined being passed to axios
      const params: Record<string, string> = {};
      if (filters.difficulty) params.difficulty = filters.difficulty;
      if (filters.status) params.status = filters.status;
      if (filters.platform) params.platform = filters.platform;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await getProblems(params);
      if (requestId !== requestIdRef.current) return;
      setProblems(res?.data || []);
    } catch (e: any) {
      if (requestId !== requestIdRef.current) return;
      setError(e.message || 'Failed to load problems');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [filters.difficulty, filters.status, filters.platform, debouncedSearch]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const removeProblem = async (id: string) => {
    await deleteProblem(id);
    setProblems((prev) => prev.filter((p) => p._id !== id));
  };

  const toggleStatus = async (id: string, newStatus: 'Solved' | 'Attempted' | 'To Do') => {
    await updateProblem(id, { status: newStatus });
    setProblems((prev) =>
      prev.map((p) => (p._id === id ? { ...p, status: newStatus } : p))
    );
  };

  return { problems, loading, error, refetch: fetchProblems, removeProblem, toggleStatus };
}
