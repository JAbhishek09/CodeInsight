import { TrendingUp, Zap, CheckCircle2 } from 'lucide-react';

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

/** Render text that may contain `backtick` spans as inline <code> elements */
function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code
            key={i}
            className="px-1 py-0.5 rounded bg-slate-800 text-pink-300 font-mono text-[11px]"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function ComplexityCard({ data }: ComplexityCardProps) {
  // Guard against partial / missing analysis payloads
  if (!data) return null;
  const current = data.current || '—';
  const optimal = data.optimal || '—';

  // Dynamic colour: if current matches optimal → both boxes turn green
  const isOptimal = !!data.current && !!data.optimal && normalise(data.current) === normalise(data.optimal);

  const currentStyle = isOptimal
    ? 'bg-emerald-950/10 border-emerald-500/20'
    : 'bg-red-950/10 border-red-500/15';
  const currentLabel = isOptimal
    ? 'text-emerald-400'
    : 'text-red-400';

  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-950 pb-3">
        <TrendingUp className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-bold text-slate-100">Complexity Analysis</h3>
        {isOptimal && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Already Optimal
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Current submission */}
        <div className={`border rounded-xl p-4 space-y-1 ${currentStyle}`}>
          <p className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${currentLabel}`}>
            Your Submission
          </p>
          <p className="text-sm font-bold text-slate-100 font-mono">{current}</p>
        </div>

        {/* Optimal */}
        <div className="bg-emerald-950/10 border border-emerald-500/15 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" />
            <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Optimal</p>
          </div>
          <p className="text-sm font-bold text-slate-100 font-mono">{optimal}</p>
        </div>
      </div>

      {/* Explanation row — only rendered when Gemini returns one */}
      {data.explanation && (
        <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl px-4 py-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1 font-semibold">Why</p>
          <p className="text-xs text-slate-300 leading-relaxed">
            <InlineCode text={data.explanation} />
          </p>
        </div>
      )}
    </div>
  );
}
