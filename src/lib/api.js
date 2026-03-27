// src/lib/api.js
import axios from 'axios';
import { getApiBase } from '@/lib/apiBase';

// Uses the live production URL from .env.local
const BASE = getApiBase();

const api = axios.create({
  baseURL: `${BASE}/api/v1`,
  // Production ML-backed routes can exceed 15s on cold starts.
  timeout: 60000,
});

api.interceptors.request.use(cfg => {
  if (typeof window !== 'undefined') {
    const prevBase = localStorage.getItem('os_api_base');
    if (prevBase && prevBase !== BASE) {
      ['os_token', 'os_refresh', 'os_role', 'os_user', 'os_name', 'os_username', 'os_email']
        .forEach(k => localStorage.removeItem(k));
    }
    localStorage.setItem('os_api_base', BASE);

    // Only fetch the correct token key used by auth.js
    const token = localStorage.getItem('os_token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

api.interceptors.response.use(
  r => r,
  async err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const refresh = localStorage.getItem('os_refresh');
      if (refresh) {
        try {
          const res = await axios.post(`${BASE}/api/v1/auth/refresh`, { refresh_token: refresh });
          const { access_token } = res.data;
          localStorage.setItem('os_token', access_token);
          err.config.headers.Authorization = `Bearer ${access_token}`;
          return axios(err.config);
        } catch {
          localStorage.clear();
          window.location.href = '/auth';
        }
      } else {
        localStorage.clear();
        window.location.href = '/auth';
      }
    }
    return Promise.reject(err);
  }
);

export default api;