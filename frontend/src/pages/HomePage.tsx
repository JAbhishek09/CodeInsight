import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Check, CheckCircle2, ExternalLink, Flame, Play, Target, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToday } from '../hooks/usePractice';
import { useWeeklyRecognition } from '../hooks/usePredictions';
import QueryError from '../components/QueryError';
import GetStarted from '../components/home/GetStarted';
import RecognitionTrend from '../components/home/RecognitionTrend';
import { MIN_POOLED, recognitionChange } from '@/lib/recognition';
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

function streakNote(st: TodayPlan['streak']) {
  if (st.current === 0) return 'solve one to start';
  if (!st.activeToday) return 'solve one today to keep it';
  return st.longest > st.current ? `best ${st.longest}` : 'your best yet';
}

/** Today's goal as a ring: primary while in progress, success once met. */
function GoalRing({ goal, size, stroke, children }: { goal: TodayPlan['goal']; size: number; stroke: number; children: React.ReactNode }) {
  return (
    <ScoreRing value={goal.target ? goal.solved / goal.target : 0} size={size} stroke={stroke} color={goal.goalMet ? 'var(--success)' : 'var(--primary)'}>
      {children}
    </ScoreRing>
  );
}

/** Phones: three compact tiles so today's plan still starts on the first screen. */
function MiniStats({ d, delta }: { d: TodayPlan; delta: number | null }) {
  const { goal, streak } = d;
  const tile = 'flex min-w-0 flex-col items-center gap-1 rounded-xl border border-border bg-background/40 px-1.5 py-2.5 text-center';
  return (
    <dl className="grid grid-cols-3 gap-2 lg:hidden">
      <div className={tile}>
        <ScoreRing value={d.recognition.accuracy} size={44} stroke={4}>
          <span className="text-[11px] font-semibold tabular-nums text-foreground">{pct(d.recognition.accuracy)}</span>
        </ScoreRing>
        <dt className="text-[11px] font-medium text-foreground">Recognition</dt>
        <dd className={cn('text-[10px] tabular-nums', delta == null ? 'text-subtle' : delta >= 0 ? 'text-success' : 'text-danger')}>
          {delta == null ? `${d.recognition.attempts} guesses` : `${delta >= 0 ? '+' : ''}${delta} pts`}
        </dd>
      </div>
      <div className={tile}>
        <GoalRing goal={goal} size={44} stroke={4}>
          {goal.goalMet
            ? <Check className="size-4 text-success" aria-hidden />
            : <span className="text-[11px] font-semibold tabular-nums text-foreground">{goal.solved}/{goal.target}</span>}
        </GoalRing>
        <dt className="text-[11px] font-medium text-foreground">Today’s goal</dt>
        <dd className="text-[10px] text-muted-foreground">{goal.goalMet ? `${goal.solved}/${goal.target} done` : `${goal.remaining} to go`}</dd>
      </div>
      <div className={tile}>
        <span className={cn('flex size-11 items-center justify-center gap-0.5 rounded-full', streak.activeToday ? 'bg-warning/15' : 'bg-surface-2')}>
          <Flame className={cn('size-4', streak.activeToday ? 'fill-warning/30 text-warning' : 'text-muted-foreground')} aria-hidden />
          <span className="text-sm font-semibold tabular-nums text-foreground">{streak.current}</span>
        </span>
        <dt className="text-[11px] font-medium text-foreground">Day streak</dt>
        <dd className="text-[10px] leading-tight text-muted-foreground">{streakNote(streak)}</dd>
      </div>
    </dl>
  );
}

/** Wide screens: the big recognition ring with trend, goal and streak beside it. */
function WideStats({ d, change }: { d: TodayPlan; change: ReturnType<typeof recognitionChange> }) {
  const { goal, streak } = d;
  const delta = change?.delta ?? null;
  return (
    <div className="hidden items-center gap-8 lg:flex">
      <ScoreRing value={d.recognition.accuracy} size={132} stroke={11}>
        <span className="text-3xl font-semibold tracking-tight text-foreground">{pct(d.recognition.accuracy)}</span>
        <span className="text-[11px] text-muted-foreground">recognition</span>
      </ScoreRing>
      <dl className="space-y-3.5 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Trend</dt>
          <dd
            className={cn('font-semibold tabular-nums', delta == null ? 'text-subtle' : delta >= 0 ? 'text-success' : 'text-danger')}
            title={change ? `First guesses: ${pct(change.from)} when you started, ${pct(change.to)} lately` : `Shows once you have ${MIN_POOLED} early and ${MIN_POOLED} recent first guesses`}
          >
            {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta} pts`}
            {change && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{pct(change.from)} → {pct(change.to)}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Today’s goal</dt>
          <dd className="flex items-center gap-2">
            <GoalRing goal={goal} size={22} stroke={3}>{null}</GoalRing>
            <span className="font-semibold tabular-nums text-foreground">{goal.solved}/{goal.target}</span>
            <span className={cn('text-xs', goal.goalMet ? 'text-success' : 'text-muted-foreground')}>
              {goal.goalMet ? 'done' : `${goal.remaining} to go`}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Streak</dt>
          <dd className="flex items-center gap-1.5">
            <Flame className={cn('size-4', streak.activeToday ? 'fill-warning/30 text-warning' : 'text-muted-foreground')} aria-hidden />
            <span className="font-semibold tabular-nums text-foreground">{plural(streak.current, 'day')}</span>
            <span className="text-xs text-muted-foreground">· {streakNote(streak)}</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Hero({ d, name }: { d: TodayPlan; name: string }) {
  const weekly = useWeeklyRecognition(8);
  const change = recognitionChange(weekly.data);
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
      <div className="relative flex flex-col gap-5 p-4 sm:gap-8 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">{date}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:mt-2 sm:text-4xl">
            {greeting()}, {name}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:text-base">
            {d.plan.length > 0 ? (
              <>
                <span className="text-foreground">{plural(d.plan.length, 'problem')}</span> on today’s plan
                {reviews > 0 && <span className="hidden sm:inline"> including {plural(reviews, 'review')}</span>} — about{' '}
                <span className="text-foreground">{minutes} min</span>
                <span className="hidden sm:inline">. Guess the pattern before you write any code.</span>
              </>
            ) : 'Nothing scheduled today. Keep your eye sharp with a quick drill.'}
          </p>
          <div className="mt-4 flex gap-2 sm:mt-6 sm:flex-wrap sm:gap-2.5">
            {next && (
              <Button size="lg" className="min-w-0 flex-1 sm:flex-none" asChild>
                <a href={next.url} target="_blank" rel="noopener noreferrer" title={`Start: ${next.title}`}>
                  <Play className="fill-current" /> <span className="min-w-0 truncate">Start: {next.title}</span>
                </a>
              </Button>
            )}
            <Button size="lg" variant="outline" className="shrink-0" asChild>
              <Link to="/drill" aria-label="2-minute drill"><Zap /> <span className="sm:hidden">Drill</span><span className="hidden sm:inline">2-minute drill</span></Link>
            </Button>
          </div>
        </div>

        <MiniStats d={d} delta={change?.delta ?? null} />
        <WideStats d={d} change={change} />
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
        <CheckCircle2 className="size-4 text-success" aria-hidden /> Key problems solved today
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
                  <span className="block text-sm font-medium leading-snug text-foreground">{p.name}</span>
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
