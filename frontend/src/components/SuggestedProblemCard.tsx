import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, PartyPopper } from 'lucide-react';
import { Problem } from './ProblemCard';

interface SuggestedProblemCardProps {
  problem: Problem | null;
  onAddProblem: () => void;
}

const DIFF_STYLES: Record<string, string> = {
  Easy: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20',
  Medium: 'bg-amber-950/40 text-amber-400 border-amber-500/20',
  Hard: 'bg-rose-950/40 text-rose-400 border-rose-500/20',
};

/**
 * Surfaces a problem to work on next — currently scoped to the user's own
 * "To Do" / "Attempted" tracked problems (see utils/stats.suggestNextProblem).
 *
 * TODO(backend): wire to a real problem-catalog / recommendation endpoint so
 * this can suggest brand-new problems (matched to weak topics) once the
 * user has nothing queued, instead of just showing the "all caught up" state.
 */
export default function SuggestedProblemCard({ problem, onAddProblem }: SuggestedProblemCardProps) {
  const navigate = useNavigate();

  if (!problem) {
    return (
      <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 text-center space-y-3 flex flex-col items-center justify-center h-full">
        <PartyPopper className="w-6 h-6 text-emerald-400" />
        <p className="text-xs font-mono text-slate-400">All caught up — nothing queued right now.</p>
        <button
          onClick={onAddProblem}
          className="text-xs text-pink-400 hover:text-pink-300 font-mono font-bold cursor-pointer"
        >
          + Track a new problem
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[160px] h-[160px] bg-pink-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex items-center gap-2 relative z-10">
        <Sparkles className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-bold text-slate-100">Suggested Next Problem</h3>
      </div>

      <div className="relative z-10 space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              DIFF_STYLES[problem.difficulty] || 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {problem.difficulty}
          </span>
          <span className="text-[10px] font-mono text-slate-500">{problem.category}</span>
        </div>
        <p className="text-sm font-bold text-white leading-snug">{problem.title}</p>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Status: <span className="text-slate-400">{problem.status}</span>
        </p>
      </div>

      <button
        onClick={() => navigate(`/problems/${problem._id}`)}
        className="relative z-10 w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 text-white text-xs font-bold rounded-xl py-2.5 transition-all cursor-pointer"
      >
        Continue solving <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
