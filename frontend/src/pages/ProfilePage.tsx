import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { problemKeys, useProblemList } from '../hooks/useProblems';
import QueryError from '../components/QueryError';
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
  const queryClient = useQueryClient();
  const lcQuery = useProblemList({ platform: 'leetcode' });
  const cfQuery = useProblemList({ platform: 'codeforces' });
  const syncedProblems = useMemo(() => [...(lcQuery.data ?? []), ...(cfQuery.data ?? [])], [lcQuery.data, cfQuery.data]);
  const loading = lcQuery.isPending || cfQuery.isPending;
  const fetching = lcQuery.isFetching || cfQuery.isFetching;
  const syncedError = lcQuery.error ?? cfQuery.error;
  const loadSyncedProblems = useCallback(() => { lcQuery.refetch(); cfQuery.refetch(); }, [lcQuery, cfQuery]);

  const handleSyncComplete = () => {
    refreshUser();
    queryClient.invalidateQueries({ queryKey: problemKeys.all });
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
      <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-extrabold text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-foreground truncate">{user?.name}</h1>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          {user?.lastSyncedAt && (
            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-subtle shrink-0">
              <Clock className="w-3 h-3" />
              Last synced: {new Date(user.lastSyncedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 mt-6 pt-5 border-t border-border overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs  font-bold transition-colors cursor-pointer shrink-0 ${
                tab === id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-subtle border border-transparent hover:text-muted-foreground hover:bg-surface-2'
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
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-border pb-4">
            <User className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Account Details</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-1.5">
              <p className="text-[10px] text-subtle uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" /> Member Since
              </p>
              <p className="text-sm font-bold text-foreground">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-1.5">
              <p className="text-[10px] text-subtle uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Daily Goal
              </p>
              <p className="text-sm font-bold text-foreground">{user?.targetDailySolved ?? 1} problem(s) / day</p>
            </div>
            <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-1.5">
              <p className="text-[10px] text-subtle uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" /> Total Solved
              </p>
              <p className="text-sm font-bold text-foreground">{user?.solvedProblemsCount ?? 0}</p>
            </div>
          </div>
          <p className="text-[11px] text-faint">
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
                  className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4"
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      connected
                        ? p.color === 'amber'
                          ? 'bg-warning/10 border-warning/20'
                          : 'bg-primary/10 border-primary/20'
                        : 'bg-surface-2 border-border-strong'
                    }`}
                  >
                    <Plug className={`w-4 h-4 ${connected ? (p.color === 'amber' ? 'text-warning' : 'text-primary') : 'text-faint'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground">{p.name}</p>
                    <p className="text-[11px] text-subtle truncate">
                      {connected ? p.handle : 'Not connected'}
                    </p>
                  </div>
                  {connected ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-success shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-faint shrink-0">
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
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h3 className="text-sm font-bold text-foreground">Synced Submissions</h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-subtle">
                {syncedProblems.length} problem{syncedProblems.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={loadSyncedProblems}
                disabled={fetching}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {syncedError && (
            <QueryError title="Couldn't load synced problems" message={syncedError.message} onRetry={loadSyncedProblems} />
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <SubmissionsTable problems={syncedProblems} />
          )}
        </div>
      )}
    </div>
  );
}
