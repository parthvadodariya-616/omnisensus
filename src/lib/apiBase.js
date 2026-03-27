// src/lib/apiBase.js

// Use environment variable for production API base, fallback to empty string if not set
const PROD_API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function trimBase(url) {
  return (url || '').toString().trim().replace(/\/$/, '');
}

function isLocalBase(url) {
  return /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimBase(url));
}

export function getApiBase() {

  const configured = trimBase(process.env.NEXT_PUBLIC_API_URL);
  if (!configured) return PROD_API_BASE;


  if (typeof window !== 'undefined' && isLocalBase(configured)) {
    const host = window.location.hostname;
    const runningLocalUi = host === 'localhost' || host === '127.0.0.1';
    if (!runningLocalUi) return PROD_API_BASE;
  }

  return configured;
}

export function getApiBaseCandidates() {
  const primary = getApiBase();
  const candidates = [primary];

  if (primary !== PROD_API_BASE) {
    candidates.push(PROD_API_BASE);
  }

  return candidates;
}
