import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProblemsPage } from './pages/ProblemsPage';
import ProfilePage from './pages/ProfilePage';
import AnalysisPage from './pages/AnalysisPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import Navbar from './components/Navbar';


// Layout wrapper for all authenticated pages
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

// Wrapper components that bridge onNavigate prop → useNavigate hook
function LoginPageWrapper() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#07090e]">
      <LoginPage onNavigate={navigate} />
    </div>
  );
}

function RegisterPageWrapper() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#07090e]">
      <RegisterPage onNavigate={navigate} />
    </div>
  );
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
  return (
    <AuthLayout>
      <ProblemsPage onNavigate={navigate} />
    </AuthLayout>
  );
}

export default function App() {
  return (
    // BrowserRouter with v7 future flags to silence migration warnings
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {/* AuthProvider must be inside BrowserRouter so useNavigate works inside context callbacks */}
      <AuthProvider>
        <Routes>
          {/* ── Public routes ─────────────────────────────── */}
          <Route path="/login"    element={<LoginPageWrapper />} />
          <Route path="/register" element={<RegisterPageWrapper />} />

          {/* ── Protected routes ──────────────────────────── */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardWrapper /></ProtectedRoute>
          } />
          <Route path="/problems" element={
            <ProtectedRoute><ProblemsWrapper /></ProtectedRoute>
          } />
          {/* Problem detail page — shows submission history + code */}
          <Route path="/problems/:problemId" element={
            <ProtectedRoute>
              <AuthLayout><ProblemDetailPage /></AuthLayout>
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <AuthLayout><ProfilePage /></AuthLayout>
            </ProtectedRoute>
          } />
          <Route path="/analysis/:problemId" element={
            <ProtectedRoute>
              <AuthLayout><AnalysisPage /></AuthLayout>
            </ProtectedRoute>
          } />

          {/* ── Default: redirect / → /login ──────────────── */}
          <Route path="/"  element={<Navigate to="/login" replace />} />
          <Route path="*"  element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
