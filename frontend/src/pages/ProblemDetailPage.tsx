import { useState } from 'react';
import DifficultyBadge from '../components/DifficultyBadge';
import { useParams, useNavigate } from 'react-router-dom';
import { useProblem } from '../hooks/useProblems';
import QueryError from '../components/QueryError';
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
  const problemQuery = useProblem(problemId);
  const problem: any = problemQuery.data;
  const loading = problemQuery.isPending && Boolean(problemId);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (problemQuery.error) {
    return <QueryError title="Couldn't load this problem" message={problemQuery.error.message} onRetry={() => problemQuery.refetch()} />;
  }

  if (!problem) {
    return <div className="text-center py-12 text-subtle text-sm">Problem not found.</div>;
  }

  const submissions: Submission[] = [...(problem.submissions || [])].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  const hasCode = submissions.some((s) => s.code?.trim().length > 0);
  const acceptedCount = submissions.filter((s) => s.verdict === 'Accepted').length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto" id="problem-detail-page">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">

        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {problem.platform && problem.platform !== 'manual' && (
                <span className={`text-[10px]  px-2 py-0.5 rounded border ${
                  problem.platform === 'leetcode'
                    ? 'bg-warning/10 text-warning border-warning/20'
                    : 'bg-primary/10 text-primary border-primary/20'
                }`}>
                  {problem.platform}
                </span>
              )}
              {problem.difficulty && <DifficultyBadge difficulty={problem.difficulty} />}
              {problem.tags?.map((tag: string) => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded border bg-surface-2 text-muted-foreground border-border-strong">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">{problem.title}</h1>
            {problem.url && (
              <a
                href={problem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary"
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
                  ? 'bg-primary   hover:opacity-95 text-primary-foreground shadow-lg '
                  : 'bg-surface-2 border border-border-strong text-muted-foreground cursor-not-allowed'
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
        <div className="mt-5 pt-4 border-t border-border grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xl font-extrabold text-foreground tabular-nums">{submissions.length}</p>
            <p className="text-[10px] text-subtle uppercase tracking-wider mt-0.5">Submissions</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-extrabold text-success tabular-nums">{acceptedCount}</p>
            <p className="text-[10px] text-subtle uppercase tracking-wider mt-0.5">Accepted</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-extrabold text-primary tabular-nums">
              {hasCode ? submissions.filter(s => s.code?.trim()).length : 0}
            </p>
            <p className="text-[10px] text-subtle uppercase tracking-wider mt-0.5">With Code</p>
          </div>
        </div>
      </div>

      {/* No code notice */}
      {!hasCode && problem.platform === 'leetcode' && (
        <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="text-xs text-warning/80 space-y-1">
            <p className="font-bold text-warning">No code available for these submissions</p>
            <p>LeetCode's public API only returns submission metadata, not source code. Install the <span className="text-foreground">CodeInsight Chrome Extension</span> to automatically capture your code when you submit on LeetCode.</p>
          </div>
        </div>
      )}

      {/* Submissions History */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Submission History</h3>
          <span className="text-[10px] text-subtle ml-auto">{submissions.length} total</span>
        </div>

        {submissions.length === 0 ? (
          <div className="p-8 text-center text-xs text-subtle">
            No submissions recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {submissions.map((sub, idx) => {
              const isExpanded = expandedSubmission === sub._id;
              const hasSubCode = sub.code?.trim().length > 0;

              return (
                <div key={sub._id} className="group">
                  {/* Submission Row */}
                  <div
                    className={`px-6 py-4 flex items-center gap-4 hover:bg-surface-2 transition-colors ${hasSubCode ? 'cursor-pointer' : ''}`}
                    onClick={() => hasSubCode && setExpandedSubmission(isExpanded ? null : sub._id)}
                  >
                    {/* Index */}
                    <span className="text-[10px] text-faint w-5 shrink-0">#{submissions.length - idx}</span>

                    {/* Verdict */}
                    <VerdictBadge verdict={sub.verdict} />

                    {/* Language */}
                    <span className="text-[10px] px-2 py-0.5 rounded border bg-surface-2 text-muted-foreground border-border-strong">
                      {sub.language}
                    </span>

                    {/* Date */}
                    <span className="text-[10px] text-subtle flex items-center gap-1 ml-auto">
                      <Calendar className="w-3 h-3" />
                      {new Date(sub.submittedAt).toLocaleDateString([], {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>

                    {/* Code indicator */}
                    {hasSubCode ? (
                      <div className="flex items-center gap-1 text-[10px] text-primary">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Code</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </div>
                    ) : (
                      <span className="text-[10px] text-faint">No code</span>
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
                        className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary"
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
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Notes</h3>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line border-l-2 border-primary/30 pl-4">
            {problem.notes}
          </p>
        </div>
      )}
    </div>
  );
}
