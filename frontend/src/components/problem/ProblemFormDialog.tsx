import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateProblem, useProblem, useUpdateProblem } from '@/hooks/useProblems';
import type { ProblemPayload } from '@/api/problems.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QueryError from '@/components/QueryError';
import type { Problem } from '@/types/problem';

type Mode = { kind: 'add' } | { kind: 'edit'; id: string };

interface FormState {
  title: string;
  url: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: 'Solved' | 'Attempted' | 'To Do';
  category: string;
  timeComplexity: string;
  spaceComplexity: string;
  notes: string;
}

const EMPTY: FormState = {
  title: '', url: '', difficulty: 'Medium', status: 'Solved', category: '', timeComplexity: '', spaceComplexity: '', notes: '',
};

function fromProblem(p: Problem): FormState {
  return {
    title: p.title ?? '',
    url: p.url ?? '',
    difficulty: (['Easy', 'Medium', 'Hard'] as const).includes(p.difficulty as never) ? (p.difficulty as FormState['difficulty']) : 'Medium',
    status: p.status ?? 'Solved',
    category: p.category === 'General' ? '' : p.category ?? '',
    timeComplexity: p.timeComplexity ?? '',
    spaceComplexity: p.spaceComplexity ?? '',
    notes: p.notes ?? '',
  };
}

function toPayload(f: FormState, editing = false): ProblemPayload {
  // Adding: empty optional fields are left out. Editing: an emptied field is
  // sent as '' so clearing it actually clears it.
  const opt = (v: string) => (v.trim() ? v.trim() : editing ? '' : undefined);
  return {
    title: f.title.trim(),
    url: opt(f.url),
    difficulty: f.difficulty,
    status: f.status,
    category: opt(f.category),
    timeComplexity: opt(f.timeComplexity),
    spaceComplexity: opt(f.spaceComplexity),
    notes: opt(f.notes),
  };
}

function isValidUrl(v: string) {
  if (!v.trim()) return true;
  try { const u = new URL(v.trim()); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; }
}

function ProblemForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: FormState;
  submitLabel: string;
  onSubmit: (f: FormState) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const titleMissing = !form.title.trim();
  const urlBad = !isValidUrl(form.url);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (titleMissing || urlBad) return;
    setError(null);
    try {
      setSaving(true);
      await onSubmit(form);
    } catch (err) {
      setError((err as Error).message || "Couldn't save the problem.");
    } finally {
      setSaving(false);
    }
  };

  const label = 'text-sm font-medium text-foreground';
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">{error}</p>}

      <div className="space-y-1.5">
        <label htmlFor="pf-title" className={label}>Title</label>
        <Input id="pf-title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Two Sum"
          maxLength={150} aria-invalid={(touched && titleMissing) || undefined} autoFocus />
        {touched && titleMissing && <p className="text-xs text-warning">Enter a title</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pf-url" className={label}>Link <span className="font-normal text-muted-foreground">(optional)</span></label>
        <Input id="pf-url" type="url" value={form.url} onChange={(e) => set('url', e.target.value)}
          placeholder="https://leetcode.com/problems/two-sum/" aria-invalid={(touched && urlBad) || undefined} />
        {touched && urlBad && <p className="text-xs text-warning">Enter a full link starting with https://</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <span id="pf-difficulty" className={label}>Difficulty</span>
          <Select value={form.difficulty} onValueChange={(v) => set('difficulty', v as FormState['difficulty'])}>
            <SelectTrigger aria-labelledby="pf-difficulty" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{['Easy', 'Medium', 'Hard'].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <span id="pf-status" className={label}>Status</span>
          <Select value={form.status} onValueChange={(v) => set('status', v as FormState['status'])}>
            <SelectTrigger aria-labelledby="pf-status" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{['Solved', 'Attempted', 'To Do'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pf-topic" className={label}>Topic <span className="font-normal text-muted-foreground">(optional)</span></label>
        <Input id="pf-topic" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Dynamic programming" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="pf-time" className={label}>Time</label>
          <Input id="pf-time" value={form.timeComplexity} onChange={(e) => set('timeComplexity', e.target.value)} placeholder="O(n)" className="font-mono" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="pf-space" className={label}>Space</label>
          <Input id="pf-space" value={form.spaceComplexity} onChange={(e) => set('spaceComplexity', e.target.value)} placeholder="O(1)" className="font-mono" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pf-notes" className={label}>Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
        <textarea
          id="pf-notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          placeholder="Key insight, mistakes to avoid…"
          className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving && <Loader2 className="animate-spin" />}{submitLabel}</Button>
      </DialogFooter>
    </form>
  );
}

function EditBody({ id, onDone }: { id: string; onDone: () => void }) {
  const q = useProblem(id);
  const update = useUpdateProblem();
  if (q.isPending) return <Skeleton className="h-96" />;
  if (q.error || !q.data) return <QueryError message={q.error?.message ?? 'Problem not found'} onRetry={() => q.refetch()} />;
  return (
    <ProblemForm
      initial={fromProblem(q.data)}
      submitLabel="Save changes"
      onCancel={onDone}
      onSubmit={async (f) => {
        await update.mutateAsync({ id, data: toPayload(f, true) });
        toast.success('Problem updated');
        onDone();
      }}
    />
  );
}

/** Add a manual problem, or edit one (loads the full problem first). */
export default function ProblemFormDialog({ mode, onClose }: { mode: Mode | null; onClose: () => void }) {
  const create = useCreateProblem();
  // Remount the form each time the dialog opens so it starts clean.
  const [openCount, setOpenCount] = useState(0);
  useEffect(() => { if (mode) setOpenCount((n) => n + 1); }, [mode]);

  return (
    <Dialog open={!!mode} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode?.kind === 'edit' ? 'Edit problem' : 'Track a problem'}</DialogTitle>
          <DialogDescription>
            {mode?.kind === 'edit' ? 'Update the details you track for this problem.' : 'For problems outside LeetCode — imported ones are added automatically.'}
          </DialogDescription>
        </DialogHeader>
        {mode?.kind === 'edit' ? (
          <EditBody key={`${mode.id}-${openCount}`} id={mode.id} onDone={onClose} />
        ) : mode ? (
          <ProblemForm
            key={openCount}
            initial={EMPTY}
            submitLabel="Add problem"
            onCancel={onClose}
            onSubmit={async (f) => {
              await create.mutateAsync(toPayload(f));
              toast.success('Problem added');
              onClose();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
