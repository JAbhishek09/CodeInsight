import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink,
  Trash2,
  Edit3,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CircleDot,
  Hourglass,
  Calendar,
  Sparkles,
  Brain,
  Eye,
  Loader2,
  AlertCircle,
  Code2,
} from 'lucide-react';

export interface Problem {
  _id: string;
  title: string;
  url?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Div1' | 'Div2' | 'Div3' | 'unrated';
  status: 'Solved' | 'Attempted' | 'To Do';
  category: string;
  notes?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  platform?: string;
  submissions?: any[];
  tags?: string[];
  aiAnalysis?: any;
  aiAnalysisStatus?: 'idle' | 'pending' | 'ready' | 'error';
  createdAt?: string;
  updatedAt?: string;
}

interface ProblemCardProps {
  problem: Problem;
  onEdit: (problem: Problem) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleStatus: (id: string, currentStatus: 'Solved' | 'Attempted' | 'To Do') => Promise<void>;
}

// ── FIX: Full difficulty map covering LeetCode + Codeforces difficulties ──────
function getDifficultyStyles(diff: string): string {
  switch (diff) {
    case 'Easy':
      return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20';
    case 'Medium':
      return 'bg-amber-950/40 text-amber-400 border border-amber-500/20';
    case 'Hard':
      return 'bg-rose-950/40 text-rose-400 border border-rose-500/20';
    // Codeforces rating tiers
    case 'Div1':
      return 'bg-red-950/40 text-red-400 border border-red-500/20';
    case 'Div2':
      return 'bg-orange-950/40 text-orange-400 border border-orange-500/20';
    case 'Div3':
      return 'bg-yellow-950/40 text-yellow-400 border border-yellow-500/20';
    case 'Div4':
      return 'bg-lime-950/40 text-lime-400 border border-lime-500/20';
    default:
      // 'unrated' or anything unexpected — neutral grey
      return 'bg-slate-900/60 text-slate-500 border border-slate-800';
  }
}

function getStatusIcon(stat: 'Solved' | 'Attempted' | 'To Do') {
  switch (stat) {
    case 'Solved':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case 'Attempted':
      return <Hourglass className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />;
    case 'To Do':
      return <CircleDot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
  }
}

function getStatusStyles(stat: 'Solved' | 'Attempted' | 'To Do'): string {
  switch (stat) {
    case 'Solved':
      return 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/10';
    case 'Attempted':
      return 'bg-amber-950/30 text-amber-300 border border-amber-500/10';
    case 'To Do':
      return 'bg-indigo-950/30 text-indigo-300 border border-indigo-500/10';
  }
}

export const ProblemCard: React.FC<ProblemCardProps> = ({
  problem,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete "${problem.title}" from your repository?`)) {
      try {
        setDeleting(true);
        await onDelete(problem._id);
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setToggling(true);
      const nextStatusMap: Record<'Solved' | 'Attempted' | 'To Do', 'Solved' | 'Attempted' | 'To Do'> = {
        Solved: 'To Do',
        Attempted: 'Solved',
        'To Do': 'Attempted',
      };
      await onToggleStatus(problem._id, nextStatusMap[problem.status]);
    } finally {
      setToggling(false);
    }
  };

  const formattedDate = problem.createdAt
    ? new Date(problem.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown';

  const hasCodedSubmission = problem.submissions?.some((s: any) => s.code?.trim().length > 0);
  const isSynced = problem.platform === 'leetcode' || problem.platform === 'codeforces';
  const submissionCount = problem.submissions?.length || 0;
  const hasAiResult = Boolean(problem.aiAnalysis?.complexityAnalysis);
  const aiStatus = problem.aiAnalysisStatus || (hasAiResult ? 'ready' : 'idle');

  const renderAiStatusBadge = () => {
    if (!isSynced) return null;
    if (aiStatus === 'ready' || hasAiResult) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-950/40 text-indigo-400 border border-indigo-500/20">
          <Brain className="w-2.5 h-2.5" /> AI Analyzed
        </span>
      );
    }
    if (aiStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-400 border border-amber-500/20">
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Analyzing
        </span>
      );
    }
    if (aiStatus === 'error') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-950/40 text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-2.5 h-2.5" /> Failed
        </span>
      );
    }
    if (hasCodedSubmission) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 text-slate-500 border border-slate-800">
          <Brain className="w-2.5 h-2.5" /> Not Analyzed
        </span>
      );
    }
    return null;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-[#0b0e14]/90 border border-slate-900 rounded-2xl overflow-hidden shadow-lg hover:shadow-cyan-950/10 hover:border-slate-800/80 transition-all group flex flex-col h-full"
      id={`problem-card-${problem._id}`}
    >
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Top badge row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* FIX: use the full getDifficultyStyles fn that handles all difficulty values */}
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${getDifficultyStyles(problem.difficulty)}`}>
            {problem.difficulty}
          </span>
          {problem.platform && problem.platform !== 'manual' && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                problem.platform === 'leetcode'
                  ? 'bg-amber-950/30 text-amber-400 border-amber-500/20'
                  : 'bg-blue-950/30 text-blue-400 border-blue-500/20'
              }`}
            >
              {problem.platform}
            </span>
          )}
          <span className="ml-auto">{renderAiStatusBadge()}</span>
        </div>

        {/* Title */}
        <h3
          className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors tracking-tight line-clamp-2 cursor-pointer hover:text-pink-300 leading-snug min-h-[2.5rem]"
          onClick={() => navigate(`/problems/${problem._id}`)}
          title="View submission history"
        >
          {problem.title}
        </h3>

        {/* Category + date */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 border border-slate-950 rounded-full font-medium truncate max-w-[140px]">
            {problem.category || 'General'}
          </span>
          <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1 ml-auto shrink-0">
            <Calendar className="w-3 h-3" />
            {formattedDate}
          </span>
        </div>

        {/* Complexity + submissions */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 pt-1">
          <span className="flex items-center gap-1" title="Time Complexity">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-cyan-400">{problem.timeComplexity || 'O(N)'}</span>
          </span>
          <span className="flex items-center gap-1" title="Space Complexity">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-purple-400">{problem.spaceComplexity || 'O(N)'}</span>
          </span>
          {submissionCount > 0 && (
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/20 px-1.5 py-0.5 border border-indigo-500/20 rounded-full ml-auto shrink-0">
              {submissionCount} sub{submissionCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {problem.url && (
          <a
            href={problem.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-pink-400 hover:text-pink-300 inline-flex items-center gap-1 hover:underline w-fit"
          >
            View original problem
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* Status toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border transition-all w-full mt-auto ${getStatusStyles(
            problem.status
          )} hover:brightness-110`}
          title="Click to cycle status"
        >
          {getStatusIcon(problem.status)}
          <span>{problem.status}</span>
        </button>
      </div>

      {/* Action row */}
      <div className="px-5 py-3 border-t border-slate-950/80 bg-[#090b10]/40 flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/problems/${problem._id}`); }}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 hover:text-cyan-400 border border-slate-900 rounded-lg text-slate-400 cursor-pointer transition-colors text-[11px] font-mono font-bold"
          title="View submission history and code"
        >
          <Eye className="w-3.5 h-3.5" />
          View Code
        </button>

        {isSynced && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${problem._id}`); }}
            disabled={!hasCodedSubmission}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 border border-slate-900 rounded-lg cursor-pointer transition-colors text-[11px] font-mono font-bold ${
              hasCodedSubmission
                ? 'bg-slate-900 hover:bg-indigo-950/40 hover:text-indigo-400 text-slate-400'
                : 'bg-slate-900 text-slate-700 cursor-not-allowed'
            }`}
            title={hasCodedSubmission ? 'AI Analysis' : 'No code captured yet — use Chrome Extension'}
          >
            <Brain className="w-3.5 h-3.5" />
            Analyze
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onEdit(problem); }}
          className="p-2 bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-900 rounded-lg text-slate-400 cursor-pointer transition-colors shrink-0"
          title="Edit"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 bg-slate-900 hover:bg-red-950/45 border border-slate-900 hover:border-red-500/10 rounded-lg text-slate-400 hover:text-red-400 cursor-pointer transition-colors shrink-0"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Notes expand */}
      {problem.notes && (
        <div className="border-t border-slate-950/80 bg-[#090b10]/40">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-5 py-2.5 flex items-center justify-between text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-500/70" />
              <span>NOTES & INSIGHTS</span>
            </span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 pt-1 text-xs text-slate-400 leading-relaxed font-sans bg-slate-950/40 border-t border-slate-950/80">
                  <p className="whitespace-pre-line border-l border-slate-800 pl-3 py-1 italic">
                    {problem.notes}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!hasCodedSubmission && isSynced && (
        <div className="px-5 py-2 border-t border-slate-950/80 flex items-center gap-1.5 text-[10px] font-mono text-slate-600">
          <Code2 className="w-3 h-3" />
          No code captured — install the Chrome Extension
        </div>
      )}
    </motion.div>
  );
};
