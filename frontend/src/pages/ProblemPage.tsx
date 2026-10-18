import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Code2, History, Sparkles } from 'lucide-react';
import { useAnalyzeProblem, useProblem } from '@/hooks/useProblems';
import QueryError from '@/components/QueryError';
import VerdictBadge from '@/components/VerdictBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProblemHeader from '@/components/problem/ProblemHeader';
import AnalysisTab from '@/components/problem/AnalysisTab';
import SubmissionsTab from '@/components/problem/SubmissionsTab';
import CodeBlock from '@/components/problem/CodeBlock';
import DiagnosisPanel from '@/components/problem/DiagnosisPanel';
import { relativeTime } from '@/lib/format';
import type { Submission } from '@/types/problem';

const TABS = ['analysis', 'code', 'submissions'] as const;
type Tab = (typeof TABS)[number];

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6" aria-busy="true" aria-label="Loading problem">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * One page per problem: AI analysis, the code it's based on, and the full
 * submission history. Replaces the old separate detail and analysis pages.
 * The active tab lives in ?tab= so links can point straight at it.
 */
export default function ProblemPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const [params, setParams] = useSearchParams();
  const problemQuery = useProblem(problemId);
  const analyze = useAnalyzeProblem(problemId);
  const problem = problemQuery.data;

  const tabParam = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'analysis';
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

  return (
    <div className="mx-auto max-w-4xl space-y-6" id="problem-page">
      <ProblemHeader problem={problem} submissions={submissions} />

      {problem.diagnosis && <DiagnosisPanel problemId={problem._id} diagnosis={problem.diagnosis} />}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="w-full justify-start gap-4 border-b border-border">
          <TabsTrigger value="analysis" className="flex-none">
            <Sparkles /> AI analysis
            {analysisDot && <span className={`size-1.5 rounded-full ${analysisDot}`} aria-hidden />}
          </TabsTrigger>
          <TabsTrigger value="code" className="flex-none"><Code2 /> Code</TabsTrigger>
          <TabsTrigger value="submissions" className="flex-none">
            <History /> Submissions
            <span className="rounded bg-surface-2 px-1.5 text-[11px] tabular-nums text-muted-foreground">{submissions.length}</span>
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="code" className="pt-4">
          {analyzedSubmission ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {analyzedSubmission.verdict === 'Accepted' ? 'Your latest accepted solution' : 'Your latest submission with code'} —
                this is the code the AI analysis uses.
              </p>
              <CodeBlock
                code={analyzedSubmission.code!}
                language={analyzedSubmission.language}
                meta={<>
                  <VerdictBadge verdict={analyzedSubmission.verdict} />
                  <span className="hidden text-xs text-subtle sm:inline">{relativeTime(analyzedSubmission.submittedAt)}</span>
                </>}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              No code saved for this problem yet. Import your LeetCode history from your profile, or install the extension.
            </p>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="pt-4">
          <SubmissionsTab submissions={submissions} />
        </TabsContent>
      </Tabs>

      {problem.notes && (
        <section className="rounded-lg border border-border bg-surface-1 p-4">
          <h2 className="mb-2 text-xs font-medium text-muted-foreground">Notes</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{problem.notes}</p>
        </section>
      )}
    </div>
  );
}
