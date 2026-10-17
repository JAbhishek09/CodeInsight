import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: 'pink' | 'emerald' | 'amber' | 'indigo' | 'purple';
  sub?: string;
}

const ACCENT_STYLES = {
  pink:    { icon: 'bg-primary/10 border-primary/15 text-primary',    text: 'text-primary' },
  emerald: { icon: 'bg-success/10 border-success/15 text-success', text: 'text-success' },
  amber:   { icon: 'bg-warning/10 border-warning/15 text-warning', text: 'text-warning' },
  indigo:  { icon: 'bg-primary/10 border-primary/15 text-primary', text: 'text-primary' },
  purple:  { icon: 'bg-primary/10 border-primary/15 text-primary', text: 'text-primary' },
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, accent = 'pink', sub }) => {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg border ${styles.icon}`}>{icon}</div>
      </div>
      <div>
        <p className="text-3xl font-extrabold text-foreground tabular-nums">{value}</p>
        {sub && <p className={`text-[10px]  uppercase mt-1 tracking-wider ${styles.text}`}>{sub}</p>}
      </div>
    </div>
  );
};

export default StatCard;
