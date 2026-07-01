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
        .replace(/\\?\${currentClientName}/g, currentClientName)
        .replace(/\\?\${input}/g, input);
      
      // Defensive fallback: If for any reason ${input} was not present in the customPrompt (e.g. user deleted it or it was corrupted in database),
      // we append the input JD at the end of the prompt to ensure the AI always receives and processes it.
      if (!customPrompt.includes("${input}") && !customPrompt.includes("\\${input}")) {
        basePrompt += `\n\n[System Added Input for analysis as the custom prompt lacks the \${input} placeholder]:\n"""\n${input}\n"""`;
      }
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
    CRITICAL RULE FOR hasNewJob DETECTION:
    Set hasNewJob = true if the input text contains ANY of the following signals, 
    even partially: a job title; section headers like 'Job description', 
    'Responsibilities', 'Requirements', 'Qualifications', 'Work Experience'; 
    a list of duties or required skills; or any description of a role someone 
    would be hired to perform.
    Only set hasNewJob = false if the input is clearly just casual conversation, 
    a greeting, or generic info with no role described.
    When in doubt, prefer hasNewJob = true and use 'Not verified' for fields 
    you cannot determine, rather than defaulting to false.

    You must analyze the information and output the extracted fields as JSON conforming EXACTLY to the schema.
    DO NOT INCLUDE markdown like \`\`\`json. DO NOT INCLUDE any conversational text before or after the JSON.
    OUTPUT ONLY THE RAW JSON OBJECT.

    Here is the JSON schema you must strictly follow:
    ${JSON.stringify({
      hasNewJob: "boolean",
      matchedJobId: "string",
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
        competitorCompanies: {
          directCompetitors: ["string"],
          similarBusinessModels: ["string"],
          transferableTalent: ["string"],
          whyTheseCompanies: "string"
        },
        positionIntelligence: {
          natureOfRole: "string",
          dayToDayChallenges: ["string"],
          hiddenExpectations: ["string"],
          keySuccessFactors: ["string"],
          commonCandidateBackgrounds: ["string"],
          commonReasonsCandidatesFail: ["string"],
          transferableBackgrounds: ["string"]
        },
        candidatePersonaObj: {
          yearsOfExperience: "string",
          industryBackground: "string",
          functionalBackground: "string",
          languageRequirements: "string",
          personalityTraits: ["string"]
        },
        talentMarketInsight: {
          talentPoolDifficulty: "string",
          hiringChallenges: ["string"],
          counterOfferRisk: "string",
          salaryCompetitiveness: "string",
          noticePeriodRisk: "string"
        },
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
    2. 'matchedJobId': If this is an update, feedback, or additional information for an existing job from the list above, you MUST set this to the exact ID of that matched job (e.g. "j1"). Otherwise (if it is a brand new job or doesn't match any existing job ID), you MUST set this field to the exact string "null" (Do NOT output literal JSON null, do NOT output long text with thinking, explanations, or excuses, just output the string "null" or the exact matching ID!).
    3. 'timelineSummary': A string summarizing what happened in this input to add to the timeline.
    4. 'clientUpdates': A structured object with any new information about the client:
       - culture (string)
       - overview (string)
       - industry (string)
       - keyInfo (array of strings)
    5. 'jobData': If 'hasNewJob' is true, generate a comprehensive object containing all fields matching the schema above.
       
       ==================================================
       LANGUAGE & STYLE INSTRUCTIONS
       ==================================================
       The primary language of the report MUST be Vietnamese, but you should naturally combine it with English terminology where standard in the recruitment industry in Vietnam (e.g., job titles, technical terms, specific skill sets, certifications, or framework names like "Must Have", "Nice to Have", "Core skills", "Good English", "Hands-on experience", etc.).
       - Rewrite information in natural, professional recruitment-focused Vietnamese combined with appropriate English terms.
       - Never write purely rigid, dry English translations. Make it sound like an elite Vietnamese Senior Recruitment Consultant talking to their colleagues or client.
       - Bullet points, summaries, and descriptions should be punchy, clear, and action-oriented.

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
       IMPORTANT (CRITICAL: DO NOT use parenthetical annotations or labels like '(Fact: ...)' or '(Inference: ...)' in any section. Present all insights naturally and fluidly in Vietnamese recruitment consultant prose without repetitive meta-labeling. Repetitive labeling causes infinite loops.)
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
        matchedJobId: { type: Type.STRING, description: "ID of the matched existing job, or the exact string 'null' if it is a brand new job" },
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

// API route for Step 1: Company Research
app.post("/api/freecai/step1-company-research", async (req, res) => {
  console.log("Processing /api/freecai/step1-company-research...");
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

    const { clientName, customPrompt } = req.body;

    if (!clientName) {
      return res.status(400).json({ error: "Missing clientName" });
    }

    const promptTemplate = customPrompt && customPrompt.trim() ? customPrompt : `Bạn là một chuyên gia nghiên cứu thị trường và Chuyên viên Tư vấn Tuyển dụng Cấp cao.
Nhiệm vụ của bạn là nghiên cứu và xây dựng một Báo cáo Trí tuệ Công ty (Company Intelligence Report) chi tiết cho khách hàng sau:

Tên công ty khách hàng: \${currentClientName}

Hãy thu thập, phân tích và tổng hợp các thông tin cốt lõi sau dưới dạng Markdown trôi chảy, chuyên nghiệp bằng tiếng Việt:
1. Tổng quan về mô hình kinh doanh, sản phẩm/dịch vụ cốt lõi, và vị thế trong ngành.
2. Văn hóa doanh nghiệp, phong cách làm việc và môi trường công sở dự kiến.
3. Các tin tức nổi bật, công nghệ sử dụng, cấu trúc tổ chức chính (nếu có).
4. Các từ khóa thông tin quan trọng nhất cần ghi nhớ khi làm việc với đối tác này.

Chú ý: Hãy đưa ra các phân tích có giá trị thực chiến cho tuyển dụng. Tránh bịa đặt số liệu không có thật. Viết rõ ràng bằng Markdown.`;

    const finalPrompt = promptTemplate.replace(/\$\{currentClientName\}/g, clientName);

    console.log(`Step 1: Running Company Research for ${clientName} using model ${model || "default"}`);
    
    const companyReport = await callLLM({
      provider,
      apiKey,
      model,
      customEndpoint,
      prompt: finalPrompt,
    });

    res.json({ companyReport });
  } catch (error) {
    console.error("LLM Step 1 Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

// API route for Step 2: Recruitment Intelligence (Streaming Markdown)
app.post("/api/freecai/step2-recruitment-intelligence", async (req, res) => {
  console.log("Processing /api/freecai/step2-recruitment-intelligence...");
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

    const { companyReport, jobDescription, customPrompt } = req.body;

    if (!companyReport || !jobDescription) {
      return res.status(400).json({ error: "Missing companyReport or jobDescription" });
    }

    const promptTemplate = customPrompt && customPrompt.trim() ? customPrompt : `Bạn là một Senior Headhunter và Recruitment Consultant với hơn 15 năm kinh nghiệm tại Việt Nam và APAC.
Nhiệm vụ của bạn là phân tích Bản mô tả công việc (Job Description) kết hợp với Báo cáo Trí tuệ Công ty (Company Intelligence Report) để tạo ra một Báo cáo Trí tuệ Tuyển dụng (Recruitment Intelligence Report) toàn diện, sắc bén và thực chiến bằng tiếng Việt.

Thông tin Công ty (Company Intelligence Report):
"""
\${companyReport}
"""

Bản mô tả công việc (Job Description):
"""
\${jobDescription}
"""

Hãy tạo một báo cáo tuyển dụng toàn diện dưới dạng Markdown, cấu trúc chuyên nghiệp, phân tích sâu sắc các khái niệm sau:
1. Tổng quan vị trí (Role Overview): Tên vị trí, Phòng ban, Cấp trên trực tiếp, Khoảng lương dự kiến, Địa điểm làm việc.
2. Bối cảnh Công ty (Company Context) & Văn hóa phù hợp.
3. Chân dung ứng viên lý tưởng (Ideal Persona): Kinh nghiệm, ngành nghề, kỹ năng cứng bắt buộc (Must-have), kỹ năng ưu tiên (Nice-to-have), đặc điểm tính cách.
4. Trí tuệ Vị trí (Position Intelligence): Bản chất công việc, thách thức thực tế hàng ngày, kỳ vọng ẩn giấu từ nhà tuyển dụng, các yếu tố quyết định thành công của ứng viên.
5. Thấu hiểu Thị trường Tài năng (Talent Market Insight): Độ khó của nguồn cung, rủi ro counter-offer, tính cạnh tranh của mức lương, rủi ro notice period.
6. Chiến lược tuyển dụng & Sourcing (Recruitment Strategy): Sourcing channels, các công ty mục tiêu để target ứng viên trước tiên, phương án xử lý thách thức.
7. Công cụ tìm kiếm (Boolean Search Queries): Viết sẵn các mẫu câu lệnh tìm kiếm thực chiến ngắn gọn cho LinkedIn Recruiter, CV Database, X-Ray Search, và các bộ lọc theo ngành.
8. Gợi ý bài đăng tuyển dụng thu hút (Social Post / JD tóm tắt) & Bộ câu hỏi phỏng vấn gợi ý cho Consultant (Interview Questions / Questions for Client).

LƯU Ý QUAN TRỌNG:
- Trình bày toàn bộ báo cáo bằng định dạng Markdown đẹp mắt, có tiêu đề (Headings), danh sách (Bullet points), bảng biểu hoặc định dạng đậm nhạt rõ ràng.
- KHÔNG trả về định dạng JSON hay bất cứ thông tin thừa nào khác ngoài nội dung Markdown.
- Sử dụng ngôn phong tự nhiên, sắc bén, mang tính tư vấn cao của một Senior Consultant thực thụ.`;

    const finalPrompt = promptTemplate
      .replace(/\$\{companyReport\}/g, companyReport)
      .replace(/\$\{jobDescription\}/g, jobDescription);

    console.log(`Step 2: Generating Recruitment Intelligence Report using model ${model || "default"}`);

    const stream = callLLMStream({
      provider,
      apiKey,
      model,
      customEndpoint,
      prompt: finalPrompt,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error("LLM Step 2 Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
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
