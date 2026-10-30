import { queryClient } from '../lib/queryClient';
import { ApiError } from '../api/axiosInstance';
import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  login as loginApi,
  register as registerApi,
  googleSignIn as googleSignInApi,
  getMe as getMeApi,
  logout as logoutApi,
  LoginPayload,
  RegisterPayload,
  GoogleSignInPayload,
} from '../api/auth.api';

export interface UserProfile {
  _id: string;
  name: string;
  email: string;
  targetDailySolved?: number;
  solvedProblemsCount?: number;
  leetcodeHandle?: string | null;
  codeforcesHandle?: string | null;
  lastSyncedAt?: string | null;
  syncStatus?: string;
  createdAt?: string;
  // Historical import state (Phase 1 hybrid architecture)
  historyImportStatus?: 'none' | 'partial' | 'full';
  historyImportCount?: number;
  lastHistoryImportAt?: string | null;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  /** Set when the session couldn't be checked (server down, network) — the token is kept. */
  sessionError: string | null;
  retrySession: () => Promise<void>;
  login: (credentials: LoginPayload) => Promise<any>;
  register: (userData: RegisterPayload) => Promise<any>;
  /** Sign in (or sign up) with the ID token from Google's button. */
  loginWithGoogle: (payload: GoogleSignInPayload) => Promise<any>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('codeinsight_token')
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const handleSessionPurge = useCallback(() => {
    logoutApi();
    setUser(null);
    setSessionError(null);
    queryClient.clear(); // never show the previous account's cached data
    setToken(null);
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      setLoading(true);
      const activeToken = localStorage.getItem('codeinsight_token');
      if (activeToken) {
        const response = await getMeApi();
        if (response?.success && response?.data) {
          setUser(response.data);
          setToken(activeToken);
          setSessionError(null);
        } else {
          handleSessionPurge();
        }
      } else {
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      // Only a 401 means the token is bad. Anything else (server restarting,
      // offline, cold start) keeps the session so the user isn't signed out.
      if (err instanceof ApiError && err.status === 401) handleSessionPurge();
      else setSessionError((err as Error).message || 'Couldn’t reach CodeInsight.');
    } finally {
      setLoading(false);
    }
  }, [handleSessionPurge]);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  /** Run a sign-in call (email, sign-up or Google), then load the user it signed in. */
  const signIn = async (call: () => Promise<any>, fallback: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await call();
      if (res?.success && res?.data?.token) {
        setToken(res.data.token);
        setSessionError(null);
        const meRes = await getMeApi();
        if (meRes?.success && meRes?.data) setUser(meRes.data);
        return res;
      } else {
        throw new Error(res?.message || fallback);
      }
    } catch (err: any) {
      const msg = err.message || fallback;
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const login = (credentials: LoginPayload) => signIn(() => loginApi(credentials), 'Login failed');
  const register = (userData: RegisterPayload) => signIn(() => registerApi(userData), 'Registration failed');
  const loginWithGoogle = (payload: GoogleSignInPayload) => signIn(() => googleSignInApi(payload), 'Google sign-in failed');

  const logout = useCallback(() => handleSessionPurge(), [handleSessionPurge]);

  const refreshUser = useCallback(async () => {
    if (localStorage.getItem('codeinsight_token')) {
      try {
        const res = await getMeApi();
        if (res?.success && res?.data) setUser(res.data);
      } catch {
        // silent — let the interceptor handle 401
      }
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, error, sessionError, retrySession: loadCurrentUser, login, register, loginWithGoogle, logout, refreshUser, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
};
