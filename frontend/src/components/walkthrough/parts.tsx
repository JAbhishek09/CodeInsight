import { cn } from '@/lib/utils';

/**
 * Building blocks for the walkthrough visuals. Sizes come from the CSS
 * variables --cell and --gap (set by the Player), so pointers and the window
 * band can slide between cells with a plain transform transition.
 */

export type Mark = 'none' | 'focus' | 'in' | 'dim' | 'good' | 'bad' | 'ghost';

const MARK: Record<Mark, string> = {
  none: 'border-border bg-surface-2',
  focus: 'border-[color-mix(in_oklab,var(--pc)_85%,transparent)] bg-[color-mix(in_oklab,var(--pc)_24%,transparent)] shadow-[0_0_14px_color-mix(in_oklab,var(--pc)_35%,transparent)]',
  in: 'border-[color-mix(in_oklab,var(--pc)_45%,transparent)] bg-[color-mix(in_oklab,var(--pc)_10%,transparent)]',
  dim: 'border-border bg-surface-2 opacity-30',
  good: 'border-success/70 bg-success/15',
  bad: 'border-danger/70 bg-danger/15',
  ghost: 'border-border/60 bg-transparent text-subtle',
};

/** Distance from cell 0 to cell n. */
export const at = (n: number) => `calc(${n} * (var(--cell) + var(--gap)))`;
/** Width of n cells including the gaps between them. */
export const span = (n: number) => `calc(${n} * var(--cell) + ${Math.max(0, n - 1)} * var(--gap))`;

export interface Pointer {
  at: number;
  label: string;
  /** Arrow showing which way this pointer is about to move. */
  hint?: '←' | '→';
  muted?: boolean;
}

function Pointers({ list }: { list: Pointer[] }) {
  // Pointers on the same cell stack in lanes instead of overlapping
  const lanes = list.map((p, i) => list.slice(0, i).filter((q) => q.at === p.at).length);
  const height = (Math.max(0, ...lanes) + 1) * 18 + 4;
  return (
    <div className="relative" style={{ height }} aria-hidden>
      {list.map((p, i) => (
        <div key={p.label} className="absolute left-0 flex justify-center transition-transform duration-300 ease-out"
          style={{ width: 'var(--cell)', transform: `translate(${at(p.at)}, ${lanes[i] * -18}px)`, bottom: 0 }}>
          <span className={cn('whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold leading-none',
            p.muted ? 'bg-surface-3 text-muted-foreground'
              // Tint + ring, label in the readable pattern ink (a solid fill can't suit every colour)
              : 'bg-[color-mix(in_oklab,var(--pc)_16%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklab,var(--pc)_70%,transparent)] pat-text')}>
            {p.hint === '←' && '← '}{p.label}{p.hint === '→' && ' →'}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One row of cells, with optional pointers above, a window band and index numbers. */
export function ArrayView({ values, marks, pointers, band, label, indices = true, ghosts = 0, small = false }: {
  values: (string | number | null)[];
  marks?: Mark[];
  pointers?: Pointer[];
  /** Inclusive range drawn as a frame behind the cells. */
  band?: [number, number] | null;
  label?: string;
  indices?: boolean;
  /** Empty slots after the last cell (e.g. for hi = n in a binary search). */
  ghosts?: number;
  small?: boolean;
}) {
  const total = values.length + ghosts;
  return (
    <div className="space-y-1">
      {label && <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">{label}</p>}
      <div className="relative" style={{ width: span(total) }}>
        {pointers && pointers.length > 0 && <Pointers list={pointers} />}
        <div className="relative">
          {band && band[1] >= band[0] && (
            <div aria-hidden className="absolute -inset-y-1 rounded-lg border-2 border-[color-mix(in_oklab,var(--pc)_75%,transparent)] transition-all duration-300 ease-out"
              style={{ left: `calc(${at(band[0])} - 4px)`, width: `calc(${span(band[1] - band[0] + 1)} + 8px)` }} />
          )}
          <div className="relative flex" style={{ gap: 'var(--gap)' }}>
            {values.map((v, i) => (
              <div key={i}
                className={cn('flex shrink-0 items-center justify-center rounded-md border font-semibold tabular-nums text-foreground transition-all duration-300',
                  small ? 'text-xs lg:text-sm' : 'text-sm lg:text-base', MARK[marks?.[i] ?? 'none'])}
                style={{ width: 'var(--cell)', height: small ? 'calc(var(--cell) * 0.8)' : 'var(--cell)' }}>
                {v ?? <span className="text-subtle">·</span>}
              </div>
            ))}
            {Array.from({ length: ghosts }, (_, g) => (
              <div key={`g${g}`} className={cn('shrink-0 rounded-md border', MARK.ghost)} style={{ width: 'var(--cell)', height: 'var(--cell)' }} aria-hidden />
            ))}
          </div>
        </div>
        {indices && (
          <div className="mt-1 flex" style={{ gap: 'var(--gap)' }} aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className="shrink-0 text-center text-[10px] tabular-nums text-subtle" style={{ width: 'var(--cell)' }}>{i}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** A labelled box of chips (a map, set, stack or queue). */
export function Bag({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">{label}</p>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface-1 p-1.5">{children}</div>
    </div>
  );
}

export function Chip({ children, tone = 'none' }: { children: React.ReactNode; tone?: 'none' | 'focus' | 'good' | 'bad' | 'muted' }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium tabular-nums text-foreground transition-colors duration-300',
      tone === 'none' && 'border-border bg-surface-2',
      tone === 'focus' && 'border-[color-mix(in_oklab,var(--pc)_80%,transparent)] bg-[color-mix(in_oklab,var(--pc)_20%,transparent)]',
      tone === 'good' && 'border-success/70 bg-success/15',
      tone === 'bad' && 'border-danger/70 bg-danger/15',
      tone === 'muted' && 'border-border bg-transparent text-muted-foreground')}>
      {children}
    </span>
  );
}

/** A big one-line readout under a visual, e.g. "2 + 11 = 13 > 10". */
export function Readout({ children }: { children: React.ReactNode }) {
  return <p className="text-center font-mono text-sm text-foreground sm:text-base">{children}</p>;
}
