import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { submitNewPassword } from '../api/auth.api';
import AuthLayout, { Field, FormError, PasswordInput } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After success, go to sign in — and don't fire if the user already left.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate('/login'), 3000);
    return () => clearTimeout(t);
  }, [done, navigate]);

  const footer = <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>;

  if (!token) {
    return (
      <AuthLayout title="This link isn't valid" subtitle="The reset link is missing its token. Request a new one." footer={footer}>
        <Button asChild className="w-full"><Link to="/forgot-password">Request a new link</Link></Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" footer={footer}>
        <div className="flex gap-3 rounded-md border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p className="text-sm text-foreground">You can now sign in with your new password. Taking you there…</p>
        </div>
      </AuthLayout>
    );
  }

  const mismatch = confirm.length > 0 && confirm !== password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Use at least 6 characters.'); return; }
    if (password !== confirm) { setError("The passwords don't match."); return; }
    try {
      setSubmitting(true);
      await submitNewPassword(token, password);
      setDone(true);
    } catch (err) {
      setError((err as Error).message || 'This link has expired or is invalid. Request a new one.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Choose a new password" footer={footer}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <Field id="password" label="New password" hint="At least 6 characters">
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" />
        </Field>
        <Field id="confirm" label="Confirm password" hint={mismatch ? <span className="text-warning">Doesn't match yet</span> : undefined}>
          <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={mismatch} />
        </Field>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? 'Saving…' : 'Set new password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
