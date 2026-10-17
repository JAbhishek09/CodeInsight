interface TopicBarChartProps {
  data: { topic: string; count: number }[];
}

export default function TopicBarChart({ data }: TopicBarChartProps) {
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 8);
  const max = Math.max(...sorted.map((d) => d.count), 1);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-6 text-faint text-xs">
        No topic data yet
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {sorted.map((item) => (
        <div key={item.topic} className="flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground w-28 truncate shrink-0">
            {item.topic}
          </span>
          <div className="flex-1 bg-surface-2 rounded-full h-2 overflow-hidden border border-border">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}
