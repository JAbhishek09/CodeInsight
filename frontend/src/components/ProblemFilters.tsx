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
}

const SELECT_BASE =
  'bg-[#05070a] border border-slate-900 text-xs font-mono text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-pink-500/50 cursor-pointer transition-all';

export default function ProblemFilters({
  search, onSearch,
  difficulty, onDifficulty,
  status, onStatus,
  platform, onPlatform,
  onClear,
}: ProblemFiltersProps) {
  const hasFilters = search || difficulty || status || platform;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search problems..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-[#05070a] border border-slate-900 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/50 transition-all"
        />
      </div>

      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />

        <select value={difficulty} onChange={(e) => onDifficulty(e.target.value)} className={SELECT_BASE}>
          <option value="">All Difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
          <option value="Div1">Div1</option>
          <option value="Div2">Div2</option>
          <option value="Div3">Div3</option>
        </select>

        <select value={status} onChange={(e) => onStatus(e.target.value)} className={SELECT_BASE}>
          <option value="">All Statuses</option>
          <option value="Solved">Solved</option>
          <option value="Attempted">Attempted</option>
          <option value="To Do">To Do</option>
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
            className="flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-white px-2 py-2 rounded-lg hover:bg-slate-900 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
