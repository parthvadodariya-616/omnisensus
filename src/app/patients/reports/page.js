"use client";
// src/app/patients/reports/page.js
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { exportReportPdf } from '@/lib/pdfExport';
import ModalPortal from '@/components/ModalPortal';

export default function PatientReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState(null);
  const [downloadKey, setDownloadKey] = useState('');


  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleDownload = async (report) => {
    setDownloadKey(String(report.report_id || report.visit_id || report.filename || 'active'));
    try {
      exportReportPdf({
        profile: profile || {},
        report,
        recommendations: report.summary_notes,
        onComplete: () => {
          showToast('Secured PDF downloaded', 'info');
          setDownloadKey('');
        },
      });
    } catch {
      showToast('Could not download this secured PDF right now.', 'warn');
      setDownloadKey('');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const pr = await api.get('/patients/me');
        const p = pr.data?.patient || pr.data;
        setProfile(p);
        const pid = p?.patient_id;
        if (pid) {
          const rr = await api.get(`/patients/${pid}/reports`);
          setReports(Array.isArray(rr.data?.reports) ? rr.data.reports : rr.data?.data || []);
        } else {
          setReports([]);
        }
      } catch (err) {
        setError('Could not load reports. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // All UI below
  return (
    <>
      <div className="wrap">
        {/* Toast */}
        {toast && toast.msg && (
          <div className="toast-container">
            <div className="toast toast-info">
              <div className="toast-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="1"/></svg>
              </div>
              <div>{toast.msg}</div>
              <button className="toast-close" onClick={() => setToast(null)}>&times;</button>
            </div>
          </div>
        )}
        {/* View/Preview modal */}
        {preview && (
          <ModalPortal>
            <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setPreview(null)}>
              <div className="modal-box">
              <div className="modal-header">
                <div>
                  <h3>Report Preview</h3>
                  <p className="pdf-modal-subhead">Review all report details below. Download protected PDF report.</p>
                </div>
                <button className="modal-close" onClick={() => setPreview(null)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="lab-report">
                <div className="lab-report-header">
                  <div>
                    <div className="lab-report-brand">Omni<span>Sensus</span> Medical</div>
                    <div style={{ fontSize: 11, color: 'var(--grey-text)', marginTop: 4 }}>AI-Powered Clinical Diagnostic Report</div>
                  </div>
                  <div className="lab-report-meta">
                    <div>Date: {preview.visit_date || preview.generated_at ? new Date(preview.visit_date || preview.generated_at).toLocaleDateString() : '—'}</div>
                    {preview.accession_number && <div>Acc: {preview.accession_number}</div>}
                  </div>
                </div>
                <div className="risk-strat">
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--grey-text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Health Score</div>
                    <div className="risk-score-big">{preview.health_score ?? '—'}</div>
                  </div>
                  <div className="risk-desc">
                    <h4>{preview.visit_type || preview.report_type || 'Clinical Visit'}</h4>
                    <p style={{ marginTop: 6 }}>{preview.summary_notes || 'No additional notes.'}</p>
                    {preview.risk_tier && (
                      <div style={{ marginTop: 10 }}><span className={`badge ${preview.risk_tier === 'Critical' ? 'badge-danger' : preview.risk_tier === 'Borderline' ? 'badge-warning' : 'badge-success'}`}>{preview.risk_tier}</span></div>
                    )}
                  </div>
                </div>
                {(preview.glucose || preview.hba1c || preview.egfr) && (
                  <>
                    <div className="lab-section-title">Key Biomarkers</div>
                    <table className="report-table">
                      <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
                      <tbody>
                        {preview.glucose && <tr><td>Fasting Glucose</td><td className="val-normal">{preview.glucose} mg/dL</td></tr>}
                        {preview.hba1c && <tr><td>HbA1c</td><td className="val-normal">{preview.hba1c}%</td></tr>}
                        {preview.egfr && <tr><td>eGFR</td><td className="val-normal">{preview.egfr} mL/min</td></tr>}
                        {preview.bp_sys && <tr><td>Blood Pressure</td><td className="val-normal">{preview.bp_sys}/{preview.bp_dia} mmHg</td></tr>}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-modal btn-modal-outline" onClick={() => setPreview(null)}>Close</button>
                <button
                  className="btn-modal btn-modal-filled"
                  disabled={!preview}
                  onClick={() => handleDownload(preview)}
                >
                  {downloadKey === String(preview.report_id || preview.visit_id || preview.filename || 'active') ? 'Downloading...' : 'Download'}
                </button>
              </div>
              </div>
            </div>
          </ModalPortal>
        )}
        {/* Main content: robust loading, error, empty, and list states */}
        <div className="page-content" style={{ marginTop: 32 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
              <div className="spinner" style={{ width: 48, height: 48, border: '4px solid #e0f7f6', borderTop: '4px solid #10847e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : error ? (
            <div style={{ color: '#b00020', textAlign: 'center', margin: '48px 0', fontWeight: 600, fontSize: 18 }}>{error}</div>
          ) : !reports || reports.length === 0 ? (
            <div style={{ color: '#505050', textAlign: 'center', margin: '48px 0', fontWeight: 500, fontSize: 16 }}>No health reports found.</div>
          ) : (
            <div className="reports-list">
              {reports.map((r, i) => (
                <div
                  key={r.report_id || r.visit_id || i}
                  className="report-item"
                  style={{ cursor: 'pointer', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--teal-200)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; }}
                >
                  <div className="report-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div className="report-info">
                    <h4>{r.report_type || r.visit_type || 'Diagnostic Report'}</h4>
                    <p>
                      {r.generated_at || r.visit_date ? new Date(r.generated_at || r.visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                      {r.health_score && ` · Score: ${r.health_score}/100`}
                      {r.accession_number && ` · Acc: ${r.accession_number}`}
                    </p>
                  </div>
                  <div className="report-meta">
                    <span className={`badge ${r.risk_tier === 'Critical' ? 'badge-danger' : r.risk_tier === 'Borderline' ? 'badge-warning' : 'badge-success'}`}>{r.risk_tier || 'Stable'}</span>
                    <button className="btn-sm btn-sm-teal" onClick={() => setPreview(r)}>View</button>
                    <button
                      className="btn-sm btn-sm-outline"
                      disabled={downloadKey === String(r.report_id || r.visit_id || r.filename || 'active')}
                      onClick={e => { e.stopPropagation(); handleDownload(r); }}
                    >
                      {downloadKey === String(r.report_id || r.visit_id || r.filename || 'active') ? 'Downloading...' : 'Download'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}