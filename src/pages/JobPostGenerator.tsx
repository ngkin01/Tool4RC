import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { gemini } from '../lib/ai';
import { Spin, Modal, TA } from '../components/ui';
import { LinkedInFormatter } from '../components/LinkedInFormatter';

const DEFAULT_PLATFORMS = [
  {
    id:"linkedin", name:"LinkedIn Post",
    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>,
    color:"#0A66C2", bg:"#EBF3FB",
    prompt:`Write a professional LinkedIn recruitment post based on this job description.
- Start with a compelling hook line
- Use short paragraphs and bullet points
- Highlight key responsibilities and requirements
- Mention growth opportunities and company culture
- End with a clear call to action (apply link or contact info)
- Add 5 relevant professional hashtags at the end
- Keep it under 1300 characters
- Tone: professional but engaging`
  },
  {
    id:"fb_group", name:"FB Group",
    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
    color:"#1877F2", bg:"#EBF0FD",
    prompt:`Write a Facebook recruitment post for a job community group.
- Open with an attention-grabbing line
- Keep it concise and scannable
- Use emojis sparingly but effectively
- Include key job details: role, location, salary range if available
- Add a clear apply instruction
- End with 3-5 relevant hashtags
- Tone: friendly, direct, community-oriented`
  },
  {
    id:"fb_personal", name:"FB Profile",
    icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
    color:"#1877F2", bg:"#EBF0FD",
    prompt:`Write a personal Facebook recruitment post (as if posted on a personal profile).
- Write in first-person, warm and personal voice
- Start with "I'm looking for..." or "My team is hiring..."
- Keep it conversational and authentic
- Mention why this role/company is exciting
- Include how to apply or reach out personally
- End with 2-3 hashtags max
- Tone: personal, warm, authentic`
  },
];

const JP_STORAGE_KEY = "ra-jobpost-platforms";
const JP_VERSIONS_KEY = "ra-jobpost-versions";

function loadPlatforms() {
  try {
    const saved = JSON.parse(localStorage.getItem(JP_STORAGE_KEY)||"[]");
    const defaultMap: any = {};
    DEFAULT_PLATFORMS.forEach(p => { defaultMap[p.id] = p; });
    // Merge saved custom prompts into defaults
    saved.forEach((s: any) => { if(defaultMap[s.id]) defaultMap[s.id] = {...defaultMap[s.id], prompt: s.prompt}; else defaultMap[s.id] = s; });
    const custom = saved.filter((s: any) => !DEFAULT_PLATFORMS.find(d => d.id === s.id));
    return [...DEFAULT_PLATFORMS.map(d => defaultMap[d.id] || d), ...custom];
  } catch { return DEFAULT_PLATFORMS; }
}

function savePlatforms(platforms: any[]) {
  try { localStorage.setItem(JP_STORAGE_KEY, JSON.stringify(platforms.map(p => ({id:p.id,name:p.name,prompt:p.prompt,color:p.color||"var(--primary)",bg:p.bg||"var(--bg-indigo-50)"}))));} catch {}
}

export function JobPostGenerator({toast}: any) {
  const [jd, setJd] = useState("");
  const [platforms, setPlatforms] = useState(loadPlatforms);
  const [activePlatId, setActivePlatId] = useState<any>(null);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [editingPlat, setEditingPlat] = useState<any>(null); // platform being edited
  const [editPromptText, setEditPromptText] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlatName, setNewPlatName] = useState("");
  const [newPlatPrompt, setNewPlatPrompt] = useState("");
  const [copiedV, setCopiedV] = useState(false);
  const [urlLoading, setUrlLoading] = useState(false);

  const currentPost = versions[activeVersion] || null;

  const handleGenerate = async (platId: string) => {
    if (!jd.trim()) return;
    // AI handles invalid input via system prompt — no extra validation needed
    const plat = platforms.find((p: any) => p.id === platId);
    if (!plat) return;
    setActivePlatId(platId);
    setLoading(true);
    try {
      const result = await gemini(
        `You are an expert recruitment marketer and social media copywriter.
Your task is to transform a Job description into an engaging social media job post.

CORE OBJECTIVE
The goal is NOT to summarize the job description.
The goal is to identify the most attractive insights from the JD and rewrite them into a compelling post that would attract potential candidates on social media.

IMPORTANT RULES
1. Do NOT copy the job description text.
2. Do NOT rewrite the JD line by line.
3. Extract only the most important insights: job title, location, key responsibilities, key requirements, benefits or unique selling points.
4. Focus only on information that would attract candidates.
5. Prioritize readability and engagement over completeness.
6. Use short paragraphs and clear structure.
7. Avoid corporate HR language and generic AI phrases.
8. Write naturally like a real recruiter posting on social media.
9. Do NOT invent information that does not exist in the Job description.
10. If key information is missing, simply omit it.

ANALYSIS STEP
Before writing the post, internally analyze the Job description and determine:
- what makes this job attractive
- which details are most important to candidates
- which information should be highlighted
Do NOT show this analysis in the output.

WRITING STYLE
The final post should be concise, easy to read, sound natural and human, use line breaks for readability, and avoid sounding like a formal job description.

LANGUAGE RULE
Detect the language of the Job description and write the post in the same language unless the user explicitly asks for another language.
Vietnamese JD → write in Vietnamese | English JD → write in English | other languages → match accordingly.

INVALID INPUT RULE
If the input is too short, meaningless, or does not look like a real Job description, respond with exactly:
"The job description does not contain enough information to generate a job post. Please provide a proper Job description."

OUTPUT RULE
Output ONLY the final social media post. No analysis. No explanations. No preamble.`,
        `Platform: ${plat.name}
${plat.prompt}

Job description:
${jd}
${instruction.trim() ? `\nAdditional instruction: ${instruction.trim()}` : ""}

Output ONLY the post content. No explanations, no "Here is..." preamble. Just the post ready to copy and paste.`,
        1200
      );
      const newVersion = { text: result.trim(), platform: plat.name, platId, timestamp: Date.now() };
      setVersions(prev => {
        const updated = [newVersion, ...prev].slice(0, 5);
        try { localStorage.setItem(JP_VERSIONS_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
      setActiveVersion(0);
    } catch (e) {
      toast("Error generating post. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (activePlatId) handleGenerate(activePlatId);
  };

  const handleExtractURL = async () => {
    const url = jd.trim();
    if (!url.startsWith("http")) return;
    setUrlLoading(true);
    try {
      const result = await gemini(
        "You extract job descriptions from URLs. When given a URL, describe what job it likely contains based on common patterns. If you cannot access the URL, ask the user to paste the JD text directly.",
        `The user provided this URL: ${url}\n\nPlease tell them to paste the job description text directly as you cannot fetch URLs.`,
        300
      );
      setJd(result);
    } catch { }
    finally { setUrlLoading(false); }
  };

  const handleSaveEdit = () => {
    const updated = platforms.map((p: any) => p.id === editingPlat.id ? {...p, prompt: editPromptText} : p);
    setPlatforms(updated);
    savePlatforms(updated);
    setEditingPlat(null);
  };

  const handleAddPlatform = () => {
    if (!newPlatName.trim() || !newPlatPrompt.trim()) return;
    const newPlat = {
      id: "custom_" + Date.now(),
      name: newPlatName.trim(),
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
      color: "var(--primary)", bg: "var(--bg-indigo-50)",
      prompt: newPlatPrompt.trim(),
    };
    const updated = [...platforms, newPlat];
    setPlatforms(updated);
    savePlatforms(updated);
    setNewPlatName(""); setNewPlatPrompt("");
    setShowAddModal(false);
  };

  const handleDeletePlatform = (id: string) => {
    const updated = platforms.filter((p: any) => p.id !== id);
    setPlatforms(updated);
    savePlatforms(updated);
  };

  const isURL = jd.trim().startsWith("http");

  const inpStyle: any = {border:"1.5px solid var(--border-glass)",borderRadius:10,padding:"12px 14px",fontSize:14,outline:"none",background:"var(--bg-glass)",color:"var(--text-primary)",width:"100%",lineHeight:1.6,transition:"border-color .2s"};

  return (
    <main style={{maxWidth:860,margin:"0 auto",padding:"32px 16px 80px",animation:"fadeIn .25s ease"}}>
      <div style={{marginBottom:28}}>
        <h1 style={{fontSize:"clamp(22px,5vw,32px)",fontWeight:800,color:"var(--text-primary)",letterSpacing:"-.02em",marginBottom:8}}>
          Generate <span style={{background:"linear-gradient(135deg,var(--success),var(--success-hover))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Job Post</span>
        </h1>
        <p style={{fontSize:14,color:"var(--text-muted)"}}>Paste a JD and choose a platform to generate a ready-to-post update</p>
      </div>

      {/* Input Section */}
      <div style={{display:"flex",flexDirection:"column",gap:20,marginBottom:24}}>
        
        {/* Step 1: JD */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <label style={{fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>Job Description or Job URL</label>
          </div>
          <div style={{position:"relative"}}>
            <TA value={jd} onChange={setJd} placeholder="Paste job description..." rows={7}/>
            {isURL && (
              <div style={{position:"absolute",bottom:12,right:12}}>
                <button onClick={handleExtractURL} disabled={urlLoading}
                  style={{padding:"8px 16px",border:"1.5px solid var(--border-glass)",borderRadius:8,background:"var(--bg-glass)",backdropFilter:"blur(16px)",fontSize:12.5,fontWeight:600,cursor:"pointer",color:"var(--text-primary)",display:"flex",alignItems:"center",gap:6,boxShadow:"var(--shadow-glass)",transition:"all .15s"}}
                  onMouseEnter={(e: any)=>{e.currentTarget.style.borderColor="var(--success)";e.currentTarget.style.color="var(--success)";}}
                  onMouseLeave={(e: any)=>{e.currentTarget.style.borderColor="var(--border-glass)";e.currentTarget.style.color="var(--text-primary)";}}>
                  {urlLoading?<><Spin size={13}/>Extracting...</>:"Extract JD from URL"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Instructions */}
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)",marginBottom:8}}>Optional Instructions <span style={{fontWeight:400,color:"var(--text-muted)",fontSize:12}}>(Tone, length, highlights)</span></div>
          <TA value={instruction} onChange={setInstruction} placeholder="E.g., Keep it under 3 paragraphs, highlight remote work benefits..." rows={2}/>
        </div>

        {/* Step 3: Platforms */}
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)",marginBottom:12}}>Generate For</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {platforms.map((p: any)=>(
              <div key={p.id} style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
                <button
                  onClick={()=>handleGenerate(p.id)}
                  disabled={loading||!jd.trim()}
                  className="jp-btn"
                  style={{
                    display:"flex",alignItems:"center",gap:7,padding:"10px 18px",
                    borderRadius:10,fontWeight:700,fontSize:13.5,
                    cursor:loading||!jd.trim()?"not-allowed":"pointer",
                    position:"relative",overflow:"hidden",transition:"all .15s",
                    ...(loading&&activePlatId===p.id ? {
                      background:p.color,color:"var(--bg-card)",
                      border:`1.5px solid ${p.color}`,
                      boxShadow:`0 4px 20px ${p.color}60`,
                      transform:"scale(0.96)",
                    } :
                    activePlatId===p.id ? {
                      background:`linear-gradient(135deg,${p.color},${p.color}dd)`,
                      color:"var(--bg-card)",
                      border:`1.5px solid ${p.color}`,
                      boxShadow:`0 6px 20px ${p.color}50`,
                    } :
                    loading ? {
                      background:"var(--bg-glass)",color:"var(--text-muted)",
                      border:"1.5px solid var(--border-glass)",
                      opacity:.55,
                    } :
                    {
                      background:"var(--bg-glass)",color:p.color,
                      border:`1.5px solid var(--border-glass)`,
                      boxShadow:`var(--shadow-glass)`,
                      backdropFilter: "blur(16px)"
                    }),
                  }}
                  onMouseEnter={(e: any)=>{
                    if(loading||!jd.trim()) return;
                    if(activePlatId===p.id) return;
                    e.currentTarget.style.background="var(--bg-glass-hover)";
                    e.currentTarget.style.borderColor=p.color;
                    e.currentTarget.style.boxShadow=`0 8px 24px ${p.color}35`;
                    e.currentTarget.style.color=p.color;
                  }}
                  onMouseLeave={(e: any)=>{
                    if(loading||!jd.trim()) return;
                    if(activePlatId===p.id) return;
                    e.currentTarget.style.background="var(--bg-glass)";
                    e.currentTarget.style.borderColor=`var(--border-glass)`;
                    e.currentTarget.style.boxShadow=`var(--shadow-glass)`;
                    e.currentTarget.style.color=p.color;
                  }}
                >
                  {loading&&activePlatId===p.id
                    ?<Spin size={13} color="var(--bg-card)"/>
                    :<span style={{color:"inherit",display:"flex",alignItems:"center"}}>{p.icon}</span>
                  }
                  {p.name}
                  {activePlatId===p.id&&!loading&&(
                    <span style={{marginLeft:4,fontSize:11,opacity:.8}}>✓</span>
                  )}
                </button>
                <button onClick={(e: any)=>{e.stopPropagation();setEditingPlat(p);setEditPromptText(p.prompt);}}
                  style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:"var(--bg-card)",border:"1.5px solid var(--border-glass)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"var(--text-muted)",zIndex:1}}
                  title="Edit prompt">✎</button>
                {p.id.startsWith("custom_")&&(
                  <button onClick={(e: any)=>{e.stopPropagation();handleDeletePlatform(p.id);}}
                    style={{position:"absolute",top:-6,left:-6,width:18,height:18,borderRadius:"50%",background:"var(--bg-red-50)",border:"1px solid var(--border-red-200)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"var(--danger)",zIndex:1}}
                    title="Remove">×</button>
                )}
              </div>
            ))}
            <button onClick={()=>setShowAddModal(true)} className="jp-btn"
              style={{display:"flex",alignItems:"center",gap:7,padding:"10px 18px",borderRadius:10,border:"1.5px dashed var(--border-glass)",cursor:"pointer",fontWeight:600,fontSize:13.5,background:"var(--bg-glass)",backdropFilter:"blur(16px)",color:"var(--text-primary)",boxShadow:"var(--shadow-glass)"}}
              onMouseEnter={(e: any)=>{e.currentTarget.style.borderColor="var(--success)";e.currentTarget.style.color="var(--success)";e.currentTarget.style.background="var(--bg-green-50)";}}
              onMouseLeave={(e: any)=>{e.currentTarget.style.borderColor="var(--border-glass)";e.currentTarget.style.color="var(--text-primary)";e.currentTarget.style.background="var(--bg-glass)";}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Platform
            </button>
          </div>
          <div style={{marginTop:10,fontSize:12,color:"var(--text-placeholder)"}}>✎ Hover a platform and click the pencil icon to edit its prompt template</div>
        </div>
      </div>

      {/* Generated Post */}
      {(loading||versions.length>0)&&(
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"var(--text-primary)",marginBottom:12}}>Generated Post</div>

          {loading&&!currentPost?(
            <div style={{background:"var(--bg-glass)",backdropFilter:"blur(16px)",borderRadius:14,border:"1.5px solid var(--border-glass)",padding:"40px",textAlign:"center",boxShadow:"var(--shadow-glass)"}}>
              <Spin size={28} color="var(--success)"/>
              <div style={{marginTop:12,fontSize:14,color:"var(--text-primary)"}}>Generating your post...</div>
            </div>
          ):(
            <div style={{background:"var(--bg-glass)",backdropFilter:"blur(16px)",borderRadius:14,border:"1.5px solid var(--border-glass)",padding:"22px 24px",boxShadow:"var(--shadow-glass)"}}>
              {/* Post header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:12}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"var(--success)"}}/>
                  <span style={{fontSize:13.5,fontWeight:700,color:"var(--text-primary)"}}>{currentPost?.platform}</span>
                  {loading&&<Spin size={13} color="var(--success)"/>}
                </div>
                <div style={{fontSize:12,color:"var(--text-placeholder)"}}>{currentPost&&new Date(currentPost.timestamp).toLocaleTimeString()}</div>
              </div>

              {/* Post content */}
              <div style={{background:"var(--bg-glass)",backdropFilter:"blur(8px)",borderRadius:10,border:"1px solid var(--border-glass)",padding:"16px 18px",fontSize:14,color:"var(--text-primary)",lineHeight:1.8,marginBottom:16,minHeight:80}}>
                <Markdown
                  components={{
                    ul: ({node, ...props}) => <ul style={{listStyleType: 'disc', paddingLeft: 20, margin: '8px 0'}} {...props} />,
                    ol: ({node, ...props}) => <ol style={{listStyleType: 'decimal', paddingLeft: 20, margin: '8px 0'}} {...props} />,
                    li: ({node, ...props}) => <li style={{marginBottom: 4}} {...props} />,
                    strong: ({node, ...props}) => <strong style={{fontWeight: 700, color: 'var(--text-primary)'}} {...props} />,
                    p: ({node, ...props}) => <p style={{marginBottom: 8}} {...props} />
                  }}
                >
                  {currentPost?.text||""}
                </Markdown>
              </div>
              {/* Action buttons */}
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button onClick={async()=>{await navigator.clipboard.writeText(currentPost?.text||"");setCopiedV(true);setTimeout(()=>setCopiedV(false),2000);}} className="jp-btn"
                  style={{display:"flex",alignItems:"center",gap:7,padding:"9px 20px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:13.5,background:copiedV?"var(--success-hover)":"linear-gradient(135deg,var(--success),var(--success-hover))",color:"var(--bg-card)",boxShadow:copiedV?"0 2px 8px rgba(16,185,129,.2)":"0 6px 20px rgba(16,185,129,.35)",transition:"all .15s"}}>
                  {copiedV?<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!</>:<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>}
                </button>
                <button onClick={handleRegenerate} disabled={loading||!jd.trim()} className="jp-btn"
                  style={{display:"flex",alignItems:"center",gap:7,padding:"9px 20px",borderRadius:10,border:"1.5px solid var(--border-glass)",cursor:loading?"not-allowed":"pointer",fontWeight:600,fontSize:13.5,background:"var(--bg-glass)",backdropFilter:"blur(16px)",color:"var(--text-primary)",opacity:loading?.5:1,boxShadow:"var(--shadow-glass)",transition:"all .15s"}}
                  onMouseEnter={(e: any)=>{if(!loading){e.currentTarget.style.borderColor="var(--success)";e.currentTarget.style.color="var(--success)";e.currentTarget.style.background="var(--bg-green-50)";e.currentTarget.style.boxShadow="0 6px 16px rgba(16,185,129,.15)";}}}
                  onMouseLeave={(e: any)=>{e.currentTarget.style.borderColor="var(--border-glass)";e.currentTarget.style.color="var(--text-primary)";e.currentTarget.style.background="var(--bg-glass)";e.currentTarget.style.boxShadow="var(--shadow-glass)";}}>
                  {loading?<><Spin size={13}/>Generating...</>:<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Generate Another</>}
                </button>
              </div>
            </div>
          )}

          {/* Version tabs */}
          {versions.length>1&&(
            <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
              {versions.map((v: any,i: number)=>(
                <button key={v.timestamp} onClick={()=>setActiveVersion(i)}
                  style={{padding:"6px 16px",borderRadius:8,border:`1.5px solid ${activeVersion===i?"var(--success)":"var(--border-glass)"}`,cursor:"pointer",fontSize:13,fontWeight:activeVersion===i?700:500,background:activeVersion===i?"var(--bg-emerald-50)":"var(--bg-glass)",backdropFilter:activeVersion===i?"none":"blur(16px)",color:activeVersion===i?"var(--success-hover)":"var(--text-primary)",transition:"all .15s"}}>
                  Version {versions.length-i}
                  <span style={{fontSize:11,marginLeft:4,color:activeVersion===i?"var(--success)":"var(--text-placeholder)"}}>· {v.platform}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading&&versions.length===0&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:"var(--text-primary)",background:"var(--bg-glass)",backdropFilter:"blur(16px)",borderRadius:14,border:"1.5px dashed var(--border-glass)",boxShadow:"var(--shadow-glass)"}}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{margin:"0 auto 12px",display:"block",opacity:.6}}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <div style={{fontSize:15,fontWeight:500,marginBottom:4}}>Paste JD and choose platform</div>
          <div style={{fontSize:13}}>Select a platform above to generate</div>
        </div>
      )}

      {/* Standalone Text Formatter */}
      <div style={{marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--border-color)"}}>
        <div style={{marginBottom: 24}}>
          <h2 style={{fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px 0"}}>Social Media Text Formatter</h2>
          <p style={{fontSize: 14, color: "var(--text-secondary)", margin: 0}}>Format your text with bold, italics, and more to stand out on LinkedIn, Facebook, and other platforms. You can use this independently or edit generated posts.</p>
        </div>
        <LinkedInFormatter initialText={currentPost?.text || ""} />
      </div>

      {/* Edit Prompt Modal */}
      {editingPlat&&(
        <Modal title={`Edit Prompt: ${editingPlat.name}`} subtitle="Customize how AI writes posts for this platform" onClose={()=>setEditingPlat(null)}>
          <div style={{marginBottom:16}}>
            <label style={{fontSize:13,fontWeight:600,color:"var(--text-primary)",display:"block",marginBottom:8}}>Prompt Template</label>
            <textarea value={editPromptText} onChange={e=>setEditPromptText(e.target.value)} rows={10}
              style={{width:"100%",border:"1.5px solid var(--border-glass)",borderRadius:10,padding:"12px 14px",fontSize:13.5,color:"var(--text-primary)",lineHeight:1.7,resize:"vertical",outline:"none",background:"var(--bg-glass)"}}
              onFocus={(e: any)=>e.target.style.borderColor="var(--success)"} onBlur={(e: any)=>e.target.style.borderColor="var(--border-glass)"}/>
            <div style={{fontSize:12,color:"var(--text-placeholder)",marginTop:6}}>The JD and any additional instructions will be appended automatically.</div>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={handleSaveEdit}
              style={{padding:"10px 24px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:"linear-gradient(135deg,var(--success),var(--success-hover))",color:"var(--bg-card)",boxShadow:"0 4px 14px rgba(16,185,129,.3)"}}>
              Save Changes
            </button>
            <button onClick={()=>setEditingPlat(null)}
              style={{padding:"10px 24px",borderRadius:10,border:"1.5px solid var(--border-glass)",cursor:"pointer",fontWeight:600,fontSize:14,background:"var(--bg-glass)",color:"var(--text-primary)"}}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Add Platform Modal */}
      {showAddModal&&(
        <Modal title="Add Social Platform" subtitle="Create a custom platform with your own prompt" onClose={()=>setShowAddModal(false)}>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:13,fontWeight:600,color:"var(--text-primary)",display:"block",marginBottom:8}}>Platform Name</label>
            <input value={newPlatName} onChange={e=>setNewPlatName(e.target.value)} type="text"
              placeholder="e.g. Telegram Channel, Reddit Jobs, Discord..."
              style={{width:"100%",border:"1.5px solid var(--border-glass)",borderRadius:10,padding:"10px 14px",fontSize:14,outline:"none",background:"var(--bg-glass)",color:"var(--text-primary)"}}
              onFocus={(e: any)=>e.target.style.borderColor="var(--success)"} onBlur={(e: any)=>e.target.style.borderColor="var(--border-glass)"}/>
          </div>
          <div style={{marginBottom:20}}>
            <label style={{fontSize:13,fontWeight:600,color:"var(--text-primary)",display:"block",marginBottom:8}}>Prompt Template</label>
            <textarea value={newPlatPrompt} onChange={e=>setNewPlatPrompt(e.target.value)} rows={7}
              placeholder="Write a job post for [platform name]. Instructions: ..."
              style={{width:"100%",border:"1.5px solid var(--border-glass)",borderRadius:10,padding:"12px 14px",fontSize:13.5,color:"var(--text-primary)",lineHeight:1.7,resize:"none",outline:"none",background:"var(--bg-glass)"}}
              onFocus={(e: any)=>e.target.style.borderColor="var(--success)"} onBlur={(e: any)=>e.target.style.borderColor="var(--border-glass)"}/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={handleAddPlatform} disabled={!newPlatName.trim()||!newPlatPrompt.trim()}
              style={{padding:"10px 24px",borderRadius:10,border:"none",cursor:!newPlatName.trim()||!newPlatPrompt.trim()?"not-allowed":"pointer",fontWeight:700,fontSize:14,background:"linear-gradient(135deg,var(--success),var(--success-hover))",color:"var(--bg-card)",opacity:!newPlatName.trim()||!newPlatPrompt.trim()?.5:1}}>
              Add Platform
            </button>
            <button onClick={()=>setShowAddModal(false)}
              style={{padding:"10px 24px",borderRadius:10,border:"1.5px solid var(--border-glass)",cursor:"pointer",fontWeight:600,fontSize:14,background:"var(--bg-glass)",color:"var(--text-primary)"}}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
