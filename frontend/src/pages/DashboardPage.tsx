import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAnalytics } from '../hooks/useAnalytics';
import { useProblemListView } from '../hooks/useProblems';
import QueryError from '../components/QueryError';
import Heatmap from '../components/Heatmap';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DifficultyProgress, Meter, MonthlySolvedChart, Panel, PanelLink, RecentProblems, StatTile, TopicList,
} from '@/components/dashboard/widgets';
import { cn } from '@/lib/utils';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
  onOpenNewProblem: () => void;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-44" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

/**
 * Dashboard — everything comes from GET /api/analytics/summary (computed on
 * the server, each problem counted once on its first accepted day) plus a
 * small page of the lightweight problem list for recent activity.
 */
export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenNewProblem }) => {
  const { user } = useAuth();
  const summary = useAnalytics('all');
  const recent = useProblemListView({ sort: '-lastSubmittedAt', limit: 6 });
  const [heatmapMode, setHeatmapMode] = useState<'solved' | 'submissions'>('solved');

  const s = summary.data;
  const refreshing = summary.fetching || recent.isFetching;
  const refresh = () => { summary.refetch(); recent.refetch(); };

  const recentItems = recent.data?.data ?? [];
  const toReview = recentItems.find((p) => p.hasCode && (!p.hasAiAnalysis || p.aiIsStale));

  const heatmapData = Object.fromEntries(
    (heatmapMode === 'solved' ? s?.solvedByDay : s?.submissionsByDay)?.map((d) => [d.date, d.count]) ?? []
  );

  return (
    <div className="space-y-6" id="dashboard-layout">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {greeting()}, {(user?.name || 'there').split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} aria-label="Refresh">
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={onOpenNewProblem}>
            <Plus /> Track problem
          </Button>
        </div>
      </div>

      {summary.error && (
        <QueryError title="Couldn't load your stats" message={summary.error} onRetry={refresh} />
      )}

      {!s && !summary.error ? (
        <DashboardSkeleton />
      ) : s ? (
        <>
          {/* Tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Today"
              value={<>{s.today.solved}<span className="text-base font-normal text-muted-foreground"> / {s.today.target}</span></>}
              sub={s.today.goalMet ? 'Daily goal met' : `${plural(s.today.remaining, 'problem')} to your goal`}
            >
              <Meter value={s.today.target ? s.today.solved / s.today.target : 0} barClassName={s.today.goalMet ? 'bg-success' : undefined} />
            </StatTile>
            <StatTile
              label="Streak"
              value={plural(s.streak.current, 'day')}
              sub={
                s.streak.current > 0 && !s.streak.activeToday
                  ? `Solve today to keep it · best ${s.streak.longest}`
                  : `Longest ${plural(s.streak.longest, 'day')}`
              }
            />
            <StatTile
              label="Solved"
              value={s.totals.solved.toLocaleString()}
              sub={`of ${s.totals.problems.toLocaleString()} tracked · ${s.totals.attempted} attempted`}
            />
            <StatTile
              label="Acceptance"
              value={s.totals.acceptanceRate === null ? '—' : `${Math.round(s.totals.acceptanceRate * 100)}%`}
              sub={`${s.totals.acceptedSubmissions.toLocaleString()} of ${plural(s.totals.submissions, 'submission')}`}
            />
          </div>

          {/* Activity heatmap */}
          <Panel
            title="Activity"
            action={
              <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Heatmap shows">
                {(['solved', 'submissions'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setHeatmapMode(m)}
                    aria-pressed={heatmapMode === m}
                    className={cn(
                      'rounded px-2 py-0.5 capitalize transition-colors',
                      heatmapMode === m ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            }
          >
            <Heatmap
              data={heatmapData}
              unit={heatmapMode === 'solved' ? ['problem solved', 'problems solved'] : ['submission', 'submissions']}
            />
          </Panel>

          {/* Trend + difficulty */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Solved per month" className="lg:col-span-2" action={<PanelLink to="/analytics">Analytics</PanelLink>}>
              <MonthlySolvedChart months={s.solvedByMonth} />
            </Panel>
            <Panel title="By difficulty">
              <DifficultyProgress byDifficulty={s.byDifficulty} />
            </Panel>
          </div>

          {/* Recent, topics, AI */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Recent activity" action={<PanelLink to="/problems">All problems</PanelLink>}>
              {recent.error
                ? <QueryError title="Couldn't load recent problems" message={recent.error.message} onRetry={() => recent.refetch()} />
                : recent.isPending ? <Skeleton className="h-48" /> : <RecentProblems items={recentItems} />}
            </Panel>

            <Panel title="Top topics" action={<PanelLink to="/analytics">More</PanelLink>}>
              <TopicList topics={s.topics} />
            </Panel>

            <Panel title="AI reviews" action={<PanelLink to="/analytics?tab=ai">Insights</PanelLink>}>
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {s.totals.aiAnalyzed}
                    <span className="text-base font-normal text-muted-foreground"> / {s.totals.solved}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">solved problems reviewed by AI</p>
                  <Meter className="mt-2" value={s.totals.solved ? s.totals.aiAnalyzed / s.totals.solved : 0} />
                  {s.totals.aiStale > 0 && (
                    <p className="mt-2 text-xs text-warning">{plural(s.totals.aiStale, 'review')} out of date</p>
                  )}
                </div>
                {toReview && (
                  <Link
                    to={`/problems/${toReview._id}?tab=analysis`}
                    className="flex items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-surface-2"
                  >
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-xs text-muted-foreground">
                        {toReview.hasAiAnalysis ? 'Re-review your latest code' : 'Review your latest solution'}
                      </span>
                      <span className="block truncate text-sm font-medium text-foreground">{toReview.title}</span>
                    </span>
                  </Link>
                )}
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
};
