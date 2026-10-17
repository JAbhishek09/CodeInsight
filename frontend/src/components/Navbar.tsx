import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import {
  Brain, LayoutDashboard, BookOpen, Sparkles, BarChart3,
  LogOut, Settings, Menu, Download, Sun, Moon,
} from 'lucide-react';
import Sidebar from './Sidebar';
import ImportModal from './ImportModal';

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard',   Icon: LayoutDashboard },
  { path: '/problems',  label: 'Problems',    Icon: BookOpen },
  { path: '/insights',  label: 'AI Insights', Icon: Sparkles },
  { path: '/analytics', label: 'Analytics',   Icon: BarChart3 },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = (user?.name || '?')
    .split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <>
      <nav className="ci-navbar sticky top-0 z-50 h-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center h-full gap-3">

            {/* Hamburger (mobile) */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-2 ci-btn-secondary border-0 cursor-pointer transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Brain className="w-5 h-5 text-primary" />
              <span className="font-extrabold text-sm text-foreground hidden sm:block">
                CodeInsight
              </span>
            </button>

            {/* Divider */}
            <div className="hidden lg:block w-px h-5 bg-[var(--border)]" />

            {/* Nav links (desktop) */}
            <div className="hidden lg:flex items-center gap-0.5 flex-1">
              {NAV_LINKS.map(({ path, label, Icon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`ci-nav-link ${isActive(path) ? 'active' : ''}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-1.5 ml-auto">

              {/* Import CTA */}
              <button
                onClick={() => setImportOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Import
              </button>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="ci-theme-btn"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle theme"
              >
                {theme === 'dark'
                  ? <Sun className="w-3.5 h-3.5" />
                  : <Moon className="w-3.5 h-3.5" />}
              </button>

              {/* Settings */}
              <button
                onClick={() => navigate('/profile')}
                className={`ci-theme-btn ${isActive('/profile') ? '!text-primary !border-primary/20 !bg-primary/10' : ''}`}
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-[var(--border)]" />

              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-extrabold shrink-0 hidden sm:flex select-none">
                {initials}
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <Sidebar
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onImport={() => setImportOpen(true)}
      />
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
