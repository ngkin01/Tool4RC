import express from "express";
import path from "path";
import { Type } from "@google/genai";
import { callLLM, callLLMStream, safeParseJson } from "./api/_lib/ai.js";

export const app = express();
const PORT = Number(process.env.PORT) || 3000;

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
    DO NOT INCLUDE markdown like \`\`\`json. DO NOT INCLUDE any conversational text before or after the JSON.
    OUTPUT ONLY THE RAW JSON OBJECT.

    Here is the JSON schema you must strictly follow:
    ${JSON.stringify({
      hasNewJob: "boolean",
      matchedJobId: "string | null",
      timelineSummary: "string",
      clientUpdates: {
        culture: "string",
        overview: "string",
        industry: "string",
        keyInfo: ["string"]
      },
      jobData: {
        title: "string",
        roleOverview: {
          dept: "string",
          reportingLine: "string",
          salaryRange: "string",
          location: "string"
        },
        companyContext: ["string"],
        idealPersona: ["string"],
        mustHave: ["string"],
        niceToHave: ["string"],
        questionsForClient: ["string"],
        booleanSearch: "string",
        socialPost: "string",
        interviewQuestions: ["string"],
        competitorCompanies: ["string"],
        positionIntelligence: ["string"],
        sellingPoints: ["string"],
        candidateSellingPoints: ["string"],
        recruitmentStrategy: {
          whereToSource: ["string"],
          companiesToTargetFirst: ["string"],
          challengesAndMitigations: ["string"]
        },
        booleanSearchQueries: {
          linkedin: "string",
          cvDb: "string",
          xray: "string",
          industry: "string",
          japanese: "string"
        }
      }
    }, null, 2)}
    
    Return a JSON object containing the above fields.
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
       
       ==================================================
       ADDITIONAL RECRUITMENT INTELLIGENCE
       ==================================================
       
       You are not a JD parser.
       
       You are an experienced Senior Headhunter and Recruitment Consultant with deep knowledge of recruitment, industries, and talent markets.
       
       The purpose of this report is to help a consultant who has never worked on this position immediately understand:
       1. The company
       2. The market
       3. The nature of the role
       4. Where to source candidates
       5. How to sell the opportunity to candidates
       6. Potential hiring challenges and risks
       
       Do not simply restate the JD. Provide actionable recruitment insights.
       
       --------------------------------------------------
       1. competitorCompanies
       --------------------------------------------------
       
       Provide:
       - direct competitors
       - similar business models
       - companies with transferable talent
       - explain why these companies should be targeted.
       
       --------------------------------------------------
       2. positionIntelligence
       --------------------------------------------------
       
       Explain:
       - nature of the role
       - day-to-day challenges
       - hidden expectations
       - key success factors
       - common candidate backgrounds
       - common reasons candidates fail
       - transferable backgrounds.
       
       Focus on helping consultants understand what success actually looks like in this role.
       
       --------------------------------------------------
       3. candidatePersonaObj
       --------------------------------------------------
       
       Provide:
       - years of experience
       - industry background
       - functional background
       - language requirements
       - personality traits.
       
       --------------------------------------------------
       4. talentMarketInsight
       --------------------------------------------------
       
       Assess:
       - talent pool difficulty
       - hiring challenges
       - counter-offer risk
       - salary competitiveness
       - notice period risk.
       
       --------------------------------------------------
       5. candidateSellingPoints
       --------------------------------------------------
       
       Explain:
       - why candidates should join this company
       - key employer value propositions
       - attractive aspects of the role.
       
       --------------------------------------------------
       6. recruitmentStrategy
       --------------------------------------------------
       
       Provide:
       - sourcing channels
       - target companies
       - sourcing priorities
       - recruitment challenges
       - mitigation plans.
       
       --------------------------------------------------
       7. booleanSearchQueries
       --------------------------------------------------
       
       Generate practical and copy-paste ready searches for:
       
       - LinkedIn Recruiter Search
       - CV Database Search
       - X-Ray Search
       - Industry Search
       - Japanese Search (if applicable)
       
       Do NOT generate one long Boolean string.
       
       Each query should be short, practical, and immediately usable by recruiters.
       
       ==================================================
       IMPORTANT
       ==================================================
       
       Distinguish between:
       
       FACT:
       - Information directly found in the JD
       - Official website
       - Official LinkedIn page
       - Reliable public sources
       
       INFERENCE:
       - Reasonable recruitment insights derived from available information.
       
       Never present inference as fact.
       
       Never fabricate information.
       
       If information cannot be verified:
       - return null
       - or "Not verified".
       
       For every insight section, think like an experienced recruitment consultant instead of a JD parser.
       
       Before generating the report, ask yourself:
       
       "If I were a consultant who had never worked on this position before, would this report give me enough information to understand the role, understand the market, and immediately start sourcing candidates?"
       
       If the answer is no, provide additional recruitment insights.
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
            interviewQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            competitorCompanies: {
              type: Type.OBJECT,
              properties: {
                directCompetitors: { type: Type.ARRAY, items: { type: Type.STRING } },
                similarBusinessModels: { type: Type.ARRAY, items: { type: Type.STRING } },
                transferableTalent: { type: Type.ARRAY, items: { type: Type.STRING } },
                whyTheseCompanies: { type: Type.STRING }
              }
            },
            positionIntelligence: {
              type: Type.OBJECT,
              properties: {
                natureOfRole: { type: Type.STRING },
                dayToDayChallenges: { type: Type.ARRAY, items: { type: Type.STRING } },
                hiddenExpectations: { type: Type.ARRAY, items: { type: Type.STRING } },
                keySuccessFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
                commonCandidateBackgrounds: { type: Type.ARRAY, items: { type: Type.STRING } },
                commonReasonsCandidatesFail: { type: Type.ARRAY, items: { type: Type.STRING } },
                transferableBackgrounds: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            candidatePersonaObj: {
              type: Type.OBJECT,
              properties: {
                yearsOfExperience: { type: Type.STRING },
                industryBackground: { type: Type.STRING },
                functionalBackground: { type: Type.STRING },
                languageRequirements: { type: Type.STRING },
                personalityTraits: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            talentMarketInsight: {
              type: Type.OBJECT,
              properties: {
                talentPoolDifficulty: { type: Type.STRING },
                hiringChallenges: { type: Type.ARRAY, items: { type: Type.STRING } },
                counterOfferRisk: { type: Type.STRING },
                salaryCompetitiveness: { type: Type.STRING },
                noticePeriodRisk: { type: Type.STRING }
              }
            },
            candidateSellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            recruitmentStrategy: {
              type: Type.OBJECT,
              properties: {
                whereToSource: { type: Type.ARRAY, items: { type: Type.STRING } },
                companiesToTargetFirst: { type: Type.ARRAY, items: { type: Type.STRING } },
                challengesAndMitigations: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            },
            booleanSearchQueries: {
              type: Type.OBJECT,
              properties: {
                linkedin: { type: Type.STRING },
                cvDb: { type: Type.STRING },
                xray: { type: Type.STRING },
                industry: { type: Type.STRING },
                japanese: { type: Type.STRING }
              }
            }
          }
        }
      },
      required: ["hasNewJob", "timelineSummary"]
    };

    const stream = callLLMStream({
      provider,
      apiKey,
      model,
      customEndpoint,
      prompt: finalPrompt,
      responseSchema: responseSchema,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error("LLM API Error:", error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : (typeof error === "string" 
          ? error 
          : (error && typeof error === "object" && "message" in error 
              ? (error as any).message 
              : JSON.stringify(error) || "Failed to process input"));
    if (res.headersSent) {
      res.write(`\n\nERROR_STREAMING: ${errorMessage}`);
      res.end();
    } else {
      res.status(500).json({ error: errorMessage });
    }
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

    let targetModel = model;
    if (!targetModel && provider === "gemini") {
      targetModel = "gemini-3.5-flash"; // Default to a standard conversational model
    }

    const stream = callLLMStream({
      provider,
      apiKey,
      model: targetModel,
      customEndpoint,
      prompt: `You are a helpful AI recruiting assistant. 
      Answer the recruiter's question using the following client data context.
      
      Context:
      ${JSON.stringify(clientData)}
      
      Question: ${message}`,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error("Chat API Error:", error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : (typeof error === "string" 
          ? error 
          : (error && typeof error === "object" && "message" in error 
              ? (error as any).message 
              : JSON.stringify(error) || "Failed to generate chat"));
    if (res.headersSent) {
      res.write(`\n\nERROR_STREAMING: ${errorMessage}`);
      res.end();
    } else {
      res.status(500).json({ error: errorMessage });
    }
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Only start the server locally, don't run this when imported by Vercel
if (!process.env.VERCEL) {
  startServer();
}
