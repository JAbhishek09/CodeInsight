import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Inline error block for a failed query, with an optional retry. */
export default function QueryError({ message, onRetry, title = "Couldn't load data" }: {
  message?: string | null;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {message && <p className="mt-0.5 text-xs text-muted-foreground break-words">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Retry
        </Button>
      )}
    </div>
  );
}
