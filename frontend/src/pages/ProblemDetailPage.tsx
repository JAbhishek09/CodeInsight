import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProblemById } from '../api/problems.api';
import VerdictBadge from '../components/VerdictBadge';
import CodeViewer from '../components/CodeViewer';
import {
  ArrowLeft, Brain, ExternalLink, Loader2, Calendar,
  Code2, CheckCircle2, ChevronDown, ChevronUp, Info
} from 'lucide-react';

interface Submission {
  _id: string;
  submittedAt: string;
  verdict: string;
  language: string;
  code: string;
  submissionId: string | null;
}

export default function ProblemDetailPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  useEffect(() => {
    if (!problemId) return;
    setLoading(true);
    getProblemById(problemId)
      .then((res) => setProblem(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [problemId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="text-center py-12 text-slate-500 text-sm font-mono">
        {error || 'Problem not found.'}
      </div>
    );
  }

  const submissions: Submission[] = [...(problem.submissions || [])].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  const hasCode = submissions.some((s) => s.code?.trim().length > 0);
  const acceptedCount = submissions.filter((s) => s.verdict === 'Accepted').length;

  const difficultyColors: Record<string, string> = {
    Easy:   'bg-emerald-950/30 text-emerald-400 border-emerald-500/20',
    Medium: 'bg-amber-950/30 text-amber-400 border-amber-500/20',
    Hard:   'bg-rose-950/30 text-rose-400 border-rose-500/20',
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="problem-detail-page">
      {/* Header */}
      <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />

        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {problem.platform && problem.platform !== 'manual' && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  problem.platform === 'leetcode'
                    ? 'bg-amber-950/30 text-amber-400 border-amber-500/20'
                    : 'bg-blue-950/30 text-blue-400 border-blue-500/20'
                }`}>
                  {problem.platform}
                </span>
              )}
              {problem.difficulty && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${difficultyColors[problem.difficulty] || 'bg-slate-900 text-slate-400 border-slate-700'}`}>
                  {problem.difficulty}
                </span>
              )}
              {problem.tags?.map((tag: string) => (
                <span key={tag} className="text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-950 text-slate-400 border-slate-800">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">{problem.title}</h1>
            {problem.url && (
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 font-mono"
              >
                View on {problem.platform === 'leetcode' ? 'LeetCode' : 'Codeforces'}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/analysis/${problem._id}`)}
              className={`flex items-center gap-2 text-xs font-bold rounded-xl px-4 py-2.5 transition-all ${
                hasCode
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 text-white shadow-lg shadow-pink-950/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed'
              }`}
              title={hasCode ? 'Run AI analysis on latest code' : 'No code available — use the Chrome Extension to capture submissions'}
              disabled={!hasCode}
            >
              <Brain className="w-4 h-4" />
              AI Analysis
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-5 pt-4 border-t border-slate-950 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xl font-extrabold text-white font-mono">{submissions.length}</p>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">Submissions</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-extrabold text-emerald-400 font-mono">{acceptedCount}</p>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">Accepted</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-extrabold text-indigo-400 font-mono">
              {hasCode ? submissions.filter(s => s.code?.trim()).length : 0}
            </p>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">With Code</p>
          </div>
        </div>
      </div>

      {/* No code notice */}
      {!hasCode && problem.platform === 'leetcode' && (
        <div className="bg-amber-950/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-amber-300/80 space-y-1">
            <p className="font-bold text-amber-400">No code available for these submissions</p>
            <p>LeetCode's public API only returns submission metadata, not source code. Install the <span className="text-white">CodeInsight Chrome Extension</span> to automatically capture your code when you submit on LeetCode.</p>
          </div>
        </div>
      )}

      {/* Submissions History */}
      <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-950 flex items-center gap-2">
          <Code2 className="w-4 h-4 text-pink-400" />
          <h3 className="text-sm font-bold text-slate-100">Submission History</h3>
          <span className="text-[10px] font-mono text-slate-500 ml-auto">{submissions.length} total</span>
        </div>

        {submissions.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500">
            No submissions recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-950">
            {submissions.map((sub, idx) => {
              const isExpanded = expandedSubmission === sub._id;
              const hasSubCode = sub.code?.trim().length > 0;

              return (
                <div key={sub._id} className="group">
                  {/* Submission Row */}
                  <div
                    className={`px-6 py-4 flex items-center gap-4 hover:bg-slate-900/30 transition-colors ${hasSubCode ? 'cursor-pointer' : ''}`}
                    onClick={() => hasSubCode && setExpandedSubmission(isExpanded ? null : sub._id)}
                  >
                    {/* Index */}
                    <span className="text-[10px] font-mono text-slate-600 w-5 shrink-0">#{submissions.length - idx}</span>

                    {/* Verdict */}
                    <VerdictBadge verdict={sub.verdict} />

                    {/* Language */}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-950 text-slate-400 border-slate-800">
                      {sub.language}
                    </span>

                    {/* Date */}
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 ml-auto">
                      <Calendar className="w-3 h-3" />
                      {new Date(sub.submittedAt).toLocaleDateString([], {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>

                    {/* Code indicator */}
                    {hasSubCode ? (
                      <div className="flex items-center gap-1 text-[10px] font-mono text-indigo-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Code</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </div>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-700">No code</span>
                    )}
                  </div>

                  {/* Expanded Code View */}
                  {isExpanded && hasSubCode && (
                    <div className="px-6 pb-6">
                      <CodeViewer code={sub.code} language={sub.language} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/analysis/${problem._id}`);
                        }}
                        className="mt-3 flex items-center gap-1.5 text-xs font-mono text-pink-400 hover:text-pink-300"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        Run AI Analysis on this problem
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notes */}
      {problem.notes && (
        <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6">
          <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-3">Notes</h3>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line border-l-2 border-pink-500/30 pl-4">
            {problem.notes}
          </p>
        </div>
      )}
    </div>
  );
}
