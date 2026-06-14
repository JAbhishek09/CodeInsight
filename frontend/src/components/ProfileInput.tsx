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
      setError(e.response?.data?.message || e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Derive per-platform error messages from sync errors array
  const syncErrors: string[] = result?.errors?.map((e: any) => `${e.platform}: ${e.message}`) ?? [];

  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
        <User className="w-4 h-4 text-pink-400" />
        <h3 className="text-sm font-bold text-slate-100">Platform Handles</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
            LeetCode Username or Profile URL
          </label>
          <input
            type="text"
            placeholder="e.g. tourist  or  leetcode.com/u/tourist/"
            value={handles.leetcode}
            onChange={(e) => setHandles((h) => ({ ...h, leetcode: e.target.value }))}
            onBlur={handleLeetcodeBlur}
            className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/60 font-mono transition-all"
          />
          <p className="mt-1 text-[10px] text-slate-600 font-mono">
            Accepts: username · leetcode.com/u/username/ · leetcode.com/username/
          </p>
        </div>
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
            Codeforces Handle or Profile URL
          </label>
          <input
            type="text"
            placeholder="e.g. Petr  or  codeforces.com/profile/Petr"
            value={handles.codeforces}
            onChange={(e) => setHandles((h) => ({ ...h, codeforces: e.target.value }))}
            onBlur={handleCodeforcesBlur}
            className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/60 font-mono transition-all"
          />
          <p className="mt-1 text-[10px] text-slate-600 font-mono">
            Accepts: handle · codeforces.com/profile/handle
          </p>
        </div>
      </div>

      <button
        onClick={handleSync}
        disabled={syncing || (!handles.leetcode && !handles.codeforces)}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:opacity-95 disabled:opacity-40 text-white text-xs font-bold rounded-xl py-3 transition-all"
      >
        {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        <span>{syncing ? 'Syncing Submissions...' : 'Save & Sync Submissions'}</span>
      </button>

      {/* Success result */}
      {result && (
        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 text-xs font-mono text-emerald-400">
          ✓ Synced {result.leetcode} LeetCode + {result.codeforces} Codeforces submissions
        </div>
      )}

      {/* Per-platform sync warnings (e.g. "LeetCode: username may be private") */}
      {syncErrors.length > 0 && (
        <div className="bg-yellow-950/20 border border-yellow-500/20 rounded-xl p-3 space-y-1">
          {syncErrors.map((msg, i) => (
            <div key={i} className="flex items-start gap-2 text-xs font-mono text-yellow-400">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hard error (e.g. unrecognised URL format, network failure) */}
      {error && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 text-xs font-mono text-red-400">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
