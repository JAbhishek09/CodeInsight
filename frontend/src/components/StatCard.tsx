import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: 'pink' | 'emerald' | 'amber' | 'indigo' | 'purple';
  sub?: string;
}

const ACCENT_STYLES = {
  pink:    { icon: 'bg-pink-950/30 border-pink-500/15 text-pink-400',    text: 'text-pink-400' },
  emerald: { icon: 'bg-emerald-950/30 border-emerald-500/15 text-emerald-400', text: 'text-emerald-400' },
  amber:   { icon: 'bg-amber-950/30 border-amber-500/15 text-amber-400', text: 'text-amber-400' },
  indigo:  { icon: 'bg-indigo-950/30 border-indigo-500/15 text-indigo-400', text: 'text-indigo-400' },
  purple:  { icon: 'bg-purple-950/30 border-purple-500/15 text-purple-400', text: 'text-purple-400' },
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, accent = 'pink', sub }) => {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className="bg-[#0b0e14]/90 border border-slate-900 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg border ${styles.icon}`}>{icon}</div>
      </div>
      <div>
        <p className="text-3xl font-extrabold text-white font-mono">{value}</p>
        {sub && <p className={`text-[10px] font-mono uppercase mt-1 tracking-wider ${styles.text}`}>{sub}</p>}
      </div>
    </div>
  );
};

export default StatCard;
