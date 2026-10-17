import { useNavigate, useLocation } from 'react-router-dom';
import { Brain, LayoutDashboard, BookOpen, BarChart3, Sparkles, Settings, X, Download } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens the ImportModal owned by the parent (so it survives this drawer unmounting) */
  onImport: () => void;
}

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard',   Icon: LayoutDashboard },
  { path: '/problems',  label: 'Problems',    Icon: BookOpen },
  { path: '/insights',  label: 'AI Insights', Icon: Sparkles },
  { path: '/analytics', label: 'Analytics',   Icon: BarChart3 },
  { path: '/profile',   label: 'Settings',    Icon: Settings },
];

export default function Sidebar({ isOpen, onClose, onImport }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col lg:hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="text-sm font-extrabold text-foreground">
              CodeInsight
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-subtle hover:text-foreground hover:bg-surface-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_LINKS.map(({ path, label, Icon }) => (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs  transition-colors cursor-pointer ${
                location.pathname === path
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-2 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Import button — prominently at the bottom of the mobile drawer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={() => { onClose(); onImport(); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Import LeetCode History
          </button>
        </div>
      </aside>
    </>
  );
}
