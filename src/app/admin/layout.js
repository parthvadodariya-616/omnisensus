// src/app/admin/layout.js
'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUser, clearSession } from '@/lib/auth';
import PharmaBot from '@/components/PharmaBot';
import PageTransition from '@/components/PageTransition';
import Logo from '@/components/Logo';

const ADMIN_ROUTES = new Set([
  '/admin', '/admin/dashboard', '/admin/analytics',
  '/admin/accuracy', '/admin/audit', '/admin/users',
  '/admin/resources', '/admin/notifications', '/admin/settings',
]);

const NAV = [
  { group: 'Overview', items: [
    { label: 'Triage Monitor',      href: '/admin/dashboard',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> },
    { label: 'Analytics',           href: '/admin/analytics',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { label: 'Model Accuracy',      href: '/admin/accuracy',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  ]},
  { group: 'Administration', items: [
    { label: 'Audit Log',           href: '/admin/audit',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { label: 'User Registry',       href: '/admin/users',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { label: 'Resource Allocation', href: '/admin/resources',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
  ]},
  { group: 'Account', items: [
    { label: 'Notifications',       href: '/admin/notifications',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
    { label: 'Settings',            href: '/admin/settings',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ]},
];

export default function AdminLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,        setUser]        = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unread,      setUnread]      = useState(0);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace('/auth'); return; }
    setUser(u);
  }, [router]);

  useEffect(() => {
    if (pathname === '/admin/profile') { router.replace('/admin/settings'); return; }
    if (pathname?.startsWith('/admin') && !ADMIN_ROUTES.has(pathname)) {
      router.replace('/admin/dashboard');
    }
  }, [pathname, router]);

  // Load unread count quietly
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
                   || 'AD';

  return (
    <div>
      {/* ── NAV ── */}
      <nav id="nav">
        <button type="button" className="nav-menu-btn"
          onClick={() => setSidebarOpen(v => !v)} aria-label="Toggle menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <a className="nav-brand" href="/admin/dashboard" style={{ textDecoration: 'none' }}>
          <Logo size={28} />
        </a>

        <div className="nav-right">
          {/* Notification bell — count only, no red dot animation */}
          <button className="nav-icon-btn" onClick={() => router.push('/admin/notifications')}
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

          <div className="nav-avatar nav-avatar--admin">{initials}</div>
          <div className="nav-user-info" style={{ cursor: 'pointer' }}
            onClick={() => router.push('/admin/settings')}>
            <span>{user?.name || user?.username || 'Admin'}</span>
            <span>System Administrator</span>
          </div>
          <button className="nav-logout" onClick={logout}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </div>
      </nav>

      {/* ── SIDEBAR ── */}
      <div className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)} />

      <aside id="sidebar" className={sidebarOpen ? 'open' : ''}>
        {NAV.map(g => (
          <div key={g.group}>
            <div className="sidebar-label">{g.group}</div>
            {g.items.map(item => (
              <button key={item.href}
                className={`sidebar-link${pathname === item.href ? ' active' : ''}`}
                onClick={() => { setSidebarOpen(false); router.push(item.href); }}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-footer">
          <div>OmniSensus Core v3.0.1</div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main id="main">
        <PageTransition>{children}</PageTransition>
        <PharmaBot context="admin" />
      </main>
    </div>
  );
}