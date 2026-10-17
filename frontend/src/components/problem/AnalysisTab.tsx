import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Download, Gauge, Lightbulb,
  ListChecks, Loader2, MessageSquare, RefreshCw, ShieldAlert, Sparkles, Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import InlineCode from '@/components/InlineCode';
import CodeBlock from './CodeBlock';
import { cn } from '@/lib/utils';
import { relativeTime, dateTime } from '@/lib/format';
import { ANALYSIS_STALE_PENDING_MS } from '@/hooks/useProblems';
import type { AIAnalysis, AIAnalysisMeta } from '@/types/problem';

interface AnalysisTabProps {
  analysis: AIAnalysis | null;
  meta: AIAnalysisMeta | undefined;
  hasCode: boolean;
  /** Language of the code the analysis is (or will be) based on, for snippets. */
  language?: string;
  onAnalyze: () => void;
  requesting: boolean;
  requestError: string | null;
}

// ── Building blocks ───────────────────────────────────────────────────────────

function Section({ icon: Icon, title, aside, children }: {
  icon: typeof Gauge;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface-1">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {aside && <div className="ml-auto text-xs text-muted-foreground">{aside}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Banner({ tone, icon: Icon, children, action, spin }: {
  tone: 'info' | 'warning' | 'danger' | 'success';
  icon: typeof Gauge;
  children: React.ReactNode;
  action?: React.ReactNode;
  spin?: boolean;
}) {
  const tones = {
    info: 'border-primary/30 bg-primary/5 [&>svg]:text-primary',
    warning: 'border-warning/30 bg-warning/5 [&>svg]:text-warning',
    danger: 'border-danger/30 bg-danger/5 [&>svg]:text-danger',
    success: 'border-success/30 bg-success/5 [&>svg]:text-success',
  };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3', tones[tone])}>
      <Icon className={cn('size-4 shrink-0', spin && 'animate-spin')} aria-hidden />
      <div className="min-w-0 flex-1 text-sm text-foreground">{children}</div>
      {action}
    </div>
  );
}

function normaliseComplexity(s?: string) {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}

// ── Sections ──────────────────────────────────────────────────────────────────

function ComplexitySection({ data }: { data: NonNullable<AIAnalysis['complexityAnalysis']> }) {
  const isOptimal = !!data.current && !!data.optimal && normaliseComplexity(data.current) === normaliseComplexity(data.optimal);
  return (
    <Section
      icon={Gauge}
      title="Complexity"
      aside={isOptimal
        ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" /> Already optimal</span>
        : <span className="text-warning">Room to improve</span>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-surface-2 px-4 py-3">
          <p className="text-xs text-muted-foreground">Your solution</p>
          <p className={cn('mt-1 font-mono text-lg font-semibold', isOptimal ? 'text-success' : 'text-foreground')}>
            {data.current || '—'}
          </p>
        </div>
        <div className="rounded-md bg-surface-2 px-4 py-3">
          <p className="text-xs text-muted-foreground">Optimal</p>
          <p className="mt-1 font-mono text-lg font-semibold text-success">{data.optimal || '—'}</p>
        </div>
      </div>
      {data.explanation && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <InlineCode text={data.explanation} />
        </p>
      )}
    </Section>
  );
}

/** Hints are revealed one at a time so the user thinks before reading on. */
function HintsSection({ hints }: { hints: string[] }) {
  const [shown, setShown] = useState(0);
  return (
    <Section icon={Lightbulb} title="Hints" aside={`${shown} of ${hints.length} shown`}>
      {shown > 0 && (
        <ol className="mb-3 space-y-2.5">
          {hints.slice(0, shown).map((hint, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <span><InlineCode text={hint} /></span>
            </li>
          ))}
        </ol>
      )}
      {shown < hints.length ? (
        <Button variant="outline" size="sm" onClick={() => setShown((n) => n + 1)}>
          <Lightbulb /> {shown === 0 ? 'Show first hint' : 'Show next hint'}
        </Button>
      ) : (
        <p className="text-xs text-subtle">That's every hint.</p>
      )}
    </Section>
  );
}

function OptimizationsSection({ items, language }: { items: NonNullable<AIAnalysis['optimizationAreas']>; language?: string }) {
  return (
    <Section icon={Wrench} title="How to improve" aside={`${items.length} suggestion${items.length === 1 ? '' : 's'}`}>
      <ol className="space-y-4">
        {items.map((item, i) => {
          const description = typeof item === 'string' ? item : item.description;
          const snippet = typeof item === 'string' ? '' : item.snippet?.trim() ?? '';
          return (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold text-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm leading-relaxed text-muted-foreground"><InlineCode text={description} /></p>
                {snippet && <CodeBlock code={snippet} language={language} label="Suggested change" maxHeight="max-h-72" />}
              </div>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function EdgeCasesSection({ cases }: { cases: string[] }) {
  return (
    <Section icon={ShieldAlert} title="Edge cases to check">
      <ul className="space-y-2">
        {cases.map((c, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
            <ListChecks className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
            <span><InlineCode text={c} /></span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function InterviewSection({ items }: { items: NonNullable<AIAnalysis['interviewerQuestions']> }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Section icon={MessageSquare} title="Interview follow-ups" aside="Answer out loud, then check">
      <ul className="divide-y divide-border">
        {items.map((qa, i) => {
          const isOpen = open === i;
          return (
            <li key={i} className="py-1 first:pt-0 last:pb-0">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 rounded-md py-2 text-left"
              >
                <span className="mt-0.5 text-xs font-semibold tabular-nums text-subtle">Q{i + 1}</span>
                <span className="flex-1 text-sm font-medium leading-relaxed text-foreground">{qa.question}</span>
                <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-subtle transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <p className="mb-2 ml-8 rounded-md bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
                  <InlineCode text={qa.expectedAnswer} />
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function AnalyzingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export default function AnalysisTab({ analysis, meta, hasCode, language, onAnalyze, requesting, requestError }: AnalysisTabProps) {
  const pendingSince = meta?.pendingSince ? new Date(meta.pendingSince).getTime() : null;
  const running = meta?.status === 'pending' && pendingSince !== null && Date.now() - pendingSince < ANALYSIS_STALE_PENDING_MS;
  const deadJob = meta?.status === 'pending' && !running;
  const busy = requesting || running;
  const hasAnalysis = !!analysis?.complexityAnalysis;

  const analyzeButton = (label: string, variant: 'default' | 'outline' = 'default') => (
    <Button size="sm" variant={variant} onClick={onAnalyze} disabled={busy || !hasCode}>
      {busy ? <Loader2 className="animate-spin" /> : variant === 'default' ? <Sparkles /> : <RefreshCw />}
      {busy ? 'Analyzing…' : label}
    </Button>
  );

  // No code at all: nothing to analyse yet.
  if (!hasCode) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
        <Download className="size-6 text-subtle" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Import your code to analyze it</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            There's no code saved for this problem yet. Import your LeetCode history, or install the
            CodeInsight extension so new submissions are captured automatically.
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to="/profile">Go to import</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status */}
      {requestError && (
        <Banner tone="danger" icon={AlertTriangle} action={analyzeButton('Try again', 'outline')}>
          {requestError}
        </Banner>
      )}
      {!requestError && meta?.status === 'error' && !busy && (
        <Banner tone="danger" icon={AlertTriangle} action={analyzeButton('Try again', 'outline')}>
          The last analysis failed{meta.error ? `: ${meta.error}` : '.'}
        </Banner>
      )}
      {busy && (
        <Banner tone="info" icon={Loader2} spin>
          Analyzing your solution
          {running && pendingSince ? ` — started ${relativeTime(pendingSince)}` : ''}. This usually takes a few seconds.
        </Banner>
      )}
      {deadJob && !requesting && (
        <Banner tone="warning" icon={AlertTriangle} action={analyzeButton('Run again', 'outline')}>
          The last analysis didn't finish.
        </Banner>
      )}
      {hasAnalysis && !busy && meta?.isStale && (
        <Banner tone="warning" icon={RefreshCw} action={analyzeButton('Re-analyze')}>
          Your code changed after this analysis was made ({relativeTime(meta.generatedAt)}).
        </Banner>
      )}
      {hasAnalysis && !busy && !meta?.isStale && meta?.status !== 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5" title={dateTime(meta?.generatedAt ?? analysis?.generatedAt)}>
            <CheckCircle2 className="size-3.5 text-success" />
            Analyzed {relativeTime(meta?.generatedAt ?? analysis?.generatedAt)} · matches your latest code
          </span>
          {analyzeButton('Re-analyze', 'outline')}
        </div>
      )}

      {/* Content */}
      {busy && !hasAnalysis && <AnalyzingSkeleton />}

      {!hasAnalysis && !busy && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <Sparkles className="size-6 text-primary" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Get an AI review of your solution</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Time and space complexity against the optimal approach, hints, concrete improvements,
              edge cases and the follow-up questions an interviewer would ask.
            </p>
          </div>
          {analyzeButton('Analyze my solution')}
        </div>
      )}

      {hasAnalysis && analysis && (
        <div className={cn('space-y-4', busy && 'opacity-60')}>
          {analysis.complexityAnalysis && <ComplexitySection data={analysis.complexityAnalysis} />}
          {!!analysis.hints?.length && <HintsSection hints={analysis.hints} />}
          {!!analysis.optimizationAreas?.length && <OptimizationsSection items={analysis.optimizationAreas} language={language} />}
          {!!analysis.edgeCasesToConsider?.length && <EdgeCasesSection cases={analysis.edgeCasesToConsider} />}
          {!!analysis.interviewerQuestions?.length && <InterviewSection items={analysis.interviewerQuestions} />}
        </div>
      )}
    </div>
  );
}
