import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CalendarClock, CheckCircle2, GraduationCap, Lightbulb, ListChecks, Loader2, Network, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InlineCode from '@/components/InlineCode';
import { useAskTutor, useTutor } from '@/hooks/useTutor';
import { cn } from '@/lib/utils';
import { relativeTime, shortDate } from '@/lib/format';
import { patternStyle } from '@/lib/patterns';
import type { Diagnosis, DiagnosisSignal, TutorAnswer } from '@/types/pattern';

const SIGNAL_STYLE: Record<DiagnosisSignal['severity'], { Icon: typeof XCircle; className: string }> = {
  high: { Icon: XCircle, className: 'text-danger' },
  medium: { Icon: AlertTriangle, className: 'text-warning' },
  good: { Icon: CheckCircle2, className: 'text-success' },
};

const DIAGNOSIS_LABEL: Record<TutorAnswer['answer']['diagnosis'], { label: string; className: string }> = {
  'wrong-pattern': { label: 'Wrong pattern', className: 'bg-danger/10 text-danger border-danger/30' },
  'right-pattern-too-slow': { label: 'Right idea, too slow', className: 'bg-warning/10 text-warning border-warning/30' },
  'implementation-bug': { label: 'Implementation bug', className: 'bg-warning/10 text-warning border-warning/30' },
  'edge-case': { label: 'Missed edge case', className: 'bg-warning/10 text-warning border-warning/30' },
  other: { label: 'Something else', className: 'bg-surface-2 text-muted-foreground border-border' },
};

function TutorAnswerCard({ t }: { t: TutorAnswer }) {
  const d = DIAGNOSIS_LABEL[t.answer.diagnosis] ?? DIAGNOSIS_LABEL.other;
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={cn('rounded-full border px-2 py-0.5 font-medium', d.className)}>{d.label}</span>
        {t.verdict && <span className="text-muted-foreground">{t.verdict}</span>}
        <span className="text-subtle">· {relativeTime(t.createdAt)}</span>
      </div>
      <p className="text-sm leading-relaxed text-foreground"><InlineCode text={t.answer.summary} /></p>
      <div className="flex gap-2.5 rounded-md bg-primary/10 px-3 py-2.5">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-sm leading-relaxed text-foreground"><InlineCode text={t.answer.nudge} /></p>
      </div>
      {t.answer.checks.length > 0 && (
        <ul className="space-y-1.5">
          {t.answer.checks.map((c) => (
            <li key={c} className="flex gap-2 text-sm text-muted-foreground">
              <ListChecks className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /><span><InlineCode text={c} /></span>
            </li>
          ))}
        </ul>
      )}
      {t.answer.patternTip && (
        <p className="flex gap-2 border-t border-border pt-3 text-sm text-muted-foreground" style={t.pattern ? patternStyle(t.pattern.key) : undefined}>
          <Network className="mt-0.5 size-4 shrink-0 pat-text" aria-hidden />
          <span><InlineCode text={t.answer.patternTip} /></span>
        </p>
      )}
    </div>
  );
}

/**
 * "What went wrong" for a problem: rule-based signals and checklist, plus the
 * AI tutor for a specific failed attempt (counts toward the daily AI limit).
 */
export default function DiagnosisPanel({ problemId, diagnosis }: { problemId: string; diagnosis: Diagnosis }) {
  const hasFailures = diagnosis.signals.some((s) => s.severity !== 'good');
  const tutor = useTutor(problemId, hasFailures);
  const ask = useAskTutor(problemId);
  const failed = tutor.data?.failed ?? [];
  const [selected, setSelected] = useState<string>('');
  useEffect(() => { if (!selected && failed[0]) setSelected(failed[0].submissionId); }, [failed, selected]);

  if (!hasFailures) {
    const good = diagnosis.signals.filter((s) => s.severity === 'good');
    if (good.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-success">
        {good.map((s) => <span key={s.type} className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4" /> {s.title}</span>)}
      </div>
    );
  }

  const answerFor = tutor.data?.answers.find((a) => a.submissionId === selected);
  const quota = tutor.data?.quota;
  const outOfQuota = quota ? quota.remaining <= 0 : false;

  return (
    <section aria-labelledby="diagnosis-title" className="space-y-4 rounded-lg border border-border bg-surface-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="diagnosis-title" className="text-sm font-semibold text-foreground">What went wrong</h2>
        {diagnosis.pattern && (
          <Link to={`/patterns/${diagnosis.pattern.key}`} style={patternStyle(diagnosis.pattern.key)} className="text-xs font-medium pat-text hover:underline">
            {diagnosis.pattern.name} guide
          </Link>
        )}
      </div>

      <ul className="space-y-3">
        {diagnosis.signals.map((s) => {
          const st = SIGNAL_STYLE[s.severity];
          return (
            <li key={s.type} className="flex gap-3">
              <st.Icon className={cn('mt-0.5 size-4 shrink-0', st.className)} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {diagnosis.reviewOn && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock className="size-4" /> Re-solve from scratch around {shortDate(diagnosis.reviewOn)}
        </p>
      )}

      {diagnosis.checklist.length > 0 && (
        <div className="rounded-md bg-surface-2 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Check these</p>
          <ul className="space-y-1.5">
            {diagnosis.checklist.map((c) => (
              <li key={c} className="flex gap-2 text-sm text-foreground">
                <ListChecks className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /><span><InlineCode text={c} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {failed.length > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <GraduationCap className="size-4 text-primary" aria-hidden />
            <span className="text-sm font-medium text-foreground">Ask the tutor</span>
            {failed.length > 1 && (
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger size="sm" className="min-w-44" aria-label="Which attempt"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {failed.map((f) => (
                    <SelectItem key={f.submissionId} value={f.submissionId}>{f.verdict} · {relativeTime(f.submittedAt)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!answerFor && (
              <Button size="sm" onClick={() => ask.mutate(selected || undefined)} disabled={ask.isPending || outOfQuota} className="ml-auto">
                {ask.isPending && <Loader2 className="animate-spin" />}
                {ask.isPending ? 'Thinking…' : 'Why did this fail?'}
              </Button>
            )}
          </div>
          {quota && !answerFor && (
            <p className="text-xs text-muted-foreground">
              {outOfQuota
                ? `You’ve used today’s ${quota.limit} AI requests — they reset at midnight UTC.`
                : `Gives a nudge, not the answer. ${quota.remaining} of ${quota.limit} AI requests left today.`}
            </p>
          )}
          {ask.error && <p role="alert" className="text-sm text-danger">{ask.error.message}</p>}
          {answerFor && <TutorAnswerCard t={answerFor} />}
        </div>
      )}
    </section>
  );
}
