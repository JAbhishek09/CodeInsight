import { AlertTriangle } from 'lucide-react';

interface OptimizationListProps {
  items: string[];
}

export default function OptimizationList({ items }: OptimizationListProps) {
  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-950 pb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-bold text-slate-100">Optimization Areas</h3>
      </div>
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-950/30 border border-amber-500/20 text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <p className="text-xs text-slate-300 leading-relaxed pt-0.5">{item}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
