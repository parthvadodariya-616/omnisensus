// src/app/doctor/patients/page.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function DoctorPatients() {
  const router = useRouter();
  const [patients,  setPatients]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState('');
  const [tierF,     setTierF]     = useState('');
  const [loading,   setLoading]   = useState(true);

  const load = async (p = 1, tier = tierF) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, page_size: 12 });
      if (tier) params.append('risk_tier', tier);
      const r = await api.get(`/patients?${params}`);
      setPatients(r.data?.patients || r.data?.data || []);
      setTotal(r.data?.total || 0);
      setPage(p);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  const riskBadge = r => r === 'Critical' ? 'badge-danger' : r === 'Borderline' ? 'badge-warning' : 'badge-success';
  const ringColor = s => s >= 70 ? '#10847E' : s >= 50 ? '#F59E0B' : '#E85D6A';
  const initials = name => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'PT';

  const totalPages = Math.ceil(total / 12) || 1;
  const filtered = search ? patients.filter(p => p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.patient_id?.includes(search)) : patients;

  return (
    <div className="page-inner">
      <div className="section-head">
        <div><h2>Patient Panel — Active Cases</h2><p>Longitudinal clinical management for assigned subjects</p></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search patient…"
            style={{ padding: '7px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none', width: 200 }} />
          {['', 'Critical', 'Borderline', 'Stable'].map(t => (
            <button key={t} onClick={() => { setTierF(t); load(1, t); }}
              style={{ padding: '7px 12px', border: `1.5px solid ${tierF === t ? 'var(--teal)' : 'var(--grey-border)'}`, borderRadius: 8, fontSize: 12, fontWeight: 600, background: tierF === t ? 'var(--teal)' : 'var(--grey-bg)', color: tierF === t ? '#fff' : 'var(--grey-text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
              {t || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>Loading patients…</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, marginBottom: 20 }}>
            {filtered.map(p => (
              <div key={p.patient_id} className="card" style={{ padding: 18, cursor: 'pointer', transition: 'box-shadow .2s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
                onClick={() => router.push(`/doctor/dashboard`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: ringColor(p.current_score || 70), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {initials(p.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--grey-text)', marginTop: 1, fontFamily: 'var(--mono)' }}>{p.patient_id?.slice(0, 8)} · Age {p.age ?? '—'}</div>
                  </div>
                  <span className={`badge ${riskBadge(p.current_tier)}`}>{p.current_tier ?? 'Stable'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Mini ring */}
                  <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                    <circle cx="22" cy="22" r="18" fill="none" stroke="var(--grey-border)" strokeWidth="4" />
                    <circle cx="22" cy="22" r="18" fill="none" stroke={ringColor(p.current_score || 70)} strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 18}`}
                      strokeDashoffset={`${2 * Math.PI * 18 * (1 - (p.current_score || 70) / 100)}`}
                      style={{ transition: 'stroke-dashoffset .7s' }} />
                  </svg>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: ringColor(p.current_score || 70), lineHeight: 1 }}>{p.current_score ?? '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--grey-text)', marginTop: 2 }}>Health Score</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--grey-text)' }}>
                      {p.doctor_name && <div>Dr: {p.doctor_name}</div>}
                      {p.last_scan_at && <div>Last: {new Date(p.last_scan_at).toLocaleDateString()}</div>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--grey-text)' }}>Page {page} of {totalPages} · {total} patients</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={page <= 1} onClick={() => load(page - 1, tierF)} style={{ padding: '6px 14px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .5 : 1, background: '#fff', color: 'var(--grey-text)', fontFamily: 'inherit' }}>← Prev</button>
              <button disabled={page >= totalPages} onClick={() => load(page + 1, tierF)} style={{ padding: '6px 14px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? .5 : 1, background: '#fff', color: 'var(--grey-text)', fontFamily: 'inherit' }}>Next →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}