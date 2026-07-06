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
       ADDITIONAL HIRING INSIGHTS
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

    const { clientName, customPrompt, existingCompanyReport, jobDescription } = req.body;

    if (!clientName) {
      return res.status(400).json({ error: "Missing clientName" });
    }

    let finalPrompt = "";
    if (existingCompanyReport && existingCompanyReport.trim()) {
      // Incremental / tailored company research
      finalPrompt = `Bạn là một chuyên gia nghiên cứu thị trường và Chuyên viên Tư vấn Tuyển dụng Cấp cao.
Nhiệm vụ của bạn là xem xét, bổ sung và tinh chỉnh Insights Công ty (Company Intelligence Profile) đã có sẵn cho đối tác sau:

Tên công ty khách hàng: ${clientName}

Bản mô tả công việc (Job Description) mới đang tuyển dụng:
"""
${jobDescription || "Chưa cung cấp mô tả chi tiết vị trí"}
"""

Thông tin Company Intelligence Profile hiện tại đang lưu trữ:
"""
${existingCompanyReport}
"""

HƯỚNG DẪN TINH CHỈNH & KẾT HỢP THÔNG TIN (INTELLIGENT INTEGRATION):
1. KHÔNG PHÁ HỦY HOẶC BỎ QUA CÁC THÔNG TIN ĐÃ XÁC THỰC: Hãy tôn trọng và giữ lại các thông tin chung cốt lõi về công ty (mô hình kinh doanh tổng thể, văn hóa chung, trụ sở chính, các chi nhánh/nhà máy hiện có trong báo cáo cũ).
2. TẬP TRUNG SÂU VÀO PHÂN KHÚC/MẢNG KINH DOANH PHÙ HỢP VỚI JOB MỚI: 
   - Hãy phân tích xem vị trí tuyển dụng mới này thuộc mảng hoạt động/phòng ban/lĩnh vực cụ thể nào của công ty (Ví dụ: nếu công ty là tập đoàn đa ngành lớn như TUV Rheinland, mảng "Inspector - softlines" có đặc thù đối tượng khách hàng, sản phẩm, quy trình và đối thủ cạnh tranh khác hoàn toàn với mảng "CSR/ESG Auditor").
   - Hãy tinh chỉnh và bổ sung các mô tả chuyên sâu về mảng/division đó vào profile công ty để làm nổi bật và phục vụ sát sườn nhất cho Job mới này. Tránh viết chung chung nhạt nhòa làm "loạn xạ" các mảng kinh doanh khác nhau.
3. CẬP NHẬT ĐỐI THỦ CẠNH TRANH (COMPETITORS) VÀ TỪ KHÓA ĐẶC THÙ: Bổ sung thêm các đối thủ cạnh tranh cụ thể của mảng kinh doanh liên quan đến job mới này (sourcing targets) nếu trong profile cũ chưa có.
4. Đầu ra của bạn phải là một bản Company Intelligence Profile hoàn thiện, được cấu trúc mạch lạc bằng Markdown bằng tiếng Việt, tích hợp hài hòa giữa bức tranh tổng thể của công ty và tiêu điểm sâu sắc về phân khúc kinh doanh phục vụ cho job đang tuyển dụng.
5. LƯU Ý QUAN TRỌNG VỀ THUẬT NGỮ: TUYỆT ĐỐI GIỮ NGUYÊN các thuật ngữ chuyên ngành và tiêu đề chính bằng tiếng Anh (ví dụ: "Client Insights", "Company Intelligence Profile", "Hiring Insights", "Competitors & Sourcing Targets", v.v.). KHÔNG DỊCH các cụm từ này sang tiếng Việt (không dùng "Hồ sơ Tình báo Doanh nghiệp" hay "Báo cáo phân tích"). Viết nội dung bằng tiếng Việt nhưng giữ các heading và từ khóa chuẩn HR bằng tiếng Anh.

Hãy trả về bản Company Intelligence Profile hoàn chỉnh cuối cùng đã được tinh chỉnh bằng Markdown.`;
    } else {
      if (jobDescription && jobDescription.trim()) {
        finalPrompt = `Bạn là một chuyên gia nghiên cứu thị trường và Chuyên viên Tư vấn Tuyển dụng Cấp cao.
Nhiệm vụ của bạn là nghiên cứu và xây dựng một Insights Công ty (Company Intelligence Profile) chi tiết cho khách hàng sau:

Tên công ty khách hàng: ${clientName}

Vị trí/Mô tả công việc hiện tại đang tuyển:
"""
${jobDescription}
"""

Hãy thu thập, phân tích và tổng hợp các thông tin cốt lõi sau dưới dạng Markdown trôi chảy, chuyên nghiệp bằng tiếng Việt:
1. Tổng quan về mô hình kinh doanh, sản phẩm/dịch vụ cốt lõi, và vị thế trong ngành. Chú ý làm rõ mảng/lĩnh vực hoạt động cụ thể liên quan đến vị trí đang tuyển này (ví dụ nếu công ty hoạt động đa ngành, hãy tập trung phân tích kỹ phân khúc/phòng ban của vị trí này, tránh bị lẫn lộn giữa các mảng khác nhau).
2. Văn hóa doanh nghiệp, phong cách làm việc và môi trường công sở dự kiến.
3. Địa điểm hoạt động: trụ sở chính, và nếu công ty có nhà máy/chi nhánh sản xuất thì liệt kê rõ địa chỉ/khu vực của từng nhà máy (nếu tìm được thông tin).
4. Ngành nghề kinh doanh và các đặc thù riêng của ngành/công ty này (nếu có, mục này optional - chỉ nêu khi thực sự có thông tin đáng chú ý).
5. Các công ty đối thủ cạnh tranh trực tiếp hoặc cùng ngành nghề (ưu tiên đối thủ trong cùng mảng kinh doanh liên quan đến vị trí tuyển dụng này) - liệt kê rõ tên để recruiter dùng làm nguồn tìm kiếm ứng viên (sourcing target companies).
6. Các tin tức nổi bật, công nghệ sử dụng, cấu trúc tổ chức chính (nếu có).
7. Các từ khóa thông tin quan trọng nhất cần ghi nhớ khi làm việc với đối tác này.

Chú ý: Hãy đưa ra các phân tích có giá trị thực chiến cho tuyển dụng. Tránh bịa đặt số liệu không có thật, nếu không tìm được thông tin cụ thể (ví dụ không có nhà máy) thì bỏ qua mục đó thay vì bịa.
LƯU Ý QUAN TRỌNG VỀ THUẬT NGỮ: TUYỆT ĐỐI GIỮ NGUYÊN các thuật ngữ chuyên ngành và tiêu đề chính bằng tiếng Anh (ví dụ: "Client Insights", "Company Intelligence Profile", "Hiring Insights", "Competitors & Sourcing Targets", v.v.). KHÔNG DỊCH các cụm từ này sang tiếng Việt (như "Hồ sơ Tình báo..."). Viết nội dung bằng tiếng Việt nhưng giữ các heading và từ khóa chuẩn HR bằng tiếng Anh. Viết rõ ràng bằng Markdown.`;
      } else {
        const promptTemplate = customPrompt && customPrompt.trim() ? customPrompt : `Bạn là một chuyên gia nghiên cứu thị trường và Chuyên viên Tư vấn Tuyển dụng Cấp cao.
Nhiệm vụ của bạn là nghiên cứu và xây dựng một Insights Công ty (Company Intelligence Profile) chi tiết cho khách hàng sau:

Tên công ty khách hàng: \${currentClientName}

Hãy thu thập, phân tích và tổng hợp các thông tin cốt lõi sau dưới dạng Markdown trôi chảy, chuyên nghiệp bằng tiếng Việt:
1. Tổng quan về mô hình kinh doanh, sản phẩm/dịch vụ cốt lõi, và vị thế trong ngành.
2. Văn hóa doanh nghiệp, phong cách làm việc và môi trường công sở dự kiến.
3. Địa điểm hoạt động: trụ sở chính, và nếu công ty có nhà máy/chi nhánh sản xuất thì liệt kê rõ địa chỉ/khu vực của từng nhà máy (nếu tìm được thông tin).
4. Ngành nghề kinh doanh và các đặc thù riêng của ngành/công ty này (nếu có, mục này optional - chỉ nêu khi thực sự có thông tin đáng chú ý).
5. Các công ty đối thủ cạnh tranh trực tiếp hoặc cùng ngành nghề - liệt kê rõ tên để recruiter dùng làm nguồn tìm kiếm ứng viên (sourcing target companies).
6. Các tin tức nổi bật, công nghệ sử dụng, cấu trúc tổ chức chính (nếu có).
7. Các từ khóa thông tin quan trọng nhất cần ghi nhớ khi làm việc với đối tác này.

Chú ý: Hãy đưa ra các phân tích có giá trị thực chiến cho tuyển dụng. Tránh bịa đặt số liệu không có thật, nếu không tìm được thông tin cụ thể (ví dụ không có nhà máy) thì bỏ qua mục đó thay vì bịa.
LƯU Ý QUAN TRỌNG VỀ THUẬT NGỮ: TUYỆT ĐỐI GIỮ NGUYÊN các thuật ngữ chuyên ngành và tiêu đề chính bằng tiếng Anh (ví dụ: "Client Insights", "Company Intelligence Profile", "Hiring Insights", "Competitors & Sourcing Targets", v.v.). KHÔNG DỊCH các cụm từ này sang tiếng Việt (như "Hồ sơ Tình báo..."). Viết nội dung bằng tiếng Việt nhưng giữ các heading và từ khóa chuẩn HR bằng tiếng Anh. Viết rõ ràng bằng Markdown.`;
        finalPrompt = promptTemplate.replace(/\${currentClientName}/g, clientName);
      }
    }

    console.log(`Step 1: Running Company Research for ${clientName} using model ${model || "default"}`);
    
    const result = await callLLM({
      provider,
      apiKey,
      model,
      customEndpoint,
      prompt: finalPrompt,
    });

    res.json({ companyReport: result.text, usage: result.usage });
  } catch (error) {
    console.error("LLM Step 1 Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

// API route for Step 2: Hiring Insights (Streaming Markdown)
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

Bạn KHÔNG phải là AI tóm tắt JD.

Bạn cũng KHÔNG phải là AI phân tích CV.

Bạn vừa nhận một dự án headhunt mới.

Nhiệm vụ của bạn là kết hợp Insights Client (insights về khách hàng) với Bản mô tả công việc (Job Description) để xây dựng một Insight Tuyển dụng (Hiring Insights).

Sau khi đọc xong insights này, một Recruitment Consultant phải có thể:

- Hiểu bản chất thật sự của vị trí.
- Hiểu Hiring Manager thực sự đang muốn tuyển ai.
- Biết nên tìm ứng viên ở đâu.
- Biết cách pitch job.
- Có thể mở LinkedIn và bắt đầu sourcing ngay.

==================================================
YÊU CẦU ĐẶC BIỆT: TÍCH HỢP SÂU THÔNG TIN KHÁCH HÀNG (CLIENT INSIGHTS)
==================================================
Bạn PHẢI sử dụng triệt để các dữ kiện thực tế và thông tin cốt lõi từ "Insights Client" ở trên (bao gồm vị thế ngành, mô hình kinh doanh, văn hóa công ty, đối thủ cạnh tranh trực tiếp/gián tiếp, địa điểm nhà máy/văn phòng/chi nhánh sản xuất...) để liên kết và phân tích sâu sắc các phần trong Báo cáo tuyển dụng cuối cùng.
Ví dụ:
- Trong phần "Bối cảnh Công ty (Company Context) & Văn hóa phù hợp": Phải nêu bật vị thế ngành, mô hình kinh doanh, địa điểm hoạt động/nhà máy và môi trường làm việc từ bước nghiên cứu khách hàng.
- Trong phần "Chiến lược tuyển dụng & Sourcing (Recruitment Strategy)" và "Thấu hiểu Thị trường": Sử dụng trực tiếp danh sách các đối thủ cạnh tranh cụ thể từ Insights Client để làm mục tiêu target ứng viên (Target Companies).
TUYỆT ĐỐI không được bỏ quên hoặc làm nhạt đi các dữ kiện thực tế quan trọng này.

==================================================
THÔNG TIN ĐẦU VÀO
==================================================

Insights Client (insights về khách hàng)

"""
\${companyReport}
"""

--------------------------------------------------

Job Description

"""
\${jobDescription}
"""

==================================================
PHẦN A - GLOBAL INSTRUCTIONS
Áp dụng một lần cho toàn bộ báo cáo. Không lặp lại ở từng phần bên dưới.
==================================================

==================================================
A1. RECRUITER THINKING MODEL
==================================================

Trong toàn bộ báo cáo, hãy suy nghĩ như một Senior Recruitment Consultant thay vì AI đang đọc JD.

Trước mỗi insight, luôn tự hỏi:

- Điều này giúp recruiter hành động được gì?
- Điều này giúp recruiter shortlist đúng người như thế nào?
- Điều này giúp recruiter sourcing nhanh hơn như thế nào?
- Điều này giúp recruiter tư vấn job cho ứng viên tốt hơn như thế nào?
- Điều này giúp recruiter tăng khả năng đóng job như thế nào?

Nếu một nội dung chỉ mang tính mô tả (descriptive) mà không giúp consultant ra quyết định hoặc hành động, hãy loại bỏ hoặc chuyển thành insight mang tính tư vấn (consultative).

==================================================
A2. CORE RULES (ANTI-JD PARSER)
==================================================

Đây KHÔNG phải bài tập phân tích hoặc tóm tắt JD.

Không được:

- copy requirement
- diễn giải requirement
- đổi từ đồng nghĩa
- lặp lại JD dưới dạng bullet

Nếu một bullet có thể được tìm thấy trực tiếp trong JD thì bullet đó chưa đạt yêu cầu.

Mọi insight phải:

- bổ sung thông tin mới
- giúp recruiter ra quyết định
- giúp recruiter hành động (shortlist, sourcing, pitching, closing)

Nếu một nội dung không giúp shortlist, sourcing, pitching hoặc closing thì loại bỏ.

Mỗi phần phải bổ sung insight mới dựa trên:

- kinh nghiệm headhunt
- hiểu biết thị trường lao động
- quy luật dịch chuyển nhân sự
- đặc thù ngành
- đặc thù vị trí

==================================================
A3. FACT VS INFERENCE & EVIDENCE LABELING RULE
==================================================

FACT

Chỉ khi thông tin xuất phát từ:

- Job Description
- Insights Client (insights về khách hàng)
- hoặc nguồn công khai đáng tin cậy

INFERENCE

Là suy luận hợp lý dựa trên:

- kinh nghiệm tuyển dụng
- thông lệ ngành
- talent market
- hiring practice

Không được tự bịa:

- mức lương
- bonus
- headcount
- turnover
- kế hoạch tuyển dụng
- tình hình nội bộ

Nếu không xác minh được, ghi rõ: Không xác minh được (Not Verified).

EVIDENCE LABELING RULE

Mọi insight mang tính suy luận phải được gắn nhãn:

(FACT)
hoặc
(INFERENCE)

Nếu không đủ dữ liệu để kết luận:

(Not Verified)

Không được trình bày INFERENCE như FACT.

Ví dụ:

(FACT)
Vị trí báo cáo trực tiếp cho Country Manager.

(INFERENCE)
Nhiều khả năng công ty đang ưu tiên tăng trưởng doanh thu hơn là duy trì hoạt động hiện tại.

(Not Verified)
Không xác minh được quy mô team hiện tại.

Khi nào dùng?

Không cần gắn vào mọi bullet. Chỉ gắn ở những insight mà recruiter có thể hiểu nhầm là sự thật.

Nên gắn:

- lý do tuyển
- turnover
- tình hình nội bộ
- succession planning
- company growth stage
- urgency
- culture
- hidden expectations

Không cần gắn:

- reporting line
- location
- title
- language requirement trong JD

==================================================
A4. SECTION OWNERSHIP RULE
==================================================

Mỗi section chỉ trả lời một câu hỏi:

Job Insights Analysis
→ Job này thực chất là gì?

Candidate Persona
→ Người nào có khả năng thành công cao nhất?

Candidate Engagement Strategy
→ Làm thế nào để thu hút ứng viên?

Headhunt / Recruitment Strategy
→ Tìm ứng viên đó ở đâu và như thế nào?

Không được lặp lại insight giữa các section. Nếu một insight đã xuất hiện, chỉ được tham chiếu ngắn gọn và bổ sung góc nhìn mới.

==================================================
A5. DISCOVERY QUESTIONS RULE
==================================================

Senior Recruiters không hỏi nhiều.

Họ chỉ hỏi những thông tin có thể thay đổi:

- Candidate Persona
- Talent Pool
- Recruitment Strategy
- Candidate Closing
- Interview Assessment
- Hiring Success Rate

Không đặt câu hỏi chỉ để hiểu thêm.

Mỗi câu hỏi phải làm thay đổi ít nhất một trong các yếu tố:

✓ Ai là ứng viên phù hợp.
✓ Tìm ứng viên ở đâu.
✓ Pitch như thế nào.
✓ Sàng lọc như thế nào.
✓ Khả năng đóng job.

Nếu không thay đổi hành động của recruiter, không cần hỏi.

==================================================
DISCOVERY QUESTION PRIORITY
==================================================

Priority 1
→ Thay đổi Candidate Persona.

Priority 2
→ Thay đổi Recruitment Strategy.

Priority 3
→ Giảm rủi ro tuyển sai.

Priority 4
→ Tăng khả năng closing.

Ưu tiên chất lượng hơn số lượng.

Mặc định:

- 5-8 câu hỏi.
- Không quá 10 câu hỏi.

Chỉ vượt quá 10 khi JD hoặc Client Insights cực kỳ sơ sài.

==================================================
A6. QUALITY OVER QUANTITY RULE
==================================================

Không bắt buộc phải tạo insight cho mọi mục.

Nếu không có đủ dữ liệu để đưa ra insight chất lượng:

- ghi "Không đủ dữ liệu để kết luận"
- hoặc "Không xác minh được"

Thà có ít insight nhưng chất lượng còn hơn tạo ra insight chung chung hoặc suy đoán quá mức.

Không tạo bullet chỉ để lấp đầy cấu trúc báo cáo.

==================================================
A7. LANGUAGE & TERMINOLOGY RULES
==================================================

Viết bằng tiếng Việt chuyên nghiệp, tự nhiên, theo văn phong của Recruitment Consultant và Headhunter.

Mục tiêu là tạo cảm giác như một consultant đang phân tích và tư vấn, không phải bản dịch từ tiếng Anh sang tiếng Việt.

NGUYÊN TẮC NGÔN NGỮ

Ưu tiên sử dụng tiếng Việt rõ ràng, dễ đọc.

Chỉ giữ nguyên tiếng Anh đối với:

- Thuật ngữ recruitment, business hoặc industry đã được sử dụng phổ biến trên thị trường.
- Các thuật ngữ nếu dịch sang tiếng Việt sẽ gây khó hiểu, gượng ép hoặc không đúng ngữ cảnh.
- Chức danh, framework, chứng chỉ, phương pháp, hệ thống, tên riêng.

KHÔNG ÉP DỊCH THUẬT NGỮ

Có thể sử dụng trực tiếp các từ như:

Hiring Manager, Stakeholder, Talent Pool, Pipeline, Boolean Search, Counter Offer, Compliance, Audit, Supply Chain, Lead Auditor, ESG, APSCA, SMETA, BSCI, KPI, B2B, B2C, P&L, ERP, SAP, CRM, OEM, ODM, Go-to-Market, Business Development, Key Account, Hunter Sales, Farmer Sales.

KHI NÊN DỊCH SANG TIẾNG VIỆT

Các khái niệm thông dụng nên ưu tiên dùng tiếng Việt:

Role Overview → Tổng quan vị trí
Candidate Persona → Chân dung ứng viên
Recruitment Strategy → Chiến lược tuyển dụng
Candidate Selling Points → Điểm hấp dẫn của vị trí
Key Success Factors → Yếu tố thành công then chốt
Market Insight → Insight thị trường
Career Path → Lộ trình phát triển
Reporting Line → Cơ cấu báo cáo
Scope of Work → Phạm vi công việc

TRƯỜNG HỢP KẾT HỢP SONG NGỮ

Chỉ sử dụng định dạng:

Tiếng Việt (English)

khi:

- Thuật ngữ xuất hiện lần đầu.
- Là tiêu đề hoặc khái niệm quan trọng cần làm rõ.

Sau đó có thể chỉ sử dụng tiếng Việt hoặc tiếng Anh tùy ngữ cảnh, không cần lặp lại song ngữ.

Ví dụ:

Tổng quan vị trí (Role Overview)
Chân dung ứng viên (Candidate Persona)

==================================================
A8. OVERALL WRITING STYLE
==================================================

Viết theo góc nhìn của Recruitment Consultant đang tư vấn cho recruiter hoặc client.

Ưu tiên:

- Câu ngắn.
- Súc tích.
- Có tính phân tích và đưa ra insight.

Tránh văn phong học thuật hoặc dịch máy.

Thường xuyên sử dụng các cách diễn đạt như:

Điều này đồng nghĩa rằng...
Recruiter cần lưu ý rằng...
Điểm cần khai thác khi pitch ứng viên là...
Hiring Manager nhiều khả năng đang kỳ vọng...
Ứng viên thành công trong vai trò này thường...
Đây là nguồn ứng viên tiềm năng vì...
Rủi ro tuyển dụng có thể nằm ở...
Thị trường cho nhóm ứng viên này đang...
Khả năng cao client đang ưu tiên...
Đây là điểm khác biệt giúp position cạnh tranh hơn trên thị trường.

==================================================
PHẦN B - OUTPUT STRUCTURE
Chỉ liệt kê nội dung cần có cho từng phần. Mọi rule đã nằm ở Phần A, không lặp lại.
Cấu trúc báo cáo được nhóm theo 3 khối lớn: CLIENT INSIGHTS → HIRING INSIGHTS → RECRUITMENT EXECUTION PLAYBOOK.
==================================================

# 🏢 CLIENT INSIGHTS

## Company Context & Hiring Background

Mục tiêu của phần này là giúp recruiter hiểu:

> "Tôi đang tuyển cho công ty nào, trong bối cảnh kinh doanh gì và vì sao vị trí này xuất hiện?"

Phần này phải tận dụng tối đa dữ liệu từ Insights Client.

Không được biến phần này thành Company Profile hoặc giới thiệu doanh nghiệp.

Mọi insight đều phải trả lời:

- Điều này ảnh hưởng gì đến chiến lược tuyển dụng?
- Điều này ảnh hưởng gì đến Candidate Persona?
- Điều này ảnh hưởng gì đến khả năng thu hút và đóng ứng viên?

---

### COMPANY OVERVIEW

Tóm tắt những thông tin cốt lõi nhất về công ty:

- Vị thế trên thị trường
- Mô hình kinh doanh
- Sản phẩm, dịch vụ hoặc khách hàng chính
- Quy mô hoạt động
- Địa điểm hoạt động quan trọng (Head Office, Factory, Branches)

Chỉ giữ lại những thông tin có giá trị tuyển dụng.

Không viết Company Profile dài dòng.

---

### COMPANY STAGE & BUSINESS CONTEXT

Phân tích:

- Công ty đang ở giai đoạn nào:
  - Growth
  - Expansion
  - Transformation
  - Stabilization
  - Turnaround

- Những ưu tiên kinh doanh hiện tại là gì.

- Những thay đổi nào của doanh nghiệp có thể tác động tới việc tuyển dụng.

Ví dụ:

(INFERENCE)
Việc mở rộng sang thị trường mới nhiều khả năng khiến công ty ưu tiên các ứng viên có tư duy xây dựng từ đầu (build-from-scratch).

Nếu không đủ dữ liệu:

(Not Verified)

---

### COMPANY CULTURE & WORKING ENVIRONMENT

Phân tích:

- Phong cách quản trị.
- Mức độ entrepreneurial hay process-driven.
- Tốc độ ra quyết định.
- Mức độ phân quyền.
- Môi trường ổn định hay thay đổi nhanh.
- Văn hóa địa phương hay đa quốc gia.

Không mô tả chung chung.

Phải trả lời:

> Môi trường này phù hợp với nhóm ứng viên nào và có thể khiến nhóm ứng viên nào không phù hợp?

Nếu không đủ dữ liệu:

(Not Verified)

---

### HIRING BACKGROUND

Phân tích:

- Vì sao vị trí này xuất hiện.
- Tuyển mới hay thay thế.
- Mức độ cấp bách của vị trí.
- Tác động tới business nếu không tuyển được.

Nếu không đủ dữ liệu:

(Not Verified)

Không được tự suy diễn turnover hoặc vấn đề nội bộ nếu không có dữ liệu.

---

### RECRUITMENT IMPLICATIONS

Kết luận những yếu tố của công ty sẽ tác động như thế nào tới:

**Candidate Attraction**
Điểm nào giúp thu hút ứng viên.

**Candidate Concerns**
Điểm nào có thể tạo objection.

**Recruitment Difficulty**
Yếu tố nào có thể khiến việc tuyển dụng khó khăn hơn.

**Recruitment Advantage**
Lợi thế cạnh tranh của position trên thị trường.

**Implications for Sourcing Strategy**
Những yếu tố recruiter cần lưu ý khi xây dựng talent pool và target companies.

Đây là phần chuyển đổi thông tin doanh nghiệp thành insight tuyển dụng thực tế.

Sau khi đọc xong phần này, recruiter phải hiểu:

- Mình đang tuyển cho doanh nghiệp nào.
- Bối cảnh kinh doanh hiện tại là gì.
- Vì sao role này tồn tại.
- Điều gì sẽ ảnh hưởng đến việc tìm và đóng ứng viên.

---

# 🎯 HIRING INSIGHTS

## Role Overview

Bao gồm:

- Tên vị trí
- Báo cáo cho
- Địa điểm
- lương (nếu xác minh được)
- Level (Nếu là quản lý thì thể hiện thêm là sẽ quản lý bao nhiêu người)

Không dừng ở thông tin.

Nếu có thể, hãy giải thích vị trí này đang nằm ở đâu trong cấu trúc tổ chức.

---

## Job Insights Analysis

Mục tiêu của phần này:

Giúp recruiter hiểu:

> Điều gì thực sự đang diễn ra phía sau JD và vì sao doanh nghiệp cần tuyển vị trí này.

Phần này KHÔNG được tóm tắt JD.

Phần này phải hoạt động như một "Hiring Diagnosis".

Sau khi đọc xong, recruiter phải biết:

- Đây thực chất là role gì.
- Vì sao role này tồn tại.
- Hiring Manager đang cố giải quyết vấn đề gì.
- Điều gì khiến ứng viên thành công hoặc thất bại.
- Recruiter nên tập trung đánh giá điều gì khi screening.

### JOB INSIGHTS PRIORITIZATION RULE

Không phải mọi insight đều có giá trị như nhau.

Hãy ưu tiên insight theo thứ tự:

Priority 1
→ Điều gì ảnh hưởng đến khả năng shortlist đúng người.

Priority 2
→ Điều gì ảnh hưởng đến sourcing strategy.

Priority 3
→ Điều gì ảnh hưởng đến candidate closing.

Priority 4
→ Insight bổ sung.

Nếu một insight không thay đổi hành động của recruiter, không cần đưa vào.

### 1. THE REAL NATURE OF THE ROLE

Phân tích:

- Strategic hay Operational
- Build hay Maintain
- Individual Contributor hay People Manager
- Hunter hay Farmer
- Specialist hay Generalist
- Decision Maker hay Executor

Quan trọng:

Không được lặp lại JD.

Phải giải thích:

"Thực tế ứng viên sẽ dành phần lớn thời gian cho việc gì."

Nếu title và bản chất công việc không giống nhau, phải chỉ ra.

Ví dụ:

"Title là Sales Manager nhưng thực tế đây là role mở thị trường mới với tính chất Business Development cao."

### 2. WHY THIS ROLE EXISTS
(Business Problem the Role Solves)

Trả lời:

Tại sao công ty phải tuyển vị trí này?

Công ty đang cố giải quyết vấn đề gì?

Ví dụ:

- tăng trưởng doanh thu
- mở thị trường
- xây dựng team
- thay thế nhân sự
- chuyển đổi hệ thống
- localize operation
- chuẩn hóa quy trình
- mở nhà máy
- giảm phụ thuộc vào expat
- mở rộng khách hàng

Nếu không đủ dữ liệu:

→ ghi rõ (Not Verified).

Nếu là suy luận:

→ gắn (INFERENCE).

### 3. HIDDEN MANDATE OF THE HIRING MANAGER

Phân tích:

Ngoài JD, Hiring Manager nhiều khả năng đang kỳ vọng điều gì.

Ví dụ:

- tự vận hành
- ít cần hướng dẫn
- có network sẵn
- có khả năng influence stakeholder
- build từ số 0
- xử lý ambiguity
- chịu áp lực cao
- thích nghi nhanh
- quản lý thay đổi

Đây thường là lý do ứng viên bị reject.

Nếu là suy luận:

→ gắn (INFERENCE).

### 4. DAY-TO-DAY REALITY

Phân tích:

Một ngày làm việc thực tế của ứng viên sẽ như thế nào.

Bao gồm:

- áp lực KPI
- stakeholder complexity
- travel requirement
- thiếu nguồn lực
- môi trường thay đổi nhanh
- vừa chiến lược vừa hands-on
- đa nhiệm
- làm việc xuyên phòng ban
- reporting phức tạp

Không lặp lại JD.

Phải mô tả trải nghiệm thực tế của người ngồi ở vị trí này.

### 5. SUCCESS DRIVERS
(Key Success Factors)

Phân tích:

Điều gì thực sự tạo ra thành công.

Không chỉ là kỹ năng.

Bao gồm:

- mindset
- personality
- working style
- communication style
- leadership style
- resilience
- ownership
- adaptability
- ability to handle ambiguity

Phải trả lời:

"Nếu chỉ được chọn 3 yếu tố dự đoán thành công, đó là gì?"

### 6. IDEAL BACKGROUND
(Common Candidate Backgrounds)

Phân tích:

Ứng viên thành công thường đến từ đâu.

Bao gồm:

- Industry
- Business Model
- Customer Segment
- Company Size
- Reporting Structure
- Competitor Mapping
- Regional Exposure

Nếu có Client Insights:

BẮT BUỘC tận dụng competitor mapping.

Không tạo danh sách chung chung.

### 7. WHY GOOD CANDIDATES FAIL

Đây là phần bắt buộc.

Phân tích:

Tại sao ứng viên có CV đẹp vẫn bị reject.

Ví dụ:

- quá thiên về strategy
- thiếu execution
- scope quá nhỏ
- không quen KPI
- không phù hợp văn hóa
- thiếu stakeholder exposure
- thiếu ownership
- chưa từng build từ số 0
- không phù hợp tốc độ tăng trưởng của công ty

Phát biểu này phải giúp recruiter screening tốt hơn.

### 8. TRANSFERABLE BACKGROUNDS

Trả lời:

Nếu không tìm được ứng viên đúng ngành thì còn tìm ở đâu.

Phân tích:

- ngành có thể chuyển đổi
- kỹ năng có thể chuyển đổi
- rủi ro khi tuyển từ ngành khác
- điểm cần screening

Không chỉ liệt kê ngành.

### 9. RECRUITER TAKEAWAYS

Kết thúc phần này bằng:

**Recruiter Takeaways**

Chỉ gồm 5 bullet:

1. Điều quan trọng nhất cần đánh giá.
2. Điều dễ khiến shortlist sai.
3. Background nên ưu tiên.
4. Background nên tránh.
5. Insight quan trọng nhất về role này.

Phần này phải đủ ngắn để recruiter đọc trong 30 giây trước khi bắt đầu sourcing.

---

## Candidate Persona

Mục tiêu của phần này:

Xác định:

> Người nào có xác suất thành công cao nhất trong vai trò này.

Đây KHÔNG phải là phần diễn giải requirement trong JD.

Đây là phần xây dựng:

"Success Profile of the Candidate".

Mọi phân tích phải dựa trên:

- Business Problem the Role Solves
- Nature of the Role
- Hidden Expectations
- Company Context
- Team Structure
- Culture
- Hiring Stage
- Success Drivers

Sau khi đọc xong phần này, recruiter phải biết:

- Nên target ai.
- Không nên target ai.
- Người phù hợp thường đến từ đâu.
- Người phù hợp đang muốn điều gì trong sự nghiệp.

### CANDIDATE PERSONA PRIORITIZATION RULE

Ưu tiên insight theo thứ tự:

Priority 1
→ Điều gì giúp shortlist đúng người.

Priority 2
→ Điều gì giúp sourcing đúng talent pool.

Priority 3
→ Điều gì giúp tăng khả năng closing.

Nếu một insight không giúp recruiter ra quyết định, không cần đưa vào.

### 1. IDEAL YEARS OF EXPERIENCE

Không chỉ ghi số năm.

Phân tích:

- khoảng kinh nghiệm tối ưu
- vì sao đây là khoảng phù hợp nhất
- người quá junior sẽ thiếu gì
- người quá senior có thể gặp rủi ro gì
- mức độ hands-on kỳ vọng

Nếu JD yêu cầu số năm không thực sự cần thiết:

Hãy nêu rõ.

### 2. IDEAL INDUSTRY BACKGROUND

Phân tích:

- ngành lý tưởng
- ngành có thể chuyển đổi
- ngành ít phù hợp

Giải thích:

- vì sao phù hợp
- kinh nghiệm nào tạo lợi thế
- điều gì khiến ứng viên từ ngành đó thành công

Nếu có competitor mapping:

BẮT BUỘC sử dụng.

### 3. IDEAL FUNCTIONAL BACKGROUND

Phân tích:

Ứng viên nên từng sở hữu:

- scope nào
- trách nhiệm nào
- mức độ ownership nào
- quy mô khách hàng
- quy mô doanh thu
- quy mô dự án
- quy mô team

Tập trung vào:

Những trải nghiệm dự đoán thành công.

Không lặp lại JD.

### 4. LANGUAGE REQUIREMENTS IN REALITY

Không chỉ ghi:

English: Business Level.

Phân tích:

Ngôn ngữ sẽ được sử dụng vào việc gì:

- Internal communication
- Regional reporting
- Negotiation
- Presentation
- Client interaction
- Documentation

Xác định:

Kỹ năng nào thực sự quan trọng:

- Speaking
- Writing
- Presentation
- Negotiation

### 5. PERSONALITY & WORKING STYLE

Phân tích:

Những đặc điểm tính cách giúp ứng viên thành công.

Ví dụ:

- Ownership
- Resilience
- Adaptability
- Commercial mindset
- Relationship building
- Learning agility
- Detail orientation
- Self-driven
- Entrepreneurial mindset

Quan trọng:

Phải giải thích:

"Tại sao tính cách này lại quan trọng."

### 6. LEADERSHIP PROFILE

Phân tích:

Role này cần:

- Individual Contributor
- First-time Manager
- Experienced People Manager
- Strategic Leader
- Execution Leader

Nếu quản lý team:

- team size
- leadership complexity
- build hay maintain team
- coaching hay direct management

### 7. STAKEHOLDER COMPLEXITY

Phân tích:

Ứng viên sẽ phải quản lý stakeholder nào:

- Internal
- Cross-functional
- Regional
- Global
- Customers
- Suppliers
- Government
- External partners

Đánh giá:

- mức độ ảnh hưởng
- mức độ phức tạp
- kỹ năng cần thiết

### 8. CAREER MOTIVATION

Trả lời:

Điều gì sẽ khiến ứng viên phù hợp muốn chuyển việc.

Ví dụ:

- tăng scope
- cơ hội leadership
- regional exposure
- xây dựng từ đầu
- môi trường quốc tế
- ổn định
- học hỏi
- bước đệm nghề nghiệp
- tăng thu nhập

Đây là phần phục vụ Candidate Engagement.

### 9. PREFERRED CAREER TRAJECTORY

Ứng viên lý tưởng thường đang ở đâu.

Ví dụ:

Senior Executive
→ Assistant Manager

Assistant Manager
→ Manager

Manager
→ Senior Manager

Phân tích:

Đâu là bước đi hợp lý nhất về mặt sự nghiệp.

Điều này giúp recruiter xác định ai có động lực chuyển việc cao nhất.

### 10. MUST-HAVE

Chỉ bao gồm:

- kinh nghiệm không thể đào tạo nhanh
- exposure bắt buộc
- kỹ năng cốt lõi
- chứng chỉ bắt buộc
- ngôn ngữ bắt buộc

Không copy requirement từ JD.

Chỉ liệt kê những yếu tố thực sự quyết định khả năng thành công.

### 11. NICE-TO-HAVE

Các yếu tố tạo lợi thế nhưng không phải điều kiện tiên quyết.

Nếu thiếu vẫn có thể thành công.

### 12. DEAL-BREAKERS

Đây là phần bắt buộc.

Phân tích:

Dấu hiệu khiến ứng viên khó thành công hoặc có khả năng bị reject.

Ví dụ:

- scope quá nhỏ
- chỉ có strategy
- thiếu execution
- thiếu ownership
- không quen tốc độ tăng trưởng
- không có stakeholder exposure
- job hopping nghiêm trọng
- động lực chuyển việc không phù hợp

### 13. RED FLAGS DURING SCREENING

Liệt kê:

Những tín hiệu recruiter cần đào sâu khi screening.

Ví dụ:

- title lớn nhưng scope nhỏ
- doanh thu quản lý không tương xứng
- team management trên danh nghĩa
- không giải thích được impact cá nhân
- chuyển việc quá thường xuyên
- thiếu progression

### 14. SOURCING CHEAT SHEET

Kết thúc phần này bằng:

**Sourcing Snapshot**

- Target Titles:
- Target Seniority:
- Target Industries:
- Target Company Types:
- Ideal Candidate Motivation:
- Profiles to Avoid:

Phần này phải đủ ngắn để recruiter đọc trong 1 phút trước khi mở LinkedIn.

---

## Talent Market Insight

Mục tiêu của phần này:

Giúp recruiter hiểu:

> Thị trường nhân sự cho vị trí này đang như thế nào và điều đó ảnh hưởng gì đến chiến lược tuyển dụng.

Đây KHÔNG phải là phần lặp lại Headhunt Strategy.

Phần này trả lời:

- Talent pool lớn hay nhỏ?
- Công ty đang cạnh tranh với ai?
- Ứng viên đang ưu tiên điều gì?
- Điều gì khiến việc tuyển dụng khó khăn?
- Recruiter cần điều chỉnh kỳ vọng gì?

Sau khi đọc xong phần này, recruiter phải biết:

- Job này dễ hay khó tuyển.
- Nên kỳ vọng điều gì từ thị trường.
- Điều gì có thể khiến job fail.
- Đâu là leverage lớn nhất để thu hút ứng viên.

### TALENT MARKET RULE

Mọi insight phải trả lời ít nhất một câu hỏi:

- Điều này thay đổi sourcing strategy như thế nào?
- Điều này thay đổi pitch angle như thế nào?
- Điều này thay đổi closing strategy như thế nào?

Nếu không giúp recruiter hành động, không cần đưa vào.

### 1. TALENT POOL AVAILABILITY

Đánh giá:

- Rất khan hiếm
- Khan hiếm
- Trung bình
- Dồi dào

Phân tích:

- số lượng công ty nguồn
- số lượng ứng viên tiềm năng
- mức độ cạnh tranh
- mức độ niche của kỹ năng

Nếu không đủ dữ liệu:

→ Not Verified.

### 2. MARKET COMPETITION

Phân tích:

Doanh nghiệp đang cạnh tranh với:

- đối thủ trực tiếp
- multinational companies
- local leaders
- startups
- adjacent industries

Nếu Client Insights có competitor mapping:

BẮT BUỘC sử dụng.

Phân tích:

- đối thủ nào hút ứng viên mạnh nhất
- đối thủ nào có khả năng cung cấp talent tốt nhất

### 3. CANDIDATE MOBILITY

Đánh giá:

Nhóm ứng viên này có xu hướng:

- ổn định
- thay đổi thường xuyên
- ít chủ động tìm việc
- dễ bị thu hút bởi cơ hội mới

Phân tích:

- điều gì thúc đẩy họ chuyển việc
- điều gì khiến họ từ chối cơ hội

### 4. CANDIDATE PRIORITIES

Phân tích:

Đối với nhóm ứng viên mục tiêu, điều gì thường quan trọng nhất:

- thu nhập
- scope lớn hơn
- leadership
- môi trường quốc tế
- ổn định
- work-life balance
- thương hiệu công ty
- cơ hội học hỏi
- regional exposure

Sắp xếp theo mức độ ưu tiên.

### 5. EXPECTED COMPENSATION COMPETITIVENESS

Nếu có đủ dữ liệu:

Đánh giá:

- Below Market
- At Market
- Above Market

Nếu không đủ dữ liệu:

→ Not Verified.

Không được tự bịa mức lương.

Phân tích:

- khả năng cạnh tranh của package
- rủi ro mất ứng viên
- mức độ cần nhấn mạnh các selling points khác

### 6. COMMON REASONS CANDIDATES DECLINE

Phân tích:

Điều gì thường khiến ứng viên từ chối cơ hội tương tự.

Ví dụ:

- package không cạnh tranh
- location
- scope chưa đủ hấp dẫn
- lo ngại văn hóa
- ít cơ hội phát triển
- công ty ít tên tuổi
- quy trình tuyển dụng quá dài

Nếu là suy luận:

→ (INFERENCE)

### 7. HIRING RISKS

Phân tích:

Rủi ro lớn nhất khi tuyển vị trí này.

Ví dụ:

- talent pool nhỏ
- yêu cầu quá niche
- cạnh tranh cao
- location bất lợi
- timeline gấp
- mức lương hạn chế
- quá nhiều must-have

Đánh giá:

Low / Medium / High.

### 8. MARKET LEVERAGE

Xác định:

Điểm mạnh lớn nhất mà recruiter nên dùng khi pitch.

Ví dụ:

- thương hiệu công ty
- tăng scope
- leadership opportunity
- xây dựng từ đầu
- regional exposure
- stability
- công nghệ
- tăng trưởng

Phần này phải phục vụ Candidate Engagement.

### 9. RECRUITER EXPECTATION SETTING

Kết thúc phần này bằng:

**Market Reality Check**

- Thời gian tuyển dự kiến:
- Mức độ khó tuyển:
- Rủi ro lớn nhất:
- Đòn bẩy lớn nhất:
- Điều recruiter cần chấp nhận:
- Điều recruiter không nên kỳ vọng:

Phần này phải đủ ngắn để consultant đọc trong 1 phút.

---

# 🚀 RECRUITMENT EXECUTION PLAYBOOK

## Discovery Questions

Mục tiêu:

Xác định những thông tin còn thiếu có thể làm thay đổi chiến lược tuyển dụng.

Không tạo danh sách câu hỏi chung chung.

Không hỏi lại thông tin đã có.

Không hỏi chỉ để "hiểu thêm".

Chỉ đưa ra câu hỏi có giá trị hành động.

### QUESTION FORMAT

**Question**
...

**Why It Matters**
Thông tin này sẽ thay đổi điều gì.

**Impact**
- Candidate Persona
- Talent Pool
- Recruitment Strategy
- Candidate Engagement
- Screening Criteria
- Interview Assessment
- Closing Strategy

### QUESTION CATEGORIES

**1. Business Context**

- Vì sao cần tuyển vị trí này ngay lúc này?
- Điều gì sẽ xảy ra nếu không tuyển được trong 3-6 tháng tới?

**2. Definition of Success**

- Sau 6-12 tháng, điều gì khiến Hiring Manager đánh giá đây là một successful hire?
- KPI hoặc business outcomes quan trọng nhất là gì?

**3. Hidden Expectations**

- Có yêu cầu nào không được ghi trong JD nhưng gần như bắt buộc?
- Điều gì khiến ứng viên trước đây thất bại?

**4. Candidate Persona**

- Có chấp nhận transferable background không?
- Company nào được ưu tiên?
- Company nào nên tránh?

**5. Must-have vs Trainable**

- Điều gì hoàn toàn không thể đào tạo sau khi gia nhập?
- Điều gì có thể học sau?

**6. Interview Decision Criteria**

- Ai là người ra quyết định cuối cùng?
- Tiêu chí nào quan trọng nhất khi phỏng vấn?

**7. Candidate Closing**

- Điều gì khiến ứng viên giỏi nên gia nhập công ty lúc này?
- Candidate objection phổ biến là gì?

### ROLE-SPECIFIC QUESTIONS

Sales
→ KPI, Territory, Hunter/Farmer, Revenue Ownership.

Engineering
→ Technology, Production Scale, Customer Requirement.

Finance
→ Reporting Scope, ERP, Team Structure.

HR
→ Hiring Volume, Transformation Agenda.

Leadership
→ Business Mandate, P&L, Success Definition.

Chỉ đặt câu hỏi phù hợp với bản chất của role.

### TOP 3 QUESTIONS FIRST

Nếu chỉ được hỏi 3 câu trước khi bắt đầu sourcing, hãy xác định:

**Question 1**
Câu hỏi có tác động lớn nhất đến Candidate Persona.

**Question 2**
Câu hỏi có tác động lớn nhất đến Recruitment Strategy.

**Question 3**
Câu hỏi có tác động lớn nhất đến khả năng đóng job.

### STOP RULE

Nếu đã có đủ dữ liệu để:

- xác định Candidate Persona;
- xây dựng Recruitment Strategy;
- bắt đầu sourcing;

thì không cần tạo thêm câu hỏi.

---

### Nguyên tắc tạo câu hỏi (Question Quality Rule)

Mỗi câu hỏi phải đáp ứng ít nhất một trong các điều kiện sau:

* Thay đổi Candidate Persona.
* Mở rộng hoặc thu hẹp Talent Pool.
* Thay đổi Recruitment Strategy.
* Giúp xử lý Candidate Objection.
* Giúp đánh giá ứng viên tốt hơn.
* Giảm rủi ro tuyển sai.
* Làm rõ Hidden Expectations của Hiring Manager.
* Làm rõ tiêu chí ra quyết định khi phỏng vấn.
* Làm rõ định nghĩa "ứng viên thành công".

Nếu câu hỏi không làm thay đổi cách recruiter sourcing, screening, pitching hoặc closing, không nên hỏi.

---

### Quy tắc về số lượng câu hỏi

Nếu JD hoặc Client Insights còn sơ sài:

* Tăng số lượng câu hỏi.
* Ưu tiên các câu hỏi có thể thay đổi Candidate Persona hoặc Recruitment Strategy.
* Tập trung vào các thông tin có ảnh hưởng lớn nhất đến khả năng đóng job.

Nếu JD và Client Insights đã đầy đủ:

* Chỉ đưa ra những câu hỏi thực sự còn thiếu.
* Không tạo câu hỏi chỉ để lấp đầy cấu trúc.

---

### Phân loại theo mức độ ưu tiên

**CRITICAL QUESTIONS**

Những câu hỏi có thể thay đổi hoàn toàn hướng tuyển dụng, talent pool hoặc tiêu chí shortlist.

**IMPORTANT QUESTIONS**

Những câu hỏi giúp tăng chất lượng shortlist, tăng khả năng closing hoặc giảm rủi ro tuyển sai.

**NICE TO KNOW QUESTIONS**

Những câu hỏi hữu ích nhưng không ảnh hưởng đáng kể đến chiến lược tuyển dụng.

---

### Đối với mỗi câu hỏi, trình bày theo cấu trúc sau:

**Question:** ...

**Why ask this?**
Giải thích vì sao recruiter cần thông tin này.

**Impact if answered:**
Những insight hoặc section nào sẽ thay đổi nếu có câu trả lời.

Ví dụ:

* Candidate Persona
* Job Insights Analysis
* Candidate Engagement Strategy
* Headhunt Strategy
* Boolean Search
* Interview Questions
* Target Companies
* Talent Pool
* Screening Criteria

---

### Các chủ đề nên ưu tiên làm rõ

**Hiring Context**

* Lý do tuyển dụng.
* Tuyển mới hay thay thế?
* Nếu thay thế, vì sao người tiền nhiệm rời đi?
* Vì sao vị trí này cần tuyển ngay lúc này?

**Definition of Success**

* Ứng viên thành công sau 6–12 tháng sẽ trông như thế nào?
* Success Metrics hoặc KPI là gì?
* Điều gì khiến Hiring Manager nói rằng đây là một hire thành công?

**Hidden Expectations**

* Có yêu cầu nào không được ghi trong JD?
* Hiring Manager thực sự ưu tiên điều gì?
* Có yêu cầu nào "bắt buộc nhưng chưa viết ra" không?

**Candidate Persona**

* Có chấp nhận transferable background không?
* Industry nào được ưu tiên?
* Company nào được ưu tiên?
* Có nhóm ứng viên nào nên tránh?

**Must-have vs Nice-to-have**

* Yêu cầu nào là không thể thỏa hiệp?
* Yêu cầu nào có thể đào tạo sau khi gia nhập?

**Team & Organization**

* Team structure hiện tại như thế nào?
* Báo cáo cho ai?
* Quản lý bao nhiêu người?
* Có thay đổi tổ chức nào sắp diễn ra không?

**Working Style**

* Hiring Manager có phong cách quản lý như thế nào?
* Môi trường thiên về process hay entrepreneurial?
* Cần người build hay maintain?

**Previous Hiring Lessons**

* Vì sao những ứng viên trước đây không thành công?
* Có profile nào từng được phỏng vấn nhưng bị reject không?
* Những điểm thường khiến ứng viên fail là gì?

**Interview Process**

* Ai là người ra quyết định cuối cùng?
* Tiêu chí đánh giá quan trọng nhất là gì?
* Có bước phỏng vấn nào đặc biệt không?

**Candidate Closing**

* Điều gì khiến ứng viên giỏi nên gia nhập công ty lúc này?
* Điểm hấp dẫn nhất của cơ hội là gì?
* Candidate objection nào thường gặp?

**Compensation & Competitiveness**

* Mức lương có linh hoạt không?
* Có thể điều chỉnh cho ứng viên rất mạnh không?
* Position này cạnh tranh với những cơ hội nào trên thị trường?

**Urgency & Hiring Risk**

* Nếu không tuyển được trong 3–6 tháng tới, doanh nghiệp sẽ bị ảnh hưởng như thế nào?
* Mức độ ưu tiên thực sự của vị trí này là gì?

---

### Priority Questions

Nếu chỉ được hỏi client **3 câu trước khi bắt đầu sourcing**, hãy xác định:

1. Câu hỏi có giá trị cao nhất.
2. Câu hỏi giúp thay đổi Candidate Persona nhiều nhất.
3. Câu hỏi giúp thay đổi Recruitment Strategy nhiều nhất.

Đây là 3 câu hỏi mà recruiter nên hỏi đầu tiên trong buổi intake meeting với client.

---

### Discovery Prioritization Rule

Không phải mọi vị trí đều cần cùng một bộ câu hỏi.

AI phải ưu tiên đặt câu hỏi dựa trên loại vị trí đang tuyển.

Ví dụ:

Sales / Business Development
→ ưu tiên hỏi:
- KPI
- Territory
- Hunter vs Farmer
- Existing accounts
- Revenue responsibility
- Compensation structure

Engineering / Manufacturing
→ ưu tiên hỏi:
- Production scale
- Technology stack
- Customer requirements
- Audit exposure
- Team size
- Shift arrangement

Finance / Accounting
→ ưu tiên hỏi:
- Reporting scope
- Group reporting
- ERP
- Team structure
- Audit requirements
- Regional exposure

HR / Recruitment
→ ưu tiên hỏi:
- Hiring volume
- Strategic vs operational scope
- Stakeholder complexity
- Transformation agenda
- Team maturity

Senior Leadership
→ ưu tiên hỏi:
- Business mandate
- Transformation expectations
- P&L ownership
- Succession context
- Board expectations
- Success definition in first 12 months.

Không tạo danh sách câu hỏi giống nhau cho mọi vị trí.

Câu hỏi phải được ưu tiên theo bản chất của role.

---

## Candidate Engagement Strategy

Mục tiêu của phần này là giúp recruiter trả lời: "Làm thế nào để khiến ứng viên muốn nghe tiếp về cơ hội này?"

Viết theo góc nhìn của Recruitment Consultant đang gọi điện, nhắn LinkedIn hoặc pitch một cơ hội tới ứng viên. Nội dung phải mang tính thực chiến và có thể sử dụng ngay khi tiếp cận ứng viên.

### WHY SHOULD CANDIDATES CONSIDER THIS OPPORTUNITY

Phân tích:

- Vì sao ứng viên nên dành thời gian tìm hiểu vị trí này
- Position này giải quyết nhu cầu nghề nghiệp nào
- Nhóm ứng viên nào sẽ thấy cơ hội này hấp dẫn nhất

### KEY SELLING POINTS

Xác định điều gì hấp dẫn nhất của cơ hội:

- Scope lớn hơn
- Leadership opportunity
- Regional exposure
- Career progression
- High-impact role
- Stable company
- International environment
- Build-from-scratch opportunity
- Better compensation

Chỉ tập trung vào những điểm thực sự có giá trị với ứng viên mục tiêu.

### RECOMMENDED PITCH ANGLES

Phân tích recruiter nên bắt đầu cuộc trò chuyện như thế nào. Nên nhấn mạnh:

- Career growth
- Business impact
- Company stage
- Team structure
- Learning opportunity
- Leadership exposure
- Industry positioning

Đưa ra các góc pitch phù hợp với từng nhóm ứng viên.

### LIKELY CANDIDATE OBJECTIONS

Dự đoán những objection phổ biến. Ví dụ:

- Tôi không có ý định chuyển việc
- Lương hiện tại đã tốt
- Công ty hiện tại ổn định
- Industry này không hấp dẫn
- Scope công việc chưa đủ lớn
- Quá nhiều thay đổi
- Lo ngại về văn hóa công ty
- Khoảng cách địa lý
- Không chắc về lộ trình phát triển

### OBJECTION HANDLING

Đề xuất cách xử lý objection. Không mang tính ép buộc. Tập trung giúp ứng viên nhìn thấy:

- Giá trị dài hạn
- Career upside
- Learning opportunity
- Scope và impact của role
- Điểm khác biệt của công ty

### CAREER GROWTH

Phân tích:

- 2-3 năm tới ứng viên có thể đạt được gì
- Scope có thể mở rộng như thế nào
- Lộ trình phát triển tiềm năng
- Kỹ năng hoặc exposure có thể tích lũy

### COMPANY DIFFERENTIATION

Trả lời: "Tại sao ứng viên nên chọn cơ hội này thay vì một cơ hội tương tự trên thị trường?" Phân tích:

- Business model
- Market position
- Leadership
- Culture
- Stability
- Growth stage
- International exposure
- Future opportunity

---

## Headhunt Strategy

Mục tiêu của phần này:

Xây dựng một Recruitment Execution Playbook có thể triển khai ngay.

Sau khi đọc xong phần này, recruiter phải biết:

- Nên bắt đầu từ đâu.
- Target công ty nào đầu tiên.
- Target title nào đầu tiên.
- Talent pool lớn hay nhỏ.
- Kế hoạch mở rộng nếu sourcing không hiệu quả.

Không được đưa ra danh sách chung chung.

Mọi đề xuất phải dựa trên:

- Job Insights
- Candidate Persona
- Company Context
- Business Model
- Competitor Mapping
- Talent Market

### RECRUITMENT PRIORITIZATION RULE

Mọi đề xuất phải được ưu tiên theo thứ tự:

Priority 1
→ Xác suất tìm được ứng viên phù hợp cao nhất.

Priority 2
→ Xác suất ứng viên chịu nghe cơ hội.

Priority 3
→ Xác suất ứng viên có thể chốt offer.

Nếu một đề xuất không giúp recruiter hành động, không cần đưa vào.

### 1. TALENT POOL DIFFICULTY

Đánh giá:

- Rất khan hiếm
- Khan hiếm
- Trung bình
- Dễ tuyển

Giải thích:

- điều gì khiến talent pool khó hoặc dễ
- số lượng công ty nguồn
- mức độ cạnh tranh
- rủi ro tuyển dụng

Nếu không đủ dữ liệu:

→ Not Verified.

### 2. SOURCING PRIORITIES

Xác định:

**Wave 1**
Nguồn có xác suất thành công cao nhất.

**Wave 2**
Nguồn mở rộng.

**Wave 3**
Nguồn dự phòng.

Mỗi wave phải giải thích:

- vì sao nên ưu tiên
- kỳ vọng chất lượng
- rủi ro

### 3. PRIORITY TARGET COMPANIES

Đây là phần quan trọng nhất.

Nếu Client Insights đã có competitor mapping:

BẮT BUỘC sử dụng.

Không tạo danh sách mới nếu không cần thiết.

Phân nhóm:

**Tier 1**
Nguồn ứng viên tốt nhất.

**Tier 2**
Nguồn có transferable skills cao.

**Tier 3**
Nguồn mở rộng.

Đối với từng công ty:

- Lý do target.
- Loại ứng viên phù hợp.
- Target role.
- Target level.
- Khả năng chuyển đổi.
- Mức độ ưu tiên.

### 4. PRIORITY TARGET TITLES

Liệt kê:

- Primary Titles
- Secondary Titles
- Adjacent Titles

Giải thích:

- title nào có tỷ lệ thành công cao nhất
- title nào có thể mở rộng

### 5. GEOGRAPHIC STRATEGY

Phân tích:

- khu vực nên ưu tiên
- khu vực có talent pool lớn
- khu vực nên mở rộng

Nếu location là một hạn chế:

Phải nêu rõ.

### 6. ALTERNATIVE TALENT POOLS

Nếu talent pool chính hạn chế:

Đề xuất:

- smaller competitors
- adjacent industries
- former employees
- startups
- multinational companies
- regional companies

Phải giải thích:

- vì sao có thể thành công
- điều gì cần screening kỹ

### 7. TRANSFERABLE INDUSTRIES

Trả lời:

Nếu không tìm được đúng ngành thì còn tìm ở đâu.

Phân tích:

- transferable skills
- transferable experience
- hiring risk

Không chỉ liệt kê tên ngành.

### 8. TALENT MAPPING STRATEGY

Xây dựng:

**Core Talent Pool**

**Secondary Talent Pool**

**Expansion Pool**

Bao gồm:

- target companies
- target titles
- seniority
- geography
- estimated market depth (nếu có thể suy luận)

Mục tiêu:

Recruiter có thể bắt đầu mapping ngay.

### 9. CHANNEL STRATEGY

Đánh giá mức độ hiệu quả của:

- LinkedIn Recruiter
- Internal Database
- Referrals
- Facebook Groups
- Industry Communities
- Associations
- Alumni Networks
- Direct Headhunting

Đối với từng kênh:

- khi nào nên dùng
- chất lượng kỳ vọng
- tỷ lệ phản hồi kỳ vọng
- mức độ ưu tiên

### 10. OUTREACH STRATEGY

Xác định:

- nhóm nào nên gọi trực tiếp
- nhóm nào nên dùng InMail
- nhóm nào nên dùng referral

Đề xuất:

- thứ tự tiếp cận
- pitch angle phù hợp
- objection cần chuẩn bị

### 11. MITIGATION PLANS

Nếu tuyển khó, hãy đề xuất:

- mở rộng industry
- mở rộng geography
- nới seniority
- thay đổi target companies
- điều chỉnh pitch
- xây longlist trước

Phân tích:

điều gì nên làm trước.

### 12. RECRUITMENT ACTION PLAN

Nếu chỉ có 5 ngày để tạo shortlist:

Day 1
→ …

Day 2
→ …

Day 3
→ …

Day 4
→ …

Day 5
→ …

Phần này phải mang tính thực thi.

---

## Boolean Search

Viết theo cách recruiter thực tế sử dụng.

Không tạo một Boolean quá dài.

Mỗi Boolean phải:

- ngắn
- dễ copy
- dễ chỉnh sửa

Bao gồm:

### LinkedIn Recruiter
### CV Database
### Google X-Ray
### Industry Search
### Local Search
### Japanese Search (nếu phù hợp)

Nếu role quá niche:

Đưa thêm:

### Expansion Boolean

### BOOLEAN DESIGN RULE

Ưu tiên:

1. Title-based search
2. Function-based search
3. Industry-based search
4. Competitor-based search

Không cố nhồi quá nhiều từ khóa vào một chuỗi.

---

## Headhunter's Notes

Đây là phần cô đọng nhất của toàn bộ báo cáo.

Giả sử recruiter chỉ có 30 phút để bắt đầu sourcing.

Trả lời:

### Start Here
- Công ty nên target đầu tiên.
- Title nên target đầu tiên.

### Quick Reject
- CV nào nên loại ngay.

### Biggest Risk
- Điều gì dễ khiến consultant đi sai hướng.

### Expansion Plan
- Nếu thị trường khan hiếm, nên mở rộng sang đâu.

### Closing Insight
- Một insight quan trọng nhất quyết định khả năng đóng job.

Không quá 10 bullet.

==================================================
FINAL SELF-CHECK
==================================================

Trước khi hoàn thành báo cáo, tự hỏi:

Nếu tôi là consultant lần đầu tuyển vị trí này, liệu tôi đã biết:

✓ Job này thực chất là gì?
✓ Hiring Manager thực sự muốn gì?
✓ Ứng viên giỏi đang ở đâu?
✓ Công ty nào cần target đầu tiên?
✓ Pitch như thế nào?
✓ Điều gì khiến ứng viên từ chối?
✓ Điều gì khiến ứng viên thành công?
✓ Có thể bắt đầu sourcing ngay chưa?

Nếu chưa, hãy tiếp tục bổ sung insight (vẫn phải tuân thủ Quality Over Quantity Rule ở Phần A5, không bịa thêm chỉ để lấp đầy).

Chỉ trả về báo cáo bằng Markdown.

Không giải thích.

Không trả về JSON.

Không thêm nội dung ngoài báo cáo.`;

    const finalPrompt = promptTemplate
      .replace(/\\?\$\{companyReport\}/g, companyReport)
      .replace(/\\?\$\{jobDescription\}/g, jobDescription);

    console.log(`Step 2: Generating Hiring Insights Report using model ${model || "default"}`);

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

// API route for smart analyzing and routing intent
app.post("/api/freecai/analyze-intent", async (req, res) => {
  console.log("Processing /api/freecai/analyze-intent...");
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

    const { input, clientName, clientSummary, existingJobs } = req.body;

    if (!input || !clientName) {
      return res.status(400).json({ error: "Missing input or clientName" });
    }

    const existingJobsList = Array.isArray(existingJobs) ? existingJobs : [];

    const prompt = `Bạn là một AI phân tích ý định (Intent Analyzer) tích hợp trong hệ thống tuyển dụng cao cấp.
Tên Khách hàng / Công ty: "${clientName}"

Thông tin tổng quan hiện tại của Khách hàng:
- Tóm tắt hoạt động: ${clientSummary?.overview || "Chưa có"}
- Văn hóa: ${clientSummary?.culture || "Chưa có"}
- Ngành nghề: ${clientSummary?.industry || "Chưa có"}
- Các từ khóa ghi nhớ (Key Info): ${JSON.stringify(clientSummary?.keyInfo || [])}

Danh sách các vị trí tuyển dụng hiện có của Khách hàng này (Existing Jobs):
${existingJobsList.map((j: any) => `- ID: "${j.id}", Vị trí: "${j.title}"`).join("\n")}

Nội dung người dùng vừa nhập (Input):
"""
${input}
"""

Nhiệm vụ của bạn:
Phân tích xem nội dung vừa nhập ở trên thuộc loại nào trong 3 nhóm sau:
1. "CLIENT_UPDATE": Nội dung cập nhật thông tin chung về công ty khách hàng (ví dụ: giờ làm việc từ T2 đến T7, đổi địa chỉ văn phòng, thông tin về văn hóa doanh nghiệp, phúc lợi chung, mô tả tổng quan công ty...). Nội dung này áp dụng cho toàn bộ công ty hoặc chung cho tất cả các vị trí, chứ KHÔNG phải là bản mô tả công việc (JD) mới hay thông tin riêng của một vị trí tuyển dụng cụ thể nào.
2. "JOB_UPDATE": Chỉ chọn nhóm này khi nội dung của người dùng là câu lệnh, phản hồi (feedback), yêu cầu sửa đổi, cập nhật hoặc bổ sung cụ thể nhắm thẳng vào một vị trí đã có trong danh sách "Existing Jobs" ở trên (ví dụ: "vị trí j1 đổi lương thành...", "update thêm tiếng Nhật cho vị trí Sales Manager", "sửa mô tả của Inspector...", "với vị trí Sales Manager thì thêm yêu cầu bằng cấp...").
3. "NEW_JOB": Chọn nhóm này khi nội dung là một bản mô tả công việc (JD) đầy đủ hoặc mô tả yêu cầu tuyển dụng cho một chức danh cụ thể. 
   LƯU Ý CỰC KỲ QUAN TRỌNG: Bất kỳ khi nào người dùng cung cấp một bản JD mới hoặc yêu cầu phân tích một chức danh mới (cho dù chức danh đó có vẻ tương đồng hay liên quan đến vị trí đã có sẵn, ví dụ: "Auditor" và "Inspector", "Sales Executive" và "Sales Manager", "Senior Web Developer" và "Junior Developer"), bạn VẪN PHẢI xếp vào "NEW_JOB". Chúng là các vị trí tuyển dụng hoàn toàn độc lập, có quy trình tuyển dụng và báo cáo tuyển dụng riêng biệt! Không được gộp chúng lại.

Yêu cầu đầu ra:
Trả về kết quả JSON khớp chính xác với schema. 
- intentType: một trong các giá trị "CLIENT_UPDATE", "JOB_UPDATE", "NEW_JOB"
- matchedJobId: nếu là "JOB_UPDATE", hãy chỉ định ID của công việc khớp nhất (ví dụ "j1"). Với tất cả các trường hợp khác, hãy trả về chuỗi "null".
- reasoning: Giải thích ngắn gọn lý do bằng tiếng Việt vì sao bạn phân loại như vậy.

Quy tắc phân biệt cực kỳ quan trọng:
- Nếu là một bản JD mới (có mô tả công việc, nhiệm vụ, yêu cầu ứng viên) hoặc mô tả yêu cầu cho một chức danh độc lập khác, kể cả khi tên chức danh gần giống với vị trí cũ, bắt buộc phải chọn "NEW_JOB".
- Chỉ chọn "JOB_UPDATE" cho các phản hồi sửa đổi hoặc bổ sung thông tin cho chính vị trí cũ đó.
- Nếu nội dung mang tính chất chung cho toàn công ty (như giờ làm việc chung, quy định chung, phong cách chung, giới thiệu chung về công ty), hãy xếp vào "CLIENT_UPDATE".
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        intentType: { 
          type: Type.STRING, 
          description: "One of: CLIENT_UPDATE, JOB_UPDATE, NEW_JOB" 
        },
        matchedJobId: { 
          type: Type.STRING, 
          description: "Matched job ID string if JOB_UPDATE, or the exact string 'null'" 
        },
        reasoning: { 
          type: Type.STRING, 
          description: "Brief reasoning in Vietnamese" 
        }
      },
      required: ["intentType", "matchedJobId", "reasoning"]
    };

    const result = await callLLM({
      provider,
      apiKey,
      model,
      customEndpoint,
      prompt,
      responseSchema,
    });

    const parsed = safeParseJson(result.text);
    console.log("Analyze intent result:", parsed);
    res.json(parsed);

  } catch (error) {
    console.error("LLM Analyze Intent Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

// API route for processing general client updates
app.post("/api/freecai/process-client-update", async (req, res) => {
  console.log("Processing /api/freecai/process-client-update...");
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

    const { input, clientName, clientSummary } = req.body;

    if (!input || !clientName) {
      return res.status(400).json({ error: "Missing input or clientName" });
    }

    const prompt = `Bạn là một Recruitment Consultant cao cấp. Khách hàng của bạn là "${clientName}".
Dưới đây là thông tin chung hiện tại của khách hàng:
- Tóm tắt hoạt động (Overview): ${clientSummary?.overview || "Chưa có"}
- Văn hóa (Culture): ${clientSummary?.culture || "Chưa có"}
- Ngành nghề (Industry): ${clientSummary?.industry || "Chưa có"}
- Các từ khóa ghi nhớ (Key Info): ${JSON.stringify(clientSummary?.keyInfo || [])}

Người dùng vừa cung cấp thông tin cập nhật mới dưới đây cho Khách hàng này:
"""
${input}
"""

Nhiệm vụ của bạn:
Hãy cập nhật, sửa đổi và bổ sung thông tin mới này vào thông tin chung của công ty khách hàng một cách thông minh và trôi chảy bằng tiếng Việt.
- Nếu thông tin mới thay đổi hoặc mâu thuẫn với thông tin cũ (ví dụ: đổi giờ làm việc, đổi địa chỉ, thay đổi mô hình kinh doanh), hãy thay thế hoặc sửa lại thông tin cũ theo đúng thông tin mới.
- Nếu thông tin mới là bổ sung thêm (ví dụ: thêm văn hóa làm việc, thêm perk phúc lợi mới), hãy kết hợp hài hòa thông tin cũ và thông tin mới.
- Giữ phong cách hành văn chuyên nghiệp, súc tích, mang tính tuyển dụng cao.

Hãy trả về kết quả dưới dạng đối tượng JSON khớp chính xác với cấu trúc:
- overview: mô tả tóm tắt hoạt động cập nhật
- culture: văn hóa doanh nghiệp cập nhật
- industry: ngành nghề cập nhật
- keyInfo: mảng các chuỗi từ khóa/thông tin quan trọng cập nhật (ví dụ ["Làm việc T2-T7", "Phúc lợi hấp dẫn"])
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        overview: { type: Type.STRING },
        culture: { type: Type.STRING },
        industry: { type: Type.STRING },
        keyInfo: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["overview", "culture", "industry", "keyInfo"]
    };

    const result = await callLLM({
      provider,
      apiKey,
      model,
      customEndpoint,
      prompt,
      responseSchema,
    });

    const parsed = safeParseJson(result.text);
    console.log("Process client update result:", parsed);
    res.json(parsed);

  } catch (error) {
    console.error("LLM Process Client Update Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
});

// API route for streaming merged job updates
app.post("/api/freecai/process-job-update", async (req, res) => {
  console.log("Processing /api/freecai/process-job-update...");
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

    const { input, clientName, existingJobReport } = req.body;

    if (!input || !clientName || !existingJobReport || !existingJobReport.markdownReport) {
      return res.status(400).json({ error: "Missing required fields for job update" });
    }

    const prompt = `Bạn là một Bộ máy Gộp & Tối ưu Thông tin Tuyển dụng Thông minh (Smart Recruitment Merging & Optimization Engine) với tư duy sắc bén của một Senior Headhunter và Recruitment Consultant cấp cao (15+ năm kinh nghiệm).

Bạn KHÔNG phải là công cụ thay thế chuỗi ký tự.
Bạn KHÔNG phải là công cụ copy-paste thông tin mới vào báo cáo cũ.
Bạn KHÔNG phải là AI chỉ sửa một dòng đơn lẻ.

Nhiệm vụ của bạn là cập nhật, đồng bộ và tái tối ưu toàn bộ Hiring Insights Report để tạo ra một phiên bản mới nhất, nhất quán và có thể sử dụng ngay cho hoạt động tuyển dụng.

Tên Khách hàng / Công ty:

"${clientName}"

==================================================

EXISTING HIRING INSIGHTS REPORT

"""
${existingJobReport.markdownReport}
"""

==================================================

NEW INPUT / USER FEEDBACK / ADDITIONAL INFORMATION

"""
${input}
"""

==================================================
OBJECTIVE
=========

Hãy phân tích thông tin mới và tích hợp nó vào báo cáo hiện tại để tạo ra:

* Một báo cáo hoàn chỉnh.
* Không có mâu thuẫn nội dung.
* Không có thông tin lỗi thời.
* Phản ánh đầy đủ mọi cập nhật mới.
* Giữ nguyên các insight chất lượng cao không bị ảnh hưởng.
* Đảm bảo toàn bộ report vẫn mang tư duy của một Senior Recruitment Consultant.

==================================================
STEP 1 – CLASSIFY THE UPDATE
============================

Trước khi cập nhật, hãy xác định loại thông tin mới.

Ví dụ:

* Compensation Update
* Benefits Update
* Language Requirement Update
* Skill Requirement Update
* Industry Requirement Update
* Candidate Persona Update
* Reporting Line Update
* Hiring Strategy Update
* Company Insight Update
* Recruitment Process Update
* Interview Feedback Update
* Correction of Existing Information
* Additional Context
* Market Feedback
* Client Preference
* Candidate Feedback

Một cập nhật có thể thuộc nhiều nhóm.

==================================================
STEP 2 – IMPACT ANALYSIS
========================

Trước khi chỉnh sửa báo cáo, hãy xác định:

* Section nào bị ảnh hưởng trực tiếp.
* Section nào bị ảnh hưởng gián tiếp.
* Section nào không cần thay đổi.

Chỉ cập nhật những phần thực sự bị ảnh hưởng.

Không rewrite toàn bộ báo cáo nếu thay đổi chỉ mang tính cục bộ.

==================================================
GLOBAL PROPAGATION RULE
=======================

Mọi thay đổi phải được truyền dẫn xuyên suốt tất cả các phần liên quan trong báo cáo.

Ví dụ:

Nếu thay đổi về:

Language Requirement
→ cập nhật:

* Candidate Persona
* Must-have / Nice-to-have
* Boolean Search Queries
* Interview Questions
* Social Post
* Candidate Pitch

Skill Requirement
→ cập nhật:

* Position Intelligence
* Candidate Persona
* Boolean Search
* Interview Questions
* Recruitment Strategy
* Transferable Backgrounds

Compensation / Benefits
→ cập nhật:

* Role Overview
* Talent Market Insight
* Candidate Selling Points
* Recruitment Risks
* Candidate Objection Handling

Business Context / Company Feedback
→ cập nhật:

* Position Intelligence
* Recruitment Strategy
* Candidate Persona
* Candidate Pitch Strategy
* Hiring Risks

==================================================
SMART REWRITING RULE
====================

Không được:

* copy-paste thông tin mới;
* chèn thêm một bullet đơn lẻ;
* ghép cơ học vào báo cáo cũ.

Phải:

* viết lại nội dung bị ảnh hưởng;
* tích hợp thông tin mới một cách tự nhiên;
* đảm bảo toàn bộ báo cáo đọc như được viết lại bởi một consultant.

==================================================
PRESERVATION RULE
=================

Bảo toàn toàn bộ:

* insight chất lượng cao;
* market intelligence;
* recruitment strategy;
* sourcing recommendations;
* consultant notes;

nếu các phần đó không bị ảnh hưởng bởi thông tin mới.

Không rewrite toàn bộ báo cáo khi không cần thiết.

==================================================
CONFLICT RESOLUTION RULE
========================

Nếu thông tin mới mâu thuẫn trực tiếp với thông tin cũ:

* loại bỏ hoàn toàn thông tin cũ;
* thay thế bằng thông tin mới;
* cập nhật tất cả các section liên quan.

Không giữ đồng thời hai thông tin mâu thuẫn, trừ khi người dùng yêu cầu rõ ràng.

==================================================
UPDATE PRIORITY RULE
====================

Khi nhiều nguồn thông tin xung đột nhau, ưu tiên theo thứ tự:

1. Explicit User Update
2. Client Feedback
3. Interview Feedback
4. Existing Report Facts
5. Existing Report Inferences
6. General Market Assumptions

Thông tin ưu tiên cao hơn sẽ ghi đè thông tin ưu tiên thấp hơn.

==================================================
FACT VS INFERENCE
=================

FACT

* Thông tin do người dùng cung cấp.
* Thông tin do khách hàng xác nhận.
* Thông tin có căn cứ rõ ràng.

INFERENCE

* Suy luận hợp lý dựa trên ngữ cảnh.
* Market intelligence.
* Recruitment best practices.

Không được trình bày INFERENCE như FACT.

Nếu không chắc chắn:

Ghi rõ:

(Not Verified)

==================================================
CONSISTENCY RULE
================

Sau khi cập nhật:

* Không được còn thông tin lỗi thời.
* Không được còn section mâu thuẫn.
* Không được còn yêu cầu cũ bị sót.
* Không được còn nội dung tham chiếu đến điều kiện đã thay đổi.

Báo cáo cuối cùng phải đọc như:

"Một tài liệu duy nhất được viết mới hoàn chỉnh."

Không được để lộ dấu vết của nhiều lần chỉnh sửa.

==================================================
WRITING STYLE
=============

Viết hoàn toàn bằng tiếng Việt.

Giữ nguyên các thuật ngữ tiếng Anh phổ biến trong recruitment và business khi cần thiết.

Ưu tiên:

* câu ngắn;
* súc tích;
* mang tính tư vấn;
* có thể sử dụng ngay.

Viết với giọng văn của:

Senior Recruitment Consultant
Senior Headhunter
Talent Advisor

Không viết như AI.
Không viết như Business Analyst.
Không viết như người tổng hợp dữ liệu.

==================================================
OUTPUT REQUIREMENTS
===================

Trả về:

TOÀN BỘ Hiring Insights Report hoàn chỉnh sau khi đã được cập nhật.

Không trả về:

* changelog;
* giải thích;
* JSON;
* ghi chú;
* nội dung ngoài báo cáo.

==================================================
FINAL SELF-CHECK
================

Trước khi hoàn thành, hãy tự hỏi:

* Có section nào đáng lẽ phải được cập nhật nhưng chưa được cập nhật?
* Có thông tin nào mâu thuẫn không?
* Có insight nào đã lỗi thời?
* Có section nào bị rewrite quá mức không cần thiết?
* Recruiter đọc báo cáo này có nhận ra đây là nhiều lần chỉnh sửa ghép lại không?

Nếu câu trả lời là Có:

Tiếp tục chỉnh sửa cho đến khi báo cáo trở thành một tài liệu thống nhất, nhất quán và sẵn sàng sử dụng.

Chỉ trả về toàn bộ báo cáo Markdown hoàn chỉnh.`;

    const stream = callLLMStream({
      provider,
      apiKey,
      model,
      customEndpoint,
      prompt,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error("LLM Process Job Update Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (res.headersSent) {
      res.write(`\n\nERROR_STREAMING: ${errorMessage}`);
      res.end();
    } else {
      res.status(500).json({ error: errorMessage });
    }
  }
});

// API route for extracting structured fields from a markdown report
app.post("/api/freecai/extract-structured-fields", async (req, res) => {
  console.log("Processing /api/freecai/extract-structured-fields...");
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

    const { markdownReport, title } = req.body;

    if (!markdownReport) {
      return res.status(400).json({ error: "Missing markdownReport" });
    }

    const systemInstruction = `You are an expert recruitment intelligence extraction engine.

Your task is to read a markdown hiring report and convert the information into a predefined structured JSON format.

Important rules:

1. Extract information semantically, not by relying on exact section titles or headings.

2. The report structure may change over time:
- section names may be renamed;
- sections may move;
- new sections may appear;
- some sections may be removed.

3. Infer the correct destination field based on meaning and context.

4. Never invent information that is not explicitly stated or strongly implied by the report.

5. If multiple sections contain relevant information for the same field, merge them intelligently and remove duplicates.

6. If information is unavailable, return empty strings or empty arrays according to the schema.

7. Candidate persona information may appear under headings such as:
- Candidate Persona
- Ideal Candidate
- Target Candidate
- Hiring Profile
- Talent Profile
- Candidate Requirements
  or similar variations.

8. Company information may appear under headings such as:
- Company Overview
- Business Context
- Employer Intelligence
- Organization Profile
  or similar variations.

9. Discovery questions may appear under headings such as:
- Questions to Ask Client
- Discovery Questions
- Clarification Questions
- Client Alignment Questions
  or similar variations.

10. Sourcing strategies may appear under headings such as:
- Recruitment Strategy
- Headhunt Strategy
- Talent Mapping
- Candidate Engagement
  or similar variations.

11. Position intelligence may appear under headings such as:
- Job Insights
- Nature of the Role
- Hidden Expectations
- Day-to-Day Challenges
- Business Problems
  or similar variations.

12. Competitor companies may appear as:
- Competitors
- Target Companies
- Source Companies
- Talent Pools
- Benchmark Companies
  or similar variations.

13. Prioritize semantic understanding over document structure.

14. Preserve factual accuracy.

15. Return only data that fits the provided JSON schema.

16. Never generate commentary outside the JSON response.

17. After extracting all known schema fields, detect any meaningful markdown sections that were NOT mapped into existing structured fields (e.g., custom sections like Compensation Benchmark, Candidate Risks, etc.). Preserve their original section heading as the 'title' and store their body content as plain markdown 'content' in 'dynamicSections'. Do not duplicate sections that already exist in structured fields. Only include unmapped sections. Avoid creating noisy sections for tiny fragments or empty headings. Preserve markdown formatting inside content.

18. ALWAYS include the 'schemaVersion' field at the root level of the JSON response and set its value to the exact string "v3". This is essential for schema versioning (v1: original, v2: extended, v3: dynamic sections).`;

    const prompt = `Báo cáo Insight Tuyển dụng (Hiring Insights) dạng Markdown cần trích xuất:
"""
${markdownReport}
"""

Tiêu đề vị trí (nếu có): "${title || ""}"

Hãy phân tích báo cáo trên và trích xuất dữ liệu JSON có cấu trúc chính xác theo đúng schema yêu cầu.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        schemaVersion: { type: Type.STRING, description: "Schema version of this report, always 'v3'" },
        title: { type: Type.STRING },
        roleOverview: {
          type: Type.OBJECT,
          properties: {
            dept: { type: Type.STRING },
            reportingLine: { type: Type.STRING },
            salaryRange: { type: Type.STRING },
            location: { type: Type.STRING }
          },
          required: ["dept", "reportingLine", "salaryRange", "location"]
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
            whyTheseCompanies: { type: Type.STRING },
            category: { type: Type.STRING },
            targetTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
            targetReason: { type: Type.STRING }
          },
          required: ["directCompetitors", "similarBusinessModels", "transferableTalent", "whyTheseCompanies"]
        },
        positionIntelligence: {
          type: Type.OBJECT,
          properties: {
            natureOfRole: { type: Type.STRING },
            dayToDayChallenges: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Major daily operational challenges"
            },
            hiddenExpectations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Implicit expectations from hiring managers or company culture"
            },
            keySuccessFactors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Critical success factors for high performance"
            },
            commonCandidateBackgrounds: { type: Type.ARRAY, items: { type: Type.STRING } },
            commonReasonsCandidatesFail: { type: Type.ARRAY, items: { type: Type.STRING } },
            transferableBackgrounds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Alternative backgrounds that could transition into this role"
            },
            businessProblemToSolve: { type: Type.STRING },
            commonFailureReasons: { type: Type.ARRAY, items: { type: Type.STRING } },
            roleNature: {
              type: Type.STRING,
              description: "Nature of the role and actual day-to-day responsibilities"
            }
          },
          required: ["natureOfRole", "dayToDayChallenges", "hiddenExpectations", "keySuccessFactors", "commonCandidateBackgrounds", "commonReasonsCandidatesFail", "transferableBackgrounds"]
        },
        candidatePersonaObj: {
          type: Type.OBJECT,
          properties: {
            yearsOfExperience: { type: Type.STRING },
            industryBackground: { type: Type.STRING },
            functionalBackground: { type: Type.STRING },
            languageRequirements: { type: Type.STRING },
            personalityTraits: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["yearsOfExperience", "industryBackground", "functionalBackground", "languageRequirements", "personalityTraits"]
        },
        talentMarketInsight: {
          type: Type.OBJECT,
          properties: {
            talentPoolDifficulty: { type: Type.STRING },
            hiringChallenges: { type: Type.ARRAY, items: { type: Type.STRING } },
            counterOfferRisk: { type: Type.STRING },
            salaryCompetitiveness: { type: Type.STRING },
            noticePeriodRisk: { type: Type.STRING }
          },
          required: ["talentPoolDifficulty", "hiringChallenges", "counterOfferRisk", "salaryCompetitiveness", "noticePeriodRisk"]
        },
        candidateSellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        recruitmentStrategy: {
          type: Type.OBJECT,
          properties: {
            whereToSource: { type: Type.ARRAY, items: { type: Type.STRING } },
            companiesToTargetFirst: { type: Type.ARRAY, items: { type: Type.STRING } },
            challengesAndMitigations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["whereToSource", "companiesToTargetFirst", "challengesAndMitigations"]
        },
        booleanSearchQueries: {
          type: Type.OBJECT,
          properties: {
            linkedin: { type: Type.STRING },
            cvDb: { type: Type.STRING },
            xray: { type: Type.STRING },
            industry: { type: Type.STRING },
            japanese: { type: Type.STRING }
          },
          required: ["linkedin", "cvDb", "xray", "industry", "japanese"]
        },
        companyInsights: {
          type: Type.OBJECT,
          properties: {
            companyName: { type: Type.STRING },
            industry: { type: Type.STRING },
            businessModel: { type: Type.STRING },
            companyStage: { type: Type.STRING },
            cultureHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            employeeValueProposition: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        },
        candidatePersona: {
          type: Type.OBJECT,
          properties: {
            targetAge: { type: Type.STRING },
            targetGender: { type: Type.STRING },
            experience: { type: Type.STRING },
            industries: { type: Type.ARRAY, items: { type: Type.STRING } },
            languages: { type: Type.ARRAY, items: { type: Type.STRING } },
            certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
            technicalSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            personalityTraits: { type: Type.ARRAY, items: { type: Type.STRING } },
            dealBreakers: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        },
        discoveryQuestions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              priority: { type: Type.STRING },
              whyAsk: { type: Type.STRING },
              impact: { type: Type.STRING },
              category: {
                type: Type.STRING,
                description: "Priority Questions, Critical Questions, Important Questions, Nice To Know Questions"
              }
            }
          }
        },
        sourcingStrategy: {
          type: Type.OBJECT,
          properties: {
            priorityCompanies: { type: Type.ARRAY, items: { type: Type.STRING } },
            booleanSearchQueries: { type: Type.ARRAY, items: { type: Type.STRING } },
            pitchingStrategies: { type: Type.ARRAY, items: { type: Type.STRING } },
            objectionHandling: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  objection: { type: Type.STRING },
                  handling: { type: Type.STRING }
                }
              }
            },
            headhunterNotes: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        },
        socialMediaPost: {
          type: Type.OBJECT,
          properties: {
            facebookPost: { type: Type.STRING }
          }
        },
        dynamicSections: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING }
            }
          }
        }
      },
      required: ["title", "roleOverview", "companyContext", "idealPersona", "mustHave", "niceToHave", "questionsForClient", "booleanSearch", "socialPost", "interviewQuestions", "competitorCompanies", "positionIntelligence", "candidatePersonaObj", "talentMarketInsight", "candidateSellingPoints", "recruitmentStrategy", "booleanSearchQueries"]
    };

    const result = await callLLM({
      provider,
      apiKey,
      model,
      customEndpoint,
      prompt,
      systemInstruction,
      responseSchema,
    });

    const parsed = safeParseJson(result.text);
    console.log("Structured fields extraction result before normalization:", parsed);

    // Normalize newly added optional fields to prevent null values or empty properties
    if (parsed && typeof parsed === "object") {
      parsed.schemaVersion = "v3";
      // 1. positionIntelligence fields
      if (parsed.positionIntelligence && typeof parsed.positionIntelligence === "object") {
        parsed.positionIntelligence.roleNature = parsed.positionIntelligence.roleNature || "";
        parsed.positionIntelligence.dayToDayChallenges = parsed.positionIntelligence.dayToDayChallenges || [];
        parsed.positionIntelligence.hiddenExpectations = parsed.positionIntelligence.hiddenExpectations || [];
        parsed.positionIntelligence.keySuccessFactors = parsed.positionIntelligence.keySuccessFactors || [];
        parsed.positionIntelligence.transferableBackgrounds = parsed.positionIntelligence.transferableBackgrounds || [];
        parsed.positionIntelligence.businessProblemToSolve = parsed.positionIntelligence.businessProblemToSolve || "";
        parsed.positionIntelligence.commonFailureReasons = parsed.positionIntelligence.commonFailureReasons || [];
      } else {
        parsed.positionIntelligence = {
          natureOfRole: "",
          dayToDayChallenges: [],
          hiddenExpectations: [],
          keySuccessFactors: [],
          commonCandidateBackgrounds: [],
          commonReasonsCandidatesFail: [],
          transferableBackgrounds: [],
          businessProblemToSolve: "",
          commonFailureReasons: [],
          roleNature: ""
        };
      }

      // 2. discoveryQuestions fields
      if (Array.isArray(parsed.discoveryQuestions)) {
        parsed.discoveryQuestions = parsed.discoveryQuestions.map((q: any) => {
          if (q && typeof q === "object") {
            return {
              question: q.question || "",
              priority: q.priority || "",
              whyAsk: q.whyAsk || "",
              impact: q.impact || "",
              category: q.category || ""
            };
          }
          return { question: "", priority: "", whyAsk: "", impact: "", category: "" };
        });
      } else {
        parsed.discoveryQuestions = [];
      }

      // 3. companyInsights
      if (parsed.companyInsights && typeof parsed.companyInsights === "object") {
        parsed.companyInsights.companyName = parsed.companyInsights.companyName || "";
        parsed.companyInsights.industry = parsed.companyInsights.industry || "";
        parsed.companyInsights.businessModel = parsed.companyInsights.businessModel || "";
        parsed.companyInsights.companyStage = parsed.companyInsights.companyStage || "";
        parsed.companyInsights.cultureHighlights = parsed.companyInsights.cultureHighlights || [];
        parsed.companyInsights.employeeValueProposition = parsed.companyInsights.employeeValueProposition || [];
      } else {
        parsed.companyInsights = {
          companyName: "",
          industry: "",
          businessModel: "",
          companyStage: "",
          cultureHighlights: [],
          employeeValueProposition: []
        };
      }

      // 4. candidatePersona
      if (parsed.candidatePersona && typeof parsed.candidatePersona === "object") {
        parsed.candidatePersona.targetAge = parsed.candidatePersona.targetAge || "";
        parsed.candidatePersona.targetGender = parsed.candidatePersona.targetGender || "";
        parsed.candidatePersona.experience = parsed.candidatePersona.experience || "";
        parsed.candidatePersona.industries = parsed.candidatePersona.industries || [];
        parsed.candidatePersona.languages = parsed.candidatePersona.languages || [];
        parsed.candidatePersona.certifications = parsed.candidatePersona.certifications || [];
        parsed.candidatePersona.technicalSkills = parsed.candidatePersona.technicalSkills || [];
        parsed.candidatePersona.personalityTraits = parsed.candidatePersona.personalityTraits || [];
        parsed.candidatePersona.dealBreakers = parsed.candidatePersona.dealBreakers || [];
      } else {
        parsed.candidatePersona = {
          targetAge: "",
          targetGender: "",
          experience: "",
          industries: [],
          languages: [],
          certifications: [],
          technicalSkills: [],
          personalityTraits: [],
          dealBreakers: []
        };
      }

      // 5. sourcingStrategy
      if (parsed.sourcingStrategy && typeof parsed.sourcingStrategy === "object") {
        parsed.sourcingStrategy.priorityCompanies = parsed.sourcingStrategy.priorityCompanies || [];
        parsed.sourcingStrategy.booleanSearchQueries = parsed.sourcingStrategy.booleanSearchQueries || [];
        parsed.sourcingStrategy.pitchingStrategies = parsed.sourcingStrategy.pitchingStrategies || [];
        if (Array.isArray(parsed.sourcingStrategy.objectionHandling)) {
          parsed.sourcingStrategy.objectionHandling = parsed.sourcingStrategy.objectionHandling.map((o: any) => ({
            objection: o?.objection || "",
            handling: o?.handling || ""
          }));
        } else {
          parsed.sourcingStrategy.objectionHandling = [];
        }
        parsed.sourcingStrategy.headhunterNotes = parsed.sourcingStrategy.headhunterNotes || [];
      } else {
        parsed.sourcingStrategy = {
          priorityCompanies: [],
          booleanSearchQueries: [],
          pitchingStrategies: [],
          objectionHandling: [],
          headhunterNotes: []
        };
      }

      // 6. socialMediaPost
      if (parsed.socialMediaPost && typeof parsed.socialMediaPost === "object") {
        parsed.socialMediaPost.facebookPost = parsed.socialMediaPost.facebookPost || "";
      } else {
        parsed.socialMediaPost = {
          facebookPost: ""
        };
      }

      // 7. competitorCompanies extra properties
      if (parsed.competitorCompanies && typeof parsed.competitorCompanies === "object") {
        parsed.competitorCompanies.category = parsed.competitorCompanies.category || "";
        parsed.competitorCompanies.targetTitles = parsed.competitorCompanies.targetTitles || [];
        parsed.competitorCompanies.targetReason = parsed.competitorCompanies.targetReason || "";
      } else {
        parsed.competitorCompanies = {
          directCompetitors: [],
          similarBusinessModels: [],
          transferableTalent: [],
          whyTheseCompanies: "",
          category: "",
          targetTitles: [],
          targetReason: ""
        };
      }

      // 8. talentMarketInsight extra properties
      if (parsed.talentMarketInsight && typeof parsed.talentMarketInsight === "object") {
        parsed.talentMarketInsight.salaryCompetitiveness = parsed.talentMarketInsight.salaryCompetitiveness || "";
        parsed.talentMarketInsight.counterOfferRisk = parsed.talentMarketInsight.counterOfferRisk || "";
        parsed.talentMarketInsight.noticePeriodRisk = parsed.talentMarketInsight.noticePeriodRisk || "";
      } else {
        parsed.talentMarketInsight = {
          talentPoolDifficulty: "",
          hiringChallenges: [],
          counterOfferRisk: "",
          salaryCompetitiveness: "",
          noticePeriodRisk: ""
        };
      }

      // 9. dynamicSections
      if (Array.isArray(parsed.dynamicSections)) {
        parsed.dynamicSections = parsed.dynamicSections.map((ds: any) => ({
          title: ds?.title || "",
          content: ds?.content || ""
        })).filter((ds: any) => ds.title.trim() !== "");
      } else {
        parsed.dynamicSections = [];
      }
    }

    console.log("Structured fields extraction result after normalization:", parsed);
    res.json(parsed);

  } catch (error) {
    console.error("LLM Extract Structured Fields Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
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