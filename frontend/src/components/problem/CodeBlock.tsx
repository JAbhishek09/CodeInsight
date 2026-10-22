import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { languageLabel } from '@/lib/languages';

interface CodeBlockProps {
  code: string;
  language?: string;
  /** Text shown on the left of the toolbar; defaults to the language label. */
  label?: React.ReactNode;
  /** Extra items on the right of the toolbar, before the copy button. */
  meta?: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

/** Read-only code panel with a toolbar and a copy button. */
export default function CodeBlock({ code, language, label, meta, className, maxHeight = 'max-h-[480px]' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (permissions, insecure context) — nothing to do.
    }
  };

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-background', className)}>
      <div className="flex items-center gap-3 border-b border-border bg-surface-1 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label ?? languageLabel(language ?? '')}</span>
        <div className="ml-auto flex items-center gap-3">
          {meta}
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? 'Copied' : 'Copy code'}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      {/* No ligatures: != and >= must read as typed, not as ≠ and ≥ */}
      <pre className={cn('overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-foreground [font-variant-ligatures:none]', maxHeight)}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
