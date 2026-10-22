import { Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { patternStyle } from '@/lib/patterns';

const Dot = ({ k }: { k: string }) => (
  <span style={patternStyle(k)} className="inline-block size-2 shrink-0 rounded-full align-middle" aria-hidden>
    <span className="block size-full rounded-full" style={{ background: 'var(--pc)' }} />
  </span>
);

/**
 * "How to tell A from B" — the decision test between the pattern it was
 * (`actual`) and the one the student picked (`other`).
 */
export default function ContrastTip({
  actual, other, tip, className, compact = false,
}: {
  actual: { key: string; name: string };
  other: { key: string; name: string };
  tip: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('rounded-lg border border-border bg-background/50', compact ? 'px-3 py-2' : 'p-3', className)}>
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium text-muted-foreground">
        <Scale className="size-3.5" aria-hidden />
        How to tell
        <span className="inline-flex items-center gap-1 text-foreground"><Dot k={actual.key} />{actual.name}</span>
        from
        <span className="inline-flex items-center gap-1 text-foreground"><Dot k={other.key} />{other.name}</span>
      </p>
      <p className={cn('mt-1 leading-relaxed text-foreground/90', compact ? 'text-xs' : 'text-sm')}>{tip}</p>
    </div>
  );
}
