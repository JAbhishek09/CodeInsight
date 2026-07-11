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
              className="lg:hidden p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface ci-btn-secondary border-0 cursor-pointer transition-colors"
              aria-label="Open navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Brain className="w-5 h-5 text-pink-400" />
              <span className="font-extrabold text-sm text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 hidden sm:block">
                CodeInsight
              </span>
            </button>

            {/* Divider */}
            <div className="hidden lg:block w-px h-5 bg-[var(--ci-border)]" />

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
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
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
                className={`ci-theme-btn ${isActive('/profile') ? '!text-pink-400 !border-pink-500/20 !bg-pink-500/10' : ''}`}
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-[var(--ci-border)]" />

              {/* Avatar */}
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-extrabold shrink-0 hidden sm:flex select-none">
                {initials}
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-mono text-[var(--ci-text-muted)] hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <Sidebar isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
