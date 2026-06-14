import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Key, Mail, Sparkles, Loader2, ChevronRight, ShieldAlert } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (!email || !password) {
      setLocalError('Please fill in all fields');
      return;
    }
    try {
      setLoading(true);
      await login({ email, password });
      onNavigate('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-600/5 rounded-full blur-[145px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-purple-600/5 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md bg-[#0b0e14]/90 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative z-10 p-8">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-950/20 border border-pink-500/10 text-pink-400 text-[11px] font-mono rounded-full mb-4 tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>CodeInsight</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Back</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-2 tracking-wide uppercase">Sign in to your account</p>
        </div>

        {(localError || error) && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">{localError || error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/20 font-mono transition-all"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/20 font-mono transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:opacity-95 disabled:opacity-50 text-white font-bold rounded-xl text-xs py-3.5 flex items-center justify-center gap-2 cursor-pointer transition-all mt-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /><span>Signing in...</span></>
            ) : (
              <><span>Sign In</span><ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-950 text-center">
          <p className="text-xs text-slate-400">Don't have an account?</p>
          <button
            onClick={() => onNavigate('/register')}
            className="text-xs text-pink-400 hover:text-pink-300 font-mono font-bold mt-2 hover:underline inline-flex items-center gap-1.5"
          >
            <span>Create account</span><ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
