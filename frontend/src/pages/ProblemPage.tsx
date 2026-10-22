import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Code2, History, Sparkles } from 'lucide-react';
import { useAnalyzeProblem, useProblem } from '@/hooks/useProblems';
import QueryError from '@/components/QueryError';
import VerdictBadge from '@/components/VerdictBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProblemHeader from '@/components/problem/ProblemHeader';
import AttemptTimeline from '@/components/problem/AttemptTimeline';
import PatternGuess from '@/components/problem/PatternGuess';
import AnalysisTab from '@/components/problem/AnalysisTab';
import SubmissionsTab from '@/components/problem/SubmissionsTab';
import CodeBlock from '@/components/problem/CodeBlock';
import DiagnosisPanel from '@/components/problem/DiagnosisPanel';
import { relativeTime } from '@/lib/format';
import type { Submission } from '@/types/problem';

const TABS = ['code', 'analysis', 'submissions'] as const;
type Tab = (typeof TABS)[number];

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading problem">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}

/**
 * One page per problem. The attempt timeline tells the story on top; below
 * it, what went wrong sits next to the code (two columns on wide screens).
 * The right column's tab lives in ?tab= so links can point straight at it.
 */
export default function ProblemPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const [params, setParams] = useSearchParams();
  const problemQuery = useProblem(problemId);
  const analyze = useAnalyzeProblem(problemId);
  const problem = problemQuery.data;

  const tabParam = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'code';
  const setTab = (t: string) =>
    setParams((p) => { p.set('tab', t); return p; }, { replace: true });

  const submissions: Submission[] = useMemo(
    () => [...(problem?.submissions ?? [])].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    ),
    [problem?.submissions]
  );

  // The code the analysis is based on: latest Accepted with code, else latest with code
  // (same rule as the backend's analyzer and staleness check).
  const withCode = submissions.filter((s) => s.code?.trim());
  const analyzedSubmission = withCode.find((s) => s.verdict === 'Accepted') ?? withCode[0] ?? null;

  // The try shown in the code panel: picked on the timeline, else the analysed one
  const [pickedId, setPickedId] = useState<string | null>(null);
  const shown = submissions.find((s) => s._id === pickedId) ?? analyzedSubmission ?? submissions[0] ?? null;
  const tryNumber = shown ? submissions.length - submissions.indexOf(shown) : 0;
  const pickTry = (id: string) => { setPickedId(id); setTab('code'); };

  if (problemQuery.isPending && problemId) return <PageSkeleton />;

  if (problemQuery.error) {
    return (
      <div className="mx-auto max-w-4xl">
        <QueryError title="Couldn't load this problem" message={problemQuery.error.message} onRetry={() => problemQuery.refetch()} />
      </div>
    );
  }

  if (!problem) {
    return <p className="py-12 text-center text-sm text-muted-foreground">This problem doesn't exist or was removed.</p>;
  }

  const meta = problem.aiAnalysisMeta;
  const analysisDot =
    meta?.status === 'pending' ? 'bg-primary animate-pulse'
      : meta?.status === 'error' ? 'bg-danger'
      : meta?.isStale ? 'bg-warning'
      : problem.aiAnalysis?.complexityAnalysis ? 'bg-success'
      : null;
  const solved = problem.status === 'Solved' || submissions.some((s) => s.verdict === 'Accepted');

  return (
    <div className="space-y-6" id="problem-page">
      <ProblemHeader problem={problem} />

      <AttemptTimeline submissions={submissions} selectedId={shown?._id ?? null} onSelect={pickTry} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* The story: which pattern, and what went wrong */}
        <div className="min-w-0 space-y-6">
          {problem.pattern && problem.platformProblemId && (
            <PatternGuess key={problem._id} pattern={problem.pattern} slug={problem.platformProblemId} solved={solved} />
          )}
          {problem.diagnosis && <DiagnosisPanel problemId={problem._id} diagnosis={problem.diagnosis} />}
          {problem.notes && (
            <section className="rounded-lg border border-border bg-surface-1 p-4">
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">Notes</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{problem.notes}</p>
            </section>
          )}
        </div>

        {/* The code, the AI review and every submission */}
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList variant="line" className="w-full justify-start gap-4 border-b border-border">
            <TabsTrigger value="code" className="flex-none"><Code2 /> Code</TabsTrigger>
            <TabsTrigger value="analysis" className="flex-none">
              <Sparkles /> AI analysis
              {analysisDot && <span className={`size-1.5 rounded-full ${analysisDot}`} aria-hidden />}
            </TabsTrigger>
            <TabsTrigger value="submissions" className="flex-none">
              <History /> Submissions
              <span className="rounded bg-surface-2 px-1.5 text-[11px] tabular-nums text-muted-foreground">{submissions.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="pt-4">
            {shown ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    Try {tryNumber} of {submissions.length} <VerdictBadge verdict={shown.verdict} /> {relativeTime(shown.submittedAt)}
                  </span>
                  {shown === analyzedSubmission
                    ? <span>The AI analysis uses this code</span>
                    : analyzedSubmission && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPickedId(analyzedSubmission._id)}>
                        Show {analyzedSubmission.verdict === 'Accepted' ? 'your accepted solution' : 'your latest code'}
                      </Button>
                    )}
                </div>
                {shown.code?.trim() ? (
                  <CodeBlock code={shown.code} language={shown.language} maxHeight="max-h-[34rem]" />
                ) : (
                  <p className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                    No code was saved for this try.
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
                No code saved for this problem yet. Import your LeetCode history from your profile, or install the extension.
              </p>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="pt-4">
            <AnalysisTab
              analysis={problem.aiAnalysis ?? null}
              meta={meta}
              hasCode={!!analyzedSubmission}
              language={analyzedSubmission?.language}
              onAnalyze={() => analyze.mutate()}
              requesting={analyze.isPending}
              requestError={analyze.error ? analyze.error.message : null}
            />
          </TabsContent>

          <TabsContent value="submissions" className="pt-4">
            <SubmissionsTab submissions={submissions} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
