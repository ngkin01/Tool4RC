import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

export function NavSidebar({ open, onClose }: any) {
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { path: '/candidate', label: 'Candidate Tools', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { path: '/jobpost', label: 'Job Post Generator', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
    { path: '/mail', label: 'Interview Mail', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
    { path: '/jdhub', label: 'JD Hub', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  ];

  return (
    <>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 200 }} />}
      <aside style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 262, background: "var(--bg-sidebar)", zIndex: 300, transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform .25s ease", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--text-secondary)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: 20, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <img src="/logo.png" alt="Tool4RC Logo" className="sidebar-logo-img" style={{ height: 50, objectFit: 'contain', flexShrink: 0 }} />
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: 4 }}>×</button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", padding: "4px 8px 10px" }}>Navigation</div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={onClose} style={{ textDecoration: 'none', display: "flex", alignItems: "center", gap: 12, width: "100%", background: isActive ? "var(--text-secondary)" : "none", border: "none", padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left", color: isActive ? "var(--bg-card)" : "var(--border-color)", marginBottom: 4 }}
                onMouseEnter={(e: any) => { if (!isActive) e.currentTarget.style.background = "var(--text-secondary)" }} onMouseLeave={(e: any) => { if (!isActive) e.currentTarget.style.background = "none" }}>
                <span style={{ color: isActive ? "var(--success)" : "var(--text-muted)" }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
              </Link>
            );
          })}
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <button onClick={toggleDarkMode} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "none", border: "none", padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left", color: "var(--border-color)", marginBottom: 4 }}
              onMouseEnter={(e: any) => e.currentTarget.style.background = "var(--text-secondary)"} onMouseLeave={(e: any) => e.currentTarget.style.background = "none"}>
              <span style={{ color: "var(--text-muted)" }}>
                {isDarkMode ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
