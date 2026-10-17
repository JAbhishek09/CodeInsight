import { useState, useEffect } from 'react';
import { saveHandles } from '../api/auth.api';
import { triggerSync } from '../api/sync.api';
import { Loader2, RefreshCw, User, AlertCircle } from 'lucide-react';

interface ProfileInputProps {
  initialLeetcode?: string | null;
  initialCodeforces?: string | null;
  onSyncComplete?: () => void;
}

/**
 * Parse a LeetCode URL or plain username client-side so the input field
 * shows the resolved username immediately after the user pastes a URL.
 * Mirrors the logic in backend/utils/parseHandle.js.
 */
function parseLeetcodeInput(raw: string): string {
  const trimmed = raw.trim();
  const urlMatch = trimmed.match(/leetcode\.com\/(?:u\/)?([A-Za-z0-9_\-.]+)\/?$/i);
  if (urlMatch) return urlMatch[1];
  // If it looks like an unrecognised URL, return as-is so the backend can
  // surface a clear error message.
  return trimmed;
}

function parseCodeforcesInput(raw: string): string {
  const trimmed = raw.trim();
  const urlMatch = trimmed.match(/codeforces\.com\/profile\/([A-Za-z0-9_\-.]+)\/?$/i);
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

export default function ProfileInput({ initialLeetcode, initialCodeforces, onSyncComplete }: ProfileInputProps) {
  const [handles, setHandles] = useState({
    leetcode: initialLeetcode || '',
    codeforces: initialCodeforces || '',
  });
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ leetcode: number; codeforces: number; errors?: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // FIX: Sync local state when user data loads asynchronously (AuthContext
  // fetches the user after mount, so props arrive after initial render).
  useEffect(() => {
    setHandles({
      leetcode: initialLeetcode || '',
      codeforces: initialCodeforces || '',
    });
  }, [initialLeetcode, initialCodeforces]);

  /**
   * When the user pastes a full profile URL, normalise it to just the
   * username on blur so the field reflects what will actually be saved.
   */
  const handleLeetcodeBlur = () => {
    const parsed = parseLeetcodeInput(handles.leetcode);
    if (parsed !== handles.leetcode) {
      setHandles((h) => ({ ...h, leetcode: parsed }));
    }
  };

  const handleCodeforcesBlur = () => {
    const parsed = parseCodeforcesInput(handles.codeforces);
    if (parsed !== handles.codeforces) {
      setHandles((h) => ({ ...h, codeforces: parsed }));
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      // saveHandles returns the normalised usernames stored in the DB.
      // We update the input fields so the user sees exactly what was saved.
      const saved = await saveHandles({ leetcode: handles.leetcode, codeforces: handles.codeforces });
      if (saved?.data) {
        setHandles({
          leetcode: saved.data.leetcodeHandle || '',
          codeforces: saved.data.codeforcesHandle || '',
        });
      }
      const data = await triggerSync();
      setResult(data.synced);
      onSyncComplete?.();
    } catch (e: any) {
      // Surface the server's validation error (e.g. unrecognised URL format)
      setError(e?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Derive per-platform error messages from sync errors array
  const syncErrors: string[] = result?.errors?.map((e: any) => `${e.platform}: ${e.message}`) ?? [];

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-4">
        <User className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Platform Handles</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider">
            LeetCode Username or Profile URL
          </label>
          <input
            type="text"
            placeholder="e.g. tourist  or  leetcode.com/u/tourist/"
            value={handles.leetcode}
            onChange={(e) => setHandles((h) => ({ ...h, leetcode: e.target.value }))}
            onBlur={handleLeetcodeBlur}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-primary/60 transition-all"
          />
          <p className="mt-1 text-[10px] text-faint">
            Accepts: username · leetcode.com/u/username/ · leetcode.com/username/
          </p>
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider">
            Codeforces Handle or Profile URL
          </label>
          <input
            type="text"
            placeholder="e.g. Petr  or  codeforces.com/profile/Petr"
            value={handles.codeforces}
            onChange={(e) => setHandles((h) => ({ ...h, codeforces: e.target.value }))}
            onBlur={handleCodeforcesBlur}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-primary/60 transition-all"
          />
          <p className="mt-1 text-[10px] text-faint">
            Accepts: handle · codeforces.com/profile/handle
          </p>
        </div>
      </div>

      <button
        onClick={handleSync}
        disabled={syncing || (!handles.leetcode && !handles.codeforces)}
        className="w-full flex items-center justify-center gap-2 bg-primary hover:opacity-95 disabled:opacity-40 text-primary-foreground text-xs font-bold rounded-xl py-3 transition-all"
      >
        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        <span>{syncing ? 'Syncing Submissions...' : 'Save & Sync Submissions'}</span>
      </button>

      {/* Success result */}
      {result && (
        <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-xs text-success">
          ✓ Synced {result.leetcode} LeetCode + {result.codeforces} Codeforces submissions
        </div>
      )}

      {/* Per-platform sync warnings (e.g. "LeetCode: username may be private") */}
      {syncErrors.length > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 space-y-1">
          {syncErrors.map((msg, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-warning">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hard error (e.g. unrecognised URL format, network failure) */}
      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-start gap-2 text-xs text-danger">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
