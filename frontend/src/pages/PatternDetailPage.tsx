import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, ExternalLink, Eye, Search, Zap } from 'lucide-react';
import { usePattern } from '../hooks/usePatterns';
import QueryError from '../components/QueryError';
import DifficultyBadge from '../components/DifficultyBadge';
import CodeBlock from '@/components/problem/CodeBlock';
import { Panel } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { patternStyle } from '@/lib/patterns';
import type { PatternProblem } from '@/types/pattern';

const STATUS: Record<PatternProblem['status'], { label: string; dot: string }> = {
  solved: { label: 'Solved', dot: 'bg-success' },
  attempted: { label: 'Attempted', dot: 'bg-warning' },
  todo: { label: 'Not started', dot: 'bg-surface-3' },
};

function ProblemRow({ p }: { p: PatternProblem }) {
  const [showCue, setShowCue] = useState(false);
  const s = STATUS[p.status];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
      <span className={cn('size-2 shrink-0 rounded-full', s.dot)} title={s.label} aria-label={s.label} />
      <span className="min-w-0 flex-1 basis-56">
        {p.problemId
          ? <Link to={`/problems/${p.problemId}`} className="font-medium text-foreground hover:underline">{p.title}</Link>
          : <span className="font-medium text-foreground">{p.title}</span>}
        {!p.primary && <span className="ml-2 text-xs text-subtle">(also uses this)</span>}
        {showCue
          ? <span className="mt-0.5 block text-xs pat-text">Clue: {p.cue} · {p.complexity}</span>
          : (
            <button type="button" onClick={() => setShowCue(true)} className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Eye className="size-3" /> Show the clue
            </button>
          )}
      </span>
      <DifficultyBadge difficulty={p.difficulty} />
      <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground" aria-label={`Open ${p.title} on LeetCode`}>
        <ExternalLink className="size-4" />
      </a>
    </li>
  );
}

export default function PatternDetailPage() {
  const { key } = useParams<{ key: string }>();
  const q = usePattern(key);
  const p = q.data;

  if (q.error) {
    return (
      <div className="space-y-4">
        <Link to="/patterns" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Patterns</Link>
        <QueryError title="Couldn't load this pattern" message={q.error.message} onRetry={() => q.refetch()} />
      </div>
    );
  }
  if (!p) {
    return <div className="space-y-4" aria-busy="true"><Skeleton className="h-6 w-40" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  const solved = p.problems.filter((x) => x.status === 'solved' && x.primary).length;
  const total = p.problems.filter((x) => x.primary).length;
  const pct = total ? Math.round((solved / total) * 100) : 0;

  return (
    <div className="space-y-6" style={patternStyle(p.key)}>
      <Link to="/patterns" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Patterns
      </Link>

      <header className="overflow-hidden rounded-xl border p-6 pat-border pat-tint">
        <p className="text-xs font-medium uppercase tracking-wide pat-text">Pattern</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{p.name}</h1>
        <p className="mt-2 max-w-2xl text-base text-foreground/80">{p.short}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="h-2 w-48 overflow-hidden rounded-full bg-background/60">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: 'var(--pc)' }} />
          </div>
          <span className="text-sm tabular-nums text-foreground">{solved}/{total} key problems solved</span>
          <Button size="sm" variant="outline" className="sm:ml-auto" asChild>
            <Link to={`/drill?pattern=${p.key}`}><Zap /> Drill this pattern</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="What it is">
          <p className="text-sm leading-relaxed text-muted-foreground">{p.explanation}</p>
        </Panel>
        <Panel title="How to recognise it">
          <ul className="space-y-2.5">
            {p.cues.map((c) => (
              <li key={c} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
                <Search className="mt-0.5 size-4 shrink-0 pat-text" aria-hidden /> {c}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Common wrong turns">
          <ul className="space-y-2.5">
            {p.wrongTurns.map((w) => (
              <li key={w} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {w}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Template">
          <CodeBlock code={p.template} language="cpp" maxHeight="max-h-80" />
        </Panel>
      </div>

      <Panel
        title="Practise recognising it"
        action={<span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Check className="size-3.5" /> try to spot the clue before revealing it</span>}
      >
        <ul className="-my-3 divide-y divide-border">
          {p.problems.map((x) => <ProblemRow key={x.slug} p={x} />)}
        </ul>
      </Panel>
    </div>
  );
}
