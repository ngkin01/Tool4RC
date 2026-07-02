import React from 'react';
import { Link } from 'react-router-dom';

export function Landing() {
  const cards = [
    { id: "candidate", path: "/candidate", iconBg: "linear-gradient(135deg,var(--primary),var(--primary-hover))", shadow: "rgba(99,102,241,.25)",
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
      title: "Candidate Tools", desc: "CV summary, client email & candidate analysis" },
    { id: "jdhub", path: "/jdhub", iconBg: "linear-gradient(135deg,var(--warning),var(--warning))", shadow: "rgba(245,158,11,.25)",
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
      title: "JD Hub", desc: "Store & reuse job descriptions" },
    { id: "jobpost", path: "/jobpost", iconBg: "linear-gradient(135deg,var(--success),var(--success-hover))", shadow: "rgba(16,185,129,.25)",
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
      title: "Job Post Generator", desc: "Turn JD into ready-to-post content" },
    { id: "mail", path: "/mail", iconBg: "linear-gradient(135deg,var(--primary),var(--primary-hover))", shadow: "rgba(139,92,246,.25)",
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
      title: "Interview Mail", desc: "Generate interview invitation emails instantly" },
  ];

  return (
    <main style={{ animation: "fadeIn .3s ease" }}>
      <div style={{ padding: "40px 16px 36px", textAlign: "center", borderBottom: "1px solid var(--border-color)" }}>
        <h1 style={{ fontSize: "clamp(28px,6vw,44px)", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-.03em", lineHeight: 1.15, maxWidth: 540, margin: "0 auto 16px" }}>
          <span style={{ textShadow: "1px 2px 0px rgba(100, 116, 139, 0.3)" }}>Work faster,</span><br />{"  "}<span style={{ background: "linear-gradient(135deg,var(--primary),var(--primary))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(1px 2px 0px rgba(99, 102, 241, 0.3))" }}>Close more placements.</span>
        </h1>
        <p style={{ fontSize: "clamp(12px,3.5vw,16px)", color: "var(--text-muted)", margin: "0 auto", lineHeight: 1.5, padding: "0 8px" }}>Automate the process, humanize the candidate experience.</p>
      </div>
      <div style={{ maxWidth: 840, margin: "0 auto", padding: "24px 16px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
          {cards.map(c => {
            const s: any = { 
              background: "var(--bg-glass)", 
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderRadius: 14, 
              border: "1.5px solid var(--border-glass)", 
              padding: "16px 18px", 
              cursor: "pointer", 
              transition: "all .18s", 
              boxShadow: "var(--shadow-glass)", 
              display: "flex", 
              alignItems: "center", 
              gap: 14, 
              textDecoration: "none" 
            };
            const hIn = (e: any) => { 
              e.currentTarget.style.boxShadow = `0 16px 40px -8px ${c.shadow}, inset 0 1px 1px var(--glass-inset)`; 
              e.currentTarget.style.borderColor = "var(--border-indigo-200)"; 
              e.currentTarget.style.transform = "translateY(-4px)"; 
              e.currentTarget.style.background = "var(--bg-glass-hover)";
            };
            const hOut = (e: any) => { 
              e.currentTarget.style.boxShadow = "var(--shadow-glass)"; 
              e.currentTarget.style.borderColor = "var(--border-glass)"; 
              e.currentTarget.style.transform = ""; 
              e.currentTarget.style.background = "var(--bg-glass)";
            };
            const inner = (
              <>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: c.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 8px 16px ${c.shadow}` }}>{c.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>{c.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4, marginBottom: 7 }}>{c.desc}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--primary)", fontWeight: 700, fontSize: 12.5 }}>
                    Open tool <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </div>
              </>
            );
            return (c as any).href
              ? <a key={c.id} href={(c as any).href} target="_blank" rel="noopener noreferrer" style={s} onMouseEnter={hIn} onMouseLeave={hOut}>{inner}</a>
              : <Link key={c.id} to={c.path || '/'} style={s} onMouseEnter={hIn} onMouseLeave={hOut}>{inner}</Link>;
          })}
        </div>
      </div>

      {/* Footer Tools: Time Buddy & freeC AI */}
      <div style={{ maxWidth: 840, margin: "0 auto", padding: "0 16px 32px" }}>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
          gap: 12 
        }}>
          {/* Time Buddy Container */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            {/* Time Buddy */}
            <Link to="/planner"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                cursor: "pointer", transition: "all .2s cubic-bezier(0.4, 0, 0.2, 1)", textDecoration: "none"
              }}
              onMouseEnter={(e: any) => { 
                e.currentTarget.style.transform = "translateY(-6px)"; 
                const wrapper = e.currentTarget.querySelector('.img-wrapper');
                if (wrapper) wrapper.style.filter = "drop-shadow(0 12px 20px rgba(251,146,60,0.25))";
              }}
              onMouseLeave={(e: any) => { 
                e.currentTarget.style.transform = "translateY(0)"; 
                const wrapper = e.currentTarget.querySelector('.img-wrapper');
                if (wrapper) wrapper.style.filter = "drop-shadow(0 4px 12px rgba(251,146,60,0.15))";
              }}
              onMouseDown={(e: any) => {
                e.currentTarget.style.transform = "translateY(-2px) scale(0.98)";
              }}
              onMouseUp={(e: any) => {
                e.currentTarget.style.transform = "translateY(-6px) scale(1)";
              }}
            >
              <div className="img-wrapper" style={{ display: 'flex', justifyContent: 'center', filter: 'drop-shadow(0 4px 12px rgba(251,146,60,0.15))', transition: 'all .2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                <img src="/time-buddy.png" alt="Time Buddy" style={{ height: 140, objectFit: 'contain' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--warning)", letterSpacing: ".02em", marginTop: 2 }}>Time Buddy</div>
            </Link>
          </div>

          {/* freeC AI Container */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            {/* freeC AI */}
            <Link to="/freec-ai"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                cursor: "pointer", transition: "all .2s cubic-bezier(0.4, 0, 0.2, 1)", textDecoration: "none"
              }}
              onMouseEnter={(e: any) => { 
                e.currentTarget.style.transform = "translateY(-6px)"; 
                const wrapper = e.currentTarget.querySelector('.img-wrapper');
                if (wrapper) wrapper.style.filter = "drop-shadow(0 12px 20px rgba(139, 92, 246, 0.35))";
              }}
              onMouseLeave={(e: any) => { 
                e.currentTarget.style.transform = "translateY(0)"; 
                const wrapper = e.currentTarget.querySelector('.img-wrapper');
                if (wrapper) wrapper.style.filter = "drop-shadow(0 4px 12px rgba(139, 92, 246, 0.2))";
              }}
              onMouseDown={(e: any) => {
                e.currentTarget.style.transform = "translateY(-2px) scale(0.98)";
              }}
              onMouseUp={(e: any) => {
                e.currentTarget.style.transform = "translateY(-6px) scale(1)";
              }}
            >
              <div className="img-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, filter: 'drop-shadow(0 4px 12px rgba(139, 92, 246, 0.2))', transition: 'all .2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                <img src="/freec-icon.png" alt="freeC AI" style={{ height: 140, objectFit: 'contain', filter: 'drop-shadow(0.5px 0 0 white) drop-shadow(0 0.5px 0 white) drop-shadow(-0.5px 0 0 white) drop-shadow(0 -0.5px 0 white)' }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#8b5cf6", letterSpacing: ".02em", marginTop: 2 }}>freeC AI</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Slogan / Footer */}
      <div style={{ textAlign: "center", paddingBottom: 48, marginTop: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", letterSpacing: "0.02em" }}>
          Tool for Recruitment Consultant - for Real Connections.
        </span>
      </div>
    </main>
  );
}
