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
    <div className="min-h-screen flex w-full bg-background text-foreground">
      
      {/* ========================================= */}
      {/* LEFT SIDE: The Authentication Form        */}
      {/* ========================================= */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative z-10">
        <div className="w-full max-w-[420px]">
          
          {/* Header */}
          <div className="mb-10 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/15 text-primary text-[11px] rounded-full mb-6 tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>CodeInsight</span>
            </div>
            <h2 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">
              Welcome <span className="text-foreground">Back</span>
            </h2>
            <p className="text-xs text-muted-foreground tracking-wide uppercase">
              Sign in to continue your progress
            </p>
          </div>

          {/* Error Alert */}
          {(localError || error) && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-3 text-danger">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{localError || error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">Email</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-subtle">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-surface-2 border border-border rounded-xl pl-11 pr-4 py-3 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-ring/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-subtle">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-2 border border-border rounded-xl pl-11 pr-4 py-3 text-xs text-foreground placeholder:text-subtle focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-ring/20 transition-all"
                />
              </div>
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/forgot-password')}
                  className="text-[10px] text-subtle hover:text-primary hover:underline transition-all cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:opacity-95 disabled:opacity-50 text-primary-foreground font-bold rounded-xl text-xs py-3.5 flex items-center justify-center gap-2 cursor-pointer transition-all mt-4 shadow-lg"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Signing in...</span></>
              ) : (
                <><span>Sign In</span><ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Don't have an account?</p>
            <button
              onClick={() => onNavigate('/register')}
              className="text-xs text-primary hover:text-primary font-bold hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Create account</span><ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* RIGHT SIDE: Product Showcase (Desktop)    */}
      {/* ========================================= */}
      <div className="hidden lg:flex w-1/2 relative bg-surface-2 border-l border-border items-center justify-center overflow-hidden">
        
        {/* Background glowing orbs */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none translate-x-[-20%] translate-y-[-20%]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[140px] pointer-events-none translate-x-[20%] translate-y-[20%]" />
        
        <div className="relative z-10 max-w-md p-8">
          <h3 className="text-3xl font-extrabold text-foreground mb-4 tracking-tight">
            Master Your <br/>
            <span className="text-foreground">Algorithms.</span>
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed mb-8">
            Track your LeetCode journey, analyze complexity with AI, and dominate your next technical interview at companies like Goldman Sachs.
          </p>
          
          {/* Faux Code Terminal Graphic */}
          <div className="w-full bg-card border border-border-strong rounded-xl p-5 shadow-2xl">
            <div className="flex gap-1.5 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-surface-3"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-surface-3"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-surface-3"></div>
            </div>
            <div className="text-[11px] leading-loose">
              <p className="text-subtle">// Initialize interview prep sequence</p>
              <p><span className="text-primary">const</span> <span className="text-primary">targetCompany</span> <span className="text-primary">=</span> <span className="text-success">"Goldman Sachs"</span>;</p>
              <p><span className="text-primary">const</span> <span className="text-primary">streak</span> <span className="text-primary">=</span> <span className="text-primary">await</span> <span className="text-warning">fetchConsistency</span>();</p>
              <br/>
              <p className="text-subtle">// Consistency is key</p>
              <p><span className="text-primary">if</span> (streak {'>'} <span className="text-warning">0</span>) {'{'}</p>
              <p className="pl-4"><span className="text-warning">keepGrinding</span>();</p>
              <p>{'}'}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );}
