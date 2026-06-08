import { createContext, useState, useEffect, ReactNode } from 'react';
import { 
  login as loginApi, 
  register as registerApi, 
  getMe as getMeApi, 
  logout as logoutApi,
  LoginPayload,
  RegisterPayload
} from '../api/auth.api';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  targetDailySolved?: number;
  solvedCount?: number;
  attemptedCount?: number;
  createdAt?: string;
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
  const [token, setToken] = useState<string | null>(localStorage.getItem('leetlens_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Synchronize profile retrieval upon mount or direct token update
  const loadCurrentUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const activeToken = localStorage.getItem('leetlens_token');
      
      if (activeToken) {
        const response = await getMeApi();
        if (response?.success && response?.data) {
          setUser(response.data);
          setToken(activeToken);
        } else {
          // Token is invalid/expired
          handleSessionPurge();
        }
      } else {
        setUser(null);
        setToken(null);
      }
    } catch (err: any) {
      console.warn('[AuthContext] Session recovery failed:', err.message);
      handleSessionPurge();
    } finally {
      setLoading(false);
    }
  };

  const handleSessionPurge = () => {
    logoutApi();
    setUser(null);
    setToken(null);
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const login = async (credentials: LoginPayload) => {
    try {
      setLoading(true);
      setError(null);
      const res = await loginApi(credentials);
      
      if (res?.success && res?.data?.token) {
        const retrievedToken = res.data.token;
        setToken(retrievedToken);
        // User representation could be returned directly or pulled from profile
        if (res.data.user) {
          setUser(res.data.user);
        } else {
          // Fallback to fetch profile if not fully presented in login login payload
          const meRes = await getMeApi();
          if (meRes?.success && meRes?.data) {
            setUser(meRes.data);
          }
        }
        return res;
      } else {
        throw new Error(res?.message || 'Authentication failed');
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setError(msg);
      throw err;
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
        const retrievedToken = res.data.token;
        setToken(retrievedToken);
        if (res.data.user) {
          setUser(res.data.user);
        } else {
          const meRes = await getMeApi();
          if (meRes?.success && meRes?.data) {
            setUser(meRes.data);
          }
        }
        return res;
      } else {
        throw new Error(res?.message || 'Registration failed');
      }
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    handleSessionPurge();
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const res = await getMeApi();
        if (res?.success && res?.data) {
          setUser(res.data);
        }
      } catch (err: any) {
        console.error('[AuthContext] Failed to refresh user metrics:', err.message);
      }
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        register,
        logout,
        refreshUser,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
