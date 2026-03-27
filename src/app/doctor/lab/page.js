// src/app/doctor/lab/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { ensureChartLoaded } from '@/lib/ensureChartLoaded';

export default function DoctorLab() {
  const [patients,  setPatients]  = useState([]);
  const [selPat,    setSelPat]    = useState('');
  const [vitals,    setVitals]    = useState(null);
  const [history,   setHistory]   = useState([]);
  const cvdRef = useRef(); const gluRef = useRef(); const renalRef = useRef();
  const charts = useRef({});

  useEffect(() => {
    api.get('/patients?page_size=50').then(r => {
      const list = r.data?.patients || r.data?.data || [];
      setPatients(list);
      if (list.length > 0) setSelPat(list[0].patient_id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selPat) {
      setVitals(null);
      setHistory([]);
      return;
    }
    Promise.allSettled([
      api.get(`/patients/${selPat}/vitals`),
      api.get(`/patients/${selPat}/history`),
    ]).then(([vr, hr]) => {
      if (vr.status === 'fulfilled') setVitals(vr.value.data?.vitals || vr.value.data || null);
      else setVitals(null);
      if (hr?.status === 'fulfilled') setHistory(hr.value.data?.visits || hr.value.data?.data || []);
      else setHistory([]);
    });
  }, [selPat]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const visits = history.slice().reverse();
    const safeDateLabel = (v, i) => {
      const raw = v?.visit_date || v?.created_at || v?.recorded_at || null;
      if (!raw) return `V${i + 1}`;
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? `V${i + 1}` : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    };

    let labels = visits.map((v, i) => safeDateLabel(v, i));
    let hrSeries = visits.map(v => v.heart_rate ?? null);
    let sbpSeries = visits.map(v => v.bp_sys ?? v.blood_pressure_sys ?? null);
    let gluSeries = visits.map(v => v.glucose ?? null);
    let ppgSeries = visits.map(v => v.glucose_postprandial ?? null);
    let egfrSeries = visits.map(v => v.egfr ?? null);

    // If longitudinal history is missing, render a one-point snapshot from latest vitals.
    if (labels.length === 0 && vitals) {
      labels = ['Latest'];
      hrSeries = [vitals.heart_rate ?? null];
      sbpSeries = [vitals.bp_sys ?? vitals.blood_pressure_sys ?? null];
      gluSeries = [vitals.glucose ?? null];
      ppgSeries = [vitals.glucose_postprandial ?? null];
      egfrSeries = [vitals.egfr ?? null];
    }

    const init = () => {
      if (cancelled) return;
      const C = window.Chart; if (!C) return;
      const F = "'Montserrat',sans-serif";
      const gs = () => ({ x: { grid: { color: 'rgba(17,24,39,.04)' }, ticks: { color: '#8A9BB0', font: { family: F, size: 10 } }, border: { display: false } }, y: { grid: { color: 'rgba(17,24,39,.04)' }, ticks: { color: '#8A9BB0', font: { family: F, size: 10 } }, border: { display: false } } });
      const tt = { backgroundColor: '#1A2733', titleFont: { family: F, size: 11 }, bodyFont: { family: F, size: 11 }, padding: 10, cornerRadius: 8 };
      const mkOrUpdate = (ref, key, cfg) => {
        if (!ref.current) return;
        if (!charts.current[key]) charts.current[key] = new C(ref.current, cfg);
        else {
          charts.current[key].data = cfg.data;
          charts.current[key].update('none');
        }
      };

      mkOrUpdate(cvdRef, 'cvd', { type: 'line', data: { labels, datasets: [{ label: 'HR (bpm)', data: hrSeries, borderColor: '#10847E', backgroundColor: 'rgba(16,132,126,.07)', fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#10847E' }, { label: 'SBP (mmHg)', data: sbpSeries, borderColor: '#E85D6A', borderDash: [4, 3], tension: .4, pointRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: F, size: 11 } } }, tooltip: tt }, scales: gs(), interaction: { mode: 'index', intersect: false } } });

      mkOrUpdate(gluRef, 'glu', { type: 'line', data: { labels, datasets: [{ label: 'Fasting Glucose', data: gluSeries, borderColor: '#E85D6A', backgroundColor: 'rgba(232,93,106,.07)', fill: true, tension: .45, pointRadius: 3 }, { label: 'Postprandial', data: ppgSeries, borderColor: '#10847E', tension: .45, pointRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: F, size: 11 } } }, tooltip: tt }, scales: { ...gs(), y: { ...gs().y, min: 70, max: 180 } }, interaction: { mode: 'index', intersect: false } } });

      mkOrUpdate(renalRef, 'renal', { type: 'line', data: { labels, datasets: [{ label: 'eGFR (mL/min)', data: egfrSeries, borderColor: '#10847E', backgroundColor: 'rgba(16,132,126,.07)', fill: true, tension: .38, pointRadius: 3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tt }, scales: { ...gs(), y: { ...gs().y, min: 50, max: 120 } } } });
    };
    ensureChartLoaded().then(() => { if (!cancelled) init(); }).catch(() => {});
    return () => {
      cancelled = true;
      const localCharts = charts.current;
      Object.values(localCharts).forEach(c => c?.destroy());
    };
  }, [history, vitals]);

  const v = vitals || {};
  const bioRows = [
    { name: 'Fasting Glucose', val: v.glucose, unit: 'mg/dL', ref: '70–99', flag: v.glucose <= 99 ? 'normal' : v.glucose <= 125 ? 'borderline' : 'high' },
    { name: 'HbA1c', val: v.hba1c, unit: '%', ref: '<5.7', flag: v.hba1c < 5.7 ? 'normal' : v.hba1c < 6.5 ? 'borderline' : 'high' },
    { name: 'Total Cholesterol', val: v.cholesterol_total, unit: 'mg/dL', ref: '<200', flag: v.cholesterol_total < 200 ? 'normal' : 'borderline' },
    { name: 'LDL-Cholesterol', val: v.ldl, unit: 'mg/dL', ref: '<130', flag: v.ldl < 130 ? 'normal' : 'high' },
    { name: 'eGFR (Renal)', val: v.egfr, unit: 'mL/min', ref: '≥60', flag: v.egfr >= 60 ? 'normal' : 'high' },
    { name: 'C-Reactive Protein', val: v.crp, unit: 'mg/L', ref: '<3.0', flag: !v.crp || v.crp < 3 ? 'normal' : v.crp < 10 ? 'borderline' : 'high' },
    { name: 'Serum Creatinine', val: v.creatinine, unit: 'mg/dL', ref: '0.7–1.2', flag: !v.creatinine || v.creatinine <= 1.2 ? 'normal' : 'high' },
  ];
  const flagBadge = f => f === 'normal' ? 'badge-success' : f === 'borderline' ? 'badge-warning' : 'badge-danger';
  const flagLabel = f => f === 'normal' ? 'Normal' : f === 'borderline' ? 'Borderline' : 'Elevated';

  return (
    <div className="page-inner">
      <div className="section-head">
        <div><h2>AI Biomarker Laboratory</h2><p>Real-time pathological trend analysis with automated risk stratification</p></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={selPat} onChange={e => setSelPat(e.target.value)}
            style={{ padding: '7px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }}>
            <option value="">Select patient</option>
            {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.full_name}</option>)}
          </select>
          <span className="badge badge-success"><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5"/></svg>Live Feed</span>
        </div>
      </div>

      <div className="lab-grid">
        <div className="lab-card">
          <div className="lab-card-head">
            <div className="lab-icon lab-icon-teal"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
            <div><h4>Cardiovascular Hemodynamics — Trend</h4><p>Cardiac rhythm & arterial pressure over 7-day period</p></div>
          </div>
          <div className="chart-container"><canvas ref={cvdRef} /></div>
        </div>
        <div className="lab-card">
          <div className="lab-card-head">
            <div className="lab-icon lab-icon-warn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg></div>
            <div><h4>Metabolic Pathogenesis — Glycemic Panel</h4><p>Fasting glucose & postprandial index over 30-day cycle</p></div>
          </div>
          <div className="chart-container"><canvas ref={gluRef} /></div>
        </div>
        <div className="lab-card">
          <div className="lab-card-head">
            <div className="lab-icon lab-icon-grey"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg></div>
            <div><h4>Complete Metabolic Panel</h4><p>Latest laboratory reference values</p></div>
          </div>
          <table className="bio-table">
            <thead><tr><th>Analyte</th><th>Result</th><th>Reference</th><th>Status</th></tr></thead>
            <tbody>
              {bioRows.map(r => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td><span className="bio-val">{r.val ?? '—'}</span> {r.unit}</td>
                  <td className="bio-ref">{r.ref}</td>
                  <td><span className={`badge ${flagBadge(r.flag)}`}>{flagLabel(r.flag)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="lab-card">
          <div className="lab-card-head">
            <div className="lab-icon lab-icon-danger"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
            <div><h4>Renal Filtration Index — eGFR Trend</h4><p>Glomerular filtration rate over 12-week surveillance</p></div>
          </div>
          <div className="chart-container-sm"><canvas ref={renalRef} /></div>
        </div>
      </div>
    </div>
  );
}