import React, { useState } from 'react';
import DifficultyBadge from './DifficultyBadge';
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

import type { Problem, ProblemStatus } from '../types/problem';

export type { Problem };

interface ProblemCardProps {
  problem: Problem;
  onEdit: (problem: Problem) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleStatus: (id: string, currentStatus: 'Solved' | 'Attempted' | 'To Do') => Promise<void>;
}

function getStatusIcon(stat: 'Solved' | 'Attempted' | 'To Do') {
  switch (stat) {
    case 'Solved':
      return <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />;
    case 'Attempted':
      return <Hourglass className="w-3.5 h-3.5 text-warning shrink-0 animate-pulse" />;
    case 'To Do':
      return <CircleDot className="w-3.5 h-3.5 text-primary shrink-0" />;
  }
}

function getStatusStyles(stat: 'Solved' | 'Attempted' | 'To Do'): string {
  switch (stat) {
    case 'Solved':
      return 'bg-success/10 text-success border border-success/15';
    case 'Attempted':
      return 'bg-warning/10 text-warning border border-warning/15';
    case 'To Do':
      return 'bg-primary/10 text-primary border border-primary/15';
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
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          <Brain className="w-2.5 h-2.5" /> AI Analyzed
        </span>
      );
    }
    if (aiStatus === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Analyzing
        </span>
      );
    }
    if (aiStatus === 'error') {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-danger/10 text-danger border border-danger/20">
          <AlertCircle className="w-2.5 h-2.5" /> Failed
        </span>
      );
    }
    if (hasCodedSubmission) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-subtle border border-border-strong">
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
      className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg hover:border-border-strong transition-all group flex flex-col h-full"
      id={`problem-card-${problem._id}`}
    >
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Top badge row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <DifficultyBadge difficulty={problem.difficulty} />
          {problem.platform && problem.platform !== 'manual' && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-full border border-border bg-surface-2 text-muted-foreground capitalize"
            >
              {problem.platform}
            </span>
          )}
          <span className="ml-auto">{renderAiStatusBadge()}</span>
        </div>

        {/* Title */}
        <h3
          className="text-sm font-bold text-foreground group-hover:text-foreground transition-colors tracking-tight line-clamp-2 cursor-pointer hover:text-primary leading-snug min-h-[2.5rem]"
          onClick={() => navigate(`/problems/${problem._id}`)}
          title="View submission history"
        >
          {problem.title}
        </h3>

        {/* Category + date */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-subtle bg-surface-2 px-2 py-0.5 border border-border rounded-full font-medium truncate max-w-[140px]">
            {problem.category || 'General'}
          </span>
          <span className="text-[10px] text-subtle flex items-center gap-1 ml-auto shrink-0">
            <Calendar className="w-3 h-3" />
            {formattedDate}
          </span>
        </div>

        {/* Complexity + submissions */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1" title="Time Complexity">
            <Clock className="w-3.5 h-3.5 text-subtle" />
            <span className="text-primary">{problem.timeComplexity || 'O(N)'}</span>
          </span>
          <span className="flex items-center gap-1" title="Space Complexity">
            <Layers className="w-3.5 h-3.5 text-subtle" />
            <span className="text-primary">{problem.spaceComplexity || 'O(N)'}</span>
          </span>
          {submissionCount > 0 && (
            <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 border border-primary/20 rounded-full ml-auto shrink-0">
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
            className="text-[11px] text-primary hover:text-primary inline-flex items-center gap-1 hover:underline w-fit"
          >
            View original problem
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* Status toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`cursor-pointer inline-flex items-center justify-center gap-2 px-3 py-1.5  text-xs font-bold rounded-lg border transition-all w-full mt-auto ${getStatusStyles(
            problem.status
          )} hover:brightness-110`}
          title="Click to cycle status"
        >
          {getStatusIcon(problem.status)}
          <span>{problem.status}</span>
        </button>
      </div>

      {/* Action row */}
      <div className="px-5 py-3 border-t border-border bg-surface-2 flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/problems/${problem._id}`); }}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-surface-2 hover:bg-surface-3 hover:text-primary border border-border rounded-lg text-muted-foreground cursor-pointer transition-colors text-[11px] font-bold"
          title="View submission history and code"
        >
          <Eye className="w-3.5 h-3.5" />
          View Code
        </button>

        {isSynced && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${problem._id}`); }}
            disabled={!hasCodedSubmission}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 border border-border rounded-lg cursor-pointer transition-colors text-[11px]  font-bold ${
              hasCodedSubmission
                ? 'bg-surface-2 hover:bg-primary/10 hover:text-primary text-muted-foreground'
                : 'bg-surface-2 text-faint cursor-not-allowed'
            }`}
            title={hasCodedSubmission ? 'AI Analysis' : 'No code captured yet — use Chrome Extension'}
          >
            <Brain className="w-3.5 h-3.5" />
            Analyze
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onEdit(problem); }}
          className="p-2 bg-surface-2 hover:bg-surface-3 hover:text-foreground border border-border rounded-lg text-muted-foreground cursor-pointer transition-colors shrink-0"
          title="Edit"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-2 bg-surface-2 hover:bg-danger/10 border border-border hover:border-danger/15 rounded-lg text-muted-foreground hover:text-danger cursor-pointer transition-colors shrink-0"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Notes expand */}
      {problem.notes && (
        <div className="border-t border-border bg-surface-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-5 py-2.5 flex items-center justify-between text-[10px] text-subtle hover:text-muted-foreground transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary/70" />
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
                <div className="px-5 pb-5 pt-1 text-xs text-muted-foreground leading-relaxed font-sans bg-surface-2 border-t border-border">
                  <p className="whitespace-pre-line border-l border-border-strong pl-3 py-1 italic">
                    {problem.notes}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {!hasCodedSubmission && isSynced && (
        <div className="px-5 py-2 border-t border-border flex items-center gap-1.5 text-[10px] text-faint">
          <Code2 className="w-3 h-3" />
          No code captured — install the Chrome Extension
        </div>
      )}
    </motion.div>
  );
};
