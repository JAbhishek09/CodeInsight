import { Code2 } from 'lucide-react';
import { languageLabel } from '../lib/languages';

interface CodeViewerProps {
  code: string;
  language: string;
}


export default function CodeViewer({ code, language }: CodeViewerProps) {
  if (!code || code.trim().length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Code2 className="w-4 h-4 text-subtle" />
          <span className="text-xs text-subtle">Code Unavailable</span>
        </div>
        <p className="text-xs text-subtle">
          LeetCode's public API does not return code for submissions. To enable code retrieval,
          add your LEETCODE_SESSION cookie to the backend .env file.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" />
          <span className="text-xs text-muted-foreground">
            {languageLabel(language)}
          </span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-danger/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-warning/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-success/40" />
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-xs text-muted-foreground font-mono leading-relaxed max-h-[400px] overflow-y-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
