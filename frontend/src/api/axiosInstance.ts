import axios from 'axios';

const TOKEN_KEY = 'codeinsight_token';

const api = axios.create({
  baseURL: '/api',
  // Default timeout: 30s for regular calls.
  // The import endpoints paginate through LeetCode with 1s delays between pages
  // (10 pages × 1s = ~10s minimum) so we use a longer timeout for those.
  // We override per-call via config where needed.
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Import endpoints can take up to ~120s (10 pages × 1s delay + network)
    if (config.url?.includes('/import/')) {
      config.timeout = 120000;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    const message =
      error.response?.data?.message || error.message || 'A network error occurred.';
    console.error(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url}: ${message}`);
    return Promise.reject(new Error(message));
  }
);

export default api;
