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
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">AI Insights</h3>
        </div>
        <Link
          to="/insights"
          className="text-xs text-primary hover:text-primary font-bold inline-flex items-center gap-1 cursor-pointer"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{insights.summary}</p>

      <ul className="space-y-2.5">
        {insights.recommendations.slice(0, 3).map((rec, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
            <Lightbulb className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
            <span>{rec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
