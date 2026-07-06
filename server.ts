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
        finalPrompt = promptTemplate.replace(/\\?\$\{currentClientName\}/g, clientName);
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
Nhiệm vụ của bạn là phân tích Bản mô tả công việc (Job Description) kết hợp với Insights Công ty (Company Intelligence Profile) để tạo ra một Insight Tuyển dụng (Hiring Insights) toàn diện, sắc bén và thực chiến bằng tiếng Việt.

YÊU CẦU ĐẶC BIỆT: TÍCH HỢP SÂU THÔNG TIN KHÁCH HÀNG (CLIENT INSIGHTS)
Bạn PHẢI sử dụng triệt để các dữ kiện thực tế và thông tin cốt lõi từ "Company Intelligence Profile" ở dưới (bao gồm vị thế ngành, mô hình kinh doanh, văn hóa công ty, đối thủ cạnh tranh trực tiếp/gián tiếp, địa điểm nhà máy/văn phòng/chi nhánh sản xuất...) để liên kết và phân tích sâu sắc các phần trong Báo cáo tuyển dụng cuối cùng.
Ví dụ:
- Trong phần "Bối cảnh Công ty (Company Context) & Văn hóa phù hợp": Phải nêu bật vị thế ngành, mô hình kinh doanh, địa điểm hoạt động/nhà máy và môi trường làm việc từ bước nghiên cứu khách hàng.
- Trong phần "Chiến lược tuyển dụng & Sourcing (Recruitment Strategy)" và "Thấu hiểu Thị trường": Sử dụng trực tiếp danh sách các đối thủ cạnh tranh cụ thể từ "Company Intelligence Profile" để làm mục tiêu target ứng viên.
TUYỆT ĐỐI không được bỏ quên hoặc làm nhạt đi các dữ kiện thực tế quan trọng này.

Thông tin Công ty (Company Intelligence Profile):
"""
\${companyReport}
"""

Bản mô tả công việc (Job Description):
"""
\${jobDescription}
"""

Hãy tạo một bộ Insight Tuyển dụng toàn diện dưới dạng Markdown, cấu trúc chuyên nghiệp, phân tích sâu sắc các khái niệm sau:
1. Tổng quan vị trí (Role Overview): Tên vị trí, Phòng ban, Cấp trên trực tiếp, Khoảng lương dự kiến, Địa điểm làm việc.
2. Bối cảnh Công ty (Company Context) & Văn hóa phù hợp.
3. Chân dung ứng viên lý tưởng (Ideal Persona): Kinh nghiệm, ngành nghề, kỹ năng cứng bắt buộc (Must-have), kỹ năng ưu tiên (Nice-to-have), đặc điểm tính cách.
4. Trí tuệ Vị trí (Position Intelligence): Bản chất công việc, thách thức thực tế hàng ngày, kỳ vọng ẩn giấu từ nhà tuyển dụng, các yếu tố quyết định thành công của ứng viên.
5. Thấu hiểu Thị trường Tài năng (Talent Market Insight): Độ khó của nguồn cung, rủi ro counter-offer, tính cạnh tranh của mức lương, rủi ro notice period.
6. Chiến lược tuyển dụng & Sourcing (Recruitment Strategy): Sourcing channels, các công ty mục tiêu để target ứng viên trước tiên, phương án xử lý thách thức.
7. Công cụ tìm kiếm (Boolean Search Queries): Viết sẵn các mẫu câu lệnh tìm kiếm thực chiến ngắn gọn cho LinkedIn Recruiter, CV Database, X-Ray Search, và các bộ lọc theo ngành.
8. Gợi ý bài đăng tuyển dụng thu hút (Social Post / JD tóm tắt) & Bộ câu hỏi phỏng vấn gợi ý cho Consultant (Interview Questions / Questions for Client).

LƯU Ý QUAN TRỌNG:
- TUYỆT ĐỐI GIỮ NGUYÊN các thuật ngữ chuyên ngành và tiêu đề chính bằng tiếng Anh (Ví dụ: "Hiring Insights", "Client Insights", "Company Intelligence Profile", "Competitors & Sourcing Targets", "Recruitment Strategy", v.v.). KHÔNG DỊCH các thuật ngữ/tiêu đề này sang tiếng Việt (như "Hồ sơ Tình báo Doanh nghiệp" hay "Insight Tuyển dụng"). Nội dung chi tiết viết bằng tiếng Việt nhưng giữ các heading chuẩn HR bằng tiếng Anh.
- Trình bày toàn bộ tài liệu bằng định dạng Markdown đẹp mắt, có tiêu đề (Headings), danh sách (Bullet points), bảng biểu hoặc định dạng đậm nhạt rõ ràng.
- KHÔNG trả về định dạng JSON hay bất cứ thông tin thừa nào khác ngoài nội dung Markdown.
- Sử dụng ngôn phong tự nhiên, sắc bén, mang tính tư vấn cao của một Senior Consultant thực thụ.`;

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

16. Never generate commentary outside the JSON response.`;

    const prompt = `Báo cáo Insight Tuyển dụng (Hiring Insights) dạng Markdown cần trích xuất:
"""
${markdownReport}
"""

Tiêu đề vị trí (nếu có): "${title || ""}"

Hãy phân tích báo cáo trên và trích xuất dữ liệu JSON có cấu trúc chính xác theo đúng schema yêu cầu.`;

    const responseSchema = {
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