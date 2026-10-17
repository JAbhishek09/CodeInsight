import { useEffect } from 'react';
import { X, Download, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ProfileInput from './ProfileInput';
import HistoryImport from './HistoryImport';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const { user, refreshUser } = useAuth() as any;

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

  const handleSyncComplete = () => refreshUser?.();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-12 pb-8 px-4 overflow-y-auto ci-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="import-modal-title" className="relative w-full max-w-2xl ci-card shadow-2xl overflow-hidden">

        {/* Gradient top bar */}

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Download className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 id="import-modal-title" className="text-sm font-extrabold text-[var(--foreground)]">Import History</h2>
                <p className="text-[10px] text-[var(--text-muted)]">LeetCode · Codeforces sync</p>
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
            <div className="flex items-start gap-2.5 bg-warning/8 border border-warning/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-warning leading-relaxed">
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
            <p className="text-center py-4 text-xs text-[var(--text-muted)]">
              Set your LeetCode handle above to unlock full history import.
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
