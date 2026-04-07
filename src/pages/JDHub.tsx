import React from 'react';

export function JDHub({toast}: any){
  return <main style={{maxWidth:600,margin:"0 auto",padding:"80px 28px",animation:"fadeIn .25s ease",textAlign:"center"}}>
    <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,var(--bg-amber-50),var(--border-amber-200))",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    </div>
    <h1 style={{fontSize:32,fontWeight:800,color:"var(--text-primary)",marginBottom:12}}>JD <span style={{background:"linear-gradient(135deg,var(--warning),var(--warning))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Hub</span></h1>
    <p style={{fontSize:15,color:"var(--text-muted)",lineHeight:1.7,marginBottom:32,maxWidth:400,margin:"0 auto 32px"}}>Browse and search job descriptions synced from Google Sheets. Opens in a new tab.</p>
    <a href="https://jd-hub.netlify.app/" target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}} onClick={(e: any)=>{e.stopPropagation();const a=document.createElement("a");a.href="https://jd-hub.netlify.app/";a.target="_blank";a.rel="noopener noreferrer";document.body.appendChild(a);a.click();document.body.removeChild(a);e.preventDefault();}}>
      <button style={{padding:"14px 32px",fontSize:15,fontWeight:700,borderRadius:14,border:"none",cursor:"pointer",background:"linear-gradient(135deg,var(--warning),var(--warning))",color:"var(--bg-card)",boxShadow:"0 6px 20px rgba(245,158,11,.35)",display:"inline-flex",alignItems:"center",gap:10}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        Open JD Hub
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </button>
    </a>
  </main>;
}
