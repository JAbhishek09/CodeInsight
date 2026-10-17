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
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-surface-2 transition-colors"
      >
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare className="w-3 h-3 text-primary" />
            <span className="text-[10px] text-primary uppercase tracking-wider">Interviewer Question</span>
          </div>
          <p className="text-xs text-foreground font-medium leading-relaxed">{question}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-subtle flex-shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0">
          <div className="border-t border-border pt-3 pl-9">
            <p className="text-[10px] text-success uppercase tracking-wider mb-1.5">Expected Answer</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
