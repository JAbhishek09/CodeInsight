import { useNavigate } from 'react-router-dom';
import VerdictBadge from './VerdictBadge';
import { ChevronRight, Eye, Brain } from 'lucide-react';

interface Submission {
  verdict: string;
  submittedAt: string;
  code?: string;
}

interface Problem {
  _id: string;
  title: string;
  platform: string;
  difficulty?: string;
  submissions: Submission[];
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
    const aHasFail = a.submissions.some((s) => s.verdict !== 'Accepted');
    const bHasFail = b.submissions.some((s) => s.verdict !== 'Accepted');
    return Number(bHasFail) - Number(aHasFail);
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-slate-900 rounded-xl text-slate-500 text-xs font-mono">
        No synced submissions yet. Enter your handles above and click Sync.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-900">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-slate-900 bg-[#07090e]">
            <th className="text-left px-4 py-3 text-slate-400 uppercase tracking-wider font-semibold">Problem</th>
            <th className="text-left px-4 py-3 text-slate-400 uppercase tracking-wider font-semibold">Platform</th>
            <th className="text-left px-4 py-3 text-slate-400 uppercase tracking-wider font-semibold">Difficulty</th>
            <th className="text-left px-4 py-3 text-slate-400 uppercase tracking-wider font-semibold">Best Verdict</th>
            <th className="text-left px-4 py-3 text-slate-400 uppercase tracking-wider font-semibold">Submissions</th>
            <th className="text-left px-4 py-3 text-slate-400 uppercase tracking-wider font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((prob) => {
            const hasCode = prob.submissions.some((s) => s.code?.trim());
            return (
              <tr
                key={prob._id}
                className="border-b border-slate-950 hover:bg-slate-900/30 transition-colors group"
              >
                <td
                  className="px-4 py-3 text-slate-200 max-w-[200px] truncate group-hover:text-white cursor-pointer"
                  onClick={() => navigate(`/problems/${prob._id}`)}
                >
                  {prob.title}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded border text-[10px] ${
                    prob.platform === 'leetcode'
                      ? 'bg-amber-950/30 text-amber-400 border-amber-500/20'
                      : prob.platform === 'codeforces'
                      ? 'bg-blue-950/30 text-blue-400 border-blue-500/20'
                      : 'bg-slate-950/30 text-slate-400 border-slate-500/20'
                  }`}>
                    {prob.platform}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{prob.difficulty || '—'}</td>
                <td className="px-4 py-3">
                  <VerdictBadge verdict={getBestVerdict(prob.submissions)} />
                </td>
                <td className="px-4 py-3 text-slate-400">{prob.submissions.length}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* View detail */}
                    <button
                      onClick={() => navigate(`/problems/${prob._id}`)}
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
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
                        className="inline-flex items-center gap-1 text-pink-400 hover:text-pink-300"
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
