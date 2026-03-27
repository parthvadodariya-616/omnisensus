// src/app/patients/notifications/page.js  (also copy to patients/notifications/page.js)
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
const PB = { critical:'b-danger', high:'b-warning', medium:'b-teal', low:'b-neutral' };
export default function Notifications() {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread,  setUnread]  = useState(0);
  useEffect(() => {
    api.get('/notifications?limit=50').then(r => {
      setNotifs(r.data?.notifications || r.data?.data || []);
      setUnread(r.data?.unread_count || 0);
    }).catch(() => setNotifs([])).finally(() => setLoading(false));
  }, []);
  const markRead = async id => {
    try { await api.put(`/notifications/${id}/read`); } catch {}
    setNotifs(p => p.map(n => n.notification_id===id ? {...n,is_read:true} : n));
    setUnread(u => Math.max(0, u-1));
  };
  const markAll = async () => {
    try { await api.put('/notifications/read-all'); } catch {}
    setNotifs(p => p.map(n => ({...n, is_read:true})));
    setUnread(0);
  };
  const fmt = iso => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  return (
    <div className="wrap">
      <div className="sh">
        <div><h2>Notifications</h2><p>{unread} unread</p></div>
        {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}
      </div>
      {loading ? (
        <div style={{padding:32,textAlign:'center',color:'var(--text-400)',fontSize:13}}>Loading...</div>
      ) : notifs.length === 0 ? (
        <div style={{padding:48,textAlign:'center',color:'var(--text-400)',fontSize:13}}>No notifications.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {notifs.map(n => (
            <div key={n.notification_id} className="card card-pad" style={{opacity:n.is_read?0.6:1,transition:'opacity 0.2s'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    {!n.is_read && <span style={{width:7,height:7,borderRadius:'50%',background:'var(--danger)',flexShrink:0,display:'inline-block'}}></span>}
                    <span style={{fontSize:13,fontWeight:700,color:'var(--text-900)'}}>{n.title}</span>
                    <span className={'badge ' + (PB[n.priority]||'b-neutral')} style={{textTransform:'capitalize',fontSize:10}}>{n.priority}</span>
                  </div>
                  <p style={{fontSize:12.5,color:'var(--text-500)',margin:'0 0 5px',lineHeight:1.55}}>{n.message}</p>
                  <span style={{fontSize:11,color:'var(--text-400)'}}>{fmt(n.created_at)}</span>
                </div>
                {!n.is_read && <button className="btn-tbl" onClick={() => markRead(n.notification_id)}>Dismiss</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
