import { useEffect, useState } from 'react';
import { X, Download, Wrench, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ProfileInput from './ProfileInput';
import HistoryImport from './HistoryImport';
import axios from '../api/axiosInstance';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { user, refreshUser } = useAuth() as any;
  const [repairSession, setRepairSession]   = useState('');
  const [repairing, setRepairing]           = useState(false);
  const [repairResult, setRepairResult]     = useState<{ fixed: number; total: number } | null>(null);
  const [repairError, setRepairError]       = useState('');
  const [showRepair, setShowRepair]         = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Reset repair state each open
  useEffect(() => {
    if (isOpen) { setRepairResult(null); setRepairError(''); setRepairSession(''); }
  }, [isOpen]);

  const handleSyncComplete = () => refreshUser?.();

  const handleRepair = async () => {
    if (!repairSession.trim()) return;
    try {
      setRepairing(true);
      setRepairError('');
      setRepairResult(null);
      const res = await axios.post('/api/import/leetcode/repair-difficulty', {
        sessionCookie: repairSession.trim(),
      });
      setRepairResult({ fixed: res.data.fixed, total: res.data.total });
      refreshUser?.();
    } catch (err: any) {
      setRepairError(err?.response?.data?.message || err.message || 'Repair failed.');
    } finally {
      setRepairing(false);
    }
  };

  if (!isOpen) return null;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-12 pb-8 px-4 overflow-y-auto ci-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl ci-card shadow-2xl overflow-hidden">

        {/* Gradient top bar */}
        <div className="ci-gradient-bar" />

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--ci-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[var(--ci-text-primary)]">Import History</h2>
                <p className="text-[10px] font-mono text-[var(--ci-text-muted)]">LeetCode · Codeforces sync</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="ci-theme-btn"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 max-h-[72vh] overflow-y-auto">

          {/* Warning if not connected */}
          {(!user?.leetcodeHandle && !user?.codeforcesHandle) && (
            <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] font-mono text-amber-400 leading-relaxed">
                Connect your platform handles below before importing.
              </p>
            </div>
          )}

          {/* Platform handles + sync */}
          <ProfileInput
            initialLeetcode={user?.leetcodeHandle}
            initialCodeforces={user?.codeforcesHandle}
            onSyncComplete={handleSyncComplete}
          />

          {/* History import */}
          {user?.leetcodeHandle && (
            <HistoryImport
              historyImportStatus={user?.historyImportStatus ?? 'none'}
              historyImportCount={user?.historyImportCount ?? 0}
              lastHistoryImportAt={user?.lastHistoryImportAt ?? null}
              onImportComplete={handleSyncComplete}
            />
          )}

          {!user?.leetcodeHandle && (
            <p className="text-center py-4 text-xs font-mono text-[var(--ci-text-muted)]">
              Set your LeetCode handle above to unlock full history import.
            </p>
          )}

          {/* ── Difficulty Repair section ── */}
          {user?.leetcodeHandle && (
            <div className="border border-[var(--ci-border)] rounded-xl overflow-hidden">
              <button
                onClick={() => setShowRepair(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--ci-bg-surface)] transition-colors cursor-pointer"
              >
                <Wrench className="w-4 h-4 text-[var(--ci-text-muted)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--ci-text-primary)]">Fix Difficulty Data</p>
                  <p className="text-[10px] font-mono text-[var(--ci-text-muted)] truncate">
                    All problems showing "Medium"? Run this one-time repair.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-[var(--ci-text-faint)] shrink-0">
                  {showRepair ? '▲ Hide' : '▼ Show'}
                </span>
              </button>

              {showRepair && (
                <div className="px-4 pb-4 pt-2 border-t border-[var(--ci-border)] space-y-3 bg-[var(--ci-bg-surface)]">
                  <p className="text-[11px] text-[var(--ci-text-secondary)] leading-relaxed font-mono">
                    If all your problems show <span className="text-amber-400 font-bold">Medium</span> difficulty,
                    this repair re-fetches the real difficulty from LeetCode and corrects your database.
                    Requires your <span className="text-cyan-400">LEETCODE_SESSION</span> cookie.
                  </p>
                  <textarea
                    className="ci-input text-[10px] resize-none h-16 leading-relaxed"
                    placeholder="Paste your LEETCODE_SESSION cookie here..."
                    value={repairSession}
                    onChange={(e) => setRepairSession(e.target.value)}
                  />

                  {repairResult && (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Fixed {repairResult.fixed} of {repairResult.total} problems. Refresh the page to see updated difficulties.</span>
                    </div>
                  )}
                  {repairError && (
                    <div className="flex items-center gap-2 text-[11px] font-mono text-rose-400 bg-rose-950/20 border border-rose-500/20 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{repairError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleRepair}
                    disabled={repairing || !repairSession.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    {repairing
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Repairing difficulties...</>
                      : <><Wrench className="w-3.5 h-3.5" /> Run Difficulty Repair</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
