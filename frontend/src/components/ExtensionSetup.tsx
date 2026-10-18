import { useState } from 'react';
import { Check, Copy, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TOKEN_KEY = 'codeinsight_token';

/** Where the extension should send data: the API origin, not the dev server. */
export const apiOrigin = () =>
  import.meta.env.VITE_API_ORIGIN || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);

function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Couldn’t copy — select the text and copy it yourself.');
    }
  };
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-foreground">
          {secret ? `${value.slice(0, 12)}••••••••` : value}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? <Check className="text-success" /> : <Copy />} {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

/**
 * How to connect the browser extension: install it, then paste the sign-in
 * token and server address into its popup.
 */
export default function ExtensionSetup({ connected }: { connected: boolean | undefined }) {
  const token = (() => { try { return localStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; } })();
  const steps = [
    <>Get the extension folder from the person running the pilot. In Chrome open <code className="font-mono text-xs">chrome://extensions</code>, turn on <b>Developer mode</b>, click <b>Load unpacked</b> and choose the folder.</>,
    <>Click the CodeInsight icon in Chrome’s toolbar and paste the two values below, then save.</>,
    <>Open any LeetCode problem. A <b>“Which pattern?”</b> card appears — guess before you code, then submit as usual.</>,
  ];
  return (
    <div id="extension" className="scroll-mt-20 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">The extension asks you to guess the pattern on LeetCode and tells you how you did after you submit.</p>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs', connected ? 'text-success' : 'text-subtle')}>
          <span className={cn('size-1.5 rounded-full', connected ? 'bg-success' : 'bg-subtle')} aria-hidden />
          {connected ? 'Connected' : 'Not yet'}
        </span>
      </div>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary" aria-hidden>{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 sm:grid-cols-2">
        <CopyField label="Sign-in token" value={token} secret />
        <CopyField label="Server address" value={apiOrigin()} />
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        The token signs the extension in as you. Paste it only into the CodeInsight extension, never share it.
      </p>
    </div>
  );
}
