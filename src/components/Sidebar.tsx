import React from 'react';

export function Sidebar({open,onClose,sessions,onNew,onSelect,onDelete}: any){
  return <>
    {open&&<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.35)",zIndex:200}}/>}
    <aside style={{position:"fixed",top:0,left:0,bottom:0,width:262,background:"var(--bg-sidebar)",zIndex:300,transform:open?"translateX(0)":"translateX(-100%)",transition:"transform .25s ease",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"18px 18px 14px",borderBottom:"1px solid var(--text-secondary)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{color: 'white', fontWeight: 'bold', fontSize: 20, display: 'flex', alignItems: 'center', flexShrink: 0}}>
            <img src="/logo.png" alt="Tool4RC Logo" className="sidebar-logo-img" style={{ height: 50, objectFit: 'contain', flexShrink: 0 }} />
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:18,padding:4}}>×</button>
        </div>
        <button onClick={()=>{onNew();onClose();}} style={{width:"100%",padding:"9px 0",background:"linear-gradient(135deg,var(--primary),var(--primary-hover))",border:"none",borderRadius:10,color:"var(--bg-card)",fontWeight:600,fontSize:13.5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>New Session
        </button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"10px"}}>
        {sessions.length>0?<>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",padding:"4px 8px 10px"}}>History ({sessions.length})</div>
          {sessions.map((s: any)=><div key={s.id} style={{position:"relative",marginBottom:2}}>
            <button onClick={()=>{onSelect(s.id);onClose();}} style={{width:"100%",background:"none",border:"none",padding:"9px 36px 9px 10px",borderRadius:8,cursor:"pointer",textAlign:"left"}}
              onMouseEnter={(e: any)=>e.currentTarget.style.background="var(--text-secondary)"} onMouseLeave={(e: any)=>e.currentTarget.style.background="none"}>
              <div style={{fontSize:13,fontWeight:500,color:"var(--border-color)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:2}}>{s.title}</div>
              <div style={{fontSize:11,color:"var(--text-muted)"}}>{new Date(s.date).toLocaleDateString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
            </button>
            <button onClick={()=>onDelete(s.id)} style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:4,borderRadius:4,display:"flex"}}
              onMouseEnter={(e: any)=>{e.currentTarget.style.color="var(--danger)";e.currentTarget.style.background="var(--text-secondary)";}} onMouseLeave={(e: any)=>{e.currentTarget.style.color="var(--text-muted)";e.currentTarget.style.background="none";}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>)}
        </>:<div style={{textAlign:"center",padding:"36px 12px",color:"var(--text-muted)"}}><div style={{fontSize:13,marginBottom:4}}>No history yet</div><div style={{fontSize:12,color:"var(--text-secondary)"}}>Generate a summary to create a session</div></div>}
      </div>
    </aside>
  </>;
}
