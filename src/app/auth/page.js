'use client';

import '../../styles/auth.css';
import { useState, useCallback } from 'react';
import Logo from '@/components/Logo';
import { useRouter } from 'next/navigation';
import { saveSession, getRedirect } from '@/lib/auth';
import { getApiBaseCandidates } from '@/lib/apiBase';

export default function AuthPage() {
  const router   = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const login = useCallback(async () => {
    const u = username.trim();
    const p = password;
    if (!u || !p) {
      setError('Please enter both your username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = JSON.stringify({ username: u, password: p });
      let res = null;
      let data = null;
      let successBase = null;
      let lastError = null;

      for (const base of getApiBaseCandidates()) {
        try {
          const attempt = await fetch(`${base}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });
          data = await attempt.json();
          if (attempt.ok && data?.access_token) {
            res = attempt;
            successBase = base;
            break;
          }
          // Keep going to next candidate
          res = attempt;
        } catch (err) {
          lastError = err;
        }
      }

      if (!res && lastError) throw lastError;

      if (!res?.ok || !data?.access_token) {
        setError(data?.detail || data?.message || 'Invalid credentials. Please try again.');
        return; 
      }

   
      saveSession({ ...data, username: u, api_base: successBase });

      router.replace(getRedirect(data.role));
     
      return;
    } catch {
      setError('Cannot connect to the server. Please check your connection.');
    }

    // Only reach here on error path
    setLoading(false);
  }, [username, password, router]);

  const onKey = useCallback((e) => {
    if (e.key === 'Enter') login();
  }, [login]);

  return (
    <div className="auth-pinned-page">
      {/* Loading overlay — only shown while waiting for API, hidden on error */}
      {loading && (
        <div className="auth-pinned-loading">
          <div className="auth-pinned-loading-spinner" />
          <div className="auth-pinned-loading-text">Authenticating — please wait…</div>
        </div>
      )}

      <div className="auth-pinned-wrap">
        <div className="auth-pinned-box">

          <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
            <Logo size={42} />
          </div>

          <h2>Welcome Back</h2>
          <p>Please sign in to access your dashboard.</p>

          {error && (
            <div className="auth-pinned-error">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              {error}
            </div>
          )}

          <div className="auth-pinned-group">
            <label htmlFor="inpUser">Institutional Username</label>
            <div className="auth-pinned-input-wrap">
              <span className="auth-pinned-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input
                type="text" id="inpUser" className="auth-pinned-input"
                placeholder="Enter institutional identifier"
                autoComplete="username" spellCheck="false"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={onKey}
                disabled={loading}
              />
            </div>
          </div>

          <div className="auth-pinned-group auth-pinned-group-pass">
            <label htmlFor="inpPass">Password</label>
            <div className="auth-pinned-input-wrap">
              <span className="auth-pinned-input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                type="password" id="inpPass" className="auth-pinned-input"
                placeholder="••••••••••"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={onKey}
                disabled={loading}
              />
            </div>
          </div>

          <button
            className="auth-pinned-submit"
            onClick={login}
            disabled={loading}
            type="button"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>

          <div className="auth-pinned-footer">
            Unauthorised access is strictly prohibited and monitored.
          </div>
        </div>
      </div>
    </div>
  );
}