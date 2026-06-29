import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getProblems } from '../api/problems.api';
import { Problem } from '../components/ProblemCard';
import StatCard from '../components/StatCard';
import DifficultyPieChart from '../components/DifficultyPieChart';
import TopicMasteryBars from '../components/TopicMasteryBars';
import Heatmap from '../components/Heatmap';
import RecentActivityFeed from '../components/RecentActivityFeed';
import AIInsightsPanel from '../components/AIInsightsPanel';
import SuggestedProblemCard from '../components/SuggestedProblemCard';
import {
  flattenSubmissions,
  computeAcceptanceRate,
  computeStreak,
  countAIAnalyses,
  computeHeatmapData,
  computeTopicMastery,
  computeDifficultyBreakdown,
  computeRecentActivity,
  computeAIInsights,
  suggestNextProblem,
} from '../utils/stats';
import {
  CheckCircle2,
  Flame,
  Brain,
  RefreshCw,
  Plus,
  Activity,
  Layers,
  Award,
  Gauge,
  Percent,
  ChevronRight,
  Clock,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
  onOpenNewProblem: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, onOpenNewProblem }) => {
  const { user, refreshUser } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true);
      const res = await getProblems();
      if (res?.success && res?.data) {
        setProblems(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard statistics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshUser]);

  // ── Derived analytics (client-side — see utils/stats.ts) ─────────────────
  const entries = useMemo(() => flattenSubmissions(problems), [problems]);
  const solvedCount = useMemo(() => problems.filter((p) => p.status === 'Solved').length, [problems]);
  const acceptanceRate = useMemo(() => computeAcceptanceRate(entries), [entries]);
  const streak = useMemo(() => computeStreak(entries), [entries]);
  const aiAnalysesCount = useMemo(() => countAIAnalyses(problems), [problems]);
  const heatmapData = useMemo(() => computeHeatmapData(entries), [entries]);
  const topicMastery = useMemo(() => computeTopicMastery(problems), [problems]);
  const difficultyBreakdown = useMemo(() => computeDifficultyBreakdown(problems), [problems]);
  const recentActivity = useMemo(() => computeRecentActivity(entries, 6), [entries]);
  const aiInsights = useMemo(() => computeAIInsights(problems, topicMastery), [problems, topicMastery]);
  const suggested = useMemo(() => suggestNextProblem(problems), [problems]);

  // Fallback for accounts with manual-only problems that have no embedded
  // submissions yet — fall back to "recently updated problems" instead of
  // an empty activity feed.
  const recentProblemsFallback = useMemo(
    () =>
      [...problems]
        .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
        .slice(0, 5),
    [problems]
  );

  const targetGoal = user?.targetDailySolved || 1;
  const goalPct = Math.min(100, Math.round((solvedCount / targetGoal) * 100));

  return (
    <div className="space-y-6" id="dashboard-layout">
      {/* Compact header — replaces the old oversized welcome banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Welcome back,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
              {(user?.name || 'Developer').split(' ')[0]}
            </span>
          </h1>
          <p className="text-xs font-mono text-slate-500 mt-1">Here's how your practice is trending.</p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-mono rounded-xl inline-flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={onOpenNewProblem}
            className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-lg inline-flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            Track Problem
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-slate-900 rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
          <p className="text-xs font-mono text-slate-500 mt-4 uppercase tracking-wider">Loading stats...</p>
        </div>
      ) : (
        <>
          {/* Hero stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Solved"
              value={solvedCount}
              icon={<CheckCircle2 className="w-4 h-4" />}
              accent="emerald"
              sub={`${problems.length} tracked`}
            />
            <StatCard
              label="Acceptance Rate"
              value={`${acceptanceRate}%`}
              icon={<Percent className="w-4 h-4" />}
              accent="pink"
              sub={`${entries.length} submission${entries.length !== 1 ? 's' : ''}`}
            />
            <StatCard
              label="Current Streak"
              value={streak.current}
              icon={<Flame className="w-4 h-4" />}
              accent="amber"
              sub={streak.current > 0 ? `${streak.current === 1 ? 'day' : 'days'} active` : 'solve today to start'}
            />
            <StatCard
              label="AI Analyses"
              value={aiAnalysesCount}
              icon={<Brain className="w-4 h-4" />}
              accent="indigo"
              sub="problems analyzed"
            />
          </div>

          {/* GitHub-style solve heatmap */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
              <Activity className="text-cyan-400 w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-100">Solve Activity</h3>
            </div>
            <Heatmap data={heatmapData} />
          </div>

          {/* Topic Mastery + Difficulty Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-950 pb-4">
                <div className="flex items-center gap-2">
                  <Layers className="text-purple-400 w-4 h-4" />
                  <h3 className="text-sm font-bold text-slate-100">Topic Mastery</h3>
                </div>
                <button
                  onClick={() => onNavigate('/insights')}
                  className="text-[11px] text-pink-400 hover:text-pink-300 font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  Details <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <TopicMasteryBars data={topicMastery} limit={6} />
            </div>

            <div className="lg:col-span-6 bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Award className="text-purple-400 w-4 h-4" />
                <h3 className="text-sm font-bold text-slate-100">Difficulty Breakdown</h3>
              </div>
              <div className="flex flex-col items-center gap-5">
                <DifficultyPieChart
                  easy={difficultyBreakdown.easySolved}
                  medium={difficultyBreakdown.mediumSolved}
                  hard={difficultyBreakdown.hardSolved}
                />
                <div className="grid grid-cols-3 gap-3 w-full pt-2 border-t border-slate-950">
                  {[
                    { label: 'Easy', solved: difficultyBreakdown.easySolved, total: difficultyBreakdown.easy, color: 'text-emerald-400' },
                    { label: 'Medium', solved: difficultyBreakdown.mediumSolved, total: difficultyBreakdown.medium, color: 'text-amber-400' },
                    { label: 'Hard', solved: difficultyBreakdown.hardSolved, total: difficultyBreakdown.hard, color: 'text-rose-400' },
                  ].map((d) => (
                    <div key={d.label} className="bg-slate-950 p-3 border border-slate-900 rounded-xl text-center">
                      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">{d.label}</p>
                      <p className={`text-base font-extrabold mt-1 font-mono ${d.color}`}>
                        {d.solved}<span className="text-slate-700">/{d.total}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity + AI Insights + Goal / Suggested Problem */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-[#0b0e14] border border-slate-900 rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-slate-950 pb-4 mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="text-cyan-400 w-4 h-4" />
                  <h3 className="text-sm font-bold text-slate-100">Recent Activity</h3>
                </div>
                <button
                  onClick={() => onNavigate('/problems')}
                  className="text-[11px] text-pink-400 hover:text-pink-300 font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {recentActivity.length > 0 ? (
                <RecentActivityFeed entries={recentActivity} />
              ) : recentProblemsFallback.length > 0 ? (
                <div className="divide-y divide-slate-950">
                  {recentProblemsFallback.map((p) => (
                    <button
                      key={p._id}
                      onClick={() => onNavigate('/problems')}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-900/30 transition-colors px-2 -mx-2 rounded-lg group cursor-pointer"
                    >
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          p.difficulty === 'Easy'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/10'
                            : p.difficulty === 'Medium'
                            ? 'bg-amber-950/40 text-amber-400 border border-amber-500/10'
                            : 'bg-rose-950/40 text-rose-400 border border-rose-500/10'
                        }`}
                      >
                        {p.difficulty}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">{p.title}</p>
                        <p className="text-[10px] font-mono text-slate-500">{p.status}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-600 text-xs font-mono">
                  No problems yet.{' '}
                  <button onClick={onOpenNewProblem} className="text-pink-400 hover:underline cursor-pointer">
                    Add your first one.
                  </button>
                </div>
              )}
            </div>

            <div className="lg:col-span-4">
              <AIInsightsPanel insights={aiInsights} />
            </div>

            <div className="lg:col-span-3 space-y-6">
              {/* Compact daily goal meter */}
              <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Gauge className="text-pink-400 w-4 h-4" />
                  <h3 className="text-xs font-bold text-slate-100">Daily Goal</h3>
                </div>
                <div className="relative flex items-center justify-center py-2">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="33" className="stroke-slate-950 fill-transparent" strokeWidth="7" />
                    <circle
                      cx="40" cy="40" r="33"
                      className="stroke-pink-500 fill-transparent transition-all duration-700"
                      strokeWidth="7"
                      strokeDasharray={2 * Math.PI * 33}
                      strokeDashoffset={2 * Math.PI * 33 * (1 - goalPct / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-sm font-black text-white font-mono">{goalPct}%</p>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-slate-500 text-center">
                  {solvedCount} / {targetGoal} target
                </p>
              </div>

              <SuggestedProblemCard problem={suggested} onAddProblem={onOpenNewProblem} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
