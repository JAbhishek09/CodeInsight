import { TrendingUp, Zap, CheckCircle2 } from 'lucide-react';
import InlineCode from './InlineCode';

interface ComplexityCardProps {
  data?: {
    current?: string;
    optimal?: string;
    explanation?: string;
  } | null;
}

/** Normalise a complexity string so "O(n)" and "O(N)" compare equal */
function normalise(s: string) {
  return (s ?? '').toLowerCase().replace(/\s+/g, '');
}


export default function ComplexityCard({ data }: ComplexityCardProps) {
  // Guard against partial / missing analysis payloads
  if (!data) return null;
  const current = data.current || '—';
  const optimal = data.optimal || '—';

  // Dynamic colour: if current matches optimal → both boxes turn green
  const isOptimal = !!data.current && !!data.optimal && normalise(data.current) === normalise(data.optimal);

  const currentStyle = isOptimal
    ? 'bg-success/5 border-success/20'
    : 'bg-danger/5 border-danger/15';
  const currentLabel = isOptimal
    ? 'text-success'
    : 'text-danger';

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Complexity Analysis</h3>
        {isOptimal && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Already Optimal
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Current submission */}
        <div className={`border rounded-xl p-4 space-y-1 ${currentStyle}`}>
          <p className={`text-[10px]  uppercase tracking-wider font-semibold ${currentLabel}`}>
            Your Submission
          </p>
          <p className="text-sm font-bold text-foreground">{current}</p>
        </div>

        {/* Optimal */}
        <div className="bg-success/5 border border-success/15 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-success" />
            <p className="text-[10px] text-success uppercase tracking-wider font-semibold">Optimal</p>
          </div>
          <p className="text-sm font-bold text-foreground">{optimal}</p>
        </div>
      </div>

      {/* Explanation row — only rendered when Gemini returns one */}
      {data.explanation && (
        <div className="bg-surface-2 border border-border-strong rounded-xl px-4 py-3">
          <p className="text-[10px] text-subtle uppercase tracking-wider mb-1 font-semibold">Why</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <InlineCode text={data.explanation} />
          </p>
        </div>
      )}
    </div>
  );
}
