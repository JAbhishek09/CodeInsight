import { useNavigate } from 'react-router-dom';
import VerdictBadge from './VerdictBadge';
import DifficultyBadge from './DifficultyBadge';
import { ChevronRight, Eye, Brain } from 'lucide-react';

interface Submission {
  verdict: string;
  submittedAt: string;
  code?: string;
}

interface Problem {
  _id: string;
  title: string;
  platform?: string;
  difficulty?: string;
  submissions?: Submission[];
  url?: string;
}

interface SubmissionsTableProps {
  problems: Problem[];
}

function getBestVerdict(subs: Submission[]): string {
  if (subs.some((s) => s.verdict === 'Accepted')) return 'Accepted';
  return subs[subs.length - 1]?.verdict || 'Pending';
}

export default function SubmissionsTable({ problems }: SubmissionsTableProps) {
  const navigate = useNavigate();

  // Sort: problems with non-AC submissions first (most interesting for analysis)
  const sorted = [...problems].sort((a, b) => {
    const aHasFail = (a.submissions ?? []).some((s) => s.verdict !== 'Accepted');
    const bHasFail = (b.submissions ?? []).some((s) => s.verdict !== 'Accepted');
    return Number(bHasFail) - Number(aHasFail);
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-xl text-subtle text-xs">
        No synced submissions yet. Enter your handles above and click Sync.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-background">
            <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider font-semibold">Problem</th>
            <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider font-semibold">Platform</th>
            <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider font-semibold">Difficulty</th>
            <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider font-semibold">Best Verdict</th>
            <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider font-semibold">Submissions</th>
            <th className="text-left px-4 py-3 text-muted-foreground uppercase tracking-wider font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((prob) => {
            const hasCode = (prob.submissions ?? []).some((s) => s.code?.trim());
            return (
              <tr
                key={prob._id}
                className="border-b border-border hover:bg-surface-2 transition-colors group"
              >
                <td
                  className="px-4 py-3 text-foreground max-w-[200px] truncate group-hover:text-foreground cursor-pointer"
                  onClick={() => navigate(`/problems/${prob._id}`)}
                >
                  {prob.title}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded border border-border bg-surface-2 text-muted-foreground text-[11px] capitalize">
                    {prob.platform}
                  </span>
                </td>
                <td className="px-4 py-3">{prob.difficulty ? <DifficultyBadge difficulty={prob.difficulty} /> : <span className="text-subtle">—</span>}</td>
                <td className="px-4 py-3">
                  <VerdictBadge verdict={getBestVerdict(prob.submissions ?? [])} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{prob.submissions?.length ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* View detail */}
                    <button
                      onClick={() => navigate(`/problems/${prob._id}`)}
                      className="inline-flex items-center gap-1 text-primary hover:text-primary"
                      title="View submissions"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    {/* AI Analyze — only if code available */}
                    {hasCode && (
                      <button
                        onClick={() => navigate(`/analysis/${prob._id}`)}
                        className="inline-flex items-center gap-1 text-primary hover:text-primary"
                        title="AI Analysis"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        <span>Analyze</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
