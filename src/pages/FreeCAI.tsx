import React, { useState, useRef, useEffect } from 'react';
import { Btn } from '../components/ui';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';

// --- MOCK DATA TYPES ---
type Client = {
  id: string;
  name: string;
  website: string;
  tagline: string;
  summary: {
    industry: string;
    culture: string;
    overview: string;
    keyInfo: string[];
  };
  timeline: { id: string; date: string; content: string }[];
  jobs: Job[];
};

type Job = {
  id: string;
  title: string;
  updatedAt: string;
  report: JobReport;
};

type JobReport = {
  roleOverview: { title: string; dept: string; reportTo: string; salary: string; location: string; teamSize: string; };
  companyContext: string[];
  idealPersona: string[];
  mustHave: string[];
  niceToHave: string[];
  questionsForClient: string[];
  challenges: string[];
  targetCompanies: string[];
  booleanSearch: string;
  interviewQuestions: string[];
  socialPost: string;
};

const mockClients: Client[] = [
  {
    id: "c1",
    name: "Hanwa Vietnam",
    website: "https://www.hanwa.co.jp",
    tagline: "Japanese Trading Company",
    summary: {
      industry: "Trading",
      culture: "Process-driven, Long-term orientation",
      overview: "Japanese trading company. Strong process orientation. Long-term employment mindset. Stable business environment.",
      keyInfo: ["Japanese trading company.", "Strong process orientation.", "Long-term employment mindset.", "Stable business environment."]
    },
    timeline: [
      { id: "t1", date: "29 Jun", content: "Budget can be increased by 10%." },
    ],
    jobs: [
      {
        id: "j1",
        title: "Sales Manager",
        updatedAt: "29 Jun",
        report: {
          roleOverview: { title: "Sales Manager", dept: "B2B Sales", reportTo: "Japanese General Manager", salary: "Up to 60M VND", location: "District 1, HCMC", teamSize: "4 members" },
          companyContext: ["Japanese trading company.", "Long-term orientation.", "Detail-oriented manager.", "Process-driven environment."],
          idealPersona: ["8-10 years B2B sales experience.", "Manufacturing/trading background.", "Strong relationship management.", "Stable career history."],
          mustHave: ["Key account management", "Negotiation", "Team management", "English communication"],
          niceToHave: ["Japanese language", "Trading industry experience", "Existing Japanese client network"],
          questionsForClient: ["Why is this position open?", "What are the KPIs?", "Budget ownership?"],
          challenges: ["Narrow talent pool", "Cultural fit (strict Japanese style)", "Salary competitiveness"],
          targetCompanies: ["Mitsui & Co", "Marubeni", "Toyota Tsusho"],
          booleanSearch: `("Sales Manager" OR "Business Development Manager") AND (Trading OR Manufacturing) AND (B2B)`,
          interviewQuestions: ["Can you describe a time you had to adapt to a very process-driven environment?", "How do you build long-term relationships with key accounts?"],
          socialPost: "🚀 [HOT JOB] SALES MANAGER - JAPANESE TRADING MNC\n📍 Location: District 1, HCMC\n💰 Salary: Up to 60M VND\n\nAre you an experienced B2B Sales professional with a background in trading/manufacturing? We are looking for a Sales Manager to lead a team of 4 and report directly to the Japanese GM.\n\nDM me for more details!"
        }
      },
      {
        id: "j2",
        title: "Accountant",
        updatedAt: "20 Jun",
        report: { roleOverview: { title: "", dept: "", reportTo: "", salary: "", location: "", teamSize: "" }, companyContext: [], idealPersona: [], mustHave: [], niceToHave: [], questionsForClient: [], challenges: [], targetCompanies: [], booleanSearch: "", interviewQuestions: [], socialPost: "" }
      },
      {
        id: "j3",
        title: "Purchasing Supervisor",
        updatedAt: "15 Jun",
        report: { roleOverview: { title: "", dept: "", reportTo: "", salary: "", location: "", teamSize: "" }, companyContext: [], idealPersona: [], mustHave: [], niceToHave: [], questionsForClient: [], challenges: [], targetCompanies: [], booleanSearch: "", interviewQuestions: [], socialPost: "" }
      }
    ]
  },
  {
    id: "c2",
    name: "ABC Company",
    website: "https://abc.com",
    tagline: "Manufacturing",
    summary: { industry: "Manufacturing", culture: "Traditional", overview: "", keyInfo: [] },
    timeline: [],
    jobs: []
  },
  {
    id: "c3",
    name: "XYZ Company",
    website: "https://xyz.tech",
    tagline: "Technology",
    summary: { industry: "Technology", culture: "Agile", overview: "", keyInfo: [] },
    timeline: [],
    jobs: []
  }
];

const LOCAL_STORAGE_KEY = 'freec_ai_clients_v2';

export function FreeCAI({ toast }: { toast: (msg: string, type: 'success'|'error') => void }) {
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'clients'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loaded: Client[] = [];
      snapshot.forEach(doc => {
        loaded.push(doc.data() as Client);
      });
      setClients(loaded);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clients');
    });
    return unsubscribe;
  }, []);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientWebsite, setNewClientWebsite] = useState("");
  const [newClientTagline, setNewClientTagline] = useState("");
  
  const [universalInput, setUniversalInput] = useState("");
  const [isProcessingInput, setIsProcessingInput] = useState(false);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'assistant', content: string}[]>([{role: 'assistant', content: 'Hi! I am your AI Copilot. Ask me anything about your clients or jobs.'}]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState("");

  const handleUpdateClientName = async (clientId: string) => {
    if (!editingNameVal.trim()) {
      setEditingClientId(null);
      return;
    }
    try {
      await setDoc(doc(db, 'clients', clientId), { name: editingNameVal }, { merge: true });
      toast("Client name updated", "success");
    } catch (err) {
      console.error(err);
      toast("Failed to update client name", "error");
    }
    setEditingClientId(null);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const selectedJob = selectedClient?.jobs.find(j => j.id === selectedJobId);

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return;
    const newClient: Client = {
      id: "c" + Date.now(),
      name: newClientName,
      website: newClientWebsite,
      tagline: newClientTagline || "New Company",
      summary: { industry: "Analyzing...", culture: "Analyzing...", overview: "AI is researching company info...", keyInfo: [] },
      timeline: [],
      jobs: []
    };
    
    try {
      await setDoc(doc(db, 'clients', newClient.id), newClient);
      setSelectedClientId(newClient.id);
      setSelectedJobId(null);
      setIsCreatingClient(false);
      setNewClientName("");
      setNewClientWebsite("");
      setNewClientTagline("");
      toast("Client created and saved!", "success");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'clients');
      toast("Failed to create client", "error");
    }
  };

  const handleDeleteClient = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'clients', id));
      toast("Client deleted", "success");
      if (selectedClientId === id) {
        setSelectedClientId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'clients');
      toast("Failed to delete client", "error");
    }
  };

  const handleUniversalInputSubmit = async () => {
    if (!universalInput.trim() || !selectedClient) return;
    setIsProcessingInput(true);
    
    try {
      const response = await fetch('/api/freecai/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: universalInput,
          currentClientName: selectedClient.name,
          existingJobs: selectedClient.jobs
        })
      });

      if (!response.ok) {
        throw new Error("Failed to process input");
      }

      const data = await response.json();
      
      const newTimelineItem = {
        id: "t" + Date.now(),
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        content: data.timelineSummary || "Processed new input"
      };
      
      let newJob: Job | null = null;
      if (data.hasNewJob && data.jobData) {
        newJob = {
          id: "j" + Date.now(),
          title: data.jobData.title || "New Role (Auto-detected)",
          updatedAt: "Just now",
          report: {
            roleOverview: { 
              title: data.jobData.title || "New Role", 
              dept: data.jobData.roleOverview?.dept || "TBD", 
              reportTo: data.jobData.roleOverview?.reportingLine || "TBD", 
              salary: data.jobData.roleOverview?.salaryRange || "TBD", 
              location: data.jobData.roleOverview?.location || "TBD", 
              teamSize: "TBD" 
            },
            companyContext: data.jobData.companyContext || [],
            idealPersona: data.jobData.idealPersona || [],
            mustHave: data.jobData.mustHave || [],
            niceToHave: data.jobData.niceToHave || [],
            questionsForClient: data.jobData.questionsForClient || [],
            challenges: [],
            targetCompanies: [],
            booleanSearch: data.jobData.booleanSearch || "",
            interviewQuestions: data.jobData.interviewQuestions || [],
            socialPost: data.jobData.socialPost || ""
          }
        };
      }

      const updatedJobs = newJob ? [newJob, ...selectedClient.jobs] : selectedClient.jobs;
      const updatedTimeline = [newTimelineItem, ...selectedClient.timeline];
      
      const updatedSummary = { ...selectedClient.summary };
      if (data.clientUpdates) {
        if (data.clientUpdates.culture) updatedSummary.culture = data.clientUpdates.culture;
        if (data.clientUpdates.overview) updatedSummary.overview = data.clientUpdates.overview;
        if (data.clientUpdates.industry) updatedSummary.industry = data.clientUpdates.industry;
        if (data.clientUpdates.keyInfo) updatedSummary.keyInfo = [...updatedSummary.keyInfo, ...data.clientUpdates.keyInfo];
      }
      
      await setDoc(doc(db, 'clients', selectedClient.id), {
        ...selectedClient,
        jobs: updatedJobs,
        timeline: updatedTimeline,
        summary: updatedSummary
      }, { merge: true });
      
      if (newJob) toast(`New Job Detected: ${newJob.title}`, "success");
      else toast("Information saved to Knowledge Base", "success");
    } catch (err) {
      console.error(err);
      toast("Failed to process and update client", "error");
    } finally {
      setUniversalInput("");
      setIsProcessingInput(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatInput("");
    
    try {
      const response = await fetch('/api/freecai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          clientData: selectedClient
        })
      });

      if (!response.ok) {
        throw new Error("Failed to chat");
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
    } catch (err) {
      console.error(err);
      toast("Failed to process chat", "error");
    }
  };

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1400, margin: "0 auto", height: "100%", display: "flex", gap: 32 }}>
      
      {/* LEFT PANE: Client List */}
      <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 16, flexShrink: 0 }}>
        
        {/* Search */}
        <div style={{ position: "relative" }}>
          <svg style={{ position: "absolute", left: 14, top: 12, color: "var(--text-muted)" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input 
            placeholder="Search clients..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "10px 14px 10px 40px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", fontSize: 14, outline: "none", color: "var(--text-primary)", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }} 
          />
        </div>
        
        <Btn onClick={() => { setIsCreatingClient(true); setSelectedJobId(null); }} style={{ width: "100%", padding: "10px", background: "#4f46e5", color: "white", border: "none", fontWeight: 600, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Client
        </Btn>
        
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {filteredClients.map(client => {
            const isSelected = selectedClientId === client.id && !isCreatingClient;
            return (
              <div 
                key={client.id}
                onClick={() => { setSelectedClientId(client.id); setSelectedJobId(null); setIsCreatingClient(false); }}
                onMouseEnter={e => {
                  const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                  if (btn) btn.style.opacity = '1';
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                  if (btn) btn.style.opacity = '0';
                }}
                style={{ 
                  padding: "16px", 
                  borderRadius: 12, 
                  cursor: "pointer",
                  background: isSelected ? "var(--bg-sidebar)" : "transparent",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  transition: "all 0.2s",
                  position: "relative",
                  border: isSelected ? "none" : "1px solid transparent",
                }}
              >
                <div style={{ marginTop: 2, color: isSelected ? "#4f46e5" : "var(--text-muted)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18"></path><path d="M9 8h1"></path><path d="M9 12h1"></path><path d="M9 16h1"></path><path d="M14 8h1"></path><path d="M14 12h1"></path><path d="M14 16h1"></path><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: isSelected ? "#4f46e5" : "var(--text-primary)", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.tagline || client.summary.industry}</div>
                </div>
                
                {/* Delete button (visible on hover) */}
                <button 
                  className="delete-btn"
                  onClick={(e) => handleDeleteClient(e, client.id)}
                  style={{ position: 'absolute', right: 12, top: 16, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 4, opacity: 0, transition: 'opacity 0.2s' }}
                  title="Delete Client"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANE: Main Workspace */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        
        {isCreatingClient ? (
          <div style={{ padding: 40, maxWidth: 500, background: "var(--bg-glass)", backdropFilter: "blur(16px)", borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, color: "var(--text-primary)" }}>Create New Client</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Company Name *</label>
                <input style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", outline: "none" }} value={newClientName} onChange={e => setNewClientName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Tagline / Industry (optional)</label>
                <input style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", outline: "none" }} value={newClientTagline} onChange={e => setNewClientTagline(e.target.value)} placeholder="e.g. Japanese Trading Company" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6, color: "var(--text-secondary)" }}>Website (optional)</label>
                <input style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", outline: "none" }} value={newClientWebsite} onChange={e => setNewClientWebsite(e.target.value)} />
              </div>
              <Btn onClick={handleCreateClient} style={{ marginTop: 8, padding: "14px", background: "#4f46e5", color: "white", border: "none" }}>Create Client</Btn>
            </div>
          </div>
        ) : selectedClient ? (
          selectedJob ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000, height: "100%" }}>
              {/* Job Header */}
              <div style={{ display: "flex", gap: 16, alignItems: "center", paddingBottom: 24, borderBottom: "1px solid var(--border-color)" }}>
                <button onClick={() => setSelectedJobId(null)} style={{ width: 40, height: 40, borderRadius: 20, border: "1px solid var(--border-color)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-secondary)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>{selectedJob.title}</h1>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>Job Intelligence Report • {selectedClient.name}</div>
                </div>
                <Btn style={{ display: "flex", alignItems: "center", gap: 8, background: "white", color: "#111", border: "1px solid #e2e8f0" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copy Full Report
                </Btn>
              </div>

              {/* Job Content Scrollable */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, paddingRight: 8 }}>
                
                {/* 1. Role Overview */}
                <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>1. Role Overview</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
                    <div><div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Department</div><div style={{ fontSize: 15, fontWeight: 600 }}>{selectedJob.report.roleOverview.dept || "N/A"}</div></div>
                    <div><div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Reporting Line</div><div style={{ fontSize: 15, fontWeight: 600 }}>{selectedJob.report.roleOverview.reportTo || "N/A"}</div></div>
                    <div><div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Salary Range</div><div style={{ fontSize: 15, fontWeight: 600, color: "#16a34a" }}>{selectedJob.report.roleOverview.salary || "N/A"}</div></div>
                    <div><div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Location</div><div style={{ fontSize: 15, fontWeight: 600 }}>{selectedJob.report.roleOverview.location || "N/A"}</div></div>
                  </div>
                </div>

                {/* 2 & 3: Context and Persona */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>2. Company Context</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                      {selectedJob.report.companyContext.length > 0 ? selectedJob.report.companyContext.map((item, i) => <li key={i}>{item}</li>) : <li>Not available</li>}
                    </ul>
                  </div>
                  <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>3. Ideal Persona</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                      {selectedJob.report.idealPersona.length > 0 ? selectedJob.report.idealPersona.map((item, i) => <li key={i}>{item}</li>) : <li>Not available</li>}
                    </ul>
                  </div>
                </div>

                {/* 4 & 5: Must have / Nice to have */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>4. Must Have</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                      {selectedJob.report.mustHave.length > 0 ? selectedJob.report.mustHave.map((item, i) => <li key={i}>{item}</li>) : <li>Not available</li>}
                    </ul>
                  </div>
                  <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>5. Nice to Have</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                      {selectedJob.report.niceToHave.length > 0 ? selectedJob.report.niceToHave.map((item, i) => <li key={i}>{item}</li>) : <li>Not available</li>}
                    </ul>
                  </div>
                </div>

                {/* Boolean Search */}
                <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0", color: "var(--text-primary)" }}>9. Boolean Search</h3>
                  <div style={{ background: "var(--bg-body)", padding: 16, borderRadius: 8, fontFamily: "monospace", fontSize: 13, border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                    {selectedJob.report.booleanSearch || "Not generated yet."}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 900 }}>
            
            {/* Header */}
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  {editingClientId === selectedClient.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input 
                        value={editingNameVal} 
                        onChange={e => setEditingNameVal(e.target.value)}
                        style={{ fontSize: 24, fontWeight: 800, padding: "4px 8px", borderRadius: 6, border: "1.5px solid var(--border-glass)", background: "var(--bg-glass)", color: "var(--text-primary)", outline: "none", width: 300 }} 
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleUpdateClientName(selectedClient.id); if (e.key === 'Escape') setEditingClientId(null); }}
                      />
                      <button onClick={() => handleUpdateClientName(selectedClient.id)} style={{ padding: "8px 16px", background: "#4f46e5", color: "white", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600 }}>Save</button>
                      <button onClick={() => setEditingClientId(null)} style={{ padding: "8px 16px", background: "var(--bg-glass)", color: "var(--text-primary)", borderRadius: 6, border: "1.5px solid var(--border-glass)", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 12 }}>
                        {selectedClient.name}
                        <button onClick={() => { setEditingClientId(selectedClient.id); setEditingNameVal(selectedClient.name); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                      </h1>
                      <span style={{ padding: "4px 10px", background: "rgba(34, 197, 94, 0.15)", color: "#16a34a", fontSize: 12, fontWeight: 600, borderRadius: 12 }}>Active</span>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 10 }}>{selectedClient.tagline || selectedClient.summary.industry}</div>
                {selectedClient.website && (
                  <a href={selectedClient.website} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#4f46e5", textDecoration: "none", fontWeight: 500 }}>
                    {selectedClient.website}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                  </a>
                )}
              </div>
            </div>

            {/* Universal Input Area */}
            <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", borderRadius: 16, border: "1.5px solid var(--border-glass)", padding: 24, boxShadow: "var(--shadow-glass)" }}>
              
              <div style={{ position: "relative" }}>
                <textarea 
                  value={universalInput}
                  onChange={e => setUniversalInput(e.target.value)}
                  placeholder="Type or paste anything about this client here (JD, Meeting notes, Emails, Feedback)..."
                  style={{ 
                    width: "100%", height: 120, borderRadius: 8, border: "1px solid var(--border-glass)", 
                    padding: 16, fontSize: 14, background: "var(--bg-body)", color: "var(--text-primary)", 
                    resize: "none", outline: "none", marginBottom: 16, fontFamily: "inherit"
                  }}
                />
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Btn 
                  onClick={handleUniversalInputSubmit} 
                  disabled={isProcessingInput || !universalInput.trim()} 
                  style={{ padding: "10px 24px", background: "#4f46e5", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14 }}
                >
                  {isProcessingInput ? "Processing..." : "Save Information"}
                </Btn>
              </div>
            </div>

            {/* Jobs Section */}
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 16px 0", color: "var(--text-primary)" }}>Jobs</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: 12, border: "1.5px solid var(--border-glass)", background: "var(--bg-glass)", backdropFilter: "blur(16px)", overflow: "hidden", boxShadow: "var(--shadow-glass)" }}>
                {selectedClient.jobs.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                    No jobs yet. Paste a JD in the box above to generate one automatically.
                  </div>
                )}
                {selectedClient.jobs.map((job, index) => (
                  <div 
                    key={job.id} 
                    onClick={() => setSelectedJobId(job.id)}
                    style={{ 
                      padding: "20px 24px", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 16,
                      borderBottom: index < selectedClient.jobs.length - 1 ? "1px solid var(--border-color)" : "none",
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                    className="hover:bg-[var(--bg-hover)]"
                  >
                    <div style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "var(--bg-body)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{job.title}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Updated {job.updatedAt}</div>
                    </div>
                    <div style={{ color: "var(--text-muted)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
          )
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", flexDirection: "column", gap: 16 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <div>Select a client from the left or create a new one.</div>
          </div>
        )}

      </div>

      {/* FLOATING AI ASSISTANT BUTTON */}
      <div style={{ position: "fixed", bottom: 32, right: 32, zIndex: 100 }}>
        {isChatOpen && (
          <div style={{ position: "absolute", bottom: 64, right: 0, width: 380, height: 500, background: "var(--bg-glass)", backdropFilter: "blur(16px)", borderRadius: 16, boxShadow: "var(--shadow-glass)", border: "1.5px solid var(--border-glass)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)", padding: "16px 20px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", filter: 'drop-shadow(0.5px 0 0 white) drop-shadow(0 0.5px 0 white) drop-shadow(-0.5px 0 0 white) drop-shadow(0 -0.5px 0 white)' }}>
                  <img src="/freec-icon.png" alt="AI" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Ask AI Copilot</div>
              </div>
              <button onClick={() => setIsChatOpen(false)} style={{ background: "none", border: "none", color: "white", cursor: "pointer", opacity: 0.8, padding: 4 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16, background: "transparent" }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", flexDirection: msg.role === 'user' ? 'row-reverse' : 'row', gap: 8 }}>
                  <div style={{ background: msg.role === 'user' ? "#4f46e5" : "var(--bg-glass)", color: msg.role === 'user' ? "white" : "var(--text-primary)", padding: "10px 14px", borderRadius: 12, border: msg.role === 'user' ? "none" : "1px solid var(--border-glass)", maxWidth: "85%", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <div style={{ padding: 16, borderTop: "1.5px solid var(--border-glass)", background: "transparent", display: "flex", gap: 8 }}>
              <input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleChatSubmit(); }}
                placeholder="Ask about this client or job..."
                style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: "1px solid var(--border-color)", background: "var(--bg-body)", fontSize: 14, outline: "none", color: "var(--text-primary)" }}
              />
              <button onClick={handleChatSubmit} style={{ width: 40, height: 40, borderRadius: 20, background: "#4f46e5", color: "white", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>
        )}
        
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          style={{ padding: "12px 24px", borderRadius: 30, background: "#4f46e5", color: "white", border: "none", boxShadow: "0 8px 24px rgba(79, 70, 229, 0.4)", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "transform 0.2s", fontWeight: 600, fontSize: 15 }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          {isChatOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><path d="M12 7v6"></path><path d="M9 10h6"></path></svg>
              Ask AI
            </>
          )}
        </button>
      </div>

    </div>
  );
}
