import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProblems } from '../api/problems.api';
import type { Problem } from '../types/problem';
import TopicMasteryBars from '../components/TopicMasteryBars';
import EmptyState from '../components/EmptyState';
import { computeTopicMastery, computeAIInsights, computeBlindSpots, computeTimeToOptimal } from '../utils/stats';
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
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Target,
  Timer,
} from 'lucide-react';

type ComplexityFilter = 'all' | 'time' | 'space';

export default function InsightsPage() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);

  // UX state for the new interactive sections
  const [complexityFilter, setComplexityFilter] = useState<ComplexityFilter>('all');
  const [expandedMistakes, setExpandedMistakes] = useState<Set<string>>(new Set());
  const [expandedBlindSpots, setExpandedBlindSpots] = useState<Set<string>>(new Set());
  const [showRevisitList, setShowRevisitList] = useState(false);

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
  const blindSpots = useMemo(() => computeBlindSpots(problems), [problems]);
  const timeToOptimal = useMemo(() => computeTimeToOptimal(problems), [problems]);

  const analyzableCount = useMemo(
    () => problems.filter((p) => p.submissions?.some((s: any) => s.code?.trim().length > 0)).length,
    [problems]
  );

  const readyCount = Math.max(analyzableCount - insights.analyzedCount, 0);
  const analysisProgressPct = analyzableCount > 0 ? Math.round((insights.analyzedCount / analyzableCount) * 100) : 0;
  const focusTopicsCount = insights.weakestTopics.filter((t) => t.pct < 40).length;
  const focusTopicsWarning = focusTopicsCount > 5;

  const filteredComplexityImprovements = useMemo(() => {
    if (complexityFilter === 'all') return insights.complexityImprovements;
    return insights.complexityImprovements.filter((c) => c.type === complexityFilter || c.type === 'both');
  }, [insights.complexityImprovements, complexityFilter]);

  const toggleMistake = (text: string) => {
    setExpandedMistakes((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text); else next.add(text);
      return next;
    });
  };

  const toggleBlindSpot = (category: string) => {
    setExpandedBlindSpots((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  };

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
                { label: 'Problems Analyzed', value: insights.analyzedCount, warn: false },
                { label: 'Ready to Analyze', value: readyCount, warn: false },
                { label: 'Strong Topics', value: insights.strongestTopics.filter((t) => t.pct >= 70).length, warn: false },
                { label: 'Focus Topics', value: focusTopicsCount, warn: focusTopicsWarning },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`border rounded-xl p-3 text-center transition-colors ${
                    s.warn ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-950 border-slate-900'
                  }`}
                >
                  <p className={`text-lg font-extrabold font-mono ${s.warn ? 'text-amber-400' : 'text-white'}`}>{s.value}</p>
                  <p className={`text-[10px] font-mono mt-0.5 ${s.warn ? 'text-amber-500/80' : 'text-slate-500'}`}>
                    {s.label}{s.warn ? ' ⚠' : ''}
                  </p>
                </div>
              ))}
            </div>

            {/* Progress bar — Analyzed / Ready */}
            {analyzableCount > 0 && (
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>{insights.analyzedCount} analyzed / {analyzableCount} ready</span>
                  <span className="text-slate-400 font-bold">{analysisProgressPct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]"
                    style={{ width: `${analysisProgressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Time-to-Optimal — mimics the "how long to find the working approach" signal a timed interview tests */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-center shrink-0">
              <Timer className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">
                {timeToOptimal.avgMinutes !== null
                  ? <>Average time to optimal: <span className="text-cyan-400 font-mono">{timeToOptimal.avgMinutes} min</span></>
                  : 'Average time to optimal: not enough data yet'}
              </p>
              <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                {timeToOptimal.sampleSize > 0
                  ? `Based on ${timeToOptimal.sampleSize} problem${timeToOptimal.sampleSize !== 1 ? 's' : ''} where the accepted solution wasn't the first submission.`
                  : 'Needs problems with a brute-force attempt followed by a later Accepted submission.'}
              </p>
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
            <div className="flex items-center justify-between gap-2 border-b border-slate-950 pb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Gauge className="text-cyan-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">Complexity Improvements</h3>
              </div>
              {insights.complexityImprovements.length > 0 && (
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 rounded-lg p-0.5">
                  {(['all', 'time', 'space'] as ComplexityFilter[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setComplexityFilter(f)}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                        complexityFilter === f
                          ? 'bg-cyan-950/50 text-cyan-400 border border-cyan-500/30'
                          : 'text-slate-500 hover:text-slate-300 border border-transparent'
                      }`}
                    >
                      {f === 'all' ? 'All' : f === 'time' ? 'Time' : 'Space'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {filteredComplexityImprovements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredComplexityImprovements.map((c) => (
                  <div
                    key={c.problemId}
                    className="bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-xl p-4 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <button
                        onClick={() => navigate(`/analysis/${c.problemId}`)}
                        className="text-left text-xs font-bold text-slate-200 truncate group-hover:text-white cursor-pointer"
                      >
                        {c.problemTitle}
                      </button>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 bg-slate-900 text-slate-500 border border-slate-800">
                        {c.type === 'both' ? 'TIME + SPACE' : c.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono mb-3">
                      <span className="text-rose-400 bg-rose-950/30 border border-rose-500/20 px-1.5 py-0.5 rounded">{c.current}</span>
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                      <span className="text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-1.5 py-0.5 rounded">{c.optimal}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/problems/${c.problemId}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[10px] font-mono font-bold px-2 py-1.5 rounded-lg bg-cyan-950/30 hover:bg-cyan-950/50 text-cyan-400 border border-cyan-500/20 transition-colors cursor-pointer"
                      >
                        Solve Again
                      </button>
                      {c.link && (
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center gap-1 text-[10px] font-mono font-bold px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
                          title="Open on LeetCode"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : insights.complexityImprovements.length > 0 ? (
              <EmptyState
                icon={<Gauge className="w-6 h-6" />}
                title={`No ${complexityFilter} complexity gaps in this filter`}
                description="Try a different filter, or check back after analyzing more solutions."
              />
            ) : (
              <EmptyState
                icon={<Gauge className="w-6 h-6" />}
                title="No complexity gaps found yet"
                description="Run AI Deep Dive analysis on a few more solved problems to surface where a more optimal time/space complexity exists."
              />
            )}
          </div>

          {/* Common Mistakes — clustered so repeated feedback surfaces as one card */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
              <AlertTriangle className="text-amber-400 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-100">Common Mistakes</h3>
            </div>
            {insights.commonMistakes.length > 0 ? (
              <ul className="space-y-2.5">
                {insights.commonMistakes.map((m) => {
                  const isExpanded = expandedMistakes.has(m.text);
                  return (
                    <li key={m.text} className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleMistake(m.text)}
                        className="w-full flex items-start gap-3 p-3.5 text-left cursor-pointer"
                      >
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/30 border border-amber-500/20 rounded-full px-2 py-0.5 shrink-0 mt-0.5">
                          Found in {m.count} submission{m.count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-slate-300 leading-relaxed flex-1">{m.text}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />}
                      </button>
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 pt-0 flex flex-wrap gap-1.5">
                          {m.problems.map((p) => (
                            <button
                              key={p.problemId}
                              onClick={() => navigate(`/problems/${p.problemId}`)}
                              className="text-[10px] font-mono text-slate-400 hover:text-amber-400 bg-slate-900 hover:bg-amber-950/20 border border-slate-800 hover:border-amber-500/20 rounded-full px-2.5 py-1 transition-colors cursor-pointer"
                            >
                              {p.problemTitle}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={<AlertTriangle className="w-6 h-6" />}
                title="No recurring feedback yet"
                description="As more of your solutions get analyzed, repeated AI feedback (e.g. recurring optimization suggestions) will surface here."
              />
            )}
          </div>

          {/* Blind Spot Radar — aggregates AI-flagged edge cases across all analyzed problems */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
              <Target className="text-rose-400 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-100">Blind Spot Profile</h3>
            </div>
            {blindSpots.length > 0 ? (
              <div className="space-y-3.5">
                {blindSpots.map((b) => {
                  const isExpanded = expandedBlindSpots.has(b.category);
                  return (
                    <div key={b.category} className="space-y-1.5">
                      <button
                        onClick={() => toggleBlindSpot(b.category)}
                        className="w-full flex items-center justify-between text-xs gap-2 cursor-pointer group"
                      >
                        <span className="text-slate-300 font-medium group-hover:text-white transition-colors">{b.category}</span>
                        <span className="font-mono font-bold text-rose-400 shrink-0 flex items-center gap-1">
                          {b.pct}% <span className="text-slate-600 font-normal">({b.count})</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </span>
                      </button>
                      <div className="w-full h-2 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full transition-all duration-500"
                          style={{ width: `${b.pct}%` }}
                        />
                      </div>
                      {isExpanded && (
                        <ul className="pl-3 border-l border-slate-900 space-y-1 pt-1">
                          {b.examples.map((ex, i) => (
                            <li key={i}>
                              <button
                                onClick={() => navigate(`/problems/${ex.problemId}`)}
                                className="text-[10px] font-mono text-slate-500 hover:text-rose-400 text-left transition-colors cursor-pointer"
                              >
                                {ex.problemTitle}: <span className="text-slate-400">{ex.text}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<Target className="w-6 h-6" />}
                title="No blind spot data yet"
                description="As more solutions get analyzed, recurring edge cases the AI flags (overflow, empty input, off-by-one, etc.) will surface here."
              />
            )}
          </div>

          {/* AI Recommendations — the "Revisit N" line expands inline instead of just describing what to do */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
              <Lightbulb className="text-pink-400 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-100">AI Recommendations</h3>
            </div>
            <ul className="space-y-3">
              {insights.recommendations.map((rec, i) => {
                const isRevisitLine = rec.startsWith('Revisit') && insights.complexityImprovements.length > 0;
                return (
                  <li key={i} className="text-sm text-slate-300 leading-relaxed">
                    {isRevisitLine ? (
                      <div>
                        <button
                          onClick={() => setShowRevisitList((v) => !v)}
                          className="w-full flex items-start gap-3 text-left cursor-pointer group"
                        >
                          <BookOpenCheck className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                          <span className="flex-1 underline decoration-dotted decoration-pink-500/40 group-hover:decoration-pink-400 underline-offset-4">{rec}</span>
                          {showRevisitList ? <ChevronUp className="w-4 h-4 text-slate-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />}
                        </button>
                        {showRevisitList && (
                          <div className="mt-2 ml-7 flex flex-wrap gap-1.5">
                            {insights.complexityImprovements.map((c) => (
                              <button
                                key={c.problemId}
                                onClick={() => navigate(`/analysis/${c.problemId}`)}
                                className="text-[10px] font-mono text-pink-400 hover:text-pink-300 bg-pink-950/20 hover:bg-pink-950/30 border border-pink-500/20 rounded-full px-2.5 py-1 transition-colors cursor-pointer"
                              >
                                {c.problemTitle}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <BookOpenCheck className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </div>
                    )}
                  </li>
                );
              })}
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
