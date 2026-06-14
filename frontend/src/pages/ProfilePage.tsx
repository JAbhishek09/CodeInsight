import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getProblems } from '../api/problems.api';
import ProfileInput from '../components/ProfileInput';
import HistoryImport from '../components/HistoryImport';
import SubmissionsTable from '../components/SubmissionsTable';
import { RefreshCw, User, Clock } from 'lucide-react';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [syncedProblems, setSyncedProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSyncedProblems = useCallback(async () => {
    try {
      setLoading(true);
      const [lcRes, cfRes] = await Promise.all([
        getProblems({ platform: 'leetcode' }),
        getProblems({ platform: 'codeforces' }),
      ]);
      const all = [...(lcRes?.data || []), ...(cfRes?.data || [])];
      setSyncedProblems(all);
    } catch (e) {
      console.error('Failed to load synced problems', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSyncedProblems();
  }, [loadSyncedProblems]);

  const handleSyncComplete = () => {
    refreshUser();
    loadSyncedProblems();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="profile-page">
      {/* Header */}
      <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-950/30 border border-pink-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">{user?.name}</h1>
            <p className="text-xs font-mono text-slate-400">{user?.email}</p>
          </div>
          {user?.lastSyncedAt && (
            <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
              <Clock className="w-3 h-3" />
              Last synced: {new Date(user.lastSyncedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Platform Handle Entry + Sync */}
      <ProfileInput
        initialLeetcode={user?.leetcodeHandle}
        initialCodeforces={user?.codeforcesHandle}
        onSyncComplete={handleSyncComplete}
      />

      {/* Historical Import (Phase 1) — shown once a LeetCode handle is set */}
      {user?.leetcodeHandle && (
        <HistoryImport
          historyImportStatus={(user as any).historyImportStatus ?? 'none'}
          historyImportCount={(user as any).historyImportCount ?? 0}
          lastHistoryImportAt={(user as any).lastHistoryImportAt ?? null}
          onImportComplete={handleSyncComplete}
        />
      )}

      {/* Synced Submissions Table */}
      <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-950 pb-4">
          <h3 className="text-sm font-bold text-slate-100">Synced Submissions</h3>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-slate-500">
              {syncedProblems.length} problem{syncedProblems.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={loadSyncedProblems}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-pink-500" />
          </div>
        ) : (
          <SubmissionsTable problems={syncedProblems} />
        )}
      </div>
    </div>
  );
}
