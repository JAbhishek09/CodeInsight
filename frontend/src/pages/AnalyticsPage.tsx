import React, { useEffect, useMemo, useState } from 'react';
import { getProblems } from '../api/problems.api';
import { Problem } from '../components/ProblemCard';
import { useAnalytics } from '../hooks/useAnalytics';
import StatCard from '../components/StatCard';
import TrendChart from '../components/TrendChart';
import TopicBarChart from '../components/TopicBarChart';
import WeeklyLineChart from '../components/WeeklyLineChart';
import EmptyState from '../components/EmptyState';
import {
  flattenSubmissions,
  computeSolvingTrend,
  computeDifficultyTrend,
  computeAcceptanceTrend,
  computeTopicMastery,
  computeLanguageUsage,
  computeWeeklyProgress,
  computeDifficultyBreakdown,
  computeStreak,
  computeAcceptanceRate,
} from '../utils/stats';
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  Layers,
  Code2,
  Percent,
  ListChecks,
  Brain,
  CalendarRange,
  Trophy,
  Target,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

// Platform tab definition
type PlatformTab = 'all' | 'leetcode' | 'codeforces';

const PLATFORM_TABS: { id: PlatformTab; label: string; color: string; accentClass: string }[] = [
  { id: 'all',        label: 'All Platforms', color: '#ec4899', accentClass: 'text-pink-400 border-pink-500/20 bg-pink-500/10' },
  { id: 'leetcode',   label: 'LeetCode',      color: '#fbbf24', accentClass: 'text-amber-400 border-amber-500/20 bg-amber-500/10' },
  { id: 'codeforces', label: 'Codeforces',    color: '#818cf8', accentClass: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10' },
];

export default function AnalyticsPage() {
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<PlatformTab>('all');
  const { data: backendSummary, loading: summaryLoading } = useAnalytics();

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getProblems();
      if (res?.success && res?.data) setAllProblems(res.data);
    } catch (err) {
      console.error('Failed to load analytics data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Filter problems by selected platform tab ──────────────────────────
  const problems = useMemo(() => {
    if (activePlatform === 'all') return allProblems;
    return allProblems.filter((p) => p.platform === activePlatform);
  }, [allProblems, activePlatform]);

  // ── Problem counts per platform (for tab badges) ──────────────────────
  const platformCounts = useMemo(() => ({
    all:        allProblems.length,
    leetcode:   allProblems.filter(p => p.platform === 'leetcode').length,
    codeforces: allProblems.filter(p => p.platform === 'codeforces').length,
  }), [allProblems]);

  // ── Derived metrics — recomputed when platform tab changes ────────────
  const entries       = useMemo(() => flattenSubmissions(problems), [problems]);
  const solvingTrend  = useMemo(() => computeSolvingTrend(entries, 6), [entries]);
  const diffTrend     = useMemo(() => computeDifficultyTrend(entries, 6), [entries]);
  const accTrend      = useMemo(() => computeAcceptanceTrend(entries, 6), [entries]);
  const topicMastery  = useMemo(() => computeTopicMastery(problems), [problems]);
  const topicPerf     = useMemo(() => topicMastery.map(t => ({ topic: t.topic, count: t.solved })), [topicMastery]);
  const languageUsage = useMemo(() => computeLanguageUsage(entries), [entries]);
  const weeklyProg    = useMemo(() => computeWeeklyProgress(entries), [entries]);
  const streak        = useMemo(() => computeStreak(entries), [entries]);
  const acceptRate    = useMemo(() => computeAcceptanceRate(entries), [entries]);
  const diffBreakdown = useMemo(() => computeDifficultyBreakdown(problems), [problems]);

  // LeetCode-specific difficulty stats (only visible on LeetCode tab)
  const lcEasySolvedPct  = diffBreakdown.easy   ? Math.round((diffBreakdown.easySolved   / diffBreakdown.easy)   * 100) : 0;
  const lcMediumSolvedPct= diffBreakdown.medium ? Math.round((diffBreakdown.mediumSolved / diffBreakdown.medium) * 100) : 0;
  const lcHardSolvedPct  = diffBreakdown.hard   ? Math.round((diffBreakdown.hardSolved   / diffBreakdown.hard)   * 100) : 0;

  // Codeforces: submissions by verdict
  const cfAccepted = entries.filter(e => e.verdict === 'Accepted').length;
  const cfWA       = entries.filter(e => e.verdict === 'Wrong Answer').length;
  const cfTLE      = entries.filter(e => e.verdict?.includes('Time Limit')).length;

  const solvedCount    = problems.filter(p => p.status === 'Solved').length;
  const attemptedCount = problems.filter(p => p.status === 'Attempted').length;
  const needsAnalysis  = problems.filter(p =>
    p.status === 'Solved' && !(p as any).aiAnalysis?.complexityAnalysis
  ).length;

  const isEmpty = !loading && problems.length === 0;
  const activePlatformDef = PLATFORM_TABS.find(t => t.id === activePlatform)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Analytics</h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              {activePlatform === 'all' ? 'All platforms' : activePlatformDef.label} · {problems.length} problems
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

      {/* ── Platform tab switcher ──────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 border-b border-slate-900 pb-1 overflow-x-auto">
        {PLATFORM_TABS.map(({ id, label, accentClass }) => {
          const count = platformCounts[id];
          const isActive = activePlatform === id;
          return (
            <button
              key={id}
              onClick={() => setActivePlatform(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-xs font-mono font-bold transition-all cursor-pointer shrink-0 border ${
                isActive
                  ? accentClass
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-slate-900'
              }`}
            >
              {label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/10' : 'bg-slate-900 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-slate-900 rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
          <p className="text-xs font-mono text-slate-500 mt-4 uppercase tracking-wider">Loading analytics...</p>
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={<BarChart3 className="w-6 h-6" />}
          title={activePlatform === 'all'
            ? "Not enough data yet"
            : `No ${activePlatformDef.label} problems synced yet`}
          description={activePlatform === 'all'
            ? "Track and solve problems, or sync your LeetCode / Codeforces history using the Import button in the top navbar."
            : `Use the Import button in the top navbar to sync your ${activePlatformDef.label} solve history.`}
        />
      ) : (
        <>
          {/* ── Quick stats ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total',     value: problems.length,  icon: <ListChecks className="w-4 h-4" />,  accent: 'pink'    as const },
              { label: 'Solved',    value: solvedCount,      icon: <CheckCircle2 className="w-4 h-4" />,accent: 'emerald' as const },
              { label: 'Attempted', value: attemptedCount,   icon: <Clock className="w-4 h-4" />,       accent: 'amber'   as const },
              { label: 'Acceptance',value: `${acceptRate}%`, icon: <Percent className="w-4 h-4" />,     accent: 'indigo'  as const },
              { label: 'Streak',    value: `${streak.current}d`, icon: <Flame className="w-4 h-4" />,  accent: 'purple'  as const },
              { label: 'Unanalyzed',value: needsAnalysis,    icon: <Brain className="w-4 h-4" />,       accent: 'amber'   as const },
            ].map(s => (
              <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} accent={s.accent} />
            ))}
          </div>

          {/* ── LeetCode-specific: difficulty breakdown bars ──────────────── */}
          {activePlatform === 'leetcode' && (
            <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Trophy className="text-amber-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">LeetCode Difficulty Breakdown</h3>
              </div>
              <div className="space-y-4">
                {[
                  { label: 'Easy',   solved: diffBreakdown.easySolved,   total: diffBreakdown.easy,   pct: lcEasySolvedPct,   bar: 'bg-emerald-500', text: 'text-emerald-400' },
                  { label: 'Medium', solved: diffBreakdown.mediumSolved, total: diffBreakdown.medium, pct: lcMediumSolvedPct, bar: 'bg-amber-500',   text: 'text-amber-400'   },
                  { label: 'Hard',   solved: diffBreakdown.hardSolved,   total: diffBreakdown.hard,   bar: 'bg-rose-500',    text: 'text-rose-400', pct: lcHardSolvedPct },
                ].map(d => (
                  <div key={d.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className={d.text}>{d.label}</span>
                      <span className="text-slate-400">{d.solved} / {d.total} solved ({d.pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${d.bar} rounded-full transition-all duration-700`}
                        style={{ width: `${d.total ? d.pct : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Codeforces-specific: verdict breakdown ──────────────────────── */}
          {activePlatform === 'codeforces' && entries.length > 0 && (
            <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Target className="text-indigo-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">Codeforces Verdict Breakdown</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Accepted',     value: cfAccepted, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-400', bg: 'bg-emerald-950/20 border-emerald-500/20' },
                  { label: 'Wrong Answer', value: cfWA,       icon: <XCircle className="w-4 h-4" />,      color: 'text-rose-400',    bg: 'bg-rose-950/20 border-rose-500/20'    },
                  { label: 'Time Limit',   value: cfTLE,      icon: <Clock className="w-4 h-4" />,        color: 'text-amber-400',   bg: 'bg-amber-950/20 border-amber-500/20'  },
                ].map(v => (
                  <div key={v.label} className={`rounded-xl p-4 border ${v.bg} text-center space-y-2`}>
                    <div className={`flex justify-center ${v.color}`}>{v.icon}</div>
                    <p className={`text-2xl font-extrabold font-mono ${v.color}`}>{v.value}</p>
                    <p className="text-[10px] font-mono text-slate-500">{v.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Solving Trends ─────────────────────────────────────────────── */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
              <TrendingUp className="text-pink-400 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-100">Solving Trends</h3>
              <span className="ml-auto text-[10px] font-mono text-slate-500">Last 6 months</span>
            </div>
            <TrendChart series={solvingTrend} />
          </div>

          {/* ── Difficulty + Acceptance Rate ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Layers className="text-purple-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">Difficulty Trends</h3>
              </div>
              <TrendChart series={diffTrend} />
            </div>
            <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Percent className="text-indigo-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">Acceptance Rate Trend</h3>
              </div>
              <TrendChart series={accTrend} />
            </div>
          </div>

          {/* ── Topic Performance + Language Usage ─────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Layers className="text-cyan-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">Topic Performance</h3>
              </div>
              <TopicBarChart data={topicPerf} />
            </div>
            <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Code2 className="text-emerald-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">Language Usage</h3>
              </div>
              <TopicBarChart data={languageUsage} />
            </div>
          </div>

          {/* ── Weekly Progress ─────────────────────────────────────────────── */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
              <CalendarRange className="text-pink-400 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-100">Weekly Progress</h3>
            </div>
            <WeeklyLineChart data={weeklyProg} />
          </div>
        </>
      )}
    </div>
  );
}
