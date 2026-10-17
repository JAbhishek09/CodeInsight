import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, token } = useAuth();
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

  // No token or user → sign in, then come back here
  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
