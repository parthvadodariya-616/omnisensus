// src/app/doctor/schedule/page.js
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

const toErrorText = (detail, fallback) => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      if (typeof first.msg === 'string') return first.msg;
      if (typeof first.message === 'string') return first.message;
    }
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg;
    if (typeof detail.message === 'string') return detail.message;
  }
  return fallback;
};

export default function DoctorSchedule() {
  const [appts,    setAppts]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const [patients, setPatients] = useState([]);
  const [form,     setForm]     = useState({ patient_id: '', type: 'consultation', scheduled_at: '', duration_min: 30, notes: '' });
  const [toast,    setToast]    = useState(null);

  const showToast = (type, title, msg) => { setToast({ type, title, msg }); setTimeout(() => setToast(null), 4000); };

  useEffect(() => {
    Promise.allSettled([
      api.get('/appointments'),
      api.get('/patients?page_size=50'),
      api.get('/doctors/me'),
    ]).then(([ar, pr, dr]) => {
      if (ar.status === 'fulfilled') setAppts(ar.value.data?.appointments || ar.value.data?.data || []);
      if (pr.status === 'fulfilled') setPatients(pr.value.data?.patients || pr.value.data?.data || []);
      if (dr.status === 'fulfilled') {
        const did = dr.value.data?.doctor?.doctor_id || dr.value.data?.doctor_id || '';
        if (did) setDoctorId(did);
      } else {
        api.get('/profile/me')
          .then(r => {
            const did = r.data?.profile?.doctor_id || '';
            if (did) setDoctorId(did);
          })
          .catch(() => {});
      }
    }).finally(() => setLoading(false));
  }, []);

  const createAppt = async () => {
    if (!form.patient_id || !form.scheduled_at) { showToast('warn', 'Validation', 'Select patient and appointment time.'); return; }
    if (!doctorId) { showToast('warn', 'Validation', 'Doctor profile not loaded. Please refresh and try again.'); return; }
    try {
      await api.post('/appointments', { ...form, doctor_id: doctorId });
      showToast('info', 'Booked', 'Appointment scheduled successfully.');
      setCreating(false);
      const r = await api.get('/appointments');
      setAppts(r.data?.appointments || r.data?.data || []);
    } catch (e) {
      showToast('warn', 'Error', toErrorText(e?.response?.data?.detail, 'Could not book appointment.'));
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/appointments/${id}/status`, { status, reason: null });
      showToast('info', 'Updated', `Appointment ${status}.`);
      const r = await api.get('/appointments');
      setAppts(r.data?.appointments || r.data?.data || []);
    } catch (e) {
      showToast('warn', 'Error', toErrorText(e?.response?.data?.detail, 'Could not update appointment.'));
    }
  };

  const statusBadge = s => s === 'completed' ? 'badge-success' : s === 'cancelled' ? 'badge-danger' : s === 'confirmed' ? 'badge-success' : 'badge-warning';
  const typeColor = t => t === 'critical_review' ? 'var(--danger)' : t === 'follow_up' ? 'var(--teal)' : 'var(--grey-text)';
  const groups = appts.reduce((acc, a) => {
    const d = a.scheduled_at?.slice(0, 10) || 'TBD';
    (acc[d] = acc[d] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="page-inner">
      {toast && (
        <div className="toast-container">
          <div className="toast toast-info">
            <div className="toast-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div>
            <div className="toast-body"><h5>{toast.title}</h5><p>{toast.msg}</p></div>
          </div>
        </div>
      )}

      <div className="section-head">
        <div><h2>My Schedule</h2><p>Upcoming and past appointments</p></div>
        <button onClick={() => setCreating(v => !v)}
          style={{ padding: '8px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Appointment
        </button>
      </div>

      {/* Quick create form */}
      {creating && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)', marginBottom: 14 }}>Schedule New Appointment</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--dark-mid)', marginBottom: 5 }}>Patient</label>
              <select value={form.patient_id} onChange={e => setForm(p => ({ ...p, patient_id: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 13, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }}>
                <option value="">Select patient</option>
                {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--dark-mid)', marginBottom: 5 }}>Date & Time</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 13, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--dark-mid)', marginBottom: 5 }}>Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 13, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }}>
                <option value="consultation">Consultation</option>
                <option value="follow_up">Follow-Up</option>
                <option value="critical_review">Critical Review</option>
                <option value="lab_review">Lab Review</option>
                <option value="annual_physical">Annual Physical</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setCreating(false)} style={{ padding: '8px 18px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', color: 'var(--grey-text)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={createAppt} style={{ padding: '8px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Book</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>Loading schedule…</div>
      ) : Object.keys(groups).length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>No appointments scheduled</div>
      ) : (
        Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([date, dayAppts]) => (
          <div key={date} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, background: 'var(--teal)', borderRadius: '50%' }} />
              {date === new Date().toISOString().slice(0, 10) ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dayAppts.map(a => (
                <div key={a.appointment_id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 48, textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal)', fontFamily: 'var(--mono)' }}>{a.scheduled_at ? new Date(a.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                    <div style={{ fontSize: 10, color: 'var(--grey-text)' }}>{a.duration_min ?? 30}min</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)' }}>{a.patient_name || a.patient_id?.slice(0, 8)}</div>
                    <div style={{ fontSize: 12, color: typeColor(a.type), fontWeight: 500, marginTop: 1 }}>{a.type?.replace(/_/g, ' ')}</div>
                    {a.notes && <div style={{ fontSize: 11, color: 'var(--grey-text)', marginTop: 2 }}>{a.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${statusBadge(a.status)}`}>{a.status}</span>
                    {a.status === 'booked' && (
                      <button onClick={() => updateStatus(a.appointment_id, 'confirmed')}
                        style={{ padding: '4px 10px', border: '1.5px solid var(--teal)', borderRadius: 6, fontSize: 11, background: '#fff', color: 'var(--teal)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Confirm</button>
                    )}
                    {a.status === 'confirmed' && (
                      <button onClick={() => updateStatus(a.appointment_id, 'completed')}
                        style={{ padding: '4px 10px', border: '1.5px solid var(--teal)', borderRadius: 6, fontSize: 11, background: 'var(--teal)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Done</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}