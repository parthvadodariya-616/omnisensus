// src/lib/auth.js
import { getApiBase } from '@/lib/apiBase';

export function saveSession(data) {
  if (typeof window === 'undefined') return;
  const role = (data.role || '').toString().toLowerCase();
  const apiBase = (data.api_base || getApiBase()).toString().replace(/\/$/, '');
  localStorage.setItem('os_token',   data.access_token);
  localStorage.setItem('os_refresh', data.refresh_token || '');
  localStorage.setItem('os_role',    role);
  localStorage.setItem('os_user',    data.user_id || '');
  localStorage.setItem('os_name',    data.name || data.username || '');
  localStorage.setItem('os_username',data.username || '');
  localStorage.setItem('os_email',   data.email || '');
  localStorage.setItem('os_login_ts',Date.now().toString());
  localStorage.setItem('os_api_base', apiBase);
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('os_token');
  if (!token) return null;
  return {
    token:    token,
    role:     localStorage.getItem('os_role')     || '',
    user_id:  localStorage.getItem('os_user')     || '',
    name:     localStorage.getItem('os_name')     || '',
    username: localStorage.getItem('os_username') || '',
    email:    localStorage.getItem('os_email')    || '',
  };
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('os_token');
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  ['os_token','os_refresh','os_role','os_user','os_name','os_username','os_email','os_login_ts','os_api_base']
    .forEach(k => localStorage.removeItem(k));
}

export function getRedirect(role) {
  const normalized = (role || '').toString().toLowerCase();
  if (normalized === 'admin')   return '/admin/dashboard';
  if (normalized === 'doctor')  return '/doctor/dashboard';
  if (normalized === 'patient') return '/patients/dashboard';
  return '/auth';
}
