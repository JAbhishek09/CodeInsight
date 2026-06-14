import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getProblems } from '../api/problems.api';
import { Problem } from '../components/ProblemCard';
import { 
  Target, 
  CheckCircle2, 
  Hourglass, 
  CircleDot, 
  TrendingUp, 
  ChevronRight, 
  Brain, 
  Flame, 
  RefreshCw,
  Plus,
  Award
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
  }, [refreshUser]);

  const totalTracked   = problems.length;
  const solvedCount    = problems.filter(p => p.status === 'Solved').length;
  const attemptedCount = problems.filter(p => p.status === 'Attempted').length;
  const toDoCount      = problems.filter(p => p.status === 'To Do').length;

  const easyCount   = problems.filter(p => p.difficulty === 'Easy').length;
  const mediumCount = problems.filter(p => p.difficulty === 'Medium').length;
  const hardCount   = problems.filter(p => p.difficulty === 'Hard').length;
  const easySolved   = problems.filter(p => p.difficulty === 'Easy'   && p.status === 'Solved').length;
  const mediumSolved = problems.filter(p => p.difficulty === 'Medium' && p.status === 'Solved').length;
  const hardSolved   = problems.filter(p => p.difficulty === 'Hard'   && p.status === 'Solved').length;

  const targetGoal = user?.targetDailySolved || 1;
  const solvedPercentage = Math.min(100, Math.round((solvedCount / targetGoal) * 100));

  const getMotivationalMessage = () => {
    if (solvedCount === 0) return "Declare your first problem to boot the tracker.";
    if (solvedCount >= targetGoal) return "Daily goal satisfied. Unmatched efficiency.";
    return "Patterns converging. Keep pushing your target.";
  };

  return (
    <div className="space-y-8" id="dashboard-layout">
      {/* Welcome Banner */}
      <div className="relative bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 sm:p-8 overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-pink-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-950/25 border border-pink-500/10 text-pink-400 text-[10px] font-mono rounded-full tracking-wider uppercase">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              CodeInsight Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome Back,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
                {user?.name || 'Developer'}
              </span>
            </h1>
            <p className="text-xs text-slate-400 max-w-xl leading-relaxed">{getMotivationalMessage()}</p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={fetchDashboardData}
              disabled={refreshing}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-mono rounded-xl inline-flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={onOpenNewProblem}
              className="px-4 py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-lg inline-flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              Track Problem
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-slate-900 rounded-2xl">
          <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
          <p className="text-xs font-mono text-slate-500 mt-4 uppercase tracking-wider">Loading stats...</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Tracked', val: totalTracked, Icon: Brain,       color: 'text-slate-400', bg: 'bg-slate-900' },
              { label: 'Solved',        val: solvedCount,  Icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950/20' },
              { label: 'Attempted',     val: attemptedCount, Icon: Hourglass, color: 'text-amber-400', bg: 'bg-amber-950/20' },
              { label: 'To Do',         val: toDoCount,    Icon: CircleDot,   color: 'text-indigo-400', bg: 'bg-indigo-950/20' },
            ].map(({ label, val, Icon, color, bg }) => (
              <div key={label} className="bg-[#0b0e14] border border-slate-900 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold tracking-wider">{label}</span>
                  <div className={`p-2 rounded-lg ${bg} border border-slate-900`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                </div>
                <p className="text-3xl font-extrabold text-white font-mono">{val}</p>
              </div>
            ))}
          </div>

          {/* Difficulty + Target */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Difficulty Bars */}
            <div className="lg:col-span-7 bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Award className="text-purple-400 w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-100">Difficulty Distribution</h3>
              </div>
              <div className="space-y-5">
                {[
                  { label: 'Easy',   solved: easySolved,   total: easyCount,   bar: 'bg-emerald-500', text: 'text-emerald-400' },
                  { label: 'Medium', solved: mediumSolved, total: mediumCount, bar: 'bg-amber-500',   text: 'text-amber-400'   },
                  { label: 'Hard',   solved: hardSolved,   total: hardCount,   bar: 'bg-rose-500',    text: 'text-rose-400'    },
                ].map((d) => (
                  <div key={d.label} className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className={d.text}>{d.label}</span>
                      <span className="text-slate-400">{d.solved} / {d.total} Solved</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${d.bar} rounded-full transition-all duration-500`}
                        style={{ width: `${d.total ? (d.solved / d.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-950">
                {[
                  { label: 'Easy',   val: easyCount,   color: 'text-emerald-400' },
                  { label: 'Medium', val: mediumCount, color: 'text-amber-400'   },
                  { label: 'Hard',   val: hardCount,   color: 'text-rose-400'    },
                ].map((d) => (
                  <div key={d.label} className="bg-slate-950 p-3.5 border border-slate-900 rounded-xl text-center">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide">{d.label}</p>
                    <p className={`text-xl font-extrabold mt-1 font-mono ${d.color}`}>{d.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Meter */}
            <div className="lg:col-span-5 bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 flex flex-col justify-between">
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Target className="text-pink-400 w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-100">Daily Target Meter</h3>
              </div>
              <div className="relative flex items-center justify-center py-6">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle cx="80" cy="80" r="68" className="stroke-slate-950 fill-transparent" strokeWidth="10" />
                  <circle
                    cx="80" cy="80" r="68"
                    className="stroke-pink-500 fill-transparent transition-all duration-700"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 68}
                    strokeDashoffset={2 * Math.PI * 68 * (1 - solvedPercentage / 100)}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0 0 4px rgba(236,72,153,0.3))' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-2xl font-black text-white font-mono">{solvedPercentage}%</p>
                  <p className="text-[10px] font-mono text-pink-400 tracking-wide uppercase">of goal</p>
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Daily Target:</span>
                  <span className="text-white font-bold">{targetGoal} problems</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Total Solved:</span>
                  <span className="text-white font-bold">{solvedCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Problems Rail */}
          <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-950 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-cyan-400 w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-100">Recent Problems</h3>
              </div>
              <button
                onClick={() => onNavigate('/problems')}
                className="text-xs text-pink-400 hover:text-pink-300 font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {problems.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-900 rounded-xl text-slate-500 text-xs font-mono">
                No problems yet.{' '}
                <button onClick={onOpenNewProblem} className="text-pink-400 hover:underline">
                  Add your first one.
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {problems.slice(0, 3).map((problem) => (
                  <div
                    key={problem._id}
                    onClick={() => onNavigate('/problems')}
                    className="bg-slate-950 border border-slate-900 p-4 rounded-xl hover:border-slate-800 transition-all cursor-pointer group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        problem.difficulty === 'Easy'   ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/10' :
                        problem.difficulty === 'Medium' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/10' :
                        'bg-rose-950/40 text-rose-400 border border-rose-500/10'
                      }`}>{problem.difficulty}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{problem.category}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200 truncate group-hover:text-white">{problem.title}</h4>
                    <p className="text-[11px] text-slate-500 italic line-clamp-1">{problem.notes || '—'}</p>
                    <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-900">
                      <span className="text-slate-600">Status: <span className="text-slate-400">{problem.status}</span></span>
                      <span className="text-pink-400 flex items-center gap-0.5">View <ChevronRight className="w-3 h-3" /></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
