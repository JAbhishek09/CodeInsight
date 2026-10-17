import { useState, useRef, useEffect } from 'react';
import {
  importLeetcodeProblems, importLeetcodeCode, backfillLeetcodeCode, getCodeCoverageStatus,
  repairDifficultyAndTags, verifyLeetcodeSession, removeLeetcodeData,
} from '../api/import.api';
import { useAuth } from '../hooks/useAuth';
import {
  Download, AlertCircle, CheckCircle2, ChevronDown, Eye, EyeOff, Loader2,
  Square, Tags, Trash2, ExternalLink, ShieldCheck,
} from 'lucide-react';

interface Props {
  historyImportStatus: 'none' | 'partial' | 'full';
  historyImportCount: number;
  lastHistoryImportAt: string | null;
  onImportComplete: () => void;
}

interface Coverage {
  status: 'none' | 'partial' | 'mixed' | 'full';
  totalProblems?: number;
  solvedProblems?: number;
  solvedWithCode?: number;
  missingCodeProblems?: number;
}

type Stage = 'idle' | 'verify' | 'list' | 'history' | 'code' | 'done';

const STAGES: { key: Exclude<Stage, 'idle' | 'done'>; label: string }[] = [
  { key: 'verify',  label: 'Check session' },
  { key: 'list',    label: 'Solved problems' },
  { key: 'history', label: 'Submission history' },
  { key: 'code',    label: 'Code & tags' },
];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function HistoryImport({ lastHistoryImportAt, onImportComplete }: Props) {
  const { user } = useAuth() as any;
  const handle: string | undefined = user?.leetcodeHandle ?? undefined;

  const [sessionCookie, setSessionCookie] = useState('');
  const [showCookie, setShowCookie]       = useState(false);
  const [showHelp, setShowHelp]           = useState(false);
  const [showMore, setShowMore]           = useState(false);

  const [stage, setStage]             = useState<Stage>('idle');
  const [verifiedAs, setVerifiedAs]   = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [notice, setNotice]           = useState<string | null>(null);
  const [scanned, setScanned]         = useState(0);
  const [codeDone, setCodeDone]       = useState(0);
  const [codeTotal, setCodeTotal]     = useState(0);
  const [unavailable, setUnavailable] = useState(0);

  const [coverage, setCoverage] = useState<Coverage | null>(null);

  const [busyAction, setBusyAction]     = useState<'tags' | 'remove' | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const abortRef   = useRef(false);
  const mountedRef = useRef(true);

  // Stop any in-flight import loop when the component unmounts (e.g. the
  // ImportModal is closed mid-import) so it doesn't keep hammering LeetCode.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current = true;
    };
  }, []);

  const refreshCoverage = async () => {
    try {
      const data = await getCodeCoverageStatus();
      if (mountedRef.current) setCoverage(data);
    } catch {
      // Non-fatal — the summary just stays hidden
    }
  };

  useEffect(() => { refreshCoverage(); }, []);

  const running = stage !== 'idle' && stage !== 'done';
  const session = sessionCookie.trim();

  // ── Pass 1: full submission history (IDs, verdicts, code when LeetCode has it)
  const runHistory = async () => {
    let offset = 0, fetched = 0, pages = 0, authFailures = 0;

    while (!abortRef.current) {
      let data;
      try {
        data = await importLeetcodeCode(session, offset);
        authFailures = 0;
      } catch (err: any) {
        // LeetCode throttles this endpoint with 403 after ~20 rapid pages even
        // though the session is fine — back off and retry the same page.
        if (/expired|invalid|401|403/i.test(err?.message || '') && authFailures < 3) {
          authFailures += 1;
          await sleep(5000 * authFailures);
          continue;
        }
        // Still blocked: stop the history scan and let the code pass (which
        // uses other endpoints) fill what's missing, instead of failing.
        if (pages > 0) {
          setNotice(`LeetCode limited the history scan after ${fetched} submissions — continuing with per-problem code fetch.`);
          return;
        }
        throw err;
      }

      fetched += data.fetched ?? 0;
      pages   += 1;
      if (mountedRef.current) setScanned(fetched);

      if (!data.hasMore) return;
      const next = data.nextOffset ?? offset + 20;
      if (next <= offset) return;
      offset = next;

      // Jittered delay so the cadence doesn't look like a uniform bot loop
      await sleep(800 + 800 * 0.4 * (Math.random() * 2 - 1));
    }
  };

  // ── Pass 2: code for every solved problem still missing it (+ tags)
  const runCode = async () => {
    let cursor: string | null = null;
    let done = 0, missing = 0, failures = 0;

    while (!abortRef.current) {
      let data;
      try {
        data = await backfillLeetcodeCode(session, cursor);
        failures = 0;
      } catch (err: any) {
        // One failed batch (timeout, LeetCode hiccup) shouldn't end the import
        failures += 1;
        if (failures > 3) throw err;
        await sleep(5000 * failures);
        continue;
      }

      done    += data.processed ?? 0;
      missing += data.skipped   ?? 0;
      if (mountedRef.current) {
        setCodeDone(done);
        setCodeTotal(done + (data.remaining ?? 0));
        setUnavailable(missing);
      }
      if (!data.hasMore || !data.nextCursor) return;
      cursor = data.nextCursor;
      await sleep(300);
    }
  };

  const handleImport = async () => {
    if (!session) {
      setError('Paste your LEETCODE_SESSION first.');
      return;
    }
    abortRef.current = false;
    setError(null); setNotice(null); setActionResult(null);
    setScanned(0); setCodeDone(0); setCodeTotal(0); setUnavailable(0);

    try {
      setStage('verify');
      const { username } = await verifyLeetcodeSession(session);
      if (!mountedRef.current) return;
      setVerifiedAs(username);

      if (abortRef.current) return;
      setStage('list');
      await importLeetcodeProblems(session);

      if (abortRef.current) return;
      setStage('history');
      await runHistory();

      if (abortRef.current) return;
      setStage('code');
      await runCode();

      if (!mountedRef.current) return;
      setStage(abortRef.current ? 'idle' : 'done');
      onImportComplete();
    } catch (e: any) {
      if (!mountedRef.current) return;
      setError(e.message || 'Import failed');
      setStage('idle');
    } finally {
      if (mountedRef.current) refreshCoverage();
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    setStage('idle');
  };

  const handleRefreshTags = async () => {
    if (!session) {
      setError('Paste your LEETCODE_SESSION first — refreshing tags needs it.');
      return;
    }
    setBusyAction('tags'); setError(null); setActionResult(null);
    try {
      const data = await repairDifficultyAndTags(session);
      setActionResult(data.message);
      onImportComplete();
    } catch (e: any) {
      setError(e.message || 'Could not refresh tags');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setBusyAction('remove'); setError(null); setActionResult(null); setConfirmRemove(false);
    try {
      const data = await removeLeetcodeData();
      setActionResult(data.message);
      setStage('idle');
      onImportComplete();
      refreshCoverage();
    } catch (e: any) {
      setError(e.message || 'Could not remove data');
    } finally {
      setBusyAction(null);
    }
  };

  // ── Derived display values
  const solved     = coverage?.solvedProblems ?? 0;
  const withCode   = coverage?.solvedWithCode ?? 0;
  const pct        = solved > 0 ? Math.floor((withCode / solved) * 100) : 0;
  const hasData    = (coverage?.totalProblems ?? 0) > 0;
  const stageIndex = STAGES.findIndex(s => s.key === stage);

  const stageDetail =
    stage === 'verify'  ? 'Checking the session belongs to your LeetCode account…' :
    stage === 'list'    ? 'Loading your solved problems…' :
    stage === 'history' ? `${scanned.toLocaleString()} submissions scanned` :
    stage === 'code'    ? (codeTotal > 0 ? `${codeDone} of ${codeTotal} problems checked` : 'Filling in tags and missing code…') :
    '';

  return (
    <section className="ci-card relative overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="p-5 sm:p-6 border-b border-[var(--border)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
              <Download className="w-4.5 h-4.5 text-warning" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-[var(--foreground)]">Import from LeetCode</h3>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                Linked account: <span className="font-semibold text-[var(--foreground)]">{handle ?? '—'}</span>
              </p>
            </div>
          </div>
          {lastHistoryImportAt && (
            <span className="text-[11px] text-[var(--text-muted)]">
              Last import {new Date(lastHistoryImportAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Coverage summary */}
        {hasData && (
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <p className="text-xs text-[var(--text-secondary)]">
                <span className="text-lg font-extrabold text-[var(--foreground)] mr-1">{withCode}</span>
                of {solved} solved problems have code
              </p>
              <span className={`text-xs font-bold ${pct === 100 ? 'text-success' : 'text-[var(--text-secondary)]'}`}>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* ── Session input ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label htmlFor="lc-session" className="block text-xs font-bold text-[var(--foreground)]">
            Your LeetCode session
          </label>
          <div className="relative">
            <input
              id="lc-session"
              type={showCookie ? 'text' : 'password'}
              placeholder="Paste the LEETCODE_SESSION value"
              value={sessionCookie}
              onChange={(e) => { setSessionCookie(e.target.value); setVerifiedAs(null); setError(null); }}
              disabled={running}
              className="ci-input pr-10 disabled:opacity-50"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowCookie(v => !v)}
              aria-label={showCookie ? 'Hide session' : 'Show session'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--foreground)]"
            >
              {showCookie ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {verifiedAs && (
            <p className="flex items-center gap-1.5 text-[11px] text-success">
              <ShieldCheck className="w-3.5 h-3.5" /> Session belongs to <span className="font-bold">{verifiedAs}</span>
            </p>
          )}

          <button
            type="button"
            onClick={() => setShowHelp(v => !v)}
            aria-expanded={showHelp}
            className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--foreground)]"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHelp ? 'rotate-180' : ''}`} />
            Where do I find this?
          </button>
          {showHelp && (
            <ol className="text-[11px] text-[var(--text-secondary)] space-y-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-3.5 list-decimal list-inside">
              <li>
                Open{' '}
                <a href="https://leetcode.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                  leetcode.com <ExternalLink className="w-3 h-3" />
                </a>{' '}
                and sign in as <span className="font-semibold">{handle}</span>.
              </li>
              <li>Press <kbd className="px-1 rounded bg-[var(--surface-3)]">F12</kbd> → <b>Application</b> → <b>Cookies</b> → https://leetcode.com.</li>
              <li>Copy the <b>Value</b> of <span className="">LEETCODE_SESSION</span> and paste it above.</li>
              <li className="list-none text-[var(--text-muted)] pt-1">It's only used for this import and isn't saved.</li>
            </ol>
          )}
        </div>

        {/* ── Primary action ────────────────────────────────────────────────── */}
        {!running ? (
          <button
            onClick={handleImport}
            disabled={!session || busyAction !== null}
            className="ci-btn-primary w-full flex items-center justify-center gap-2 text-sm px-4 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {hasData ? 'Update my LeetCode history' : 'Import my LeetCode history'}
          </button>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-4" aria-live="polite">
            {/* Stepper */}
            <ol className="grid grid-cols-4 gap-2">
              {STAGES.map((s, i) => {
                const state = i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'todo';
                return (
                  <li key={s.key} className="space-y-1.5">
                    <div className={`h-1 rounded-full ${
                      state === 'done' ? 'bg-success' : state === 'active' ? 'bg-primary animate-pulse' : 'bg-[var(--surface-3)]'
                    }`} />
                    <p className={`text-[10px] leading-tight ${
                      state === 'todo' ? 'text-[var(--text-muted)]' : 'text-[var(--foreground)] font-semibold'
                    }`}>{s.label}</p>
                  </li>
                );
              })}
            </ol>

            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs text-[var(--text-secondary)] min-w-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                <span className="truncate">{stageDetail}</span>
              </p>
              <button onClick={handleStop} className="ci-btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg shrink-0">
                <Square className="w-3 h-3" /> Stop
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              Large histories take a few minutes. Keep this window open until it finishes.
            </p>
          </div>
        )}

        {/* ── Messages ──────────────────────────────────────────────────────── */}
        {stage === 'done' && (
          <div className="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success/5 p-3.5 text-xs text-success">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Import complete</p>
              <p className="text-[var(--text-secondary)]">
                {scanned.toLocaleString()} submissions scanned
                {solved > 0 && <> · {withCode} of {solved} solved problems have code</>}
                {unavailable > 0 && <> · {unavailable} have no accepted solution on LeetCode</>}
              </p>
            </div>
          </div>
        )}
        {notice && (
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning/5 p-3.5 text-xs text-warning">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{notice}</span>
          </div>
        )}
        {actionResult && (
          <div className="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success/5 p-3.5 text-xs text-success">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{actionResult}</span>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger/5 p-3.5 text-xs text-danger">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        {/* ── More options ──────────────────────────────────────────────────── */}
        <div className="border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => { setShowMore(v => !v); setConfirmRemove(false); }}
            aria-expanded={showMore}
            className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)]"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`} />
            More options
          </button>

          {showMore && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--foreground)]">Refresh tags & difficulty</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Re-fetch topic tags and difficulty for every problem. Needs the session above.</p>
                </div>
                <button
                  onClick={handleRefreshTags}
                  disabled={running || busyAction !== null}
                  className="ci-btn-secondary flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg shrink-0 disabled:opacity-40"
                >
                  {busyAction === 'tags' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tags className="w-3.5 h-3.5" />}
                  Refresh
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/20 p-3.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-danger">Remove imported LeetCode data</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Deletes all LeetCode problems, code and analysis from this account. Codeforces and manual entries stay.
                  </p>
                </div>
                <button
                  onClick={handleRemove}
                  disabled={running || busyAction !== null || !hasData}
                  className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg shrink-0 font-semibold disabled:opacity-40 transition-colors ${
                    confirmRemove ? 'bg-danger text-on-solid hover:bg-danger/90' : 'border border-danger/30 text-danger hover:bg-danger/10'
                  }`}
                >
                  {busyAction === 'remove' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {confirmRemove ? 'Click again to confirm' : 'Remove'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
