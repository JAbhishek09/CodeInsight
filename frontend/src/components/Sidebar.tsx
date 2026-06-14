import { useNavigate, useLocation } from 'react-router-dom';
import { Brain, LayoutDashboard, BookOpen, User, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/problems',  label: 'Problems',  Icon: BookOpen },
  { path: '/profile',   label: 'Profile',   Icon: User },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
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
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {NAV_LINKS.map(({ path, label, Icon }) => (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono transition-colors ${
                location.pathname === path
                  ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}
