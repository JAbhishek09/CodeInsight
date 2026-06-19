import { useState, useRef, useEffect } from 'react';
import { importLeetcodeProblems, importLeetcodeCode, backfillLeetcodeCode, getCodeCoverageStatus } from '../api/import.api';
import { Download, Code2, AlertCircle, CheckCircle2, ChevronRight, Eye, EyeOff, Loader2, RotateCcw } from 'lucide-react';

interface Props {
  historyImportStatus: 'none' | 'partial' | 'full';
  historyImportCount: number;
  lastHistoryImportAt: string | null;
  onImportComplete: () => void;
}

export default function HistoryImport({
  historyImportStatus,
  historyImportCount,
  lastHistoryImportAt,
  onImportComplete,
}: Props) {
  const [importingProblems, setImportingProblems] = useState(false);
  const [problemResult, setProblemResult] = useState<string | null>(null);
  const [problemError, setProblemError] = useState<string | null>(null);

  const [sessionCookie, setSessionCookie] = useState('');
  const [showCookie, setShowCookie] = useState(false);
  const [importingCode, setImportingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeComplete, setCodeComplete] = useState(false);

  // Phase 1B progress (global submission list)
  const [phase, setPhase] = useState<'idle' | '1b' | '1c'>('idle');
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalFetched, setTotalFetched] = useState(0);
  const [totalAttached, setTotalAttached] = useState(0);
  const [totalBackfilled, setTotalBackfilled] = useState(0);
  const [pagesProcessed, setPagesProcessed] = useState(0);

  // Phase 1C progress (per-problem backfill)
  const [backfillTotal, setBackfillTotal] = useState(0);
  const [backfillFilled, setBackfillFilled] = useState(0);
  const [backfillSkipped, setBackfillSkipped] = useState(0);
  const [backfillProcessed, setBackfillProcessed] = useState(0);

  const abortRef = useRef(false);

  // Live code coverage — ground truth from MongoDB, not the static
  // historyImportStatus prop (which doesn't know about extension-synced code).
  const [coverage, setCoverage] = useState<{
    status: 'none' | 'partial' | 'mixed' | 'full';
    acceptedSubmissions: number;
    acceptedWithCode: number;
    missingCode: number;
  } | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(true);

  const refreshCoverage = async () => {
    setCoverageLoading(true);
    try {
      const data = await getCodeCoverageStatus();
      setCoverage(data);
    } catch {
      // Non-fatal — fall back to the static prop-based label below
    } finally {
      setCoverageLoading(false);
    }
  };

  useEffect(() => {
    refreshCoverage();
  }, []);

  const handleImportProblems = async () => {
    setImportingProblems(true);
    setProblemResult(null);
    setProblemError(null);
    try {
      const data = await importLeetcodeProblems(sessionCookie.trim() || undefined);
      setProblemResult(data.message);
      onImportComplete();
      refreshCoverage();
    } catch (e: any) {
      setProblemError(e.message || 'Import failed');
    } finally {
      setImportingProblems(false);
    }
  };

  // Phase 1B: paginate via REST cursor (lastKey), not integer offset
  const runPhase1B = async (session: string): Promise<void> => {
    setPhase('1b');
    let lastKey = '';          // '' = first page; subsequent pages use the cursor returned
    let fetched = 0, attached = 0, backfilled = 0, pages = 0;

    while (!abortRef.current) {
      setCurrentOffset(pages); // repurpose to show page count in UI
      const data = await importLeetcodeCode(session, lastKey);

      fetched    += data.fetched    ?? 0;
      attached   += data.attached   ?? 0;
      backfilled += data.backfilled ?? 0;
      pages      += 1;

      setTotalFetched(fetched);
      setTotalAttached(attached);
      setTotalBackfilled(backfilled);
      setPagesProcessed(pages);

      if (!data.hasMore) break;
      lastKey = data.nextKey ?? '';  // use cursor for next page
      await new Promise(r => setTimeout(r, 500));
    }
  };

  // Phase 1C: per-problem backfill for problems still missing code after 1B
  // Each call handles `limit` problems; we paginate by `skip` until hasMore=false.
  const runPhase1C = async (session: string): Promise<void> => {
    setPhase('1c');
    setBackfillTotal(0);
    setBackfillFilled(0);
    setBackfillSkipped(0);
    setBackfillProcessed(0);

    let skip = 0;
    let totalFilled = 0, totalSkipped = 0, totalProcessed = 0;

    while (!abortRef.current) {
      const data = await backfillLeetcodeCode(session, skip, 20);

      totalFilled    += data.filled    ?? 0;
      totalSkipped   += data.skipped   ?? 0;
      totalProcessed += data.processed ?? 0;

      setBackfillTotal(data.total ?? 0);
      setBackfillFilled(totalFilled);
      setBackfillSkipped(totalSkipped);
      setBackfillProcessed(totalProcessed);

      if (!data.hasMore) break;
      skip = data.nextSkip ?? skip + 20;

      // Slightly longer pause in 1C — each iteration makes 2× LC requests per problem
      await new Promise(r => setTimeout(r, 600));
    }
  };

  const handleImportCode = async () => {
    if (!sessionCookie.trim()) {
      setCodeError('Please paste your LEETCODE_SESSION cookie first.');
      return;
    }

    setImportingCode(true);
    setCodeError(null);
    setCodeComplete(false);
    setCurrentOffset(0);
    setTotalFetched(0);
    setTotalAttached(0);
    setTotalBackfilled(0);
    setPagesProcessed(0);
    setBackfillTotal(0);
    setBackfillFilled(0);
    setBackfillSkipped(0);
    setBackfillProcessed(0);
    abortRef.current = false;

    const session = sessionCookie.trim();

    try {
      // Phase 1B — global submission list (fast, covers recent ~1080 submissions)
      await runPhase1B(session);

      // Phase 1C — per-problem fetch for any problems still with empty submissions
      // (covers all historically old problems that 1B's global window missed)
      if (!abortRef.current) {
        await runPhase1C(session);
      }

      setCodeComplete(true);
      onImportComplete();
      refreshCoverage();
    } catch (e: any) {
      setCodeError(e.message || 'Code import failed');
    } finally {
      setImportingCode(false);
      setPhase('idle');
    }
  };

  const handleStop = () => {
    abortRef.current = true;
  };

  const handleReset = () => {
    setCodeComplete(false);
    setCodeError(null);
    setPhase('idle');
    setCurrentOffset(0);
    setTotalFetched(0);
    setTotalAttached(0);
    setTotalBackfilled(0);
    setPagesProcessed(0);
    setBackfillTotal(0);
    setBackfillFilled(0);
    setBackfillSkipped(0);
    setBackfillProcessed(0);
  };

  const statusLabel: Record<string, string> = {
    none:    'Not started',
    partial: 'Problems imported (no code)',
    mixed:   'Some code missing',
    full:    'Full import complete',
  };

  // Prefer the live, ground-truth coverage status. Fall back to the static
  // historyImportStatus prop only while coverage is still loading.
  const effectiveStatus = coverageLoading ? historyImportStatus : (coverage?.status ?? historyImportStatus);
  const coverageDetail = coverage && coverage.acceptedSubmissions > 0
    ? `${coverage.acceptedWithCode}/${coverage.acceptedSubmissions} submissions have code`
    : null;

  return (
    <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-950 pb-4">
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-100">Import LeetCode History</h3>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
          effectiveStatus === 'full'    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20' :
          effectiveStatus === 'mixed'   ? 'text-orange-400  border-orange-500/30   bg-orange-950/20'  :
          effectiveStatus === 'partial' ? 'text-yellow-400  border-yellow-500/30  bg-yellow-950/20'  :
                                              'text-slate-500   border-slate-800       bg-slate-900/40'
        }`}>
          {statusLabel[effectiveStatus] ?? 'Unknown'}
        </span>
      </div>

      {coverageDetail && (
        <p className="text-[11px] font-mono text-slate-500">{coverageDetail}</p>
      )}

      {historyImportCount > 0 && lastHistoryImportAt && (
        <p className="text-[11px] font-mono text-slate-500">
          Last run: {new Date(lastHistoryImportAt).toLocaleString()} · {historyImportCount} problems
        </p>
      )}

      {/* ── Step 1 ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-indigo-400">1</span>
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-xs font-semibold text-slate-200">Import Solved Problems</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Fetches your accepted problems — title, difficulty, and topic tags.
            Paste your <code className="text-purple-400 bg-purple-950/30 px-1 rounded">LEETCODE_SESSION</code> in Step 2 first for your <strong className="text-slate-400">complete history</strong>.
          </p>
          <button
            onClick={handleImportProblems}
            disabled={importingProblems}
            className="flex items-center gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-all"
          >
            {importingProblems ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</> : <><Download className="w-3.5 h-3.5" /> Import Problem List</>}
          </button>
          {problemResult && (
            <div className="flex items-start gap-2 bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 text-[11px] font-mono text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{problemResult}</span>
            </div>
          )}
          {problemError && (
            <div className="flex items-start gap-2 bg-red-950/20 border border-red-500/20 rounded-lg p-3 text-[11px] font-mono text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{problemError}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Step 2 ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-purple-950/50 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-purple-400">2</span>
        </div>
        <div className="flex-1 space-y-3">
          <p className="text-xs font-semibold text-slate-200">Import Submission Code <span className="text-slate-600 font-normal">(optional)</span></p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Fetches source code for all your submissions — required for AI analysis.
            Runs two passes: a fast global scan then a per-problem pass for older history.
            May take 3–8 minutes for large histories.
          </p>

          <details className="text-[11px] text-slate-500 cursor-pointer">
            <summary className="hover:text-slate-300 transition-colors flex items-center gap-1">
              <ChevronRight className="w-3 h-3" /> How to get your LEETCODE_SESSION cookie
            </summary>
            <ol className="mt-2 ml-4 space-y-1 list-decimal list-outside">
              <li>Open <a href="https://leetcode.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">leetcode.com</a> and log in.</li>
              <li>Press <kbd className="bg-slate-900 px-1 rounded">F12</kbd> → Application → Cookies → https://leetcode.com</li>
              <li>Copy the value of <strong className="text-slate-400">LEETCODE_SESSION</strong>.</li>
            </ol>
          </details>

          <div className="relative">
            <input
              type={showCookie ? 'text' : 'password'}
              placeholder="Paste LEETCODE_SESSION value here…"
              value={sessionCookie}
              onChange={(e) => setSessionCookie(e.target.value)}
              disabled={importingCode}
              className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-2.5 pr-10 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 font-mono transition-all disabled:opacity-50"
              autoComplete="off"
            />
            <button type="button" onClick={() => setShowCookie(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400" tabIndex={-1}>
              {showCookie ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {!importingCode ? (
              <button
                onClick={handleImportCode}
                disabled={!sessionCookie.trim()}
                className="flex items-center gap-2 text-xs font-bold bg-purple-700 hover:bg-purple-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-all"
              >
                <Code2 className="w-3.5 h-3.5" />
                {codeComplete ? 'Re-import All Code' : 'Import All Submission Code'}
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 text-xs font-bold bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Stop
              </button>
            )}
            {(codeComplete || (!importingCode && pagesProcessed > 0)) && (
              <button onClick={handleReset} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            )}
          </div>

          {/* Live progress */}
          {importingCode && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-3">

              {/* Phase 1B */}
              <div>
                <div className="flex items-center gap-2 text-[11px] font-mono mb-1.5">
                  {phase === '1b' ? (
                    <><Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                    <span className="text-purple-400">Pass 1 — recent history (page {currentOffset + 1})</span></>
                  ) : (
                    <><CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Pass 1 — complete ({pagesProcessed} pages)</span></>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-sm font-bold text-slate-200">{totalFetched}</div>
                    <div className="text-[10px] text-slate-500">fetched</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-400">{totalAttached}</div>
                    <div className="text-[10px] text-slate-500">new</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-indigo-400">{totalBackfilled}</div>
                    <div className="text-[10px] text-slate-500">updated</div>
                  </div>
                </div>
              </div>

              {/* Phase 1C */}
              {(phase === '1c' || backfillProcessed > 0) && (
                <div className="border-t border-slate-800 pt-3">
                  <div className="flex items-center gap-2 text-[11px] font-mono mb-1.5">
                    {phase === '1c' ? (
                      <><Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                      <span className="text-indigo-400">Pass 2 — older history ({backfillProcessed}/{backfillTotal} problems)</span></>
                    ) : (
                      <><CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Pass 2 — complete</span></>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-bold text-slate-200">{backfillProcessed}</div>
                      <div className="text-[10px] text-slate-500">checked</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-emerald-400">{backfillFilled}</div>
                      <div className="text-[10px] text-slate-500">filled</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-500">{backfillSkipped}</div>
                      <div className="text-[10px] text-slate-500">no AC</div>
                    </div>
                  </div>
                  {backfillTotal > 0 && (
                    <div className="mt-2 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((backfillProcessed / backfillTotal) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-slate-600 text-center">Do not close this tab</p>
            </div>
          )}

          {/* Final result */}
          {codeComplete && !importingCode && (
            <div className="flex items-start gap-2 bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 text-[11px] font-mono text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Import complete — {pagesProcessed} pages (recent) + {backfillProcessed} problems (older history).{' '}
                {totalAttached + backfillFilled} submissions now have code.
              </span>
            </div>
          )}

          {codeError && (
            <div className="flex items-start gap-2 bg-red-950/20 border border-red-500/20 rounded-lg p-3 text-[11px] font-mono text-red-400">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{codeError}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Step 3 ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 border-t border-slate-950 pt-4">
        <div className="w-5 h-5 rounded-full bg-pink-950/50 border border-pink-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] font-bold text-pink-400">3</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-200">Install the Extension for Future Syncing</p>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            After the one-time import, install the CodeInsight Chrome extension.
            It captures every future submission automatically — no manual sync needed.
          </p>
        </div>
      </div>
    </div>
  );
}
