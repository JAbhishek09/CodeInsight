interface VerdictBadgeProps {
  verdict: string;
}

const VERDICT_STYLES: Record<string, string> = {
  Accepted:      'bg-success/10 text-success border-success/20',
  'Wrong Answer':'bg-danger/10 text-danger border-danger/20',
  TLE:           'bg-warning/10 text-warning border-warning/20',
  MLE:           'bg-warning/10 text-warning border-warning/20',
  RE:            'bg-danger/10 text-danger border-danger/20',
  CE:            'bg-surface-2 text-muted-foreground border-border-strong',
  Pending:       'bg-primary/10 text-primary border-primary/20',
};

export default function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const style = VERDICT_STYLES[verdict] || VERDICT_STYLES['Pending'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px]  font-bold ${style}`}>
      {verdict}
    </span>
  );
}
