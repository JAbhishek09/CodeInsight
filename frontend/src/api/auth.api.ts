import api from './axiosInstance';

const TOKEN_KEY = 'codeinsight_token';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  targetDailySolved?: number;
}

export const login = async (credentials: LoginPayload) => {
  const res = await api.post('/auth/login', credentials);
  if (res.data?.data?.token) {
    localStorage.setItem(TOKEN_KEY, res.data.data.token);
  }
  return res.data;
};

export const register = async (userData: RegisterPayload) => {
  const res = await api.post('/auth/register', userData);
  if (res.data?.data?.token) {
    localStorage.setItem(TOKEN_KEY, res.data.data.token);
  }
  return res.data;
};

export const getMe = async () => {
  const res = await api.get('/auth/me');
  return res.data;
};

export const saveHandles = async (handles: { leetcode?: string; codeforces?: string }) => {
  const res = await api.put('/auth/handles', handles);
  return res.data;
};

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
};
