import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { saveHandles } from '../api/auth.api';
import { triggerSync } from '../api/sync.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProfileInputProps {
  initialLeetcode?: string | null;
  initialCodeforces?: string | null;
  onSyncComplete?: () => void;
}

/** Accept a profile URL or a plain username; mirrors backend/utils/parseHandle.js. */
function parseLeetcodeInput(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.match(/leetcode\.com\/(?:u\/)?([A-Za-z0-9_\-.]+)\/?$/i)?.[1] ?? trimmed;
}

function parseCodeforcesInput(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.match(/codeforces\.com\/profile\/([A-Za-z0-9_\-.]+)\/?$/i)?.[1] ?? trimmed;
}

interface SyncResult { leetcode: number; codeforces: number; errors?: { platform: string; message: string }[] }

/** Link LeetCode / Codeforces usernames and pull recent public submissions. */
export default function ProfileInput({ initialLeetcode, initialCodeforces, onSyncComplete }: ProfileInputProps) {
  const [handles, setHandles] = useState({ leetcode: initialLeetcode || '', codeforces: initialCodeforces || '' });
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The user loads after mount, so props can arrive after the first render.
  useEffect(() => {
    setHandles({ leetcode: initialLeetcode || '', codeforces: initialCodeforces || '' });
  }, [initialLeetcode, initialCodeforces]);

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const saved = await saveHandles({ leetcode: handles.leetcode, codeforces: handles.codeforces });
      if (saved?.data) {
        setHandles({ leetcode: saved.data.leetcodeHandle || '', codeforces: saved.data.codeforcesHandle || '' });
      }
      const data = await triggerSync();
      setResult(data.synced);
      onSyncComplete?.();
    } catch (err) {
      setError((err as Error).message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <form onSubmit={handleSync} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="lc-handle" className="text-sm font-medium text-foreground">LeetCode username</label>
          <Input
            id="lc-handle"
            placeholder="username or profile URL"
            value={handles.leetcode}
            onChange={(e) => setHandles((h) => ({ ...h, leetcode: e.target.value }))}
            onBlur={() => setHandles((h) => ({ ...h, leetcode: parseLeetcodeInput(h.leetcode) }))}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">leetcode.com/u/<span className="text-foreground">username</span></p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cf-handle" className="text-sm font-medium text-foreground">Codeforces handle</label>
          <Input
            id="cf-handle"
            placeholder="handle or profile URL"
            value={handles.codeforces}
            onChange={(e) => setHandles((h) => ({ ...h, codeforces: e.target.value }))}
            onBlur={() => setHandles((h) => ({ ...h, codeforces: parseCodeforcesInput(h.codeforces) }))}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">codeforces.com/profile/<span className="text-foreground">handle</span></p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={syncing || (!handles.leetcode && !handles.codeforces)}>
          {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {syncing ? 'Saving and syncing…' : 'Save and sync recent'}
        </Button>
        <p className="text-xs text-muted-foreground">Pulls your most recent public submissions. Use Import for full history.</p>
      </div>

      {result && (
        <p className="flex items-center gap-2 text-sm text-success" role="status">
          <CheckCircle2 className="size-4" />
          Synced {result.leetcode} LeetCode and {result.codeforces} Codeforces submissions
        </p>
      )}
      {result?.errors?.map((e, i) => (
        <p key={i} className="flex items-start gap-2 text-sm text-warning">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {e.platform}: {e.message}
        </p>
      ))}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
    </form>
  );
}
