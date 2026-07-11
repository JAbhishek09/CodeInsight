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
    <div className="min-h-screen flex w-full bg-[#07090e] text-slate-100">
      
      {/* ========================================= */}
      {/* LEFT SIDE: The Authentication Form        */}
      {/* ========================================= */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative z-10">
        <div className="w-full max-w-[420px]">
          
          {/* Header */}
          <div className="mb-10 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-950/20 border border-pink-500/10 text-pink-400 text-[11px] font-mono rounded-full mb-6 tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>CodeInsight</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              Welcome <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Back</span>
            </h2>
            <p className="text-xs font-mono text-slate-400 tracking-wide uppercase">
              Sign in to continue your progress
            </p>
          </div>

          {/* Error Alert */}
          {(localError || error) && (
            <div className="mb-6 p-4 bg-red-950/20 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{localError || error}</p>
            </div>
          )}

          {/* Form */}
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
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/forgot-password')}
                  className="text-[10px] font-mono text-slate-500 hover:text-pink-400 hover:underline transition-all cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:opacity-95 disabled:opacity-50 text-white font-bold rounded-xl text-xs py-3.5 flex items-center justify-center gap-2 cursor-pointer transition-all mt-4 shadow-lg shadow-pink-900/20"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Signing in...</span></>
              ) : (
                <><span>Sign In</span><ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-900 flex items-center justify-between">
            <p className="text-xs text-slate-400">Don't have an account?</p>
            <button
              onClick={() => onNavigate('/register')}
              className="text-xs text-pink-400 hover:text-pink-300 font-mono font-bold hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Create account</span><ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* RIGHT SIDE: Product Showcase (Desktop)    */}
      {/* ========================================= */}
      <div className="hidden lg:flex w-1/2 relative bg-[#030407] border-l border-slate-900 items-center justify-center overflow-hidden">
        
        {/* Background glowing orbs */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[140px] pointer-events-none translate-x-[-20%] translate-y-[-20%]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none translate-x-[20%] translate-y-[20%]" />
        
        <div className="relative z-10 max-w-md p-8">
          <h3 className="text-3xl font-extrabold text-white mb-4 tracking-tight">
            Master Your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Algorithms.</span>
          </h3>
          <p className="text-slate-400 text-sm font-mono leading-relaxed mb-8">
            Track your LeetCode journey, analyze complexity with AI, and dominate your next technical interview at companies like Goldman Sachs.
          </p>
          
          {/* Faux Code Terminal Graphic */}
          <div className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl p-5 shadow-2xl">
            <div className="flex gap-1.5 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
            </div>
            <div className="font-mono text-[11px] leading-loose">
              <p className="text-slate-500">// Initialize interview prep sequence</p>
              <p><span className="text-pink-400">const</span> <span className="text-blue-300">targetCompany</span> <span className="text-pink-400">=</span> <span className="text-emerald-300">"Goldman Sachs"</span>;</p>
              <p><span className="text-pink-400">const</span> <span className="text-blue-300">streak</span> <span className="text-pink-400">=</span> <span className="text-purple-400">await</span> <span className="text-amber-200">fetchConsistency</span>();</p>
              <br/>
              <p className="text-slate-500">// Consistency is key</p>
              <p><span className="text-pink-400">if</span> (streak {'>'} <span className="text-orange-400">0</span>) {'{'}</p>
              <p className="pl-4"><span className="text-amber-200">keepGrinding</span>();</p>
              <p>{'}'}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );}
