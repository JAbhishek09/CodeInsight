import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, Check, CheckCircle2, CircleHelp, ExternalLink, Flame, Lightbulb, Loader2, RotateCcw, XCircle, Zap,
} from 'lucide-react';
import { useDrill, useDrillAnswer, useDrillStreak } from '../hooks/usePractice';
import QueryError from '../components/QueryError';
import ContrastTip from '../components/ContrastTip';
import DifficultyBadge from '../components/DifficultyBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { patternStyle, PATTERN_OPTIONS } from '@/lib/patterns';
import { deckScore, drillResult, formatScore, markClues, type DrillResult } from '@/lib/drill';
import type { DrillCard, DrillDeck, DrillStreak, PatternFeedback } from '@/types/pattern';

type Answer = { slug: string; predicted: string; hinted: boolean; feedback: PatternFeedback };

const resultOf = (a: Answer): DrillResult =>
  drillResult({ predicted: a.predicted, hinted: a.hinted, isCorrect: a.feedback.isCorrect });
const isAnswer = (f: PatternFeedback, key: string) => f.pattern?.key === key || f.secondary?.key === key;
const cardsWord = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;

/** Ignore shortcuts while typing somewhere. */
const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
};

// ── Daily drill ───────────────────────────────────────────────────────────────

/** The drill streak and today's cards against the daily target. */
function DailyDrill({ s }: { s: DrillStreak }) {
  const { current } = s.streak;
  const { cards, done } = s.today;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 py-2 pl-2 pr-4">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', current ? 'bg-warning/15 text-warning' : 'bg-surface-2 text-muted-foreground')}>
        <Flame className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {current ? `${current}-day drill streak` : 'Daily drill'}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <span className="block h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${Math.min(1, cards / s.target) * 100}%` }} />
          </span>
          {done
            ? <span className="inline-flex items-center gap-1 text-success"><Check className="size-3.5" aria-hidden /> Done today</span>
            : <span className="tabular-nums">{cards} of {cardsWord(s.target)} today</span>}
        </div>
      </div>
    </div>
  );
}

/** Under the results: did today count, and what keeps the streak going. */
function DailyStatus({ s }: { s: DrillStreak }) {
  const left = Math.max(0, s.target - s.today.cards);
  const { current } = s.streak;
  const text = s.today.done
    ? current > 1 ? `Daily drill done — ${current} days in a row.` : 'Daily drill done — your streak starts today.'
    : current > 0 ? `${cardsWord(left)} more today makes it ${current + 1} days in a row.` : `${cardsWord(left)} more today starts a drill streak.`;
  return (
    <p className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-1 px-4 py-3 text-sm text-foreground">
      <Flame className={cn('size-5 shrink-0', s.today.done ? 'text-warning' : 'text-muted-foreground')} aria-hidden />
      {text}
    </p>
  );
}

// ── Progress ──────────────────────────────────────────────────────────────────

const FILL: Record<DrillResult, string> = { right: 'bg-success', wrong: 'bg-danger', unsure: 'bg-warning', hinted: '' };

function Progress({ total, answers, index }: { total: number; answers: Answer[]; index: number }) {
  return (
    <ol className="flex gap-1" aria-label={`Card ${Math.min(index + 1, total)} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const r = answers[i] && resultOf(answers[i]);
        return (
          <li
            key={i}
            className={cn('h-1.5 flex-1 rounded-full transition-colors', r ? FILL[r] : i === index ? 'bg-primary' : 'bg-surface-3')}
            // Right with the hint: half a bar for half a point
            style={r === 'hinted' ? { background: 'linear-gradient(90deg, var(--success) 50%, var(--surface-3) 50%)' } : undefined}
          />
        );
      })}
    </ol>
  );
}

// ── One card ──────────────────────────────────────────────────────────────────

function Card({ card, hinted, answered, onHint }: { card: DrillCard; hinted: boolean; answered: boolean; onHint: () => void }) {
  // The hint highlights the clue words; after answering they show either way
  const showClues = hinted || answered;
  const segments = useMemo(() => markClues(card.prompt, showClues ? card.clues : []), [card, showClues]);
  const canHint = card.clues.length > 0;

  return (
    <article className="drill-card relative overflow-hidden rounded-2xl border border-border bg-surface-1 p-5 sm:p-7">
      <span className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-center gap-2 text-xs">
        <DifficultyBadge difficulty={card.difficulty} />
        {card.missedBefore && <span className="rounded-full bg-danger/15 px-2 py-0.5 font-medium text-danger">Missed last time</span>}
        {card.hintedBefore && <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">Needed the hint last time</span>}
      </div>
      <p className="relative mt-4 text-lg leading-relaxed text-foreground sm:text-xl">
        {segments.map((s, i) => (s.clue ? <mark key={i} className="drill-clue">{s.text}</mark> : <span key={i}>{s.text}</span>))}
      </p>
      <div className="relative mt-4 flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {answered
            ? canHint && 'The highlighted words were the clue.'
            : hinted
              ? <>Hint: the highlighted words are the clue.<span className="sr-only"> They are: {card.clues.join('; ')}.</span></>
              : 'Which pattern fits? Decide before you peek.'}
        </p>
        {!answered && canHint && (hinted ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lightbulb className="size-3.5 text-warning" aria-hidden /> Hint used: a right answer is worth half
          </span>
        ) : (
          <Button size="sm" variant="outline" onClick={onHint} aria-keyshortcuts="h">
            <Lightbulb /> Hint <span className="font-normal text-muted-foreground">· half a point</span>
          </Button>
        ))}
      </div>
    </article>
  );
}

function Reveal({ f, hinted, onNext, last }: { f: PatternFeedback; hinted: boolean; onNext: () => void; last: boolean }) {
  const right = f.isCorrect === true;
  const Icon = right ? CheckCircle2 : f.outcome === 'unsure' ? CircleHelp : XCircle;
  const p = f.pattern!;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[data-next]')?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  return (
    <div ref={ref} role="status" style={patternStyle(p.key)} className="drill-reveal scroll-mb-24 rounded-xl border p-4 pat-border pat-tint">
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 size-5 shrink-0', right ? 'text-success' : f.outcome === 'unsure' ? 'text-warning' : 'text-danger')} aria-hidden />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="font-semibold text-foreground">
            {right ? `Yes — ${p.name}` : f.title}
            {right && hinted && <span className="ml-2 text-xs font-normal text-muted-foreground">with the hint · half a point</span>}
          </p>
          <p className="text-sm text-foreground/85"><span className="font-medium pat-text">The clue:</span> {p.cue}.</p>
          {p.short && <p className="text-sm text-foreground/70">{p.short}</p>}
          {f.contrast && (
            <ContrastTip className="mt-2" actual={{ key: p.key, name: p.name }} other={f.contrast} tip={f.contrast.tip} />
          )}
          {f.problem && (
            <p className="pt-1 text-xs text-muted-foreground">
              This was <a href={f.problem.url} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:underline">
                {f.problem.title} <ExternalLink className="inline size-3 align-[-1px]" />
              </a> · optimal {p.complexity} · <Link to={`/patterns/${p.key}`} className="pat-text hover:underline">pattern guide</Link>
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onNext} data-next>
          {last ? 'See results' : 'Next'} <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function Options({ options, picked, feedback, disabled, onPick }: {
  options: DrillDeck['options']; picked: string | null; feedback: PatternFeedback | null; disabled: boolean; onPick: (k: string) => void;
}) {
  return (
    <div className="space-y-2">
      {/* Two columns on phones; one list beside the card on wide screens */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {options.map((o, i) => {
          const correct = feedback && isAnswer(feedback, o.key);
          const wrongPick = feedback && picked === o.key && !correct;
          const faded = feedback && !correct && !wrongPick;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onPick(o.key)}
              disabled={disabled || !!feedback}
              style={patternStyle(o.key)}
              aria-keyshortcuts={String(i + 1)}
              className={cn(
                'group flex items-center gap-2 rounded-lg border bg-surface-1 px-2.5 py-2 text-left text-[13px] leading-tight text-foreground transition-all sm:gap-3 sm:px-3 sm:py-2.5 sm:text-sm',
                !feedback && 'border-border hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--pc)_60%,transparent)] hover:bg-[color-mix(in_oklab,var(--pc)_10%,transparent)]',
                correct && 'pat-glow pat-tint border-transparent',
                wrongPick && 'border-danger/70 bg-danger/10',
                faded && 'border-border opacity-40',
              )}
            >
              <kbd className="hidden size-5 shrink-0 items-center justify-center rounded border border-border text-[10px] text-muted-foreground sm:flex">{i + 1}</kbd>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: 'var(--pc)', boxShadow: '0 0 10px var(--pc)' }} aria-hidden />
              <span className="min-w-0 flex-1 font-medium">{o.name}</span>
              {correct && <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="correct" />}
              {wrongPick && <XCircle className="size-4 shrink-0 text-danger" aria-label="your guess" />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onPick('unsure')}
        disabled={disabled || !!feedback}
        aria-keyshortcuts="0"
        className={cn('w-full rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:hover:text-muted-foreground',
          picked === 'unsure' && feedback ? 'border-warning/60 text-warning' : 'border-border-strong')}
      >
        Not sure — show me <span className="hidden sm:inline">(0)</span>
      </button>
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────

function Results({ answers, onAgain, scoped, daily }: { answers: Answer[]; onAgain: () => void; scoped: boolean; daily: DrillStreak | undefined }) {
  const results = answers.map(resultOf);
  const score = deckScore(results);
  const withHint = results.filter((r) => r === 'hinted').length;
  const misses = answers.filter((a) => resultOf(a) !== 'right');
  const ratio = answers.length ? score / answers.length : 0;
  const weakest = useMemo(() => {
    const n = new Map<string, number>();
    for (const a of misses) if (a.feedback.pattern) n.set(a.feedback.pattern.key, (n.get(a.feedback.pattern.key) ?? 0) + 1);
    const top = [...n.entries()].sort((x, y) => y[1] - x[1])[0];
    return top && PATTERN_OPTIONS.find((p) => p.key === top[0]);
  }, [misses]);
  const R = 52, C = 2 * Math.PI * R;

  return (
    <div className={cn('grid gap-6', misses.length > 0 && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start')}>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-border bg-surface-1 p-6">
          <svg viewBox="0 0 120 120" className="size-28 shrink-0 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={ratio >= 0.7 ? 'var(--success)' : ratio >= 0.4 ? 'var(--warning)' : 'var(--danger)'}
              strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - ratio)} className="transition-[stroke-dashoffset] duration-700" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatScore(score)}<span className="text-lg text-muted-foreground"> / {answers.length}</span></p>
            {withHint > 0 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {withHint === 1 ? '1 right with the hint, worth half a point' : `${withHint} right with the hint, half a point each`}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {ratio >= 0.8 ? 'Sharp. You’re reading problems the right way.' : ratio >= 0.5 ? 'Good progress — the misses below are your next wins.' : 'Every miss here is a cue you’ll spot next time.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={onAgain}><RotateCcw /> New deck</Button>
              {weakest && !scoped && (
                <Button variant="outline" asChild>
                  <Link to={`/drill?pattern=${weakest.key}`}><Zap /> Drill {weakest.name}</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
        {daily && <DailyStatus s={daily} />}
      </div>

      {misses.length > 0 && (
        <section aria-labelledby="misses-title" className="min-w-0 space-y-2">
          <h2 id="misses-title" className="text-sm font-semibold text-foreground">Cues to remember</h2>
          <ul className="space-y-2">
            {misses.map((a) => {
              const p = a.feedback.pattern!;
              return (
                <li key={a.slug} style={patternStyle(p.key)} className="rounded-lg border border-border bg-surface-1 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-foreground">{a.feedback.problem?.title ?? a.slug}</span>
                    <span className="text-muted-foreground">→</span>
                    <Link to={`/patterns/${p.key}`} className="inline-flex items-center gap-1.5 font-medium pat-text hover:underline">
                      <span className="size-2 rounded-full" style={{ background: 'var(--pc)' }} aria-hidden />{p.name}
                    </Link>
                    {resultOf(a) === 'hinted'
                      ? <span className="text-xs text-muted-foreground">(right, with the hint)</span>
                      : a.predicted !== 'unsure' && <span className="text-xs text-muted-foreground">(you said {a.feedback.predictedName})</span>}
                  </div>
                  <p className="mt-1 text-muted-foreground">{p.cue}</p>
                  {a.feedback.contrast && (
                    <ContrastTip compact className="mt-2" actual={{ key: p.key, name: p.name }} other={a.feedback.contrast} tip={a.feedback.contrast.tip} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── Session ───────────────────────────────────────────────────────────────────

function Session({ deck, onAgain, scoped, daily }: { deck: DrillDeck; onAgain: () => void; scoped: boolean; daily: DrillStreak | undefined }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [hintedSlug, setHintedSlug] = useState<string | null>(null);
  const answer = useDrillAnswer();

  const card = deck.cards[index];
  const current = answers[index] ?? null;
  const hinted = current ? current.hinted : !!card && hintedSlug === card.slug;
  const done = index >= deck.cards.length;
  // Right answers in a row, without the hint
  const inARow = useMemo(() => {
    let n = 0;
    for (let i = answers.length - 1; i >= 0 && resultOf(answers[i]) === 'right'; i -= 1) n += 1;
    return n;
  }, [answers]);

  const pick = useCallback((predicted: string) => {
    if (!card || current || answer.isPending) return;
    answer.mutate({ slug: card.slug, predicted, hinted }, {
      onSuccess: (feedback) => setAnswers((a) => [...a, { slug: card.slug, predicted, hinted, feedback }]),
    });
  }, [card, current, answer, hinted]);
  const showHint = useCallback(() => {
    if (card && !current && card.clues.length) setHintedSlug(card.slug);
  }, [card, current]);
  const next = useCallback(() => { if (current) setIndex((i) => i + 1); }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!current) {
        const n = Number(e.key);
        if (e.key === '0' || e.key === '?') { e.preventDefault(); pick('unsure'); }
        else if (e.key === 'h' || e.key === 'H') { e.preventDefault(); showHint(); }
        else if (n >= 1 && n <= deck.options.length) { e.preventDefault(); pick(deck.options[n - 1].key); }
      } else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, pick, showHint, next, deck.options]);

  if (deck.cards.length === 0) {
    return <p className="rounded-xl border border-border bg-surface-1 p-6 text-center text-sm text-muted-foreground">No cards for this pattern yet.</p>;
  }
  if (done) return <Results answers={answers} onAgain={onAgain} scoped={scoped} daily={daily} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex-1"><Progress total={deck.cards.length} answers={answers} index={index} /></div>
        <span className="text-xs tabular-nums text-muted-foreground">{index + 1}/{deck.cards.length}</span>
        {inARow >= 2 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold tabular-nums text-warning" aria-label={`${inARow} in a row`}>
            <Flame className="size-3.5" aria-hidden /> {inARow}
          </span>
        )}
      </div>

      {/*
        Phones: card, choices, answer, one after another.
        Wide screens: card with the answer under it on the left, choices beside them.
      */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-[auto_1fr] lg:gap-x-6">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Card key={card.slug} card={card} hinted={hinted} answered={!!current} onHint={showHint} />
        </div>
        <div className="min-w-0 space-y-2 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <Options options={deck.options} picked={current?.predicted ?? null} feedback={current?.feedback ?? null} disabled={answer.isPending} onPick={pick} />
          {answer.isPending && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Checking…</p>}
          {answer.error && <p role="alert" className="text-sm text-danger">{answer.error.message}</p>}
        </div>
        {current && (
          <div className="min-w-0 lg:col-start-1 lg:row-start-2">
            <Reveal f={current.feedback} hinted={current.hinted} onNext={next} last={index === deck.cards.length - 1} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DrillPage() {
  const [params, setParams] = useSearchParams();
  const pattern = params.get('pattern');
  const q = useDrill(pattern);
  const daily = useDrillStreak().data;
  const choose = (key: string | null) => setParams(key ? { pattern: key } : {}, { replace: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6 lg:max-w-none">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-2xl">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Zap className="size-6 text-primary" aria-hidden /> Guess the pattern
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read the task, pick the pattern. Ten quick cards — no coding, just recognition.
            <span className="hidden sm:inline"> Keys 1–8 to answer, H for a hint, 0 if unsure, → for next.</span>
          </p>
        </div>
        {daily && <DailyDrill s={daily} />}
      </div>

      {/* Phones: one swipeable row (no visible scrollbar). Wider screens: wrap. */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Deck">
        <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
          <button type="button" onClick={() => choose(null)} aria-pressed={!pattern}
            className={cn('rounded-full border px-3 py-1 text-xs transition-colors', !pattern ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
            Mixed
          </button>
          {PATTERN_OPTIONS.map((p) => (
            <button key={p.key} type="button" onClick={() => choose(p.key)} aria-pressed={pattern === p.key} style={patternStyle(p.key)}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                pattern === p.key ? 'pat-border pat-tint text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
              <span className="size-1.5 rounded-full" style={{ background: 'var(--pc)' }} aria-hidden />{p.name}
            </button>
          ))}
        </div>
      </div>

      {q.error && <QueryError title="Couldn't load a deck" message={q.error.message} onRetry={() => q.refetch()} />}
      {q.isPending && (
        <div className="space-y-5" aria-busy="true" aria-label="Loading deck">
          <Skeleton className="h-1.5" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-x-6">
            <Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-48 lg:h-96" />
          </div>
        </div>
      )}
      {q.data && !q.isFetching && (
        <Session key={`${pattern ?? 'mixed'}-${q.dataUpdatedAt}`} deck={q.data} onAgain={() => q.refetch()} scoped={!!pattern} daily={daily} />
      )}
      {q.data && q.isFetching && <Skeleton className="h-64 rounded-2xl" />}
    </div>
  );
}
