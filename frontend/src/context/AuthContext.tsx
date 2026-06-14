import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  login as loginApi,
  register as registerApi,
  getMe as getMeApi,
  logout as logoutApi,
  LoginPayload,
  RegisterPayload,
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
  login: (credentials: LoginPayload) => Promise<any>;
  register: (userData: RegisterPayload) => Promise<any>;
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

  const handleSessionPurge = useCallback(() => {
    logoutApi();
    setUser(null);
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
        } else {
          handleSessionPurge();
        }
      } else {
        setUser(null);
        setToken(null);
      }
    } catch {
      handleSessionPurge();
    } finally {
      setLoading(false);
    }
  }, [handleSessionPurge]);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  const login = async (credentials: LoginPayload) => {
    try {
      setLoading(true);
      setError(null);
      const res = await loginApi(credentials);
      if (res?.success && res?.data?.token) {
        setToken(res.data.token);
        const meRes = await getMeApi();
        if (meRes?.success && meRes?.data) setUser(meRes.data);
        return res;
      } else {
        throw new Error(res?.message || 'Login failed');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData: RegisterPayload) => {
    try {
      setLoading(true);
      setError(null);
      const res = await registerApi(userData);
      if (res?.success && res?.data?.token) {
        setToken(res.data.token);
        const meRes = await getMeApi();
        if (meRes?.success && meRes?.data) setUser(meRes.data);
        return res;
      } else {
        throw new Error(res?.message || 'Registration failed');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

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
      value={{ user, token, loading, error, login, register, logout, refreshUser, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
};
