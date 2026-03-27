// src/app/admin/analytics/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { ensureChartLoaded } from '@/lib/ensureChartLoaded';

export default function AdminAnalytics() {
  const [platform, setPlatform] = useState({});
  const [loading,  setLoading]  = useState(true);
  const cvdRef = useRef(); const metaRef = useRef(); const renalRef = useRef(); const scoreRef = useRef();
  const charts = useRef({});

  useEffect(() => {
    api.get('/admin/analytics')
      .then(r => setPlatform(r.data?.platform || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const toSeries = (input, fallbackLabels = []) => {
      if (Array.isArray(input)) {
        if (input.length === 0) return { labels: fallbackLabels, values: [] };
        if (typeof input[0] === 'number') {
          return { labels: fallbackLabels.length ? fallbackLabels : input.map((_, i) => `P${i + 1}`), values: input };
        }
        return {
          labels: input.map(x => x.label ?? x.period ?? x.month ?? x.week ?? x.day ?? '').filter(Boolean),
          values: input.map(x => x.value ?? x.count ?? x.score ?? x.avg ?? null),
        };
      }
      return { labels: fallbackLabels, values: [] };
    };

    const cvdSeries  = toSeries(platform?.cvd_trend || platform?.cardiovascular_trend || platform?.avg_sbp_trend, ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']);
    const renalSeries = toSeries(platform?.renal_trend || platform?.egfr_trend, Array.from({ length: 12 }, (_, i) => `W${i + 1}`));
    const scoreSeries = toSeries(platform?.score_trend || platform?.mean_score_trend, ['Oct','Nov','Dec','Jan','Feb','Mar']);

    const metabolicRaw = platform?.hba1c_distribution || platform?.metabolic_distribution;
    const metaLabels = Array.isArray(metabolicRaw)
      ? metabolicRaw.map(x => x.label ?? x.bucket ?? '')
      : ['<5.7%', '5.7–6.4%', '6.5–7.5%', '>7.5%'];
    const metaValues = Array.isArray(metabolicRaw)
      ? metabolicRaw.map(x => x.value ?? x.count ?? 0)
      : [];

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
  }, [platform]);

  const kpis = [
    { label: 'Total Patients', val: platform.total_patients ?? '—', unit: '', color: 'var(--teal)' },
    { label: 'Mean Health Score', val: platform.mean_score ?? '—', unit: '/100', color: 'var(--dark)' },
    { label: 'Critical Active', val: platform.critical_count ?? '—', unit: '', color: 'var(--danger)' },
    { label: 'Scanned This Week', val: platform.scanned_this_week ?? '—', unit: '', color: 'var(--teal)' },
    { label: 'Diabetic Patients', val: platform.diabetic_count ?? '—', unit: '', color: 'var(--warning)' },
    { label: 'Hypertension', val: platform.hypertension_count ?? '—', unit: '', color: 'var(--warning)' },
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