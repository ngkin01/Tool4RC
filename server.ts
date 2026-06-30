import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Default fallback client for Gemini
const defaultGeminiAi = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Clean JSON Parsing Helper
function safeParseJson(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}

// Unified callLLM function
async function callLLM({
  provider,
  apiKey,
  model,
  customEndpoint,
  prompt,
  systemInstruction,
  responseSchema,
}: {
  provider: string;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
}): Promise<string> {
  console.log(`callLLM triggered. Provider: ${provider}, Model: ${model || "default"}`);

  if (provider === "gemini") {
    const aiClient = apiKey 
      ? new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } })
      : defaultGeminiAi;

    const targetModel = model || "gemini-2.5-flash";
    const config: any = {};
    if (responseSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = responseSchema;
    }
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await aiClient.models.generateContent({
      model: targetModel,
      contents: prompt,
      config,
    });
    return response.text || "";
  }

  if (provider === "openai" || provider === "grok" || provider === "deepseek" || provider === "custom" || provider === "groq" || provider === "cerebras" || provider === "qwen" || provider === "github") {
    let baseURL = undefined;
    if (provider === "grok") {
      baseURL = "https://api.x.ai/v1";
    } else if (provider === "deepseek") {
      baseURL = "https://api.deepseek.com/v1";
    } else if (provider === "groq") {
      baseURL = "https://api.groq.com/openai/v1";
    } else if (provider === "cerebras") {
      baseURL = "https://api.cerebras.ai/v1";
    } else if (provider === "qwen") {
      baseURL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
    } else if (provider === "github") {
      baseURL = "https://models.github.ai/inference";
    } else if (provider === "custom" && customEndpoint) {
      baseURL = customEndpoint;
    }

    const openaiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });

    const targetModel = model || (
      provider === "openai" ? "gpt-4o-mini" :
      provider === "grok" ? "grok-2-latest" :
      provider === "deepseek" ? "deepseek-chat" :
      provider === "groq" ? "llama-3.3-70b-versatile" :
      provider === "cerebras" ? "qwen-3-235b-a22b-instruct-2507" :
      provider === "qwen" ? "qwen-plus" :
      provider === "github" ? "openai/gpt-4o-mini" : "gpt-4o-mini"
    );

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    messages.push({ role: "user", content: prompt });

    const responseFormat: any = responseSchema ? { type: "json_object" } : undefined;

    const chatCompletion = await openaiClient.chat.completions.create({
      model: targetModel,
      messages: messages,
      response_format: responseFormat,
    });

    return chatCompletion.choices[0]?.message?.content || "";
  }

  if (provider === "claude") {
    const targetModel = model || "claude-3-5-sonnet-latest";
    const headers: Record<string, string> = {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };
    
    const body: any = {
      model: targetModel,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    };

    if (systemInstruction) {
      body.system = systemInstruction;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API Error: ${errText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || "";
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API route for processing universal input
  app.post("/api/freecai/process", async (req, res) => {
    console.log("Processing /api/freecai/process...");
    try {
      const provider = (req.headers["x-ai-provider"] as string) || "gemini";
      const headerKey = req.headers["x-ai-key"] as string;
      const model = (req.headers["x-ai-model"] as string) || "";
      const customEndpoint = (req.headers["x-ai-custom-endpoint"] as string) || "";

      let apiKey = headerKey;
      if (!apiKey && provider === "gemini") {
        apiKey = process.env.GEMINI_API_KEY || "";
      }

      if (!apiKey) {
        return res.status(400).json({ 
          error: `Vui lòng cấu hình API Key cho nhà cung cấp ${provider.toUpperCase()} của bạn trong bảng cài đặt!` 
        });
      }

      const { input, currentClientName, customPrompt, existingJobs } = req.body;

      if (!input || !currentClientName) {
        console.error("Missing input or currentClientName");
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`Sending request to LLM (${provider}) for client: ${currentClientName}`);

      let basePrompt = "";
      if (customPrompt && customPrompt.trim()) {
        basePrompt = customPrompt
          .replace(/\${currentClientName}/g, currentClientName)
          .replace(/\${input}/g, input);
      } else {
        basePrompt = `You are an AI assistant for recruiters. A recruiter has pasted some information about a client named "${currentClientName}".
        The information might be a Job Description (JD), meeting notes, emails, or feedback.
        
        Information:
        """
        ${input}
        """`;
      }

      let existingJobsPrompt = "";
      if (existingJobs && Array.isArray(existingJobs) && existingJobs.length > 0) {
        existingJobsPrompt = `
Here is a list of existing jobs for this client:
${existingJobs.map((j: any) => `- ID: "${j.id}", Title: "${j.title}"`).join("\n")}

Please carefully compare the input with these existing jobs. Determine if the input refers to a brand NEW job opening, or if it represents an UPDATE / additional information for one of the existing jobs listed above.
If the input title or role matches or is highly related to an existing job, identify it as an update to that job.
`;
      } else {
        existingJobsPrompt = `\nThere are no existing jobs for this client. This is likely a new job if any job is detected.\n`;
      }

      const finalPrompt = `${basePrompt}
      ${existingJobsPrompt}

      --------------------------------------------------
      IMPORTANT SYSTEM DIRECTIVE:
      You must analyze the information and output the extracted fields as JSON conforming EXACTLY to the schema.
      
      Return a JSON object containing:
      1. 'hasNewJob': A boolean flag to indicate if a new job opening or job update is detected. If it is a JD or clearly describes a job (new or update), set this to true.
      2. 'matchedJobId': A string or null. If this is an update or additional information for an existing job from the list above, set this to the exact 'ID' of that matched job. Otherwise, set this to null.
      3. 'timelineSummary': A string summarizing what happened in this input to add to the timeline.
      4. 'clientUpdates': A structured object with any new information about the client:
         - culture (string)
         - overview (string)
         - industry (string)
         - keyInfo (array of strings)
      5. 'jobData': If 'hasNewJob' is true, generate a comprehensive object containing:
         - title (string)
         - roleOverview: { dept, reportingLine, salaryRange, location }
         - companyContext: (array of strings)
         - idealPersona: (array of strings)
         - mustHave: (array of strings)
         - niceToHave: (array of strings)
         - questionsForClient: (array of strings)
         - booleanSearch: (string)
         - socialPost: (string)
         - interviewQuestions: (array of strings)
      `;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          hasNewJob: { type: Type.BOOLEAN },
          matchedJobId: { type: Type.STRING, description: "ID of the matched existing job, or null if it is a brand new job" },
          timelineSummary: { type: Type.STRING },
          clientUpdates: {
            type: Type.OBJECT,
            properties: {
              culture: { type: Type.STRING },
              overview: { type: Type.STRING },
              industry: { type: Type.STRING },
              keyInfo: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          },
          jobData: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              roleOverview: {
                type: Type.OBJECT,
                properties: {
                  dept: { type: Type.STRING },
                  reportingLine: { type: Type.STRING },
                  salaryRange: { type: Type.STRING },
                  location: { type: Type.STRING }
                }
              },
              companyContext: { type: Type.ARRAY, items: { type: Type.STRING } },
              idealPersona: { type: Type.ARRAY, items: { type: Type.STRING } },
              mustHave: { type: Type.ARRAY, items: { type: Type.STRING } },
              niceToHave: { type: Type.ARRAY, items: { type: Type.STRING } },
              questionsForClient: { type: Type.ARRAY, items: { type: Type.STRING } },
              booleanSearch: { type: Type.STRING },
              socialPost: { type: Type.STRING },
              interviewQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        },
        required: ["hasNewJob", "timelineSummary"]
      };

      const resultText = await callLLM({
        provider,
        apiKey,
        model,
        customEndpoint,
        prompt: finalPrompt,
        responseSchema: provider === "gemini" ? responseSchema : undefined,
      });

      console.log("LLM response received");
      if (resultText) {
        try {
          console.log("Parsing JSON response");
          const parsed = safeParseJson(resultText);
          return res.json(parsed);
        } catch (parseErr) {
          console.error("JSON Parse Error:", parseErr, "Text:", resultText);
          return res.status(500).json({ error: "Failed to parse AI response. Ensure your AI model outputs valid JSON conforming to requirements." });
        }
      } else {
        console.error("No text in LLM response");
        return res.status(500).json({ error: "No response text from AI" });
      }

    } catch (error) {
      console.error("LLM API Error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : (typeof error === "string" 
            ? error 
            : (error && typeof error === "object" && "message" in error 
                ? (error as any).message 
                : JSON.stringify(error) || "Failed to process input"));
      res.status(500).json({ error: errorMessage });
    }
  });

  // Chat API route for RAG over client data
  app.post("/api/freecai/chat", async (req, res) => {
    try {
      const provider = (req.headers["x-ai-provider"] as string) || "gemini";
      const headerKey = req.headers["x-ai-key"] as string;
      const model = (req.headers["x-ai-model"] as string) || "";
      const customEndpoint = (req.headers["x-ai-custom-endpoint"] as string) || "";

      let apiKey = headerKey;
      if (!apiKey && provider === "gemini") {
        apiKey = process.env.GEMINI_API_KEY || "";
      }

      if (!apiKey) {
        return res.status(400).json({ 
          error: `Vui lòng cấu hình API Key cho nhà cung cấp ${provider.toUpperCase()} của bạn trong bảng cài đặt!` 
        });
      }

      const { message, clientData } = req.body;

      const resultText = await callLLM({
        provider,
        apiKey,
        model,
        customEndpoint,
        prompt: `You are a helpful AI recruiting assistant. 
        Answer the recruiter's question using the following client data context.
        
        Context:
        ${JSON.stringify(clientData)}
        
        Question: ${message}`,
      });
      
      res.json({ text: resultText });
    } catch (error) {
      console.error("Chat API Error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : (typeof error === "string" 
            ? error 
            : (error && typeof error === "object" && "message" in error 
                ? (error as any).message 
                : JSON.stringify(error) || "Failed to generate chat"));
      res.status(500).json({ error: errorMessage });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
