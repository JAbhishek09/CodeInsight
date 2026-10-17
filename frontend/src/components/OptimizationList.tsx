import { AlertTriangle, Lightbulb } from 'lucide-react';
import InlineCode from './InlineCode';

// Each item is either the old string shape (legacy cache) or the new object shape
type OptimizationItem =
  | string
  | { description: string; snippet?: string };

interface OptimizationListProps {
  items: OptimizationItem[];
}


/** Heuristic: if the description contains words like "minor", "consider", "style" → info icon */
function isMinor(text: string) {
  return /\b(minor|consider|style|readability|naming|clean)\b/i.test(text);
}

export default function OptimizationList({ items }: OptimizationListProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-950 pb-3">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-bold text-slate-100">Optimization Areas</h3>
        <span className="ml-auto text-[10px] font-mono text-slate-500">{items.length} area{items.length !== 1 ? 's' : ''}</span>
      </div>

      <ol className="space-y-4">
        {items.map((item, i) => {
          // Normalise: support both old string[] and new {description, snippet}[]
          const description = typeof item === 'string' ? item : item.description;
          const snippet     = typeof item === 'string' ? ''   : (item.snippet || '');
          const minor       = isMinor(description);

          return (
            <li key={i} className="flex gap-3">
              {/* Number badge */}
              <span className={`flex-shrink-0 w-6 h-6 rounded-full border text-[10px] font-mono font-bold flex items-center justify-center mt-0.5
                ${minor
                  ? 'bg-blue-950/30 border-blue-500/20 text-blue-400'
                  : 'bg-amber-950/30 border-amber-500/20 text-amber-400'
                }`}>
                {i + 1}
              </span>

              <div className="flex-1 space-y-2">
                {/* Severity icon + description */}
                <div className="flex items-start gap-1.5">
                  {minor
                    ? <Lightbulb className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  }
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <InlineCode text={description} />
                  </p>
                </div>

                {/* Code snippet block — only rendered when non-empty */}
                {snippet && snippet.trim().length > 0 && (
                  <div className="rounded-xl overflow-hidden border border-slate-800/60">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#07090e] border-b border-slate-800/60">
                      <div className="w-2 h-2 rounded-full bg-red-500/40" />
                      <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                      <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                      <span className="text-[9px] font-mono text-slate-600 ml-1 uppercase tracking-wider">suggested fix</span>
                    </div>
                    <pre className="px-4 py-3 text-[11px] font-mono text-emerald-300 leading-relaxed overflow-x-auto bg-emerald-950/5">
                      <code>{snippet}</code>
                    </pre>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
