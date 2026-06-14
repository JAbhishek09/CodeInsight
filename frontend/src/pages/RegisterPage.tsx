import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Key, Mail, Sparkles, Loader2, User, ChevronRight, ShieldAlert, Target } from 'lucide-react';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetDailySolved, setTargetDailySolved] = useState(1);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (!name || !email || !password) {
      setLocalError('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }
    try {
      setLoading(true);
      await register({ name, email, password, targetDailySolved });
      onNavigate('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[145px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[350px] h-[350px] bg-pink-600/5 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0b0e14]/90 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative z-10 p-8">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500" />

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-950/20 border border-purple-500/10 text-purple-400 text-[11px] font-mono rounded-full mb-4 tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>CodeInsight</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Account</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-2 tracking-wide uppercase">Start tracking your progress</p>
        </div>

        {(localError || error) && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{localError || error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">Full Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 font-mono transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">Email</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 font-mono transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 font-mono transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-purple-400" />
              Daily Target
            </label>
            <select
              value={targetDailySolved}
              onChange={(e) => setTargetDailySolved(Number(e.target.value))}
              className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60 font-mono transition-all cursor-pointer"
            >
              <option value={1}>1 problem / day</option>
              <option value={2}>2 problems / day</option>
              <option value={3}>3 problems / day</option>
              <option value={5}>5 problems / day</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 hover:opacity-95 disabled:opacity-50 text-white font-bold rounded-xl text-xs py-3.5 flex items-center justify-center gap-2 cursor-pointer transition-all mt-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Creating account...</span></>
            ) : (
              <><span>Create Account</span><ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-950 text-center">
          <p className="text-xs text-slate-400">Already have an account?</p>
          <button
            onClick={() => onNavigate('/login')}
            className="text-xs text-purple-400 hover:text-purple-300 font-mono font-bold mt-2 hover:underline inline-flex items-center gap-1.5"
          >
            <span>Sign in</span><ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
