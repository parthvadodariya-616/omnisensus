// src/lib/report.js
import api from '@/lib/api';
import { getApiBase } from '@/lib/apiBase';

const BASE = getApiBase();

function extractFilename(value) {
  if (!value || typeof value !== 'string') return null;
  const clean = value.split('?')[0].split('#')[0];
  const part = clean.split('/').pop();
  return part || null;
}

function isLegacyReportDownloadPath(value) {
  if (!value || typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return normalized.includes('/api/v1/reports/')
    || normalized.includes('/reports/')
    || normalized.includes('/api/v1/report/download/')
    || normalized.includes('/report/download/')
    || normalized.includes('omnisensus-ml-model.onrender.com');
}

export function resolvePdfUrl(report) {
  const raw = report?.pdf_url
    || report?.report_url
    || report?.file_url
    || report?.file_path
    || report?.url
    || null;

  const fileName = report?.filename
    || report?.report_filename
    || report?.file_name
    || extractFilename(raw);

  if (fileName) {
    const looksLikeStoredReport = !raw
      || String(raw).includes('/exports/reports/')
      || isLegacyReportDownloadPath(raw);
    if (looksLikeStoredReport) {
      return `${BASE}/api/v1/ml/report/download/${encodeURIComponent(fileName)}`;
    }
  }

  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/')) return `${BASE}${raw}`;
  return `${BASE}/${raw}`;
}

export function getPdfViewerUrl(report) {
  const url = resolvePdfUrl(report);
  if (!url) return null;
  const hash = '#toolbar=1&navpanes=0&view=FitH';
  return url.includes('#') ? url : `${url}${hash}`;
}

export function openReportPdfInNewTab(report) {
  const url = resolvePdfUrl(report);
  if (!url || typeof window === 'undefined') return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export async function downloadReportPdf(report, fallbackName = 'omnisensus-report.pdf') {
  const url = resolvePdfUrl(report);
  if (!url) return false;

  const filename = report?.filename || report?.report_filename || report?.file_name || fallbackName;

  // If this is a backend-relative endpoint, prefer authenticated blob download.
  const relativePath = url.startsWith(BASE) ? url.slice(BASE.length) : null;
  if (relativePath) {
    const apiPath = relativePath.startsWith('/api/v1/')
      ? relativePath.slice('/api/v1'.length)
      : relativePath;
    try {
      const res = await api.get(apiPath, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      return true;
    } catch {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('os_token') : null;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) return false;
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
        return true;
      } catch {
        return false;
      }
    }
  }

  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
