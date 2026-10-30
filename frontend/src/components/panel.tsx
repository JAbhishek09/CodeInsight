import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Shell ─────────────────────────────────────────────────────────────────────

export function Panel({ title, action, children, className }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0 rounded-lg border border-border bg-surface-1', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PanelLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
      {children} <ChevronRight className="size-3.5" />
    </Link>
  );
}

/** Thin progress bar. `value` is 0..1. */
export function Meter({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-surface-3', className)}>
      <div className={cn('h-full rounded-full bg-primary transition-[width] duration-500', barClassName)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Stat tiles ────────────────────────────────────────────────────────────────

export function StatTile({ label, value, sub, children }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {children && <div className="mt-auto pt-2">{children}</div>}
    </div>
  );
}

