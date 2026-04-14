import React, { useState, useEffect, useRef } from 'react';
import { Modal, Spin } from '../components/ui';
import { getGoogleMapsGrounding } from '../lib/ai';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import parse from 'html-react-parser';

const IM_SAVE_KEY = "ra-im-v2";
const IM_TPL_KEY  = "ra-im-tpl-v2";

const IM_VI_DAYS = ["Chủ Nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"];

function imFmtDate(iso: string, lang: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    if (lang === "vi") {
      const dd = String(d.getDate()).padStart(2,"0");
      const mm = String(d.getMonth()+1).padStart(2,"0");
      return IM_VI_DAYS[d.getDay()] + ", " + dd + "/" + mm + "/" + d.getFullYear();
    }
    return d.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  } catch { return iso; }
}

const IM_DEFAULTS: Record<string, string> = {
  "1st-en-offline": "Dear {{candidate_name}},\n\nOn behalf of {{company_name}}, we would like to schedule an interview to discuss about {{position}} position.\n \nWe hereby invite you to join 1st interview as schedule below:\n\n• Date                         : {{date}}\n• Interview time          : {{time}} (Please arrive the company at least 10min early)\n• Location              : {{location}}\n\nPlease kindly reply to this email to confirm your attendance.\n\nShould you have any questions, please do not hesitate to contact me\n\nWarmest Regards,\nNhan Nguyen.",
  "1st-en-online":  "Dear {{candidate_name}},\n\nOn behalf of our client - {{company_name}}. We would like to invite you to an interview for the position of {{position}}\n\nDetails are as follows:\n• Date: {{date}}\n• Time: {{time}}\n• Link online: {{meeting_link}}\n\nNotes for an online interview: \n- Be on time and ready for the interview at least 10mins before the interview\n- Please choose a quiet place with no noise and a stable internet connection for the interview.\n- You should avoid interviewing in noisy environments or being disturbed by the surroundings.\n\nPlease kindly reply to this email to confirm your attendance.\n\nShould you have any questions, please do not hesitate to contact us.\n\nWarmest Regards,\nNhan Nguyen.",
  "1st-vi-offline": "Kính gửi {{candidate_name}},\n\nChúng tôi hy vọng bạn đang khỏe.\n\nThay mặt {{company_name}}, chúng tôi xin trân trọng mời bạn tham gia Vòng Phỏng Vấn 1 cho vị trí {{position}} tại {{company_name}}.\n\nThông tin phỏng vấn:\n• Ngày: {{date}}\n• Giờ: {{time}}\n• Địa điểm: {{location}}\n\nVui lòng xác nhận lịch phỏng vấn bằng cách trả lời email này.\n\nTrân trọng,\nfreeC Consulting Team",
  "1st-vi-online":  "Kính gửi {{candidate_name}},\n\nChúng tôi hy vọng bạn đang khỏe.\n\nThay mặt {{company_name}}, chúng tôi xin trân trọng mời bạn tham gia Vòng Phỏng Vấn 1 (Online) cho vị trí {{position}} tại {{company_name}}.\n\nThông tin phỏng vấn:\n• Ngày: {{date}}\n• Giờ: {{time}}\n• Link tham gia: {{meeting_link}}\n\nVui lòng xác nhận lịch phỏng vấn bằng cách trả lời email này.\n\nTrân trọng,\nfreeC Consulting Team",
  "2nd-en-offline": "Dear {{candidate_name}},\n\nThank you for your time during the previous interview round.\n\nWe are pleased to inform you that {{company_name}} would like to invite you for a 2nd / 3rd Interview for the position of {{position}}.\n\nInterview Details:\n• Date: {{date}}\n• Time: {{time}}\n• Venue: {{location}}\n\nPlease confirm your availability at your earliest convenience.\n\nBest regards,\nfreeC Consulting Team",
  "2nd-en-online":  "Dear {{candidate_name}},\n\nThank you for your time during the previous interview round.\n\nWe are pleased to inform you that {{company_name}} would like to invite you for a 2nd / 3rd Interview (Online) for the position of {{position}}.\n\nInterview Details:\n• Date: {{date}}\n• Time: {{time}}\n• Meeting Link: {{meeting_link}}\n\nPlease confirm your availability at your earliest convenience.\n\nBest regards,\nfreeC Consulting Team",
  "2nd-vi-offline": "Kính gửi {{candidate_name}},\n\nCảm ơn bạn đã tham gia vòng phỏng vấn trước.\n\nChúng tôi vui mừng thông báo rằng {{company_name}} muốn mời bạn tham gia Vòng Phỏng Vấn 2/3 cho vị trí {{position}}.\n\nThông tin phỏng vấn:\n• Ngày: {{date}}\n• Giờ: {{time}}\n• Địa điểm: {{location}}\n\nVui lòng xác nhận sớm nhất có thể.\n\nTrân trọng,\nfreeC Consulting Team",
  "2nd-vi-online":  "Kính gửi {{candidate_name}},\n\nCảm ơn bạn đã tham gia vòng phỏng vấn trước.\n\nChúng tôi vui mừng thông báo rằng {{company_name}} muốn mời bạn tham gia Vòng Phỏng Vấn 2/3 (Online) cho vị trí {{position}}.\n\nThông tin phỏng vấn:\n• Ngày: {{date}}\n• Giờ: {{time}}\n• Link tham gia: {{meeting_link}}\n\nVui lòng xác nhận sớm nhất có thể.\n\nTrân trọng,\nfreeC Consulting Team",
  "final-en-offline":"Dear {{candidate_name}},\n\nCongratulations on progressing to the final stage!\n\nI am pleased to invite you for the Final Interview for the position of {{position}} at {{company_name}}.\n\nInterview Details:\n• Date: {{date}}\n• Time: {{time}}\n• Venue: {{location}}\n\nPlease prepare accordingly and confirm your attendance by replying to this email.\n\nWe wish you the very best!\n\nBest regards,\nfreeC Consulting Team",
  "final-en-online": "Dear {{candidate_name}},\n\nCongratulations on progressing to the final stage!\n\nI am pleased to invite you for the Final Interview (Online) for the position of {{position}} at {{company_name}}.\n\nInterview Details:\n• Date: {{date}}\n• Time: {{time}}\n• Meeting Link: {{meeting_link}}\n\nPlease prepare accordingly and confirm your attendance by replying to this email.\n\nWe wish you the very best!\n\nBest regards,\nfreeC Consulting Team",
  "final-vi-offline":"Kính gửi {{candidate_name}},\n\nXin chúc mừng bạn đã tiến đến vòng cuối!\n\nChúng tôi trân trọng mời bạn tham gia Vòng Phỏng Vấn Cuối cho vị trí {{position}} tại {{company_name}}.\n\nThông tin phỏng vấn:\n• Ngày: {{date}}\n• Giờ: {{time}}\n• Địa điểm: {{location}}\n\nVui lòng chuẩn bị kỹ và xác nhận tham dự.\n\nChúc bạn thành công!\n\nTrân trọng,\nfreeC Consulting Team",
  "final-vi-online": "Kính gửi {{candidate_name}},\n\nXin chúc mừng bạn đã tiến đến vòng cuối!\n\nChúng tôi trân trọng mời bạn tham gia Vòng Phỏng Vấn Cuối (Online) cho vị trí {{position}} tại {{company_name}}.\n\nThông tin phỏng vấn:\n• Ngày: {{date}}\n• Giờ: {{time}}\n• Link tham gia: {{meeting_link}}\n\nVui lòng chuẩn bị kỹ và xác nhận tham dự.\n\nChúc bạn thành công!\n\nTrân trọng,\nfreeC Consulting Team",
};

// Inline editable chip for text variables
function IMChip({ name, value, placeholder, onChange }: any) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value||"");
  const ref = useRef<HTMLInputElement>(null);
  const empty = !value;

  useEffect(()=>{ setDraft(value||""); },[value]);
  useEffect(()=>{ if(editing && ref.current){ ref.current.focus(); ref.current.select(); }},[editing]);

  const commit = () => { onChange(draft.trim()||""); setEditing(false); };

  if (editing) return (
    <input ref={ref} value={draft}
      onChange={e=>setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e=>{ if(e.key==="Enter"||e.key==="Tab"){ e.preventDefault(); commit(); } if(e.key==="Escape"){ setDraft(value||""); setEditing(false); } }}
      style={{display:"inline",minWidth:60,width:Math.max(80,(draft.length||placeholder.length)*9)+"px", maxWidth: "100%",
        background:"#fff0f3",border:"1.5px solid #f43f5e",borderRadius:5,
        padding:"1px 6px",fontSize:"inherit",fontFamily:"inherit",
        color:"#9f1239",outline:"none",verticalAlign:"baseline",lineHeight:"inherit"}}
    />
  );

  return (
    <span onClick={()=>setEditing(true)}
      title={"Click to edit"}
      style={{display:"inline",background: empty?"#fff0f3":"#ffe4e6",
        color: empty?"#fb7185":"#9f1239",
        borderRadius:5, padding:"2px 8px", cursor:"text",
        border:"1px dashed "+(empty?"#fda4af":"#fecdd3"),
        fontStyle: empty?"italic":"normal",
        whiteSpace: empty ? "nowrap" : "pre-wrap", wordBreak: "break-word", verticalAlign:"baseline",
        transition:"background .1s"}}
      onMouseEnter={e=>e.currentTarget.style.background="#fecdd3"}
      onMouseLeave={e=>e.currentTarget.style.background=empty?"#fff0f3":"#ffe4e6"}
    >
      {value || placeholder}
    </span>
  );
}

// Date chip — custom mini calendar popup (no showPicker, iframe-safe)
function IMDateChip({ value, lang, onChange }: any) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(()=>{
    if (value) { const d=new Date(value+"T12:00:00"); return {y:d.getFullYear(),m:d.getMonth()}; }
    const n=new Date(); return {y:n.getFullYear(),m:n.getMonth()};
  });
  const displayed = value ? imFmtDate(value, lang) : (lang==="vi" ? "chọn ngày" : "select date");
  const empty = !value;
  const DAYS_EN = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const selected = value ? new Date(value+"T12:00:00") : null;
  const today = new Date();

  const daysInMonth = new Date(view.y, view.m+1, 0).getDate();
  const firstDay = new Date(view.y, view.m, 1).getDay();
  const cells = [];
  for (let i=0; i<firstDay; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  const pick = (d: number) => {
    const iso = view.y+"-"+String(view.m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
    onChange(iso); setOpen(false);
  };

  const prevM = () => setView(v=> v.m===0?{y:v.y-1,m:11}:{y:v.y,m:v.m-1});
  const nextM = () => setView(v=> v.m===11?{y:v.y+1,m:0}:{y:v.y,m:v.m+1});

  return (
    <span style={{display:"inline",position:"relative",verticalAlign:"baseline"}}>
      <span onClick={()=>setOpen(v=>!v)}
        style={{display:"inline",background:empty?"#fff0f3":"#ffe4e6",
          color:empty?"#fb7185":"#9f1239",borderRadius:5,padding:"2px 8px",cursor:"pointer",
          border:"1px dashed "+(empty?"#fda4af":"#fecdd3"),
          fontStyle:empty?"italic":"normal",whiteSpace:"nowrap",verticalAlign:"baseline"}}
        onMouseEnter={e=>e.currentTarget.style.background="#fecdd3"}
        onMouseLeave={e=>e.currentTarget.style.background=empty?"#fff0f3":"#ffe4e6"}
      >{displayed}</span>

      {open && <>
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:499}}/>
        <div style={{position:"absolute",top:"110%",left:0,zIndex:500,background:"#fff",
          borderRadius:12,border:"1.5px solid #e2e8f0",padding:"12px",
          boxShadow:"0 12px 32px rgba(0,0,0,.15)",width:240,fontFamily:"'DM Sans',sans-serif"}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <button onClick={prevM} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#64748b",padding:"2px 6px",borderRadius:6}}>{"<"}</button>
            <span style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{MONTHS[view.m]} {view.y}</span>
            <button onClick={nextM} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#64748b",padding:"2px 6px",borderRadius:6}}>{">"}</button>
          </div>
          {/* Day headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>
            {DAYS_EN.map(d=><div key={d} style={{textAlign:"center",fontSize:10.5,fontWeight:700,color:"#94a3b8",padding:"2px 0"}}>{d}</div>)}
          </div>
          {/* Cells */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {cells.map((d,i)=> !d
              ? <div key={"e"+i}/>
              : (()=>{
                const isSel = selected && selected.getFullYear()===view.y && selected.getMonth()===view.m && selected.getDate()===d;
                const isToday = today.getFullYear()===view.y && today.getMonth()===view.m && today.getDate()===d;
                return <button key={d} onClick={()=>pick(d)}
                  style={{padding:"5px 0",borderRadius:7,border:"none",cursor:"pointer",fontSize:12.5,fontWeight:isSel?700:400,textAlign:"center",
                    background:isSel?"linear-gradient(135deg,#8b5cf6,#6d28d9)":isToday?"#f5f3ff":"transparent",
                    color:isSel?"#fff":isToday?"#7c3aed":"#374151",transition:"background .1s"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="#f1f5f9";}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background=isToday?"#f5f3ff":"transparent";}}
                >{d}</button>;
              })()
            )}
          </div>
          {value && <button onClick={()=>{onChange("");setOpen(false);}}
            style={{marginTop:8,width:"100%",padding:"5px",border:"1px solid #fecdd3",borderRadius:7,background:"#fff0f3",color:"#f43f5e",fontSize:12,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
            Clear
          </button>}
        </div>
      </>}
    </span>
  );
}

// Time chip — HH:MM scroll picker, no showPicker needed
function IMTimeChip({ value, onChange }: any) {
  const [open, setOpen] = useState(false);
  const hv = value ? parseInt(value.split(":")[0])||0 : 9;
  const mv = value ? parseInt(value.split(":")[1])||0 : 0;
  const [h, setH] = useState(hv);
  const [m, setM] = useState(mv);
  const empty = !value;
  const displayed = value || (empty ? "select time" : "09:00");

  useEffect(()=>{
    if(value){ setH(parseInt(value.split(":")[0])||0); setM(parseInt(value.split(":")[1])||0); }
  },[value]);

  const commit = () => {
    onChange(String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"));
    setOpen(false);
  };

  const hours   = Array.from({length:24},(_,i)=>i);
  const minutes = [0,5,10,15,20,25,30,35,40,45,50,55];

  return (
    <span style={{display:"inline",position:"relative",verticalAlign:"baseline"}}>
      <span onClick={()=>setOpen(v=>!v)}
        style={{display:"inline",background:empty?"#fff0f3":"#ffe4e6",
          color:empty?"#fb7185":"#9f1239",borderRadius:5,padding:"2px 8px",cursor:"pointer",
          border:"1px dashed "+(empty?"#fda4af":"#fecdd3"),
          fontStyle:empty?"italic":"normal",whiteSpace:"nowrap",verticalAlign:"baseline"}}
        onMouseEnter={e=>e.currentTarget.style.background="#fecdd3"}
        onMouseLeave={e=>e.currentTarget.style.background=empty?"#fff0f3":"#ffe4e6"}
      >{displayed}</span>

      {open && <>
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:499}}/>
        <div style={{position:"absolute",top:"110%",left:0,zIndex:500,background:"#fff",
          borderRadius:12,border:"1.5px solid #e2e8f0",padding:"12px",
          boxShadow:"0 12px 32px rgba(0,0,0,.15)",fontFamily:"'DM Sans',sans-serif",width:180}}>
          <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Select time</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            {/* Hours */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"#64748b",marginBottom:4,textAlign:"center"}}>HH</div>
              <div style={{maxHeight:160,overflowY:"auto",borderRadius:8,border:"1px solid #e2e8f0"}}>
                {hours.map(hh=>(
                  <div key={hh} onClick={()=>setH(hh)}
                    style={{padding:"5px 8px",textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:hh===h?700:400,
                      background:hh===h?"#f5f3ff":"transparent",color:hh===h?"#7c3aed":"#374151",borderRadius:6,margin:2,transition:"background .1s"}}
                    onMouseEnter={e=>{if(hh!==h)e.currentTarget.style.background="#f8fafc";}}
                    onMouseLeave={e=>{if(hh!==h)e.currentTarget.style.background="transparent";}}
                  >{String(hh).padStart(2,"0")}</div>
                ))}
              </div>
            </div>
            {/* Minutes */}
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"#64748b",marginBottom:4,textAlign:"center"}}>MM</div>
              <div style={{maxHeight:160,overflowY:"auto",borderRadius:8,border:"1px solid #e2e8f0"}}>
                {minutes.map(mm=>(
                  <div key={mm} onClick={()=>setM(mm)}
                    style={{padding:"5px 8px",textAlign:"center",cursor:"pointer",fontSize:13,fontWeight:mm===m?700:400,
                      background:mm===m?"#f5f3ff":"transparent",color:mm===m?"#7c3aed":"#374151",borderRadius:6,margin:2,transition:"background .1s"}}
                    onMouseEnter={e=>{if(mm!==m)e.currentTarget.style.background="#f8fafc";}}
                    onMouseLeave={e=>{if(mm!==m)e.currentTarget.style.background="transparent";}}
                  >{String(mm).padStart(2,"0")}</div>
                ))}
              </div>
            </div>
          </div>
          <div style={{textAlign:"center",fontSize:18,fontWeight:800,color:"#4c1d95",marginBottom:10,letterSpacing:"2px"}}>
            {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}
          </div>
          <button onClick={commit}
            style={{width:"100%",padding:"7px",background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
            Confirm
          </button>
        </div>
      </>}
    </span>
  );
}

// Render template string as inline-editable React nodes
function IMEditor({ template, vars, lang, onChange }: any) {
  const htmlWithPlaceholders = template.replace(/\{\{([^}]+)\}\}/g, '<span class="im-chip-placeholder" data-var="$1"></span>');

  const placeholderLabels: Record<string, string> = {
    candidate_name: lang==="vi"?"Tên ứng viên":"Candidate name",
    company_name:   lang==="vi"?"Tên công ty":"Company",
    position:       lang==="vi"?"Vị trí":"Position",
    date:           lang==="vi"?"Chọn ngày":"Select date",
    time:           "00:00",
    location:       lang==="vi"?"Địa điểm":"Venue address",
    meeting_link:   "https://meet.google.com/...",
  };

  const options = {
    replace: (domNode: any) => {
      if (domNode.attribs && domNode.attribs.class === 'im-chip-placeholder') {
        const k = domNode.attribs['data-var'];
        if (k === "date") return <IMDateChip value={vars.date} lang={lang} onChange={(v: string)=>onChange("date",v)}/>;
        if (k === "time") return <IMTimeChip value={vars.time} onChange={(v: string)=>onChange("time",v)}/>;
        return <IMChip name={k} value={vars[k]||""} placeholder={placeholderLabels[k]||k} onChange={(v: string)=>onChange(k,v)}/>;
      }
    }
  };

  return (
    <div className="ql-editor" style={{fontFamily:"'DM Sans','Noto Sans',sans-serif",fontSize:14.5,lineHeight:1.9,
      color:"#1e293b",whiteSpace:"normal",wordBreak:"break-word",userSelect:"text", padding: 0, overflowY: 'visible'}}>
      {parse(htmlWithPlaceholders, options)}
    </div>
  );
}

export function InterviewMail({ toast }: any) {
  const STAGES = [{id:"1st",label:"1st"},{id:"2nd",label:"2nd / 3rd"},{id:"final",label:"Final"}];

  const loadState = () => {
    try {
      const s = JSON.parse(localStorage.getItem(IM_SAVE_KEY)||"{}");
      return {
        stage: s.stage||"1st", lang: s.lang||"en", type: s.type||"offline",
        vars: { candidate_name:"",company_name:"",position:"",date:"",time:"",location:"",meeting_link:"", ...(s.vars||{}) },
      };
    } catch { return {stage:"1st",lang:"en",type:"offline",vars:{candidate_name:"",company_name:"",position:"",date:"",time:"",location:"",meeting_link:""}}; }
  };

  const [state, setState] = useState(loadState);
  const { stage, lang, type, vars } = state;
  const [copied, setCopied] = useState("");

  const loadCustomTemplates = () => { try { return JSON.parse(localStorage.getItem(IM_TPL_KEY)||"{}"); } catch { return {}; } };
  const [customTpls, setCustomTpls] = useState<Record<string, string>>(loadCustomTemplates);
  const [editingTpl, setEditingTpl] = useState(false);
  const [tplDraft, setTplDraft] = useState("");

  const tplKey = stage+"-"+lang+"-"+type;
  const rawTemplate = customTpls[tplKey] || IM_DEFAULTS[tplKey] || IM_DEFAULTS["1st-en-offline"];
  
  const ensureHtml = (text: string) => {
    if (!text) return "";
    if (text.includes("<p>") || text.includes("<br>") || text.includes("<strong>") || text.includes("<ul>")) return text;
    return "<p>" + text.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>") + "</p>";
  };

  const template = ensureHtml(rawTemplate);

  const [loadingLocation, setLoadingLocation] = useState(false);

  const handleAILocation = async () => {
    if (!vars.location || vars.location.trim() === "") {
      toast("Please enter a basic location first (e.g., 'Bitexco') by clicking the location field.", "error");
      return;
    }
    setLoadingLocation(true);
    try {
      const res = await getGoogleMapsGrounding(vars.location);
      let newLoc = vars.location;
      if (res.mapUri) {
        if (!newLoc.includes(res.mapUri)) {
          newLoc += ` (Map: ${res.mapUri})`;
        }
        setVar("location", newLoc);
        toast("Location enhanced with Google Maps!", "success");
      } else {
        toast("Could not find a map link for this location.", "error");
      }
    } catch (e: any) {
      toast(e.message || "Failed to find location.", "error");
    } finally {
      setLoadingLocation(false);
    }
  };

  const save = (patch: any) => {
    setState((prev: any)=>{
      const next = {...prev,...patch, vars:{...prev.vars,...(patch.vars||{})}};
      try { localStorage.setItem(IM_SAVE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const setVar = (k: string,v: string) => save({vars:{[k]:v}});

  // Subject auto-generated
  const dateDisplay = vars.date ? imFmtDate(vars.date, lang) : (lang==="vi"?"[ngày]":"[date]");
  const subjectTpl = lang==="vi"
    ? "freeC - {{company_name}} || Thư Mời Phỏng Vấn - {{candidate_name}} - {{date}} - {{time}}"
    : "freeC - {{company_name}} || Interview Invitation - {{candidate_name}} - {{date}} - {{time}}";
  const subject = subjectTpl
    .replace("{{company_name}}", vars.company_name||"[company]")
    .replace("{{candidate_name}}", vars.candidate_name||"[candidate]")
    .replace("{{date}}", dateDisplay)
    .replace("{{time}}", vars.time||"[time]");

  // Resolved plain text for copy
  const resolve = (tpl: string) => {
    const esc = (s: string) => (s||"").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
    return tpl.replace(/\{\{([^}]+)\}\}/g, (match, k) => {
      if (k === "date") return vars.date ? esc(imFmtDate(vars.date, lang)) : "";
      return esc(vars[k] || "");
    });
  };

  const copy = async (text: string, key: string) => {
    try {
      if (key === "sub") {
        await navigator.clipboard.writeText(text);
      } else {
        let htmlText = text;
        
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = htmlText;
        
        const walk = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null);
        let node;
        const nodesToReplace = [];
        while ((node = walk.nextNode())) {
          if (node.parentNode && node.parentNode.nodeName === 'A') continue;
          if (/(https?:\/\/[^\s)<]+)/.test(node.nodeValue || "")) {
            nodesToReplace.push(node);
          }
        }
        
        nodesToReplace.forEach(n => {
          const span = document.createElement("span");
          span.innerHTML = (n.nodeValue || "").replace(/(https?:\/\/[^\s)<]+)/g, '<a href="$1">$1</a>');
          n.parentNode?.replaceChild(span, n);
        });

        htmlText = tempDiv.innerHTML;
        const plainText = tempDiv.innerText;

        const blobHtml = new Blob([htmlText], { type: "text/html" });
        const blobText = new Blob([plainText], { type: "text/plain" });
        const data = [new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        })];
        await navigator.clipboard.write(data);
      }
    } catch { 
      // Fallback for older browsers
      const el=document.createElement("textarea");
      el.value=text.replace(/<[^>]+>/g, "");
      el.style.cssText="position:fixed;opacity:0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      try{document.execCommand("copy");}catch{}
      document.body.removeChild(el); 
    }
    setCopied(key); setTimeout(()=>setCopied(""),2000);
  };

  const saveTpl = () => {
    const n = {...customTpls,[tplKey]:tplDraft};
    setCustomTpls(n);
    try { localStorage.setItem(IM_TPL_KEY,JSON.stringify(n)); } catch {}
    setEditingTpl(false);
  };
  const resetTpl = () => {
    const n = {...customTpls}; delete n[tplKey];
    setCustomTpls(n);
    try { localStorage.setItem(IM_TPL_KEY,JSON.stringify(n)); } catch {}
  };

  const seg = (active: boolean) => ({
    padding:"7px 14px", borderRadius:8, border:"1.5px solid "+(active?"#8b5cf6":"#e2e8f0"),
    cursor:"pointer", fontWeight:600, fontSize:13, fontFamily:"'DM Sans',sans-serif",
    background:active?"linear-gradient(135deg,#8b5cf6,#6d28d9)":"#fff",
    color:active?"#fff":"#374151", transition:"all .12s",
  });

  const pill = (active: boolean) => ({
    padding:"5px 14px", borderRadius:7, border:"none", cursor:"pointer", fontSize:12.5,
    fontWeight:700, fontFamily:"'DM Sans',sans-serif",
    background:active?"#fff":"transparent", color:active?"#8b5cf6":"#64748b",
    boxShadow:active?"0 1px 4px rgba(0,0,0,.1)":"none", transition:"all .12s",
  });

  return (
    <main style={{maxWidth:720,margin:"0 auto",padding:"28px 16px 100px",animation:"fadeIn .25s ease"}}>

      {/* ── Controls ── */}
      <div style={{marginBottom:20}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:14}}>
          <div>
            <h1 style={{fontSize:"clamp(20px,5vw,26px)",fontWeight:800,color:"#0f172a",letterSpacing:"-.02em",marginBottom:4}}>
              Interview <span style={{background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Mail</span>
            </h1>
            <p style={{fontSize:13,color:"#94a3b8"}}>Click any highlighted field to edit inline</p>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {type === "offline" && (
              <button onClick={handleAILocation} disabled={loadingLocation}
                style={{padding:"6px 12px",border:"1.5px solid #a78bfa",borderRadius:8,background:"#f5f3ff",cursor:"pointer",fontSize:12,fontWeight:600,color:"#7c3aed",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:5,opacity:loadingLocation?0.7:1}}>
                {loadingLocation ? <Spin size={12} color="#7c3aed" /> : "🪄"}
                {loadingLocation ? "Searching..." : "Enhance Location"}
              </button>
            )}
            {/* Edit template btn */}
            <button onClick={()=>{setTplDraft(template);setEditingTpl(true);}}
              style={{padding:"6px 12px",border:"1.5px solid #e2e8f0",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:12,fontWeight:600,color:"#6366f1",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",gap:5}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
              Template
            </button>
            {customTpls[tplKey] && (
              <button onClick={resetTpl}
                style={{padding:"6px 12px",border:"1.5px solid #fde68a",borderRadius:8,background:"#fffbeb",cursor:"pointer",fontSize:12,fontWeight:600,color:"#d97706",fontFamily:"'DM Sans',sans-serif"}}>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Stage + Mode + Lang */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {/* Stage */}
          {STAGES.map(s=>(
            <button key={s.id} onClick={()=>save({stage:s.id})} style={seg(stage===s.id)}>{s.label}</button>
          ))}

          <div style={{width:1,height:24,background:"#e2e8f0"}}/>

          {/* Online/Offline */}
          <div style={{display:"flex",background:"#f1f5f9",borderRadius:9,padding:3,gap:2}}>
            {[["offline","Offline"],["online","Online"]].map(([v,l])=>(
              <button key={v} onClick={()=>save({type:v})} style={pill(type===v)}>{l}</button>
            ))}
          </div>

          {/* Lang */}
          <div style={{display:"flex",background:"#f1f5f9",borderRadius:9,padding:3,gap:2}}>
            {["en","vi"].map(l=>(
              <button key={l} onClick={()=>save({lang:l})} style={pill(lang===l)}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Subject ── */}
      <div style={{background:"#f5f3ff",border:"1.5px solid #ddd6fe",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"flex-start",gap:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:10.5,fontWeight:700,color:"#a78bfa",textTransform:"uppercase",letterSpacing:".08em",marginBottom:5}}>Subject (auto)</div>
          <div style={{fontSize:13,color:"#4c1d95",fontWeight:500,lineHeight:1.5,wordBreak:"break-all"}}>{subject}</div>
        </div>
        <button onClick={()=>copy(subject,"sub")}
          style={{flexShrink:0,padding:"5px 12px",border:"1.5px solid #ddd6fe",borderRadius:8,cursor:"pointer",fontSize:11.5,fontWeight:600,color:copied==="sub"?"#059669":"#7c3aed",background:copied==="sub"?"#ecfdf5":"#fff",fontFamily:"'DM Sans',sans-serif",transition:"all .15s",display:"flex",alignItems:"center",gap:5}}>
          {copied==="sub"
            ?<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
            :<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
          }
        </button>
      </div>

      {/* ── Email Editor ── */}
      <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #e2e8f0",padding:"28px 32px",boxShadow:"0 2px 12px rgba(0,0,0,.05)",minHeight:420,marginBottom:16}}>
        <IMEditor template={template} vars={vars} lang={lang} onChange={setVar}/>
      </div>

      {/* ── Sticky Copy ── */}
      <div style={{position:"sticky",bottom:20,display:"flex",justifyContent:"center"}}>
        <button onClick={()=>copy(resolve(template),"body")}
          style={{display:"flex",alignItems:"center",gap:9,padding:"13px 36px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:15,fontFamily:"'DM Sans','Noto Sans',sans-serif",
            background:copied==="body"?"#059669":"linear-gradient(135deg,#8b5cf6,#6d28d9)",
            color:"#fff",boxShadow:copied==="body"?"0 6px 20px rgba(5,150,105,.3)":"0 6px 20px rgba(139,92,246,.4)",
            transition:"all .2s"}}>
          {copied==="body"
            ?<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Email Copied!</>
            :<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy Email</>
          }
        </button>
      </div>

      {/* ── Template Edit Modal ── */}
      {editingTpl && (
        <Modal title="Edit Template" subtitle={tplKey + " — use {{variable}} syntax"} onClose={()=>setEditingTpl(false)} width={700}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:8,lineHeight:1.6}}>
            Standard Variables:&nbsp;
            {["candidate_name","company_name","position","date","time",type==="online"?"meeting_link":"location"].map(v=>(
              <code key={v} style={{background:"#ffe4e6",color:"#9f1239",padding:"1px 5px",borderRadius:4,fontSize:11,marginRight:4}}>
                {"{{"+v+"}}"}
              </code>
            ))}
            <br/>
            <span style={{color:"#8b5cf6", fontWeight: 600}}>Tip:</span> You can create custom variables by typing e.g., <code style={{background:"#f5f3ff",color:"#7c3aed",padding:"1px 5px",borderRadius:4,fontSize:11}}>{"{{salary_range}}"}</code>
          </div>
          <div style={{ height: 350, marginBottom: 50 }}>
            <ReactQuill 
              theme="snow" 
              value={tplDraft} 
              onChange={setTplDraft} 
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, false] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{ 'color': [] }, { 'background': [] }],
                  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                  ['link'],
                  ['clean']
                ]
              }}
              style={{ height: '100%' }} 
            />
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={saveTpl} style={{padding:"9px 22px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13.5,fontFamily:"'DM Sans',sans-serif",background:"linear-gradient(135deg,#8b5cf6,#6d28d9)",color:"#fff"}}>Save</button>
            <button onClick={()=>setEditingTpl(false)} style={{padding:"9px 16px",borderRadius:10,border:"1.5px solid #e2e8f0",cursor:"pointer",fontWeight:600,fontSize:13.5,fontFamily:"'DM Sans',sans-serif",background:"#fff",color:"#64748b",marginLeft:"auto"}}>Cancel</button>
          </div>
        </Modal>
      )}
    </main>
  );
}

