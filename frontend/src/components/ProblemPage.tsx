import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, BookOpen, Clock, Layers, Loader2 } from 'lucide-react';
import { Problem } from './ProblemCard';

export interface ProblemFormData {
  title: string;
  url?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: 'Solved' | 'Attempted' | 'To Do';
  category: string;
  notes?: string;
  timeComplexity: string;
  spaceComplexity: string;
}

interface ProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProblemFormData) => Promise<void>;
  editingProblem?: Problem | null;
}

export const ProblemModal: React.FC<ProblemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingProblem
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [status, setStatus] = useState<'Solved' | 'Attempted' | 'To Do'>('Solved');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [timeComplexity, setTimeComplexity] = useState('O(N)');
  const [spaceComplexity, setSpaceComplexity] = useState('O(N)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load editing problem parameters on mount or hook parameter modifications
  useEffect(() => {
    if (editingProblem) {
      setTitle(editingProblem.title);
      setUrl(editingProblem.url || '');
      setDifficulty(editingProblem.difficulty);
      setStatus(editingProblem.status);
      setCategory(editingProblem.category);
      setNotes(editingProblem.notes || '');
      setTimeComplexity(editingProblem.timeComplexity || 'O(N)');
      setSpaceComplexity(editingProblem.spaceComplexity || 'O(N)');
    } else {
      // Set default credentials
      setTitle('');
      setUrl('');
      setDifficulty('Medium');
      setStatus('Solved');
      setCategory('Arrays');
      setNotes('');
      setTimeComplexity('O(N)');
      setSpaceComplexity('O(N)');
    }
    setError(null);
  }, [editingProblem, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !difficulty) {
      setError('A title and difficulty are strictly required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit({
        title,
        url,
        difficulty,
        status,
        category: category || 'General',
        notes,
        timeComplexity,
        spaceComplexity
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit problem details');
    } finally {
      setLoading(false);
    }
  };

  const presetComplexities = ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)', 'O(N^2)'];
  const presetCategories = ['Arrays', 'Strings', 'Linked Lists', 'Trees', 'Graphs', 'Dynamic Programming', 'Sliding Window', 'Binary Search', 'Heaps / Stacks', 'Math'];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="modal-container">
        {/* Dark Backdrop Blur Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#04060b]/80 backdrop-blur-sm"
        />

        {/* Modal Window Sheet */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-lg bg-[#0b0e14] border border-slate-900 rounded-2xl overflow-hidden shadow-2xl z-10 p-6 sm:p-8"
          id="modal-sheet"
        >
          {/* Top Decorative borders */}
          <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />

          {/* Close Action Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 bg-slate-900 border border-slate-950 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Title Header */}
          <div className="mb-6">
            <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-pink-400" />
              <span>{editingProblem ? 'Modify Tracked Record' : 'Track Coding Problem'}</span>
            </h3>
            <p className="text-xs font-mono text-slate-500 mt-1 uppercase tracking-wider">
              {editingProblem ? `EDIT METADATA IN FILE: #${editingProblem._id}` : 'DECLARE NEW PARADIGM TRACKER'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-950/20 border border-red-500/20 rounded-xl text-red-400 text-xs font-mono">
              🛑 Error: {error}
            </div>
          )}

          {/* Form blocks */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Title Inputs */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-semibold">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product of Array Except Self"
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-700 font-sans outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/15 transition-all"
              />
            </div>

            {/* URL link parameter */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-semibold">Problem URL (LeetCode Link)</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://leetcode.com/problems/..."
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-700 font-sans outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/15 transition-all"
              />
            </div>

            {/* Difficulty + Status inputs row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-semibold">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                  className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-sans outline-none focus:border-pink-500/40 transition-all cursor-pointer"
                >
                  <option value="Easy">🟢 Easy</option>
                  <option value="Medium">🟡 Medium</option>
                  <option value="Hard">🔴 Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-semibold">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Solved' | 'Attempted' | 'To Do')}
                  className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-sans outline-none focus:border-pink-500/40 transition-all cursor-pointer"
                >
                  <option value="Solved">✅ Solved</option>
                  <option value="Attempted">⏳ Attempted</option>
                  <option value="To Do">🎯 To Do</option>
                </select>
              </div>
            </div>

            {/* Category selection */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-semibold">Category / Tag</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Arrays"
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-700 font-sans outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/15 transition-all mb-2"
              />
              <div className="flex flex-wrap gap-1">
                {presetCategories.slice(0, 5).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCategory(preset)}
                    className="px-2 py-0.5 bg-slate-900/60 hover:bg-slate-850 text-slate-500 hover:text-slate-300 text-[10px] font-mono rounded border border-slate-950 cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Complexity gauges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Time Complexity</span>
                </label>
                <input
                  type="text"
                  value={timeComplexity}
                  onChange={(e) => setTimeComplexity(e.target.value)}
                  className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-2 text-xs text-slate-250 font-mono outline-none focus:border-pink-500/40 transition-all mb-1.5"
                />
                <div className="flex gap-1 overflow-x-auto pb-1 invisible-scrollbar">
                  {presetComplexities.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTimeComplexity(preset)}
                      className={`px-1.5 py-0.5 text-[9px] font-mono rounded border cursor-pointer ${
                        timeComplexity === preset 
                          ? 'bg-cyan-950 text-cyan-400 border-cyan-800' 
                          : 'bg-slate-900 text-slate-500 border-slate-950 hover:text-slate-350'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-semibold flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Space Complexity</span>
                </label>
                <input
                  type="text"
                  value={spaceComplexity}
                  onChange={(e) => setSpaceComplexity(e.target.value)}
                  className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-2 text-xs text-slate-250 font-mono outline-none focus:border-pink-500/40 transition-all mb-1.5"
                />
                <div className="flex gap-1 overflow-x-auto pb-1 invisible-scrollbar">
                  {presetComplexities.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSpaceComplexity(preset)}
                      className={`px-1.5 py-0.5 text-[9px] font-mono rounded border cursor-pointer ${
                        spaceComplexity === preset 
                          ? 'bg-purple-950 text-purple-400 border-purple-800' 
                          : 'bg-slate-900 text-slate-500 border-slate-950 hover:text-slate-350'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes / insights field */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase font-semibold">Solution Insights & Algorithmic Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Declare precalculation vectors for left prefix multiplier arrays and right suffix multiplier blocks..."
                rows={3}
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-700 font-sans outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/15 transition-all resize-none"
              />
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-950">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-900 text-slate-400 hover:text-white hover:bg-slate-900 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-lg border border-pink-400/10 flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Commit Tracker Parameters</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
