import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getGMTOffsetStr, getDSTLabel, convertTime, getCurrentTime, defaultTime, formatOutput, TZ_LIST, LOOKUP_LIST, ROW_COLORS } from '../lib/timezoneUtils';
import { gemini } from '../lib/ai';
import { Spin } from '../components/ui';

function DatePicker({value,onChange}: any){
  const [open,setOpen]=useState(false);
  const [view,setView]=useState(()=>{const d=new Date(value+"T12:00:00Z");return{year:d.getUTCFullYear(),month:d.getUTCMonth()};});
  const ref=useRef<any>(null);
  useEffect(()=>{if(!open)return;const h=(e: any)=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[open]);
  const sel=new Date(value+"T12:00:00Z");
  const today=new Date();today.setUTCHours(12,0,0,0);
  const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAYS=["Mo","Tu","We","Th","Fr","Sa","Su"];
  const firstDay=new Date(Date.UTC(view.year,view.month,1));
  let sdow=(firstDay.getUTCDay()+6)%7;
  const dim=new Date(Date.UTC(view.year,view.month+1,0)).getUTCDate();
  const pd=new Date(Date.UTC(view.year,view.month,0)).getUTCDate();
  const cells: any[]=[];
  for(let i=0;i<sdow;i++)cells.push({day:pd-sdow+1+i,cur:false});
  for(let i=1;i<=dim;i++)cells.push({day:i,cur:true});
  while(cells.length%7!==0)cells.push({day:cells.length-sdow-dim+1,cur:false});
  const pm=()=>setView(v=>v.month===0?{year:v.year-1,month:11}:{year:v.year,month:v.month-1});
  const nm=()=>setView(v=>v.month===11?{year:v.year+1,month:0}:{year:v.year,month:v.month+1});
  const pick=(day: number)=>{const d=new Date(Date.UTC(view.year,view.month,day));onChange(d.toISOString().slice(0,10));};
  const disp=()=>new Date(value+"T12:00:00Z").toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
  const isSel=(c: any)=>c.cur&&view.year===sel.getUTCFullYear()&&view.month===sel.getUTCMonth()&&c.day===sel.getUTCDate();
  const isTod=(c: any)=>c.cur&&view.year===today.getUTCFullYear()&&view.month===today.getUTCMonth()&&c.day===today.getUTCDate();
  return(
    <div style={{position:"relative",display:"inline-block"}} ref={ref}>
      <button onClick={()=>setOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",background:"var(--bg-glass)",border:"1.5px solid var(--border-glass)",borderRadius:10,fontSize:14,fontWeight:500,color:"var(--text-primary)",boxShadow:"0 1px 4px rgba(0,0,0,.05)",cursor:"pointer",whiteSpace:"nowrap",transition:"border-color .15s"}}
        onMouseEnter={(e: any)=>e.currentTarget.style.borderColor="var(--primary)"} onMouseLeave={(e: any)=>e.currentTarget.style.borderColor="var(--border-color)"}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        {disp()}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 8px)",left:0,zIndex:500,background:"var(--bg-card)",borderRadius:16,boxShadow:"0 12px 48px rgba(0,0,0,.18)",border:"1px solid var(--border-color)",padding:"16px",width:280,animation:"slideUp .15s ease"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <button onClick={pm} style={{width:28,height:28,borderRadius:8,border:"1px solid var(--border-color)",background:"var(--bg-card)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
              onMouseEnter={(e: any)=>e.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={(e: any)=>e.currentTarget.style.background="var(--bg-card)"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>{MONTHS[view.month]} {view.year}</span>
            <button onClick={nm} style={{width:28,height:28,borderRadius:8,border:"1px solid var(--border-color)",background:"var(--bg-card)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
              onMouseEnter={(e: any)=>e.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={(e: any)=>e.currentTarget.style.background="var(--bg-card)"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
            {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:12,fontWeight:600,color:"var(--text-placeholder)",padding:"4px 0"}}>{d}</div>)}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {cells.map((c,i)=>{const s=isSel(c),t=isTod(c);return(
              <button key={i} onClick={()=>c.cur&&pick(c.day)} style={{width:"100%",aspectRatio:"1",borderRadius:8,border:t&&!s?"1.5px solid var(--primary)":"none",background:s?"var(--primary)":"transparent",color:s?"var(--bg-card)":!c.cur?"var(--border-color)":t?"var(--primary)":"var(--text-secondary)",fontSize:13,fontWeight:s||t?700:400,cursor:c.cur?"pointer":"default",transition:"background .1s"}}
                onMouseEnter={(e: any)=>{if(c.cur&&!s)e.currentTarget.style.background="var(--bg-indigo-50)";}} onMouseLeave={(e: any)=>{if(!s)e.currentTarget.style.background="transparent";}}>
                {c.day}
              </button>
            );})}
          </div>
          <div style={{marginTop:12,display:"flex",justifyContent:"flex-end"}}>
            <button onClick={()=>setOpen(false)} style={{padding:"7px 20px",background:"var(--primary)",color:"var(--bg-card)",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",}}
              onMouseEnter={(e: any)=>e.currentTarget.style.background="var(--primary-hover)"} onMouseLeave={(e: any)=>e.currentTarget.style.background="var(--primary)"}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeInput({value,onChange,is24}: any){
  const parse=(v: string)=>{
    if(!v)return is24?{hm:"00:00",ap:"AM"}:{hm:"12:00",ap:"AM"};
    const str = String(v).replace(/[\u200E\u200F\u202F]/g, ' ').trim();
    if(is24){
      const m=str.match(/(\d{1,2}):(\d{2})/);
      if(m)return{hm:String(parseInt(m[1])).padStart(2,"0")+":"+m[2],ap:"AM"};
      return{hm:"00:00",ap:"AM"};
    } else {
      const m=str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if(m)return{hm:String(parseInt(m[1])).padStart(2,"0")+":"+m[2],ap:m[3].toUpperCase()};
      return{hm:"12:00",ap:"AM"};
    }
  };
  const {hm,ap}=parse(value);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(hm);
  useEffect(()=>{if(!editing)setDraft(parse(value).hm);},[value,is24]);
  const emit=(newHm: string,newAp: string)=>{if(is24)onChange(newHm);else onChange(newHm+" "+newAp);};
  const handleBlur=()=>{
    setEditing(false);
    let raw=draft.replace(/[^0-9:]/g,"");
    let h=0,m=0;
    if(raw.includes(":")){const p=raw.split(":");h=parseInt(p[0])||0;m=parseInt(p[1])||0;}
    else if(raw.length<=2)h=parseInt(raw)||0;
    else{h=parseInt(raw.slice(0,raw.length-2))||0;m=parseInt(raw.slice(-2))||0;}
    if(is24)h=Math.max(0,Math.min(23,h));else h=Math.max(1,Math.min(12,h||12));
    m=Math.max(0,Math.min(59,m));
    const newHm=String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");
    setDraft(newHm);emit(newHm,ap);
  };
  const toggleAP=(e: any)=>{e.stopPropagation();emit(hm,ap==="AM"?"PM":"AM");};
  return(
    <div style={{display:"flex",alignItems:"center",gap:4}}>
      <input value={editing?draft:hm} onChange={e=>setDraft(e.target.value)}
        onFocus={(e: any)=>{setEditing(true);setDraft(hm);e.target.select();}} onBlur={handleBlur}
        style={{border:"none",background:"transparent",fontSize:15,fontWeight:700,color:"var(--text-primary)",width:is24?52:52,textAlign:"center",outline:"none",}}/>
      {!is24&&<button onClick={toggleAP} style={{border:"none",background:"rgba(128,128,128,.15)",borderRadius:6,padding:"2px 6px",fontSize:12,fontWeight:700,color:"var(--text-secondary)",cursor:"pointer",flexShrink:0}}>{ap}</button>}
    </div>
  );
}

function MessageConverter({is24}: any){
  const [tzSearch,setTzSearch]=useState("");
  const [selectedTZ,setSelectedTZ]=useState<any>(null);
  const [showDrop,setShowDrop]=useState(false);
  const [dropResults,setDropResults]=useState<any[]>([]);
  const [inputMsg,setInputMsg]=useState("");
  const [outputMsg,setOutputMsg]=useState("");
  const [extraPrompt,setExtraPrompt]=useState("");
  const [loading,setLoading]=useState(false);
  const [copied,setCopied]=useState(false);
  const today=new Date().toISOString().slice(0,10);

  useEffect(()=>{
    if(!tzSearch.trim()){setDropResults([]);return;}
    const q=tzSearch.toLowerCase();
    setDropResults(LOOKUP_LIST.filter(t=>t.city.toLowerCase().includes(q)||t.country.toLowerCase().includes(q)||t.tz.toLowerCase().includes(q)).slice(0,20));
  },[tzSearch]);

  const handleConvert=async()=>{
    if(!inputMsg.trim()||!selectedTZ)return;
    setLoading(true);setOutputMsg("");
    try{
      const dst=getDSTLabel(selectedTZ.tz,today),offset=getGMTOffsetStr(selectedTZ.tz,today);
      const timeFormat=is24?"24-hour (HH:MM)":"12-hour (HH:MM AM/PM)";
      const extraInstructions=extraPrompt.trim()?`\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${extraPrompt.trim()}`:"";
      const result=await gemini(
        `You are a recruitment assistant. The message may contain time slots for multiple countries/candidates. Find ONLY the slots belonging to the selected candidate's country, then convert those times.

SELECTED CANDIDATE COUNTRY: ${selectedTZ.country}
CANDIDATE TIMEZONE: ${selectedTZ.city}, ${selectedTZ.country} (${selectedTZ.tz}, GMT${offset}${dst.dst?" "+dst.dst:""})
TIME FORMAT: ${timeFormat}

STEP 1 - IDENTIFY: Find the section matching "${selectedTZ.country}" (e.g. "Brazil - ...", "Denmark - ..."). Only extract slots from that section.
STEP 2 - CONVERT: Convert ONLY those slots to the candidate timezone.
STEP 3 - OUTPUT exactly like this, nothing else:
${selectedTZ.country} time (GMT${offset}${dst.dst?" "+dst.dst:""}):
[Date]: [converted time range]

RULES:
- First line: "${selectedTZ.country} time (GMT${offset}${dst.dst?" "+dst.dst:""})"
- List ONLY slots from the ${selectedTZ.country} section, one per line
- No parentheses, no city name, no extra explanation
- Date format: keep same as original
- Time format: ${timeFormat}
- If a slot has multiple ranges (e.g. "10:00-11:00 / 15:00-17:00"), list each as separate line`,
        `Original message:\n${inputMsg}${extraInstructions}`
      );
      setOutputMsg(result.trim());
    }catch(e: any){setOutputMsg("Error: " + (e.message || "Please try again."));}
    finally{setLoading(false);}
  };

  const inpStyle: any={border:"1.5px solid var(--border-color)",borderRadius:10,padding:"10px 14px",fontSize:14,outline:"none",background:"var(--bg-card)",color:"var(--text-secondary)",width:"100%",transition:"border-color .2s"};

  return(
    <div>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)",display:"block",marginBottom:8}}>Candidate's Timezone</label>
        <div style={{position:"relative",maxWidth:360}}>
          <div style={{position:"relative"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2" style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={selectedTZ&&!showDrop?`${selectedTZ.city}, ${selectedTZ.country}`:tzSearch}
              onChange={e=>{setTzSearch(e.target.value);setSelectedTZ(null);setShowDrop(true);}}
              onFocus={()=>{setShowDrop(true);if(selectedTZ)setTzSearch("");}}
              onBlur={()=>setTimeout(()=>setShowDrop(false),200)}
              placeholder="Search candidate's city or country..."
              style={{...inpStyle,paddingLeft:34,borderColor:selectedTZ?"var(--info)":"var(--border-color)",background:selectedTZ?"var(--bg-emerald-50)":"var(--bg-card)"}}/>
            {selectedTZ&&<button onClick={()=>{setSelectedTZ(null);setTzSearch("");}} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--text-placeholder)",fontSize:16,padding:2}}>×</button>}
          </div>
          {showDrop&&dropResults.length>0&&(
            <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"var(--bg-card)",borderRadius:12,border:"1.5px solid var(--border-color)",boxShadow:"0 12px 40px rgba(0,0,0,.15)",zIndex:400,overflow:"hidden",animation:"slideUp .15s ease",maxHeight:240,overflowY:"auto"}}>
              {dropResults.map((t,i)=>{const dst=getDSTLabel(t.tz,today),now=getCurrentTime(t.tz,is24);return(
                <div key={t.tz+t.city+i} onMouseDown={()=>{setSelectedTZ(t);setTzSearch("");setShowDrop(false);}}
                  style={{padding:"10px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,borderBottom:i<dropResults.length-1?"1px solid var(--bg-hover)":"none"}}
                  onMouseEnter={(e: any)=>e.currentTarget.style.background="var(--bg-main)"} onMouseLeave={(e: any)=>e.currentTarget.style.background="var(--bg-card)"}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13.5,fontWeight:600,color:"var(--text-primary)"}}>{t.city}, {t.country}</div>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
                      <span style={{fontSize:11,color:"var(--text-placeholder)"}}>{t.tz}</span>
                      <span style={{fontSize:11,color:"var(--text-muted)"}}>· GMT{dst.label.replace("GMT","")}</span>
                      {dst.dst&&<span style={{fontSize:10,fontWeight:700,color:dst.dst==="DST"?"var(--warning)":"var(--primary)",background:dst.dst==="DST"?"var(--bg-amber-50)":"var(--bg-indigo-50)",padding:"1px 5px",borderRadius:99}}>{dst.dst}</span>}
                    </div>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--info)",flexShrink:0}}>{now}</div>
                </div>
              );})}
            </div>
          )}
        </div>
        {selectedTZ&&(
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"var(--success)"}}/>
            <span style={{fontSize:12,color:"var(--success)",fontWeight:600}}>
              {selectedTZ.city} · GMT{getGMTOffsetStr(selectedTZ.tz,today)} · Now: {getCurrentTime(selectedTZ.tz,is24)}
            </span>
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,alignItems:"start"}}>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:"var(--text-primary)",display:"block",marginBottom:8}}>Original Message</label>
          <textarea value={inputMsg} onChange={e=>setInputMsg(e.target.value)} rows={9}
            placeholder={`Paste recruiter message here...\n\nExample:\n"Brazil - Maria available\nTuesday 12 May: 14:00-16:00\n\nDenmark - Peter available\nTuesday 12 May: 11:00-13:00\n\nUK Time"`}
            style={{...inpStyle,border:"1.5px solid var(--border-glass)",resize:"none",lineHeight:1.6,fontSize:13.5,background:"var(--bg-glass)"}}
            onFocus={(e: any)=>e.target.style.borderColor="var(--primary)"} onBlur={(e: any)=>e.target.style.borderColor="var(--border-glass)"}/>
          <div style={{marginTop:10,marginBottom:8}}>
            <label style={{fontSize:12,fontWeight:600,color:"var(--text-muted)",display:"block",marginBottom:6}}>Extra Instructions <span style={{fontWeight:400,color:"var(--text-placeholder)"}}>(optional)</span></label>
            <textarea value={extraPrompt} onChange={e=>setExtraPrompt(e.target.value)} rows={2}
              placeholder="e.g. Split each slot into 30-minute intervals."
              style={{...inpStyle,resize:"none",fontSize:12.5,lineHeight:1.5,background:"var(--bg-neutral-50)",padding:"8px 12px"}}
              onFocus={(e: any)=>e.target.style.borderColor="var(--primary)"} onBlur={(e: any)=>e.target.style.borderColor="var(--border-color)"}/>
          </div>
          <button onClick={handleConvert} disabled={loading||!inputMsg.trim()||!selectedTZ}
            style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",cursor:loading||!inputMsg.trim()||!selectedTZ?"not-allowed":"pointer",fontWeight:700,fontSize:14,transition:"all .15s",background:loading||!inputMsg.trim()||!selectedTZ?"var(--border-color)":"linear-gradient(135deg,var(--primary),var(--primary-hover))",color:loading||!inputMsg.trim()||!selectedTZ?"var(--text-placeholder)":"var(--bg-card)",boxShadow:loading||!inputMsg.trim()||!selectedTZ?"none":"0 4px 14px rgba(99,102,241,.35)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading?<><Spin size={15} color="var(--bg-card)"/> Converting...</>:<><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Convert Times</>}
          </button>
        </div>
        <div>
          <label style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)",display:"block",marginBottom:8}}>
            Converted Message {selectedTZ&&<span style={{fontSize:11,color:"var(--info)",fontWeight:400}}>→ {selectedTZ.country} time</span>}
          </label>
          <div style={{position:"relative"}}>
            <textarea value={outputMsg} readOnly rows={9} placeholder="Converted message will appear here..."
              style={{...inpStyle,resize:"none",lineHeight:1.6,fontSize:13.5,background:"var(--bg-main)",color:outputMsg?"var(--text-secondary)":"var(--text-placeholder)"}}/>
            {outputMsg&&(
              <button onClick={async()=>{await navigator.clipboard.writeText(outputMsg);setCopied(true);setTimeout(()=>setCopied(false),2000);}}
                style={{position:"absolute",top:10,right:10,display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,transition:"all .15s",background:copied?"var(--success)":"var(--primary)",color:"var(--bg-card)"}}>
                {copied?<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>:<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InterviewPlanner({toast}: any){
  const today=new Date().toISOString().slice(0,10);
  const [date,setDate]=useState(today);
  const [locs,setLocs]=useState<any[]>([]);
  const [baseIdx,setBaseIdx]=useState(0);
  const [selIdx,setSelIdx]=useState(-1);
  const [showAdd,setShowAdd]=useState(false);
  const [search,setSearch]=useState("");
  const [tzSearch,setTzSearch]=useState("");
  const [tzResults,setTzResults]=useState<any[]>([]);
  const [is24,setIs24]=useState(false);
  const [copied,setCopied]=useState(false);
  const is24Ref=useRef(is24);

  const getHCMCNow=useCallback((fmt24: boolean)=>{
    try{
      const now=new Date();
      const plus45=new Date(now.getTime()+45*60000);
      const fmt=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",hour12:!fmt24,hour:"2-digit",minute:"2-digit"});
      return{start:fmt.format(now),end:fmt.format(plus45)};
    }catch{return{start:fmt24?"09:00":"09:00 AM",end:fmt24?"09:45":"09:45 AM"};}
  },[]);

  const [hcmcTime,setHcmcTime]=useState(()=>getHCMCNow(false));
  const [isLive, setIsLive] = useState(true);

  const isLiveRef = useRef(isLive);
  const dateRef = useRef(date);

  useEffect(()=>{is24Ref.current=is24;},[is24]);
  useEffect(()=>{isLiveRef.current=isLive;},[isLive]);
  useEffect(()=>{dateRef.current=date;},[date]);

  useEffect(()=>{
    const tick=()=>{
      if(!isLiveRef.current) return;
      try{
        const newTime = getHCMCNow(is24Ref.current);
        setHcmcTime(newTime);
        setLocs(p=>p.map(loc=>({...loc,start:convertTime(newTime.start,"Asia/Ho_Chi_Minh",loc.tz,dateRef.current,is24Ref.current),end:convertTime(newTime.end,"Asia/Ho_Chi_Minh",loc.tz,dateRef.current,is24Ref.current)})));
      }catch(e){console.error(e);}
    };
    tick();
    const id=setInterval(tick,60000);
    return()=>clearInterval(id);
  },[]); // intentionally run once

  useEffect(()=>{
    try{
      const conv=(t: string)=>{
        if(!t)return is24?"09:00":"09:00 AM";
        try{
          if(is24){const sp=t.split(" "),ap=(sp[1]||"AM").toUpperCase(),hm=(sp[0]||"09:00").split(":");let h=parseInt(hm[0])||0,m=parseInt(hm[1])||0;if(ap==="PM"&&h!==12)h+=12;if(ap==="AM"&&h===12)h=0;return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");}
          else{const hm=t.split(":");let h=parseInt(hm[0])||0,m=parseInt(hm[1])||0;const ap=h>=12?"PM":"AM";const dh=h%12||12;return String(dh).padStart(2,"0")+":"+String(m).padStart(2,"0")+" "+ap;}
        }catch{return is24?"09:00":"09:00 AM";}
      };
      setHcmcTime(prev=>({start:conv(prev.start),end:conv(prev.end)}));
      setLocs(prev=>prev.map(loc=>({...loc,start:conv(loc.start),end:conv(loc.end)})));
    }catch(e){console.error(e);}
  },[is24]);

  useEffect(()=>{
    if(!tzSearch.trim()){setTzResults([]);return;}
    const q=tzSearch.toLowerCase();
    setTzResults(LOOKUP_LIST.filter(t=>t.city.toLowerCase().includes(q)||t.country.toLowerCase().includes(q)||t.tz.toLowerCase().includes(q)).slice(0,25));
  },[tzSearch]);

  useEffect(()=>{
    try{
      if(locs.length===0)return;
      setLocs(prev=>{
        const base=prev[baseIdx]||prev[0];
        return prev.map((loc,i)=>({...loc,offset:getGMTOffsetStr(loc.tz,date),dst:getDSTLabel(loc.tz,date),start:i===baseIdx?loc.start:convertTime(base.start,base.tz,loc.tz,date,is24),end:i===baseIdx?loc.end:convertTime(base.end,base.tz,loc.tz,date,is24)}));
      });
    }catch(e){console.error(e);}
  },[date]);

  const handleTimeChange=(idx: number,field: string,val: string)=>{
    if(!val)return;
    setBaseIdx(idx);
    setIsLive(false);
    setLocs(prev=>{
      const updated=[...prev];
      updated[idx]={...updated[idx],[field]:val};
      const src=updated[idx];
      setHcmcTime(prev=>({...prev,
        start: field === 'start' ? convertTime(val,src.tz,"Asia/Ho_Chi_Minh",date,is24) : prev.start,
        end: field === 'end' ? convertTime(val,src.tz,"Asia/Ho_Chi_Minh",date,is24) : prev.end
      }));
      return updated.map((loc,i)=>{if(i===idx)return loc;return{...loc,start:convertTime(src.start,src.tz,loc.tz,date,is24),end:convertTime(src.end,src.tz,loc.tz,date,is24)};});
    });
  };

  const addLocation=(item: any)=>{
    if(locs.find(l=>l.tz===item.tz&&l.city===item.city))return;
    const offset=getGMTOffsetStr(item.tz,date),dst=getDSTLabel(item.tz,date);
    const start=convertTime(hcmcTime.start,"Asia/Ho_Chi_Minh",item.tz,date,is24);
    const end=convertTime(hcmcTime.end,"Asia/Ho_Chi_Minh",item.tz,date,is24);
    setLocs(prev=>[...prev,{...item,offset,dst,start,end}]);
    setShowAdd(false);setSearch("");
  };

  const filtered=TZ_LIST.filter(t=>{if(t.tz==="Asia/Ho_Chi_Minh")return false;const q=search.toLowerCase();if(!q)return true;return t.city.toLowerCase().includes(q)||t.country.toLowerCase().includes(q)||t.tz.toLowerCase().includes(q);});
  const selLoc=selIdx===-1?{start:hcmcTime.start,end:hcmcTime.end,country:"Vietnam",offset:getGMTOffsetStr("Asia/Ho_Chi_Minh",date)}:locs[selIdx];
  const outputText=selLoc?formatOutput(date,selLoc.start,selLoc.end,is24,selLoc.country,selLoc.offset):"";
  const doCopy=async()=>{await navigator.clipboard.writeText(outputText);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const displayDate=()=>new Date(date+"T12:00:00Z").toLocaleDateString("en-US",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
  const inpStyle: any={border:"1.5px solid var(--border-color)",borderRadius:10,padding:"10px 14px",fontSize:14,outline:"none",background:"var(--bg-card)",color:"var(--text-secondary)"};

  return(
    <main style={{maxWidth:1000,margin:"0 auto",padding:"32px 16px 80px",animation:"fadeIn .25s ease"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:"clamp(22px,5vw,30px)",fontWeight:800,color:"var(--text-primary)",letterSpacing:"-.02em",marginBottom:6}}>
          Interview <span style={{background:"linear-gradient(135deg,var(--info),var(--info))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Time Planner</span>
        </h1>
        <p style={{fontSize:14,color:"var(--text-muted)"}}>Convert interview times across timezones. Click a row to copy.</p>
      </div>

      {/* Controls */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",flex: 1}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:14,fontWeight:600,color:"var(--text-secondary)"}}>Date:</span>
            <DatePicker value={date} onChange={setDate}/>
          </div>
          <div style={{position:"relative",flex:"1 1 180px",minWidth:160,maxWidth:320}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={tzSearch} onChange={e=>setTzSearch(e.target.value)} placeholder="Search city..." style={{...inpStyle,width:"100%",paddingLeft:32,paddingRight:12}}
              onFocus={(e: any)=>e.target.style.borderColor="var(--info)"} onBlur={(e: any)=>{setTimeout(()=>setTzResults([]),200);e.target.style.borderColor="var(--border-color)";}}/>
            {tzResults.length>0&&(
              <div style={{position:"fixed",left:"50%",transform:"translateX(-50%)",width:"min(380px,92vw)",background:"var(--bg-card)",borderRadius:12,border:"1.5px solid var(--border-color)",boxShadow:"0 12px 40px rgba(0,0,0,.15)",zIndex:300,overflow:"hidden",animation:"slideUp .15s ease"}}>
                <div style={{maxHeight:320,overflowY:"auto"}}>
                {tzResults.map((t,i)=>{const dst=getDSTLabel(t.tz,date),now=getCurrentTime(t.tz,is24);return(
                  <div key={t.tz+t.city+i} style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:10,cursor:"default",borderBottom:i<tzResults.length-1?"1px solid var(--bg-hover)":"none"}}
                    onMouseEnter={(e: any)=>e.currentTarget.style.background="var(--bg-main)"} onMouseLeave={(e: any)=>e.currentTarget.style.background="var(--bg-card)"}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.city}, {t.country}</div>
                      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
                        <span style={{fontSize:11,color:"var(--text-placeholder)",overflow:"hidden",textOverflow:"ellipsis",maxWidth:140,whiteSpace:"nowrap"}}>{t.tz}</span>
                        <span style={{fontSize:11,color:"var(--text-muted)",whiteSpace:"nowrap"}}>· GMT{dst.label.replace("GMT","")}</span>
                        {dst.dst&&<span style={{fontSize:10,fontWeight:700,flexShrink:0,color:dst.dst==="DST"?"var(--warning)":"var(--primary)",background:dst.dst==="DST"?"var(--bg-amber-50)":"var(--bg-indigo-50)",padding:"1px 5px",borderRadius:99}}>{dst.dst}</span>}
                      </div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                      <div style={{fontSize:15,fontWeight:700,color:"var(--info)",whiteSpace:"nowrap"}}>{now}</div>
                      <div style={{fontSize:10,color:"var(--text-placeholder)"}}>now</div>
                    </div>
                  </div>
                );})}
                </div>
              </div>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",background:"var(--bg-hover)",borderRadius:10,padding:4,gap:2,flexShrink:0}}>
            {[false,true].map(v=>(
              <button key={String(v)} onClick={()=>setIs24(v)} style={{padding:"6px 14px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,transition:"all .15s",background:is24===v?"var(--bg-card)":"transparent",color:is24===v?"var(--text-primary)":"var(--text-muted)",boxShadow:is24===v?"0 1px 4px rgba(0,0,0,.1)":"none"}}>
                {v?"24h":"12h"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add Location */}
      <div style={{position:"relative",marginBottom:16,display:"inline-block"}}>
        <button onClick={()=>setShowAdd(v=>!v)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 18px",background:"var(--bg-card)",border:"1.5px solid var(--primary)",borderRadius:10,fontSize:14,fontWeight:600,color:"var(--primary)",cursor:"pointer",transition:"all .15s"}}
          onMouseEnter={(e: any)=>e.currentTarget.style.background="var(--bg-indigo-50)"} onMouseLeave={(e: any)=>e.currentTarget.style.background="var(--bg-card)"}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add Location
        </button>
        {showAdd&&(
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end",background:"rgba(0,0,0,.4)"}} onClick={()=>{setShowAdd(false);setSearch("");}}>
            <div style={{background:"var(--bg-card)",borderRadius:"16px 16px 0 0",maxHeight:"70vh",display:"flex",flexDirection:"column",animation:"slideUp .2s ease"}} onClick={(e: any)=>e.stopPropagation()}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid var(--bg-hover)",display:"flex",alignItems:"center",gap:10}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search city or country..."
                  style={{flex:1,border:"none",outline:"none",fontSize:15,color:"var(--text-primary)",background:"transparent"}}/>
                <button onClick={()=>{setShowAdd(false);setSearch("");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"var(--text-placeholder)",padding:"0 4px",lineHeight:1}}>×</button>
              </div>
              <div style={{overflowY:"auto",flex:1}}>
              {filtered.slice(0,50).map((t,i)=>{const dst=getDSTLabel(t.tz,date);const added=locs.find(l=>l.tz===t.tz&&l.city===t.city);return(
                <div key={t.tz+t.city} onClick={()=>!added&&addLocation(t)} style={{padding:"9px 14px",cursor:added?"default":"pointer",display:"flex",alignItems:"center",gap:10,transition:"background .1s",opacity:added?.5:1}}
                  onMouseEnter={(e: any)=>{if(!added)e.currentTarget.style.background="var(--bg-main)";}} onMouseLeave={(e: any)=>e.currentTarget.style.background="transparent"}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13.5,fontWeight:600,color:"var(--text-primary)"}}>{t.city}, {t.country}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:1}}>
                      <span style={{fontSize:11,color:"var(--text-placeholder)"}}>{t.tz}</span>
                      <span style={{fontSize:11,color:"var(--text-muted)"}}>· GMT{dst.label.replace("GMT","")}</span>
                      {dst.dst&&<span style={{fontSize:10,fontWeight:700,color:dst.dst==="DST"?"var(--warning)":"var(--primary)",background:dst.dst==="DST"?"var(--bg-amber-50)":"var(--bg-indigo-50)",padding:"1px 5px",borderRadius:99}}>{dst.dst}</span>}
                    </div>
                  </div>
                  {added&&<span style={{fontSize:11,color:"var(--text-placeholder)"}}>added</span>}
                </div>
              );})}
              {filtered.length===0&&<div style={{padding:"20px",textAlign:"center",fontSize:13,color:"var(--text-placeholder)"}}>No results</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HCMC Fixed Row */}
      <div style={{marginBottom:10}}>
        <div onClick={()=>setSelIdx(-1)} style={{background:selIdx===-1?"var(--bg-card)":"var(--bg-indigo-50)",border:`2px solid ${selIdx===-1?"var(--primary)":"var(--border-indigo-200)"}`,borderRadius:14,padding:"12px 16px",cursor:"pointer",transition:"all .15s",boxShadow:selIdx===-1?"0 0 0 3px rgba(99,102,241,.15),0 4px 16px rgba(0,0,0,.08)":"0 1px 4px rgba(0,0,0,.04)"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10,gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>Ho Chi Minh City</span>
                <span style={{fontSize:13,color:"var(--text-muted)"}}>Vietnam</span>
                <span style={{fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap"}}>(GMT+7)</span>
                <span style={{fontSize:10,fontWeight:700,color:"var(--primary)",background:"var(--bg-indigo-50)",padding:"1px 7px",borderRadius:99,border:"1px solid var(--border-indigo-200)",whiteSpace:"nowrap"}}>BASE</span>
              </div>
              <div style={{fontSize:11,color:"var(--text-placeholder)",marginTop:3}}>Asia/Ho_Chi_Minh</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              {isLive ? (
                <>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"var(--success)",animation:"pulse 2s infinite"}}/>
                  <span style={{fontSize:11,color:"var(--success)",fontWeight:600}}>Live</span>
                </>
              ) : (
                <button onClick={(e: any)=>{
                  e.stopPropagation();
                  setIsLive(true);
                  const newTime = getHCMCNow(is24);
                  setHcmcTime(newTime);
                  setLocs(p=>p.map(loc=>({...loc,start:convertTime(newTime.start,"Asia/Ho_Chi_Minh",loc.tz,date,is24),end:convertTime(newTime.end,"Asia/Ho_Chi_Minh",loc.tz,date,is24)})));
                }} style={{background:"none",border:"1px solid var(--border-color)",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,color:"var(--text-muted)",cursor:"pointer"}}
                  onMouseEnter={(e: any)=>e.currentTarget.style.background="var(--bg-hover)"} onMouseLeave={(e: any)=>e.currentTarget.style.background="none"}>
                  Reset to Live
                </button>
              )}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"var(--bg-indigo-50)",borderRadius:10,padding:"10px 16px",border:"1px solid var(--border-indigo-200)"}} onClick={(e: any)=>e.stopPropagation()}>
            <TimeInput value={hcmcTime.start} onChange={(v: string)=>{
              setIsLive(false);
              setHcmcTime((p: any)=>({...p,start:v}));
              setLocs(p=>p.map(loc=>({...loc,start:convertTime(v,"Asia/Ho_Chi_Minh",loc.tz,date,is24),end:convertTime(hcmcTime.end,"Asia/Ho_Chi_Minh",loc.tz,date,is24)})));
            }} is24={is24}/>
            <span style={{color:"var(--text-placeholder)",fontWeight:600,fontSize:18}}>–</span>
            <TimeInput value={hcmcTime.end} onChange={(v: string)=>{
              setIsLive(false);
              setHcmcTime((p: any)=>({...p,end:v}));
              setLocs(p=>p.map(loc=>({...loc,start:convertTime(hcmcTime.start,"Asia/Ho_Chi_Minh",loc.tz,date,is24),end:convertTime(v,"Asia/Ho_Chi_Minh",loc.tz,date,is24)})));
            }} is24={is24}/>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {locs.length===0&&(
        <div style={{textAlign:"center",padding:"32px 0",color:"var(--border-color)",background:"var(--bg-card)",borderRadius:16,border:"1.5px dashed var(--border-color)",marginBottom:16}}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{margin:"0 auto 10px",display:"block"}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <div style={{fontSize:14,fontWeight:500}}>Add more locations above</div>
        </div>
      )}

      {/* Location rows */}
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
        {locs.map((loc,i)=>{const col=ROW_COLORS[i%ROW_COLORS.length],isSel=selIdx===i;return(
          <div key={loc.tz+loc.city+i} onClick={()=>setSelIdx(i)} style={{background:isSel?"var(--bg-card)":col.bg,border:`1.5px solid ${isSel?"var(--primary)":col.border}`,borderRadius:14,padding:"12px 16px",cursor:"pointer",transition:"all .15s",boxShadow:isSel?"0 0 0 3px rgba(99,102,241,.15),0 4px 16px rgba(0,0,0,.08)":"0 1px 4px rgba(0,0,0,.04)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10,gap:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>{loc.city}</span>
                  <span style={{fontSize:13,color:"var(--text-muted)"}}>{loc.country}</span>
                  <span style={{fontSize:12,color:"var(--text-muted)",whiteSpace:"nowrap"}}>(GMT{loc.offset})</span>
                  {loc.dst?.dst&&<span style={{fontSize:10,fontWeight:700,whiteSpace:"nowrap",color:loc.dst.dst==="DST"?"var(--warning)":"var(--primary)",background:loc.dst.dst==="DST"?"var(--bg-amber-50)":"var(--bg-indigo-50)",padding:"1px 6px",borderRadius:99,border:loc.dst.dst==="DST"?"1px solid var(--border-amber-200)":"1px solid var(--border-indigo-200)"}}>{loc.dst.dst}</span>}
                </div>
                <div style={{fontSize:11,color:"var(--text-placeholder)",marginTop:3}}>{loc.tz}</div>
              </div>
              <button onClick={(e: any)=>{e.stopPropagation();const nxt=locs.filter((_,j)=>j!==i);setLocs(nxt);setSelIdx(nxt.length===0?-1:Math.max(0,selIdx-(selIdx>i?1:0)));if(nxt.length===0){setHcmcTime(getHCMCNow(is24));}}}
                style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",padding:4,display:"flex",borderRadius:6,flexShrink:0,transition:"background .1s"}}
                onMouseEnter={(e: any)=>e.currentTarget.style.background="var(--bg-red-50)"} onMouseLeave={(e: any)=>e.currentTarget.style.background="none"}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:col.time,borderRadius:10,padding:"10px 16px",border:`1px solid ${col.border}`}} onClick={(e: any)=>e.stopPropagation()}>
              <TimeInput value={loc.start||""} onChange={(v: string)=>handleTimeChange(i,"start",v)} is24={is24}/>
              <span style={{color:"var(--text-placeholder)",fontWeight:600,fontSize:18}}>–</span>
              <TimeInput value={loc.end||""} onChange={(v: string)=>handleTimeChange(i,"end",v)} is24={is24}/>
            </div>
          </div>
        );})}
      </div>

      {/* Output */}
      {(locs.length>0||selIdx===-1)&&(
        <div style={{background:"var(--bg-card)",borderRadius:16,border:"1.5px solid var(--border-color)",padding:"18px 22px",boxShadow:"0 2px 12px rgba(0,0,0,.06)"}}>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)",marginBottom:12}}>Copy result</div>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{flex:"1 1 200px",fontSize:15,fontWeight:600,color:"var(--text-secondary)",fontFamily:"'IBM Plex Mono',monospace",padding:"11px 16px",background:"var(--bg-main)",borderRadius:10,border:"1px solid var(--border-color)"}}>{outputText}</div>
            <button onClick={doCopy} style={{display:"flex",alignItems:"center",gap:8,padding:"11px 22px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,transition:"all .15s",flexShrink:0,background:copied?"var(--success)":"linear-gradient(135deg,var(--primary),var(--primary-hover))",color:"var(--bg-card)",boxShadow:copied?"0 4px 14px rgba(16,185,129,.35)":"0 4px 14px rgba(99,102,241,.35)"}}>
              {copied?<><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>:<><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>}
            </button>
          </div>
        </div>
      )}

      {/* Message Converter */}
      <div style={{marginTop:32,borderTop:"1.5px solid var(--border-color)",paddingTop:32}}>
        <div style={{marginBottom:20}}>
          <h2 style={{fontSize:20,fontWeight:800,color:"var(--text-primary)",marginBottom:6}}>Interview Message Converter</h2>
          <p style={{fontSize:13.5,color:"var(--text-muted)",lineHeight:1.6}}>Paste any message mentioning interview times → AI converts to candidate's timezone</p>
        </div>
        <MessageConverter is24={is24}/>
      </div>
    </main>
  );
}
