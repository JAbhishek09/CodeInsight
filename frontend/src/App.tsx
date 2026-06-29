import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProblemsPage } from './pages/ProblemsPage';
import ProfilePage from './pages/ProfilePage';
import AnalysisPage from './pages/AnalysisPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import InsightsPage from './pages/InsightsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import Navbar from './components/Navbar';

// Shared authenticated shell — uses CSS vars so it adapts to dark/light mode.
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app text-primary transition-colors duration-200">
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
    <div className="min-h-screen bg-app text-primary flex items-center justify-center transition-colors duration-200">
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
      <DashboardPage onNavigate={navigate} onOpenNewProblem={() => navigate('/problems')} />
    </AuthLayout>
  );
}
function ProblemsWrapper() {
  const navigate = useNavigate();
  return <AuthLayout><ProblemsPage onNavigate={navigate} /></AuthLayout>;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ThemeProvider>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<LoginPageWrapper />} />
            <Route path="/register" element={<RegisterPageWrapper />} />

            {/* Protected */}
            <Route path="/dashboard"
              element={<ProtectedRoute><DashboardWrapper /></ProtectedRoute>} />
            <Route path="/problems"
              element={<ProtectedRoute><ProblemsWrapper /></ProtectedRoute>} />
            <Route path="/problems/:problemId"
              element={<ProtectedRoute><AuthLayout><ProblemDetailPage /></AuthLayout></ProtectedRoute>} />
            <Route path="/profile"
              element={<ProtectedRoute><AuthLayout><ProfilePage /></AuthLayout></ProtectedRoute>} />
            <Route path="/insights"
              element={<ProtectedRoute><AuthLayout><InsightsPage /></AuthLayout></ProtectedRoute>} />
            <Route path="/analytics"
              element={<ProtectedRoute><AuthLayout><AnalyticsPage /></AuthLayout></ProtectedRoute>} />
            <Route path="/analysis/:problemId"
              element={<ProtectedRoute><AuthLayout><AnalysisPage /></AuthLayout></ProtectedRoute>} />

            {/* Fallbacks */}
            <Route path="/"  element={<Navigate to="/login" replace />} />
            <Route path="*"  element={<Navigate to="/login" replace />} />
          </Routes>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
