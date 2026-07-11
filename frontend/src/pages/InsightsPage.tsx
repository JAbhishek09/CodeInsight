import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProblems } from '../api/problems.api';
import { Problem } from '../components/ProblemCard';
import TopicMasteryBars from '../components/TopicMasteryBars';
import EmptyState from '../components/EmptyState';
import { computeTopicMastery, computeAIInsights } from '../utils/stats';
import {
  Brain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Gauge,
  AlertTriangle,
  Lightbulb,
  BookOpenCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function InsightsPage() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getProblems();
      if (res?.success && res?.data) setProblems(res.data);
    } catch (err) {
      console.error('Failed to load AI insights', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const topicMastery = useMemo(() => computeTopicMastery(problems), [problems]);
  const insights = useMemo(() => computeAIInsights(problems, topicMastery), [problems, topicMastery]);

  const analyzableCount = useMemo(
    () => problems.filter((p) => p.submissions?.some((s: any) => s.code?.trim().length > 0)).length,
    [problems]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">AI Insights</h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              Patterns from your AI-analyzed submissions
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-mono rounded-xl inline-flex items-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-slate-900 rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
          <p className="text-xs font-mono text-slate-500 mt-4 uppercase tracking-wider">Crunching insights...</p>
        </div>
      ) : (
        <>
          {/* Learning Summary */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <h3 className="text-sm font-bold text-slate-100">Learning Summary</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">{insights.summary}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {[
                { label: 'Problems Analyzed', value: insights.analyzedCount },
                { label: 'Ready to Analyze', value: Math.max(analyzableCount - insights.analyzedCount, 0) },
                { label: 'Strong Topics', value: insights.strongestTopics.filter((t) => t.pct >= 70).length },
                { label: 'Focus Topics', value: insights.weakestTopics.filter((t) => t.pct < 40).length },
              ].map((s) => (
                <div key={s.label} className="bg-slate-950 border border-slate-900 rounded-xl p-3 text-center">
                  <p className="text-lg font-extrabold text-white font-mono">{s.value}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strongest / Weakest Topics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <TrendingUp className="text-emerald-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">Strongest Topics</h3>
              </div>
              <TopicMasteryBars data={insights.strongestTopics} limit={5} />
            </div>
            <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <TrendingDown className="text-rose-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">Weakest Topics</h3>
              </div>
              <TopicMasteryBars data={insights.weakestTopics} limit={5} />
            </div>
          </div>

          {/* Complexity Improvements */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
              <Gauge className="text-cyan-400 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-100">Complexity Improvements</h3>
            </div>
            {insights.complexityImprovements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insights.complexityImprovements.map((c) => (
                  <button
                    key={c.problemId}
                    onClick={() => navigate(`/analysis/${c.problemId}`)}
                    className="text-left bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-xl p-4 transition-colors cursor-pointer group"
                  >
                    <p className="text-xs font-bold text-slate-200 truncate group-hover:text-white mb-2">{c.problemTitle}</p>
                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      <span className="text-rose-400 bg-rose-950/30 border border-rose-500/20 px-1.5 py-0.5 rounded">{c.current}</span>
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                      <span className="text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-1.5 py-0.5 rounded">{c.optimal}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Gauge className="w-6 h-6" />}
                title="No complexity gaps found yet"
                description="Run AI Deep Dive analysis on a few more solved problems to surface where a more optimal time/space complexity exists."
              />
            )}
          </div>

          {/* Common Mistakes */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
              <AlertTriangle className="text-amber-400 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-100">Common Mistakes</h3>
            </div>
            {insights.commonMistakes.length > 0 ? (
              <ul className="space-y-2.5">
                {insights.commonMistakes.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 bg-slate-950 border border-slate-900 rounded-xl p-3.5"
                  >
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/30 border border-amber-500/20 rounded-full px-2 py-0.5 shrink-0 mt-0.5">
                      ×{m.count}
                    </span>
                    <span className="text-xs text-slate-300 leading-relaxed">{m.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<AlertTriangle className="w-6 h-6" />}
                title="No recurring feedback yet"
                description="As more of your solutions get analyzed, repeated AI feedback (e.g. recurring optimization suggestions) will surface here."
              />
            )}
          </div>

          {/* AI Recommendations */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
              <Lightbulb className="text-pink-400 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-100">AI Recommendations</h3>
            </div>
            <ul className="space-y-3">
              {insights.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed">
                  <BookOpenCheck className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] font-mono text-slate-600 pt-3 border-t border-slate-950">
              Recommendations are generated from your tracked solve data. Connecting a dedicated recommendation
              backend would allow these to also suggest brand-new problems beyond your tracked list.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
