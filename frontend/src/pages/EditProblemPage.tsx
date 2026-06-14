import { useState } from 'react';
import { updateProblem } from '../api/problems.api';
import { Problem } from '../components/ProblemCard';
import { Loader2, Save } from 'lucide-react';

interface EditProblemFormProps {
  problem: Problem;
  onSuccess: () => void;
  onCancel: () => void;
}

const FIELD_BASE =
  'w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/60 font-mono transition-all';

export default function EditProblemForm({ problem, onSuccess, onCancel }: EditProblemFormProps) {
  const [form, setForm] = useState({
    title:           problem.title,
    url:             problem.url || '',
    difficulty:      problem.difficulty,
    status:          problem.status,
    category:        problem.category,
    notes:           problem.notes || '',
    timeComplexity:  problem.timeComplexity || 'O(N)',
    spaceComplexity: problem.spaceComplexity || 'O(N)',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setError(null);
    setLoading(true);
    try {
      await updateProblem(problem._id, form as any);
      onSuccess();
    } catch (e: any) {
      // axiosInstance interceptor re-throws as plain Error; use e.message directly
      setError(e.message || 'Failed to update problem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3 text-xs font-mono text-red-400">
          ✗ {error}
        </div>
      )}

      <div>
        <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Title *</label>
        <input value={form.title} onChange={(e) => set('title', e.target.value)} className={FIELD_BASE} required />
      </div>

      <div>
        <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Problem URL</label>
        <input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://..." className={FIELD_BASE} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Difficulty</label>
          <select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value)} className={FIELD_BASE}>
            <option>Easy</option>
            <option>Medium</option>
            <option>Hard</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} className={FIELD_BASE}>
            <option>Solved</option>
            <option>Attempted</option>
            <option>To Do</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Category / Topic</label>
        <input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Arrays" className={FIELD_BASE} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Time Complexity</label>
          <input value={form.timeComplexity} onChange={(e) => set('timeComplexity', e.target.value)} className={FIELD_BASE} />
        </div>
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Space Complexity</label>
          <input value={form.spaceComplexity} onChange={(e) => set('spaceComplexity', e.target.value)} className={FIELD_BASE} />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">Notes / Insights</label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={3}
          className={`${FIELD_BASE} resize-none`}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-mono font-bold rounded-xl transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 disabled:opacity-40 text-white text-xs font-bold rounded-xl py-2.5 transition-all"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
