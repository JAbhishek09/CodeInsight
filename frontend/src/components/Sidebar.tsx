import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Brain, LayoutDashboard, BookOpen, BarChart3, Sparkles, Settings, X, Download } from 'lucide-react';
import ImportModal from './ImportModal';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard',   Icon: LayoutDashboard },
  { path: '/problems',  label: 'Problems',    Icon: BookOpen },
  { path: '/insights',  label: 'AI Insights', Icon: Sparkles },
  { path: '/analytics', label: 'Analytics',   Icon: BarChart3 },
  { path: '/profile',   label: 'Settings',    Icon: Settings },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [importOpen, setImportOpen] = useState(false);

  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[#07090e]/80 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />
      {/* Drawer */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-[#0b0e14] border-r border-slate-900 flex flex-col lg:hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-950">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-pink-400" />
            <span className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">
              CodeInsight
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_LINKS.map(({ path, label, Icon }) => (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                location.pathname === path
                  ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Import button — prominently at the bottom of the mobile drawer */}
        <div className="p-4 border-t border-slate-950">
          <button
            onClick={() => { onClose(); setImportOpen(true); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Import LeetCode History
          </button>
        </div>
      </aside>

      {/* ImportModal — rendered outside the drawer so it survives onClose */}
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
