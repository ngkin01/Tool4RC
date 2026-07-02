import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export function Toast({msg,type,onClose}: any) {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[onClose]);
  return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:type==="error"?"var(--danger)":type==="success"?"var(--success)":"var(--primary)",color:"var(--bg-card)",padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,.25)",animation:"slideUp .2s ease",maxWidth:340}}>{msg}</div>;
}

export function useToast(){
  const [ts,setTs]=useState<any[]>([]);
  const show=useCallback((msg: string,type="success")=>setTs(t=>[...t,{id:Date.now(),msg,type}]),[]);
  const rm=useCallback((id: number)=>setTs(t=>t.filter(x=>x.id!==id)),[]);
  return{ts,show,rm};
}

export function Spin({size=16,color="currentColor"}: any){
  return <span style={{display:"inline-block",width:size,height:size,border:`2.5px solid ${color}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite"}}/>;
}

export function Btn({onClick,disabled,loading,children,variant="primary",icon,style={},className=""}: any){
  const v: any={primary:{background:"linear-gradient(135deg,var(--primary),var(--primary-hover))",color:"var(--bg-card)",boxShadow:"0 4px 14px rgba(99,102,241,.35)",border:"none"},
    outline:{background:"var(--bg-card)",color:"var(--text-secondary)",border:"1.5px solid var(--border-color)"},
    ghost:{background:"transparent",color:"var(--text-muted)",border:"none"}};
  return <button onClick={onClick} disabled={disabled} className={className}
    style={{cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontWeight:600,fontSize:14,borderRadius:12,padding:"0 22px",height:46,transition:"all .15s",opacity:disabled?.5:1,...v[variant],...style}}
    onMouseEnter={e=>{if(!disabled){e.currentTarget.style.filter="brightness(1.07)";e.currentTarget.style.transform="translateY(-1px)";}}}
    onMouseLeave={e=>{e.currentTarget.style.filter="";e.currentTarget.style.transform="";}}>
    {loading?<Spin size={15} color={variant==="primary"?"var(--bg-card)":"currentColor"}/>:icon}{children}
  </button>;
}

export function CopyBtn({text,label="Copy"}: any){
  const [ok,setOk]=useState(false);
  return <Btn onClick={async()=>{await navigator.clipboard.writeText(text);setOk(true);setTimeout(()=>setOk(false),2000);}}
    variant={ok?"outline":"primary"}
    icon={ok?<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}>
    {ok?"Copied!":label}
  </Btn>;
}

export function Modal({title,subtitle,onClose,children,width=640}: any){
  useEffect(()=>{const h=(e: any)=>{if(e.key==="Escape")onClose();};document.addEventListener("keydown",h);document.body.style.overflow="hidden";return()=>{document.removeEventListener("keydown",h);document.body.style.overflow=""};},[onClose]);
  const modalContent = <div onClick={(e: any)=>e.target===e.currentTarget&&onClose()}
    style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(0,0,0,.5)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"fadeIn .15s ease"}}>
    <div style={{background:"var(--bg-glass)",backdropFilter:"blur(24px)",borderRadius:20,width:"100%",maxWidth:width,maxHeight:"92vh",display:"flex",flexDirection:"column",border:"1px solid var(--border-glass)",boxShadow:"var(--shadow-glass)",animation:"slideUp .2s ease",position:"relative"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"28px 28px 20px",flexShrink:0}}>
        <div><h2 style={{fontSize:22,fontWeight:800,color:"var(--text-primary)",marginBottom:subtitle?4:0}}>{title}</h2>{subtitle&&<p style={{fontSize:13,color:"var(--text-muted)"}}>{subtitle}</p>}</div>
        <button onClick={onClose} style={{background:"var(--bg-hover)",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:20,color:"var(--text-muted)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
      <div style={{padding:"0 28px 32px",overflowY:"auto"}}>
        {children}
      </div>
    </div>
  </div>;
  return createPortal(modalContent, document.body);
}

export function TA({value,onChange,placeholder,rows=6,mono,readOnly}: any){
  return <textarea value={value} onChange={onChange?(e: any)=>onChange(e.target.value):undefined} placeholder={placeholder} rows={rows} readOnly={readOnly}
    style={{width:"100%",border:"1.5px solid var(--border-glass)",borderRadius:10,padding:"12px 14px",fontSize:13.5,color:"var(--text-primary)",lineHeight:1.7,fontFamily:mono?"'IBM Plex Mono','Courier New',monospace":"'DM Sans', 'Noto Sans', system-ui, sans-serif",resize:"none",outline:"none",background:readOnly?"var(--bg-glass)":"var(--bg-glass)",backdropFilter:"blur(16px)",boxShadow:"var(--shadow-glass)",transition:"border-color .2s"}}
    onFocus={(e: any)=>{if(!readOnly)e.target.style.borderColor="var(--primary)";}} onBlur={(e: any)=>e.target.style.borderColor="var(--border-glass)"}/>;
}

export function InputCard({label,hint,required=true,value,onChange,placeholder,rows}: any){
  return <div style={{background:"var(--bg-glass)",backdropFilter:"blur(16px)",borderRadius:14,border:"1.5px solid var(--border-glass)",padding:"20px 24px",boxShadow:"var(--shadow-glass)"}}>
    <div style={{marginBottom:6}}><span style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>{label}</span>{!required&&<span style={{fontSize:12,color:"var(--text-placeholder)",marginLeft:6}}>Optional</span>}</div>
    {hint&&hint.length>0&&<p style={{margin:"0 0 10px",fontSize:13,color:"var(--text-muted)"}}>{hint}</p>}
    <TA value={value} onChange={onChange} placeholder={placeholder} rows={rows}/>
  </div>;
}
