import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MailCheck } from 'lucide-react';
import { requestPasswordReset } from '../api/auth.api';
import AuthLayout, { Field, FormError } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setSubmitting(true);
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError((err as Error).message || "Couldn't send the reset email. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const footer = <Link to="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>;

  if (sent) {
    return (
      <AuthLayout title="Check your email" footer={footer}>
        <div className="flex gap-3 rounded-md border border-success/30 bg-success/5 p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground">
            If an account exists for <span className="font-medium">{email.trim()}</span>, we've sent a link to reset
            your password. It expires in 15 minutes.
          </p>
        </div>
        <Button variant="outline" className="mt-4 w-full" onClick={() => setSent(false)}>Use a different email</Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send you a reset link." footer={footer}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        <Field id="email" label="Email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  );
}
