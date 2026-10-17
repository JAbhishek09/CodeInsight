import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import DifficultyBadge from '@/components/DifficultyBadge';
import { Button } from '@/components/ui/button';
import { relativeTime, shortDate } from '@/lib/format';
import type { Problem, Submission } from '@/types/problem';

const PLATFORM_LABEL: Record<string, string> = {
  leetcode: 'LeetCode',
  codeforces: 'Codeforces',
  manual: 'Manual',
};

const MAX_TAGS = 6;

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export default function ProblemHeader({ problem, submissions }: { problem: Problem; submissions: Submission[] }) {
  const accepted = submissions.filter((s) => s.verdict === 'Accepted');
  const firstSolved = accepted.length ? accepted[accepted.length - 1].submittedAt : null;
  const lastSubmitted = submissions[0]?.submittedAt ?? null;
  const acceptance = submissions.length ? Math.round((accepted.length / submissions.length) * 100) : null;
  const tags = problem.tags ?? [];
  const platform = problem.platform ?? 'manual';

  return (
    <header className="space-y-5">
      <Link
        to="/problems"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Problems
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-medium text-muted-foreground">
              {PLATFORM_LABEL[platform] ?? platform}
            </span>
            {problem.difficulty && <DifficultyBadge difficulty={problem.difficulty} />}
            <span className={problem.status === 'Solved' ? 'text-success' : 'text-muted-foreground'}>
              {problem.status}
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">{problem.title}</h1>
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
              {tags.slice(0, MAX_TAGS).map((tag) => (
                <li key={tag} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">{tag}</li>
              ))}
              {tags.length > MAX_TAGS && (
                <li className="px-1 py-0.5 text-xs text-subtle" title={tags.slice(MAX_TAGS).join(', ')}>
                  +{tags.length - MAX_TAGS}
                </li>
              )}
            </ul>
          )}
        </div>

        {problem.url && platform !== 'manual' && (
          <Button variant="outline" size="sm" asChild>
            <a href={problem.url} target="_blank" rel="noopener noreferrer">
              Open on {PLATFORM_LABEL[platform] ?? 'site'} <ExternalLink />
            </a>
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface-1 px-4 py-3 sm:grid-cols-4">
        <Stat label="Submissions" value={submissions.length} />
        <Stat
          label="Acceptance"
          value={acceptance === null ? '—' : `${acceptance}%`}
          hint={`${accepted.length} accepted of ${submissions.length}`}
        />
        <Stat label="First solved" value={shortDate(firstSolved)} />
        <Stat label="Last submission" value={relativeTime(lastSubmitted)} hint={lastSubmitted ?? undefined} />
      </dl>
    </header>
  );
}
