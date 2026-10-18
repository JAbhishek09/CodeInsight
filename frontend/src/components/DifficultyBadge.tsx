import { cn } from '@/lib/utils';
import { difficultyStyle } from '@/lib/difficulty';

/** Tinted pill for a LeetCode difficulty or Codeforces division. */
export default function DifficultyBadge({ difficulty, className }: { difficulty?: string | null; className?: string }) {
  const s = difficultyStyle(difficulty);
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', s.badge, className)}>
      {s.label}
    </span>
  );
}
