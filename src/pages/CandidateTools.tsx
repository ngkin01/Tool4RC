import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Modal, TA, Btn, CopyBtn, Spin } from '../components/ui';
import { Sidebar as HistorySidebar } from '../components/Sidebar';
import { getSessions, saveSess, delSess, getSess, badCV, badJD } from '../lib/utils';
import { genSummary, extractEmail, buildEmail, geminiWithDoc, gemini } from '../lib/ai';

export function SumModal({summary,onClose,onRegen,loading}: any){
  const [text,setText]=useState(summary); const [ref,setRef]=useState("");
  return <Modal title="Candidate Summary" subtitle="Edit or refine before copying" onClose={onClose}>
    <div style={{marginBottom:14}}><label style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)",display:"block",marginBottom:8}}>Summary</label><TA value={text} onChange={setText} rows={11} mono/></div>
    <div style={{marginBottom:20}}><label style={{fontSize:13,fontWeight:600,color:"var(--text-secondary)",display:"block",marginBottom:8}}>Refinement Instructions</label><TA value={ref} onChange={setRef} placeholder="E.g. Focus more on leadership experience..." rows={3}/></div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <Btn onClick={()=>onRegen(ref)} disabled={loading||!ref.trim()} loading={loading} variant="outline"
        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>}>
        {loading?"Regenerating...":"Regenerate"}
      </Btn>
      <CopyBtn text={text} label="Copy Summary"/>
    </div>
  </Modal>;
}

export function EmailModal({emailText,onClose}: any){
  return <Modal title="Client Email" subtitle="Ready to copy and send" onClose={onClose}>
    <div style={{marginBottom:20}}><TA value={emailText} rows={17} mono readOnly/></div>
    <CopyBtn text={emailText} label="Copy Email"/>
  </Modal>;
}

export function AnalysisContent({analysis}: any) {
  const REC: any = {
    "PROCEED":                  {color:"var(--success-hover)", bg:"var(--bg-emerald-50)", border:"var(--border-emerald-200)", icon:"✓"},
    "Proceed":                  {color:"var(--success-hover)", bg:"var(--bg-emerald-50)", border:"var(--border-emerald-200)", icon:"✓"},
    "PROCEED WITH CAUTION":     {color:"var(--warning)", bg:"var(--bg-amber-50)", border:"var(--border-amber-200)", icon:"!"},
    "Proceed with conditions":  {color:"var(--warning)", bg:"var(--bg-amber-50)", border:"var(--border-amber-200)", icon:"!"},
    "Consider for interview":   {color:"var(--info)", bg:"var(--bg-sky-50)", border:"var(--border-sky-200)", icon:"?"},
    "NOT PRIORITIZE":           {color:"var(--danger)", bg:"var(--bg-red-50)", border:"var(--border-red-200)", icon:"✕"},
    "Not prioritize":           {color:"var(--danger)", bg:"var(--bg-red-50)", border:"var(--border-red-200)", icon:"✕"},
  };
  const FIT_COLOR: any = {"Strong Fit":"var(--success-hover)","Fit":"var(--info)","Potential":"var(--warning)","Weak":"var(--danger)","Weak Fit":"var(--danger)"};
  const GAP_COLOR: any = {"Critical":["var(--danger)","var(--bg-red-50)","var(--border-red-200)"],"Major":["var(--warning)","var(--bg-amber-50)","var(--border-amber-200)"],"Minor":["var(--text-secondary)","var(--bg-hover)","var(--border-color)"]};
  const STATUS_STYLE: any = {"MET":["var(--success-hover)","var(--bg-emerald-50)","✓"],"NOT MET":["var(--danger)","var(--bg-red-50)","✕"],"NOT FOUND":["var(--text-muted)","var(--bg-main)","?"]};
  const [copied, setCopied] = useState(false);

  const rec = REC[analysis.recommendation] || REC["PROCEED WITH CAUTION"];
  const qt = (typeof analysis.quickTake === "object" && analysis.quickTake) ? analysis.quickTake : {};

  const copyAll = async () => {
    const lines = [
      "CV ANALYSIS", "=".repeat(40),
      "Recommendation: " + analysis.recommendation,
      "Overall Fit: " + (analysis.overall||""),
      analysis.primaryReason||"", "",
      "QUICK TAKE",
      qt.strength ? "+ " + qt.strength : "",
      qt.keyGap   ? "△ " + qt.keyGap   : "",
      qt.positioning ? "→ " + qt.positioning : "", "",
      "REQUIREMENT CHECK",
      ...(analysis.requirementCheck||[]).map((r: any)=>"["+r.status+"] "+r.requirement+": "+r.evidence),
      "", "STRENGTHS", ...(analysis.strengths||[]).map((s: any)=>"• "+s),
      "", "GAPS", ...(analysis.gaps||[]).map((g: any)=>"• ["+g.type+"] "+g.item),
      "", "CONCERNS", ...(analysis.concerns||[]).map((c: any)=>"• "+c),
      "", "RED FLAGS", ...(analysis.redFlags||[]).map((r: any)=>"[!] "+r),
      "", "CONCLUSION", (typeof analysis.conclusion==="object" ? analysis.conclusion.reason : analysis.conclusion)||"",
      "", "INTERVIEW QUESTIONS",
      ...(analysis.interviewQuestions||[]).map((q: any,i: number)=>(i+1)+". "+q.question+"\n   Validates: "+q.validates),

    ].filter(Boolean).join("\n");

    try { await navigator.clipboard.writeText(lines); }
    catch { const el=document.createElement("textarea");el.value=lines;el.style.cssText="position:fixed;opacity:0";document.body.appendChild(el);el.focus();el.select();try{document.execCommand("copy");}catch{}document.body.removeChild(el); }
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  const Sec = ({title, color="var(--primary)", children}: any) => (
    <div style={{marginBottom:14}}>
      <div style={{fontSize:11,fontWeight:700,color,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
        <div style={{height:1,width:12,background:color,opacity:.4}}/>{title}
      </div>
      {children}
    </div>
  );

  return (
    <div style={{animation:"fadeIn .2s ease"}}>
      {/* Recommendation */}
      <div style={{background:rec.bg,border:"2px solid "+rec.border,borderRadius:12,padding:"14px 18px",marginBottom:16,textAlign:"center"}}>
        <div style={{fontSize:20,fontWeight:900,color:rec.color,marginBottom:4}}>{rec.icon} {analysis.recommendation}</div>
        {analysis.primaryReason&&<div style={{fontSize:13,color:rec.color,opacity:.85,fontStyle:"italic",marginBottom:8}}>{analysis.primaryReason}</div>}
        <div style={{display:"inline-flex",alignItems:"center",gap:12,background:"rgba(128,128,128,.15)",borderRadius:99,padding:"4px 16px"}}>
          <span style={{fontSize:12,color:"var(--text-muted)"}}>Fit:</span>
          <span style={{fontSize:13,fontWeight:800,color:FIT_COLOR[analysis.overall]||"var(--text-muted)"}}>{analysis.overall}</span>
          {analysis.confidence&&<>
            <span style={{fontSize:12,color:"var(--text-placeholder)"}}>|</span>
            <span style={{fontSize:12,color:"var(--text-muted)"}}>Confidence:</span>
            <span style={{fontSize:13,fontWeight:700,color:analysis.confidence==="High"?"var(--success-hover)":analysis.confidence==="Medium"?"var(--warning)":"var(--text-muted)"}}>{analysis.confidence}</span>
          </>}
        </div>
      </div>

      {/* Overall Candidate */}
      {(analysis.overallCandidate || analysis.roleInterpretation)&&(
        <div style={{background:"var(--bg-glass)",backdropFilter:"blur(16px)",borderRadius:10,border:"1.5px solid var(--border-glass)",padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Overall Candidate</div>
          {/* Meta tags row */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:analysis.overallCandidate?.profile || analysis.roleInterpretation?.whatTheyDo?8:0}}>
            {analysis.overallCandidate?.workType || analysis.roleInterpretation?.auditType&&(
              <span style={{fontSize:12,fontWeight:600,color:"var(--primary)",background:"var(--bg-indigo-50)",padding:"3px 10px",borderRadius:99,border:"1px solid var(--border-indigo-200)"}}>{analysis.overallCandidate?.workType || analysis.roleInterpretation?.auditType}</span>
            )}
            {analysis.overallCandidate?.level || analysis.roleInterpretation?.seniorityLevel&&(
              <span style={{fontSize:12,fontWeight:600,color:"var(--info)",background:"var(--bg-sky-50)",padding:"3px 10px",borderRadius:99,border:"1px solid var(--border-sky-200)"}}>{analysis.overallCandidate?.level || analysis.roleInterpretation?.seniorityLevel}</span>
            )}
            {analysis.overallCandidate?.industries || analysis.roleInterpretation?.industries&&(
              <span style={{fontSize:12,color:"var(--text-secondary)",background:"var(--bg-hover)",padding:"3px 10px",borderRadius:99,border:"1px solid var(--border-color)"}}>{analysis.overallCandidate?.industries || analysis.roleInterpretation?.industries}</span>
            )}
          </div>
          {analysis.overallCandidate?.profile || analysis.roleInterpretation?.whatTheyDo&&(
            <div style={{fontSize:13,color:"var(--text-muted)",lineHeight:1.6,borderTop:"1px solid var(--border-color)",paddingTop:8}}>{analysis.overallCandidate?.profile || analysis.roleInterpretation?.whatTheyDo}</div>
          )}
        </div>
      )}

      {/* Quick Take */}
      {(qt.strength||qt.keyGap||qt.positioning)&&(
        <Sec title="Quick Take" color="var(--primary)">
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            {qt.strength&&<div style={{display:"flex",gap:8,fontSize:13.5,color:"var(--text-secondary)"}}><span style={{color:"var(--success-hover)",fontWeight:700,flexShrink:0}}>+</span>{qt.strength}</div>}
            {qt.keyGap&&<div style={{display:"flex",gap:8,fontSize:13.5,color:"var(--text-secondary)"}}><span style={{color:"var(--warning)",fontWeight:700,flexShrink:0}}>△</span>{qt.keyGap}</div>}
            {qt.positioning&&<div style={{display:"flex",gap:8,fontSize:13.5,color:"var(--text-secondary)"}}><span style={{color:"var(--primary)",fontWeight:700,flexShrink:0}}>→</span>{qt.positioning}</div>}
          </div>
        </Sec>
      )}

      {/* Requirement Check */}
      {(analysis.requirementCheck||[]).length>0&&(
        <Sec title="Requirement Check" color="var(--info)">
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {(analysis.requirementCheck||[]).map((r: any,i: number)=>{
              const [col,bg,icon]=STATUS_STYLE[r.status]||STATUS_STYLE["NOT FOUND"];
              return <div key={i} style={{display:"flex",gap:10,padding:"8px 12px",borderRadius:8,background:bg,border:"1px solid "+col+"20"}}>
                <span style={{color:col,fontWeight:800,fontSize:13,flexShrink:0,width:14,textAlign:"center"}}>{icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:700,color:"var(--text-primary)"}}>{r.requirement}</span>
                    <span style={{fontSize:10,fontWeight:700,color:col,background:col+"15",padding:"1px 6px",borderRadius:99,border:"1px solid "+col+"30",whiteSpace:"nowrap"}}>{r.status}</span>
                  </div>
                  <div style={{fontSize:12,color:"var(--text-muted)",marginTop:2,lineHeight:1.4}}>{r.evidence}</div>
                </div>
              </div>;
            })}
          </div>
        </Sec>
      )}

      {/* Strengths + Gaps */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div style={{background:"var(--bg-green-50)",borderRadius:10,padding:"12px 14px",border:"1px solid var(--border-green-200)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--success-hover)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Strengths</div>
          {(analysis.strengths||[]).length===0
            ?<div style={{fontSize:12,color:"var(--text-placeholder)"}}>None listed</div>
            :(analysis.strengths||[]).map((s: any,i: number)=><div key={i} style={{display:"flex",gap:6,marginBottom:5,fontSize:12.5,color:"var(--success)",lineHeight:1.4}}><span style={{color:"var(--success)",flexShrink:0}}>•</span>{s}</div>)}
        </div>
        <div style={{background:"var(--bg-amber-50)",borderRadius:10,padding:"12px 14px",border:"1px solid var(--border-amber-200)"}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--warning)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Gaps</div>
          {(analysis.gaps||[]).length===0
            ?<div style={{fontSize:12,color:"var(--text-placeholder)"}}>None identified</div>
            :(analysis.gaps||[]).map((g: any,i: number)=>{
              const [col,bg,border]=GAP_COLOR[g.type]||GAP_COLOR["Minor"];
              return <div key={i} style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:6}}>
                <span style={{fontSize:10,fontWeight:700,color:col,background:bg,border:"1px solid "+border,padding:"1px 5px",borderRadius:99,flexShrink:0,marginTop:1}}>{g.type||"Gap"}</span>
                <span style={{fontSize:12.5,color:"var(--text-secondary)",lineHeight:1.4}}>{g.item}</span>
              </div>;
            })}
        </div>
      </div>

      {/* Concerns */}
      {(analysis.concerns||[]).length>0&&(
        <Sec title="Concerns" color="var(--text-muted)">
          {(analysis.concerns||[]).map((c: any,i: number)=><div key={i} style={{display:"flex",gap:7,fontSize:13,color:"var(--text-secondary)",lineHeight:1.5,marginBottom:4}}><span style={{color:"var(--text-placeholder)",flexShrink:0}}>•</span>{c}</div>)}
        </Sec>
      )}

      {/* Red Flags */}
      {(analysis.redFlags||[]).length>0&&(
        <Sec title="Red Flags" color="var(--danger)">
          {(analysis.redFlags||[]).map((r: any,i: number)=><div key={i} style={{display:"flex",gap:8,padding:"7px 12px",background:"var(--bg-red-50)",borderRadius:8,border:"1px solid var(--border-red-200)",fontSize:12.5,color:"var(--danger)",lineHeight:1.4,marginBottom:6}}><span style={{flexShrink:0}}>[!]</span>{r}</div>)}
        </Sec>
      )}

      {/* Conclusion */}
      {analysis.conclusion&&(
        <Sec title="Conclusion" color="var(--primary-hover)">
          <div style={{fontSize:13.5,color:"var(--text-secondary)",lineHeight:1.7,background:"var(--bg-glass)",backdropFilter:"blur(16px)",borderRadius:10,padding:"12px 14px",border:"1.5px solid var(--border-glass)",fontStyle:"italic"}}>
            {typeof analysis.conclusion === "object" ? analysis.conclusion.reason : analysis.conclusion}
          </div>
        </Sec>
      )}

      {/* Interview Questions */}
      {(analysis.interviewQuestions||[]).length>0&&(
        <Sec title="Interview Focus" color="var(--info)">
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {(analysis.interviewQuestions||[]).map((q: any,i: number)=>(
              <div key={i} style={{background:"var(--bg-sky-50)",borderRadius:9,padding:"10px 14px",border:"1px solid var(--border-sky-200)"}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)",marginBottom:4}}>{i+1}. {q.question}</div>
                <div style={{fontSize:11.5,color:"var(--info)"}}>→ <span style={{fontStyle:"italic"}}>{q.validates}</span></div>
              </div>
            ))}
          </div>
        </Sec>
      )}

      {/* Copy */}
      <div style={{marginTop:12}}>
        <button onClick={copyAll} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 20px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13.5,transition:"all .15s",background:copied?"var(--success-hover)":"linear-gradient(135deg,var(--primary),var(--primary-hover))",color:"var(--bg-card)",boxShadow:copied?"0 4px 14px rgba(5,150,105,.3)":"0 4px 14px rgba(124,58,237,.35)"}}>
          {copied?<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>:<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy Analysis</>}
        </button>
      </div>
    </div>
  );
}

export function AnalysisPanel({analysis, onClose}: any) {
  return (
    <Modal title="CV Analysis" subtitle="Internal use only — not for client sharing" onClose={onClose} width={700}>
      <AnalysisContent analysis={analysis}/>
    </Modal>
  );
}

export function CandidateTools({toast}: any){
  const [sopen,setSopen]=useState(false);
  const [cv,setCv]=useState(""); const [jd,setJd]=useState(""); const [notes,setNotes]=useState("");
  const [sum,setSum]=useState(""); const [einfo,setEinfo]=useState<any>(null);
  const [showSum,setShowSum]=useState(false); const [showEmail,setShowEmail]=useState(false);
  const [gL,setGL]=useState(false); const [eL,setEL]=useState(false); const [rL,setRL]=useState(false);
  const [aL,setAL]=useState(false); const [analysis,setAnalysis]=useState<any>(null);
  const [activeTab,setActiveTab]=useState("summary");
  const [analysisLang,setAnalysisLang]=useState("en"); // en | vi
  const [sessions,setSessions]=useState<any[]>([]);
  const [cvFile,setCvFile]=useState<any>(null);
  const [fileLoading,setFileLoading]=useState(false);

  useEffect(()=>setSessions(getSessions()),[]);
  const refresh=()=>setSessions(getSessions());
  const hasCV = cv.trim() || cvFile;

  const handleGen=async()=>{
    if(!cvFile&&badCV(cv)){toast(badCV(cv),"error");return;}
    const e2=badJD(jd); if(e2){toast(e2,"error");return;}
    setGL(true);
    try{
      const pdf=cvFile?.type==="pdf"?cvFile.base64:null;
      const r=await genSummary(cv,jd,notes,pdf);
      setSum(r); setActiveTab("summary");
      const nm=cv.match(/(?:name)[\s:]*([^\n]+)/i);
      const jm=jd.match(/(?:position|job title|role)[\s:]*([^\n]+)/i);
      saveSess({title:`${nm?nm[1].trim().split(/[, \n]/)[0]:"Candidate"} – ${jm?jm[1].trim().split(/[, \n]/)[0]:"Position"}`,cv,jd,notes,result:r});
      refresh(); toast("Summary generated!","success");
    }catch(e: any){console.error("handleGen error:", e); toast(e.message || "Error generating summary.","error");}
    finally{setGL(false);}
  };

  const handleRegen=async(ref: string)=>{
    setRL(true);
    try{const r=await genSummary(cv,jd,notes+(ref?`\n\nRefinement: ${ref}`:""));setSum(r);toast("Regenerated!","success");}
    catch(e: any){console.error("handleRegen error:", e); toast(e.message || "Error regenerating.","error");}
    finally{setRL(false);}
  };

  const handleEmail=async()=>{
    if(!cvFile&&badCV(cv)){toast(badCV(cv),"error");return;}
    setEL(true);
    try{const pdf=cvFile?.type==="pdf"?cvFile.base64:null;const i=await extractEmail(cv,jd,pdf);setEinfo(i);setShowEmail(true);}
    catch(e: any){console.error("handleEmail error:", e); toast(e.message || "Error extracting info.","error");}
    finally{setEL(false);}
  };

  const handleAnalyze=async()=>{
    if(!hasCV) return;
    setAL(true); setAnalysis(null);
    try{
      console.log("handleAnalyze: starting, hasCV=", !!hasCV, "cvFile=", !!cvFile);
      const pdf = cvFile?.type==="pdf" ? cvFile.base64 : null;
      const now = new Date();
      const currentDate = now.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const currentMonthName = now.toLocaleDateString("en-US",{month:"long"});

      // STEP 1: Always analyze in English (consistent results)
      const sys = "You are an experienced headhunter. Evaluate this candidate decisively." +
        "\\nCurrent date: " + currentDate + " (Year=" + currentYear + ", Month=" + currentMonth + "). When calculating durations: count months precisely = (endYear-startYear)*12 + (endMonth-startMonth). Example: July 2024 to March 2026 = 20 months." +
        "\\n\\nRULES:" +
        "\\n- Write and evaluate like a recruiter briefing another recruiter or hiring manager" +
        "\\n- Only use info explicitly stated in the CV. If not found = NOT FOUND" +
        "\\n- Do NOT fabricate certifications, experience, or employment details" +
        "\\n- Strong experience can offset missing certs (do not auto-reject)" +
        "\\n- Employment gaps <12 months = normal, low concern only" +
        "\\n- Strong+no critical gap=PROCEED; Strong+1 critical gap=PROCEED WITH CAUTION; Weak/irrelevant=NOT PRIORITIZE" +
        "\\n\\nReturn ONLY raw JSON. No markdown. No code blocks. No explanation. Start response with { directly." +
        "\\n\\nJSON structure:" +
        "\\n{" +
        "\\n  \\\"overallCandidate\\\": {\\\"profile\\\": \\\"2-3 sentences: who this person is, their background and experience level — write like a recruiter briefing a colleague\\\", \\\"workType\\\": \\\"hands-on audit|advisory|coordination|compliance monitoring|mixed\\\", \\\"level\\\": \\\"Execution|Lead|Manager\\\", \\\"industries\\\": \\\"list industries\\\"}," +
        "\\n  \\\"overall\\\": \\\"Strong Fit|Fit|Potential|Weak\\\"," +
        "\\n  \\\"recommendation\\\": \\\"Proceed|Proceed with conditions|Consider for interview|Not prioritize\\\"," +
        "\\n  \\\"confidence\\\": \\\"High|Medium|Low\\\"," +
        "\\n  \\\"primaryReason\\\": \\\"1 sentence: main factor driving this decision\\\"," +
        "\\n  \\\"quickTake\\\": {\\\"strength\\\": \\\"top strength (cite specifics)\\\"," +
        "\\\"keyGap\\\": \\\"main gap\\\", \\\"positioning\\\": \\\"how to pitch this candidate\\\"}," +
        "\\n  \\\"requirementCheck\\\": [{\\\"requirement\\\": \\\"JD requirement\\\", \\\"status\\\": \\\"MET|NOT MET|NOT FOUND\\\", \\\"evidence\\\": \\\"quote from CV or Not mentioned in CV\\\"}]," +
        "\\n  \\\"strengths\\\": [\\\"bullet\\\"]," +
        "\\n  \\\"gaps\\\": [{\\\"item\\\": \\\"gap\\\", \\\"type\\\": \\\"Critical|Major|Minor\\\"}]," +
        "\\n  \\\"concerns\\\": [\\\"concern\\\"]," +
        "\\n  \\\"redFlags\\\": [\\\"flag\\\"]," +
        "\\n  \\\"conclusion\\\": {\\\"recommendation\\\": \\\"Proceed|Proceed with conditions|Consider for interview|Not prioritize\\\", \\\"reason\\\": \\\"2-3 sentences as a recruiter would say to a hiring manager — practical, direct, no jargon\\\"}," +
        "\\n  \\\"interviewQuestions\\\": [{\\\"question\\\": \\\"question\\\", \\\"validates\\\": \\\"what it validates\\\"}]" +
        "\\n}" +
        "\\n\\nEXPERIENCE TIMELINE:" +
        "\\n- Today is exactly: " + currentMonthName + " " + currentYear + "." +
        "\\n- Present/Now/Current = " + currentMonthName + " " + currentYear + "." +
        "\\n- Duration formula: (endYear-startYear)*12 + (endMonth-startMonth) months." +
        "\\n- Example: July 2024 to March 2026 = (2026-2024)*12+(3-7) = 20 months." +
        "\\n- Always write exact: 20 months / 1 year 8 months. Never: recent / short time." +
        "\\nSTRICT MATCHING RULES" +
        "\\n========================" +
        "\\n- Do NOT assume equivalence between frameworks, tools, or standards. Similar does NOT mean same." +
        "\\n- If not explicitly mentioned in CV: mark NOT MET or TRANSFERABLE, never MET." +
        "\\n- Use: No explicit evidence of... / Transferable experience from... / Related but not equivalent to..." +
        "\\n\\nFIT RATING GUARDRAIL:" +
        "\\n- ANY critical requirement missing = do NOT assign Strong Fit." +
        "\\n- Required certification missing = maximum rating is Fit, not Strong Fit." +
        "\\n- Strong Fit ONLY when most core requirements are MET and no critical gap." +
        "\\n- When in doubt: downgrade." +
        "\\n\\nEXPERIENCE CLASSIFICATION:" +
        "\\n- Direct = exact match explicitly stated in CV." +
        "\\n- Transferable = similar but different domain or standard." +
        "\\n- No evidence = not mentioned in CV." +
        "\\n- Prefer Transferable over Direct when not exact." +
        "\\n- requirementCheck status: MET | NOT MET | TRANSFERABLE | NOT FOUND" +
        "\\n\\nWORDING CONTROL:" +
        "\\n- Avoid: directly maps / fully aligned / strong match (when gaps exist)." +
        "\\n- Prefer: provides a foundation for / can transition into / requires upskilling in" +
        "\\n\\nTONE RULES:" +
        "\\n- Write like a recruiter explaining to a hiring manager, not like a system report." +
        "\\n- Avoid: Proceed with caution / System warning / overly formal wording." +
        "\\n- Use natural alternatives: Proceed with conditions / Consider for interview / Some gaps to note / Requires further clarification." +
        "\\n- recommendation field values: Proceed / Proceed with conditions / Consider for interview / Not prioritize" +
        "\\n\\nSELF-CHECK before output: verify no assumptions or overclaiming. Verify fit rating = actual evidence." +
        (analysisLang === "vi" ? "\\n\\nCRITICAL RULE: You MUST write the entire JSON response in Vietnamese (except for technical terms, company names, certifications like ISO/SA8000, job titles, and proper nouns which should remain in English)." : "");
      const userMsg = pdf
        ? "CV is in the attached PDF.\\n\\nJob Description:\\n" + (jd||"Not provided")
        : "CV:\\n" + cv + "\\n\\nJob Description:\\n" + (jd||"Not provided");

      const result = await geminiWithDoc(sys, userMsg, pdf, 8000);

      // Strip markdown code blocks if present (\`\`\`json ... \`\`\`)
      let clean = result.trim();
      if (clean.startsWith("\`\`\`")) {
        const nl = clean.indexOf("\\n");
        clean = nl !== -1 ? clean.slice(nl + 1) : clean.slice(3);
      }
      if (clean.endsWith("\`\`\`")) {
        clean = clean.slice(0, clean.lastIndexOf("\`\`\`")).trim();
      }

      // Parse JSON
      let parsed = null;
      try { parsed = JSON.parse(clean); } catch {}
      if (!parsed) {
        const si = clean.indexOf("{"), ei = clean.lastIndexOf("}");
        if (si !== -1 && ei !== -1) {
          try { parsed = JSON.parse(clean.slice(si, ei+1)); } catch {
            try { parsed = JSON.parse(clean.slice(si, ei+1).replace(/,([\s\n]*[}\]])/g, "$1")); } catch {}
          }
        }
      }
      if (!parsed) throw new Error("Parse failed. Clean: " + clean.slice(0, 100));

      setAnalysis(parsed);
    }catch(e: any){
      const msg = e.message || "Unknown error";
      toast("Analysis failed: " + msg.slice(0,80), "error");
      console.error("handleAnalyze error:", e);
    }finally{
      setAL(false);
    }
  };
  const handleFile=async(e: any)=>{
    const file=e.target.files?.[0]; if(!file)return;
    setFileLoading(true);
    try{
      if(file.type==="application/pdf"||file.name.endsWith(".pdf")){
        const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res((r.result as string).split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
        setCvFile({name:file.name,base64:b64,type:"pdf"}); setCv("");
      }else{
        const text=await file.text(); setCv(text); setCvFile({name:file.name,base64:null,type:"txt"});
      }
      toast(`File loaded: ${file.name}`,"success");
    }catch{toast("Error reading file.","error");}
    finally{setFileLoading(false);e.target.value="";}
  };

  const clear=()=>{
    setCv("");setJd("");setNotes("");setSum("");setEinfo(null);
    setShowSum(false);setShowEmail(false);setCvFile(null);
    setAnalysis(null);setActiveTab("summary");
    toast("Cleared!","success");
  };

  const hasResult = sum||analysis;

  return <>
    <HistorySidebar open={sopen} onClose={()=>setSopen(false)} sessions={sessions} onNew={clear}
      onSelect={(id: string)=>{const s=getSess(id);if(!s)return;setCv(s.cv);setJd(s.jd);setNotes(s.notes);setSum(s.result);setSopen(false);toast("Session loaded","success");}}
      onDelete={(id: string)=>{delSess(id);refresh();toast("Deleted","success");}}/>
    <button onClick={()=>setSopen(true)} style={{position:"fixed",bottom:24,right:24,zIndex:90,background:"var(--text-primary)",border:"none",cursor:"pointer",padding:"12px 16px",borderRadius:99,color:"var(--bg-card)",display:"flex",alignItems:"center",gap:8,boxShadow:"0 4px 12px rgba(0,0,0,.15)",fontWeight:600,fontSize:13}}
      onMouseEnter={(e: any)=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={(e: any)=>e.currentTarget.style.transform="none"}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      History
    </button>

    <main style={{maxWidth:840,margin:"0 auto",padding:"24px 16px 72px",animation:"fadeIn .25s ease"}}>
      <div style={{marginBottom:24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12}}>
        <div>
          <h1 style={{fontSize:"clamp(22px,5vw,32px)",fontWeight:800,color:"var(--text-primary)",letterSpacing:"-.02em",marginBottom:6}}>
            Candidate <span style={{background:"linear-gradient(135deg,var(--primary),var(--primary))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Tools</span>
          </h1>
          <p style={{fontSize:14,color:"var(--text-muted)"}}>Summary, email draft, and CV pre-call analysis</p>
        </div>
        <a href="https://sotel.vn/cong-cu-lay-so-dien-thoai-tu-facebook-mien-phi/" target="_blank" rel="noopener noreferrer" 
           style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",background:"var(--bg-glass)",backdropFilter:"blur(16px)",border:"1.5px solid var(--border-glass)",borderRadius:8,fontSize:13,fontWeight:600,color:"var(--text-secondary)",textDecoration:"none",boxShadow:"var(--shadow-glass)",transition:"all .15s",marginTop:4}} 
           onMouseEnter={(e: any)=>{e.currentTarget.style.borderColor="var(--primary)";e.currentTarget.style.color="var(--primary)";e.currentTarget.style.background="var(--bg-glass-hover)";}} 
           onMouseLeave={(e: any)=>{e.currentTarget.style.borderColor="var(--border-glass)";e.currentTarget.style.color="var(--text-secondary)";e.currentTarget.style.background="var(--bg-glass)";}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          Find Phone
        </a>
      </div>

      {/* Input Section */}
      <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
        {/* CV */}
        <div style={{background:"var(--bg-glass)",backdropFilter:"blur(16px)",borderRadius:14,border:"1.5px solid var(--border-glass)",padding:"18px 20px",boxShadow:"var(--shadow-glass)"}}>
          <div style={{fontSize:13.5,fontWeight:700,color:"var(--text-primary)",marginBottom:10}}>Upload CV or paste text</div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
            <label style={{cursor:"pointer"}}>
              <input type="file" accept=".pdf,.docx,.txt" onChange={handleFile} style={{display:"none"}}/>
              <div style={{display:"flex",alignItems:"center",gap:7,padding:"8px 14px",background:"var(--bg-hover)",border:"1.5px solid var(--border-color)",borderRadius:9,fontSize:13,fontWeight:600,color:"var(--text-secondary)",cursor:"pointer"}}>
                {fileLoading?<><Spin size={13}/> Reading...</>:<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Upload File</>}
              </div>
            </label>
            {cvFile&&<div style={{display:"flex",alignItems:"center",gap:7,padding:"8px 12px",background:"var(--bg-emerald-50)",border:"1.5px solid var(--border-emerald-200)",borderRadius:9}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{fontSize:12.5,color:"var(--success)",fontWeight:500,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cvFile.name}</span>
              <button onClick={()=>{setCvFile(null);setCv("");}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:15,padding:"0 2px",lineHeight:1}}>×</button>
            </div>}
          </div>
          {!cvFile&&<TA value={cv} onChange={setCv} placeholder="Paste CV content here..." rows={6}/>}
          {cvFile?.type==="pdf"&&<div style={{background:"var(--bg-glass)",backdropFilter:"blur(16px)",border:"1.5px solid var(--border-glass)",borderRadius:9,padding:"12px",fontSize:13,color:"var(--text-muted)",textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PDF ready
          </div>}
        </div>

        <TA value={jd} onChange={setJd} placeholder="Paste job description..." rows={5}/>
        <TA value={notes} onChange={setNotes} placeholder="Notes: salary, notice period, etc. (optional)" rows={2}/>
      </div>

      {/* Action Buttons */}
      <div style={{display:"flex",gap:8,marginBottom:28,flexWrap:"wrap"}}>
        <Btn onClick={handleGen} disabled={gL||!hasCV||!jd.trim()} loading={gL} variant="primary" style={{flex:"1 1 auto"}}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}>
          {gL?"Generating...":"Generate Summary"}
        </Btn>
        <div style={{display:"flex",alignItems:"center",borderRadius:12,border:"1.5px solid var(--primary)",overflow:"hidden",flexShrink:0,flex:"1 1 auto"}}>
          <button onClick={handleAnalyze} disabled={aL||!hasCV}
            style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,gap:7,padding:"0 14px",height:44,background:"var(--bg-glass)",backdropFilter:"blur(16px)",border:"none",cursor:aL||!hasCV||!jd.trim()?"not-allowed":"pointer",fontWeight:600,fontSize:14,color:"var(--primary-hover)",opacity:aL||!hasCV||!jd.trim()?.5:1}}
            onMouseEnter={(e: any)=>{if(!aL&&hasCV&&jd.trim())e.currentTarget.style.background="var(--bg-glass-hover)";}}
            onMouseLeave={(e: any)=>e.currentTarget.style.background="var(--bg-glass)"}>
            {aL ? <><span style={{width:14,height:14,border:"2px solid var(--primary)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block",marginRight:6}}/> Analyzing...</> : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:4}}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Analyze CV</>}
          </button>
          <div style={{display:"flex",borderLeft:"1.5px solid var(--border-glass)",height:44}}>
            {["EN","VI"].map(lang=>(
              <button key={lang} onClick={()=>setAnalysisLang(lang.toLowerCase())}
                style={{width:40,height:"100%",border:"none",borderLeft:lang==="VI"?"1.5px solid var(--border-glass)":"none",cursor:"pointer",fontSize:11,fontWeight:700,transition:"all .15s",background:analysisLang===lang.toLowerCase()?"var(--bg-glass-hover)":"var(--bg-glass)",backdropFilter:"blur(16px)",color:analysisLang===lang.toLowerCase()?"var(--primary-hover)":"var(--text-placeholder)"}}>
                {lang}
              </button>
            ))}
          </div>
        </div>
        <Btn onClick={handleEmail} disabled={eL||!hasCV} loading={eL} variant="outline" style={{flex:"1 1 auto"}}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}>
          {eL?"Generating...":"Generate Email"}
        </Btn>
        <Btn onClick={clear} variant="ghost" style={{flex:"1 1 auto"}}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>}>
          Clear
        </Btn>

      </div>

      {/* Result Area */}
      {hasResult && (
        <div>
          {/* Tabs */}
          <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:"1.5px solid var(--border-color)",paddingBottom:0}}>
            {sum && (
              <button onClick={()=>setActiveTab("summary")}
                style={{padding:"8px 16px",background:"none",border:"none",cursor:"pointer",fontSize:13.5,fontWeight:activeTab==="summary"?700:500,color:activeTab==="summary"?"var(--primary)":"var(--text-muted)",borderBottom:activeTab==="summary"?"2px solid var(--primary)":"2px solid transparent",marginBottom:-1.5,transition:"all .15s"}}>
                Summary
              </button>
            )}
            {analysis && (
              <button onClick={()=>setActiveTab("analysis")}
                style={{padding:"8px 16px",background:"none",border:"none",cursor:"pointer",fontSize:13.5,fontWeight:activeTab==="analysis"?700:500,color:activeTab==="analysis"?"var(--primary-hover)":"var(--text-muted)",borderBottom:activeTab==="analysis"?"2px solid var(--primary-hover)":"2px solid transparent",marginBottom:-1.5,transition:"all .15s",display:"flex",alignItems:"center",gap:6}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M11 8v3l2 2"/></svg>
                CV Analysis
              </button>
            )}
          </div>

          {/* Summary Tab */}
          {activeTab==="summary" && sum && (
            <div style={{animation:"fadeIn .2s ease"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:"var(--success)"}}/>
                  <span style={{fontSize:13.5,fontWeight:700,color:"var(--text-primary)"}}>Generated Summary</span>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <Btn onClick={()=>setShowSum(true)} variant="outline"
                    icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}>Edit</Btn>
                  <CopyBtn text={sum}/>
                </div>
              </div>
              <div style={{background:"var(--bg-glass)",backdropFilter:"blur(16px)",borderRadius:10,border:"1.5px solid var(--border-glass)",padding:"14px 16px",fontSize:13.5,color:"var(--text-secondary)",lineHeight:1.7,maxHeight:300,overflowY:"auto"}}>
                <Markdown
                  components={{
                    ul: ({node, ...props}) => <ul style={{listStyleType: 'disc', paddingLeft: 20, margin: '8px 0'}} {...props} />,
                    ol: ({node, ...props}) => <ol style={{listStyleType: 'decimal', paddingLeft: 20, margin: '8px 0'}} {...props} />,
                    li: ({node, ...props}) => <li style={{marginBottom: 4}} {...props} />,
                    strong: ({node, ...props}) => <strong style={{fontWeight: 700, color: 'var(--text-primary)'}} {...props} />,
                    p: ({node, ...props}) => <p style={{marginBottom: 8}} {...props} />
                  }}
                >
                  {sum}
                </Markdown>
              </div>
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab==="analysis" && analysis && <AnalysisContent analysis={analysis}/>}
        </div>
      )}

      {/* Loading state for analysis */}
      {aL && !analysis && (
        <div style={{textAlign:"center",padding:"40px 20px",color:"var(--text-placeholder)"}}>
          <Spin size={28} color="var(--primary-hover)"/>
          <div style={{marginTop:12,fontSize:14,fontWeight:500,color:"var(--primary)"}}>Analyzing CV...</div>
          <div style={{fontSize:12,color:"var(--text-placeholder)",marginTop:4}}>Thinking like a senior recruiter...</div>
        </div>
      )}

      {/* Empty state */}
      {!hasResult && !aL && (
        <div style={{textAlign:"center",padding:"32px 20px",color:"var(--text-placeholder)",background:"var(--bg-glass)",backdropFilter:"blur(16px)",borderRadius:14,border:"1.5px dashed var(--border-glass)"}}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{margin:"0 auto 10px",display:"block",opacity:.4}}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <div style={{fontSize:14,fontWeight:500,marginBottom:4}}>Upload a CV to get started</div>
          <div style={{fontSize:12}}>Generate summary, analyze fit, or draft email</div>
        </div>
      )}    </main>
    {showSum&&<SumModal summary={sum} onClose={()=>setShowSum(false)} onRegen={handleRegen} loading={rL}/>}
    {showEmail&&einfo&&<EmailModal emailText={buildEmail(einfo,sum)} onClose={()=>setShowEmail(false)}/>}
    {/* analysis shown inline in tab */}
  </>;
}
