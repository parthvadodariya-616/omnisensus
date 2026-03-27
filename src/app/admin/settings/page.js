// src/app/admin/settings/page.js  (same for doctor/settings and patients/settings)
'use client';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';

export default function SettingsPage() {
  const user = getUser();
  const [prefs, setPrefs] = useState({ language: 'en', timezone: 'Asia/Kolkata', compact_mode: false, notify_critical_alerts: true, notify_appointment_reminders: true, notify_report_ready: true, notify_system_updates: false });
  const [pw,    setPw]    = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const [tab,    setTab]    = useState('prefs');

  useEffect(() => {
    api.get('/profile/me').then(r => {
      const p = r.data?.preferences || {};
      setPrefs(prev => ({ ...prev, ...p }));
    }).catch(() => {});
  }, []);

  const savePrefs = async () => {
    setSaving(true); setMsg('');
    try {
      await api.put('/profile/me/preferences', prefs);
      setMsg('Preferences saved successfully.');
    } catch { setMsg('Could not save preferences.'); }
    finally { setSaving(false); }
  };

  const changePw = async () => {
    if (!pw.current_password || !pw.new_password || !pw.confirm_password) { setMsg('All password fields are required.'); return; }
    if (pw.new_password !== pw.confirm_password) { setMsg('Passwords do not match.'); return; }
    setSaving(true); setMsg('');
    try {
      await api.put('/profile/me/password', pw);
      setMsg('Password changed successfully.');
      setPw({ current_password: '', new_password: '', confirm_password: '' });
    } catch (e) { setMsg(e?.response?.data?.detail || 'Could not change password.'); }
    finally { setSaving(false); }
  };

  const Toggle = ({ label, k }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--grey-bg)' }}>
      <span style={{ fontSize: 13, color: 'var(--dark)' }}>{label}</span>
      <button onClick={() => setPrefs(p => ({ ...p, [k]: !p[k] }))}
        style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: prefs[k] ? 'var(--teal)' : 'var(--grey-border)', cursor: 'pointer', position: 'relative', transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 2, left: prefs[k] ? 22 : 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
      </button>
    </div>
  );

  return (
    <div className="page-wrap">
      <div className="section-head">
        <div><h2>Settings</h2><p>Manage your account preferences and security</p></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--grey-border)', marginBottom: 24 }}>
        {[['prefs', 'Preferences'], ['security', 'Security']].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setMsg(''); }}
            style={{ padding: '10px 20px', border: 'none', borderBottom: `2.5px solid ${tab === id ? 'var(--teal)' : 'transparent'}`, background: 'none', fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? 'var(--teal)' : 'var(--grey-text)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: -2 }}>
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <div style={{ background: msg.includes('success') ? 'var(--success-bg)' : 'var(--danger-bg)', border: `1px solid ${msg.includes('success') ? '#A7F3D0' : '#F5C6CA'}`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: msg.includes('success') ? 'var(--teal)' : 'var(--danger)', fontWeight: 500 }}>
          {msg}
        </div>
      )}

      {tab === 'prefs' && (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)', marginBottom: 14 }}>General</h4>
            <div>
              {[
                { label: 'Language', k: 'language', opts: [['en', 'English'], ['hi', 'Hindi'], ['mr', 'Marathi']] },
                { label: 'Timezone', k: 'timezone', opts: [['Asia/Kolkata', 'India (IST)'], ['UTC', 'UTC'], ['Asia/Dubai', 'Dubai (GST)']] },
              ].map(f => (
                <div key={f.k} style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--dark-mid)', marginBottom: 5 }}>{f.label}</label>
                  <select value={prefs[f.k]} onChange={e => setPrefs(p => ({ ...p, [f.k]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 13, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }}>
                    {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 22, marginBottom: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)', marginBottom: 4 }}>Notifications</h4>
            <Toggle label="Critical Alerts" k="notify_critical_alerts" />
            <Toggle label="Appointment Reminders" k="notify_appointment_reminders" />
            <Toggle label="Report Ready" k="notify_report_ready" />
            <Toggle label="System Updates" k="notify_system_updates" />
          </div>

          <button onClick={savePrefs} disabled={saving}
            style={{ padding: '10px 24px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? .7 : 1 }}>
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>
      )}

      {tab === 'security' && (
        <div style={{ maxWidth: 480 }}>
          <div className="card" style={{ padding: 22 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)', marginBottom: 14 }}>Change Password</h4>
            {[
              { label: 'Current Password', k: 'current_password' },
              { label: 'New Password', k: 'new_password' },
              { label: 'Confirm New Password', k: 'confirm_password' },
            ].map(f => (
              <div key={f.k} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--dark-mid)', marginBottom: 5 }}>{f.label}</label>
                <input type="password" value={pw[f.k]} onChange={e => setPw(p => ({ ...p, [f.k]: e.target.value }))}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--grey-border)', borderRadius: 8, fontSize: 13, background: 'var(--grey-bg)', color: 'var(--dark)', fontFamily: 'inherit', outline: 'none' }} />
              </div>
            ))}
            <button onClick={changePw} disabled={saving}
              style={{ padding: '10px 24px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? .7 : 1 }}>
              {saving ? 'Changing…' : 'Change Password'}
            </button>
          </div>

          <div className="card" style={{ padding: 22, marginTop: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)', marginBottom: 4 }}>Account Info</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {[
                { k: 'Username', v: user?.username },
                { k: 'Email', v: user?.email },
                { k: 'Role', v: user?.role },
              ].map(f => (
                <div key={f.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--grey-bg)', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--grey-text)' }}>{f.k}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)', fontFamily: f.k === 'Email' ? 'inherit' : 'var(--mono)' }}>{f.v || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}