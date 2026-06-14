interface VerdictBadgeProps {
  verdict: string;
}

const VERDICT_STYLES: Record<string, string> = {
  Accepted:      'bg-emerald-950/40 text-emerald-400 border-emerald-500/20',
  'Wrong Answer':'bg-red-950/40 text-red-400 border-red-500/20',
  TLE:           'bg-amber-950/40 text-amber-400 border-amber-500/20',
  MLE:           'bg-orange-950/40 text-orange-400 border-orange-500/20',
  RE:            'bg-rose-950/40 text-rose-400 border-rose-500/20',
  CE:            'bg-slate-950/40 text-slate-400 border-slate-500/20',
  Pending:       'bg-indigo-950/40 text-indigo-400 border-indigo-500/20',
};

export default function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const style = VERDICT_STYLES[verdict] || VERDICT_STYLES['Pending'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${style}`}>
      {verdict}
    </span>
  );
}
