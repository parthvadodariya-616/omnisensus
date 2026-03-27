// src/app/admin/users/page.js
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function AdminUsers() {
  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [roleF,   setRoleF]   = useState('');
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [toasts,  setToasts]  = useState([]);
  const [form,    setForm]    = useState({ username: '', email: '', password: '', role: 'patient', full_name: '', date_of_birth: '1990-01-01', gender: 'M' });

  const toast = (type, title, msg) => {
    const id = Date.now();
    setToasts(t => [...t, { id, type, title, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };

  const load = async (p = 1, role = roleF) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, page_size: 15 });
      if (role) params.append('role', role);
      const r = await api.get(`/admin/users?${params}`);
      setUsers(r.data?.users || r.data?.data || []);
      setTotal(r.data?.total || 0);
      setPage(p);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  const updateStatus = async (userId, status) => {
    try {
      await api.put(`/admin/users/${userId}/status`, { status });
      toast('info', 'Updated', `User status changed to ${status}`);
      load(page, roleF);
    } catch { toast('warn', 'Error', 'Could not update user status.'); }
  };

  const createUser = async () => {
    if (!form.username || !form.email || !form.password) { toast('warn', 'Validation', 'Username, email, and password are required.'); return; }
    try {
      await api.post('/admin/users', form);
      toast('info', 'Created', `User ${form.username} created successfully.`);
      setModal(false);
      setForm({ username: '', email: '', password: '', role: 'patient', full_name: '', date_of_birth: '1990-01-01', gender: 'M' });
      load(1, roleF);
    } catch (e) { toast('warn', 'Error', e?.response?.data?.detail || 'Could not create user.'); }
  };

  const roleBadge = r => r === 'admin' ? 'badge-danger' : r === 'doctor' ? 'badge-success' : 'badge-warning';
  const statusBadge = s => s === 'active' ? 'badge-success' : 'badge-danger';
  const totalPages = Math.ceil(total / 15) || 1;

  return (
    <div className="page-wrap">
      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className="toast toast-info"><div className="toast-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div><div className="toast-body"><h5>{t.title}</h5><p>{t.msg}</p></div></div>)}
      </div>

      <div className="section-head">
        <div><h2>User Registry</h2><p>Institutional personnel and patient access records</p></div>
        <button onClick={() => setModal(true)} style={{ padding: '8px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(1)} placeholder="Search name or email…"
          style={{ padding: '7px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none', width: 220 }} />
        {['', 'admin', 'doctor', 'patient'].map(r => (
          <button key={r} onClick={() => { setRoleF(r); load(1, r); }}
            style={{ padding: '7px 14px', border: `1.5px solid ${roleF === r ? 'var(--teal)' : 'var(--grey-border)'}`, borderRadius: 8, fontSize: 12, background: roleF === r ? 'var(--teal)' : 'var(--grey-bg)', color: roleF === r ? '#fff' : 'var(--grey-text)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, transition: 'all .15s' }}>
            {r || 'All Roles'}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <div className="table-head">
          <h3>Registered Users</h3>
          <span className="badge badge-grey">{total} total</span>
        </div>
        <table className="tbl">
          <thead><tr><th>User ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--grey-text)' }}>Loading users…</td></tr>
            ) : users.map(u => (
              <tr key={u.user_id}>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--teal)' }}>{u.user_id?.slice(0, 8)}…</td>
                <td style={{ fontWeight: 600 }}>{u.full_name || u.username}</td>
                <td style={{ color: 'var(--grey-text)', fontSize: 12 }}>{u.email}</td>
                <td><span className={`badge ${roleBadge(u.role)}`}>{u.role}</span></td>
                <td><span className={`badge ${statusBadge(u.status)}`}>{u.status}</span></td>
                <td style={{ fontSize: 11, color: 'var(--grey-text)' }}>{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {u.status === 'active'
                      ? <button onClick={() => updateStatus(u.user_id, 'suspended')} style={{ padding: '4px 10px', border: '1.5px solid var(--grey-border)', borderRadius: 6, fontSize: 11, background: '#fff', color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Suspend</button>
                      : <button onClick={() => updateStatus(u.user_id, 'active')} style={{ padding: '4px 10px', border: '1.5px solid var(--grey-border)', borderRadius: 6, fontSize: 11, background: '#fff', color: 'var(--teal)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Activate</button>
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--grey-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--grey-text)' }}>Page {page} of {totalPages}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={page <= 1} onClick={() => load(page - 1, roleF)}
              style={{ padding: '5px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 6, fontSize: 12, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? .5 : 1, fontFamily: 'inherit' }}>← Prev</button>
            <button disabled={page >= totalPages} onClick={() => load(page + 1, roleF)}
              style={{ padding: '5px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 6, fontSize: 12, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? .5 : 1, fontFamily: 'inherit' }}>Next →</button>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,39,51,.5)', backdropFilter: 'blur(4px)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(16,132,126,.16)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--grey-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--dark)' }}>Create New User</h3>
              <button onClick={() => setModal(false)} style={{ background: 'var(--grey-bg)', border: '1px solid var(--grey-border)', borderRadius: 6, padding: 5, cursor: 'pointer', color: 'var(--grey-text)', display: 'flex', alignItems: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Dr. Firstname Lastname' },
                { key: 'username', label: 'Username *', type: 'text', placeholder: 'username' },
                { key: 'email', label: 'Email *', type: 'email', placeholder: 'user@omnisensus.tech' },
                { key: 'password', label: 'Password *', type: 'password', placeholder: 'Min. 8 characters' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--dark-mid)', marginBottom: 5 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 13, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--dark-mid)', marginBottom: 5 }}>Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 13, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }}>
                  <option value="patient">Patient</option>
                  <option value="doctor">Practitioner</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--grey-border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(false)} style={{ padding: '9px 20px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', color: 'var(--grey-text)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={createUser} style={{ padding: '9px 20px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Create User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}