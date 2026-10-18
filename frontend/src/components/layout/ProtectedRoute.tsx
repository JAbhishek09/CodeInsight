import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const RETRY_MS = 15_000;

/**
 * The server couldn't check the session (restarting, offline, waking from
 * sleep). The token is still valid as far as we know, so offer a retry —
 * and retry by itself — instead of sending the user to sign in again.
 */
function CantReach() {
  const { retrySession, logout } = useAuth();

  useEffect(() => {
    const retry = () => { retrySession(); };
    const t = setInterval(retry, RETRY_MS);
    window.addEventListener('online', retry);
    return () => { clearInterval(t); window.removeEventListener('online', retry); };
  }, [retrySession]);

  return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <WifiOff className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">Can’t reach CodeInsight</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          You’re still signed in. The server didn’t answer — it may be restarting. We’ll keep trying.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => retrySession()}><RefreshCw /> Try again</Button>
        <Button variant="ghost" onClick={logout}>Sign out</Button>
      </div>
    </div>
  );
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, token, sessionError } = useAuth();
  const location = useLocation();

  // Still verifying JWT / fetching user from server
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-4 uppercase tracking-wider">
          Verifying session...
        </p>
      </div>
    );
  }

  // Signed in, but the session check couldn't reach the server
  if (token && !user && sessionError) return <CantReach />;

  // No token or user → sign in, then come back here
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
