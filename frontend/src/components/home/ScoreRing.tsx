import { cn } from '@/lib/utils';

/** Circular progress for a 0–1 value; `null` draws an empty track. */
export default function ScoreRing({
  value, size = 120, stroke = 10, color = 'var(--primary)', className, children,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {value != null && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
            style={{ filter: `drop-shadow(0 0 6px color-mix(in oklab, ${color} 45%, transparent))` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
