// src/app/admin/dashboard/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { ensureChartLoaded } from '@/lib/ensureChartLoaded';

export default function AdminDashboard() {
  const [patients,   setPatients]   = useState([]);
  const [platform,   setPlatform]   = useState({});
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [toasts,     setToasts]     = useState([]);
  const volRef = useRef(); const riskRef = useRef();
  const volChart = useRef(null); const riskChart = useRef(null);

  const toast = (type, title, msg) => {
    const id = Date.now();
    setToasts(t => [...t, { id, type, title, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [ar, pr] = await Promise.allSettled([
          api.get('/admin/analytics'),
          api.get('/patients?page_size=50'),
        ]);
        if (ar.status === 'fulfilled') setPlatform(ar.value.data?.platform || {});
        if (pr.status === 'fulfilled') {
          const list = pr.value.data?.patients || pr.value.data?.data || [];
          const order = { Critical: 0, Borderline: 1, Stable: 2 };
          list.sort((a, b) => (order[a.current_tier] ?? 2) - (order[b.current_tier] ?? 2));
          setPatients(list);
        }
        
      } catch { toast('warn', 'Warning', 'Could not load all data.'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const initCharts = () => {
      if (cancelled) return;
      const C = window.Chart; if (!C) return;
      const F = "'Montserrat',sans-serif";
      const gridOpts = { color: 'rgba(17,24,39,.04)', drawBorder: false };
      const tickOpts = { color: '#8A9BB0', font: { family: F, size: 10 } };
      const tooltipOpts = { backgroundColor: '#1A2733', titleFont: { family: F, size: 11 }, bodyFont: { family: F, size: 11 }, padding: 10, cornerRadius: 8 };

      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const weekly = platform.weekly_admissions || platform.admissions_trend || [];
      let weeklyLabels = [];
      let weeklyData = [];

      if (Array.isArray(weekly) && weekly.length) {
        weeklyLabels = typeof weekly[0] === 'number'
          ? days.slice(0, weekly.length)
          : weekly.map((x, i) => x.label ?? x.day ?? x.period ?? days[i % 7]);
        weeklyData = typeof weekly[0] === 'number'
          ? weekly
          : weekly.map(x => Number(x.value ?? x.count ?? 0) || 0);
      } else {
        const counts = [0, 0, 0, 0, 0, 0, 0];
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        patients.forEach((p) => {
          const ts = p?.last_scan_at ? new Date(p.last_scan_at).getTime() : null;
          if (!ts || Number.isNaN(ts)) return;
          const ageDays = Math.floor((now - ts) / dayMs);
          if (ageDays < 0 || ageDays > 6) return;
          const idx = 6 - ageDays;
          counts[idx] += 1;
        });
        weeklyLabels = days;
        weeklyData = counts;
      }

      const yMax = Math.max(5, ...weeklyData) + 1;

      // Volume chart
      if (volRef.current && !volChart.current) {
        volChart.current = new C(volRef.current, {
          type: 'bar',
          data: {
            labels: weeklyLabels,
            datasets: [{ label: 'Admissions', data: weeklyData, backgroundColor: 'rgba(16,132,126,.7)', borderRadius: 6, borderSkipped: false }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipOpts }, scales: { x: { grid: gridOpts, ticks: tickOpts, border: { display: false } }, y: { grid: gridOpts, ticks: tickOpts, border: { display: false }, min: 0, max: yMax } } }
        });
      } else if (volChart.current) {
        volChart.current.data.labels = weeklyLabels;
        volChart.current.data.datasets[0].data = weeklyData;
        volChart.current.options.scales.y.max = yMax;
        volChart.current.update('none');
      }

      // Risk doughnut
      const crit = platform.critical_count ?? patients.filter(p => p.current_tier === 'Critical').length;
      const bord = platform.borderline_count ?? patients.filter(p => p.current_tier === 'Borderline').length;
      const stab = platform.stable_count ?? patients.filter(p => p.current_tier === 'Stable').length;
      if (riskRef.current && !riskChart.current) {
        riskChart.current = new C(riskRef.current, {
          type: 'doughnut',
          data: {
            labels: ['Stable', 'Borderline', 'Critical'],
            datasets: [{ data: [stab, bord, crit], backgroundColor: ['#10847E', '#F59E0B', '#E85D6A'], borderWidth: 2, borderColor: '#fff', hoverOffset: 4 }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { family: F, size: 11 }, padding: 12 } }, tooltip: tooltipOpts }, cutout: '60%' }
        });
      } else if (riskChart.current) {
        riskChart.current.data.datasets[0].data = [stab, bord, crit];
        riskChart.current.update('none');
      }
    };
    ensureChartLoaded().then(() => { if (!cancelled) initCharts(); }).catch(() => {});
    return () => {
      cancelled = true;
      if (volChart.current) { volChart.current.destroy(); volChart.current = null; }
      if (riskChart.current) { riskChart.current.destroy(); riskChart.current = null; }
    };
  }, [patients, platform]);

  const critical   = platform.critical_count   ?? patients.filter(p => p.current_tier === 'Critical').length;
  const borderline = platform.borderline_count ?? patients.filter(p => p.current_tier === 'Borderline').length;
  const stable     = platform.stable_count     ?? patients.filter(p => p.current_tier === 'Stable').length;
  const total      = platform.total_patients   ?? patients.length;
  const meanScore  = platform.mean_score       ?? (patients.length ? Math.round(patients.reduce((s, p) => s + (p.current_score || 0), 0) / patients.length) : 0);

  const filtered = patients.filter(p => {
    if (riskFilter !== 'all' && p.current_tier !== riskFilter) return false;
    if (search && !p.full_name?.toLowerCase().includes(search.toLowerCase()) && !p.patient_id?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const riskBadge = r => r === 'Critical' ? 'badge-danger' : r === 'Borderline' ? 'badge-warning' : 'badge-success';
  const fillCls   = r => r === 'Critical' ? 'risk-mini-fill--crit' : r === 'Borderline' ? 'risk-mini-fill--elev' : 'risk-mini-fill--stab';

  if (loading) return (
    <div className="page-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--teal-mid)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 13, color: 'var(--grey-text)' }}>Loading triage data…</div>
      </div>
    </div>
  );

  return (
    <div className="page-wrap">
      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div className="toast-icon">
              {t.type === 'info' ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
               : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>}
            </div>
            <div className="toast-body"><h5>{t.title}</h5><p>{t.msg}</p></div>
          </div>
        ))}
      </div>

      {/* Section Header */}
      <div className="section-head">
        <div>
          <h2>Triage Monitoring Centre</h2>
          <p>AI-stratified patient risk indices · Live from database</p>
        </div>
        <span className="badge badge-danger" style={{ fontSize: 12, padding: '5px 13px' }}>{critical} Critical Active</span>
      </div>

      {/* KPI Strip */}
      <div className="stat-row">
        {[
          { label: 'Active Patients', val: total, unit: '', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>, trend: '+12 today', trendCls: 'trend-neu' },
          { label: 'Critical Risk', val: critical, unit: '', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>, trend: 'Immediate review', trendCls: 'trend-up', color: 'var(--danger)' },
          { label: 'Borderline', val: borderline, unit: '', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>, trend: 'Monitor closely', trendCls: 'trend-neu', color: 'var(--warning)' },
          { label: 'Mean Score', val: meanScore, unit: '/100', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, trend: 'Ensemble v3.0.1', trendCls: 'trend-down', color: 'var(--teal)' },
        ].map(k => (
          <div key={k.label} className="stat-card">
            <div className="stat-card-label">{k.icon}{k.label}</div>
            <div className="stat-card-val" style={k.color ? { color: k.color } : {}}>{k.val}<span>{k.unit}</span></div>
            <div className={`stat-trend ${k.trendCls}`}>{k.trend}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 4 }}>Weekly Patient Volume</div>
          <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 16 }}>Total admissions across departments</div>
          <div style={{ position: 'relative', height: 180 }}><canvas ref={volRef} /></div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 4 }}>Risk Distribution</div>
          <div style={{ fontSize: 12, color: 'var(--grey-text)', marginBottom: 16 }}>Current month stratification outcomes</div>
          <div style={{ position: 'relative', height: 180 }}><canvas ref={riskRef} /></div>
        </div>
      </div>

      {/* Triage Table */}
      <div className="table-wrap">
        <div className="table-head">
          <h3>AI Risk Stratification — Patient Triage</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search patient…"
              style={{ padding: '6px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none', width: 180 }}
            />
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
              style={{ padding: '6px 10px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }}>
              <option value="all">All Tiers</option>
              <option value="Critical">Critical</option>
              <option value="Borderline">Borderline</option>
              <option value="Stable">Stable</option>
            </select>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Patient ID</th><th>Name</th><th>Age</th>
              <th>Risk Tier</th><th>Score</th><th>Last Scan</th><th>Attending</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--grey-text)' }}>No patients match filter</td></tr>
            ) : filtered.map(p => (
              <tr key={p.patient_id}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>{p.patient_id?.slice(0, 8)}</td>
                <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                <td>{p.age ?? '—'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`badge ${riskBadge(p.current_tier)}`}>{p.current_tier ?? 'Stable'}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{p.current_score ?? '—'}</span>
                    <div className="risk-mini-bar">
                      <div className={`risk-mini-fill ${fillCls(p.current_tier)}`} style={{ width: `${p.current_score ?? 0}%` }} />
                    </div>
                  </div>
                </td>
                <td style={{ fontSize: 11, color: 'var(--grey-text)' }}>{p.last_scan_at ? new Date(p.last_scan_at).toLocaleDateString('en-GB') : '—'}</td>
                <td style={{ fontSize: 12 }}>{p.doctor_name ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}