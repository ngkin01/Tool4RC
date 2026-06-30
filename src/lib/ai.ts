import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import * as pdfjsLib from 'pdfjs-dist';
import { UsageTracker } from './usage';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export type AIProvider = 'gemini' | 'openai' | 'grok' | 'groq' | 'cerebras' | 'qwen' | 'github';

export function getProvider(): AIProvider {
  return (localStorage.getItem("ai_provider") as AIProvider) || 'gemini';
}

export function getQwenClient() {
  const customKey = localStorage.getItem("custom_qwen_api_key");
  if (!customKey) throw new Error("Qwen API key is missing");
  return new OpenAI({ apiKey: customKey, baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", dangerouslyAllowBrowser: true });
}

export function getGithubModelsClient() {
  const customKey = localStorage.getItem("custom_github_pat");
  if (!customKey) throw new Error("GitHub token is missing");
  return new OpenAI({ apiKey: customKey, baseURL: "https://models.github.ai/inference", dangerouslyAllowBrowser: true });
}

export function getGeminiClient() {
  const customKey = localStorage.getItem("custom_gemini_api_key");
  if (!customKey) throw new Error("Gemini API key is missing. Please add it in Settings.");
  
  const proxyUrl = localStorage.getItem("gemini_proxy_url");
  const config: any = { apiKey: customKey };
  
  if (proxyUrl && proxyUrl.trim() !== "") {
    let cleanUrl = proxyUrl.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    config.httpOptions = { baseUrl: cleanUrl };
  }
  
  return new GoogleGenAI(config);
}

export function getOpenAIClient() {
  const customKey = localStorage.getItem("custom_openai_api_key");
  if (!customKey) throw new Error("OpenAI API key is missing");
  return new OpenAI({ apiKey: customKey, dangerouslyAllowBrowser: true });
}

export function getGrokClient() {
  const customKey = localStorage.getItem("custom_grok_api_key");
  if (!customKey) throw new Error("Grok API key is missing");
  return new OpenAI({ apiKey: customKey, baseURL: "https://api.x.ai/v1", dangerouslyAllowBrowser: true });
}

export function getGroqClient() {
  const customKey = localStorage.getItem("custom_groq_api_key");
  if (!customKey) throw new Error("Groq API key is missing");
  return new OpenAI({ apiKey: customKey, baseURL: "https://api.groq.com/openai/v1", dangerouslyAllowBrowser: true });
}

export function getCerebrasClient() {
  const customKey = localStorage.getItem("custom_cerebras_api_key");
  if (!customKey) throw new Error("Cerebras API key is missing");
  return new OpenAI({ apiKey: customKey, baseURL: "https://api.cerebras.ai/v1", dangerouslyAllowBrowser: true });
}

export const getGeminiModel = () => {
  return localStorage.getItem("gemini_model") || "gemini-3.5-flash";
};

export const getGroqModel = () => {
  return localStorage.getItem("groq_model") || "llama-3.3-70b-versatile";
};

export const getCerebrasModel = () => {
  return localStorage.getItem("cerebras_model") || "qwen-3-235b-a22b-instruct-2507";
};

export const getQwenModel = () => {
  return localStorage.getItem("qwen_model") || "qwen-plus";
};

export const getOpenAIModel = () => {
  return localStorage.getItem("openai_model") || "gpt-4o-mini";
};

export async function testApiKey(provider: AIProvider, key: string, customProxyUrl?: string, currentModel?: string): Promise<{success: boolean, error?: string}> {
  try {
    if (provider === 'gemini') {
      const proxyUrl = customProxyUrl !== undefined ? customProxyUrl : localStorage.getItem("gemini_proxy_url");
      const config: any = { apiKey: key };
      if (proxyUrl && proxyUrl.trim() !== "") {
        let cleanUrl = proxyUrl.trim();
        if (cleanUrl.endsWith('/')) {
          cleanUrl = cleanUrl.slice(0, -1);
        }
        config.httpOptions = { baseUrl: cleanUrl };
      }
      const ai = new GoogleGenAI(config);
      const model = currentModel || getGeminiModel();
      const response = await ai.models.generateContent({
        model: model,
        contents: "Say 'OK'",
      });
      return { success: !!response.text };
    } else if (provider === 'openai') {
      const openai = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
      const model = currentModel || getOpenAIModel();
      const response = await openai.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: "Say 'OK'" }],
        max_tokens: 5,
      });
      return { success: !!response.choices[0].message.content };
    } else if (provider === 'grok') {
      const grok = new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1", dangerouslyAllowBrowser: true });
      const response = await grok.chat.completions.create({
        model: "grok-2-latest",
        messages: [{ role: "user", content: "Say 'OK'" }],
        max_tokens: 5,
      });
      return { success: !!response.choices[0].message.content };
    } else if (provider === 'groq') {
      const groq = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1", dangerouslyAllowBrowser: true });
      const model = currentModel || getGroqModel();
      const response = await groq.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: "Say 'OK'" }],
        max_tokens: 5,
      });
      return { success: !!response.choices[0].message.content };
    } else if (provider === 'cerebras') {
      const cerebras = new OpenAI({ apiKey: key, baseURL: "https://api.cerebras.ai/v1", dangerouslyAllowBrowser: true });
      const model = currentModel || getCerebrasModel();
      const response = await cerebras.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: "Say 'OK'" }],
        max_tokens: 5,
      });
      return { success: !!response.choices[0].message.content };
    } else if (provider === 'qwen') {
      const qwen = new OpenAI({ apiKey: key, baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", dangerouslyAllowBrowser: true });
      const model = currentModel || getQwenModel();
      const response = await qwen.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: "Say 'OK'" }],
        max_tokens: 5,
      });
      return { success: !!response.choices[0].message.content };
    } else if (provider === 'github') {
      const github = new OpenAI({ apiKey: key, baseURL: "https://models.github.ai/inference", dangerouslyAllowBrowser: true });
      const model = currentModel || localStorage.getItem("custom_github_model") || "openai/gpt-4o-mini";
      const response = await github.chat.completions.create({
        model: model,
        messages: [{ role: "user", content: "Say 'OK'" }],
        max_tokens: 5,
      });
      return { success: !!response.choices[0].message.content };
    }
    return { success: false, error: "Unknown provider" };
  } catch (error: any) {
    console.error("API Key Test Error:", error);
    return { success: false, error: error.message || String(error) };
  }
}

export async function gemini(system: string, user: string, maxTokens=1200) {
  const provider = getProvider();
  
  if (provider === 'openai') {
    const openai = getOpenAIClient();
    const model = getOpenAIModel();
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: maxTokens,
    });
    if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
    return response.choices[0].message.content || "";
  } else if (provider === 'grok') {
    const grok = getGrokClient();
    const response = await grok.chat.completions.create({
      model: "grok-2-latest",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: maxTokens,
    });
    if (response.usage) UsageTracker.logUsage(provider, "grok-2-latest", response.usage.prompt_tokens, response.usage.completion_tokens);
    return response.choices[0].message.content || "";
  } else if (provider === 'groq') {
    const groq = getGroqClient();
    const model = getGroqModel();
    const response = await groq.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: maxTokens,
    });
    if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
    return response.choices[0].message.content || "";
  } else if (provider === 'cerebras') {
    const cerebras = getCerebrasClient();
    const model = getCerebrasModel();
    const response = await cerebras.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: maxTokens,
    });
    if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
    return response.choices[0].message.content || "";
  } else if (provider === 'qwen') {
    const qwen = getQwenClient();
    const model = getQwenModel();
    const response = await qwen.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: maxTokens,
    });
    if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
    return response.choices[0].message.content || "";
  } else if (provider === 'github') {
    const github = getGithubModelsClient();
    const model = localStorage.getItem("custom_github_model") || "openai/gpt-4o-mini";
    const response = await github.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: maxTokens,
    });
    if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
    return response.choices[0].message.content || "";
  }

  const ai = getGeminiClient();
  const model = getGeminiModel();
  const response = await ai.models.generateContent({
    model: model,
    contents: user,
    config: {
      systemInstruction: system,
    }
  });
  if (response.usageMetadata) UsageTracker.logUsage('gemini', model, response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
  return response.text || "";
}

async function extractTextFromPdfBase64(base64: string): Promise<string> {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }
    return fullText;
  } catch (e) {
    console.error("PDF extraction error:", e);
    return "[Could not extract text from PDF]";
  }
}

export async function geminiWithDoc(system: string, userText: string, pdfBase64: string | null = null, maxTokens=1200) {
  const provider = getProvider();

  if (provider === 'openai' || provider === 'grok' || provider === 'groq' || provider === 'cerebras' || provider === 'qwen' || provider === 'github') {
    let finalUserText = userText;
    if (pdfBase64) {
      const extractedText = await extractTextFromPdfBase64(pdfBase64);
      finalUserText += `\n\n--- EXTRACTED PDF CONTENT ---\n${extractedText}`;
    }
    
    if (provider === 'openai') {
      const openai = getOpenAIClient();
      const model = getOpenAIModel();
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: finalUserText }
        ],
        max_tokens: maxTokens,
      });
      if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
      return response.choices[0].message.content || "";
    } else if (provider === 'grok') {
      const grok = getGrokClient();
      const response = await grok.chat.completions.create({
        model: "grok-2-latest",
        messages: [
          { role: "system", content: system },
          { role: "user", content: finalUserText }
        ],
        max_tokens: maxTokens,
      });
      if (response.usage) UsageTracker.logUsage(provider, "grok-2-latest", response.usage.prompt_tokens, response.usage.completion_tokens);
      return response.choices[0].message.content || "";
    } else if (provider === 'groq') {
      const groq = getGroqClient();
      const model = getGroqModel();
      const response = await groq.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: finalUserText }
        ],
        max_tokens: maxTokens,
      });
      if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
      return response.choices[0].message.content || "";
    } else if (provider === 'cerebras') {
      const cerebras = getCerebrasClient();
      const model = getCerebrasModel();
      const response = await cerebras.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: finalUserText }
        ],
        max_tokens: maxTokens,
      });
      if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
      return response.choices[0].message.content || "";
    } else if (provider === 'qwen') {
      const qwen = getQwenClient();
      const model = getQwenModel();
      const response = await qwen.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: finalUserText }
        ],
        max_tokens: maxTokens,
      });
      if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
      return response.choices[0].message.content || "";
    } else {
      const github = getGithubModelsClient();
      const model = localStorage.getItem("custom_github_model") || "openai/gpt-4o-mini";
      const response = await github.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: finalUserText }
        ],
        max_tokens: maxTokens,
      });
      if (response.usage) UsageTracker.logUsage(provider, model, response.usage.prompt_tokens, response.usage.completion_tokens);
      return response.choices[0].message.content || "";
    }
  }

  const ai = getGeminiClient();
  const parts: any[] = [];
  if (pdfBase64) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBase64
      }
    });
  }
  parts.push({ text: userText });

  const model = getGeminiModel();
  const response = await ai.models.generateContent({
    model: model,
    contents: parts,
    config: {
      systemInstruction: system,
    }
  });
  if (response.usageMetadata) UsageTracker.logUsage('gemini', model, response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);
  return response.text || "";
}

export async function getGoogleMapsGrounding(locationQuery: string) {
  try {
    const ai = getGeminiClient();
    // Use the user's selected model, or fallback to 3.5-flash
    const model = getGeminiModel() || "gemini-3.5-flash"; 
    
    // Add a timeout to prevent infinite hanging
    const timeoutPromise = new Promise<any>((_, reject) => {
      setTimeout(() => reject(new Error("Google Maps search timed out. Please try again.")), 15000);
    });

    const fetchPromise = ai.models.generateContent({
      model: model,
      contents: `Find the Google Maps link for this location: ${locationQuery}. Return ONLY the location name or address.`,
      config: {
        tools: [{ googleMaps: {} }],
      }
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (response.usageMetadata) UsageTracker.logUsage('gemini', model, response.usageMetadata.promptTokenCount || 0, response.usageMetadata.candidatesTokenCount || 0);

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let mapUri = "";
    if (chunks) {
      for (const chunk of chunks) {
        if (chunk.maps?.uri) {
          mapUri = chunk.maps.uri;
          break;
        }
      }
    }
    
    return {
      address: response.text?.trim() || locationQuery,
      mapUri: mapUri
    };
  } catch (e: any) {
    console.error("Location enhancement error:", e);
    throw e;
  }
}

export async function genSummary(cv: string, jd: string, notes: string, pdfBase64: string | null = null) {
  const hasNotes = notes && notes.trim().length > 0;
  const sys = `You are a senior recruitment consultant preparing a candidate summary to present to a client.

INPUT:
- Job Description (JD)
- Candidate CV
- Screening Call Notes (if available)

OBJECTIVE:
Produce a high-quality candidate summary that positions the candidate as a strong fit for the role.

CORE PRINCIPLES:
- This is NOT a CV summary. This is a client-facing candidate pitch.
- Select only the most relevant and strongest information aligned with the JD
- Prioritize screening call insights over CV when available
- Do NOT mention any weaknesses, missing skills, or gaps
- Do NOT list responsibilities mechanically
- Combine and synthesize information into impactful statements
- Each bullet point must represent a meaningful strength, not a task

WRITING STYLE:
- Professional, concise, and consultative tone
- Use strong positioning language: “Extensive experience in…”, “Proven track record in…”, “Strong capability in…”
- Focus on: scope, impact, ownership, and expertise
- Avoid generic or vague statements

STRUCTURE LOGIC:
Before writing, internally:
1. Identify 3–5 key requirements from the JD
2. Extract the most relevant matching strengths from CV + screening notes
3. Group related experiences into themes (e.g., audit, ESG, stakeholder, systems)

OUTPUT FORMAT:

Executive Summary:
- Bullet points (dynamic number, typically 5–8)
- Each bullet = 1 strong theme or capability
- No repetition, no low-value details
- Prioritize quality over quantity`;
  const userText = pdfBase64
    ? "The CV is in the attached PDF.\n\nJob Description:\n" + (jd||"Not provided") + (hasNotes ? "\n\nRecruiter Notes:\n" + notes : "") + "\n\nWrite bullet points only."
    : "CV:\n" + cv + "\n\nJob Description:\n" + (jd||"Not provided") + (hasNotes ? "\n\nRecruiter Notes:\n" + notes : "") + "\n\nWrite bullet points only.";
  return geminiWithDoc(sys, userText, pdfBase64, 1200);
}

export async function extractEmail(cv: string, jd: string, pdfBase64: string | null = null) {
  const sys = `Extract candidate information from the CV and the job title from the Job Description.
RULES: Extract ONLY what is explicitly stated. If a field is not found, use "Not specified". NEVER guess or assume.
Respond ONLY with this JSON, no other text:
{"candidateName":"","location":"","dob":"","yearsExperience":"","language":"","education":"","availability":"","salary":"","jobTitle":""}`;
  
  const userText = pdfBase64 
    ? `The CV is in the attached document above.\n\nJob Description:\n${jd || "Not specified"}\n\nJSON only.` 
    : `CV:\n${cv}\n\nJob Description:\n${jd || "Not specified"}\n\nJSON only.`;
    
  const info = await geminiWithDoc(sys, userText, pdfBase64);
  
  try {
    const m = info.match(/\{[\s\S]*\}/); 
    const p = m ? JSON.parse(m[0]) : {};
    const ns = (k: string) => p[k] || "Not specified";
    return {
      candidateName: ns("candidateName"),
      location: ns("location"),
      dob: ns("dob"),
      yearsExperience: ns("yearsExperience"),
      language: ns("language"),
      education: ns("education"),
      availability: ns("availability"),
      salary: ns("salary"),
      jobTitle: ns("jobTitle")
    };
  } catch { 
    return {
      candidateName: "Not specified",
      location: "Not specified",
      dob: "Not specified",
      yearsExperience: "Not specified",
      language: "Not specified",
      education: "Not specified",
      availability: "Not specified",
      salary: "Not specified",
      jobTitle: "Not specified"
    }; 
  }
}

export const buildEmail=(info: any,summary: string)=>{
  const jobLine = info.jobTitle&&info.jobTitle!=="Not specified"
    ? `I'd like to send a potential candidate for ${info.jobTitle} – freeC Consulting. Kindly check the brief below and the attached CV for more details.`
    : `I'd like to send a potential candidate for your consideration. Kindly check the brief below and the attached CV for more details.`;
  return `Hi,\n\n${jobLine}\n\nCandidate: ${info.candidateName}\nLocation: ${info.location}\nY.O.B: ${info.dob}\nTotal Years of Experience: ${info.yearsExperience}\nLanguage: ${info.language}\nEducation: ${info.education}\nNotice of Availability: ${info.availability}\nExpected Salary: ${info.salary}${summary?`\n\nExecutive Summary:\n${summary}`:""}\n\nBest regards,`;
};
