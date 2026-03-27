// src/app/patients/layout.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, clearSession } from '@/lib/auth';
import PharmaBot from '@/components/PharmaBot';
import PageTransition from '@/components/PageTransition';
import Logo from '@/components/Logo';

const PATIENT_ROUTES = new Set([
  '/patients', '/patients/dashboard', '/patients/reports',
  '/patients/medications', '/patients/appointments',
  '/patients/notifications', '/patients/settings',
]);

const NAV = [
  { group: 'My Health', items: [
    { label: 'My Dashboard',   href: '/patients/dashboard',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> },
    { label: 'Health Reports', href: '/patients/reports',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { label: 'Medications',    href: '/patients/medications',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { label: 'Appointments',   href: '/patients/appointments',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  ]},
  { group: 'Account', items: [
    { label: 'Notifications',  href: '/patients/notifications',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
    { label: 'Settings',       href: '/patients/settings',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ]},
];

export default function PatientLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,        setUser]        = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread,      setUnread]      = useState(0);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'patient') { router.replace('/auth'); return; }
    setUser(u);
  }, [router]);

  useEffect(() => {
    if (pathname === '/patients/profile') { router.replace('/patients/settings'); return; }
    if (pathname?.startsWith('/patients') && !PATIENT_ROUTES.has(pathname)) {
      router.replace('/patients/dashboard');
    }
  }, [pathname, router]);

  useEffect(() => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/notifications?limit=5').then(r => {
        const list = r.data?.notifications || [];
        setUnread(list.filter(n => !n.is_read).length);
      }).catch(() => {});
    });
  }, []);

  const logout   = () => { clearSession(); router.replace('/auth'); };
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
                   || user?.username?.slice(0,2).toUpperCase()
                   || 'PT';

  return (
    <div>
      <nav id="nav">
        <button type="button" className="nav-menu-btn"
          onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <a className="nav-brand" href="/patients/dashboard" style={{ textDecoration: 'none' }}>
          <Logo size={28} />
        </a>

        <div className="nav-right">
          <button type="button" className="nav-icon-btn"
            onClick={() => router.push('/patients/notifications')}
            style={{ position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--danger)', color: '#fff',
                fontSize: 9, fontWeight: 700, borderRadius: 99,
                padding: '1px 5px', lineHeight: 1.4,
                minWidth: 16, textAlign: 'center',
              }}>{unread}</span>
            )}
          </button>
          <div className="nav-avatar nav-avatar--patient">{initials}</div>
          <div className="nav-user-info" style={{ cursor: 'pointer' }}
            onClick={() => router.push('/patients/settings')}>
            <span>{user?.name || user?.username || 'Patient'}</span>
            <span>Patient Account</span>
          </div>
          <button type="button" className="nav-logout" onClick={logout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </nav>

      <div className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)} />

      <aside id="sidebar" className={sidebarOpen ? 'open' : ''}>
        {NAV.map(g => (
          <div key={g.group}>
            <div className="sidebar-label">{g.group}</div>
            {g.items.map(item => (
              <button type="button" key={item.href}
                className={`sidebar-link${pathname === item.href ? ' active' : ''}`}
                onClick={() => { setSidebarOpen(false); router.push(item.href); }}>
                {item.icon}{item.label}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-footer">
          <div>OmniSensus Medical v3.0.1</div>
        </div>
      </aside>

      <main id="main">
        <PageTransition>{children}</PageTransition>
        <PharmaBot context="patient" />
      </main>
    </div>
  );
}