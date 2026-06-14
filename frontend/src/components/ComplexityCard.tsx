import { TrendingUp, Zap } from 'lucide-react';

interface ComplexityCardProps {
  data: {
    current: string;
    optimal: string;
  };
}

export default function ComplexityCard({ data }: ComplexityCardProps) {
  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-950 pb-3">
        <TrendingUp className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-bold text-slate-100">Complexity Analysis</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-red-950/10 border border-red-500/15 rounded-xl p-4 space-y-1">
          <p className="text-[10px] font-mono text-red-400 uppercase tracking-wider font-semibold">Your Submission</p>
          <p className="text-sm font-bold text-slate-100 font-mono">{data.current}</p>
        </div>
        <div className="bg-emerald-950/10 border border-emerald-500/15 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" />
            <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Optimal</p>
          </div>
          <p className="text-sm font-bold text-slate-100 font-mono">{data.optimal}</p>
        </div>
      </div>
    </div>
  );
}
