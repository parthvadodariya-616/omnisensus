// src/app/doctor/reports/page.js
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { exportReportPdf } from '@/lib/pdfExport';
import ModalPortal from '@/components/ModalPortal';

const toErrorText = (detail, fallback) => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') return first.msg || first.message || fallback;
  }
  if (detail && typeof detail === 'object') return detail.msg || detail.message || fallback;
  return fallback;
};

export default function DoctorReports() {
  const [reports,  setReports]  = useState([]);
  const [patients, setPatients] = useState([]);
  const [selPat,   setSelPat]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [pdfOpen,  setPdfOpen]  = useState(false);
  const [selRpt,   setSelRpt]   = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloadKey, setDownloadKey] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.get('/patients?page_size=50')
      .then(r => {
        const list = r.data?.patients || r.data?.data || [];
        setPatients(list);
        if (list.length) {
          setSelPat(list[0].patient_id);
          loadReports(list[0].patient_id);
        } else {
          setReports([]);
          setLoading(false);
        }
      })
      .catch(e => {
        setError(toErrorText(e?.response?.data?.detail, 'Could not load patient list.'));
        setLoading(false);
      });
  }, []);

  const loadReports = async (patientId) => {
    if (!patientId) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/patients/${patientId}/reports`);
      setReports(r.data?.reports || r.data?.data || []);
    } catch (e) {
      setReports([]);
      setError(toErrorText(e?.response?.data?.detail, 'Could not load reports.'));
    } finally { setLoading(false); }
  };

  const riskBadge = r => r === 'Critical' ? 'badge-danger' : r === 'Borderline' ? 'badge-warning' : 'badge-success';
  const riskLabel = r => r || 'Unknown';

  // Only open component preview, not PDF iframe preview
  const openPreview = (report) => {
    setSelRpt(report);
    setPdfOpen(true);
  };

  // Use jsPDF export for perfect match
  const handleDownload = async (report) => {
    setDownloadKey(String(report.report_id || report.visit_id || report.filename || 'active'));
    try {
      exportReportPdf({
        profile: patients.find(p => p.patient_id === selPat) || {},
        report,
        recommendations: report.summary_notes,
        onComplete: () => {
          showToast('info', 'Secured PDF downloaded');
          setDownloadKey('');
        },
      });
    } catch {
      showToast('warn', 'Could not download this secured PDF right now.');
      setDownloadKey('');
    }
  };

  return (
    <div className="page-inner">
      {toast && (
        <div className="toast-container">
          <div className="toast toast-info">
            <div className="toast-body"><p>{toast.msg}</p></div>
          </div>
        </div>
      )}

      <div className="section-head">
        <div><h2>Clinical Report Archive</h2><p>AI-generated diagnostic reports — view and download</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={selPat} onChange={e => { setSelPat(e.target.value); loadReports(e.target.value); }}
            style={{ padding: '7px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }}>
            <option value="">Select patient</option>
            {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #F5C6CA', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12, fontWeight: 500 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>Loading reports…</div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>No reports found</div>
      ) : (
        <div className="reports-list">
          {reports.map((r, i) => (
            <div key={r.report_id || r.visit_id || i} className="report-item">
              <div className="report-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div className="report-info">
                <h4>{r.visit_type || r.report_type || 'Clinical Diagnostic Report'}</h4>
                <p>
                  {r.visit_date || r.generated_at ? new Date(r.visit_date || r.generated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                  {r.health_score && ` · Score: ${r.health_score}/100`}
                  {r.accession_number && ` · Acc: ${r.accession_number}`}
                </p>
              </div>
              <div className="report-meta">
                <span className={`badge ${riskBadge(r.risk_tier)}`}>{riskLabel(r.risk_tier)}</span>
                <button className="btn-sm btn-sm-teal" onClick={() => openPreview(r)}>View</button>
                <button
                  className="btn-sm btn-sm-outline"
                  disabled={downloadKey === String(r.report_id || r.visit_id || r.filename || '')}
                  onClick={() => handleDownload(r)}
                >
                  {downloadKey === String(r.report_id || r.visit_id || r.filename || '') ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pdfOpen && selRpt && (
        <ModalPortal>
          <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setPdfOpen(false)}>
            <div className="modal-box">
            <div className="modal-header">
              <div>
                <h3>Report Preview</h3>
                <p className="pdf-modal-subhead">Review all report details below. Download protected PDF report.</p>
              </div>
              <button className="modal-close" onClick={() => setPdfOpen(false)}>
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
                  <div>Date: {selRpt.visit_date || selRpt.generated_at ? new Date(selRpt.visit_date || selRpt.generated_at).toLocaleDateString() : '—'}</div>
                  {selRpt.accession_number && <div>Acc: {selRpt.accession_number}</div>}
                </div>
              </div>
              <div className="risk-strat">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--grey-text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Health Score</div>
                  <div className="risk-score-big">{selRpt.health_score ?? '—'}</div>
                </div>
                <div className="risk-desc">
                  <h4>{selRpt.visit_type || 'Clinical Visit'}</h4>
                  <p style={{ marginTop: 6 }}>{selRpt.summary_notes || 'No additional notes.'}</p>
                  {selRpt.risk_tier && (
                    <div style={{ marginTop: 10 }}><span className={`badge ${riskBadge(selRpt.risk_tier)}`}>{selRpt.risk_tier}</span></div>
                  )}
                </div>
              </div>
              {(selRpt.glucose || selRpt.hba1c || selRpt.egfr) && (
                <>
                  <div className="lab-section-title">Key Biomarkers</div>
                  <table className="report-table">
                    <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
                    <tbody>
                      {selRpt.glucose && <tr><td>Fasting Glucose</td><td className="val-normal">{selRpt.glucose} mg/dL</td></tr>}
                      {selRpt.hba1c && <tr><td>HbA1c</td><td className="val-normal">{selRpt.hba1c}%</td></tr>}
                      {selRpt.egfr && <tr><td>eGFR</td><td className="val-normal">{selRpt.egfr} mL/min</td></tr>}
                      {selRpt.bp_sys && <tr><td>Blood Pressure</td><td className="val-normal">{selRpt.bp_sys}/{selRpt.bp_dia} mmHg</td></tr>}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-modal btn-modal-outline" onClick={() => setPdfOpen(false)}>Close</button>
              <button
                className="btn-modal btn-modal-filled"
                disabled={!selRpt}
                onClick={() => handleDownload(selRpt)}
              >
                {downloadKey === String(selRpt.report_id || selRpt.visit_id || selRpt.filename || '') ? 'Downloading...' : 'Download Secured PDF'}
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}