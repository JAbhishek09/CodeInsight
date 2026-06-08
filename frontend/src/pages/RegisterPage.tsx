import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'motion/react';
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
      setLocalError('Please populate all credential requirements');
      return;
    }

    if (password.length < 6) {
      setLocalError('Secure encryption requires passwords of 6+ characters');
      return;
    }

    try {
      setLoading(true);
      await register({
        name,
        email,
        password,
        targetDailySolved
      });
      onNavigate('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Identity declaration sequence failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden" id="register-layout">
      {/* Immersive background glow effects */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[145px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[350px] h-[350px] bg-pink-600/5 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Glassmorphic Wrapper */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-[#0b0e14]/90 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative z-10 p-8"
        id="register-card"
      >
        {/* Subtle Decorative top gradient accent border */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500" />
        
        {/* Header Block / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-950/20 border border-purple-500/10 text-purple-400 text-[11px] font-mono rounded-full mb-4 tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>LeetLens Gateway Matrix v6.0</span>
          </div>
          
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Register <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-[#ec4899]">Identity</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-2 tracking-wide uppercase">
            DECLARE PRIMARY WORKSPACE TOKEN
          </p>
        </div>

        {/* Global Error Notice Board */}
        {(localError || error) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-red-950/20 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400"
            id="error-banner"
          >
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider">Access Intercepted</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {localError || error}
              </p>
            </div>
          </motion.div>
        )}

        {/* Form Block */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
              Full Name Token
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Abhishek J."
                className="w-full bg-[#05070a]/90 border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 font-mono transition-all"
                id="input-name"
              />
            </div>
          </div>

          {/* Email Inputs */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
              Email Parameter Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@leetlens.com"
                className="w-full bg-[#05070a]/90 border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 font-mono transition-all"
                id="input-email"
              />
            </div>
          </div>

          {/* Password Inputs */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
              Authorization Keyphrase
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                placeholder="••••••••••••"
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#05070a]/90 border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 font-mono transition-all"
                id="input-password"
              />
            </div>
          </div>

          {/* Target Daily Solved Choice */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-purple-400" />
              <span>Target Daily Solved Metrics</span>
            </label>
            <select
              value={targetDailySolved}
              onChange={(e) => setTargetDailySolved(Number(e.target.value))}
              className="w-full bg-[#05070a]/90 border border-slate-900 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-purple-500/60 font-mono transition-all cursor-pointer"
              id="input-target"
            >
              <option value={1}>1 Coding Problem / Day</option>
              <option value={2}>2 Coding Problems / Day</option>
              <option value={3}>3 Coding Problems / Day</option>
              <option value={5}>5 Coding Problems / Day</option>
            </select>
          </div>

          {/* Register Action Trigger Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 hover:opacity-95 text-white font-semibold rounded-xl text-xs py-3.5 shadow-lg shadow-purple-950/20 flex items-center justify-center gap-2 cursor-pointer transition-all border border-purple-400/20 mt-6 active:scale-[0.98]"
            id="register-submit-button"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>SAVING QUANTUM CREDENTIALS...</span>
              </>
            ) : (
              <>
                <span>Commit Registry & Decrypt System</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Card Footer / Login Switch */}
        <div className="mt-8 pt-6 border-t border-slate-950 text-center">
          <p className="text-xs text-slate-400">
            Already verified your LeetLens workspace token?
          </p>
          <button
            onClick={() => onNavigate('/login')}
            className="text-xs text-purple-400 hover:text-purple-300 font-mono font-bold mt-2 hover:underline transition-all cursor-pointer inline-flex items-center gap-1.5"
            id="login-switch"
          >
            <span>Decrypt Credentials Keycard</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
