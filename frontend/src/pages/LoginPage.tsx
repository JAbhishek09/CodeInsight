import React, { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AuthLayout, { Field, FormError, PasswordInput } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

/** Where to go after signing in: the page that sent us here, else the dashboard. */
function useReturnPath() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('/login') ? from : '/dashboard';
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, user, token, loading: authLoading, clearError } = useAuth();
  const returnTo = useReturnPath();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in — nothing to do here.
  if (!authLoading && token && user) return <Navigate to={returnTo} replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearError();
    try {
      setSubmitting(true);
      await login({ email: email.trim(), password });
      onNavigate(returnTo);
    } catch (err) {
      setError((err as Error).message || "Couldn't sign you in. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      footer={<>New to CodeInsight? <Link to="/register" className="font-medium text-primary hover:underline">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
        <FormError message={error} />
        <Field id="email" label="Email">
          <Input id="email" type="email" autoComplete="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-invalid={!!error || undefined} />
        </Field>
        <Field
          id="password"
          label="Password"
          aside={<Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot password?</Link>}
        >
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" invalid={!!error} />
        </Field>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;
