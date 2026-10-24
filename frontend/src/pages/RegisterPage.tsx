import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getAuthConfig } from '../api/auth.api';
import AuthLayout, { Field, FormError, OrDivider, PasswordInput } from '@/components/auth/AuthLayout';
import GoogleButton from '@/components/auth/GoogleButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

const GOALS = [1, 2, 3, 5];

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const { register, loginWithGoogle, user, token, loading: authLoading, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [goal, setGoal] = useState(1);
  const [invite, setInvite] = useState('');
  const [inviteRequired, setInviteRequired] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  useEffect(() => {
    getAuthConfig().then((c) => {
      setInviteRequired(Boolean(c?.inviteRequired));
      setGoogleClientId(c?.googleClientId ?? null);
    }).catch(() => {});
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authLoading && token && user) return <Navigate to="/home" replace />;

  const tooShort = password.length > 0 && password.length < 6;
  const inviteField = inviteRequired ? { invite: invite.trim() } : {};

  const run = async (signUp: () => Promise<unknown>) => {
    try {
      setSubmitting(true);
      await signUp();
      onNavigate('/home');
    } catch (err) {
      setError((err as Error).message || "Couldn't create your account. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearError();
    if (password.length < 6) {
      setError('Use at least 6 characters for your password.');
      return;
    }
    run(() => register({ name: name.trim(), email: email.trim(), password, targetDailySolved: goal, ...inviteField }));
  };

  // Name and email come from Google; the invite code and daily goal from this form
  const handleGoogle = (credential: string) => {
    setError(null);
    clearError();
    if (inviteRequired && !invite.trim()) {
      setError('Enter your invite code first, then continue with Google.');
      return;
    }
    run(() => loginWithGoogle({ credential, targetDailySolved: goal, ...inviteField }));
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Learn to spot the pattern behind every problem."
      footer={<>Already have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormError message={error} />
        {inviteRequired && (
          <Field id="invite" label="Invite code" hint="From the person running the pilot.">
            <Input id="invite" required autoComplete="off" value={invite} onChange={(e) => setInvite(e.target.value)} />
          </Field>
        )}
        {googleClientId && (
          <>
            <GoogleButton clientId={googleClientId} text="signup_with" onCredential={handleGoogle} />
            <OrDivider />
          </>
        )}
        <Field id="name" label="Name">
          <Input id="name" autoComplete="name" required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
        </Field>
        <Field id="email" label="Email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field id="password" label="Password" hint={tooShort ? <span className="text-warning">At least 6 characters</span> : 'At least 6 characters'}>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" invalid={tooShort} />
        </Field>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium text-foreground">Daily goal</legend>
          <div className="grid grid-cols-4 gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoal(g)}
                aria-pressed={goal === g}
                className={cn(
                  'rounded-md border py-2 text-sm tabular-nums transition-colors',
                  goal === g ? 'border-primary bg-primary/10 font-semibold text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Problems per day. You can change this later.</p>
        </fieldset>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="animate-spin" />}
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default RegisterPage;
