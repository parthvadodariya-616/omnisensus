// src/app/admin/resources/page.js
'use client';
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { ensureChartLoaded } from '@/lib/ensureChartLoaded';

export default function AdminResources() {
  const [beds,     setBeds]     = useState([]);
  const [bedSum,   setBedSum]   = useState({});
  const [equip,    setEquip]    = useState([]);
  const [oncall,   setOncall]   = useState([]);
  const [alerts,   setAlerts]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const trendRef = useRef(); const trendChart = useRef(null);

  const applyResourceData = (d) => {
    const nextBeds = d.beds || [];
    const nextSummary = d.bed_summary || {};
    setBeds(nextBeds);
    setBedSum(nextSummary);
    setEquip(d.equipment || []);
    setOncall(d.oncall || []);

    const total = nextSummary.total_beds ?? nextSummary.total ?? nextBeds.length;
    const occupied = (nextSummary.occupied_beds ?? nextSummary.occupied ?? nextBeds.filter(b => b.status === 'occupied').length)
      + (nextSummary.icu_beds ?? nextSummary.icu ?? nextBeds.filter(b => b.status === 'icu').length);
    const occ = nextSummary.occupancy_pct ?? (total > 0 ? Math.round((occupied / total) * 100) : 0);
    if (occ > 85) {
      setAlerts([{ message: `Bed occupancy at ${occ}% - approaching critical capacity`, severity: 'critical' }]);
    } else {
      setAlerts([]);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.get('/admin/resources');
        applyResourceData(r.data);
      } catch { } finally { setLoading(false); }
    };
    load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    const trendRaw = bedSum?.daily_trend || bedSum?.weekly_trend || [];
    const trendLabels = Array.isArray(trendRaw) && trendRaw.length
      ? (typeof trendRaw[0] === 'number'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].slice(0, trendRaw.length)
        : trendRaw.map(x => x.label ?? x.day ?? x.period ?? '').filter(Boolean))
      : ['Current'];

    const totalBeds = bedSum?.total_beds ?? bedSum?.total ?? beds.length;
    const occupiedNow = (bedSum?.occupied_beds ?? bedSum?.occupied ?? beds.filter(b => b.status === 'occupied').length)
      + (bedSum?.icu_beds ?? bedSum?.icu ?? beds.filter(b => b.status === 'icu').length);
    const availableNow = bedSum?.available_beds ?? bedSum?.available ?? beds.filter(b => b.status === 'available').length;

    const occupiedData = Array.isArray(trendRaw) && trendRaw.length
      ? (typeof trendRaw[0] === 'number' ? trendRaw : trendRaw.map(x => x.occupied ?? x.occupancy ?? x.value ?? 0))
      : [occupiedNow];
    const availableData = Array.isArray(trendRaw) && trendRaw.length
      ? (typeof trendRaw[0] === 'number' ? [] : trendRaw.map(x => x.available ?? Math.max(0, (bedSum?.total_beds || 0) - (x.occupied ?? 0))))
      : [availableNow];

    const yMax = Math.max(5, totalBeds || 0, ...occupiedData, ...availableData) + 1;

    const init = () => {
      if (cancelled) return;
      const C = window.Chart; if (!C || !trendRef.current) return;
      const F = "'Montserrat',sans-serif";
      if (!trendChart.current) {
        trendChart.current = new C(trendRef.current, {
          type: 'line',
          data: { labels: trendLabels, datasets: [{ label: 'Occupied', data: occupiedData, borderColor: '#E85D6A', backgroundColor: 'rgba(232,93,106,.07)', fill: true, tension: .4, pointRadius: 3 }, { label: 'Available', data: availableData, borderColor: '#10847E', backgroundColor: 'rgba(16,132,126,.07)', fill: true, tension: .4, pointRadius: 3 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { font: { family: F, size: 11 } } }, tooltip: { backgroundColor: '#1A2733', titleFont: { family: F }, bodyFont: { family: F }, padding: 10, cornerRadius: 8 } }, scales: { x: { grid: { color: 'rgba(17,24,39,.04)' }, ticks: { color: '#8A9BB0', font: { family: F, size: 10 } }, border: { display: false } }, y: { grid: { color: 'rgba(17,24,39,.04)' }, ticks: { color: '#8A9BB0', font: { family: F, size: 10 } }, border: { display: false }, min: 0, max: yMax } }, interaction: { mode: 'index', intersect: false } }
        });
      }

      if (trendChart.current) {
        trendChart.current.data.labels = trendLabels;
        trendChart.current.data.datasets[0].data = occupiedData;
        trendChart.current.data.datasets[1].data = availableData;
        trendChart.current.options.scales.y.max = yMax;
        trendChart.current.update('none');
      }
    };
    ensureChartLoaded().then(() => { if (!cancelled) init(); }).catch(() => {});
    return () => { cancelled = true; if (trendChart.current) { trendChart.current.destroy(); trendChart.current = null; } };
  }, [bedSum, beds]);

  const getBedColor = (status) => {
    if (status === 'icu') return { bg: '#7C3AED', label: '#fff' };
    if (status === 'occupied') return { bg: '#E85D6A', label: '#fff' };
    if (status === 'reserved') return { bg: '#FDE68A', label: '#92400E', border: '#F59E0B' };
    if (status === 'maintenance') return { bg: '#E2EAF0', label: '#8A9BB0' };
    return { bg: '#D1FAE5', label: '#065F46', border: '#10847E' };
  };

  const total      = bedSum.total_beds    ?? beds.length;
  const occupied   = bedSum.occupied_beds ?? beds.filter(b => b.status === 'occupied').length;
  const available  = bedSum.available_beds ?? beds.filter(b => b.status === 'available').length;
  const icuCount   = bedSum.icu_beds      ?? beds.filter(b => b.status === 'icu').length;
  const occPct     = total > 0 ? Math.round((occupied + icuCount) / total * 100) : 0;

  const eqOpCount = equip.filter(e => e.status === 'operational').length;
  const eqMaint   = equip.filter(e => e.status === 'maintenance').length;
  const avgUtil   = equip.length > 0 ? Math.round(equip.reduce((s, e) => s + (e.utilisation_pct || 0), 0) / equip.length) : 0;

  const eqStatusColor = s => s === 'operational' ? 'badge-success' : s === 'maintenance' ? 'badge-warning' : 'badge-danger';
  const bedCellClass = s => s === 'icu' ? 'bed-cell--icu' : s === 'occupied' ? 'bed-cell--occupied' : s === 'reserved' ? 'bed-cell--reserved' : s === 'available' ? 'bed-cell--free' : '';

  const refreshData = () => {
    setLoading(true);
    api.get('/admin/resources')
      .then(r => applyResourceData(r.data))
      .finally(() => setLoading(false));
  };

  return (
    <div className="page-wrap" style={{ maxWidth: 1200, paddingBottom: 80 }}>
      <div className="section-head" style={{ marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Resource Allocation</h2>
          <p>Hospital capacity, staff scheduling, and equipment utilisation</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span className="badge badge-success">Live Updates</span>
          <button className="btn btn-ghost btn-sm" onClick={refreshData}>Refresh</button>
          <button className="btn btn-primary btn-sm" type="button">Export Report</button>
        </div>
      </div>

      <div className="os-card" style={{ marginBottom: 16 }}>
        <div className="os-card__head">
          <div className="os-card__title" style={{ color: 'var(--danger)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Active Alerts
          </div>
        </div>
        <div className="os-card__body" style={{ paddingTop: 12, paddingBottom: 12 }}>
          {alerts.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-500)' }}>No active resource alerts.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map((a, i) => (
                <div key={i} style={{ background: 'var(--danger-bg)', border: '1px solid #FCA5A5', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
                  {a.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="kpi-strip kpi-strip--4" style={{ marginBottom: 16 }}>
        <div className="kpi-card kpi-card--teal">
          <div className="kpi-card__label">Total Beds</div>
          <div className="kpi-card__value">{total}</div>
          <div className="kpi-card__sub">Across all wards</div>
        </div>
        <div className="kpi-card kpi-card--danger">
          <div className="kpi-card__label">Occupied</div>
          <div className="kpi-card__value">{occupied + icuCount}</div>
          <div className="kpi-card__sub">{occPct}% occupancy</div>
        </div>
        <div className="kpi-card kpi-card--green">
          <div className="kpi-card__label">Available</div>
          <div className="kpi-card__value">{available}</div>
          <div className="kpi-card__sub">Ready for admission</div>
        </div>
        <div className="kpi-card kpi-card--blue">
          <div className="kpi-card__label">ICU Beds</div>
          <div className="kpi-card__value">{icuCount}</div>
          <div className="kpi-card__sub">Critical care capacity</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 16 }}>
        <div className="os-card">
          <div className="os-card__head"><div className="os-card__title">Bed Occupancy Overview</div></div>
          <div className="os-card__body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-500)' }}>Overall occupancy rate</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--warning)' }}>{occPct}%</span>
            </div>
            <div className="resource-card__bar-bg" style={{ marginBottom: 16 }}>
              <div className="resource-card__bar-fill" style={{ width: `${occPct}%`, background: 'var(--warning)' }} />
            </div>
            <div style={{ height: 220 }}><canvas ref={trendRef} /></div>
          </div>
        </div>

        <div className="os-card">
          <div className="os-card__head">
            <div className="os-card__title">Ward Heat-Map</div>
            <div style={{ fontSize: 11, color: 'var(--text-400)' }}>Click a bed to inspect</div>
          </div>
          <div className="os-card__body">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 22, color: 'var(--text-500)', fontSize: 12 }}>Loading bed data...</div>
            ) : beds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 22, color: 'var(--text-500)', fontSize: 12 }}>No bed data available</div>
            ) : (
              <div className="bed-grid">
                {beds.map(b => {
                  const col = getBedColor(b.status);
                  const cls = bedCellClass(b.status);
                  return (
                    <div
                      key={b.bed_id}
                      className={`bed-cell ${cls}`}
                      title={`${b.bed_number} - ${b.ward} - ${b.status}`}
                      style={cls ? {} : { background: col.bg, color: col.label, border: `1px solid ${col.border || 'rgba(0,0,0,.08)'}` }}
                    >
                      {b.bed_number}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="bed-legend">
              <div className="bed-legend__item"><div className="bed-legend__dot" style={{ background: '#7C3AED' }} />ICU</div>
              <div className="bed-legend__item"><div className="bed-legend__dot" style={{ background: '#DC2626' }} />Occupied</div>
              <div className="bed-legend__item"><div className="bed-legend__dot" style={{ background: '#FDE68A', border: '1px solid #D97706' }} />Reserved</div>
              <div className="bed-legend__item"><div className="bed-legend__dot" style={{ background: '#D1FAE5', border: '1px solid #059669' }} />Available</div>
              <div className="bed-legend__item"><div className="bed-legend__dot" style={{ background: '#E2EAF0' }} />Maintenance</div>
            </div>
          </div>
        </div>
      </div>

      <div className="os-card" style={{ marginBottom: 16 }}>
        <div className="os-card__head">
          <div className="os-card__title">Medical Equipment Status</div>
        </div>
        <div className="os-card__body">
          <div className="kpi-strip kpi-strip--4" style={{ marginBottom: 14 }}>
            <div className="kpi-card"><div className="kpi-card__label">Total Equipment</div><div className="kpi-card__value">{equip.length}</div></div>
            <div className="kpi-card"><div className="kpi-card__label">Operational</div><div className="kpi-card__value" style={{ color: 'var(--success)' }}>{eqOpCount}</div></div>
            <div className="kpi-card"><div className="kpi-card__label">Under Maintenance</div><div className="kpi-card__value" style={{ color: 'var(--warning)' }}>{eqMaint}</div></div>
            <div className="kpi-card"><div className="kpi-card__label">Avg Utilisation</div><div className="kpi-card__value">{avgUtil}%</div></div>
          </div>

          {equip.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-500)' }}>No equipment data available</div>
          ) : (
            <div className="resource-grid" style={{ marginBottom: 0 }}>
              {equip.map(e => (
                <div key={e.equipment_id} className="resource-card">
                  <div className="resource-card__header">
                    <div className="resource-card__title">{e.name}</div>
                    <span className={`badge ${eqStatusColor(e.status)}`}>{e.status}</span>
                  </div>
                  <div className="resource-card__value">{e.utilisation_pct ?? 0}<span className="resource-card__of">%</span></div>
                  <div className="resource-card__bar-bg">
                    <div className="resource-card__bar-fill" style={{ width: `${e.utilisation_pct || 0}%`, background: 'var(--teal)' }} />
                  </div>
                  <div className="resource-card__sub">{e.category} • {e.location ?? 'Unknown location'}</div>
                  <div className="resource-card__sub">Next maintenance: {e.next_maintenance ?? 'Not scheduled'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="os-card">
        <div className="os-card__head">
          <div className="os-card__title">Staff On-Call Directory</div>
          <span className="badge badge-teal">{oncall.length} on duty</span>
        </div>
        <div className="os-card__body" style={{ padding: 0 }}>
          <table className="oncall-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Department</th>
                <th>Shift</th>
                <th>Patients</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {oncall.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-500)' }}>No on-call staff for today</td></tr>
              ) : oncall.map(s => (
                <tr key={s.oncall_id}>
                  <td>
                    <div className="oncall-name">{s.full_name}</div>
                    <div className="oncall-dept">{s.specialisation}</div>
                  </td>
                  <td>{s.department}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{s.shift_label} · {s.shift_start}-{s.shift_end}</td>
                  <td style={{ fontWeight: 700 }}>{s.patient_count}</td>
                  <td><span className={`badge ${s.is_available ? 'badge-success' : 'badge-warning'}`}>{s.is_available ? 'Available' : 'Busy'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}