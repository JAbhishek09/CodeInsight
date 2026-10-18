import { useState } from 'react';
import { Brain, Download, Eye, EyeOff, Sparkles, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Deterministic pseudo-random heat levels for the decorative heatmap. */
const HEAT = Array.from({ length: 7 * 18 }, (_, i) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  const r = x - Math.floor(x);
  return r < 0.35 ? 0 : r < 0.6 ? 1 : r < 0.8 ? 2 : r < 0.93 ? 3 : 4;
});

const POINTS = [
  { Icon: Download, title: 'Your whole LeetCode history', text: 'Import every solved problem and the code you wrote, in a few minutes.' },
  { Icon: Sparkles, title: 'An AI review of each solution', text: 'Complexity against the optimal, concrete fixes, edge cases and follow-up questions.' },
  { Icon: Target, title: 'Know what to practise next', text: 'Topics you avoid, mistakes you repeat, and a daily goal that keeps you honest.' },
];

function ProductPanel() {
  return (
    <div className="relative hidden flex-col justify-center border-l border-border bg-surface-1 px-12 py-16 lg:flex">
      <div className="mx-auto w-full max-w-md space-y-10">
        <div className="rounded-lg border border-border bg-background p-4" aria-hidden>
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Problems solved</span>
            <span className="text-xs text-subtle">last 18 weeks</span>
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
            {HEAT.map((l, i) => (
              <span key={i} className="size-3 rounded-[3px]" style={{ background: `var(--heat-${l})` }} />
            ))}
          </div>
        </div>

        <ul className="space-y-6">
          {POINTS.map(({ Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Icon className="size-4 text-primary" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Split layout for sign-in, sign-up and password screens. */
export default function AuthLayout({ title, subtitle, children, footer }: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen w-full bg-background text-foreground lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Brain className="size-5 text-primary" aria-hidden /> CodeInsight
        </div>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">{footer}</div>}
          </div>
        </main>
      </div>
      <ProductPanel />
    </div>
  );
}

// ── Form pieces shared by the auth screens ────────────────────────────────────

export function Field({ id, label, hint, children, aside }: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">{label}</label>
        {aside}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PasswordInput({ id, value, onChange, autoComplete, invalid }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        aria-invalid={invalid || undefined}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn('rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger')}>
      {message}
    </p>
  );
}
