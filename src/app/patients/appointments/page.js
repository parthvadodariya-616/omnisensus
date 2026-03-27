// src/app/patients/appointments/page.js
'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function PatientAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await api.get('/appointments');
        setAppointments(res.data?.appointments || res.data?.data || []);
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load appointments.');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, []);

  const statusBadge = (s) =>
    s === 'completed' ? 'badge-success' :
    s === 'cancelled' ? 'badge-danger' :
    s === 'confirmed' ? 'badge-success' : 'badge-warning';

  const sorted = appointments.slice().sort((a, b) => {
    const da = new Date(a.scheduled_at || 0).getTime();
    const db = new Date(b.scheduled_at || 0).getTime();
    return da - db;
  });

  const upcoming = sorted.filter(a => {
    const t = new Date(a.scheduled_at || 0).getTime();
    return t >= Date.now() && !['completed', 'cancelled', 'no_show'].includes(a.status);
  });

  const past = sorted.filter(a => {
    const t = new Date(a.scheduled_at || 0).getTime();
    return t < Date.now() || ['completed', 'cancelled', 'no_show'].includes(a.status);
  });

  const renderCard = (a) => (
    <div key={a.appointment_id} className="card" style={{ padding: 16, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-900)' }}>
            {a.type ? a.type.replace(/_/g, ' ') : 'Appointment'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-500)', marginTop: 3 }}>
            {a.scheduled_at ? new Date(a.scheduled_at).toLocaleString() : 'Time not set'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-500)', marginTop: 2 }}>
            Duration: {a.duration_min ?? 30} min{a.doctor_name ? ` · Doctor: ${a.doctor_name}` : ''}
          </div>
          {a.notes && <div style={{ fontSize: 11, color: 'var(--text-400)', marginTop: 3 }}>{a.notes}</div>}
        </div>
        <span className={`badge ${statusBadge(a.status)}`}>{a.status || 'booked'}</span>
      </div>
    </div>
  );

  return (
    <div className="page-inner">
      <div className="section-head">
        <div>
          <h2>My Appointments</h2>
          <p>Live schedule from the hospital system</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-500)' }}>Loading appointments...</div>
      ) : error ? (
        <div className="card" style={{ padding: 16, borderColor: '#FCA5A5', color: 'var(--danger)' }}>{error}</div>
      ) : (
        <>
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-900)', marginBottom: 12 }}>
              Upcoming ({upcoming.length})
            </div>
            {upcoming.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-500)' }}>No upcoming appointments.</div>
              : upcoming.map(renderCard)}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-900)', marginBottom: 12 }}>
              History ({past.length})
            </div>
            {past.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--text-500)' }}>No appointment history yet.</div>
              : past.map(renderCard)}
          </div>
        </>
      )}
    </div>
  );
}