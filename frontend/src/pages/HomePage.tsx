import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CheckCircle2, ExternalLink, Play, Target, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToday } from '../hooks/usePractice';
import { useWeeklyRecognition } from '../hooks/usePredictions';
import QueryError from '../components/QueryError';
import GetStarted from '../components/home/GetStarted';
import RecognitionTrend from '../components/home/RecognitionTrend';
import PlanList, { MINUTES } from '../components/home/PlanList';
import ScoreRing from '../components/home/ScoreRing';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { patternStyle } from '@/lib/patterns';
import type { TodayPlan } from '@/types/pattern';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero({ d, name }: { d: TodayPlan; name: string }) {
  const weekly = useWeeklyRecognition(8);
  const weeks = (weekly.data ?? []).filter((w) => w.firstTry.attempts >= 3);
  const delta = weeks.length >= 2
    ? Math.round(((weeks[weeks.length - 1].firstTry.accuracy ?? 0) - (weeks[0].firstTry.accuracy ?? 0)) * 100)
    : null;
  const next = d.plan[0];
  const minutes = d.plan.reduce((n, it) => n + MINUTES[it.difficulty], 0);
  const reviews = d.plan.filter((p) => p.kind === 'review').length;
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const accent = d.focus ? `var(--pat-${d.focus.key})` : 'var(--primary)';

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border bg-surface-1"
      style={{
        backgroundImage: `radial-gradient(60% 120% at 100% 0%, color-mix(in oklab, ${accent} 16%, transparent), transparent 60%),
          radial-gradient(50% 90% at 0% 100%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 60%)`,
      }}
    >
      {/* faint grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        style={{ backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{date}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {greeting()}, {name}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {d.plan.length > 0 ? (
              <>
                <span className="text-foreground">{plural(d.plan.length, 'problem')}</span> on today’s plan
                {reviews > 0 && <> including {plural(reviews, 'review')}</>} — about{' '}
                <span className="text-foreground">{minutes} minutes</span>. Guess the pattern before you write any code.
              </>
            ) : 'Nothing scheduled today. Keep your eye sharp with a quick drill.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {next && (
              <Button size="lg" asChild>
                <a href={next.url} target="_blank" rel="noopener noreferrer">
                  <Play className="fill-current" /> Start: {next.title}
                </a>
              </Button>
            )}
            <Button size="lg" variant="outline" asChild>
              <Link to="/drill"><Zap /> 2-minute drill</Link>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-6 sm:gap-8">
          <ScoreRing value={d.recognition.accuracy} size={132} stroke={11}>
            <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{pct(d.recognition.accuracy)}</span>
            <span className="text-[11px] text-muted-foreground">recognition</span>
          </ScoreRing>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Trend</dt>
              <dd className={cn('font-semibold tabular-nums', delta == null ? 'text-subtle' : delta >= 0 ? 'text-success' : 'text-danger')}>
                {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta} pts`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Guesses so far</dt>
              <dd className="font-semibold tabular-nums text-foreground">{d.recognition.attempts}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Solved today</dt>
              <dd className="font-semibold tabular-nums text-foreground">{d.doneToday.length}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

// ── Side cards ────────────────────────────────────────────────────────────────

function FocusCard({ focus }: { focus: NonNullable<TodayPlan['focus']> }) {
  const ratio = focus.total ? focus.solved / focus.total : 0;
  return (
    <Link
      to={`/patterns/${focus.key}`}
      style={patternStyle(focus.key)}
      className="group relative block overflow-hidden rounded-xl border p-5 pat-border transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_0_28px_color-mix(in_oklab,var(--pc)_30%,transparent)]"
    >
      <span className="pointer-events-none absolute inset-0 pat-tint" aria-hidden />
      <span className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-40 blur-3xl" style={{ background: 'var(--pc)' }} aria-hidden />
      <div className="relative">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] pat-text"><Target className="size-3.5" /> Focus pattern</p>
        <div className="mt-3 flex items-center gap-4">
          <ScoreRing value={ratio} size={64} stroke={6} color="var(--pc)">
            <span className="text-sm font-semibold tabular-nums text-foreground">{Math.round(ratio * 100)}%</span>
          </ScoreRing>
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight tracking-tight text-foreground">{focus.name}</p>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              {focus.solved}/{focus.total} solved{focus.recognition && <> · {pct(focus.recognition.accuracy)} spotted</>}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground/80">{focus.short}</p>
        <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
          Open the guide <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </p>
      </div>
    </Link>
  );
}

function ReviewsCard({ d }: { d: TodayPlan }) {
  const due = d.plan.filter((p) => p.kind === 'review');
  return (
    <section aria-labelledby="reviews-title" className="rounded-xl border border-border bg-surface-1 p-5">
      <div className="flex items-center justify-between">
        <h2 id="reviews-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarClock className="size-4 text-warning" aria-hidden /> Review queue
        </h2>
        <span className="text-xs text-muted-foreground">spaced repetition</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-2xl font-semibold tabular-nums text-foreground">{d.reviews.due}</p>
          <p className="text-xs text-muted-foreground">due today</p>
        </div>
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-2xl font-semibold tabular-nums text-foreground">{d.reviews.upcomingThisWeek}</p>
          <p className="text-xs text-muted-foreground">later this week</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {due.length > 0
          ? 'Problems you missed or struggled with come back until they stick.'
          : 'Nothing due. Misses and hard solves are scheduled here automatically.'}
      </p>
    </section>
  );
}

function DoneToday({ items }: { items: TodayPlan['doneToday'] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="done-title" className="rounded-xl border border-border bg-surface-1 p-5">
      <h2 id="done-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CheckCircle2 className="size-4 text-success" aria-hidden /> Solved today
      </h2>
      <ul className="mt-3 space-y-1.5">
        {items.map((x) => (
          <li key={x.slug}>
            <Link to={`/problems/${x.problemId}`} style={x.pattern ? patternStyle(x.pattern) : undefined}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-surface-2">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: x.pattern ? 'var(--pc)' : 'var(--text-muted)' }} aria-hidden />
              <span className="truncate">{x.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Skill map ─────────────────────────────────────────────────────────────────

function SkillMap({ d }: { d: TodayPlan }) {
  return (
    <section aria-labelledby="skills-title" className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 id="skills-title" className="text-lg font-semibold tracking-tight text-foreground">Your patterns</h2>
          <p className="text-sm text-muted-foreground">Solved share of each pattern’s key problems, and how often you spot it.</p>
        </div>
        <Link to="/patterns" className="hidden shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
          Pattern map <ArrowRight className="size-4" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {d.patterns.map((p) => {
          const r = p.total ? p.solved / p.total : 0;
          const focus = p.key === d.focus?.key;
          return (
            <li key={p.key}>
              <Link
                to={`/patterns/${p.key}`}
                style={patternStyle(p.key)}
                className={cn(
                  'group flex h-full items-center gap-3 rounded-xl border bg-surface-1 p-3.5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--pc)_55%,transparent)]',
                  focus ? 'pat-border' : 'border-border'
                )}
              >
                <ScoreRing value={r} size={44} stroke={4} color="var(--pc)">
                  <span className="text-[11px] font-semibold tabular-nums text-foreground">{Math.round(r * 100)}</span>
                </ScoreRing>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{p.name}</span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {p.solved}/{p.total}{p.accuracy != null && <> · {pct(p.accuracy)} spotted</>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your plan">
      <Skeleton className="h-64 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
        <div className="space-y-4"><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const q = useToday();
  const d = q.data;
  const firstName = (user?.name || 'there').split(' ')[0];

  if (q.error) return <QueryError title="Couldn't load today's plan" message={q.error.message} onRetry={() => q.refetch()} />;
  if (!d) return <HomeSkeleton />;

  return (
    <div className="space-y-8">
      <Hero d={d} name={firstName} />
      <GetStarted status={d.onboarding} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="plan-title" className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="plan-title" className="text-lg font-semibold tracking-tight text-foreground">Today’s plan</h2>
              <p className="text-sm text-muted-foreground">Reviews first, then your focus pattern, easiest first.</p>
            </div>
            {d.plan[0] && (
              <a href={d.plan[0].url} target="_blank" rel="noopener noreferrer" className="hidden shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
                Open next <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
          <PlanList plan={d.plan} />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Progress">
          {d.focus && <FocusCard focus={d.focus} />}
          <ReviewsCard d={d} />
          <DoneToday items={d.doneToday} />
          <RecognitionTrend />
        </aside>
      </div>

      <SkillMap d={d} />
    </div>
  );
}
