import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Sparkles
} from 'lucide-react';

export interface Problem {
  _id: string;
  title: string;
  url?: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: 'Solved' | 'Attempted' | 'To Do';
  category: string;
  notes?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProblemCardProps {
  problem: Problem;
  onEdit: (problem: Problem) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleStatus: (id: string, currentStatus: 'Solved' | 'Attempted' | 'To Do') => Promise<void>;
}

export const ProblemCard: React.FC<ProblemCardProps> = ({ 
  problem, 
  onEdit, 
  onDelete, 
  onToggleStatus 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const getDifficultyStyles = (diff: 'Easy' | 'Medium' | 'Hard') => {
    switch (diff) {
      case 'Easy':
        return 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20';
      case 'Medium':
        return 'bg-amber-950/40 text-amber-400 border border-amber-500/20';
      case 'Hard':
        return 'bg-rose-950/40 text-rose-400 border border-rose-500/20';
    }
  };

  const getStatusIcon = (stat: 'Solved' | 'Attempted' | 'To Do') => {
    switch (stat) {
      case 'Solved':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'Attempted':
        return <Hourglass className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />;
      case 'To Do':
        return <CircleDot className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    }
  };

  const getStatusStyles = (stat: 'Solved' | 'Attempted' | 'To Do') => {
    switch (stat) {
      case 'Solved':
        return 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/10';
      case 'Attempted':
        return 'bg-amber-950/30 text-amber-300 border border-amber-500/10';
      case 'To Do':
        return 'bg-indigo-950/30 text-indigo-300 border border-indigo-500/10';
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${problem.title}" tracker from your repository?`)) {
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
        'Solved': 'To Do',
        'Attempted': 'Solved',
        'To Do': 'Attempted'
      };
      await onToggleStatus(problem._id, nextStatusMap[problem.status]);
    } finally {
      setToggling(false);
    }
  };

  const formattedDate = problem.createdAt 
    ? new Date(problem.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Unknown Date';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-[#0b0e14]/90 border border-slate-900 rounded-xl overflow-hidden shadow-lg hover:shadow-cyan-950/5 hover:border-slate-800/80 transition-all group"
      id={`problem-card-${problem._id}`}
    >
      {/* Top Card Body */}
      <div className="p-5 flex flex-col md:flex-row justify-between items-start gap-4">
        
        {/* Difficulty, Title and Sub-details */}
        <div className="space-y-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${getDifficultyStyles(problem.difficulty)}`}>
              {problem.difficulty}
            </span>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 border border-slate-950 rounded-full font-medium">
              {problem.category || 'General'}
            </span>
            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formattedDate}</span>
            </span>
          </div>

          <h3 className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors tracking-tight truncate line-clamp-1">
            {problem.title}
          </h3>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
            {problem.url && (
              <a 
                href={problem.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs text-pink-400 hover:text-pink-300 inline-flex items-center gap-1 hover:underline shrink-0"
              >
                <span>Solve on LeetCode</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            
            <div className="flex items-center gap-2.5 text-xs text-slate-400 font-mono">
              <span className="text-[10px] text-slate-600">•</span>
              <span className="flex items-center gap-1 text-slate-400" title="Time Complexity">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-cyan-400">{problem.timeComplexity || 'O(N)'}</span>
              </span>
              <span className="text-[10px] text-slate-600">•</span>
              <span className="flex items-center gap-1 text-slate-400" title="Space Complexity">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-purple-400">{problem.spaceComplexity || 'O(N)'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons (Modify, Delete, Toggle Status) */}
        <div className="flex flex-row md:flex-col items-center justify-between md:justify-start gap-2 w-full md:w-auto shrink-0 pt-3 md:pt-0 border-t border-slate-950 md:border-transparent mt-2 md:mt-0">
          
          {/* Quick status swap pill */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 font-mono text-xs font-bold rounded-lg border transition-all ${getStatusStyles(problem.status)} hover:brightness-110`}
            title="Click to cycle status: Solved -> To Do -> Attempted"
          >
            {getStatusIcon(problem.status)}
            <span>{problem.status}</span>
          </button>

          {/* Action Row */}
          <div className="flex items-center gap-1.5 ml-auto md:ml-0">
            <button
              onClick={() => onEdit(problem)}
              className="p-2 bg-slate-900 hover:bg-slate-850 hover:text-white border border-slate-900 rounded-lg text-slate-400 cursor-pointer transition-colors"
              title="Edit parameters"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 bg-slate-900 hover:bg-red-950/45 border border-slate-900 hover:border-red-500/10 rounded-lg text-slate-400 hover:text-red-400 cursor-pointer transition-colors"
              title="Delete from repository"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Expand/Collapse Notes Trigger area */}
      {problem.notes && (
        <div className="border-t border-slate-950/80 bg-[#090b10]/40">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-5 py-2.5 flex items-center justify-between text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-500/70" />
              <span>LOGGED INSIGHTS AND SOLUTIONS DETECTED</span>
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
    </motion.div>
  );
};
