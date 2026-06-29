import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import VerdictBadge from './VerdictBadge';
import { ActivityEntry } from '../utils/stats';

interface RecentActivityFeedProps {
  entries: ActivityEntry[];
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function RecentActivityFeed({ entries }: RecentActivityFeedProps) {
  const navigate = useNavigate();

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600 text-xs font-mono">
        No recent activity yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-950">
      {entries.map((e, i) => (
        <button
          key={`${e.problemId}-${e.submittedAt}-${i}`}
          onClick={() => navigate(`/problems/${e.problemId}`)}
          className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-900/30 transition-colors px-2 -mx-2 rounded-lg group cursor-pointer"
        >
          <VerdictBadge verdict={e.verdict} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white transition-colors">
              {e.problemTitle}
            </p>
            <p className="text-[10px] font-mono text-slate-500">
              {e.language || '—'} · {timeAgo(e.submittedAt)}
            </p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0 group-hover:text-slate-400 transition-colors" />
        </button>
      ))}
    </div>
  );
}
