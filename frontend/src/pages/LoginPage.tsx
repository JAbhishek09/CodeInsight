import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'motion/react';
import { Key, Mail, Sparkles, Loader2, BookOpen, ChevronRight, CheckCircle2, ShieldAlert } from 'lucide-react';

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
      setLocalError('Please fill in all security parameter fields');
      return;
    }

    try {
      setLoading(true);
      await login({ email, password });
      onNavigate('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Verification sequence resolved authentication failure.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden" id="login-layout">
      {/* Immersive background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-600/5 rounded-full blur-[145px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-purple-600/5 rounded-full blur-[130px] pointer-events-none" />

      {/* Main Glassmorphic Wrapper */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-[#0b0e14]/90 border border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative z-10 p-8"
        id="login-card"
      >
        {/* Subtle Decorative top gradient accent border */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
        
        {/* Header Block / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-pink-950/20 border border-pink-500/10 text-pink-400 text-[11px] font-mono rounded-full mb-4 tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>LeetLens Gateway Matrix v6.0</span>
          </div>
          
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Identity <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-[#8a76ff]">Verification</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-2 tracking-wide uppercase">
            SECURE ACCESS DECRYPT GATEWAY
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
        <form onSubmit={handleSubmit} className="space-y-5">
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
                className="w-full bg-[#05070a]/90 border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/20 font-mono transition-all"
                id="input-email"
              />
            </div>
          </div>

          {/* Password Inputs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                Authorization Phrase
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#05070a]/90 border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-pink-500/60 focus:ring-1 focus:ring-pink-500/20 font-mono transition-all"
                id="input-password"
              />
            </div>
          </div>

          {/* Access Request Trigger Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:opacity-95 text-white font-semibold rounded-xl text-xs py-3.5 shadow-lg shadow-pink-950/20 flex items-center justify-center gap-2 cursor-pointer transition-all border border-pink-400/20 mt-6 active:scale-[0.98]"
            id="login-submit-button"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>DECRYPTING PARADIGMS...</span>
              </>
            ) : (
              <>
                <span>Initialize Secure Client Session</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Card Footer / Registration Switch */}
        <div className="mt-8 pt-6 border-t border-slate-950 text-center">
          <p className="text-xs text-slate-400">
            First time initializing LeetLens trackers?
          </p>
          <button
            onClick={() => onNavigate('/register')}
            className="text-xs text-pink-400 hover:text-pink-300 font-mono font-bold mt-2 hover:underline transition-all cursor-pointer inline-flex items-center gap-1.5"
            id="register-switch"
          >
            <span>Register Secure Identity Card</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};
