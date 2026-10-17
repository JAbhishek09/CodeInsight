import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, PartyPopper } from 'lucide-react';
import type { Problem } from '../types/problem';
import DifficultyBadge from './DifficultyBadge';

interface SuggestedProblemCardProps {
  problem: Problem | null;
  onAddProblem: () => void;
}

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
      <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-3 flex flex-col items-center justify-center h-full">
        <PartyPopper className="w-6 h-6 text-success" />
        <p className="text-xs text-muted-foreground">All caught up — nothing queued right now.</p>
        <button
          onClick={onAddProblem}
          className="text-xs text-primary hover:text-primary font-bold cursor-pointer"
        >
          + Track a new problem
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[160px] h-[160px] bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex items-center gap-2 relative z-10">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Suggested Next Problem</h3>
      </div>

      <div className="relative z-10 space-y-2">
        <div className="flex items-center gap-2">
          <DifficultyBadge difficulty={problem.difficulty} />
          <span className="text-[10px] text-subtle">{problem.category}</span>
        </div>
        <p className="text-sm font-bold text-foreground leading-snug">{problem.title}</p>
        <p className="text-[10px] text-subtle uppercase tracking-wider">
          Status: <span className="text-muted-foreground">{problem.status}</span>
        </p>
      </div>

      <button
        onClick={() => navigate(`/problems/${problem._id}`)}
        className="relative z-10 w-full flex items-center justify-center gap-1.5 bg-primary hover:opacity-95 text-primary-foreground text-xs font-bold rounded-xl py-2.5 transition-all cursor-pointer"
      >
        Continue solving <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
