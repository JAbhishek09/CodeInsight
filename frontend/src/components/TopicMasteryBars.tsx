import { TopicMastery } from '../utils/stats';

interface TopicMasteryBarsProps {
  data: TopicMastery[];
  limit?: number;
}

function colorFor(pct: number) {
  if (pct >= 70) return { bar: 'bg-success', text: 'text-success' };
  if (pct >= 40) return { bar: 'bg-warning', text: 'text-warning' };
  return { bar: 'bg-danger', text: 'text-danger' };
}

/** Per-topic solve-rate bars — reused on the Dashboard ("Topic Mastery") and
 *  the AI Insights page ("Strongest/Weakest Topics"). */
export default function TopicMasteryBars({ data, limit = 6 }: TopicMasteryBarsProps) {
  const items = data.slice(0, limit);

  if (items.length === 0) {
    return <div className="text-center py-6 text-faint text-xs">No topic data yet</div>;
  }

  return (
    <div className="space-y-3.5">
      {items.map((item) => {
        const c = colorFor(item.pct);
        return (
          <div key={item.topic} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-muted-foreground font-medium truncate">{item.topic}</span>
              <span className={` font-bold shrink-0 ${c.text}`}>
                {item.pct}%{' '}
                <span className="text-faint font-normal">
                  ({item.solved}/{item.total})
                </span>
              </span>
            </div>
            <div className="w-full h-2 bg-surface-2 border border-border rounded-full overflow-hidden">
              <div
                className={`h-full ${c.bar} rounded-full transition-all duration-500`}
                style={{ width: `${item.pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
