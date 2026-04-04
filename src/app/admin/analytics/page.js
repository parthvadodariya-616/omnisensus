// src/app/admin/analytics/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { ensureChartLoaded } from '@/lib/ensureChartLoaded';

export default function AdminAnalytics() {
  const [platform, setPlatform] = useState({});
  const [patients, setPatients] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const cvdRef = useRef(); const metaRef = useRef(); const renalRef = useRef(); const scoreRef = useRef();
  const charts = useRef({});

  const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const avg = (values) => {
    if (!values.length) return null;
    const total = values.reduce((s, v) => s + v, 0);
    return Math.round((total / values.length) * 10) / 10;
  };

  const deriveFromPatients = (list) => {
    const sbp = [];
    const egfr = [];
    const score = [];
    let diabeticCount = 0;
    let hypertensionCount = 0;
    let scannedThisWeek = 0;
    const hbaBuckets = [0, 0, 0, 0]; // <5.7, 5.7-6.4, 6.5-7.5, >7.5

    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    list.forEach((p) => {
      const sbpVal = toNumber(p?.blood_pressure_sys ?? p?.bp_sys);
      const egfrVal = toNumber(p?.egfr);
      const scoreVal = toNumber(p?.current_score ?? p?.health_score);
      const hba1cVal = toNumber(p?.hba1c);

      if (sbpVal != null) sbp.push(sbpVal);
      if (egfrVal != null) egfr.push(egfrVal);
      if (scoreVal != null) score.push(scoreVal);

      if (p?.known_diabetes === true) diabeticCount += 1;
      if (p?.known_hypertension === true) hypertensionCount += 1;

      if (hba1cVal != null) {
        if (hba1cVal < 5.7) hbaBuckets[0] += 1;
        else if (hba1cVal <= 6.4) hbaBuckets[1] += 1;
        else if (hba1cVal <= 7.5) hbaBuckets[2] += 1;
        else hbaBuckets[3] += 1;
      }

      const lastScan = p?.last_scan_at ? new Date(p.last_scan_at).getTime() : null;
      if (lastScan && Number.isFinite(lastScan) && now - lastScan <= weekMs) {
        scannedThisWeek += 1;
      }
    });

    return {
      avgSbp: avg(sbp),
      avgEgfr: avg(egfr),
      avgScore: avg(score),
      diabeticCount,
      hypertensionCount,
      scannedThisWeek,
      hba1cDistribution: hbaBuckets,
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [analyticsRes, patientsRes] = await Promise.allSettled([
          api.get('/admin/analytics'),
          api.get('/patients?page=1&page_size=50'),
        ]);

        if (analyticsRes.status === 'fulfilled') {
          setPlatform(analyticsRes.value.data?.platform || {});
        }
        if (patientsRes.status === 'fulfilled') {
          const list = patientsRes.value.data?.patients || patientsRes.value.data?.data || [];
          setPatients(Array.isArray(list) ? list : []);
        }
      } catch {
        setPlatform({});
        setPatients([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const derived = deriveFromPatients(patients);

    const toSeries = (input, fallbackLabels = []) => {
      if (Array.isArray(input)) {
        if (input.length === 0) return { labels: fallbackLabels, values: [] };
        if (typeof input[0] === 'number') {
          return { labels: fallbackLabels.length ? fallbackLabels : input.map((_, i) => `P${i + 1}`), values: input };
        }
        return {
          labels: input.map((x, i) => x.label ?? x.period ?? x.month ?? x.week ?? x.day ?? `P${i + 1}`),
          values: input.map(x => toNumber(x.value ?? x.count ?? x.score ?? x.avg ?? x.y ?? null)),
        };
      }
      if (input && typeof input === 'object') {
        const entries = Object.entries(input);
        if (entries.length) {
          return {
            labels: entries.map(([k]) => k),
            values: entries.map(([, v]) => toNumber(v)),
          };
        }
      }
      return { labels: fallbackLabels, values: [] };
    };

    const withFallbackPoint = (series, fallbackPoint, fallbackLabel = 'Current') => {
      if (series.values.length > 0) return series;
      if (fallbackPoint == null) return series;
      return { labels: [fallbackLabel], values: [fallbackPoint] };
    };

    let cvdSeries  = toSeries(platform?.cvd_trend || platform?.cardiovascular_trend || platform?.avg_sbp_trend, ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']);
    let renalSeries = toSeries(platform?.renal_trend || platform?.egfr_trend, Array.from({ length: 12 }, (_, i) => `W${i + 1}`));
    let scoreSeries = toSeries(platform?.score_trend || platform?.mean_score_trend, ['Oct','Nov','Dec','Jan','Feb','Mar']);

    cvdSeries = withFallbackPoint(cvdSeries, derived.avgSbp);
    renalSeries = withFallbackPoint(renalSeries, derived.avgEgfr);
    scoreSeries = withFallbackPoint(scoreSeries, derived.avgScore);

    const metabolicRaw = platform?.hba1c_distribution || platform?.metabolic_distribution;
    let metaLabels = ['<5.7%', '5.7–6.4%', '6.5–7.5%', '>7.5%'];
    let metaValues = [];
    if (Array.isArray(metabolicRaw)) {
      metaLabels = metabolicRaw.map((x, i) => x.label ?? x.bucket ?? `B${i + 1}`);
      metaValues = metabolicRaw.map(x => toNumber(x.value ?? x.count ?? 0) ?? 0);
    } else if (metabolicRaw && typeof metabolicRaw === 'object') {
      const entries = Object.entries(metabolicRaw);
      if (entries.length) {
        metaLabels = entries.map(([k]) => k);
        metaValues = entries.map(([, v]) => toNumber(v) ?? 0);
      }
    }
    if (!metaValues.length && derived.hba1cDistribution.some(v => v > 0)) {
      metaValues = derived.hba1cDistribution;
    }

    const init = () => {
      if (cancelled) return;
      const C = window.Chart; if (!C) return;
      const F = "'Montserrat',sans-serif";
      const grid = { color: 'rgba(17,24,39,.04)', drawBorder: false };
      const tick = { color: '#8A9BB0', font: { family: F, size: 10 } };
      const tt   = { backgroundColor: '#1A2733', titleFont: { family: F, size: 11 }, bodyFont: { family: F, size: 11 }, padding: 10, cornerRadius: 8 };
      const mkOrUpdate = (ref, key, cfg) => {
        if (!ref.current) return;
        if (!charts.current[key]) charts.current[key] = new C(ref.current, cfg);
        else {
          charts.current[key].data = cfg.data;
          charts.current[key].update('none');
        }
      };

      mkOrUpdate(cvdRef, 'cvd', {
        type: 'line',
        data: {
          labels: cvdSeries.labels,
          datasets: [{
            label: 'Avg Systolic BP',
            data: cvdSeries.values,
            borderColor: '#E85D6A',
            backgroundColor: 'rgba(232,93,106,.07)',
            fill: true,
            tension: .4,
            pointRadius: 3,
            pointBackgroundColor: '#E85D6A',
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: F, size: 11 } } }, tooltip: tt }, scales: { x: { grid, ticks: tick, border: { display: false } }, y: { grid, ticks: tick, border: { display: false }, min: 100, max: 160 } }, interaction: { mode: 'index', intersect: false } },
      });

      mkOrUpdate(metaRef, 'meta', {
        type: 'bar',
        data: {
          labels: metaLabels,
          datasets: [{
            label: 'Patients',
            data: metaValues,
            backgroundColor: ['#10847E', '#F59E0B', '#E85D6A', '#7C3AED'],
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tt }, scales: { x: { grid, ticks: tick, border: { display: false } }, y: { grid, ticks: tick, border: { display: false } } } },
      });

      mkOrUpdate(renalRef, 'renal', {
        type: 'line',
        data: {
          labels: renalSeries.labels,
          datasets: [{
            label: 'eGFR (mL/min)',
            data: renalSeries.values,
            borderColor: '#10847E',
            backgroundColor: 'rgba(16,132,126,.07)',
            fill: true,
            tension: .4,
            pointRadius: 3,
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tt }, scales: { x: { grid, ticks: tick, border: { display: false } }, y: { grid, ticks: tick, border: { display: false }, min: 60, max: 120 } } },
      });

      mkOrUpdate(scoreRef, 'score', {
        type: 'line',
        data: {
          labels: scoreSeries.labels,
          datasets: [{
            label: 'Mean Score',
            data: scoreSeries.values,
            borderColor: '#10847E',
            backgroundColor: 'rgba(16,132,126,.07)',
            fill: true,
            tension: .4,
            pointRadius: 4,
            pointBackgroundColor: '#10847E',
          }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: F, size: 11 } } }, tooltip: tt }, scales: { x: { grid, ticks: tick, border: { display: false } }, y: { grid, ticks: tick, border: { display: false }, min: 40, max: 100 } }, interaction: { mode: 'index', intersect: false } },
      });
    };
    ensureChartLoaded().then(() => { if (!cancelled) init(); }).catch(() => {});
    return () => {
      cancelled = true;
      const localCharts = charts.current;
      Object.values(localCharts).forEach(c => c?.destroy());
      charts.current = {};
    };
  }, [platform, patients]);

  const derived = deriveFromPatients(patients);
  const diabeticPatients =
    toNumber(platform.diabetic_count) ??
    toNumber(platform.diabetic_patients) ??
    derived.diabeticCount ??
    0;
  const hypertensionPatients =
    toNumber(platform.hypertension_count) ??
    toNumber(platform.hypertension_patients) ??
    derived.hypertensionCount ??
    0;
  const scannedThisWeek =
    toNumber(platform.scanned_this_week) ??
    toNumber(platform.weekly_scans) ??
    derived.scannedThisWeek ??
    0;
  const totalPatients =
    toNumber(platform.total_patients) ??
    toNumber(platform.patient_count) ??
    patients.length;
  const meanScore =
    toNumber(platform.mean_score) ??
    toNumber(platform.avg_health_score) ??
    derived.avgScore ??
    0;
  const criticalActive =
    toNumber(platform.critical_count) ??
    toNumber(platform.critical_active) ??
    0;

  const kpis = [
    { label: 'Total Patients', val: totalPatients, unit: '', color: 'var(--teal)' },
    { label: 'Mean Health Score', val: meanScore, unit: '/100', color: 'var(--dark)' },
    { label: 'Critical Active', val: criticalActive, unit: '', color: 'var(--danger)' },
    { label: 'Scanned This Week', val: scannedThisWeek, unit: '', color: 'var(--teal)' },
    { label: 'Diabetic Patients', val: diabeticPatients, unit: '', color: 'var(--warning)' },
    { label: 'Hypertension', val: hypertensionPatients, unit: '', color: 'var(--warning)' },
  ];

  return (
    <div className="page-wrap">
      <div className="section-head">
        <div><h2>Institutional Health Analytics</h2><p>Macro-level trend visualisation · All departments</p></div>
      </div>

      {loading && (
        <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-500)' }}>
          Loading analytics from backend...
        </div>
      )}

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-card-label">{k.label}</div>
            <div className="stat-card-val" style={{ color: k.color }}>{k.val}<span>{k.unit}</span></div>
          </div>
        ))}
      </div>

      {/* Charts 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>Cardiovascular Cohort — Avg Systolic BP</div>
          <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 14 }}>Monthly mean systolic pressure trend</div>
          <div style={{ position: 'relative', height: 200 }}><canvas ref={cvdRef} /></div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>HbA1c Distribution — Metabolic</div>
          <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 14 }}>Institutional glycaemic control profile</div>
          <div style={{ position: 'relative', height: 200 }}><canvas ref={metaRef} /></div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>Renal Filtration — eGFR Trend</div>
          <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 14 }}>12-week cohort glomerular filtration</div>
          <div style={{ position: 'relative', height: 200 }}><canvas ref={renalRef} /></div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>Population Mean Health Score</div>
          <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 14 }}>6-month trend vs target (70)</div>
          <div style={{ position: 'relative', height: 200 }}><canvas ref={scoreRef} /></div>
        </div>
      </div>
    </div>
  );
}