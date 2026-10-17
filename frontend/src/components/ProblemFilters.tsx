import { Search, SlidersHorizontal, X } from 'lucide-react';

interface ProblemFiltersProps {
  search: string;
  onSearch: (v: string) => void;
  difficulty: string;
  onDifficulty: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  platform: string;
  onPlatform: (v: string) => void;
  onClear: () => void;
  /** Optional — shows a live "N results" readout next to the filter row. */
  resultCount?: number;
}

const SELECT_BASE =
  'bg-surface-2 border border-border text-xs  text-muted-foreground rounded-xl px-3 py-2 focus:outline-none focus:border-primary/50 cursor-pointer transition-all';

const STATUS_PILLS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'Solved', label: 'Solved' },
  { value: 'Attempted', label: 'Attempted' },
  { value: 'To Do', label: 'To Do' },
];

export default function ProblemFilters({
  search, onSearch,
  difficulty, onDifficulty,
  status, onStatus,
  platform, onPlatform,
  onClear,
  resultCount,
}: ProblemFiltersProps) {
  const hasFilters = Boolean(search || difficulty || status || platform);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle pointer-events-none" />
        <input
          type="text"
          placeholder="Search problems by title..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:border-primary/50 transition-all"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Quick status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_PILLS.map((pill) => (
            <button
              key={pill.value || 'all'}
              onClick={() => onStatus(pill.value)}
              className={`px-3 py-1.5 rounded-lg text-[11px]  font-bold transition-colors cursor-pointer border ${
                status === pill.value
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-transparent text-subtle border-border hover:text-muted-foreground hover:border-border-strong'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Secondary selects */}
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-3.5 h-3.5 text-subtle hidden sm:block" />

          <select value={difficulty} onChange={(e) => onDifficulty(e.target.value)} className={SELECT_BASE}>
            <option value="">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
            <option value="Div1">Div1</option>
            <option value="Div2">Div2</option>
            <option value="Div3">Div3</option>
          </select>

          <select value={platform} onChange={(e) => onPlatform(e.target.value)} className={SELECT_BASE}>
            <option value="">All Platforms</option>
            <option value="manual">Manual</option>
            <option value="leetcode">LeetCode</option>
            <option value="codeforces">Codeforces</option>
          </select>

          {hasFilters && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-2 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {typeof resultCount === 'number' && (
        <p className="text-[10px] text-faint pt-1 border-t border-border">
          {resultCount} result{resultCount !== 1 ? 's' : ''} {hasFilters ? 'matching filters' : 'total'}
        </p>
      )}
    </div>
  );
}
