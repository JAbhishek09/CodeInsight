import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getAuthConfig } from '../api/auth.api';
import AuthLayout, { Field, FormError, OrDivider, PasswordInput } from '@/components/auth/AuthLayout';
import GoogleButton from '@/components/auth/GoogleButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

/** Where to go after signing in: the page that sent us here, else Home. */
function useReturnPath() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('/login') ? from : '/home';
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, loginWithGoogle, user, token, loading: authLoading, clearError } = useAuth();
  const returnTo = useReturnPath();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  useEffect(() => { getAuthConfig().then((c) => setGoogleClientId(c?.googleClientId ?? null)).catch(() => {}); }, []);

  // Already signed in — nothing to do here.
  if (!authLoading && token && user) return <Navigate to={returnTo} replace />;

  const run = async (signIn: () => Promise<unknown>, fallback: string) => {
    setError(null);
    clearError();
    try {
      setSubmitting(true);
      await signIn();
      onNavigate(returnTo);
    } catch (err) {
      setError((err as Error).message || fallback);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => login({ email: email.trim(), password }), "Couldn't sign you in. Try again.");
  };
  const handleGoogle = (credential: string) =>
    run(() => loginWithGoogle({ credential }), "Couldn't sign you in with Google. Try again.");

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      footer={<>New to CodeInsight? <Link to="/register" className="font-medium text-primary hover:underline">Create an account</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
        <FormError message={error} />
        {googleClientId && (
          <>
            <GoogleButton clientId={googleClientId} text="signin_with" onCredential={handleGoogle} />
            <OrDivider />
          </>
        )}
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
