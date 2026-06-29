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

// Auto-logout on 401 — but NOT for import endpoints, where a 401-shaped
// error can originate from LeetCode's own session/WAF rejection (surfaced
// by our backend), not from the CodeInsight JWT itself being invalid.
// Force-logging the user out mid-import would silently kill a multi-minute
// import run and bounce them to /login with no explanation.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isImportEndpoint = error.config?.url?.includes('/import/');

    if (error.response?.status === 401 && !isImportEndpoint) {
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
