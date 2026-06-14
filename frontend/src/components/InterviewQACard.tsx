import { useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';

interface InterviewQACardProps {
  question: string;
  answer: string;
  index: number;
}

export default function InterviewQACard({ question, answer, index }: InterviewQACardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-900/30 transition-colors"
      >
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-950/30 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="w-3 h-3 text-indigo-400" />
            <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">Interviewer Question</span>
          </div>
          <p className="text-xs text-slate-200 font-medium leading-relaxed">{question}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0">
          <div className="border-t border-slate-950 pt-3 pl-9">
            <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider mb-1.5">Expected Answer</p>
            <p className="text-xs text-slate-300 leading-relaxed">{answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
