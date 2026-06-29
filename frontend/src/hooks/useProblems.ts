import { useState, useEffect, useCallback } from 'react';
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

  const fetchProblems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Always pass params object (even if empty) — avoids undefined being passed to axios
      const params: Record<string, string> = {};
      if (filters.difficulty) params.difficulty = filters.difficulty;
      if (filters.status) params.status = filters.status;
      if (filters.platform) params.platform = filters.platform;
      if (filters.search) params.search = filters.search;
      const res = await getProblems(params);
      setProblems(res?.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load problems');
    } finally {
      setLoading(false);
    }
  }, [filters.difficulty, filters.status, filters.platform, filters.search]);

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
