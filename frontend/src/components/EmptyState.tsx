import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

/** Reusable empty-state block — used by Problems, AI Insights, and Analytics
 *  whenever there isn't enough data yet to render a meaningful view. */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-6 border border-dashed border-border rounded-2xl space-y-3">
      <div className="w-12 h-12 mx-auto rounded-xl bg-surface-2 border border-border flex items-center justify-center text-faint">
        {icon}
      </div>
      <p className="text-sm font-bold text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-subtle max-w-sm mx-auto leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary font-bold cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
