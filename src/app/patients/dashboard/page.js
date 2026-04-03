// src/app/patients/dashboard/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { ensureChartLoaded } from '@/lib/ensureChartLoaded';
import { exportReportPdf } from '@/lib/pdfExport';
import ModalPortal from '@/components/ModalPortal';

export default function PatientDashboard() {
  const [profile,   setProfile]   = useState(null);
  const [vitals,    setVitals]    = useState(null);
  const [history,   setHistory]   = useState([]);
  const [reports,   setReports]   = useState([]);
  const [meds,      setMeds]      = useState([]);
  const [appts,     setAppts]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [page,      setPage]      = useState('overview');
  const [toast,     setToast]     = useState(null);
  const [reportPreview, setReportPreview] = useState(null);
  const [downloadKey, setDownloadKey] = useState('');
  const scoreRef = useRef(); const bioRef = useRef();
  const charts = useRef({});

  const showToast = (type, title, msg) => { setToast({ type, title, msg }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const pr = await api.get('/patients/me');
        const p = pr.data?.patient || pr.data || null;
        setProfile(p);
        const pid = p?.patient_id;
        if (pid) {
          const [hRes, rRes, mRes, aRes, vRes] = await Promise.allSettled([
            api.get(`/patients/${pid}/history`),
            api.get(`/patients/${pid}/reports`),
            api.get(`/patients/${pid}/medications`),
            api.get('/appointments'),
            api.get(`/patients/${pid}/vitals`),
          ]);
          if (hRes.status === 'fulfilled') {
            const visits = hRes.value.data?.visits || hRes.value.data?.data || [];
            setHistory(visits);
          }
          if (rRes.status === 'fulfilled') setReports(rRes.value.data?.reports || rRes.value.data?.data || []);
          if (mRes.status === 'fulfilled') setMeds(mRes.value.data?.medications || mRes.value.data?.data || []);
          if (aRes.status === 'fulfilled') setAppts(aRes.value.data?.appointments || aRes.value.data?.data || []);
          if (vRes.status === 'fulfilled') setVitals(vRes.value.data?.vitals || vRes.value.data || null);
        }
      } catch {
        setError('Unable to load dashboard data right now. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!history.length || typeof window === 'undefined') return;
    let cancelled = false;
    const init = () => {
      if (cancelled) return;
      const C = window.Chart; if (!C) return;
      const F = "'Montserrat',sans-serif";
      const gs = () => ({ x: { grid: { color: 'rgba(17,24,39,.04)' }, ticks: { color: '#8A9BB0', font: { family: F, size: 10 } }, border: { display: false } }, y: { grid: { color: 'rgba(17,24,39,.04)' }, ticks: { color: '#8A9BB0', font: { family: F, size: 10 } }, border: { display: false } } });
      const tt = { backgroundColor: '#1A2733', titleFont: { family: F, size: 11 }, bodyFont: { family: F, size: 11 }, padding: 10, cornerRadius: 8 };
      const visits = history.slice().reverse();

      if (scoreRef.current && !charts.current.score) {
        charts.current.score = new C(scoreRef.current, {
          type: 'line',
          data: { labels: visits.map(v => v.visit_date?.slice(0, 7) || ''), datasets: [
            { label: 'Health Score', data: visits.map(v => v.health_score || 0), borderColor: '#10847E', backgroundColor: 'rgba(16,132,126,.07)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#10847E' },
            { label: 'Target (70)', data: visits.map(() => 70), borderColor: '#E2EAF0', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, fill: false },
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: F, size: 11 } } }, tooltip: tt }, scales: { ...gs(), y: { ...gs().y, min: 0, max: 100 } }, interaction: { mode: 'index', intersect: false } }
        });
      }
      if (bioRef.current && !charts.current.bio) {
        charts.current.bio = new C(bioRef.current, {
          type: 'line',
          data: { labels: visits.map(v => v.visit_date?.slice(0, 7) || ''), datasets: [
            { label: 'Glucose (mg/dL)', data: visits.map(v => v.glucose || null), borderColor: '#E85D6A', backgroundColor: 'rgba(232,93,106,.07)', fill: true, tension: .4, pointRadius: 3 },
            { label: 'HbA1c × 20', data: visits.map(v => v.hba1c ? v.hba1c * 20 : null), borderColor: '#F59E0B', borderDash: [4, 3], tension: .4, pointRadius: 3 },
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: F, size: 11 } } }, tooltip: tt }, scales: { ...gs(), y: { ...gs().y, min: 70, max: 160 } }, interaction: { mode: 'index', intersect: false } }
        });
      }
    };
    ensureChartLoaded().then(() => { if (!cancelled) init(); }).catch(() => {});
    return () => {
      cancelled = true;
      Object.values(charts.current).forEach(c => c?.destroy());
      charts.current = {};
    };
  }, [history]);

  const latest = history[0] || {};
  const v = vitals || {};
  const now = new Date();
  const sortedAppts = [...appts].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const upcomingAppt = sortedAppts.find(a => new Date(a.scheduled_at) > now) || null;
  const score = profile?.current_score ?? latest.health_score ?? 0;
  const tier  = profile?.current_tier  ?? latest.risk_tier    ?? 'Stable';
  const ringColor = score >= 70 ? '#10847E' : score >= 50 ? '#F59E0B' : '#E85D6A';
  const ringOffset = 339.29 * (1 - score / 100);
  const tierLabel = tier === 'Stable' ? 'Optimal Range' : tier === 'Borderline' ? 'Borderline Risk' : 'Elevated Risk';
  const tierSub   = tier === 'Stable' ? 'All vitals within reference bounds' : tier === 'Borderline' ? 'Lifestyle intervention advised' : 'Immediate clinical consultation required';
  const initials  = profile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2) || 'PT';

  // Med reminder check
  const medsWithDue = (meds || []).map(m => {
    const scheduled = m.scheduled_time || '08:00';
    const [h, min] = scheduled.split(':').map(Number);
    const due = new Date(); due.setHours(h, min, 0);
    const diff = Math.round((due - now) / 60000);
    return { ...m, diff, dueLabel: diff < 0 ? 'Overdue' : diff < 60 ? `Due in ${diff}m` : null };
  });

  const adherenceValues = medsWithDue
    .map(m => m.adherence_pct)
    .filter(v => typeof v === 'number');
  const adherenceAvg = adherenceValues.length
    ? Math.round(adherenceValues.reduce((acc, n) => acc + n, 0) / adherenceValues.length)
    : null;

  const openReportPreview = (report) => {
    setReportPreview(report);
  };

  const handleReportDownload = async (report) => {
    const key = String(report.report_id || report.visit_id || report.filename || 'active');
    setDownloadKey(key);
    try {
      exportReportPdf({
        profile: profile || {},
        report,
        recommendations: report.summary_notes,
        onComplete: () => {
          showToast('info', 'PDF Downloaded', 'PDF downloaded successfully.');
          setDownloadKey('');
        },
      });
    } catch {
      showToast('warn', 'Download Failed', 'Unable to download this report right now.');
      setDownloadKey('');
    }
  };

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh' }}>
      {toast && (
        <div className="toast-container">
          <div className="toast toast-info">
            <div className="toast-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div>
            <div className="toast-body"><h5>{toast.title}</h5><p>{toast.msg}</p></div>
          </div>
        </div>
      )}

      {/* Patient Tab Nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--grey-border)', padding: '0 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', gap: 0 }}>
          {[
            { id: 'overview', label: 'Health Overview' },
            { id: 'reports', label: 'My Reports' },
            { id: 'meds', label: 'Medications' },
            { id: 'appts', label: 'Appointments' },
          ].map(t => (
            <button key={t.id} onClick={() => setPage(t.id)}
              style={{ padding: '14px 20px', border: 'none', borderBottom: `2.5px solid ${page === t.id ? 'var(--teal)' : 'transparent'}`, background: 'none', fontSize: 13, fontWeight: page === t.id ? 700 : 500, color: page === t.id ? 'var(--teal)' : 'var(--grey-text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-inner" style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 24px 80px' }}>

        {/* ── OVERVIEW ── */}
        {page === 'overview' && (
          <>
            {!loading && (
              <>
                <div className="section-head">
                  <div><h2>Personal Health Overview</h2><p>Longitudinal surveillance of your clinical parameters</p></div>
                  <span className={`badge ${tier === 'Stable' ? 'badge-success' : tier === 'Borderline' ? 'badge-warning' : 'badge-danger'}`}>{tier}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 20 }}>
              {/* Profile Card */}
              <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 70, height: 70, borderRadius: '50%', background: ringColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff', boxShadow: `0 0 0 4px ${ringColor}30` }}>
                  {initials}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--dark)' }}>{profile?.full_name || 'Patient'}</div>
                  <div style={{ fontSize: 11, color: 'var(--grey-text)', fontFamily: 'var(--mono)', marginTop: 2 }}>{profile?.patient_id?.slice(0, 8) || '—'}</div>
                </div>

                {/* Score Ring */}
                <div style={{ position: 'relative', width: 120, height: 120 }}>
                  <svg width="120" height="120" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="65" cy="65" r="54" fill="none" stroke="var(--grey-border)" strokeWidth="9" />
                    <circle cx="65" cy="65" r="54" fill="none" stroke={ringColor} strokeWidth="9" strokeLinecap="round"
                      strokeDasharray="339.29" strokeDashoffset={ringOffset}
                      style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1), stroke .4s' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: 26, fontWeight: 700, color: ringColor, lineHeight: 1 }}>{score}</div>
                    <div style={{ fontSize: 10, color: 'var(--grey-text)' }}>Health Score</div>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ringColor }}>{tierLabel}</div>
                  <div style={{ fontSize: 11, color: 'var(--grey-text)', marginTop: 2 }}>{tierSub}</div>
                </div>

                {/* Profile fields */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { k: 'Age', v: profile?.age ?? latest.age ?? '—', accent: false },
                    { k: 'Blood Group', v: profile?.blood_group ?? '—', accent: false },
                    { k: 'Attending Dr.', v: profile?.doctor_name ?? '—', accent: true },
                    { k: 'Last Scan', v: profile?.last_scan_at ? new Date(profile.last_scan_at).toLocaleDateString() : '—', accent: false },
                    { k: 'Next Appt.', v: upcomingAppt?.scheduled_at ? new Date(upcomingAppt.scheduled_at).toLocaleDateString() : '—', accent: true },
                  ].map(f => (
                    <div key={f.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--grey-bg)', borderRadius: 7 }}>
                      <span style={{ fontSize: 11, color: 'var(--grey-text)' }}>{f.k}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: f.accent ? 'var(--teal)' : 'var(--dark)' }}>{f.v}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setPage('reports')} style={{ width: '100%', padding: 10, background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  View Clinical Reports
                </button>
              </div>

              {/* Right column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* KPI 2x2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Fasting Glucose', val: v.glucose ?? latest.glucose ?? '—', unit: 'mg/dL', warn: v.glucose > 99 || latest.glucose > 99 },
                    { label: 'HbA1c', val: v.hba1c ?? latest.hba1c ?? '—', unit: '%', warn: v.hba1c >= 5.7 || latest.hba1c >= 5.7 },
                    { label: 'Total Cholesterol', val: v.cholesterol_total ?? '—', unit: 'mg/dL', warn: false },
                    { label: 'eGFR (Renal)', val: v.egfr ?? latest.egfr ?? '—', unit: 'mL/min', warn: false },
                  ].map(k => (
                    <div key={k.label} className="stat-card">
                      <div className="stat-card-label">{k.label}</div>
                      <div className="stat-card-val" style={{ color: k.warn ? 'var(--warning)' : 'var(--dark)' }}>{k.val}<span>{k.unit}</span></div>
                      {k.warn && <div className="stat-trend trend-up">↑ Monitor</div>}
                    </div>
                  ))}
                </div>

                {/* Score trend chart */}
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>Longitudinal Health Score — Trend</div>
                  <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 14 }}>Composite AI stratification score across recent assessments</div>
                  <div style={{ position: 'relative', height: 180 }}><canvas ref={scoreRef} /></div>
                </div>

                {/* Biomarker trend */}
                <div className="card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>Metabolic Pathogenesis — HbA1c & Glucose Trend</div>
                  <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 14 }}>Monthly glycaemic control monitoring</div>
                  <div style={{ position: 'relative', height: 140 }}><canvas ref={bioRef} /></div>
                </div>
              </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── MY REPORTS ── */}
        {page === 'reports' && (
          <>
            <div className="section-head">
              <div><h2>Clinical Report Archive</h2><p>Download or review your previous diagnostic reports</p></div>
            </div>
            {error && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, border: '1px solid #F5C6CA', background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 12, fontWeight: 500 }}>
                {error}
              </div>
            )}
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>Loading reports…</div>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>No reports available</div>
            ) : (
              <div className="reports-list">
                {reports.map((r, i) => (
                  <div key={r.report_id || r.visit_id || i} className="report-item">
                    <div className="report-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                    <div className="report-info">
                      <h4>{r.report_type || r.visit_type || 'Diagnostic Report'}</h4>
                      <p>{(r.generated_at || r.visit_date) ? new Date(r.generated_at || r.visit_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}{r.health_score ? ` · Score: ${r.health_score}/100` : ''}</p>
                    </div>
                    <div className="report-meta">
                      <span className={`badge ${r.risk_tier === 'Critical' ? 'badge-danger' : r.risk_tier === 'Borderline' ? 'badge-warning' : 'badge-success'}`}>{r.risk_tier ?? 'Stable'}</span>
                      <button className="btn-sm btn-sm-teal" onClick={() => openReportPreview(r)}>View</button>
                      <button className="btn-sm btn-sm-outline" disabled={downloadKey === String(r.report_id || r.visit_id || r.filename || '')} onClick={() => handleReportDownload(r)}>
                        {downloadKey === String(r.report_id || r.visit_id || r.filename || '') ? 'Downloading...' : 'Download'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── MEDICATIONS ── */}
        {page === 'meds' && (
          <>
            <div className="section-head">
              <div><h2>Smart Med-Reminder</h2><p>Pharmacological dose scheduling with adherence tracking</p></div>
            </div>
            <div className="support-grid">
              <div className="reminder-card">
                <h4>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" color="var(--teal)"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Active Medications
                </h4>
                {meds.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--grey-text)', fontSize: 13 }}>No medications scheduled</div>
                ) : (
                  <div className="med-list">
                    {medsWithDue.map((m, i) => (
                      <div key={m.patient_med_id || i} className="med-item">
                        <div className="med-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></div>
                        <div className="med-info">
                          <div className="med-name">{m.medication_name || m.dosage_actual || 'Medication'}</div>
                          <div className="med-time">{m.scheduled_time || '08:00'} · {m.frequency || 'Daily'}</div>
                        </div>
                        {m.dueLabel && <span className="med-due" style={m.diff < 0 ? { background: 'var(--danger-bg)', color: 'var(--danger)' } : {}}>{m.dueLabel}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                {/* Adherence card */}
                <div className="card" style={{ padding: 22, marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" color="var(--teal)"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Monthly Adherence
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--teal)', textAlign: 'center', letterSpacing: -1 }}>{adherenceAvg !== null ? `${adherenceAvg}%` : '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--grey-text)', textAlign: 'center', marginTop: 2, marginBottom: 14 }}>Overall Adherence Rate · This Month</div>
                  {medsWithDue.slice(0, 4).map((m, i) => {
                    const pct = m.adherence_pct ?? null;
                    return (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--dark-mid)', marginBottom: 4 }}>
                          <span>{m.medication_name || `Medication ${i + 1}`}</span><span>{pct != null ? `${pct}%` : '—'}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--grey-border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct || 0}%`, height: '100%', background: pct >= 85 ? 'var(--teal)' : 'var(--warning)', borderRadius: 4, transition: 'width .6s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Health Tip */}
                <div className="tip-card">
                  <h4>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" color="var(--teal)"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    AI Health Tip
                  </h4>
                  <div className="tip-body">
                    <div className="tip-tag">Preventive Care</div>
                    <div className="tip-text">Reducing refined carbohydrate intake by 30% can lower HbA1c by 0.5–1.0% within 3 months. Focus on low-GI foods such as lentils, oats, and leafy vegetables.</div>
                    <div className="tip-footer">
                      <span className="text-sm" style={{ color: 'var(--grey-text)' }}>ADA Standards of Care 2024</span>
                      <button className="btn-refresh" onClick={() => showToast('info', 'Tip', 'Refreshing health tip…')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── APPOINTMENTS ── */}
        {page === 'appts' && (
          <>
            <div className="section-head">
              <div><h2>My Appointments</h2><p>Upcoming and past clinical consultations</p></div>
            </div>
            {appts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>No appointments found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sortedAppts.map((a, i) => (
                  <div key={a.appointment_id || i} className="report-item">
                    <div className="report-icon" style={{ background: a.status === 'completed' ? 'var(--success-bg)' : 'var(--teal-light)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div className="report-info">
                      <h4>{a.type?.replace(/_/g, ' ') || 'Consultation'} — {a.doctor_name || 'Dr. R. Sharma'}</h4>
                      <p>{a.scheduled_at ? new Date(a.scheduled_at).toLocaleString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}{a.location && ` · ${a.location}`}</p>
                    </div>
                    <div className="report-meta">
                      <span className={`badge ${a.status === 'completed' ? 'badge-success' : a.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>{a.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {reportPreview && (
          <ModalPortal>
            <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setReportPreview(null)}>
              <div className="modal-box" style={{ maxWidth: 900 }}>
              <div className="modal-header">
                <div>
                  <h3>{reportPreview.report_type || reportPreview.visit_type || 'Diagnostic Report'}</h3>
                  <p className="pdf-modal-subhead">Review all report details below. Download protected PDF report.</p>
                </div>
                <button className="modal-close" onClick={() => setReportPreview(null)}>
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
                    <div>Date: {reportPreview.visit_date || reportPreview.generated_at ? new Date(reportPreview.visit_date || reportPreview.generated_at).toLocaleDateString() : '—'}</div>
                    {reportPreview.accession_number && <div>Acc: {reportPreview.accession_number}</div>}
                  </div>
                </div>
                <div className="risk-strat">
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--grey-text)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Health Score</div>
                    <div className="risk-score-big">{reportPreview.health_score ?? '—'}</div>
                  </div>
                  <div className="risk-desc">
                    <h4>{reportPreview.visit_type || reportPreview.report_type || 'Clinical Visit'}</h4>
                    <p style={{ marginTop: 6 }}>{reportPreview.summary_notes || 'No additional notes.'}</p>
                    {reportPreview.risk_tier && (
                      <div style={{ marginTop: 10 }}><span className={`badge ${reportPreview.risk_tier === 'Critical' ? 'badge-danger' : reportPreview.risk_tier === 'Borderline' ? 'badge-warning' : 'badge-success'}`}>{reportPreview.risk_tier}</span></div>
                    )}
                  </div>
                </div>
                {(reportPreview.glucose || reportPreview.hba1c || reportPreview.egfr) && (
                  <>
                    <div className="lab-section-title">Key Biomarkers</div>
                    <table className="report-table">
                      <thead><tr><th>Parameter</th><th>Value</th></tr></thead>
                      <tbody>
                        {reportPreview.glucose && <tr><td>Fasting Glucose</td><td className="val-normal">{reportPreview.glucose} mg/dL</td></tr>}
                        {reportPreview.hba1c && <tr><td>HbA1c</td><td className="val-normal">{reportPreview.hba1c}%</td></tr>}
                        {reportPreview.egfr && <tr><td>eGFR</td><td className="val-normal">{reportPreview.egfr} mL/min</td></tr>}
                        {reportPreview.bp_sys && <tr><td>Blood Pressure</td><td className="val-normal">{reportPreview.bp_sys}/{reportPreview.bp_dia} mmHg</td></tr>}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-modal btn-modal-outline" onClick={() => setReportPreview(null)}>Close</button>
                <button className="btn-modal btn-modal-filled" onClick={() => handleReportDownload(reportPreview)}>Download Secured PDF</button>
              </div>
              </div>
            </div>
          </ModalPortal>
        )}
      </div>
    </div>
  );
}