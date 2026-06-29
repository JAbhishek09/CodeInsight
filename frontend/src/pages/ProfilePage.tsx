import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getProblems } from '../api/problems.api';
import ProfileInput from '../components/ProfileInput';
import HistoryImport from '../components/HistoryImport';
import SubmissionsTable from '../components/SubmissionsTable';
import {
  RefreshCw,
  User,
  Clock,
  Settings,
  Plug,
  Database,
  Target,
  CalendarDays,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

type SettingsTab = 'account' | 'integrations' | 'data';

const TABS: { id: SettingsTab; label: string; Icon: typeof Settings }[] = [
  { id: 'account', label: 'Account', Icon: Settings },
  { id: 'integrations', label: 'Integrations', Icon: Plug },
  { id: 'data', label: 'Synced Data', Icon: Database },
];

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('account');
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

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-5xl mx-auto" id="profile-page">
      {/* Compact account header */}
      <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white font-extrabold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-white truncate">{user?.name}</h1>
            <p className="text-xs font-mono text-slate-400 truncate">{user?.email}</p>
          </div>
          {user?.lastSyncedAt && (
            <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-slate-500 shrink-0">
              <Clock className="w-3 h-3" />
              Last synced: {new Date(user.lastSyncedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 mt-6 pt-5 border-t border-slate-950 overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-colors cursor-pointer shrink-0 ${
                tab === id
                  ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                  : 'text-slate-500 border border-transparent hover:text-slate-300 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Account tab ─────────────────────────────────────────────────── */}
      {tab === 'account' && (
        <div className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-950 pb-4">
            <User className="w-4 h-4 text-pink-400" />
            <h3 className="text-sm font-bold text-slate-100">Account Details</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 space-y-1.5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" /> Member Since
              </p>
              <p className="text-sm font-bold text-slate-200">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 space-y-1.5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Daily Goal
              </p>
              <p className="text-sm font-bold text-slate-200">{user?.targetDailySolved ?? 1} problem(s) / day</p>
            </div>
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 space-y-1.5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" /> Total Solved
              </p>
              <p className="text-sm font-bold text-slate-200">{user?.solvedProblemsCount ?? 0}</p>
            </div>
          </div>
          <p className="text-[11px] font-mono text-slate-600">
            Name, email, and daily goal are set at registration and aren't editable from this page yet.
          </p>
        </div>
      )}

      {/* ── Integrations tab ────────────────────────────────────────────── */}
      {tab === 'integrations' && (
        <div className="space-y-6">
          {/* Platform connection status cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { name: 'LeetCode', handle: user?.leetcodeHandle, color: 'amber' },
              { name: 'Codeforces', handle: user?.codeforcesHandle, color: 'blue' },
            ].map((p) => {
              const connected = Boolean(p.handle);
              return (
                <div
                  key={p.name}
                  className="bg-[#0b0e14] border border-slate-900 rounded-2xl p-5 flex items-center gap-4"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      connected
                        ? p.color === 'amber'
                          ? 'bg-amber-950/30 border-amber-500/20'
                          : 'bg-blue-950/30 border-blue-500/20'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <Plug className={`w-4 h-4 ${connected ? (p.color === 'amber' ? 'text-amber-400' : 'text-blue-400') : 'text-slate-600'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200">{p.name}</p>
                    <p className="text-[11px] font-mono text-slate-500 truncate">
                      {connected ? p.handle : 'Not connected'}
                    </p>
                  </div>
                  {connected ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-600 shrink-0">
                      <XCircle className="w-3.5 h-3.5" /> Not set
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Platform Handle Entry + Sync */}
          <ProfileInput
            initialLeetcode={user?.leetcodeHandle}
            initialCodeforces={user?.codeforcesHandle}
            onSyncComplete={handleSyncComplete}
          />

          {/* Historical Import — shown once a LeetCode handle is set */}
          {user?.leetcodeHandle && (
            <HistoryImport
              historyImportStatus={(user as any).historyImportStatus ?? 'none'}
              historyImportCount={(user as any).historyImportCount ?? 0}
              lastHistoryImportAt={(user as any).lastHistoryImportAt ?? null}
              onImportComplete={handleSyncComplete}
            />
          )}
        </div>
      )}

      {/* ── Synced Data tab ─────────────────────────────────────────────── */}
      {tab === 'data' && (
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
                className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
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
      )}
    </div>
  );
}
