import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus, Search, Sparkles, Trash2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAnalytics } from '../hooks/useAnalytics';
import { useDeleteProblem, useProblemListView, type ProblemListItem } from '../hooks/useProblems';
import QueryError from '../components/QueryError';
import DifficultyBadge from '../components/DifficultyBadge';
import ProblemFormDialog from '@/components/problem/ProblemFormDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { relativeTime, dateTime } from '@/lib/format';

interface ProblemsPageProps {
  onNavigate: (path: string) => void;
}

const PAGE_SIZE = 50;
const DEFAULT_SORT = '-lastSubmittedAt';
const ALL = 'all';

const STATUS_DOT: Record<string, string> = {
  Solved: 'bg-success',
  Attempted: 'bg-warning',
  'To Do': 'bg-subtle',
};

// ── Small pieces ──────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, label, options }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger size="sm" aria-label={label} className={cn('min-w-32', value && 'border-primary/50 text-foreground')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: all</SelectItem>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function SortHeader({ label, field, sort, onSort, className }: {
  label: string;
  field: string;
  sort: string;
  onSort: (s: string) => void;
  className?: string;
}) {
  const active = sort.replace(/^-/, '') === field;
  const desc = sort.startsWith('-');
  // First click sorts descending for numbers/dates, ascending for text.
  const firstDir = field === 'title' || field === 'difficulty' ? '' : '-';
  const next = active ? (desc ? field : `-${field}`) : `${firstDir}${field}`;
  return (
    <TableHead className={className} aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(next)}
        className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}
      >
        {label}
        {active && (desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
      </button>
    </TableHead>
  );
}

function AiCell({ p }: { p: ProblemListItem }) {
  if (p.aiStatus === 'pending') return <span className="text-xs text-primary">Running…</span>;
  if (!p.hasAiAnalysis) return <span className="text-xs text-subtle">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" aria-label={p.aiIsStale ? 'AI review out of date' : 'AI reviewed'}>
          <Sparkles className={cn('size-4', p.aiIsStale ? 'text-warning' : 'text-primary')} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{p.aiIsStale ? 'Reviewed — code changed since' : 'AI reviewed'}</TooltipContent>
    </Tooltip>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-label="Loading problems">
      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const ProblemsPage: React.FC<ProblemsPageProps> = () => {
  const [params, setParams] = useSearchParams();
  const q          = params.get('q') ?? '';
  const status     = params.get('status') ?? '';
  const difficulty = params.get('difficulty') ?? '';
  const platform   = params.get('platform') ?? '';
  const tag        = params.get('tag') ?? '';
  const sort       = params.get('sort') ?? DEFAULT_SORT;
  const page       = Math.max(1, Number(params.get('page')) || 1);

  /** Update URL params; any filter change resets to page 1. */
  const setParam = (changes: Record<string, string>, keepPage = false) =>
    setParams((p) => {
      for (const [k, v] of Object.entries(changes)) (v ? p.set(k, v) : p.delete(k));
      if (!keepPage) p.delete('page');
      return p;
    }, { replace: true });

  // Search box is local state, pushed to the URL after 300ms of no typing.
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => { setSearchInput(q); }, [q]);
  useEffect(() => {
    if (searchInput === q) return;
    const t = setTimeout(() => setParam({ q: searchInput.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const list = useProblemListView({
    sort, page, limit: PAGE_SIZE,
    ...(q && { search: q }),
    ...(status && { status }),
    ...(difficulty && { difficulty }),
    ...(platform && { platform }),
    ...(tag && { tag }),
  });
  const summary = useAnalytics('all');
  const del = useDeleteProblem();

  const [formMode, setFormMode] = useState<{ kind: 'add' } | { kind: 'edit'; id: string } | null>(
    params.get('new') === '1' ? { kind: 'add' } : null
  );
  const [deleteTarget, setDeleteTarget] = useState<ProblemListItem | null>(null);

  // Links can open the add dialog with ?new=1
  useEffect(() => {
    if (params.get('new') === '1') {
      setFormMode({ kind: 'add' });
      setParam({ new: '' }, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = list.data?.data ?? [];
  const total = list.data?.total ?? 0;
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || status || difficulty || platform || tag);

  const topicOptions = (summary.data?.topics ?? [])
    .slice()
    .sort((a, b) => b.total - a.total)
    .map((t) => ({ value: t.tag, label: `${t.tag} (${t.total})` }));
  const hasCodeforces = (summary.data?.byPlatform?.codeforces?.total ?? 0) > 0;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget._id);
      toast.success(`Deleted “${deleteTarget.title}”`);
      setDeleteTarget(null);
    } catch (e) {
      toast.error(`Couldn't delete: ${(e as Error).message}`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Problems</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.data
              ? `${summary.data.totals.problems.toLocaleString()} tracked · ${summary.data.totals.solved.toLocaleString()} solved`
              : 'Everything you’ve tracked or imported'}
          </p>
        </div>
        <Button size="sm" onClick={() => setFormMode({ kind: 'add' })}><Plus /> Add problem</Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title"
            aria-label="Search problems"
            className="h-8 pl-8"
          />
        </div>
        <FilterSelect label="Status" value={status} onChange={(v) => setParam({ status: v })}
          options={['Solved', 'Attempted', 'To Do'].map((s) => ({ value: s, label: s }))} />
        <FilterSelect label="Difficulty" value={difficulty} onChange={(v) => setParam({ difficulty: v })}
          options={[
            ...['Easy', 'Medium', 'Hard'].map((d) => ({ value: d, label: d })),
            ...(hasCodeforces ? [['Div1', 'Div 1'], ['Div2', 'Div 2'], ['Div3', 'Div 3'], ['unrated', 'Unrated']].map(([v, l]) => ({ value: v, label: l })) : []),
          ]} />
        {topicOptions.length > 0 && (
          <FilterSelect label="Topic" value={tag} onChange={(v) => setParam({ tag: v })} options={topicOptions} />
        )}
        {hasCodeforces && (
          <FilterSelect label="Platform" value={platform} onChange={(v) => setParam({ platform: v })}
            options={[{ value: 'leetcode', label: 'LeetCode' }, { value: 'codeforces', label: 'Codeforces' }, { value: 'manual', label: 'Manual' }]} />
        )}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchInput(''); setParam({ q: '', status: '', difficulty: '', platform: '', tag: '' }); }}>
            <X /> Clear
          </Button>
        )}
      </div>

      {list.error && <QueryError title="Couldn't load problems" message={list.error.message} onRetry={() => list.refetch()} />}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
        {list.isPending ? <TableSkeleton /> : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="text-sm font-semibold text-foreground">
              {hasFilters ? 'No problems match these filters' : 'No problems yet'}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {hasFilters
                ? 'Try clearing a filter or searching for something else.'
                : 'Import your LeetCode history from your profile, or add a problem yourself.'}
            </p>
            {hasFilters
              ? <Button variant="outline" size="sm" onClick={() => { setSearchInput(''); setParam({ q: '', status: '', difficulty: '', platform: '', tag: '' }); }}>Clear filters</Button>
              : <Button variant="outline" size="sm" asChild><Link to="/profile?tab=import">Import history</Link></Button>}
          </div>
        ) : (
          <Table className={cn(list.isFetching && 'opacity-70 transition-opacity')}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortHeader label="Problem" field="title" sort={sort} onSort={(s) => setParam({ sort: s })} className="pl-4" />
                <SortHeader label="Difficulty" field="difficulty" sort={sort} onSort={(s) => setParam({ sort: s })} className="hidden sm:table-cell" />
                <TableHead>Status</TableHead>
                <SortHeader label="Submissions" field="submissionCount" sort={sort} onSort={(s) => setParam({ sort: s })} className="hidden text-right md:table-cell" />
                <SortHeader label="Last activity" field="lastSubmittedAt" sort={sort} onSort={(s) => setParam({ sort: s })} className="hidden lg:table-cell" />
                <TableHead className="hidden md:table-cell">AI</TableHead>
                <TableHead className="w-20 pr-4"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const manual = p.platform === 'manual';
                return (
                  <TableRow key={p._id} className="group">
                    <TableCell className="max-w-0 whitespace-normal pl-4 sm:w-[45%]">
                      <Link to={`/problems/${p._id}`} className="line-clamp-2 font-medium text-foreground hover:text-primary sm:line-clamp-none sm:block sm:truncate">
                        {p.title}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-subtle">
                        <DifficultyBadge difficulty={p.difficulty} className="sm:hidden" />
                        <span className="truncate">{p.tags.slice(0, 3).join(' · ')}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><DifficultyBadge difficulty={p.difficulty} /></TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className={cn('size-1.5 rounded-full', STATUS_DOT[p.status] ?? 'bg-subtle')} aria-hidden />
                        {p.status}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground md:table-cell"
                      title={`${p.acceptedCount} accepted of ${p.submissionCount}`}>
                      <span className="text-foreground">{p.acceptedCount}</span> / {p.submissionCount}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell" title={dateTime(p.lastSubmittedAt)}>
                      {relativeTime(p.lastSubmittedAt)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell"><AiCell p={p} /></TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                        {manual ? (
                          <>
                            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.title}`} onClick={() => setFormMode({ kind: 'edit', id: p._id })}><Pencil /></Button>
                            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${p.title}`} onClick={() => setDeleteTarget(p)}><Trash2 /></Button>
                          </>
                        ) : p.url ? (
                          <Button variant="ghost" size="icon-sm" asChild>
                            <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${p.title} on ${p.platform === 'codeforces' ? 'Codeforces' : 'LeetCode'}`}>
                              <ExternalLink />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span className="tabular-nums">{from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page <= 1}
                onClick={() => setParam({ page: String(page - 1) }, true)}><ChevronLeft /></Button>
              <span className="px-2 tabular-nums">Page {page} of {lastPage}</span>
              <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= lastPage}
                onClick={() => setParam({ page: String(page + 1) }, true)}><ChevronRight /></Button>
            </div>
          </div>
        )}
      </div>

      <ProblemFormDialog mode={formMode} onClose={() => setFormMode(null)} />

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this problem?</DialogTitle>
            <DialogDescription>
              “{deleteTarget?.title}” and its notes will be removed. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProblemsPage;
