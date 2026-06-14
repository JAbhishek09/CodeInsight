import { Code2 } from 'lucide-react';

interface CodeViewerProps {
  code: string;
  language: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  cpp: 'C++',
  c: 'C',
  java: 'Java',
  python3: 'Python 3',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  golang: 'Go',
  rust: 'Rust',
  kotlin: 'Kotlin',
};

export default function CodeViewer({ code, language }: CodeViewerProps) {
  if (!code || code.trim().length === 0) {
    return (
      <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Code2 className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-mono text-slate-500">Code Unavailable</span>
        </div>
        <p className="text-xs text-slate-500 font-mono">
          LeetCode's public API does not return code for submissions. To enable code retrieval,
          add your LEETCODE_SESSION cookie to the backend .env file.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-900 bg-[#07090e]">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-pink-400" />
          <span className="text-xs font-mono text-slate-300">
            {LANGUAGE_LABELS[language] || language}
          </span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-xs text-slate-300 font-mono leading-relaxed max-h-[400px] overflow-y-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
