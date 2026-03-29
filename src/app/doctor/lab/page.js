// src/app/doctor/lab/page.js
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { ensureChartLoaded } from '@/lib/ensureChartLoaded';

// ── Skeleton block ──────────────────────────────────────────────────────────
function Skeleton({ h = 16, w = '100%', radius = 6, style = {} }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: radius,
      background: 'linear-gradient(90deg,var(--bg,#f4f7fa) 25%,var(--border,#e2eaf0) 50%,var(--bg,#f4f7fa) 75%)',
      backgroundSize: '800px 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  );
}

// ── Loading overlay for chart containers ────────────────────────────────────
function ChartSkeleton({ height = 200 }) {
  return (
    <div style={{ height, display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      <Skeleton h={height - 30} radius={8} />
      <div style={{ display: 'flex', gap: 12 }}>
        <Skeleton h={10} w={80} />
        <Skeleton h={10} w={60} />
      </div>
    </div>
  );
}

const CHART_FONT = "'Montserrat',sans-serif";
const TOOLTIP_STYLE = {
  backgroundColor: '#1A2733',
  titleFont: { family: CHART_FONT, size: 11 },
  bodyFont: { family: CHART_FONT, size: 11 },
  padding: 10,
  cornerRadius: 8,
};
const GRID_SCALES = () => ({
  x: { grid: { color: 'rgba(17,24,39,.04)' }, ticks: { color: '#8A9BB0', font: { family: CHART_FONT, size: 10 } }, border: { display: false } },
  y: { grid: { color: 'rgba(17,24,39,.04)' }, ticks: { color: '#8A9BB0', font: { family: CHART_FONT, size: 10 } }, border: { display: false } },
});

export default function DoctorLab() {
  const [patients,     setPatients]     = useState([]);
  const [selPat,       setSelPat]       = useState('');
  const [vitals,       setVitals]       = useState(null);
  const [history,      setHistory]      = useState([]);
  const [loadingPats,  setLoadingPats]  = useState(true);
  const [loadingData,  setLoadingData]  = useState(false);
  const [chartsReady,  setChartsReady]  = useState(false);

  const cvdRef   = useRef(); const gluRef  = useRef(); const renalRef = useRef();
  const charts   = useRef({});

  // ── load patients ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingPats(true);
    api.get('/patients?page_size=50')
      .then(r => {
        const list = r.data?.patients || r.data?.data || [];
        setPatients(list);
        if (list.length > 0) setSelPat(list[0].patient_id);
      })
      .catch(() => {})
      .finally(() => setLoadingPats(false));
  }, []);

  // ── load vitals + history on patient change ────────────────────────────────
  useEffect(() => {
    if (!selPat) { setVitals(null); setHistory([]); return; }
    setLoadingData(true);
    setChartsReady(false);
    Promise.allSettled([
      api.get(`/patients/${selPat}/vitals`),
      api.get(`/patients/${selPat}/history`),
    ]).then(([vr, hr]) => {
      setVitals(vr.status === 'fulfilled' ? (vr.value.data?.vitals || vr.value.data || null) : null);
      setHistory(hr.status === 'fulfilled' ? (hr.value.data?.visits || hr.value.data?.data || []) : []);
    }).finally(() => setLoadingData(false));
  }, [selPat]);

  // ── draw / update charts ───────────────────────────────────────────────────
  const drawCharts = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const visits = history.slice().reverse();
    const safeDateLabel = (v, i) => {
      const raw = v?.visit_date || v?.created_at || v?.recorded_at || null;
      if (!raw) return `V${i + 1}`;
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? `V${i + 1}` : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    let labels   = visits.map(safeDateLabel);
    let hrSeries = visits.map(v => v.heart_rate ?? null);
    let sbpSeries = visits.map(v => v.bp_sys ?? v.blood_pressure_sys ?? null);
    let gluSeries = visits.map(v => v.glucose ?? null);
    let ppgSeries = visits.map(v => v.glucose_postprandial ?? null);
    let egfrSeries = visits.map(v => v.egfr ?? null);

    // fallback to single-point snapshot
    if (labels.length === 0 && vitals) {
      labels    = ['Latest'];
      hrSeries  = [vitals.heart_rate ?? null];
      sbpSeries = [vitals.bp_sys ?? vitals.blood_pressure_sys ?? null];
      gluSeries = [vitals.glucose ?? null];
      ppgSeries = [vitals.glucose_postprandial ?? null];
      egfrSeries = [vitals.egfr ?? null];
    }

    try {
      const C = await ensureChartLoaded();
      if (!C) return;

      const mkOrUpdate = (ref, key, cfg) => {
        if (!ref.current) return;
        if (charts.current[key]) {
          charts.current[key].data = cfg.data;
          charts.current[key].update('active');
        } else {
          charts.current[key] = new C(ref.current, cfg);
        }
      };

      mkOrUpdate(cvdRef, 'cvd', {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'HR (bpm)', data: hrSeries, borderColor: '#10847E', backgroundColor: 'rgba(16,132,126,.10)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#10847E', pointHoverRadius: 6 },
            { label: 'SBP (mmHg)', data: sbpSeries, borderColor: '#E85D6A', borderDash: [4, 3], tension: .4, pointRadius: 4, pointBackgroundColor: '#E85D6A', pointHoverRadius: 6 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 600, easing: 'easeOutQuart' }, plugins: { legend: { labels: { font: { family: CHART_FONT, size: 11 } } }, tooltip: TOOLTIP_STYLE }, scales: GRID_SCALES(), interaction: { mode: 'index', intersect: false } },
      });

      mkOrUpdate(gluRef, 'glu', {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Fasting Glucose', data: gluSeries, borderColor: '#E85D6A', backgroundColor: 'rgba(232,93,106,.10)', fill: true, tension: .45, pointRadius: 4, pointHoverRadius: 6 },
            { label: 'Postprandial', data: ppgSeries, borderColor: '#10847E', tension: .45, pointRadius: 4, pointHoverRadius: 6 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 600, easing: 'easeOutQuart' }, plugins: { legend: { labels: { font: { family: CHART_FONT, size: 11 } } }, tooltip: TOOLTIP_STYLE }, scales: { ...GRID_SCALES(), y: { ...GRID_SCALES().y, min: 70, max: 180 } }, interaction: { mode: 'index', intersect: false } },
      });

      mkOrUpdate(renalRef, 'renal', {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'eGFR (mL/min)', data: egfrSeries, borderColor: '#10847E', backgroundColor: 'rgba(16,132,126,.10)', fill: true, tension: .38, pointRadius: 4, pointHoverRadius: 6 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, animation: { duration: 600, easing: 'easeOutQuart' }, plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE }, scales: { ...GRID_SCALES(), y: { ...GRID_SCALES().y, min: 50, max: 120 } } },
      });

      setChartsReady(true);
    } catch (e) {
      console.warn('[Lab] Chart render failed:', e);
    }
  }, [history, vitals]);

  useEffect(() => {
    if (!loadingData) drawCharts();
    return () => {
      Object.values(charts.current).forEach(c => { try { c?.destroy(); } catch {} });
      charts.current = {};
      setChartsReady(false);
    };
  }, [loadingData, drawCharts]);

  // ── biomarker table ────────────────────────────────────────────────────────
  const v = vitals || {};
  const bioRows = [
    { name: 'Fasting Glucose',    val: v.glucose,           unit: 'mg/dL',  ref: '70–99',   flag: !v.glucose ? 'na' : v.glucose <= 99 ? 'normal' : v.glucose <= 125 ? 'borderline' : 'high' },
    { name: 'HbA1c',              val: v.hba1c,             unit: '%',       ref: '<5.7',    flag: !v.hba1c  ? 'na' : v.hba1c < 5.7 ? 'normal' : v.hba1c < 6.5 ? 'borderline' : 'high' },
    { name: 'Total Cholesterol',  val: v.cholesterol_total, unit: 'mg/dL',  ref: '<200',    flag: !v.cholesterol_total ? 'na' : v.cholesterol_total < 200 ? 'normal' : 'borderline' },
    { name: 'LDL-Cholesterol',    val: v.ldl,               unit: 'mg/dL',  ref: '<130',    flag: !v.ldl ? 'na' : v.ldl < 130 ? 'normal' : 'high' },
    { name: 'eGFR (Renal)',       val: v.egfr,              unit: 'mL/min', ref: '≥60',     flag: !v.egfr ? 'na' : v.egfr >= 60 ? 'normal' : 'high' },
    { name: 'C-Reactive Protein', val: v.crp,               unit: 'mg/L',   ref: '<3.0',    flag: !v.crp ? 'na' : v.crp < 3 ? 'normal' : v.crp < 10 ? 'borderline' : 'high' },
    { name: 'Serum Creatinine',   val: v.creatinine,        unit: 'mg/dL',  ref: '0.7–1.2', flag: !v.creatinine ? 'na' : v.creatinine <= 1.2 ? 'normal' : 'high' },
  ];
  const flagCls   = f => ({ na: 'badge-flat', normal: 'badge-success', borderline: 'badge-warning', high: 'badge-danger' }[f] || 'badge-flat');
  const flagLabel = f => ({ na: '—', normal: 'Normal', borderline: 'Borderline', high: 'Elevated' }[f] || '—');

  return (
    <div className="page-inner">
      {/* ── Header ── */}
      <div className="section-head">
        <div>
          <h2>AI Biomarker Laboratory</h2>
          <p>Real-time pathological trend analysis with automated risk stratification</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {loadingPats ? (
            <Skeleton h={34} w={200} radius={8} />
          ) : (
            <select
              value={selPat}
              onChange={e => setSelPat(e.target.value)}
              style={{ padding: '7px 12px', border: '1.5px solid var(--grey-border,#E2EAF0)', borderRadius: 8, fontSize: 12, background: 'var(--grey-bg,#f4f7fa)', color: 'var(--dark,#1A2733)', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Select patient</option>
              {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.full_name}</option>)}
            </select>
          )}
          <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5"/></svg>
            Live Feed
          </span>
        </div>
      </div>

      {/* ── Lab Grid ── */}
      <div className="lab-grid">

        {/* CVD Chart */}
        <div className="lab-card">
          <div className="lab-card-head">
            <div className="lab-icon lab-icon-teal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div>
              <h4>Cardiovascular Hemodynamics</h4>
              <p>Cardiac rhythm &amp; arterial pressure trend</p>
            </div>
          </div>
          <div className="chart-container" style={{ position: 'relative' }}>
            {loadingData && <ChartSkeleton height={200} />}
            <canvas ref={cvdRef} style={{ display: loadingData ? 'none' : 'block' }} />
          </div>
        </div>

        {/* Glucose Chart */}
        <div className="lab-card">
          <div className="lab-card-head">
            <div className="lab-icon lab-icon-warn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            </div>
            <div>
              <h4>Metabolic Pathogenesis — Glycemic Panel</h4>
              <p>Fasting glucose &amp; postprandial index</p>
            </div>
          </div>
          <div className="chart-container" style={{ position: 'relative' }}>
            {loadingData && <ChartSkeleton height={200} />}
            <canvas ref={gluRef} style={{ display: loadingData ? 'none' : 'block' }} />
          </div>
        </div>

        {/* Biomarker Table */}
        <div className="lab-card">
          <div className="lab-card-head">
            <div className="lab-icon lab-icon-grey">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
            </div>
            <div>
              <h4>Complete Metabolic Panel</h4>
              <p>Latest laboratory reference values</p>
            </div>
          </div>
          {loadingData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(7)].map((_, i) => <Skeleton key={i} h={28} radius={6} />)}
            </div>
          ) : (
            <table className="bio-table">
              <thead>
                <tr><th>Analyte</th><th>Result</th><th>Reference</th><th>Status</th></tr>
              </thead>
              <tbody>
                {bioRows.map(r => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td><span className="bio-val">{r.val != null ? r.val : '—'}</span>{r.val != null ? ` ${r.unit}` : ''}</td>
                    <td className="bio-ref">{r.ref}</td>
                    <td><span className={`badge ${flagCls(r.flag)}`}>{flagLabel(r.flag)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* eGFR Chart */}
        <div className="lab-card">
          <div className="lab-card-head">
            <div className="lab-icon lab-icon-danger">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <h4>Renal Filtration Index — eGFR</h4>
              <p>Glomerular filtration rate surveillance</p>
            </div>
          </div>
          <div className="chart-container-sm" style={{ position: 'relative' }}>
            {loadingData && <ChartSkeleton height={165} />}
            <canvas ref={renalRef} style={{ display: loadingData ? 'none' : 'block' }} />
          </div>
        </div>

      </div>
    </div>
  );
}
