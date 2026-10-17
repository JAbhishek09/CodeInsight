import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProblemsPage } from './pages/ProblemsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage'; 
// (Adjust the path if you saved them in a different folder!)
import ProfilePage from './pages/ProfilePage';
import ProblemPage from './pages/ProblemPage';
import AnalyticsPage from './pages/AnalyticsPage';
import Navbar from './components/Navbar';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/sonner';

// Old /analysis/:id links now live on the problem page's AI analysis tab.
function AnalysisRedirect() {
  const { problemId } = useParams<{ problemId: string }>();
  return <Navigate to={`/problems/${problemId}?tab=analysis`} replace />;
}

// Shared authenticated shell — uses CSS vars so it adapts to dark/light mode.
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
        {children}
      </main>
    </div>
  );
}

// Auth pages (no Navbar) — still respect theme
function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center transition-colors duration-200">
      {children}
    </div>
  );
}

function LoginPageWrapper() {
  const navigate = useNavigate();
  return <AuthPageShell><LoginPage onNavigate={navigate} /></AuthPageShell>;
}
function RegisterPageWrapper() {
  const navigate = useNavigate();
  return <AuthPageShell><RegisterPage onNavigate={navigate} /></AuthPageShell>;
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
