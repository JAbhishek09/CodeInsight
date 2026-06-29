import { Link } from 'react-router-dom';
import { Brain, ArrowRight, Lightbulb } from 'lucide-react';
import { AIInsightsSummary } from '../utils/stats';

interface AIInsightsPanelProps {
  insights: AIInsightsSummary;
}

/** Compact AI Insights teaser for the Dashboard — links out to the full
 *  /insights page for the detailed breakdown. */
export default function AIInsightsPanel({ insights }: AIInsightsPanelProps) {
  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-950 pb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-100">AI Insights</h3>
        </div>
        <Link
          to="/insights"
          className="text-xs text-pink-400 hover:text-pink-300 font-mono font-bold inline-flex items-center gap-1 cursor-pointer"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">{insights.summary}</p>

      <ul className="space-y-2.5">
        {insights.recommendations.slice(0, 3).map((rec, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
