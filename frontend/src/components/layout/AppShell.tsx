import { Link, NavLink, useLocation } from 'react-router-dom';
import { BarChart3, BookOpen, Brain, Download, LayoutDashboard, LogOut, Moon, Network, Sun, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/context/ThemeContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/patterns', label: 'Patterns', Icon: Network },
  { to: '/problems', label: 'Problems', Icon: BookOpen },
  { to: '/analytics', label: 'Analytics', Icon: BarChart3 },
];

/** /problems/123 still highlights "Problems". */
function useIsActive() {
  const { pathname } = useLocation();
  return (to: string) => pathname === to || pathname.startsWith(`${to}/`);
}

function initialsOf(name?: string) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────

function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isActive = useIsActive();

  const item = (active: boolean) => cn(
    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
    active ? 'bg-surface-3 font-medium text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface-1 lg:flex">
      <Link to="/dashboard" className="flex h-14 items-center gap-2 px-5 text-sm font-semibold text-foreground">
        <Brain className="size-5 text-primary" aria-hidden /> CodeInsight
      </Link>

      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3 py-2">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} className={() => item(isActive(to))} aria-current={isActive(to) ? 'page' : undefined}>
            <Icon className="size-4" aria-hidden /> {label}
          </NavLink>
        ))}
        <div className="pt-4">
          <p className="px-2.5 pb-1.5 text-xs text-subtle">Data</p>
          <Link to="/profile?tab=import" className={item(false)}>
            <Download className="size-4" aria-hidden /> Import history
          </Link>
        </div>
      </nav>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Link
          to="/profile"
          className={cn('flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-surface-2', isActive('/profile') && 'bg-surface-3')}
          aria-current={isActive('/profile') ? 'page' : undefined}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary" aria-hidden>
            {initialsOf(user?.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{user?.name}</span>
            <span className="block truncate text-xs text-muted-foreground">Profile and settings</span>
          </span>
        </Link>
        <IconButton label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </IconButton>
        <IconButton label="Sign out" onClick={logout}><LogOut className="size-4" /></IconButton>
      </div>
    </aside>
  );
}

// ── Mobile top bar + bottom tabs ──────────────────────────────────────────────

function MobileBars() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isActive = useIsActive();
  const tabs = [...NAV, { to: '/profile', label: 'Profile', Icon: UserRound }];

  return (
    <>
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden">
        <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Brain className="size-5 text-primary" aria-hidden /> CodeInsight
        </Link>
        <div className="flex items-center gap-1">
          <IconButton label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
          <Link to="/profile" aria-label="Profile" className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
            {initialsOf(user?.name)}
          </Link>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {tabs.map(({ to, label, Icon }) => {
          const active = isActive(to);
          return (
            <NavLink
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px]', active ? 'text-foreground' : 'text-muted-foreground')}
            >
              <Icon className={cn('size-5', active && 'text-primary')} aria-hidden />
              {label}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

/** Signed-in layout: sidebar on desktop, top bar + bottom tabs on phones. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface-3 focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <Sidebar />
      <MobileBars />
      <main id="main" className="px-4 pb-24 pt-6 sm:px-6 lg:ml-60 lg:px-10 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-6xl page-enter">{children}</div>
      </main>
    </div>
  );
}
