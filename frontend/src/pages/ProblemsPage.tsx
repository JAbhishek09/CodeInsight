import React, { useState } from 'react';
import { Plus, BookOpen, Loader2, FolderSearch } from 'lucide-react';
import { useProblems } from '../hooks/useProblems';
import { ProblemCard, Problem } from '../components/ProblemCard';
import ProblemFilters from '../components/ProblemFilters';
import EmptyState from '../components/EmptyState';
import { Modal } from '../components/Modal';
import AddProblemForm from './AddProblemPage';
import EditProblemForm from './EditProblemPage';

interface ProblemsPageProps {
  onNavigate: (path: string) => void;
}

export const ProblemsPage: React.FC<ProblemsPageProps> = ({ onNavigate }) => {
  const [search, setSearch]         = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [status, setStatus]         = useState('');
  const [platform, setPlatform]     = useState('');

  const { problems, loading, error, refetch, removeProblem, toggleStatus } = useProblems({
    search, difficulty, status, platform,
  });

  const [showAdd, setShowAdd]       = useState(false);
  const [editTarget, setEditTarget] = useState<Problem | null>(null);

  const hasActiveFilters = Boolean(search || difficulty || status || platform);

  const clearFilters = () => {
    setSearch(''); setDifficulty(''); setStatus(''); setPlatform('');
  };

  return (
    <div className="space-y-6">
      {/* Compact header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-pink-950/30 border border-pink-500/20 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Problem Repository</h1>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
              {problems.length} problem{problems.length !== 1 ? 's' : ''} tracked
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 text-white text-xs font-bold rounded-xl px-4 py-2.5 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Problem
        </button>
      </div>

      {/* Filters */}
      <ProblemFilters
        search={search}         onSearch={setSearch}
        difficulty={difficulty} onDifficulty={setDifficulty}
        status={status}         onStatus={setStatus}
        platform={platform}     onPlatform={setPlatform}
        onClear={clearFilters}
        resultCount={problems.length}
      />

      {error && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 text-xs font-mono text-red-400">✗ {error}</div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      ) : problems.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            icon={<FolderSearch className="w-6 h-6" />}
            title="No problems match your filters"
            description="Try clearing a filter or searching for something else."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        ) : (
          <EmptyState
            icon={<BookOpen className="w-6 h-6" />}
            title="Your problem repository is empty"
            description="Track a problem manually, or sync your LeetCode / Codeforces history from the Profile page to import your solve history automatically."
            action={{ label: 'Add your first problem', onClick: () => setShowAdd(true) }}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {problems.map((problem) => (
            <ProblemCard
              key={problem._id}
              problem={problem}
              onEdit={(p) => setEditTarget(p)}
              onDelete={removeProblem}
              onToggleStatus={toggleStatus}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Track New Problem">
        <AddProblemForm onSuccess={() => { setShowAdd(false); refetch(); }} onCancel={() => setShowAdd(false)} />
      </Modal>

      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Problem">
        {editTarget && (
          <EditProblemForm
            problem={editTarget}
            onSuccess={() => { setEditTarget(null); refetch(); }}
            onCancel={() => setEditTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
};

export default ProblemsPage;
