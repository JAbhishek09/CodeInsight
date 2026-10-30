import { useSearchParams } from 'react-router-dom';
import { BarChart3, Network, RefreshCw, Sparkles } from 'lucide-react';
import { useAnalytics, type AnalyticsPlatform } from '../hooks/useAnalytics';
import { useAiInsights } from '../hooks/useAiInsights';
import { useProblemListView } from '../hooks/useProblems';
import { usePatternReport } from '../hooks/usePatternReport';
import QueryError from '../components/QueryError';
import OverviewTab from '@/components/analytics/OverviewTab';
import PatternsTab from '@/components/analytics/PatternsTab';
import AiInsightsTab from '@/components/analytics/AiInsightsTab';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const TABS = ['patterns', 'overview', 'ai'] as const;
const DEFAULT_TAB = 'patterns';
type Tab = (typeof TABS)[number];
const PLATFORMS: { id: AnalyticsPlatform; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'leetcode', label: 'LeetCode' },
  { id: 'codeforces', label: 'Codeforces' },
];

function TabSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  );
}

/**
 * Analytics: Patterns (GET /api/analytics/patterns — what you solve, spot and
 * get wrong, per pattern), an Overview of practice stats (GET
 * /api/analytics/summary) and AI insights (GET /api/analytics/ai-insights).
 * ?tab= and ?platform= live in the URL.
 */
export default function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : DEFAULT_TAB;
  const platformParam = params.get('platform') as AnalyticsPlatform | null;
  const platform: AnalyticsPlatform = PLATFORMS.some((p) => p.id === platformParam) ? platformParam! : 'all';

  const set = (k: string, v: string, dflt: string) =>
    setParams((p) => { if (v === dflt) p.delete(k); else p.set(k, v); return p; }, { replace: true });

  const summary = useAnalytics(platform);
  // Platform switch only matters once there's more than one platform.
  const allSummary = useAnalytics('all');
  const hasCodeforces = (allSummary.data?.byPlatform?.codeforces?.total ?? 0) > 0;
  const ai = useAiInsights(platform);
  const report = usePatternReport();
  const recentSolved = useProblemListView({ status: 'Solved', sort: '-lastSubmittedAt', limit: 20 });
  const nextToReview = recentSolved.data?.data.find((p) => p.hasCode && !p.hasAiAnalysis)?._id ?? null;

  const refreshing = summary.fetching || ai.isFetching || report.isFetching;
  const refresh = () => { summary.refetch(); ai.refetch(); report.refetch(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">What you spot, where you slip, and how you practise</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Patterns are LeetCode-only, so the platform switch only applies to the other tabs */}
          {hasCodeforces && tab !== 'patterns' && (
            <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Platform">
              {PLATFORMS.map((p) => (
                <button key={p.id} type="button" onClick={() => set('platform', p.id, 'all')} aria-pressed={platform === p.id}
                  className={cn('rounded px-2.5 py-1', platform === p.id ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} aria-label="Refresh">
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => set('tab', v, DEFAULT_TAB)}>
        <TabsList variant="line" className="w-full justify-start gap-4 border-b border-border">
          <TabsTrigger value="patterns" className="flex-none"><Network /> Patterns</TabsTrigger>
          <TabsTrigger value="overview" className="flex-none"><BarChart3 /> Overview</TabsTrigger>
          <TabsTrigger value="ai" className="flex-none"><Sparkles /> AI insights</TabsTrigger>
        </TabsList>

        <TabsContent value="patterns" className="pt-4">
          {report.error ? <QueryError title="Couldn't load your pattern report" message={report.error.message} onRetry={() => report.refetch()} />
            : report.data ? <PatternsTab report={report.data} /> : <TabSkeleton />}
        </TabsContent>

        <TabsContent value="overview" className="pt-4">
          {summary.error ? <QueryError title="Couldn't load your stats" message={summary.error} onRetry={() => summary.refetch()} />
            : summary.data ? <OverviewTab s={summary.data} /> : <TabSkeleton />}
        </TabsContent>

        <TabsContent value="ai" className="pt-4">
          {ai.error ? <QueryError title="Couldn't load AI insights" message={ai.error.message} onRetry={() => ai.refetch()} />
            : ai.data && summary.data ? <AiInsightsTab data={ai.data} topics={summary.data.topics} nextToReviewId={nextToReview} />
            : <TabSkeleton />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
