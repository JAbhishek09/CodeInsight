import { TopicMastery } from '../utils/stats';

interface TopicMasteryBarsProps {
  data: TopicMastery[];
  limit?: number;
}

function colorFor(pct: number) {
  if (pct >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-400' };
  if (pct >= 40) return { bar: 'bg-amber-500', text: 'text-amber-400' };
  return { bar: 'bg-rose-500', text: 'text-rose-400' };
}

/** Per-topic solve-rate bars — reused on the Dashboard ("Topic Mastery") and
 *  the AI Insights page ("Strongest/Weakest Topics"). */
export default function TopicMasteryBars({ data, limit = 6 }: TopicMasteryBarsProps) {
  const items = data.slice(0, limit);

  if (items.length === 0) {
    return <div className="text-center py-6 text-slate-600 text-xs font-mono">No topic data yet</div>;
  }

  return (
    <div className="space-y-3.5">
      {items.map((item) => {
        const c = colorFor(item.pct);
        return (
          <div key={item.topic} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="text-slate-300 font-medium truncate">{item.topic}</span>
              <span className={`font-mono font-bold shrink-0 ${c.text}`}>
                {item.pct}%{' '}
                <span className="text-slate-600 font-normal">
                  ({item.solved}/{item.total})
                </span>
              </span>
            </div>
            <div className="w-full h-2 bg-slate-950 border border-slate-900 rounded-full overflow-hidden">
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
