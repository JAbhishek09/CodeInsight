import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import CodeBlock from '@/components/problem/CodeBlock';
import DifficultyBadge from '@/components/DifficultyBadge';
import { Button } from '@/components/ui/button';
import type { WorkedExample as Example } from '@/content/workedExamples';
import type { PatternProblem } from '@/types/pattern';

/** Clue phrases in reading order, with their position in the statement. */
function placedClues(ex: Example) {
  return ex.clues
    .map((c) => ({ ...c, at: ex.statement.indexOf(c.quote) }))
    .filter((c) => c.at >= 0)
    .sort((a, b) => a.at - b.at);
}

/** The statement with each clue phrase marked and numbered. */
function Statement({ ex }: { ex: Example }) {
  const clues = placedClues(ex);
  const parts: React.ReactNode[] = [];
  let pos = 0;
  clues.forEach((c, n) => {
    parts.push(ex.statement.slice(pos, c.at));
    parts.push(
      <mark key={n} className="rounded bg-[color-mix(in_oklab,var(--pc)_22%,transparent)] px-0.5 text-foreground">
        {c.quote}<sup className="ml-0.5 text-[10px] font-semibold text-muted-foreground">{n + 1}</sup>
      </mark>,
    );
    pos = c.at + c.quote.length;
  });
  parts.push(ex.statement.slice(pos));
  return <p className="text-sm leading-relaxed text-foreground/90">{parts}</p>;
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <span className="flex size-5 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--pc)_22%,transparent)] text-[11px] tabular-nums" aria-hidden>{n}</span>
      {children}
    </h3>
  );
}

/**
 * One problem worked from statement to code: read it, spot the clues,
 * think it through, code it. Uses the same input as the walkthrough above.
 */
export default function WorkedExample({ ex, progress }: { ex: Example; progress?: PatternProblem }) {
  const clues = placedClues(ex);
  const solved = progress?.status === 'solved';
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-base font-semibold text-foreground">{ex.title}</h2>
        <DifficultyBadge difficulty={ex.difficulty} />
        {solved && <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" /> You solved this</span>}
        <div className="ml-auto flex gap-2">
          {progress?.problemId && (
            <Button size="sm" variant="ghost" asChild><Link to={`/problems/${progress.problemId}`}>Your attempts</Link></Button>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={`https://leetcode.com/problems/${ex.slug}/`} target="_blank" rel="noopener noreferrer">Solve on LeetCode <ExternalLink /></a>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="min-w-0 space-y-5">
          <section className="space-y-2">
            <StepTitle n={1}>Read it</StepTitle>
            <Statement ex={ex} />
            <p className="rounded-md bg-surface-2 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
              <span className="text-subtle">Input:</span> {ex.example.input}<br />
              <span className="text-subtle">Output:</span> {ex.example.output}
            </p>
          </section>

          <section className="space-y-2">
            <StepTitle n={2}>Spot the clues</StepTitle>
            <ol className="space-y-2">
              {clues.map((c, n) => (
                <li key={c.quote} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="mt-0.5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{n + 1}</span>
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">“{c.quote}”</span>
                    <span className="text-muted-foreground"> — {c.why}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-2">
            <StepTitle n={3}>Think it through</StepTitle>
            <ol className="list-inside list-decimal space-y-1.5 text-sm leading-relaxed text-foreground/90 marker:text-muted-foreground">
              {ex.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
            <dl className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="rounded-md border border-border px-3 py-2">
                <dt className="text-muted-foreground">Brute force</dt>
                <dd className="mt-0.5 text-foreground">{ex.brute.idea}: <span className="font-mono">{ex.brute.cost}</span></dd>
              </div>
              <div className="rounded-md border border-[color-mix(in_oklab,var(--pc)_45%,transparent)] px-3 py-2">
                <dt className="text-muted-foreground">With the pattern</dt>
                <dd className="mt-0.5 text-foreground">time <span className="font-mono">{ex.complexity.time}</span> · space <span className="font-mono">{ex.complexity.space}</span></dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="min-w-0 space-y-3">
          <StepTitle n={4}>Code it</StepTitle>
          <CodeBlock code={ex.code} language="cpp" maxHeight="max-h-[28rem]" />
          <p className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm leading-relaxed text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span><span className="font-medium">Classic bug: </span>{ex.pitfall}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

