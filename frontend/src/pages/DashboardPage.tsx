import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getProblems, ProblemPayload } from '../api/problems.api';
import { Problem } from '../components/layout/ProblemCard';
import { 
  Sparkles, 
  Target, 
  Award, 
  CheckCircle2, 
  Hourglass, 
  CircleDot, 
  TrendingUp, 
  ChevronRight, 
  Brain, 
  Flame, 
  RefreshCw,
  Plus
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
  }, []);

  // Compute metrics
  const totalTracked = problems.length;
  const solvedCount = problems.filter(p => p.status === 'Solved').length;
  const attemptedCount = problems.filter(p => p.status === 'Attempted').length;
  const toDoCount = problems.filter(p => p.status === 'To Do').length;

  const easyCount = problems.filter(p => p.difficulty === 'Easy').length;
  const mediumCount = problems.filter(p => p.difficulty === 'Medium').length;
  const hardCount = problems.filter(p => p.difficulty === 'Hard').length;

  const easySolved = problems.filter(p => p.difficulty === 'Easy' && p.status === 'Solved').length;
  const mediumSolved = problems.filter(p => p.difficulty === 'Medium' && p.status === 'Solved').length;
  const hardSolved = problems.filter(p => p.difficulty === 'Hard' && p.status === 'Solved').length;

  // Compute daily target progress
  const targetGoal = user?.targetDailySolved || 1;
  const solvedPercentage = Math.min(100, Math.round((solvedCount / targetGoal) * 100));

  // Motivational messages
  const getMotivationalMessage = () => {
    if (solvedCount === 0) return "Declare your first problem paradigm to boot algorithms.";
    if (solvedCount >= targetGoal) return "Daily goal parameters successfully satisfied. Unmatched efficiency.";
    return "Algorithmic patterns are converging. Continue tracking to satisfy parameters.";
  };

  return (
    <div className="space-y-8" id="dashboard-layout">
      {/* Welcome Banner */}
      <div className="relative bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 sm:p-8 overflow-hidden shadow-xl" id="welcome-banner">
        {/* Subtle glowing spheres in background */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-pink-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[200px] h-[200px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-950/25 border border-pink-500/10 text-pink-400 text-[10px] font-mono rounded-full tracking-wider uppercase">
              <Flame className="w-3.5 h-3.5 animate-pulse text-amber-500" />
              <span>LeetLens Tracker Dashboard Live</span>
            </div>
            
            <h1 className="text-2xl sm:text-3.5xl font-extrabold text-white tracking-tight">
              Welcome Back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-[#8a76ff]">{user?.name || 'Developer'}</span>
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              {getMotivationalMessage()} Monitor your status metrics, keep up your target daily solved ratio, and optimize your database of algorithmic insights.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              onClick={fetchDashboardData}
              disabled={refreshing}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-950 hover:border-slate-800 text-xs font-mono rounded-xl inline-flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>SYNC STATS</span>
            </button>
            <button
              onClick={onOpenNewProblem}
              className="px-4.5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 text-white text-xs font-extrabold rounded-xl shadow-lg border border-pink-400/20 inline-flex items-center gap-1.5 cursor-pointer hover:shadow-pink-950/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>TRACK PROBLEM</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-slate-900 rounded-2xl bg-[#070b13]/20" id="dev-loading">
          <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
          <p className="text-xs font-mono text-slate-500 mt-4 uppercase tracking-wider">Compiling dashboard details...</p>
        </div>
      ) : (
        <>
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-summary-grid">
            {/* Total Problems Tracked */}
            <div className="bg-[#0b0e14]/90 border border-slate-900 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold">Total Tracked</span>
                <div className="bg-slate-900/60 p-2 border border-slate-950 text-slate-400 rounded-lg">
                  <Brain className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-white font-mono">{totalTracked}</p>
                <p className="text-[10px] text-slate-500 font-mono uppercase mt-1 tracking-wider">PROBLEMS DECLARED</p>
              </div>
            </div>

            {/* Solved Problems */}
            <div className="bg-[#0b0e14]/90 border border-slate-900 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-emerald-450 uppercase font-semibold">Solved</span>
                <div className="bg-emerald-950/20 p-2 border border-emerald-500/10 text-emerald-450 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-white font-mono">{solvedCount}</p>
                <p className="text-[10px] text-emerald-500 font-mono uppercase mt-1 tracking-wider">METRICS SYNCED</p>
              </div>
            </div>

            {/* Attempted Problems */}
            <div className="bg-[#0b0e14]/90 border border-slate-900 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-amber-450 uppercase font-semibold">Attempted</span>
                <div className="bg-amber-950/20 p-2 border border-amber-500/10 text-amber-450 rounded-lg">
                  <Hourglass className="w-4 h-4 text-amber-400" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-white font-mono">{attemptedCount}</p>
                <p className="text-[10px] text-amber-500 font-mono uppercase mt-1 tracking-wider">ACTIVE EFFORTS</p>
              </div>
            </div>

            {/* To Do Items */}
            <div className="bg-[#0b0e14]/90 border border-slate-900 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-indigo-450 uppercase font-semibold">To Do List</span>
                <div className="bg-indigo-950/20 p-2 border border-indigo-500/10 text-indigo-450 rounded-lg">
                  <CircleDot className="w-4 h-4 text-indigo-400" />
                </div>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-white font-mono">{toDoCount}</p>
                <p className="text-[10px] text-indigo-500 font-mono uppercase mt-1 tracking-wider">PENDING QUEUES</p>
              </div>
            </div>
          </div>

          {/* High Fidelity Visual Analytics Block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="analytics-split">
            
            {/* Visual Dials (Left Column, 7 cols) */}
            <div className="lg:col-span-7 bg-[#0b0e14]/90 border border-slate-900 rounded-2xl p-6 shadow-xl space-y-6">
              
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Award className="text-purple-400 w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Algorithmic Distribution</h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5 tracking-wider">Difficulty metrics ratio</p>
                </div>
              </div>

              {/* Progress bars with glow indicators */}
              <div className="space-y-5 pt-2">
                {/* Easy parameter block */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-emerald-400 font-medium">🟢 Easy Difficulty</span>
                    <span className="text-slate-400">{easySolved} / {easyCount || 0} Solved</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 border border-slate-900 rounded-full overflow-hidden leading-none relative">
                    <div 
                      className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-500"
                      style={{ width: `${easyCount ? (easySolved / easyCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Medium parameter block */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-amber-400 font-medium">🟡 Medium Difficulty</span>
                    <span className="text-slate-400">{mediumSolved} / {mediumCount || 0} Solved</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 border border-slate-900 rounded-full overflow-hidden leading-none relative">
                    <div 
                      className="h-full bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.3)] transition-all duration-500"
                      style={{ width: `${mediumCount ? (mediumSolved / mediumCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Hard parameter block */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-rose-400 font-medium">🔴 Hard Difficulty</span>
                    <span className="text-slate-400">{hardSolved} / {hardCount || 0} Solved</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 border border-slate-900 rounded-full overflow-hidden leading-none relative">
                    <div 
                      className="h-full bg-rose-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.3)] transition-all duration-500"
                      style={{ width: `${hardCount ? (hardSolved / hardCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Proportional visual blocks */}
              <div className="pt-4 border-t border-slate-950/80 grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-950 p-3.5 border border-slate-900 rounded-xl">
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-wide">EASY CONVERGENCE</p>
                  <p className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">{easyCount}</p>
                </div>
                <div className="bg-slate-950 p-3.5 border border-slate-900 rounded-xl">
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-wide">MEDIUM CONVERGENCE</p>
                  <p className="text-xl font-extrabold text-amber-400 mt-1 font-mono">{mediumCount}</p>
                </div>
                <div className="bg-slate-950 p-3.5 border border-slate-900 rounded-xl">
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-wide">HARD CONVERGENCE</p>
                  <p className="text-xl font-extrabold text-rose-400 mt-1 font-mono">{hardCount}</p>
                </div>
              </div>

            </div>

            {/* Target Daily Meter (Right Column, 5 cols) */}
            <div className="lg:col-span-5 bg-[#0b0e14]/90 border border-slate-900 rounded-2xl p-6 shadow-xl flex flex-col justify-between" id="goal-dial-card">
              
              <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
                <Target className="text-pink-400 w-5 h-5 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Quantum Target Meter</h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5 tracking-wider">Dynamic solver progression</p>
                </div>
              </div>

              {/* Round dial SVG graphic */}
              <div className="relative flex items-center justify-center py-6">
                <svg className="w-40 h-40 transform -rotate-90">
                  {/* Outer circle track */}
                  <circle
                    cx="80"
                    cy="80"
                    r="68"
                    className="stroke-slate-950 fill-transparent"
                    strokeWidth="10"
                  />
                  {/* Progress overlay circle with stroke-dasharray properties */}
                  <circle
                    cx="80"
                    cy="80"
                    r="68"
                    className="stroke-pink-500 fill-transparent transition-all duration-700 ease-in-out"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 68}
                    strokeDashoffset={2 * Math.PI * 68 * (1 - solvedPercentage / 100)}
                    strokeLinecap="round"
                    style={{ filter: 'drop-shadow(0px 0px 4px rgba(236, 72, 153, 0.2))' }}
                  />
                </svg>

                {/* Inner percentage metrics overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-2xl font-black text-white font-mono">{solvedPercentage}%</p>
                  <p className="text-[10px] font-mono text-pink-400 mt-0.5 tracking-wide uppercase">SOLVES MET</p>
                </div>
              </div>

              {/* Progress details stats */}
              <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl space-y-2 text-center">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Parameter Target:</span>
                  <span className="text-white font-bold">{targetGoal} solves/day</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>Current Solved Sum:</span>
                  <span className="text-white font-bold">{solvedCount} tracked solves</span>
                </div>
                <div className="h-[1px] bg-slate-900 my-2" />
                <p className="text-[10.5px] text-slate-500 leading-snug">
                  Declaration of custom target parameters is synced with local registration setups. Keep optimizing.
                </p>
              </div>

            </div>

          </div>

          {/* Historical problems quick list activity rail */}
          <div className="bg-[#0b0e14]/90 border border-slate-900 rounded-2xl p-6 shadow-xl" id="recent-additions-rail">
            <div className="flex items-center justify-between border-b border-slate-950 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="text-cyan-400 w-5 h-5" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Live Workspace Registry</h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5 tracking-wider">Recently compiled algorithms</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate('/problems')}
                className="text-xs text-pink-400 hover:text-pink-300 font-mono font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Full problem manager</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {problems.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-900 rounded-xl text-slate-500 text-xs">
                No tracked problems logged in database repository. Click "Track Problem" to seed parameters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {problems.slice(0, 3).map((problem) => (
                  <div 
                    key={problem._id}
                    onClick={() => onNavigate('/problems')}
                    className="bg-slate-950 border border-slate-900 p-4 rounded-xl flex flex-col justify-between gap-3 hover:border-slate-800 transition-all cursor-pointer group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          problem.difficulty === 'Easy' ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/10' :
                          problem.difficulty === 'Medium' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/10' :
                          'bg-rose-950/40 text-rose-400 border border-rose-500/10'
                        }`}>
                          {problem.difficulty}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{problem.category}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-200 mt-1.5 truncate group-hover:text-white transition-colors">{problem.title}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 italic">{problem.notes || 'No algorithmic logs recorded...'}</p>
                    </div>

                    <div className="text-[10px] font-mono text-slate-600 flex items-center justify-between pt-2 border-t border-slate-950">
                      <span>Status: <span className="text-slate-350">{problem.status}</span></span>
                      <span className="text-[9px] text-[#ec4899] font-semibold flex items-center gap-0.5">VIEW DETAIL <ChevronRight className="w-3 h-3" /></span>
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
