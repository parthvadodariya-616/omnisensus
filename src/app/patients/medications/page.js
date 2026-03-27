// src/app/patients/medications/page.js
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

const TIPS = [
  { category: 'Metabolic Pathogenesis', text: 'Reducing refined carbohydrate intake by 30% can lower HbA1c by 0.5–1.0% within 3 months. Focus on low-GI foods such as lentils, oats, and leafy vegetables.', ref: 'ADA 2024' },
  { category: 'Exercise Physiology', text: 'Aerobic exercise for ≥150 minutes per week reduces cardiovascular risk by 35% and improves insulin sensitivity by up to 40%.', ref: 'WHO 2020' },
  { category: 'Renal Filtration', text: 'Adequate hydration (2.5–3L daily water intake) supports optimal eGFR. Avoid NSAIDs — they reduce renal perfusion and accelerate CKD progression.', ref: 'KDIGO 2024' },
  { category: 'Cardiovascular', text: 'Reducing sodium intake to <2g per day can lower systolic BP by 5–6 mmHg. The DASH dietary pattern provides an additional 8–14 mmHg reduction.', ref: 'ESC 2023' },
  { category: 'Preventive Medicine', text: 'Smoking cessation reduces cardiovascular risk by 50% within 1 year. NRT doubles quit success rates.', ref: 'WHO FCTC' },
];

export default function PatientMedications() {
  const [meds,    setMeds]    = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tipIdx,  setTipIdx]  = useState(0);
  const [toast,   setToast]   = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    const load = async () => {
      try {
        const pr = await api.get('/patients/me');
        const p  = pr.data?.patient || pr.data;
        setProfile(p);
        const pid = p?.patient_id;
        if (pid) {
          const mr = await api.get(`/patients/${pid}/medications`);
          setMeds(mr.data?.medications || mr.data?.data || []);
        }
      } catch { }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const now = new Date();

  const medsWithStatus = meds.map(m => {
    const scheduled = m.scheduled_time || '08:00';
    const [h, min]  = scheduled.split(':').map(Number);
    const due       = new Date();
    due.setHours(h, min, 0, 0);
    const diff = Math.round((due - now) / 60000);
    return {
      ...m,
      diff,
      dueLabel: diff < 0 ? 'Overdue' : diff < 60 ? `Due in ${diff}m` : null,
    };
  });

  const adherenceVals = meds
    .map(m => m.adherence_pct)
    .filter(v => typeof v === 'number');
  const overallAdherence = adherenceVals.length > 0
    ? Math.round(adherenceVals.reduce((s, v) => s + v, 0) / adherenceVals.length)
    : null;

  const tip = TIPS[tipIdx % TIPS.length];

  if (loading) return (
    <div className="wrap">
      <div className="page-loader">
        <div className="spin-sm" />
        <div className="page-loader__text">Loading medications…</div>
      </div>
    </div>
  );

  return (
    <div className="wrap">
      {toast && (
        <div className="toast-container">
          <div className="toast toast-info">
            <div className="toast-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
              </svg>
            </div>
            <div className="toast-body"><p>{toast}</p></div>
          </div>
        </div>
      )}

      <div className="sh">
        <div>
          <h2>Medications</h2>
          <p style={{ fontSize: 12, color: 'var(--text-500)', marginTop: 3 }}>
            {meds.filter(m => m.status === 'active').length} active medications
          </p>
        </div>
      </div>

      <div className="support-grid">
        {/* Left — medication list */}
        <div>
          <div className="reminder-card" style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-900)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" color="var(--teal)"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Active Medications
            </h4>

            {meds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 28, color: 'var(--text-400)', fontSize: 13 }}>
                No active medications on record. Your prescriptions will appear here after your doctor adds them.
              </div>
            ) : (
              <div className="med-list">
                {medsWithStatus.map((m, i) => (
                  <div key={m.patient_med_id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 10,
                    marginBottom: 8, transition: 'border-color .12s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--teal-200)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>

                    <div className="med-icon">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="16"/>
                        <line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                    </div>

                    <div className="med-info">
                      <div className="med-name">{m.name || m.medication_name || m.dosage_actual || 'Medication'}</div>
                      <div className="med-time">
                        {m.scheduled_time || '08:00'} · {m.frequency || 'Daily'} · {m.dosage_actual || '—'}
                        {m.drug_class && ` · ${m.drug_class}`}
                      </div>
                      {m.notes && (
                        <div style={{ fontSize: 10, color: 'var(--text-400)', marginTop: 2 }}>{m.notes}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      {m.dueLabel && (
                        <span className="med-due"
                          style={m.diff < 0 ? { background: 'var(--danger-bg)', color: 'var(--danger)' } : {}}>
                          {m.dueLabel}
                        </span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99,
                        background: m.status === 'active' ? 'var(--teal-100)' : 'var(--bg)',
                        color: m.status === 'active' ? 'var(--teal)' : 'var(--text-400)',
                      }}>
                        {m.status || 'active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monitoring schedule */}
          {meds.length > 0 && (
            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-900)', marginBottom: 12 }}>Monitoring Schedule</div>
              {meds.slice(0, 3).map((m, i) => {
                const mon = m.monitoring || [];
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-700)', marginBottom: 4 }}>
                      {m.name || m.medication_name}
                    </div>
                    {mon.length > 0 ? mon.map((s, j) => (
                      <div key={j} style={{ fontSize: 11, color: 'var(--text-500)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ width: 4, height: 4, background: 'var(--teal)', borderRadius: '50%', flexShrink: 0 }} />
                        {s}
                      </div>
                    )) : (
                      <div style={{ fontSize: 11, color: 'var(--text-400)' }}>Follow your doctor instructions for monitoring.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Adherence card */}
          <div className="adherence-card card card-pad" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-900)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" color="var(--teal)">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Monthly Adherence
            </div>

            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--teal)', textAlign: 'center', letterSpacing: -1, lineHeight: 1 }}>
              {overallAdherence != null ? `${overallAdherence}%` : '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-500)', textAlign: 'center', marginTop: 3, marginBottom: 16 }}>
              Overall Adherence Rate · This Month
            </div>

            {medsWithStatus.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {medsWithStatus.slice(0, 4).map((m, i) => {
                  const pct = m.adherence_pct ?? null;
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--text-700)', marginBottom: 4 }}>
                        <span>{m.name || m.medication_name || `Med ${i + 1}`}</span>
                        <span>{pct != null ? `${pct}%` : '—'}</span>
                      </div>
                      <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct || 0}%`, height: '100%',
                          background: pct >= 85 ? 'var(--teal)' : 'var(--warning)',
                          borderRadius: 99, transition: 'width .6s ease',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-400)', padding: '12px 0' }}>
                No medications to track yet.
              </div>
            )}

            {/* Doctor note */}
            {profile?.doctor_name && (
              <div style={{ marginTop: 16, padding: '11px 13px', background: 'var(--bg)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-900)', marginBottom: 4 }}>Note from your doctor</div>
                <div style={{ fontSize: 11, color: 'var(--text-500)', lineHeight: 1.7 }}>
                  Take medications as prescribed. Do not stop without consulting {profile.doctor_name}.
                  Report any side effects immediately.
                </div>
                <div style={{ fontSize: 10, fontStyle: 'italic', color: 'var(--text-400)', marginTop: 5 }}>
                  — {profile.doctor_name}
                  {profile.specialisation && `, ${profile.specialisation}`}
                </div>
              </div>
            )}
          </div>

          {/* Health tip card */}
          <div className="tip-card">
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-900)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" color="var(--teal)">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              AI Health Tip
            </h4>
            <div style={{ background: 'linear-gradient(135deg, var(--teal-100) 0%, #D1EAE9 100%)', borderRadius: 10, padding: 14, position: 'relative', overflow: 'hidden' }}>
              <div className="tip-tag">{tip.category}</div>
              <div style={{ fontSize: 13, color: 'var(--text-900)', lineHeight: 1.65, fontWeight: 500 }}>{tip.text}</div>
              <div className="tip-footer">
                <span style={{ fontSize: 11, color: 'var(--text-400)' }}>{tip.ref}</span>
                <button className="btn-refresh" onClick={() => setTipIdx(i => i + 1)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                  Next Tip
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}