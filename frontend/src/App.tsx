import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AppShell from './components/layout/AppShell';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';

// Signed-in pages load on demand so the sign-in screen (and each page) ships
// only the code it needs — the charts library is the bulk of it.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProblemsPage = lazy(() => import('./pages/ProblemsPage').then((m) => ({ default: m.ProblemsPage })));
const ProblemPage = lazy(() => import('./pages/ProblemPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

// Old /analysis/:id links now live on the problem page's AI analysis tab.
function AnalysisRedirect() {
  const { problemId } = useParams<{ problemId: string }>();
  return <Navigate to={`/problems/${problemId}?tab=analysis`} replace />;
}

// Signed-in pages share the app shell (sidebar / mobile tabs).
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-surface-1" aria-busy="true" aria-label="Loading page" />}>
        {children}
      </Suspense>
    </AppShell>
  );
}

// Auth pages (no Navbar) — still respect theme
function LoginPageWrapper() {
  const navigate = useNavigate();
  return <LoginPage onNavigate={navigate} />;
}
function RegisterPageWrapper() {
  const navigate = useNavigate();
  return <RegisterPage onNavigate={navigate} />;
}
function DashboardWrapper() {
  const navigate = useNavigate();
  return (
    <AuthLayout>
      <DashboardPage onNavigate={navigate} onOpenNewProblem={() => navigate('/problems?new=1')} />
    </AuthLayout>
  );
}
function ProblemsWrapper() {
  const navigate = useNavigate();
  return <AuthLayout><ProblemsPage onNavigate={navigate} /></AuthLayout>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ThemeProvider>
        <TooltipProvider delayDuration={200}>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<LoginPageWrapper />} />
            <Route path="/register" element={<RegisterPageWrapper />} />
  
  {/* NEW Reset Routes */}
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
  <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected */}
            <Route path="/dashboard"
              element={<ProtectedRoute><DashboardWrapper /></ProtectedRoute>} />
            <Route path="/problems"
              element={<ProtectedRoute><ProblemsWrapper /></ProtectedRoute>} />
            <Route path="/problems/:problemId"
              element={<ProtectedRoute><AuthLayout><ProblemPage /></AuthLayout></ProtectedRoute>} />
            <Route path="/profile"
              element={<ProtectedRoute><AuthLayout><ProfilePage /></AuthLayout></ProtectedRoute>} />
            <Route path="/insights"
              element={<Navigate to="/analytics?tab=ai" replace />} />
            <Route path="/analytics"
              element={<ProtectedRoute><AuthLayout><AnalyticsPage /></AuthLayout></ProtectedRoute>} />
            <Route path="/analysis/:problemId"
              element={<AnalysisRedirect />} />

            {/* Fallbacks */}
            <Route path="/"  element={<Navigate to="/login" replace />} />
            <Route path="*"  element={<Navigate to="/login" replace />} />
          </Routes>
          <Toaster position="bottom-right" />
        </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
    </QueryClientProvider>
  );
}
