import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bug, Check, CheckCircle2, Circle, CircleDashed, EyeOff, Timer, Zap } from 'lucide-react';
import { Meter, Panel, StatTile } from '@/components/panel';
import ContrastTip from '@/components/ContrastTip';
import RecognitionTrend from '@/components/home/RecognitionTrend';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useWeeklyRecognition } from '@/hooks/usePredictions';
import { recognitionChange } from '@/lib/recognition';
import { cn } from '@/lib/utils';
import { PATTERN_ABBR, patternStyle } from '@/lib/patterns';
import type { PatternGap, PatternReport, PatternReportRow } from '@/types/pattern';

const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const UNSURE = 'unsure';

// ── Biggest gap: a state, so status colour + icon + label ─────────────────────

const GAP: Record<PatternGap, { label: string; Icon: typeof Bug; tone: string; hint: string }> = {
  recognition: { label: 'Spotting it', Icon: EyeOff, tone: 'bg-danger/15 text-danger', hint: 'You often pick another pattern. Drill its clues.' },
  speed: { label: 'Too slow', Icon: Timer, tone: 'bg-warning/15 text-warning', hint: 'Time limits: likely brute force where this pattern fits.' },
  'edge-cases': { label: 'Edge cases', Icon: Bug, tone: 'bg-warning/15 text-warning', hint: 'Right idea, wrong details: boundaries, empty input, duplicates.' },
  unfinished: { label: 'Unfinished', Icon: CircleDashed, tone: 'bg-warning/15 text-warning', hint: 'More started than solved: finish the open ones.' },
  'on-track': { label: 'On track', Icon: CheckCircle2, tone: 'bg-success/15 text-success', hint: 'Keep it fresh with reviews.' },
  'not-started': { label: 'Not started', Icon: Circle, tone: 'bg-surface-3 text-muted-foreground', hint: 'Start it from the pattern map.' },
};
const GAP_ORDER: PatternGap[] = ['recognition', 'speed', 'edge-cases', 'unfinished'];

function GapChip({ gap, className }: { gap: PatternGap; className?: string }) {
  const g = GAP[gap];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', g.tone, className)}>
      <g.Icon className="size-3.5" aria-hidden /> {g.label}
    </span>
  );
}

/** The pattern most worth fixing: worst gap type first, then the worst case of it. */
function biggestGap(rows: PatternReportRow[]) {
  const severity = (r: PatternReportRow) =>
    r.gap === 'recognition' ? 1 - (r.recognition.accuracy ?? 0)
      : r.gap === 'speed' ? r.failures.slow
      : r.gap === 'edge-cases' ? r.failures.wrongAnswer
      : r.attempted;
  for (const gap of GAP_ORDER) {
    const hit = rows.filter((r) => r.gap === gap).sort((a, b) => severity(b) - severity(a))[0];
    if (hit) return hit;
  }
  return null;
}

// ── Small pieces ──────────────────────────────────────────────────────────────

/** Identity mark for a pattern; always next to its name, never colour alone. */
function Dot({ k, className }: { k: string; className?: string }) {
  if (k === UNSURE) return <span className={cn('inline-block size-2 shrink-0 rounded-full border border-subtle', className)} aria-hidden />;
  return <span className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ ...patternStyle(k), background: 'var(--pc)' }} aria-hidden />;
}

function failuresText(f: PatternReportRow['failures']) {
  const parts = [
    f.wrongAnswer && `${f.wrongAnswer} WA`,
    f.slow && `${f.slow} TLE`,
    f.crash && `${f.crash} RE`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'None';
}

function MeterStat({ value, text, sub }: { value: number | null; text: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-24 space-y-1">
      <p className="text-sm tabular-nums text-foreground">
        {text}{sub && <span className="ml-1 text-xs text-muted-foreground">{sub}</span>}
      </p>
      <Meter value={value ?? 0} className={cn('h-1', value == null && 'opacity-40')} />
    </div>
  );
}

// ── Pattern report ────────────────────────────────────────────────────────────

function ReportTable({ rows }: { rows: PatternReportRow[] }) {
  return (
    <>
      {/* Wide screens: one row per pattern */}
      <div className="-mx-4 -mb-4 hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Pattern</TableHead>
              <TableHead>Solved</TableHead>
              <TableHead title="Your guesses of this pattern that were right">Spotted</TableHead>
              <TableHead title="Solved key problems accepted on the first submission">First try</TableHead>
              <TableHead title="Failed submissions: WA = wrong answer, TLE = time or memory limit, RE = runtime or compile error">Failed submits</TableHead>
              <TableHead className="pr-4">Biggest gap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="pl-4">
                  <Link to={`/patterns/${r.key}`} className="inline-flex items-center gap-2 font-medium text-foreground hover:underline">
                    <Dot k={r.key} /> {r.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <MeterStat value={r.total ? r.solved / r.total : 0} text={<>{r.solved}<span className="text-muted-foreground">/{r.total}</span></>} />
                </TableCell>
                <TableCell>
                  <MeterStat value={r.recognition.accuracy} text={pct(r.recognition.accuracy)}
                    sub={r.recognition.attempts ? `of ${r.recognition.attempts}` : 'no guesses'} />
                </TableCell>
                <TableCell className="tabular-nums" title={r.attemptsToAccept != null ? `On average ${r.attemptsToAccept.toFixed(1)} submissions to get accepted` : undefined}>
                  <span className="text-foreground">{pct(r.firstSubmit.rate)}</span>
                  {r.firstSubmit.solved > 0 && <span className="ml-1 text-xs text-muted-foreground">of {r.firstSubmit.solved}</span>}
                </TableCell>
                <TableCell className="text-xs tabular-nums text-muted-foreground">{failuresText(r.failures)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"><GapChip gap={r.gap} /></span>
                      </TooltipTrigger>
                      <TooltipContent>{GAP[r.gap].hint}</TooltipContent>
                    </Tooltip>
                    {r.gap === 'recognition' && (
                      <Link to={`/drill?pattern=${r.key}`} className="text-xs font-medium text-primary hover:underline">Drill</Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phones: a card per pattern */}
      <ul className="-my-1 divide-y divide-border md:hidden">
        {rows.map((r) => (
          <li key={r.key} className="space-y-2.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/patterns/${r.key}`} className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                <Dot k={r.key} /> <span>{r.name}</span>
              </Link>
              <GapChip gap={r.gap} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Solved</p>
                <MeterStat value={r.total ? r.solved / r.total : 0} text={`${r.solved}/${r.total}`} />
              </div>
              <div>
                <p className="text-muted-foreground">Spotted</p>
                <MeterStat value={r.recognition.accuracy} text={pct(r.recognition.accuracy)} />
              </div>
              <div>
                <p className="text-muted-foreground">First try</p>
                <p className="text-sm tabular-nums text-foreground">{pct(r.firstSubmit.rate)}</p>
              </div>
            </div>
            {r.gap !== 'not-started' && r.gap !== 'on-track' && <p className="text-xs text-muted-foreground">{GAP[r.gap].hint}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Mix-up grid ───────────────────────────────────────────────────────────────

type Pair = { actual: string; predicted: string };

/** One hue, more = stronger (sequential); "Not sure" gets a neutral ramp. */
const cellFill = (share: number, unsure: boolean) => unsure
  ? `color-mix(in oklab, var(--text-secondary) ${Math.round(12 + share * 45)}%, var(--surface-1))`
  : `color-mix(in oklab, var(--primary) ${Math.round(18 + share * 72)}%, var(--surface-1))`;

function MixupGrid({ report, nameOf, selected, onSelect }: {
  report: PatternReport;
  nameOf: (k: string) => string;
  selected: Pair | null;
  onSelect: (p: Pair) => void;
}) {
  const { rows, columns, counts } = report.matrix;
  return (
    <div className="space-y-3">
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[36rem] table-fixed border-separate border-spacing-[3px] text-xs">
          <colgroup>
            <col className="w-24 lg:w-48" />
            {columns.map((c) => <col key={c} />)}
            <col className="w-16" />
          </colgroup>
          <caption className="sr-only">
            Mix-up grid. Rows: the pattern a problem was. Columns: the pattern you guessed. The diagonal counts the guesses you got right.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface-1 pb-1 text-left align-bottom font-normal text-subtle">
                <span className="block leading-tight">It was ↓</span>
                <span className="block leading-tight">you said →</span>
              </th>
              {columns.map((c) => (
                <th key={c} scope="col" title={nameOf(c)} className="px-0.5 pb-1 align-bottom font-medium text-muted-foreground">
                  <span className="flex flex-col items-center gap-1 text-center text-[11px] leading-tight">
                    <Dot k={c} />
                    <span>{PATTERN_ABBR[c]}</span>
                  </span>
                </th>
              ))}
              <th scope="col" className="pb-1 pl-1 text-right align-bottom font-normal text-subtle">Guesses</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rowTotal = counts[i].reduce((a, b) => a + b, 0);
              return (
                <tr key={r}>
                  <th scope="row" className="sticky left-0 z-10 bg-surface-1 pr-2 text-left font-medium text-foreground">
                    <span className="inline-flex items-center gap-1.5 leading-tight">
                      <Dot k={r} />
                      <span className="hidden lg:inline">{nameOf(r)}</span>
                      <span className="lg:hidden">{PATTERN_ABBR[r]}</span>
                    </span>
                  </th>
                  {columns.map((c, j) => {
                    const n = counts[i][j];
                    const label = `${nameOf(r)} — you said ${nameOf(c)}: ${n} of ${rowTotal}`;
                    if (n === 0) {
                      return <td key={c} className="p-0"><div className="flex h-9 items-center justify-center rounded-md bg-surface-2/60 text-faint" aria-label={`${label}`}>·</div></td>;
                    }
                    const share = n / rowTotal;
                    const tip = `${label} (${pct(share)})`;
                    if (c === r) {
                      return (
                        <td key={c} className="p-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div tabIndex={0} aria-label={`${tip}, spotted`} className="flex h-9 items-center justify-center gap-0.5 rounded-md bg-success/15 font-semibold tabular-nums text-success outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <Check className="size-3" aria-hidden />{n}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{tip} — spotted</TooltipContent>
                          </Tooltip>
                        </td>
                      );
                    }
                    const unsure = c === UNSURE;
                    const strong = !unsure && share >= 0.4;
                    const isSel = selected?.actual === r && selected?.predicted === c;
                    const inner = <span className={cn('font-semibold tabular-nums', strong ? 'text-primary-foreground' : 'text-foreground')}>{n}</span>;
                    return (
                      <td key={c} className="p-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {unsure ? (
                              <div tabIndex={0} aria-label={tip} style={{ background: cellFill(share, true) }}
                                className="flex h-9 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">{inner}</div>
                            ) : (
                              <button type="button" aria-label={tip} aria-pressed={isSel} onClick={() => onSelect({ actual: r, predicted: c })}
                                style={{ background: cellFill(share, false) }}
                                className={cn('flex h-9 w-full items-center justify-center rounded-md outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring',
                                  isSel && 'ring-2 ring-foreground')}>{inner}</button>
                            )}
                          </TooltipTrigger>
                          <TooltipContent>{tip}{!unsure && ' — click for how to tell them apart'}</TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                  <td className="pl-1 text-right tabular-nums text-muted-foreground">{rowTotal || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="flex overflow-hidden rounded-sm" aria-hidden>
            {[0.1, 0.35, 0.65, 1].map((s) => <span key={s} className="h-3 w-3" style={{ background: cellFill(s, false) }} />)}
          </span>
          mixed up more often
        </span>
        <span className="inline-flex items-center gap-1"><span className="inline-flex size-3 items-center justify-center rounded-sm bg-success/15 text-success"><Check className="size-2.5" /></span> spotted</span>
        <span>Click a square for how to tell the two apart.</span>
      </div>
    </div>
  );
}

function PairPanel({ report, nameOf, selected, onSelect }: {
  report: PatternReport;
  nameOf: (k: string) => string;
  selected: Pair | null;
  onSelect: (p: Pair) => void;
}) {
  if (report.mixups.length === 0) {
    return (
      <Panel title="How to tell them apart">
        <p className="text-sm text-muted-foreground">
          {report.totals.recognition.attempts === 0
            ? 'Guess the pattern on a few problems and your mix-ups will show up here, with how to tell each pair apart.'
            : 'No mix-ups so far — every wrong guess you make will show up here with how to tell the two apart.'}
        </p>
        <Button size="sm" className="mt-3" asChild><Link to="/drill"><Zap /> Try a drill</Link></Button>
      </Panel>
    );
  }
  const m = report.mixups.find((x) => x.actual === selected?.actual && x.predicted === selected?.predicted) ?? report.mixups[0];
  return (
    <Panel title="How to tell them apart">
      <p className="text-sm text-foreground">
        <span className="font-medium">{nameOf(m.actual)}</span>
        <span className="text-muted-foreground"> guessed as </span>
        <span className="font-medium">{nameOf(m.predicted)}</span>
        <span className="text-muted-foreground"> · {m.count}×</span>
      </p>
      {m.tip && (
        <ContrastTip className="mt-3" actual={{ key: m.actual, name: nameOf(m.actual) }} other={{ key: m.predicted, name: nameOf(m.predicted) }} tip={m.tip} />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" asChild><Link to={`/drill?pattern=${m.actual}`}><Zap /> Drill {PATTERN_ABBR[m.actual]}</Link></Button>
        <Button size="sm" variant="outline" asChild><Link to={`/patterns/${m.actual}`}>Open the guide</Link></Button>
      </div>
      {report.mixups.length > 1 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">Your other mix-ups</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {report.mixups.slice(0, 8).map((x) => {
              const on = x.actual === m.actual && x.predicted === m.predicted;
              return (
                <button key={x.actual + x.predicted} type="button" aria-pressed={on}
                  onClick={() => onSelect({ actual: x.actual, predicted: x.predicted })}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                    on ? 'border-primary/60 bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
                  <Dot k={x.actual} />{PATTERN_ABBR[x.actual]} <span aria-hidden>→</span><span className="sr-only">guessed as</span> <Dot k={x.predicted} />{PATTERN_ABBR[x.predicted]}
                  <span className="tabular-nums text-subtle">{x.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export default function PatternsTab({ report }: { report: PatternReport }) {
  const t = report.totals;
  const weekly = useWeeklyRecognition(8);
  const change = recognitionChange(weekly.data);
  const gap = biggestGap(report.patterns);
  const [selected, setSelected] = useState<Pair | null>(null);
  const pairRef = useRef<HTMLDivElement>(null);
  const pick = (p: Pair) => {
    setSelected(p);
    requestAnimationFrame(() => pairRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };
  const names = new Map(report.patterns.map((p) => [p.key, p.name]));
  const nameOf = (k: string) => (k === UNSURE ? 'Not sure' : names.get(k) ?? k);

  if (t.solved + t.attempted + t.recognition.attempts === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
        <p className="text-sm font-semibold text-foreground">Nothing to analyse yet</p>
        <p className="max-w-md text-sm text-muted-foreground">
          This tab shows, pattern by pattern, what you solve, what you spot, and where your solutions go wrong. Import your history or guess a few patterns to fill it.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild><Link to="/profile?tab=import">Import history</Link></Button>
          <Button size="sm" asChild><Link to="/drill"><Zap /> Try a drill</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Recognition"
          value={pct(t.recognition.accuracy)}
          sub={<>
            {t.recognition.attempts} guesses
            {change && <> · <span className={change.delta >= 0 ? 'text-success' : 'text-danger'}>{change.delta >= 0 ? '+' : ''}{change.delta} pts</span> since you started</>}
          </>}
        />
        <StatTile
          label="Accepted on first submit"
          value={pct(t.firstSubmit.rate)}
          sub={t.firstSubmit.solved ? `${t.firstSubmit.accepted} of ${t.firstSubmit.solved} solved key problems` : 'No solved key problems yet'}
        />
        <StatTile
          label="Key problems solved"
          value={<>{t.solved}<span className="text-base font-normal text-muted-foreground"> / {t.keyProblems}</span></>}
          sub={`${t.attempted} started, not solved yet`}
        />
        <StatTile
          label="Biggest gap"
          value={<span className="text-lg leading-tight">{gap ? gap.name : 'None right now'}</span>}
          sub={gap ? GAP[gap.gap].hint : 'Every pattern you have started is on track.'}
        >
          {gap && <GapChip gap={gap.gap} />}
        </StatTile>
      </div>

      <Panel title="Pattern report" action={<span className="hidden text-xs text-muted-foreground sm:inline">Key problems in each pattern</span>}>
        <ReportTable rows={report.patterns} />
      </Panel>

      <Panel title="Mix-up grid" action={<span className="hidden text-xs text-muted-foreground sm:inline">Every guess you made, by what the problem really was</span>}>
        <MixupGrid report={report} nameOf={nameOf} selected={selected ?? report.mixups[0] ?? null} onSelect={pick} />
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div ref={pairRef} className="scroll-mb-24">
          <PairPanel report={report} nameOf={nameOf} selected={selected} onSelect={setSelected} />
        </div>
        <RecognitionTrend />
      </div>
    </div>
  );
}
