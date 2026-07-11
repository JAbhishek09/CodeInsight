import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Key, Mail, Sparkles, Loader2, User, ChevronRight, ShieldAlert, Target, Activity, ChevronLeft } from 'lucide-react';

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
    <div className="min-h-screen flex w-full bg-[#07090e] text-slate-100">
      
      {/* ========================================= */}
      {/* LEFT SIDE: The Registration Form          */}
      {/* ========================================= */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative z-10">
        <div className="w-full max-w-[420px]">
          
          {/* Header */}
          <div className="mb-10 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-950/20 border border-pink-500/10 text-pink-400 text-[11px] font-mono rounded-full mb-6 tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Join CodeInsight</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              Create <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Account</span>
            </h2>
            <p className="text-xs font-mono text-slate-400 tracking-wide uppercase">
              Start tracking your progress today
            </p>
          </div>

          {/* Error Alert */}
          {(localError || error) && (
            <div className="mb-6 p-4 bg-red-950/20 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{localError || error}</p>
            </div>
          )}

          {/* Form - Changed space-y-4 to space-y-5 to match Login */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Name Input */}
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
                  className="w-full bg-[#05070a] border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/20 font-mono transition-all"
                />
              </div>
            </div>

            {/* Email Input */}
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

            {/* Password Input */}
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
                  className="w-full bg-[#05070a] border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/20 font-mono transition-all"
                />
              </div>
            </div>

            {/* Target Daily Dropdown */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-pink-400" />
                Daily Target
              </label>
              <select
                value={targetDailySolved}
                onChange={(e) => setTargetDailySolved(Number(e.target.value))}
                className="w-full bg-[#05070a] border border-slate-900 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-pink-500/60 font-mono transition-all cursor-pointer"
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
              className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:opacity-95 disabled:opacity-50 text-white font-bold rounded-xl text-xs py-3.5 flex items-center justify-center gap-2 cursor-pointer transition-all mt-4 shadow-lg shadow-pink-900/20"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Creating account...</span></>
              ) : (
                <><span>Create Account</span><ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-900 flex items-center justify-between">
            <p className="text-xs text-slate-400">Already have an account?</p>
            <button
              onClick={() => onNavigate('/login')}
              className="text-xs text-pink-400 hover:text-pink-300 font-mono font-bold hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /><span>Back to login</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* RIGHT SIDE: Product Showcase (Desktop)    */}
      {/* ========================================= */}
      <div className="hidden lg:flex w-1/2 relative bg-[#030407] border-l border-slate-900 items-center justify-center overflow-hidden">
        
        {/* Background glowing orbs matched to Login */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[140px] pointer-events-none translate-x-[-20%] translate-y-[-20%]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none translate-x-[20%] translate-y-[20%]" />
        
        <div className="relative z-10 max-w-md p-8">
          <h3 className="text-3xl font-extrabold text-white mb-4 tracking-tight">
            Build Your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">Consistency.</span>
          </h3>
          <p className="text-slate-400 text-sm font-mono leading-relaxed mb-8">
            Sync your LeetCode and Codeforces profiles. Visualize your Data Structures progress, spot your weak areas, and ace the placement season.
          </p>
          
          {/* Faux Stat Tracker Graphic */}
          <div className="w-full bg-[#0b0e14] border border-slate-800 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800/50">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-500/10 rounded-lg">
                    <Activity className="w-5 h-5 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">Weekly Activity</p>
                    <p className="text-[10px] text-slate-500 font-mono uppercase">Dynamic Programming</p>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-2xl font-black text-white">24</p>
                  <p className="text-[10px] text-emerald-400 font-mono uppercase">+3 this week</p>
               </div>
            </div>
            
            {/* Fake Activity Heatmap */}
            <div className="flex gap-1.5 flex-wrap">
              {[...Array(35)].map((_, i) => (
                <div key={i} className={`w-4 h-4 rounded-sm ${Math.random() > 0.6 ? (Math.random() > 0.5 ? 'bg-pink-500' : 'bg-purple-500') : 'bg-slate-800'}`}></div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};