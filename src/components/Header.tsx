import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Modal } from './ui';
import { testApiKey, AIProvider, getProvider } from '../lib/ai';
import { UsageDashboard } from './UsageDashboard';

export function Header({ onMenu }: any) {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const [showSettings, setShowSettings] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [geminiModel, setGeminiModel] = useState("gemini-3.5-flash");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiProxyUrl, setGeminiProxyUrl] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [grokKey, setGrokKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [cerebrasKey, setCerebrasKey] = useState("");
  const [qwenKey, setQwenKey] = useState("");
  const [githubKey, setGithubKey] = useState("");
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile");
  const [cerebrasModel, setCerebrasModel] = useState("qwen-3-235b-a22b-instruct-2507");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [qwenModel, setQwenModel] = useState("qwen-plus");
  const [githubModel, setGithubModel] = useState("openai/gpt-4o-mini");
  
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (showSettings) {
      const savedProvider = getProvider();
      setProvider(savedProvider);
      
      let savedGeminiModel = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
      const validGeminiModels = ["gemini-3.5-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"];
      if (!validGeminiModels.includes(savedGeminiModel)) {
        savedGeminiModel = "gemini-3.5-flash";
      }
      setGeminiModel(savedGeminiModel);
      
      const savedGeminiProxy = localStorage.getItem("gemini_proxy_url") || "";
      setGeminiProxyUrl(savedGeminiProxy);
      
      const savedGroqModel = localStorage.getItem("groq_model") || "llama-3.3-70b-versatile";
      setGroqModel(savedGroqModel);
      
      const savedCerebrasModel = localStorage.getItem("cerebras_model") || "qwen-3-235b-a22b-instruct-2507";
      setCerebrasModel(savedCerebrasModel);
      
      const savedOpenaiModel = localStorage.getItem("openai_model") || "gpt-4o-mini";
      setOpenaiModel(savedOpenaiModel);
      
      const savedQwenModel = localStorage.getItem("qwen_model") || "qwen-plus";
      setQwenModel(savedQwenModel);

      const savedGithubModel = localStorage.getItem("custom_github_model") || "openai/gpt-4o-mini";
      setGithubModel(savedGithubModel);
      
      const savedGemini = localStorage.getItem("custom_gemini_api_key") || "";
      const savedOpenai = localStorage.getItem("custom_openai_api_key") || "";
      const savedGrok = localStorage.getItem("custom_grok_api_key") || "";
      const savedGroq = localStorage.getItem("custom_groq_api_key") || "";
      const savedCerebras = localStorage.getItem("custom_cerebras_api_key") || "";
      const savedQwen = localStorage.getItem("custom_qwen_api_key") || "";
      const savedGithub = localStorage.getItem("custom_github_pat") || "";
      
      setGeminiKey(savedGemini);
      setOpenaiKey(savedOpenai);
      setGrokKey(savedGrok);
      setGroqKey(savedGroq);
      setCerebrasKey(savedCerebras);
      setQwenKey(savedQwen);
      setGithubKey(savedGithub);
      
      const currentKey = savedProvider === 'gemini' ? savedGemini : savedProvider === 'openai' ? savedOpenai : savedProvider === 'grok' ? savedGrok : savedProvider === 'groq' ? savedGroq : savedProvider === 'cerebras' ? savedCerebras : savedProvider === 'qwen' ? savedQwen : savedProvider === 'github' ? savedGithub : "";
      setTestStatus(currentKey ? 'success' : 'idle');
      setErrorMessage("");
    }
  }, [showSettings]);

  const currentKey = provider === 'gemini' ? geminiKey : provider === 'openai' ? openaiKey : provider === 'grok' ? grokKey : provider === 'groq' ? groqKey : provider === 'cerebras' ? cerebrasKey : provider === 'qwen' ? qwenKey : provider === 'github' ? githubKey : "";

  const handleTestKey = async () => {
    if (!currentKey.trim()) return;
    setIsTesting(true);
    setTestStatus('idle');
    setErrorMessage("");
    const result = await testApiKey(
      provider, 
      currentKey.trim(), 
      provider === 'gemini' ? geminiProxyUrl : undefined,
      provider === 'gemini' ? geminiModel : provider === 'openai' ? openaiModel : provider === 'groq' ? groqModel : provider === 'cerebras' ? cerebrasModel : provider === 'qwen' ? qwenModel : provider === 'github' ? githubModel : undefined
    );
    if (result.success) {
      setTestStatus('success');
      // Auto-save on success to prevent losing the key if user forgets to click Save
      localStorage.setItem("ai_provider", provider);
      localStorage.setItem("gemini_model", geminiModel);
      localStorage.setItem("groq_model", groqModel);
      localStorage.setItem("cerebras_model", cerebrasModel);
      localStorage.setItem("openai_model", openaiModel);
      localStorage.setItem("qwen_model", qwenModel);
      localStorage.setItem("custom_github_model", githubModel);
      localStorage.setItem("gemini_proxy_url", geminiProxyUrl.trim());
      
      if (provider === 'gemini') localStorage.setItem("custom_gemini_api_key", currentKey.trim());
      else if (provider === 'openai') localStorage.setItem("custom_openai_api_key", currentKey.trim());
      else if (provider === 'grok') localStorage.setItem("custom_grok_api_key", currentKey.trim());
      else if (provider === 'groq') localStorage.setItem("custom_groq_api_key", currentKey.trim());
      else if (provider === 'cerebras') localStorage.setItem("custom_cerebras_api_key", currentKey.trim());
      else if (provider === 'qwen') localStorage.setItem("custom_qwen_api_key", currentKey.trim());
      else if (provider === 'github') localStorage.setItem("custom_github_pat", currentKey.trim());
    } else {
      setTestStatus('error');
      let displayError = result.error || "Invalid API Key. Please check and try again.";
      try {
        const parsed = JSON.parse(displayError);
        if (parsed.error && parsed.error.message) {
          displayError = parsed.error.message;
        }
      } catch (e) {
        // Not JSON, use as is
      }
      
      if (displayError.includes("exceeded its spending cap") || displayError.includes("RESOURCE_EXHAUSTED") || displayError.includes("429")) {
        displayError = `Quota/Limit Error: ${displayError}`;
      }
      
      setErrorMessage(displayError);
    }
    setIsTesting(false);
  };

  const handleSaveKey = () => {
    if (currentKey.trim()) {
      if (testStatus !== 'success') {
        alert("Please test your API key successfully before saving.");
        return;
      }
    }
    
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("gemini_model", geminiModel);
    localStorage.setItem("groq_model", groqModel);
    localStorage.setItem("cerebras_model", cerebrasModel);
    localStorage.setItem("openai_model", openaiModel);
    localStorage.setItem("qwen_model", qwenModel);
    localStorage.setItem("custom_github_model", githubModel);
    
    if (geminiKey.trim()) {
      localStorage.setItem("custom_gemini_api_key", geminiKey.trim());
    } else {
      localStorage.removeItem("custom_gemini_api_key");
    }
    localStorage.setItem("gemini_proxy_url", geminiProxyUrl.trim());
    
    if (openaiKey.trim()) {
      localStorage.setItem("custom_openai_api_key", openaiKey.trim());
    } else {
      localStorage.removeItem("custom_openai_api_key");
    }
    
    if (grokKey.trim()) {
      localStorage.setItem("custom_grok_api_key", grokKey.trim());
    } else {
      localStorage.removeItem("custom_grok_api_key");
    }
    
    if (groqKey.trim()) {
      localStorage.setItem("custom_groq_api_key", groqKey.trim());
    } else {
      localStorage.removeItem("custom_groq_api_key");
    }
    
    if (cerebrasKey.trim()) {
      localStorage.setItem("custom_cerebras_api_key", cerebrasKey.trim());
    } else {
      localStorage.removeItem("custom_cerebras_api_key");
    }

    if (qwenKey.trim()) {
      localStorage.setItem("custom_qwen_api_key", qwenKey.trim());
    } else {
      localStorage.removeItem("custom_qwen_api_key");
    }

    if (githubKey.trim()) {
      localStorage.setItem("custom_github_pat", githubKey.trim());
    } else {
      localStorage.removeItem("custom_github_pat");
    }
    
    setShowSettings(false);
    window.location.reload(); // Reload to apply new AI client
  };

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, background: "var(--bg-header)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-color)", padding: "0 12px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      {/* LEFT SIDE */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: isLanding ? "none" : 1, minWidth: 0 }}>
        <button onClick={onMenu} style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: 8, color: "var(--text-muted)", display: "flex", marginRight: 4, flexShrink: 0 }}
          onMouseEnter={(e: any) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(e: any) => e.currentTarget.style.background = "none"}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
        {!isLanding && (
          <Link to="/" style={{ textDecoration: 'none', background: "none", border: "none", cursor: "pointer", padding: "6px 6px", borderRadius: 8, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 500, marginRight: 4, flexShrink: 0 }}
            onMouseEnter={(e: any) => e.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(e: any) => e.currentTarget.style.background = "none"}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg><span className="hidden sm:inline">Dashboard</span>
          </Link>
        )}
        {isLanding && (
          <div style={{ color: 'black', fontWeight: 'bold', fontSize: 24, display: 'flex', alignItems: 'center', flexShrink: 1, minWidth: 0 }}>
            <img src="/logo.png" alt="Tool4RC Logo" className="logo-img" style={{ height: 50, maxWidth: "100%", objectFit: 'contain' }} />
          </div>
        )}
      </div>

      {/* CENTER (LOGO) */}
      {!isLanding && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
          <img src="/logo.png" alt="Tool4RC Logo" className="logo-img" style={{ height: 50, objectFit: 'contain' }} />
        </div>
      )}

      {/* RIGHT SIDE */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flex: isLanding ? "none" : 1, minWidth: 0 }}>
        {!isLanding && (
          <button onClick={() => setShowUsage(true)} style={{ background: "none", border: "1px solid var(--border-color)", cursor: "pointer", padding: "8px 12px", borderRadius: 8, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}
            onMouseEnter={(e: any) => e.currentTarget.style.background = "var(--bg-main)"} onMouseLeave={(e: any) => e.currentTarget.style.background = "none"}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            Usage
          </button>
        )}
        {isLanding && (
          <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "1px solid var(--border-color)", cursor: "pointer", padding: "8px 12px", borderRadius: 8, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}
            onMouseEnter={(e: any) => e.currentTarget.style.background = "var(--bg-main)"} onMouseLeave={(e: any) => e.currentTarget.style.background = "none"}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
            API Key
          </button>
        )}
      </div>

      {showSettings && (
        <Modal title="API Key Settings" subtitle="Configure your personal preferences" onClose={() => setShowSettings(false)} width={700}>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>AI Provider</label>
            <select 
              value={provider} 
              onChange={(e) => {
                setProvider(e.target.value as AIProvider);
                setTestStatus('idle');
              }}
              style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 16, background: "var(--bg-card)" }}
            >
              <option value="gemini">Google Gemini (Recommended)</option>
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="grok">xAI (Grok)</option>
              <option value="groq">Groq (Ultra-Fast Llama 3)</option>
              <option value="cerebras">Cerebras (Ultra-Fast AI)</option>
              <option value="qwen">Qwen (Alibaba DashScope)</option>
              <option value="github">GitHub Models (Free)</option>
            </select>

            <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
              {provider === 'gemini' ? 'Personal Gemini API Key' : provider === 'openai' ? 'Personal OpenAI API Key' : provider === 'grok' ? 'Personal Grok API Key' : provider === 'groq' ? 'Personal Groq API Key' : provider === 'cerebras' ? 'Personal Cerebras API Key' : provider === 'qwen' ? 'Personal Qwen API Key' : 'Personal GitHub Token'}
            </label>
            <div style={{ display: "flex", gap: 8, marginBottom: provider === 'gemini' ? 16 : 8 }}>
              <input 
                type="password" 
                value={currentKey} 
                onChange={e => {
                  if (provider === 'gemini') setGeminiKey(e.target.value);
                  else if (provider === 'openai') setOpenaiKey(e.target.value);
                  else if (provider === 'grok') setGrokKey(e.target.value);
                  else if (provider === 'groq') setGroqKey(e.target.value);
                  else if (provider === 'cerebras') setCerebrasKey(e.target.value);
                  else if (provider === 'qwen') setQwenKey(e.target.value);
                  else if (provider === 'github') setGithubKey(e.target.value);
                  setTestStatus('idle');
                }} 
                placeholder={provider === 'github' ? "Paste your GitHub Personal Access Token here (cần quyền models:read)..." : `Paste your ${provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : provider === 'grok' ? 'Grok' : provider === 'groq' ? 'Groq' : provider === 'cerebras' ? 'Cerebras' : 'Qwen'} API Key here...`}
                style={{ flex: 1, border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", transition: "border-color 0.2s" }}
                onFocus={(e: any) => e.target.style.borderColor = "var(--border-focus)"} 
                onBlur={(e: any) => e.target.style.borderColor = "var(--border-color)"}
              />
              <button 
                onClick={handleTestKey}
                disabled={isTesting || !currentKey.trim()}
                style={{ 
                  padding: "0 16px", 
                  borderRadius: 8, 
                  border: "none", 
                  cursor: (isTesting || !currentKey.trim()) ? "not-allowed" : "pointer", 
                  fontWeight: 600, 
                  fontSize: 14, 
                  background: (isTesting || !currentKey.trim()) ? "var(--border-color)" : "var(--border-focus)", 
                  color: (isTesting || !currentKey.trim()) ? "var(--text-placeholder)" : "var(--bg-card)",
                  transition: "background 0.2s",
                  whiteSpace: "nowrap"
                }}
              >
                {isTesting ? "Testing..." : "Test Key"}
              </button>
            </div>

            {provider === 'github' && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 12 }}>
                Lấy token tại: <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none" }}>github.com/settings/tokens</a> (Fine-grained token, chọn quyền Models: Read-only). Model có sẵn xem tại <a href="https://github.com/marketplace/models" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none" }}>github.com/marketplace/models</a>
              </div>
            )}

            {provider === 'gemini' && (
              <>
                <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Gemini Model</label>
                <select 
                  value={geminiModel} 
                  onChange={(e) => {
                    setGeminiModel(e.target.value);
                    setTestStatus('idle');
                  }}
                  style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 8, background: "var(--bg-card)" }}
                >
                  <optgroup label="Pro">
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </optgroup>
                  <optgroup label="Flash">
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (Mặc định)</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  </optgroup>
                  <optgroup label="Flash-Lite">
                    <option value="gemini-2.0-flash-lite-preview-02-05">Gemini 2.0 Flash-Lite</option>
                  </optgroup>
                </select>
                
                <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Gemini Proxy URL (Optional)</label>
                <input 
                  type="text" 
                  value={geminiProxyUrl} 
                  onChange={(e) => {
                    setGeminiProxyUrl(e.target.value);
                    setTestStatus('idle');
                  }}
                  placeholder="e.g., https://gemini-proxy.thanhnhan7560.workers.dev"
                  style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 16, background: "var(--bg-card)" }}
                />
              </>
            )}

            {provider === 'openai' && (
              <>
                <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>OpenAI Model</label>
                <select 
                  value={openaiModel} 
                  onChange={(e) => {
                    setOpenaiModel(e.target.value);
                    setTestStatus('idle');
                  }}
                  style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 8, background: "var(--bg-card)" }}
                >
                  <option value="gpt-4o-mini">GPT-4o-mini (Fastest, Cheapest)</option>
                  <option value="gpt-4o">GPT-4o (Smartest, Multimodal)</option>
                  <option value="o3-mini">o3-mini (Advanced Reasoning)</option>
                  <option value="o1-preview">o1-preview (Complex Problem Solving)</option>
                </select>
              </>
            )}

            {provider === 'groq' && (
              <>
                <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Groq Model</label>
                <select 
                  value={groqModel} 
                  onChange={(e) => {
                    setGroqModel(e.target.value);
                    setTestStatus('idle');
                  }}
                  style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 8, background: "var(--bg-card)" }}
                >
                  <optgroup label="Top Reasoning & Logic">
                    <option value="openai/gpt-oss-120b">GPT OSS 120B (Deepest Analysis)</option>
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Best Writing/Versatile)</option>
                    <option value="qwen/qwen3-32b">Qwen 3 32B (Strong Logic)</option>
                  </optgroup>
                  <optgroup label="Fast & Efficient">
                    <option value="openai/gpt-oss-20b">GPT OSS 20B</option>
                    <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                  </optgroup>
                  <optgroup label="Long Context & Others">
                    <option value="moonshotai/kimi-k2-instruct">Kimi K2 Instruct</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                    <option value="gemma2-9b-it">Gemma 2 9B</option>
                  </optgroup>
                </select>
              </>
            )}

            {provider === 'cerebras' && (
              <>
                <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Cerebras Model</label>
                <select 
                  value={cerebrasModel} 
                  onChange={(e) => {
                    setCerebrasModel(e.target.value);
                    setTestStatus('idle');
                  }}
                  style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 8, background: "var(--bg-card)" }}
                >
                  <option value="qwen-3-235b-a22b-instruct-2507">Qwen 3 235B (qwen-3-235b-a22b-instruct-2507)</option>
                  <option value="llama3.1-8b">Llama 3.1 8B</option>
                </select>
              </>
            )}

            {provider === 'qwen' && (
              <>
                <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Qwen Model (Alibaba DashScope)</label>
                <select 
                  value={qwenModel} 
                  onChange={(e) => {
                    setQwenModel(e.target.value);
                    setTestStatus('idle');
                  }}
                  style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 8, background: "var(--bg-card)" }}
                >
                  <option value="qwen-plus">qwen-plus (Balanced)</option>
                  <option value="qwen-max">qwen-max (Most Capable)</option>
                  <option value="qwen-turbo">qwen-turbo (Fast)</option>
                </select>
              </>
            )}

            {provider === 'github' && (
              <>
                <label style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>GitHub Model</label>
                <select 
                  value={githubModel} 
                  onChange={(e) => {
                    setGithubModel(e.target.value);
                    setTestStatus('idle');
                  }}
                  style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 8, background: "var(--bg-card)" }}
                >
                  <option value="openai/gpt-4o-mini">GPT-4o-mini (Fast, Free tier)</option>
                  <option value="microsoft/Phi-4">Phi-4 (Reasoning, Free tier)</option>
                  <option value="microsoft/Phi-4-mini-instruct">Phi-4-mini (Lightweight)</option>
                  <option value="deepseek/DeepSeek-R1">DeepSeek-R1 (Deep Reasoning)</option>
                </select>
              </>
            )}

            {testStatus === 'success' && (
              <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 500, marginBottom: 12, display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                Key is valid! You can now save your settings.
              </div>
            )}
            {testStatus === 'error' && (
              <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 500, marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                <span style={{ wordBreak: "break-word" }}>{errorMessage || "Invalid API Key. Please check and try again."}</span>
              </div>
            )}

            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, background: "var(--bg-main)", padding: 12, borderRadius: 8, border: "1px solid var(--border-color)" }}>
              {provider === 'gemini' ? (
                <div style={{ marginBottom: 8 }}>
                  <strong>Don't have a Key?</strong> Click <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none", fontWeight: 500 }}>here</a> to get a free Key in 30 seconds.
                </div>
              ) : provider === 'openai' ? (
                <div style={{ marginBottom: 8 }}>
                  <strong>Don't have an OpenAI Key?</strong> Get it from your <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none", fontWeight: 500 }}>OpenAI Dashboard</a>.
                </div>
              ) : provider === 'grok' ? (
                <div style={{ marginBottom: 8 }}>
                  <strong>Don't have a Grok Key?</strong> Get it from the <a href="https://console.x.ai/" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none", fontWeight: 500 }}>xAI Console</a>.
                </div>
              ) : provider === 'groq' ? (
                <div style={{ marginBottom: 8 }}>
                  <strong>Don't have a Groq Key?</strong> Get it from the <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none", fontWeight: 500 }}>Groq Console</a>.
                </div>
              ) : provider === 'cerebras' ? (
                <div style={{ marginBottom: 8 }}>
                  <strong>Don't have a Cerebras Key?</strong> Get it from the <a href="https://cloud.cerebras.ai/" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none", fontWeight: 500 }}>Cerebras Cloud</a>.
                </div>
              ) : provider === 'github' ? (
                <div style={{ marginBottom: 8 }}>
                  <strong>Cần GitHub Token?</strong> Lấy fine-grained token có quyền Models: Read-only tại <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none", fontWeight: 500 }}>GitHub Settings</a>.
                </div>
              ) : (
                <div style={{ marginBottom: 8 }}>
                  <strong>Don't have a Qwen Key?</strong> Get it from <a href="https://bailian.console.alibabacloud.com" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none", fontWeight: 500 }}>Alibaba Cloud DashScope</a>.
                </div>
              )}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span>Your key is stored locally on this browser, we do not store it on our servers.</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button 
              onClick={handleSaveKey}
              disabled={currentKey.trim() !== "" && testStatus !== 'success'}
              style={{ 
                padding: "10px 24px", 
                borderRadius: 8, 
                border: "none", 
                cursor: (currentKey.trim() !== "" && testStatus !== 'success') ? "not-allowed" : "pointer", 
                fontWeight: 600, 
                fontSize: 14, 
                background: (currentKey.trim() !== "" && testStatus !== 'success') ? "var(--border-color)" : "var(--success)", 
                color: (currentKey.trim() !== "" && testStatus !== 'success') ? "var(--text-placeholder)" : "var(--bg-card)",
                transition: "background 0.2s"
              }}>
              Save Settings
            </button>
            <button onClick={() => setShowSettings(false)}
              style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-color)", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "var(--bg-card)", color: "var(--text-secondary)" }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showUsage && <UsageDashboard onClose={() => setShowUsage(false)} />}
    </header>
  );
}
