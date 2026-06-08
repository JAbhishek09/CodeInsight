import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Lock, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Route level gate that intercepts attempts to view premium assets or trackers.
 * Safely manages local loads, redirects, and triggers immersive lock layouts.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, fallback }) => {
  const { user, loading, token } = useAuth();

  // If session authorization is actively syncing, render an elegant loading screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-[#070b13]/40 border border-slate-900 rounded-2xl" id="protected-loader">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="text-[#ec4899] mb-4"
        >
          <Loader2 className="w-10 h-10" />
        </motion.div>
        <p className="text-sm font-mono text-slate-400 tracking-wider">SECURE IDENTITY DECRYPT IN PROGRESS</p>
        <div className="w-24 h-1 bg-slate-900 rounded-full mt-3 overflow-hidden leading-none">
          <motion.div 
            className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
            animate={{ x: [-40, 80] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    );
  }

  // If there is no token or user profile active, lock the view
  if (!token || !user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden bg-[#070a12] border border-red-500/10 rounded-2xl p-8 text-center max-w-lg mx-auto my-6 shadow-2xl"
        id="protected-lock-screen"
      >
        {/* Absolute Background Accent Blur */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-pink-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-red-950/20 w-14 h-14 rounded-2xl border border-red-500/25 flex items-center justify-center mx-auto mb-5 text-red-400 shadow-lg shadow-red-950/40">
          <Lock className="w-6 h-6" />
        </div>

        <h3 className="text-lg font-bold text-slate-100 tracking-tight">Identity Verification Required</h3>
        <p className="text-xs text-slate-400 font-mono mt-1 text-center uppercase tracking-widest text-[#ec4899]">GATEWAY STATUS: LOCKED</p>
        
        <p className="text-slate-400 text-sm mt-4 leading-relaxed">
          The requested views or resources are bound by strict user ownership parameters. Please navigate to the authentication portal to establish an active session.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 items-center justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1424] rounded-lg border border-slate-800 text-xs text-slate-300 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>LeetCode Solved Meter: Active</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0e1424] rounded-lg border border-slate-800 text-xs text-slate-300 font-mono">
            <AlertCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Owner Isolation: Strict</span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-900/80 flex justify-end gap-3 text-xs font-mono">
          <span className="text-slate-500">Security Gate v4.5</span>
        </div>
      </motion.div>
    );
  }

  // Session exists and token is valid - proceed to authorized children content
  return <>{children}</>;
};

export default ProtectedRoute;
