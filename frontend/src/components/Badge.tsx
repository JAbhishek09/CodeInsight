import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
}

const VARIANT_STYLES = {
  default: 'bg-slate-950/60 text-slate-400 border-slate-800',
  success: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-950/40 text-amber-400 border-amber-500/20',
  danger:  'bg-rose-950/40 text-rose-400 border-rose-500/20',
  info:    'bg-blue-950/40 text-blue-400 border-blue-500/20',
  purple:  'bg-purple-950/40 text-purple-400 border-purple-500/20',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${VARIANT_STYLES[variant]}`}>
    {children}
  </span>
);

export default Badge;
