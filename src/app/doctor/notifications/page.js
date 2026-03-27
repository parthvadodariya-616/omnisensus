// src/app/admin/notifications/page.js   (same code for doctor/notifications/page.js)
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function NotificationsPage() {
  const [notifs,  setNotifs]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/notifications');
      const data = r.data?.notifications || r.data?.data || [];
      setNotifs(data);
      setTotal(data.length);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); load(); } catch { }
  };
  const markAll = async () => {
    try { await api.put('/notifications/read-all'); load(); } catch { }
  };

  const typeIcon = t => {
    if (t === 'clinical') return '🩺';
    if (t === 'security') return '🔒';
    if (t === 'reminder') return '⏰';
    if (t === 'system')   return '⚙️';
    return '📢';
  };

  const priBadge = p => p === 'critical' ? 'badge-danger' : p === 'high' ? 'badge-warning' : 'badge-success';
  const filtered = filter === 'all' ? notifs : filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs.filter(n => n.type === filter);

  return (
    <div className="page-wrap">
      <div className="section-head">
        <div><h2>Notifications</h2><p>{notifs.filter(n => !n.is_read).length} unread · {total} total</p></div>
        <button onClick={markAll} style={{ padding: '7px 16px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#fff', color: 'var(--grey-text)', cursor: 'pointer', fontFamily: 'inherit' }}>Mark All Read</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'unread', 'clinical', 'security', 'system', 'reminder'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', border: `1.5px solid ${filter === f ? 'var(--teal)' : 'var(--grey-border)'}`, borderRadius: 8, fontSize: 12, fontWeight: 600, background: filter === f ? 'var(--teal)' : 'var(--grey-bg)', color: filter === f ? '#fff' : 'var(--grey-text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', textTransform: 'capitalize' }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--grey-text)' }}>No notifications</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {filtered.map((n, i) => (
            <div key={n.notification_id || i}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--grey-bg)', opacity: n.is_read ? .6 : 1, cursor: 'pointer' }}
              onClick={() => !n.is_read && markRead(n.notification_id)}>
              <div style={{ width: 40, height: 40, background: n.priority === 'critical' ? 'var(--danger-bg)' : 'var(--grey-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
                {typeIcon(n.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: 'var(--dark)' }}>{n.title}</span>
                  <span className={`badge ${priBadge(n.priority)}`} style={{ fontSize: 10 }}>{n.priority}</span>
                  {!n.is_read && <span style={{ width: 6, height: 6, background: 'var(--teal)', borderRadius: '50%', flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: 12, color: 'var(--grey-text)', lineHeight: 1.5 }}>{n.message}</div>
                <div style={{ fontSize: 10, color: 'var(--grey-text)', marginTop: 4, fontFamily: 'var(--mono)' }}>
                  {n.created_at ? new Date(n.created_at).toLocaleString() : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}