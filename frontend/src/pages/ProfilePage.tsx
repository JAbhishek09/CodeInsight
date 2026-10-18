import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Link2, Loader2, LogOut, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useAnalytics } from '../hooks/useAnalytics';
import { updateProfile } from '../api/auth.api';
import ProfileInput from '../components/ProfileInput';
import HistoryImport from '../components/HistoryImport';
import ExtensionSetup from '../components/ExtensionSetup';
import { useToday } from '../hooks/usePractice';
import { Panel } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';

const TABS = ['account', 'connections', 'import'] as const;
type Tab = (typeof TABS)[number];
const GOALS = [1, 2, 3, 5, 8, 10];

// ── Account ───────────────────────────────────────────────────────────────────

function AccountTab() {
  const { user, refreshUser, logout } = useAuth();
  const qc = useQueryClient();
  const summary = useAnalytics('all');
  const [name, setName] = useState(user?.name ?? '');
  const [goal, setGoal] = useState(user?.targetDailySolved ?? 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
    setGoal(user?.targetDailySolved ?? 1);
  }, [user?.name, user?.targetDailySolved]);

  const dirty = name.trim() !== (user?.name ?? '') || goal !== (user?.targetDailySolved ?? 1);
  const nameInvalid = !name.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInvalid) return;
    try {
      setSaving(true);
      await updateProfile({ name: name.trim(), targetDailySolved: goal });
      await refreshUser();
      qc.invalidateQueries({ queryKey: ['analytics'] }); // daily goal lives in the summary
      toast.success('Profile saved');
    } catch (err) {
      toast.error(`Couldn't save: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const s = summary.data;
  return (
    <div className="space-y-4">
      <Panel title="Profile">
        <form onSubmit={save} className="max-w-md space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="profile-name" className="text-sm font-medium text-foreground">Name</label>
            <Input id="profile-name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} aria-invalid={nameInvalid || undefined} />
            {nameInvalid && <p className="text-xs text-warning">Enter your name</p>}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Email</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">Daily goal</legend>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  aria-pressed={goal === g}
                  className={cn(
                    'min-w-10 rounded-md border px-3 py-1.5 text-sm tabular-nums transition-colors',
                    goal === g ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Problems to solve per day — drives the Today tile in Analytics.</p>
          </fieldset>
          <Button type="submit" size="sm" disabled={!dirty || saving || nameInvalid}>
            {saving && <Loader2 className="animate-spin" />} Save changes
          </Button>
        </form>
      </Panel>

      <Panel title="Your practice">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Member since', user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '—'],
            ['Problems solved', s ? s.totals.solved.toLocaleString() : '—'],
            ['Longest streak', s ? `${s.streak.longest} days` : '—'],
            ['AI reviews', s ? s.totals.aiAnalyzed.toLocaleString() : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="Session">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Sign out of CodeInsight on this device.</p>
          <Button variant="outline" size="sm" onClick={logout}><LogOut /> Sign out</Button>
        </div>
      </Panel>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'account';
  const setTab = (t: string) => setParams((p) => { if (t === 'account') p.delete('tab'); else p.set('tab', t); return p; }, { replace: true });

  const handleSyncComplete = () => {
    refreshUser();
    qc.invalidateQueries({ queryKey: ['problems'] });
    qc.invalidateQueries({ queryKey: ['analytics'] });
  };

  const today = useToday();
  const { hash } = useLocation();
  // /profile?tab=connections#extension → scroll to the extension steps
  useEffect(() => {
    if (hash !== '#extension') return;
    const t = setTimeout(() => document.getElementById('extension')?.scrollIntoView({ block: 'start' }), 300);
    return () => clearTimeout(t);
  }, [hash, tab]);
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-6" id="profile-page">
      <div className="flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary" aria-hidden>
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{user?.name}</h1>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" className="w-full justify-start gap-4 border-b border-border">
          <TabsTrigger value="account" className="flex-none"><UserRound /> Account</TabsTrigger>
          <TabsTrigger value="connections" className="flex-none"><Link2 /> Connections</TabsTrigger>
          <TabsTrigger value="import" className="flex-none"><Download /> Import</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="pt-4"><AccountTab /></TabsContent>

        <TabsContent value="connections" className="space-y-4 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: 'LeetCode', handle: user?.leetcodeHandle, url: (h: string) => `https://leetcode.com/u/${h}/` },
              { name: 'Codeforces', handle: user?.codeforcesHandle, url: (h: string) => `https://codeforces.com/profile/${h}` },
            ].map((p) => (
              <div key={p.name} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  {p.handle
                    ? <a href={p.url(p.handle)} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-xs text-muted-foreground hover:text-foreground">{p.handle}</a>
                    : <p className="text-xs text-subtle">Not connected</p>}
                </div>
                <span className={cn('inline-flex items-center gap-1.5 text-xs', p.handle ? 'text-success' : 'text-subtle')}>
                  <span className={cn('size-1.5 rounded-full', p.handle ? 'bg-success' : 'bg-subtle')} aria-hidden />
                  {p.handle ? 'Connected' : 'Off'}
                </span>
              </div>
            ))}
          </div>
          <Panel title="Usernames">
            <ProfileInput
              initialLeetcode={user?.leetcodeHandle}
              initialCodeforces={user?.codeforcesHandle}
              onSyncComplete={handleSyncComplete}
            />
          </Panel>
          {user?.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">Last synced {relativeTime(user.lastSyncedAt)}</p>
          )}
          <Panel title="Browser extension">
            <ExtensionSetup connected={today.data?.onboarding.extension} />
          </Panel>
        </TabsContent>

        <TabsContent value="import" className="pt-4">
          {user?.leetcodeHandle ? (
            <HistoryImport
              historyImportStatus={user.historyImportStatus ?? 'none'}
              historyImportCount={user.historyImportCount ?? 0}
              lastHistoryImportAt={user.lastHistoryImportAt ?? null}
              onImportComplete={handleSyncComplete}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-semibold text-foreground">Connect your LeetCode account first</p>
              <p className="max-w-sm text-sm text-muted-foreground">Add your LeetCode username, then import your full history here.</p>
              <Button size="sm" variant="outline" onClick={() => setTab('connections')}>Go to connections</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
