// src/app/doctor/dashboard/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { ensureChartLoaded } from '@/lib/ensureChartLoaded';
import { downloadReportPdf } from '@/lib/report';

const toErrorText = (detail, fallback) => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      const path = Array.isArray(first.loc) ? first.loc.slice(1).join('.') : '';
      if (typeof first.msg === 'string') return path ? `${path}: ${first.msg}` : first.msg;
      if (typeof first.message === 'string') return path ? `${path}: ${first.message}` : first.message;
    }
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg;
    if (typeof detail.message === 'string') return detail.message;
  }
  return fallback;
};

const mapVitals = (v = {}) => ({
  hr: Number(v.heart_rate ?? v.hr ?? 0),
  sbp: Number(v.blood_pressure_sys ?? v.sbp ?? v.bp_sys ?? 0),
  dbp: Number(v.blood_pressure_dia ?? v.dbp ?? v.bp_dia ?? 0),
  spo2: Number(v.spo2 ?? 0),
  temp: Number(((v.temperature ?? 0) * 10).toFixed ? (v.temperature ?? 0) * 10 : (v.temp ?? 0)),
  rr: Number(v.respiratory_rate ?? v.rr ?? 0),
  glucose: Number(v.glucose ?? 0),
  hba1c: Number(v.hba1c ?? 0),
  cholesterol: Number(v.cholesterol_total ?? v.cholesterol ?? 0),
  ldl: Number(v.ldl ?? 0),
  egfr: Number(v.egfr ?? 0),
  crp: Number(v.crp ?? 0),
  bmi: Number(v.bmi ?? 0),
  age: Number(v.age ?? 0),
  smoke: v.smoke || 'never',
  famcvd: v.famcvd || 'no',
  diabetes: v.diabetes || 'no',
  sex: v.sex || 'Male',
});

export default function DoctorDiagnostic() {
  const [step, setStep] = useState(1);
  const [vitals, setVitals] = useState(null);
  const [scores, setScores] = useState({ hs: null, cvd: null, meta: null, renal: null });
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [sel, setSel] = useState('');
  const [loadingVitals, setLoadingVitals] = useState(true);
  const [running, setRunning] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [heroVal, setHeroVal] = useState('');
  // Removed AI answer state and typewriter logic (revert)
  const donutRef = useRef();
  const donutChart = useRef(null);

  const showToast = (type, title, msg) => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Fix in src/app/doctor/dashboard/page.js:

  // Merge into single loading boolean, set false only when both complete
  // Remove the two-effect approach for patients→vitals; chain them in one useEffect
  // For the donut: don't destroy/recreate — update data in place via chart.update('none')
  useEffect(() => {
    let cancelled = false;
    setLoadingPatients(true);
    api.get('/patients?page_size=50').then(r => {
      const list = r.data?.patients || r.data?.data || [];
      if (cancelled) return;
      setPatients(list);
      const firstId = list[0]?.patient_id || '';
      setSel(firstId);
      if (!firstId) { setLoadingPatients(false); return; }

      return Promise.allSettled([
        api.get(`/patients/${firstId}/vitals`),
        api.get(`/patients/${firstId}/history`),
      ]).then(([vr, hr]) => {
        if (cancelled) return;
        if (vr.status === 'fulfilled') {
          const vv = vr.value.data?.vitals || vr.value.data || null;
          if (vv) setVitals(mapVitals(vv));
        }
        if (hr.status === 'fulfilled') {
          const visits = hr.value.data?.visits || [];
          const pat = list[0];
          if (pat?.current_score != null)
            setScores(s => ({ ...s, hs: pat.current_score }));
        }
      });
    }).catch(() => { }).finally(() => {
      if (!cancelled) setLoadingPatients(false);
    });
    return () => { cancelled = true; };
  }, []); // runs once on mount

  useEffect(() => {
    if (!sel) {
      setVitals(null);
      setLoadingVitals(false);
      return;
    }
    setLoadingVitals(true);
    Promise.allSettled([
      api.get(`/patients/${sel}/vitals`),
      api.get(`/patients/${sel}/history`),
    ]).then(([vr, hr]) => {
      const pat = patients.find(p => p.patient_id === sel);

      if (vr.status === 'fulfilled') {
        const vv = vr.value.data?.vitals || vr.value.data || null;
        if (vv) {
          const mapped = mapVitals(vv);
          setVitals({
            ...mapped,
            age: mapped.age || Number(pat?.age || 0),
            sex: mapped.sex || (pat?.gender || 'Male'),
            bmi: mapped.bmi || Number(pat?.bmi || 0),
          });
        } else {
          setVitals(null);
        }
      } else {
        setVitals(null);
      }

      if (hr.status === 'fulfilled') {
        const visits = hr.value.data?.visits || hr.value.data?.data || [];
        const latest = visits[0] || null;
        if (latest) {
          setScores(s => ({
            ...s,
            hs: latest.health_score ?? s.hs,
          }));
        }
      }

      if (pat?.current_score != null) {
        setScores(s => ({ ...s, hs: pat.current_score }));
      }
    }).finally(() => setLoadingVitals(false));
  }, [sel, patients]);

  // Donut chart init
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasSplit = Number(scores.cvd || 0) > 0 || Number(scores.meta || 0) > 0 || Number(scores.renal || 0) > 0;
    if (!hasSplit || !donutRef.current) {
      if (donutChart.current) { donutChart.current.destroy(); donutChart.current = null; }
      return;
    }
    let cancelled = false;
    const init = () => {
      if (cancelled) return;
      const C = window.Chart; if (!C) return;
      const cvd = Number(scores.cvd || 0);
      const meta = Number(scores.meta || 0);
      const renal = Number(scores.renal || 0);
      if (donutChart.current) { donutChart.current.destroy(); donutChart.current = null; }
      const F = "'Inter',sans-serif";
      donutChart.current = new C(donutRef.current, {
        type: 'doughnut',
        data: {
          labels: ['CVD', 'Metabolic', 'Renal', 'Remaining'],
          datasets: [{
            data: [cvd, meta, renal,
              Math.max(0, 100 - cvd - meta - renal)],
            backgroundColor: ['#E85D6A', '#F59E0B', '#10847E', '#F3F7FB'],
            borderWidth: 1.5, borderColor: '#E2EAF0', hoverOffset: 3,
          }],
        },
        options: {
          animation: { duration: 500, easing: 'easeOutQuart' }, responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { font: { family: F, size: 11 }, padding: 10 } },
            tooltip: { backgroundColor: '#1A2733', titleFont: { family: F }, bodyFont: { family: F }, padding: 10, cornerRadius: 8 },
          },
          cutout: '62%',
        },
      });
    };
    ensureChartLoaded().then(() => { if (!cancelled) init(); }).catch(() => { });
    return () => {
      cancelled = true;
      if (donutChart.current) { donutChart.current.destroy(); donutChart.current = null; }
    };
  }, [scores.cvd, scores.meta, scores.renal]);

  // Update donut when scores change
  useEffect(() => {
    if (!donutChart.current) return;
    const cvd = Number(scores.cvd || 0);
    const meta = Number(scores.meta || 0);
    const renal = Number(scores.renal || 0);
    donutChart.current.data.datasets[0].data = [
      cvd, meta, renal,
      Math.max(0, 100 - cvd - meta - renal),
    ];
    donutChart.current.update('none');
  }, [scores]);

  // Sanitize number input to prevent leading zeros
  const sanitizeNumberInput = v => v.replace(/^0+(?!$)/, '');
  // Always expect sanitized value in upd
  const upd = (k, v) => setVitals(p => ({ ...p, [k]: isNaN(+v) ? v : +v }));
  const nudge = (id, delta, min, max, step = 1) => {
    setVitals(prev => {
      const current = Number(prev?.[id] ?? 0);
      const precision = String(step).includes('.') ? String(step).split('.')[1].length : 0;
      const next = Math.min(max, Math.max(min, current + (delta * step)));
      return { ...prev, [id]: Number(next.toFixed(precision)) };
    });
  };

  // ── REAL API CALL ─────────────────────────────────────────────────────
  const runDiagnostic = async () => {
    if (!sel) {
      showToast('warn', 'Validation', 'Please select a patient first.');
      return;
    }
    setRunning(true);
    try {
      // Helper to ensure int fields are sent as integers
      const toIntOrNull = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : parseInt(v, 10));
      const toNumOrNull = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
      const safeTemp = toNumOrNull(vitals.temp);
      const payload = {
        patient_id: sel,
        vitals: {
          // All int fields as int, rest as float
          glucose: toNumOrNull(vitals.glucose),
          hba1c: toNumOrNull(vitals.hba1c),
          insulin: null,
          blood_pressure_sys: toIntOrNull(vitals.sbp),
          blood_pressure_dia: toIntOrNull(vitals.dbp),
          blood_pressure: toNumOrNull(vitals.sbp),
          heart_rate: toIntOrNull(vitals.hr),
          cholesterol_total: toNumOrNull(vitals.cholesterol),
          ldl: toNumOrNull(vitals.ldl),
          hdl: null,
          egfr: toNumOrNull(vitals.egfr),
          creatinine: toNumOrNull(vitals.creatinine),
          bmi: toNumOrNull(vitals.bmi),
          height_cm: null,
          weight_kg: null,
          age: toNumOrNull(vitals.age),
          spo2: toNumOrNull(vitals.spo2),
          temperature: safeTemp == null ? null : safeTemp / 10,
          hemoglobin: null,
          pregnancies: null,

          // Backward-compatible extras used by some older backend/ML builds.
          respiratory_rate: toIntOrNull(vitals.rr),
          crp: toNumOrNull(vitals.crp),
        },
      };

      // Correct endpoint: POST /diagnostics (not /diagnostics/run)
      const r = await api.post('/diagnostics', payload);
      const ml = r.data;
      setResult(ml);

      // Use real ML scores if available
      const mlScore = ml?.health_score;
      const mlDomain = ml?.domain_scores || {};
      const mlRaw = ml?.raw_risks || {};

      if (mlScore !== undefined) {
        setScores({
          hs: mlScore,
          cvd: Math.round(mlRaw.heart_pct ?? (100 - (mlDomain.cardiovascular ?? 50))),
          meta: Math.round(mlRaw.diabetes_pct ?? (100 - (mlDomain.metabolic ?? 50))),
          renal: Math.round(mlRaw.kidney_pct ?? (100 - (mlDomain.renal ?? 50))),
        });
        const tier = ml?.risk_tier || (mlScore >= 70 ? 'Stable' : mlScore >= 50 ? 'Borderline' : 'Critical');
        showToast('info', 'Diagnostic Complete', `Health Score: ${mlScore}/100 · ${tier}`);
      } else {
        showToast('warn', 'No ML Score', 'Diagnostic completed but backend did not return a score.');
      }
    } catch (err) {
      const isTimeout = err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''));
      const isNetErr = !err?.response;
      showToast(
        'warn',
        isTimeout ? 'Request Timed Out' : isNetErr ? 'Backend Unavailable' : 'Diagnostic Failed',
        isTimeout
          ? 'Diagnostic is taking longer than expected. Please retry in a few seconds.'
          : isNetErr
            ? 'Could not reach backend service. Please retry.'
            : toErrorText(err?.response?.data?.detail, 'Unable to run diagnostic with current payload.'),
      );
    } finally {
      setRunning(false);
    }
  };

  const generateAndDownloadReport = async () => {
    setPdfGenerating(true);
    try {
      const patInfo = patients.find(p => p.patient_id === sel);
      const response = await api.post('/ml/report/generate', {
        patient_id: sel || 'UNKNOWN',
        run_id: result?.run_id,
        patient_info: patInfo ? {
          full_name: patInfo.full_name,
          age: patInfo.age || vitals.age,
          gender: patInfo.gender,
          blood_group: patInfo.blood_group,
          bmi: vitals.bmi,
        } : { age: vitals.age },
        risk_data: result || {
          health_score: scores.hs,
          risk_tier: statusLabel,
          domain_scores: {
            cardiovascular: 100 - scores.cvd,
            metabolic: 100 - scores.meta,
            renal: 100 - scores.renal,
          },
        },
      });

      const payload = response?.data || {};
      const generated = payload?.report || payload?.data || payload;
      // Validate presence of PDF URL
      if (!generated?.pdf_url && !generated?.url) {
        showToast('warn', 'PDF Not Available', 'The generated report does not contain a PDF URL.');
        setPdfGenerating(false);
        return;
      }

      // Use the full generated object for downloadReportPdf
      const downloaded = await downloadReportPdf(
        generated,
        generated?.filename || generated?.report_filename || `clinical-report-${sel?.slice?.(0, 8) || 'omnisensus'}.pdf`,
      );

      if (downloaded) {
        showToast('info', 'Report Ready', 'PDF generated and download started.');
      } else {
        showToast('warn', 'Download Failed', 'PDF could not be downloaded. Please check the archive or try again.');
      }

      setPdfOpen(false);
    } catch (err) {
      showToast('warn', 'Generation Failed', 'Could not generate/download PDF right now.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const hs = typeof scores.hs === 'number' ? scores.hs : null;
  const cvdScore = Number.isFinite(Number(scores.cvd)) ? Number(scores.cvd) : 0;
  const metaScore = Number.isFinite(Number(scores.meta)) ? Number(scores.meta) : 0;
  const renalScore = Number.isFinite(Number(scores.renal)) ? Number(scores.renal) : 0;
  const hasDomainScores = cvdScore > 0 || metaScore > 0 || renalScore > 0;
  const ringColor = hs == null ? '#8A9BB0' : hs >= 70 ? '#10847E' : hs >= 50 ? '#F59E0B' : '#E85D6A';
  const ringOffset = 339.29 * (1 - (hs == null ? 0 : hs) / 100);
  const statusLabel = hs == null ? 'Awaiting Diagnostic' : hs >= 70 ? 'Optimal Range' : hs >= 50 ? 'Borderline Risk' : 'Elevated Risk';
  const statusSub = hs == null
    ? 'Run diagnostic to compute composite risk'
    : hs >= 70
      ? 'All vitals within reference bounds'
      : hs >= 50
        ? 'Intervention recommended'
        : 'Immediate clinical review required';

  const riskLevel = (v) => v > 50
    ? { cls: 'trend-up', level: 'High', icon: '↑' }
    : v > 25
      ? { cls: 'trend-neu', level: 'Borderline', icon: '—' }
      : { cls: 'trend-down', level: 'Low', icon: '↓' };

  const RangeField = ({ label, id, min, max, step = 1, value, display }) => (
    <div className="wiz-group">
      <div className="range-head">
        <label className="wiz-label">{label}</label>
        <div className="range-controls">
          <button
            type="button"
            className="range-nudge"
            onClick={() => nudge(id, -1, min, max, step)}
            aria-label={`Decrease ${label}`}
          >
            -
          </button>
          <div className="wiz-range-val">{display ? display(value) : value}</div>
          <button
            type="button"
            className="range-nudge"
            onClick={() => nudge(id, 1, min, max, step)}
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
      </div>
      <input
        type="range"
        className="wiz-input-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={e => upd(id, sanitizeNumberInput(e.currentTarget.value))}
        style={{ width: '100%' }}
      />
    </div>
  );

  return (
    <div>
      {(loadingVitals || loadingPatients) && (
        <div className="page-inner" style={{ paddingTop: 20 }}>
          {/* Hero skeleton */}
          <div style={{ background: 'var(--teal)', borderRadius: 14, padding: '28px 32px', marginBottom: 20 }}>
            <div style={{ height: 14, width: 180, borderRadius: 6, background: 'rgba(255,255,255,.2)', marginBottom: 14 }} />
            <div style={{ height: 28, width: 360, borderRadius: 8, background: 'rgba(255,255,255,.15)', marginBottom: 18 }} />
            <div style={{ height: 42, width: '100%', maxWidth: 640, borderRadius: 10, background: 'rgba(255,255,255,.12)' }} />
          </div>
          {/* Stat row skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13, marginBottom: 20 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-lg,10px)', padding: 18, boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ height: 10, width: 80, borderRadius: 5, background: 'linear-gradient(90deg,var(--bg)25%,var(--border)50%,var(--bg)75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite', marginBottom: 12 }} />
                <div style={{ height: 28, width: 100, borderRadius: 6, background: 'linear-gradient(90deg,var(--bg)25%,var(--border)50%,var(--bg)75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite', marginBottom: 8 }} />
                <div style={{ height: 10, width: 60, borderRadius: 5, background: 'linear-gradient(90deg,var(--bg)25%,var(--border)50%,var(--bg)75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite' }} />
              </div>
            ))}
          </div>
          {/* Wizard skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: 16 }}>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-lg,10px)', padding: 24, boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ height: 16, width: 220, borderRadius: 6, background: 'linear-gradient(90deg,var(--bg)25%,var(--border)50%,var(--bg)75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite', marginBottom: 20 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{ height: 60, borderRadius: 8, background: 'linear-gradient(90deg,var(--bg)25%,var(--border)50%,var(--bg)75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite' }} />
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-lg,10px)', padding: 24, boxShadow: 'var(--shadow-xs)', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 130, height: 130, borderRadius: '50%', background: 'linear-gradient(90deg,var(--bg)25%,var(--border)50%,var(--bg)75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite' }} />
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ height: 14, width: '80%', borderRadius: 6, background: 'linear-gradient(90deg,var(--bg)25%,var(--border)50%,var(--bg)75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.4s infinite' }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {!loadingVitals && !loadingPatients && !vitals && (
        <div className="page-inner" style={{ paddingTop: 30 }}>
          <div className="section-head" style={{ marginBottom: 14 }}>
            <div><h2>Diagnostic Engine</h2><p>Select a patient with available vitals to proceed.</p></div>
          </div>
          <div style={{ maxWidth: 420 }}>
            <select value={sel} onChange={e => setSel(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--bg)', color: 'var(--text-900)', fontFamily: 'inherit', outline: 'none' }}>
              <option value="">— Select patient —</option>
              {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.full_name} · {p.patient_id?.slice(0, 8)}</option>)}
            </select>
          </div>
        </div>
      )}

      {!loadingVitals && !loadingPatients && vitals && (
        <>
          {/* Toast */}
          {toast && (
            <div className="toast-container">
              <div className={`toast toast-${toast.type}`}>
                <div className="toast-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                  </svg>
                </div>
                <div className="toast-body"><h5>{toast.title}</h5><p>{toast.msg}</p></div>
              </div>
            </div>
          )}

          <div className="page-inner">
            {/* Hero — no status dot, no "Active" indicator */}
            <div className="hero-scan">
              <h1>AI-Powered <span>Risk Stratification</span> for Clinical Insights</h1>
              <div className="hero-input-bar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input value={heroVal} onChange={e => setHeroVal(e.target.value)}
                  placeholder="Search symptoms, biomarkers, or lab tests…"
                  onKeyDown={e => e.key === 'Enter' && heroVal && showToast('info', 'Symptom Query', `Analysing: "${heroVal}"`)} />

                <button className="hero-scan-btn"
                  onClick={() => heroVal && showToast('info', 'Symptom Query', `Analysing: "${heroVal}"`)}>
                  Run Scan
                </button>
              </div>
              <div className="hero-chips">
                {['Fatigue & Weakness', 'Elevated Glucose', 'Dyspnea on Exertion', 'Polyuria / Polydipsia', 'Hematuria'].map(c => (
                  <span key={c} className="hero-chip"
                    onClick={() => { setHeroVal(c); }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Live stat row */}
            <div className="stat-row">
              <div className="stat-card">
                <div className="stat-card-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                  Cardiac Rhythm
                </div>
                <div className="stat-card-val">{vitals.hr}<span>bpm</span></div>
                <div className={`stat-trend ${vitals.hr > 100 ? 'trend-up' : 'trend-down'}`}>
                  {vitals.hr > 100 ? '↑ Elevated' : '↓ Normal Sinus'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                  Arterial Pressure
                </div>
                <div className="stat-card-val">{vitals.sbp}/<span>{vitals.dbp} mmHg</span></div>
                <div className={`stat-trend ${vitals.sbp > 130 ? 'trend-up' : 'trend-down'}`}>
                  {vitals.sbp > 140 ? '↑ Hypertensive' : vitals.sbp > 130 ? '— Elevated' : '↓ Optimal'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Glycemic Index</div>
                <div className="stat-card-val">{vitals.glucose}<span>mg/dL</span></div>
                <div className={`stat-trend ${vitals.glucose > 125 ? 'trend-up' : 'trend-neu'}`}>
                  {vitals.glucose > 125 ? '↑ Diabetic' : vitals.glucose > 99 ? '— Pre-diabetic' : '— Normal'}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Composite Risk Index</div>
                <div className="stat-card-val" style={{ color: ringColor }}>{100 - scores.hs}<span>%</span></div>
                <div className={`stat-trend ${hs == null ? 'trend-neu' : hs >= 70 ? 'trend-down' : hs >= 50 ? 'trend-neu' : 'trend-up'}`}>
                  {statusLabel}
                </div>
              </div>
            </div>

            {/* Wizard + Status */}
            <div className="wizard-wrap">
              <div className="wizard-card">
                <div className="wizard-head">
                  <h3>Diagnostic Engine — 3-Step Protocol</h3>
                  <div className="wizard-steps">
                    {[{ n: 1, l: 'Vitals' }, { n: 2, l: 'Biomarkers' }, { n: 3, l: 'History' }].map((s, i) => (
                      <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
                        <div className={`w-step${step === s.n ? ' active' : step > s.n ? ' done' : ''}`}
                          onClick={() => setStep(s.n)}>
                          <div className="w-step-num">{step > s.n ? '✓' : s.n}</div>
                          <div className="w-step-label">{s.l}</div>
                        </div>
                        {i < 2 && <div className="w-step-sep" />}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="wizard-body">
                  {/* Patient selector */}
                  <div style={{ marginBottom: 16 }}>
                    <select value={sel} onChange={e => setSel(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--bg)', color: 'var(--text-900)', fontFamily: 'inherit', outline: 'none' }}>
                      <option value="">— Select patient (optional) —</option>
                      {patients.map(p => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.full_name} · {p.patient_id?.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {step === 1 && (
                    <div>
                      <div className="wizard-grid">
                        <RangeField label="Heart Rate (bpm)" id="hr" min={40} max={160} value={vitals.hr} />
                        <RangeField label="Systolic BP (mmHg)" id="sbp" min={80} max={200} value={vitals.sbp} />
                        <RangeField label="Diastolic BP (mmHg)" id="dbp" min={50} max={130} value={vitals.dbp} />
                        <RangeField label="Respiratory Rate (/min)" id="rr" min={8} max={40} value={vitals.rr} />
                        <RangeField label="Body Temp (°C)" id="temp" min={350} max={420} value={vitals.temp}
                          display={v => (v / 10).toFixed(1)} />
                        <RangeField label="SpO2 (%)" id="spo2" min={80} max={100} value={vitals.spo2} />
                      </div>
                      <div className="wizard-nav">
                        <button className="btn-wiz btn-wiz-filled" onClick={() => setStep(2)}>Next: Biomarkers →</button>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <div className="wizard-grid">
                        {[
                          { label: 'Fasting Glucose (mg/dL)', id: 'glucose', step: 1, min: 50, max: 600 },
                          { label: 'HbA1c (%)', id: 'hba1c', step: 0.1, min: 4, max: 14 },
                          { label: 'Total Cholesterol (mg/dL)', id: 'cholesterol', step: 1, min: 100, max: 400 },
                          { label: 'LDL-C (mg/dL)', id: 'ldl', step: 1, min: 50, max: 300 },
                          { label: 'eGFR (mL/min)', id: 'egfr', step: 1, min: 10, max: 120 },
                          { label: 'CRP (mg/L)', id: 'crp', step: 0.1, min: 0, max: 100 },
                        ].map(f => (
                          <div key={f.id} className="wiz-group">
                            <label className="wiz-label">{f.label}</label>
                            <input type="number" className="wiz-input"
                              value={vitals[f.id]} step={f.step} min={f.min} max={f.max}
                              onChange={e => upd(f.id, sanitizeNumberInput(e.target.value))} />
                          </div>
                        ))}
                      </div>
                      <div className="wizard-nav">
                        <button className="btn-wiz btn-wiz-outline" onClick={() => setStep(1)}>← Back</button>
                        <button className="btn-wiz btn-wiz-filled" onClick={() => setStep(3)}>Next: History →</button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <div className="wizard-grid">
                        <div className="wiz-group">
                          <label className="wiz-label">Age (years)</label>
                          <input type="number" className="wiz-input" value={vitals.age} min={18} max={120}
                            onChange={e => upd('age', sanitizeNumberInput(e.target.value))} />
                        </div>
                        <div className="wiz-group">
                          <label className="wiz-label">Sex at Birth</label>
                          <select className="wiz-input" value={vitals.sex || 'Male'}
                            onChange={e => upd('sex', e.target.value)}>
                            <option>Male</option><option>Female</option><option>Other</option>
                          </select>
                        </div>
                        <div className="wiz-group">
                          <label className="wiz-label">BMI</label>
                          <input type="number" className="wiz-input" value={vitals.bmi} step={0.1} min={10} max={60}
                            onChange={e => upd('bmi', sanitizeNumberInput(e.target.value))} />
                        </div>
                        <div className="wiz-group">
                          <label className="wiz-label">Smoking Status</label>
                          <select className="wiz-input" value={vitals.smoke} onChange={e => upd('smoke', e.target.value)}>
                            <option value="never">Never</option>
                            <option value="former">Former</option>
                            <option value="current">Current</option>
                          </select>
                        </div>
                        <div className="wiz-group">
                          <label className="wiz-label">Familial CVD History</label>
                          <select className="wiz-input" value={vitals.famcvd} onChange={e => upd('famcvd', e.target.value)}>
                            <option value="no">No</option><option value="yes">Yes</option>
                          </select>
                        </div>
                        <div className="wiz-group">
                          <label className="wiz-label">Metabolic Pathogenesis</label>
                          <select className="wiz-input" value={vitals.diabetes} onChange={e => upd('diabetes', e.target.value)}>
                            <option value="no">No</option>
                            <option value="pre">Pre-condition</option>
                            <option value="t2">Type II</option>
                          </select>
                        </div>
                      </div>
                      <div className="wizard-nav">
                        <button className="btn-wiz btn-wiz-outline" onClick={() => setStep(2)}>← Back</button>
                        <button className="btn-wiz btn-wiz-filled" disabled={running} onClick={runDiagnostic}>
                          {running ? 'Running…' : '⚡ Run Diagnostic'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Card */}
              <div className="status-card">
                <h4>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Health Status Card
                </h4>

                <div className="status-ring-wrap">
                  <div className="status-ring">
                    <svg className="ring-svg" width="130" height="130" viewBox="0 0 130 130">
                      <circle className="ring-bg" cx="65" cy="65" r="54" />
                      <circle className="ring-fill" cx="65" cy="65" r="54"
                        style={{
                          stroke: ringColor, strokeDashoffset: ringOffset,
                          transition: 'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1), stroke .4s'
                        }} />
                    </svg>
                    <div className="ring-center">
                      <div className="ring-pct" style={{ color: ringColor }}>{hs == null ? '—' : hs}</div>
                      <div className="ring-unit">Health Score</div>
                    </div>
                  </div>
                  <div className="status-label" style={{ color: ringColor }}>{statusLabel}</div>
                  <div className="status-sub">{statusSub}</div>
                </div>

                {/* Domain trend rows */}
                <div className="status-trend-bar">
                  {[
                    { metric: 'Cardiovascular', ...riskLevel(cvdScore) },
                    { metric: 'Metabolic', ...riskLevel(metaScore) },
                    { metric: 'Renal', ...riskLevel(renalScore) },
                  ].map(t => (
                    <div key={t.metric} className="status-trend-row">
                      <span className="stl">{t.metric}</span>
                      <span className={`str ${t.cls}`}>{t.icon} {t.level}</span>
                    </div>
                  ))}
                </div>

                {/* Risk bars */}
                <div className="risk-bars">
                  {[
                    { label: 'Cardiovascular', val: cvdScore, color: cvdScore > 50 ? '#E85D6A' : cvdScore > 25 ? '#F59E0B' : '#10847E' },
                    { label: 'Metabolic', val: metaScore, color: metaScore > 50 ? '#E85D6A' : metaScore > 25 ? '#F59E0B' : '#10847E' },
                    { label: 'Renal', val: renalScore, color: renalScore > 50 ? '#E85D6A' : renalScore > 25 ? '#F59E0B' : '#10847E' },
                  ].map(b => (
                    <div key={b.label} className="risk-item">
                      <div className="risk-head"><span>{b.label}</span><span style={{ color: b.color }}>{b.val}%</span></div>
                      <div className="risk-track">
                        <div className="risk-fill" style={{ width: `${b.val}%`, background: b.color }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Donut chart */}
                {hasDomainScores && (
                  <div style={{ position: 'relative', height: 180, marginBottom: 16 }}>
                    <canvas ref={donutRef} />
                  </div>
                )}

                {/* ML result flags */}
                {result?.clinical_flags?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    {result.clinical_flags.slice(0, 2).map((f, i) => (
                      <div key={i} style={{
                        padding: '8px 10px', marginBottom: 6, borderRadius: 8,
                        background: f.severity === 'critical' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                        border: `1px solid ${f.severity === 'critical' ? '#FCA5A5' : '#FDE68A'}`,
                        fontSize: 11, color: f.severity === 'critical' ? 'var(--danger)' : 'var(--warning)',
                        fontWeight: 600,
                      }}>
                        ⚠ {f.domain}: {f.message?.slice(0, 80)}…
                      </div>
                    ))}
                  </div>
                )}

                <button className="btn-report" onClick={() => setPdfOpen(true)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  Generate Clinical Report
                </button>
              </div>
            </div>
          </div>

          {/* PDF Preview Modal */}
          {pdfOpen && (
            <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setPdfOpen(false)}>
              <div className="modal-box">
                <div className="modal-header">
                  <div>
                    <h3>Clinical Diagnostic Report Preview</h3>
                    <p className="pdf-modal-subhead">Generate polished PDF and download instantly</p>
                  </div>
                  <button className="modal-close" onClick={() => setPdfOpen(false)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="lab-report">
                  <div className="lab-report-header">
                    <div>
                      <div className="lab-report-brand">Omni<span>Sensus</span> Medical</div>
                      <div style={{ fontSize: 11, color: 'var(--text-500)', marginTop: 4 }}>AI-Powered Clinical Diagnostic Report</div>
                    </div>
                    <div className="lab-report-meta">
                      <div>Report ID: OSM-{Date.now().toString().slice(-8)}</div>
                      <div>Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                      <div>Engine: OmniSensus v3.0.1</div>
                    </div>
                  </div>
                  <div className="lab-report-pid">
                    <div className="pid-item"><label>Patient</label><span>{patients.find(p => p.patient_id === sel)?.full_name || 'Unknown'}</span></div>
                    <div className="pid-item"><label>ID</label><span>{sel?.slice(0, 8) || 'N/A'}</span></div>
                    <div className="pid-item"><label>Age / Sex</label><span>{vitals.age} yrs / {vitals.sex || 'M'}</span></div>
                    <div className="pid-item"><label>BMI</label><span>{vitals.bmi} kg/m²</span></div>
                    <div className="pid-item"><label>Score</label><span style={{ color: ringColor, fontWeight: 700 }}>{scores.hs}/100</span></div>
                    <div className="pid-item"><label>Risk Tier</label>
                      <span className={`badge ${hs == null ? 'badge-grey' : hs >= 70 ? 'badge-success' : hs >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                        {hs == null ? 'Unknown' : hs >= 70 ? 'Stable' : hs >= 50 ? 'Borderline' : 'Critical'}
                      </span>
                    </div>
                  </div>

                  <div className="lab-section-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                    Vital Signs
                  </div>
                  <table className="report-table">
                    <thead><tr><th>Parameter</th><th>Value</th><th>Reference</th><th>Status</th></tr></thead>
                    <tbody>
                      <tr><td>Heart Rate</td><td className={vitals.hr <= 100 ? 'val-normal' : 'val-high'}>{vitals.hr} bpm</td><td>60–100</td><td>{vitals.hr <= 100 ? 'Normal' : 'Elevated'}</td></tr>
                      <tr><td>Systolic BP</td><td className={vitals.sbp <= 130 ? 'val-normal' : 'val-high'}>{vitals.sbp} mmHg</td><td>90–130</td><td>{vitals.sbp <= 120 ? 'Optimal' : vitals.sbp <= 130 ? 'Normal' : 'Elevated'}</td></tr>
                      <tr><td>SpO2</td><td className={vitals.spo2 >= 95 ? 'val-normal' : 'val-high'}>{vitals.spo2}%</td><td>≥95%</td><td>{vitals.spo2 >= 95 ? 'Normal' : 'Low'}</td></tr>
                    </tbody>
                  </table>

                  <div className="lab-section-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18" /></svg>
                    Biomarker Panel
                  </div>
                  <table className="report-table">
                    <thead><tr><th>Analyte</th><th>Result</th><th>Reference</th><th>Flag</th></tr></thead>
                    <tbody>
                      <tr><td>Fasting Glucose</td><td className={vitals.glucose <= 99 ? 'val-normal' : vitals.glucose <= 125 ? 'val-borderline' : 'val-high'}>{vitals.glucose} mg/dL</td><td>70–99</td><td>{vitals.glucose <= 99 ? 'Normal' : vitals.glucose <= 125 ? 'Pre-diabetic' : 'Diabetic'}</td></tr>
                      <tr><td>HbA1c</td><td className={vitals.hba1c < 5.7 ? 'val-normal' : vitals.hba1c < 6.5 ? 'val-borderline' : 'val-high'}>{vitals.hba1c}%</td><td>&lt;5.7%</td><td>{vitals.hba1c < 5.7 ? 'Normal' : vitals.hba1c < 6.5 ? 'Pre-diabetic' : 'Diabetic'}</td></tr>
                      <tr><td>Cholesterol</td><td className={vitals.cholesterol < 200 ? 'val-normal' : 'val-borderline'}>{vitals.cholesterol} mg/dL</td><td>&lt;200</td><td>{vitals.cholesterol < 200 ? 'Desirable' : 'Borderline'}</td></tr>
                      <tr><td>LDL</td><td className={vitals.ldl < 130 ? 'val-normal' : 'val-high'}>{vitals.ldl} mg/dL</td><td>&lt;130</td><td>{vitals.ldl < 100 ? 'Optimal' : vitals.ldl < 130 ? 'Near Optimal' : 'Elevated'}</td></tr>
                      <tr><td>eGFR</td><td className={vitals.egfr >= 60 ? 'val-normal' : 'val-high'}>{vitals.egfr} mL/min</td><td>≥60</td><td>{vitals.egfr >= 90 ? 'Normal' : vitals.egfr >= 60 ? 'G2' : vitals.egfr >= 45 ? 'G3a' : 'G3b+'}</td></tr>
                    </tbody>
                  </table>

                  <div className="risk-strat">
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>Composite Score</div>
                      <div className="risk-score-big" style={{ color: ringColor }}>{scores.hs}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-500)', marginTop: 2 }}>Out of 100</div>
                    </div>
                    <div className="risk-desc">
                      <h4>{statusLabel}</h4>
                      <p>CVD: {scores.cvd}% · Metabolic: {scores.meta}% · Renal: {scores.renal}%</p>
                      <div style={{ marginTop: 8 }}>
                        <span className={`badge ${scores.hs >= 70 ? 'badge-success' : scores.hs >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                          {scores.hs >= 70 ? 'Low Risk' : scores.hs >= 50 ? 'Borderline' : 'Elevated Risk'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-modal btn-modal-outline" onClick={() => setPdfOpen(false)}>Close</button>
                  <button className="btn-modal btn-modal-outline" onClick={() => { window.location.href = '/doctor/reports'; }}>
                    Open Reports
                  </button>
                  <button className="btn-modal btn-modal-filled"
                    disabled={pdfGenerating}
                    onClick={generateAndDownloadReport}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ marginRight: 5 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {pdfGenerating ? 'Generating...' : 'Generate PDF'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}