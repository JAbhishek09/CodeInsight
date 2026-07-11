import React, { useState } from 'react';
import { Key, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { submitNewPassword } from '../api/auth.api'; // Ensure this matches your API file path!

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token'); 
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Security check: If they just typed the URL without a token, don't show the form!
  if (!token) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center p-4">
        <div className="max-w-md text-center p-8 bg-red-950/10 border border-red-500/20 rounded-2xl">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Invalid or Missing Token</h2>
          <p className="text-sm text-slate-400 mb-6">Please request a new password reset link.</p>
          <button onClick={() => navigate('/forgot-password')} className="text-xs text-pink-400 hover:underline">Request new link</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);
      await submitNewPassword(token, newPassword);
      setSuccess(true);
      // Give them 3 seconds to read the success message, then auto-redirect to login
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'This reset link has expired or is invalid. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0b0e14] border border-slate-900 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative top border */}
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-emerald-500 to-cyan-500" />

        <h2 className="text-2xl font-extrabold text-white mb-2 mt-2">Create new password</h2>
        <p className="text-xs text-slate-400 mb-6">Your new password must be different from previous used passwords.</p>

        {success ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Password Updated!</h3>
            <p className="text-xs text-slate-400">Redirecting you to the login page...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-950/20 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">New Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#05070a] border border-slate-900 rounded-xl pl-11 pr-4 py-3 text-xs text-slate-200 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-95 text-white disabled:opacity-50 font-bold rounded-xl text-xs py-3.5 flex items-center justify-center gap-2 transition-all mt-4"
            >
              {loading ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}