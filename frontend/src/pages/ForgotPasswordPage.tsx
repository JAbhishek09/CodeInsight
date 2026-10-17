import React, { useState } from 'react';
import { Mail, ArrowRight, CheckCircle2, ShieldAlert, ChevronLeft } from 'lucide-react';
import { requestPasswordReset } from '../api/auth.api'; // Ensure this matches your API file path!
import { useNavigate } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) return;

    try {
      setLoading(true);
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-2xl">
        <button 
          onClick={() => navigate('/login')}
          className="text-xs text-subtle hover:text-muted-foreground flex items-center gap-1 mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back to login
        </button>

        <h2 className="text-2xl font-extrabold text-foreground mb-2">Reset your password</h2>
        
        {success ? (
          <div className="bg-success/10 border border-success/20 rounded-xl p-6 text-center mt-6">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
            <p className="text-sm text-success font-medium">Check your inbox!</p>
            <p className="text-xs text-muted-foreground mt-2">
              We have sent a password reset link to <strong className="text-foreground">{email}</strong>. The link will expire in 15 minutes.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Enter the email address associated with your CodeInsight account, and we will send you a secure link to reset your password.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl flex items-start gap-3 text-danger">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-subtle">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-surface-2 border border-border rounded-xl pl-11 pr-4 py-3 text-xs text-foreground focus:border-primary/60 focus:ring-1 focus:ring-ring/20 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 font-bold rounded-xl text-xs py-3.5 flex items-center justify-center gap-2 transition-all mt-2"
              >
                {loading ? 'Sending link...' : 'Send Reset Link'} <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}