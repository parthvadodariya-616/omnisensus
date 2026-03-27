// src/app/admin/accuracy/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { ensureChartLoaded } from '@/lib/ensureChartLoaded';

export default function AdminAccuracy() {
  const [mlStats,  setMlStats]  = useState({});
  const [rates,    setRates]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const rocRef = useRef(); const driftRef = useRef();
  const charts = useRef({});

  useEffect(() => {
    Promise.allSettled([
      api.get('/admin/model/performance'),
      api.get('/admin/eda'),
    ]).then(([pr, er]) => {
      if (pr.status === 'fulfilled') {
        setRates(pr.value.data?.daily_rates || []);
        setMlStats(pr.value.data?.ml_health || {});
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const rocPoints = Array.isArray(mlStats?.roc_points)
      ? mlStats.roc_points.map(p => ({ x: p.x ?? p.fpr ?? 0, y: p.y ?? p.tpr ?? 0 }))
      : [];

    const driftLabels = rates.length
      ? rates.map(r => r.event_date?.slice(0, 7) || r.label || '').reverse().filter(Boolean)
      : [];
    const driftData = rates.length
      ? rates.map(r => +(r.success_rate_pct || r.accuracy_pct || 0)).reverse()
      : [];

    const init = () => {
      if (cancelled) return;
      const C = window.Chart; if (!C) return;
      const F = "'Montserrat',sans-serif";
      const tt = { backgroundColor: '#1A2733', titleFont: { family: F, size: 11 }, bodyFont: { family: F, size: 11 }, padding: 10, cornerRadius: 8 };
      const grid = { color: 'rgba(17,24,39,.04)' }; const tick = { color: '#8A9BB0', font: { family: F, size: 10 } };

      const mkOrUpdate = (ref, key, cfg) => {
        if (!ref.current) return;
        if (!charts.current[key]) charts.current[key] = new C(ref.current, cfg);
        else {
          charts.current[key].data = cfg.data;
          charts.current[key].update('none');
        }
      };

      mkOrUpdate(rocRef, 'roc', {
          type: 'scatter',
          data: { datasets: [
            { label: 'Ensemble Model', data: rocPoints, borderColor: '#10847E', backgroundColor: 'rgba(16,132,126,.15)', showLine: true, tension: .3, pointRadius: 3 },
            { label: 'Random', data: [{ x: 0, y: 0 }, { x: 100, y: 100 }], borderColor: '#E2EAF0', borderDash: [4, 4], showLine: true, pointRadius: 0 },
          ]},
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: F, size: 11 } } }, tooltip: tt }, scales: { x: { grid, ticks: tick, border: { display: false }, min: 0, max: 100, title: { display: true, text: 'False Positive Rate (%)', color: '#8A9BB0', font: { family: F, size: 10 } } }, y: { grid, ticks: tick, border: { display: false }, min: 0, max: 100, title: { display: true, text: 'True Positive Rate (%)', color: '#8A9BB0', font: { family: F, size: 10 } } } } }
        });

      mkOrUpdate(driftRef, 'drift', {
          type: 'line',
          data: { labels: driftLabels, datasets: [{ label: 'Accuracy (%)', data: driftData, borderColor: '#10847E', backgroundColor: 'rgba(16,132,126,.07)', fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#10847E' }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tt }, scales: { x: { grid, ticks: tick, border: { display: false } }, y: { grid, ticks: tick, border: { display: false }, min: 88, max: 100 } } }
        });
    };
    ensureChartLoaded().then(() => { if (!cancelled) init(); }).catch(() => {});
    return () => {
      cancelled = true;
      const localCharts = charts.current;
      Object.values(localCharts).forEach(c => c?.destroy());
      charts.current = {};
    };
  }, [rates, mlStats]);

  const metrics = [
    { val: mlStats.overall_accuracy ?? '—', label: 'Overall Diagnostic Accuracy', sub: 'Validated against production cases' },
    { val: mlStats.metabolic_sensitivity ?? '—', label: 'Metabolic Sensitivity', sub: 'HbA1c + FBG composite model', color: 'var(--warning)' },
    { val: mlStats.cvd_specificity ?? '—', label: 'CVD Specificity', sub: 'Framingham + SCORE2 ensemble', color: 'var(--danger)' },
    { val: mlStats.renal_auc ?? '—', label: 'Renal Filtration AUC', sub: 'CKD-EPI + MDRD model' },
    { val: mlStats.ppv ?? '—', label: 'Risk Stratification PPV', sub: 'Positive predictive value, all domains', color: 'var(--teal)' },
    { val: mlStats.avg_latency ?? '—', label: 'Avg Inference Latency', sub: 'End-to-end scoring pipeline', color: 'var(--info)' },
  ];

  return (
    <div className="page-wrap">
      <div className="section-head">
        <div><h2>Diagnostic Model Accuracy Metrics</h2><p>OmniSensus AI ensemble performance benchmarks · v3.0.1</p></div>
      </div>

      {loading && (
        <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-500)' }}>
          Loading model metrics from backend...
        </div>
      )}

      {/* Acc Grid */}
      <div className="acc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {metrics.map(m => (
          <div key={m.label} className="card" style={{ padding: 18, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: m.color ?? 'var(--teal)', letterSpacing: -1 }}>{m.val}</div>
            <div style={{ fontSize: 11, color: 'var(--grey-text)', fontWeight: 500, marginTop: 4 }}>{m.label}</div>
            <div style={{ fontSize: 10, color: 'var(--grey-text)', marginTop: 2, opacity: .7 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>ROC Curve — Ensemble Model</div>
          <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 14 }}>True Positive Rate vs False Positive Rate</div>
          <div style={{ position: 'relative', height: 260 }}><canvas ref={rocRef} /></div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>Monthly Accuracy Drift</div>
          <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 14 }}>Continuous performance validation over time</div>
          <div style={{ position: 'relative', height: 260 }}><canvas ref={driftRef} /></div>
        </div>
      </div>
    </div>
  );
}