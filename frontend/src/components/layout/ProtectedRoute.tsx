import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, token } = useAuth();

  // Still verifying JWT / fetching user from server
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#07090e]">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
        <p className="text-xs font-mono text-slate-400 mt-4 uppercase tracking-wider">
          Verifying session...
        </p>
      </div>
    );
  }

  // No token or user → redirect to login
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
