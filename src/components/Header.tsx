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
  const [githubModel, setGithubModel] = useState("openai/gpt-4o");
  
  const [exaKey, setExaKey] = useState("");
  const [isExaTesting, setIsExaTesting] = useState(false);
  const [exaTestStatus, setExaTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exaErrorMessage, setExaErrorMessage] = useState("");

  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState("");

  const [isGeminiTesting, setIsGeminiTesting] = useState(false);
  const [geminiTestStatus, setGeminiTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [geminiErrorMessage, setGeminiErrorMessage] = useState("");

  useEffect(() => {
    if (showSettings) {
      const savedProvider = getProvider();
      setProvider(savedProvider);
      
      let savedGeminiModel = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
      const validGeminiModels = [
        "gemini-3.5-flash",
        "gemini-3.1-pro-preview",
        "gemini-3.1-flash-lite",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-2.0-flash-lite-preview-02-05"
      ];
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

      const savedGithubModel = localStorage.getItem("custom_github_model") || "openai/gpt-4o";
      setGithubModel(savedGithubModel);
      
      const savedGemini = localStorage.getItem("custom_gemini_api_key") || "";
      const savedOpenai = localStorage.getItem("custom_openai_api_key") || "";
      const savedGrok = localStorage.getItem("custom_grok_api_key") || "";
      const savedGroq = localStorage.getItem("custom_groq_api_key") || "";
      const savedCerebras = localStorage.getItem("custom_cerebras_api_key") || "";
      const savedQwen = localStorage.getItem("custom_qwen_api_key") || "";
      const savedGithub = localStorage.getItem("custom_github_pat") || "";
      const savedExa = localStorage.getItem("custom_exa_api_key") || "";
      
      setGeminiKey(savedGemini);
      setOpenaiKey(savedOpenai);
      setGrokKey(savedGrok);
      setGroqKey(savedGroq);
      setCerebrasKey(savedCerebras);
      setQwenKey(savedQwen);
      setGithubKey(savedGithub);
      setExaKey(savedExa);
      
      const currentKey = savedProvider === 'gemini' ? savedGemini : savedProvider === 'openai' ? savedOpenai : savedProvider === 'grok' ? savedGrok : savedProvider === 'groq' ? savedGroq : savedProvider === 'cerebras' ? savedCerebras : savedProvider === 'qwen' ? savedQwen : savedProvider === 'github' ? savedGithub : "";
      setTestStatus(currentKey ? 'success' : 'idle');
      setErrorMessage("");
      setGeminiTestStatus(savedGemini ? 'success' : 'idle');
      setGeminiErrorMessage("");
      setExaTestStatus(savedExa ? 'success' : 'idle');
      setExaErrorMessage("");
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

  const handleTestGeminiKey = async () => {
    if (!geminiKey.trim()) return;
    setIsGeminiTesting(true);
    setGeminiTestStatus('idle');
    setGeminiErrorMessage("");
    const result = await testApiKey(
      'gemini', 
      geminiKey.trim(), 
      geminiProxyUrl || undefined,
      geminiModel
    );
    if (result.success) {
      setGeminiTestStatus('success');
    } else {
      setGeminiTestStatus('error');
      let displayError = result.error || "Invalid Gemini API Key. Please check and try again.";
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
      
      setGeminiErrorMessage(displayError);
    }
    setIsGeminiTesting(false);
  };

  const handleTestExaKey = async () => {
    if (!exaKey.trim()) return;
    setIsExaTesting(true);
    setExaTestStatus('idle');
    setExaErrorMessage("");
    try {
      const res = await fetch("/api/exa/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: exaKey.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setExaTestStatus('success');
        localStorage.setItem("custom_exa_api_key", exaKey.trim());
      } else {
        setExaTestStatus('error');
        setExaErrorMessage(data.error || "API Key Exa không hợp lệ. Vui lòng kiểm tra lại.");
      }
    } catch (err: any) {
      setExaTestStatus('error');
      setExaErrorMessage(err.message || String(err));
    } finally {
      setIsExaTesting(false);
    }
  };

  const handleSaveKey = () => {
    if (geminiKey.trim() && geminiTestStatus !== 'success') {
      const confirmSave = window.confirm("API Key Gemini chưa được Test thành công. Bạn có chắc chắn muốn Lưu?");
      if (!confirmSave) return;
    }
    if (provider !== 'gemini' && currentKey.trim() && testStatus !== 'success') {
      const confirmSave = window.confirm(`API Key cho ${provider.toUpperCase()} chưa được Test thành công. Bạn có chắc chắn muốn Lưu?`);
      if (!confirmSave) return;
    }
    if (exaKey.trim() && exaTestStatus !== 'success') {
      const confirmSave = window.confirm("API Key Exa chưa được Test thành công. Bạn có chắc chắn muốn Lưu?");
      if (!confirmSave) return;
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

    if (exaKey.trim()) {
      localStorage.setItem("custom_exa_api_key", exaKey.trim());
    } else {
      localStorage.removeItem("custom_exa_api_key");
    }
    
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
          <button 
            onClick={() => setShowSettings(true)} 
            className="liquid-glass-api-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: 'transform 0.3s ease' }}><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
            <span>API Key</span>
          </button>
        )}
      </div>

      {showSettings && (
        <Modal title="Cài đặt API Key & AI Engine" subtitle="Cấu hình các API Key và nhà cung cấp dịch vụ AI của bạn" onClose={() => setShowSettings(false)} width={700}>
          <div style={{ marginBottom: 24 }}>
            
            {/* PHẦN 1: GOOGLE GEMINI (BẮT BUỘC) */}
            <div style={{ background: "var(--bg-main)", padding: 16, borderRadius: 12, border: "1.5px solid var(--border-color)", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ background: "var(--border-focus)", color: "var(--bg-card)", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold" }}>1</span>
                <label style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: 0 }}>API Key Google Gemini (Free Tier / Bắt buộc)</label>
              </div>
              
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 12, margin: "0 0 12px 0" }}>
                API này được dùng cho các tính năng <strong>phân tích tuyển dụng AI</strong>, tạo hình ảnh ứng viên và trích xuất dữ liệu địa điểm <strong>Google Maps</strong> cho email mẫu. (Các tác vụ tìm kiếm thông tin thời gian thực được xử lý qua Exa AI Search ở mục 3).
              </p>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input 
                  type="password" 
                  value={geminiKey} 
                  onChange={e => {
                    setGeminiKey(e.target.value);
                    setGeminiTestStatus('idle');
                  }} 
                  placeholder="Dán API Key Gemini của bạn tại đây..."
                  style={{ flex: 1, border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", transition: "border-color 0.2s", background: "var(--bg-card)" }}
                  onFocus={(e: any) => e.target.style.borderColor = "var(--border-focus)"} 
                  onBlur={(e: any) => e.target.style.borderColor = "var(--border-color)"}
                />
                <button 
                  onClick={handleTestGeminiKey}
                  disabled={isGeminiTesting || !geminiKey.trim()}
                  style={{ 
                    padding: "0 16px", 
                    borderRadius: 8, 
                    border: "none", 
                    cursor: (isGeminiTesting || !geminiKey.trim()) ? "not-allowed" : "pointer", 
                    fontWeight: 600, 
                    fontSize: 14, 
                    background: (isGeminiTesting || !geminiKey.trim()) ? "var(--border-color)" : "var(--border-focus)", 
                    color: (isGeminiTesting || !geminiKey.trim()) ? "var(--text-placeholder)" : "var(--bg-card)",
                    transition: "background 0.2s",
                    whiteSpace: "nowrap"
                  }}
                >
                  {isGeminiTesting ? "Đang thử..." : "Test Gemini Key"}
                </button>
              </div>

              {geminiTestStatus === 'success' && (
                <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 500, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  Gemini API Key hợp lệ!
                </div>
              )}
              {geminiTestStatus === 'error' && (
                <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 500, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                  <span style={{ wordBreak: "break-word" }}>{geminiErrorMessage || "Lỗi API Key. Vui lòng kiểm tra lại."}</span>
                </div>
              )}

              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                💡 <strong>Chưa có Key?</strong> Lấy khóa Gemini Free Tier trong 30 giây tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: "var(--border-focus)", textDecoration: "none", fontWeight: 600 }}>Google AI Studio</a>.
              </div>
            </div>

            {/* PHẦN 2: AI ENGINE CHÍNH */}
            <div style={{ background: "var(--bg-main)", padding: 16, borderRadius: 12, border: "1.5px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ background: "var(--border-focus)", color: "var(--bg-card)", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold" }}>2</span>
                <label style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: 0 }}>Cấu hình AI Engine chính (Tùy chọn khác)</label>
              </div>

              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 12, margin: "0 0 12px 0" }}>
                Engine chính được dùng để xử lý CV, phân tích thông tin tuyển dụng, sinh câu hỏi phỏng vấn và các tính năng chat hỗ trợ.
              </p>

              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Nhà cung cấp AI (AI Provider)</label>
              <select 
                value={provider} 
                onChange={(e) => {
                  setProvider(e.target.value as AIProvider);
                  setTestStatus('idle');
                }}
                style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 16, background: "var(--bg-card)", color: "var(--text-secondary)" }}
              >
                <option value="gemini">Google Gemini (Khuyên dùng - Sử dụng chung với Key ở trên)</option>
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="grok">xAI (Grok)</option>
                <option value="groq">Groq (Siêu tốc Llama 3)</option>
                <option value="cerebras">Cerebras (Siêu tốc Qwen 3)</option>
                <option value="qwen">Qwen (Alibaba DashScope)</option>
                <option value="github">GitHub Models (Free)</option>
              </select>

              {provider === 'gemini' ? (
                <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: "var(--success)", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  <span>Hệ thống sẽ tự động sử dụng <strong>API Key Gemini ở Bước 1</strong> để làm Engine xử lý chính. Không cần dán lại!</span>
                </div>
              ) : (
                <>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
                    API Key cho {provider.toUpperCase()}
                  </label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input 
                      type="password" 
                      value={currentKey} 
                      onChange={e => {
                        if (provider === 'openai') setOpenaiKey(e.target.value);
                        else if (provider === 'grok') setGrokKey(e.target.value);
                        else if (provider === 'groq') setGroqKey(e.target.value);
                        else if (provider === 'cerebras') setCerebrasKey(e.target.value);
                        else if (provider === 'qwen') setQwenKey(e.target.value);
                        else if (provider === 'github') setGithubKey(e.target.value);
                        setTestStatus('idle');
                      }} 
                      placeholder={`Dán API Key ${provider.toUpperCase()} của bạn tại đây...`}
                      style={{ flex: 1, border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", transition: "border-color 0.2s", background: "var(--bg-card)" }}
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
                      {isTesting ? "Đang thử..." : "Test Key"}
                    </button>
                  </div>

                  {testStatus === 'success' && (
                    <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 500, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      API Key {provider.toUpperCase()} hợp lệ!
                    </div>
                  )}
                  {testStatus === 'error' && (
                    <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 500, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 4 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                      <span style={{ wordBreak: "break-word" }}>{errorMessage || "Lỗi API Key. Vui lòng kiểm tra lại."}</span>
                    </div>
                  )}
                </>
              )}

              {/* LỰA CHỌN MODEL */}
              {provider === 'gemini' && (
                <>
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Model Gemini chính</label>
                    <select 
                      value={geminiModel} 
                      onChange={(e) => {
                        setGeminiModel(e.target.value);
                        setTestStatus('idle');
                      }}
                      style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", marginBottom: 12, background: "var(--bg-card)", color: "var(--text-secondary)" }}
                    >
                      <optgroup label="Pro">
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview)</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      </optgroup>
                      <optgroup label="Flash">
                        <option value="gemini-3.5-flash">Gemini 3.5 Flash (Mới & Tốt nhất)</option>
                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      </optgroup>
                      <optgroup label="Flash-Lite">
                        <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite</option>
                        <option value="gemini-2.0-flash-lite-preview-02-05">Gemini 2.0 Flash-Lite</option>
                      </optgroup>
                    </select>
                  </div>
                  
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Gemini Proxy URL (Tùy chọn)</label>
                  <input 
                    type="text" 
                    value={geminiProxyUrl} 
                    onChange={(e) => {
                      setGeminiProxyUrl(e.target.value);
                      setTestStatus('idle');
                    }}
                    placeholder="Ví dụ: https://gemini-proxy.thanhnhan7560.workers.dev"
                    style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", background: "var(--bg-card)", color: "var(--text-secondary)" }}
                  />
                </>
              )}

              {provider === 'openai' && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Model OpenAI chính</label>
                  <select 
                    value={openaiModel} 
                    onChange={(e) => {
                      setOpenaiModel(e.target.value);
                      setTestStatus('idle');
                    }}
                    style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", background: "var(--bg-card)", color: "var(--text-secondary)" }}
                  >
                    <option value="gpt-4o-mini">GPT-4o-mini (Nhanh nhất & Rẻ nhất)</option>
                    <option value="gpt-4o">GPT-4o (Thông minh nhất)</option>
                    <option value="o3-mini">o3-mini (Suy luận nâng cao)</option>
                    <option value="o1-preview">o1-preview (Giải quyết vấn đề phức tạp)</option>
                  </select>
                </div>
              )}

              {provider === 'groq' && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Model Groq chính</label>
                  <select 
                    value={groqModel} 
                    onChange={(e) => {
                      setGroqModel(e.target.value);
                      setTestStatus('idle');
                    }}
                    style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", background: "var(--bg-card)", color: "var(--text-secondary)" }}
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
                  </select>
                </div>
              )}

              {provider === 'cerebras' && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Model Cerebras chính</label>
                  <select 
                    value={cerebrasModel} 
                    onChange={(e) => {
                      setCerebrasModel(e.target.value);
                      setTestStatus('idle');
                    }}
                    style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", background: "var(--bg-card)", color: "var(--text-secondary)" }}
                  >
                    <option value="qwen-3-235b-a22b-instruct-2507">Qwen 3 235B (qwen-3-235b-a22b-instruct-2507)</option>
                    <option value="llama3.1-8b">Llama 3.1 8B</option>
                  </select>
                </div>
              )}

              {provider === 'qwen' && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Model Qwen chính</label>
                  <select 
                    value={qwenModel} 
                    onChange={(e) => {
                      setQwenModel(e.target.value);
                      setTestStatus('idle');
                    }}
                    style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", background: "var(--bg-card)", color: "var(--text-secondary)" }}
                  >
                    <option value="qwen-plus">qwen-plus (Cân bằng)</option>
                    <option value="qwen-max">qwen-max (Thông minh nhất)</option>
                    <option value="qwen-turbo">qwen-turbo (Tốc độ)</option>
                  </select>
                </div>
              )}

              {provider === 'github' && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Model GitHub chính</label>
                  <select 
                    value={githubModel} 
                    onChange={(e) => {
                      setGithubModel(e.target.value);
                      setTestStatus('idle');
                    }}
                    style={{ width: "100%", border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", background: "var(--bg-card)", color: "var(--text-secondary)" }}
                  >
                    <option value="openai/gpt-4o">GPT-4o (Đầy đủ tính năng)</option>
                    <option value="openai/gpt-4o-mini">GPT-4o-mini (Free tier)</option>
                    <option value="openai/o1-preview">o1-preview (Suy luận)</option>
                    <option value="openai/o1-mini">o1-mini (Suy luận nhanh)</option>
                    <option value="deepseek/DeepSeek-V3">DeepSeek-V3 (SOTA)</option>
                    <option value="deepseek/DeepSeek-R1">DeepSeek-R1 (Suy luận sâu)</option>
                    <option value="meta/Llama-3.3-70B-Instruct">Llama 3.3 70B</option>
                  </select>
                </div>
              )}
            </div>

            {/* PHẦN 3: EXA SEARCH (TÌM KIẾM THÔNG TIN HIỆN TẠI BẰNG EXA.AI) */}
            <div style={{ background: "var(--bg-main)", padding: 16, borderRadius: 12, border: "1.5px solid var(--border-color)", marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ background: "#4f46e5", color: "#fff", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: "bold" }}>3</span>
                <label style={{ fontSize: 15, fontWeight: 700, color: "var(--text-secondary)", margin: 0 }}>API Key Exa.ai (Tìm kiếm thông tin web hiện tại)</label>
              </div>

              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 12, margin: "0 0 12px 0" }}>
                Được sử dụng cho toàn bộ các tác vụ <strong>tìm kiếm dữ liệu thời gian thực</strong> (nghiên cứu thông tin công ty khách hàng, sản phẩm, tin tức tuyển dụng, đối thủ cạnh tranh) qua công cụ <strong>Exa Search Engine</strong> chuyên sâu cho AI thay thế Google Search.
              </p>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input 
                  type="password" 
                  value={exaKey} 
                  onChange={e => {
                    setExaKey(e.target.value);
                    setExaTestStatus('idle');
                  }} 
                  placeholder="Dán Exa API Key (exa.ai) của bạn tại đây..."
                  style={{ flex: 1, border: "1.5px solid var(--border-color)", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none", transition: "border-color 0.2s", background: "var(--bg-card)" }}
                  onFocus={(e: any) => e.target.style.borderColor = "var(--border-focus)"} 
                  onBlur={(e: any) => e.target.style.borderColor = "var(--border-color)"}
                />
                <button 
                  onClick={handleTestExaKey}
                  disabled={isExaTesting || !exaKey.trim()}
                  style={{ 
                    padding: "0 16px", 
                    borderRadius: 8, 
                    border: "none", 
                    cursor: (isExaTesting || !exaKey.trim()) ? "not-allowed" : "pointer", 
                    fontWeight: 600, 
                    fontSize: 14, 
                    background: (isExaTesting || !exaKey.trim()) ? "var(--border-color)" : "#4f46e5", 
                    color: "#fff",
                    transition: "background 0.2s",
                    whiteSpace: "nowrap"
                  }}
                >
                  {isExaTesting ? "Đang test..." : "Test Exa Key"}
                </button>
              </div>

              {exaTestStatus === 'success' && (
                <div style={{ fontSize: 13, color: "var(--success)", fontWeight: 500, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  Exa API Key hợp lệ! Đã sẵn sàng tìm kiếm web thông tin công ty bằng Exa.
                </div>
              )}
              {exaTestStatus === 'error' && (
                <div style={{ fontSize: 13, color: "var(--danger)", fontWeight: 500, marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                  <span style={{ wordBreak: "break-word" }}>{exaErrorMessage || "Lỗi API Key Exa. Vui lòng kiểm tra lại."}</span>
                </div>
              )}

              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                💡 <strong>Lấy Key miễn phí:</strong> Đăng ký và tạo khóa API tại <a href="https://dashboard.exa.ai/api-keys" target="_blank" rel="noreferrer" style={{ color: "#4f46e5", textDecoration: "none", fontWeight: 600 }}>dashboard.exa.ai</a>.
              </div>
            </div>

            {/* BẢO MẬT */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 16, background: "rgba(16, 185, 129, 0.05)", padding: 12, borderRadius: 8, border: "1px solid rgba(16, 185, 129, 0.1)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" style={{ marginTop: 2, flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Các API Key của bạn hoàn toàn được lưu trực tiếp dưới máy cục bộ (LocalStorage) của trình duyệt. Chúng tôi KHÔNG truyền hay lưu trữ bất kỳ thông tin nào trên máy chủ của Tool4RC.
              </span>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: 10 }}>
            <button 
              onClick={handleSaveKey}
              style={{ 
                padding: "10px 24px", 
                borderRadius: 8, 
                border: "none", 
                cursor: "pointer", 
                fontWeight: 600, 
                fontSize: 14, 
                background: "var(--success)", 
                color: "var(--bg-card)",
                transition: "background 0.2s"
              }}>
              Lưu cấu hình
            </button>
            <button onClick={() => setShowSettings(false)}
              style={{ padding: "10px 24px", borderRadius: 8, border: "1px solid var(--border-color)", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "var(--bg-card)", color: "var(--text-secondary)" }}>
              Hủy bỏ
            </button>
          </div>
        </Modal>
      )}

      {showUsage && <UsageDashboard onClose={() => setShowUsage(false)} />}
    </header>
  );
}
