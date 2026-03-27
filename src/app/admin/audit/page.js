// src/app/admin/audit/page.js
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

const TYPE_CLS = { auth: 'audit-tag--auth', data: 'audit-tag--db', system: 'audit-tag--db', security: 'audit-tag--sec', ai: 'audit-tag--ai', api: 'audit-tag--sec' };
const SEV_CLS  = { info: 'audit-icon--info', warning: 'audit-icon--warn', critical: 'audit-icon--danger' };
const STATUS_CLS = { success: 'audit-icon--success', failure: 'audit-icon--danger', warning: 'audit-icon--warn', timeout: 'audit-icon--warn' };

export default function AdminAudit() {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [filter,  setFilter]  = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (p = 1, action = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, page_size: 20 });
      if (action) params.append('action', action);
      const r = await api.get(`/admin/audit?${params}`);
      setLogs(r.data?.logs || r.data?.data || []);
      setTotal(r.data?.total || 0);
      setPage(p);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  const iconForStatus = (s) => {
    if (s === 'success') return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
    if (s === 'failure') return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>;
  };

  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div className="page-wrap">
      <div className="section-head">
        <div><h2>System Audit Log</h2><p>Chronological stream of database transactions and security events</p></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={filter} onChange={e => setFilter(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(1, filter)}
            placeholder="Filter by action…"
            style={{ padding: '6px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 12, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none', width: 180 }} />
          <button onClick={() => load(1, filter)} style={{ padding: '6px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Search</button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--grey-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)' }}>Transaction &amp; Security Event Stream</h3>
          <span className="badge badge-success">{total} total events</span>
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--grey-text)' }}>Loading audit events…</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--grey-text)' }}>No audit events found</div>
          ) : logs.map((log, i) => (
            <div key={log.log_id ?? i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--grey-bg)', transition: 'background .12s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--grey-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <span style={{ fontSize: 10.5, color: 'var(--grey-text)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
                {log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
              </span>
              <div className={`audit-icon ${SEV_CLS[log.severity] ?? STATUS_CLS[log.status] ?? 'audit-icon--info'}`}
                style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {iconForStatus(log.status)}
              </div>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--dark-mid)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--dark)' }}>{log.action}</strong>
                {log.resource && <> · {log.resource}</>}
                {log.detail && <> — {log.detail}</>}
                {log.username && <> · User: <strong>{log.username}</strong></>}
                {log.tx_id && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, marginLeft: 6, background: 'var(--grey-bg)', color: 'var(--grey-text)', fontFamily: 'var(--mono)' }}>
                    {log.tx_id}
                  </span>
                )}
                {log.event_type && (
                  <span className={`audit-tag ${TYPE_CLS[log.event_type] ?? 'audit-tag--db'}`}
                    style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99, marginLeft: 6 }}>
                    {log.event_type.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        {/* Pagination */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--grey-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--grey-text)' }}>Page {page} of {totalPages} · {total} events</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={page <= 1} onClick={() => load(page - 1, filter)}
              style={{ padding: '5px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 6, fontSize: 12, background: page <= 1 ? 'var(--grey-bg)' : '#fff', color: 'var(--grey-text)', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: page <= 1 ? .5 : 1 }}>← Prev</button>
            <button disabled={page >= totalPages} onClick={() => load(page + 1, filter)}
              style={{ padding: '5px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 6, fontSize: 12, background: page >= totalPages ? 'var(--grey-bg)' : '#fff', color: 'var(--grey-text)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: page >= totalPages ? .5 : 1 }}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}