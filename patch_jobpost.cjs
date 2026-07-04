const fs = require('fs');

let code = fs.readFileSync('src/pages/JobPostGenerator.tsx', 'utf8');

// 1. Add Firebase imports
if (!code.includes("from '../lib/firebase'")) {
    code = code.replace(
        "import { LinkedInFormatter } from '../components/LinkedInFormatter';",
        "import { LinkedInFormatter } from '../components/LinkedInFormatter';\nimport { db } from '../lib/firebase';\nimport { collection, addDoc, getDocs, query, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';"
    );
}

// 2. Add React hooks for Memory
if (!code.includes("const [memories, setMemories] = useState<any[]>([])")) {
    code = code.replace(
        "const [imagePromptLoading, setImagePromptLoading] = useState(false);",
        `const [imagePromptLoading, setImagePromptLoading] = useState(false);
  
  const [memories, setMemories] = React.useState<any[]>([]);
  const [searchMem, setSearchMem] = React.useState("");
  const [memLoading, setMemLoading] = React.useState(false);

  React.useEffect(() => {
    const loadMemories = async () => {
      setMemLoading(true);
      try {
        const q = query(collection(db, "jobPosts"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setMemories(snap.docs.map(d => ({id: d.id, ...d.data()})));
      } catch(e) {
        console.error(e);
      } finally {
        setMemLoading(false);
      }
    };
    loadMemories();
  }, []);`
    );
}

// 3. Modify handleGenerate
const handleGenMatch = code.match(/const handleGenerate = async \(platId: string\) => \{([\s\S]*?)const newVersion = \{ text: result\.trim\(\), platform: plat\.name, platId, timestamp: Date\.now\(\) \};/);
if (handleGenMatch) {
    const oldCode = handleGenMatch[0];
    const newCode = `const handleGenerate = async (platId: string) => {
    if (!jd.trim()) return;
    const plat = platforms.find((p: any) => p.id === platId);
    if (!plat) return;
    setActivePlatId(platId);
    setLoading(true);
    try {
      let memoryContext = "";
      try {
        const isListJobRequest = await gemini("You are an intent analyzer. Analyze the text and reply 'YES' if the user is asking to create a list of jobs, job roundup, tổng hợp job, danh sách việc làm, or similar. Otherwise, reply 'NO'.", \`Input: \${jd}\\n\\nInstruction: \${instruction}\\n\\nReply ONLY YES or NO.\`, 10);
        if (isListJobRequest.trim().toUpperCase().includes("YES")) {
           const q = query(collection(db, "jobPosts"), orderBy("createdAt", "desc"));
           const querySnapshot = await getDocs(q);
           const memoryJobs = querySnapshot.docs.map(d => d.data().jd || d.data().text).filter(t => !!t).slice(0, 5);
           if (memoryJobs.length > 0) {
              memoryContext = \`\\n\\n[SYSTEM HIDDEN INFO] The user wants a roundup/list job. Here are some of the recent jobs from their memory database to include:\\n\` + memoryJobs.map((j, i) => \`Job \${i+1}:\\n\${j}\`).join('\\n\\n') + \`\\n\\nPlease create a compelling list job post including these.\\n\`;
           }
        }
      } catch (e) {
        console.log("Intent check failed, skipping memory context.");
      }

      const result = await gemini(
          \`\${contentPrompt}\`,
          \`Platform: \${plat.name}\\n\${plat.prompt}\\n\\nInput Information:\\n\${jd}\\n\${instruction.trim() ? \`\\nAdditional instruction: \${instruction.trim()}\` : ""}\${memoryContext}\\n\\nOutput ONLY the post content.\`,
          1500
      );
      
      let docId = "";
      try {
        const docRef = await addDoc(collection(db, "jobPosts"), {
          jd: jd,
          instruction: instruction,
          text: result.trim(),
          platform: plat.name,
          createdAt: serverTimestamp()
        });
        docId = docRef.id;
        
        // Update local memory list
        setMemories(prev => [{
            id: docId, 
            jd, 
            instruction, 
            text: result.trim(), 
            platform: plat.name, 
            createdAt: new Date()
        }, ...prev]);
      } catch(e) {
         console.error("Failed to save to memory", e);
      }
      
      const newVersion = { id: docId, text: result.trim(), platform: plat.name, platId, timestamp: Date.now() };`;
      
    code = code.replace(oldCode, newCode);
}

// 4. Modify handleGenerateImagePrompt
const imgPromptMatch = code.match(/setVersions\(prev => \{/);
if (code.includes('handleGenerateImagePrompt = async') && imgPromptMatch) {
    code = code.replace(
      `setVersions(prev => {`,
      `if (currentPost.id) {
        try {
          await updateDoc(doc(db, "jobPosts", currentPost.id), { imagePrompt: result.trim() });
          setMemories(prev => prev.map(m => m.id === currentPost.id ? {...m, imagePrompt: result.trim()} : m));
        } catch(e) {}
      }
      setVersions(prev => {`
    );
}

// 5. Add UI for Memory
const memoryUI = `
      {/* Job Post Memory Section */}
      <div style={{marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--border-color)"}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16}}>
          <div>
            <h2 style={{fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px 0"}}>Job Post Memory</h2>
            <p style={{fontSize: 14, color: "var(--text-secondary)", margin: 0}}>Find and reuse your previously generated job posts and image prompts.</p>
          </div>
          <div style={{position: "relative", width: 280}}>
            <svg style={{position: "absolute", left: 14, top: 11, color: "var(--text-muted)"}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" value={searchMem} onChange={e=>setSearchMem(e.target.value)} placeholder="Search jobs by title or content..." 
              style={{width: "100%", padding: "10px 14px 10px 40px", borderRadius: 10, border: "1.5px solid var(--border-glass)", background: "var(--bg-glass)", color: "var(--text-primary)", fontSize: 13, outline: "none"}}
              onFocus={(e: any)=>e.target.style.borderColor="var(--success)"} onBlur={(e: any)=>e.target.style.borderColor="var(--border-glass)"}
            />
          </div>
        </div>
        
        {memLoading ? (
           <div style={{textAlign: "center", padding: 40}}><Spin size={24} color="var(--success)"/></div>
        ) : memories.length === 0 ? (
           <div style={{textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 14, background: "var(--bg-glass)", borderRadius: 14, border: "1.5px dashed var(--border-glass)"}}>
             No generated job posts found yet. Create one above!
           </div>
        ) : (
           <div style={{display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16}}>
             {memories.filter(m => (m.jd||"").toLowerCase().includes(searchMem.toLowerCase()) || (m.text||"").toLowerCase().includes(searchMem.toLowerCase())).slice(0, 10).map((m: any) => (
                <div key={m.id} style={{background: "var(--bg-card)", border: "1.5px solid var(--border-color)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", boxShadow: "var(--shadow-sm)"}}>
                   <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12}}>
                     <div style={{fontSize: 12, fontWeight: 700, color: "var(--primary)", background: "var(--bg-glass-hover)", padding: "4px 8px", borderRadius: 6}}>{m.platform}</div>
                     <div style={{fontSize: 11, color: "var(--text-muted)"}}>
                        {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString() : new Date(m.createdAt).toLocaleDateString()}
                     </div>
                   </div>
                   <div style={{fontSize: 13, color: "var(--text-primary)", marginBottom: 16, flex: 1, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.6}}>
                     {m.text}
                   </div>
                   {m.imagePrompt && (
                     <div style={{fontSize: 11, color: "var(--text-secondary)", marginBottom: 16, padding: "8px", background: "var(--bg-glass)", borderRadius: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden"}}>
                       <span style={{fontWeight: 700}}>Image Prompt:</span> {m.imagePrompt}
                     </div>
                   )}
                   <div style={{display: "flex", gap: 8, marginTop: "auto"}}>
                     <button onClick={() => {
                        setJd(m.jd || m.text || "");
                        setInstruction(m.instruction || "");
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                     }} style={{flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6}}>
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 2v6h6"/><path d="M21 12A9 9 0 0 0 6 5.3L3 8"/><path d="M21 22v-6h-6"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/></svg>
                       Restore
                     </button>
                     <button onClick={async () => {
                        await navigator.clipboard.writeText(m.text || "");
                     }} style={{flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "var(--bg-glass-hover)", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6}}>
                       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                       Copy Post
                     </button>
                   </div>
                </div>
             ))}
           </div>
        )}
      </div>
`;
const standaloneTarget = `{/* Standalone Text Formatter */}`;
if (code.includes(standaloneTarget) && !code.includes("Job Post Memory Section")) {
    code = code.replace(standaloneTarget, memoryUI + "\n      " + standaloneTarget);
}

fs.writeFileSync('src/pages/JobPostGenerator.tsx', code);
