import { useState, useEffect } from 'react';
import api from '../api/axiosInstance';

interface AnalyticsSummary {
  byPlatform: { _id: string; count: number }[];
  verdictDist: { _id: string; count: number }[];
  needsAnalysis: number;
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/analytics/summary')
      .then((res) => setData(res.data?.data || null))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
