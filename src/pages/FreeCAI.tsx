import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Btn } from '../components/ui';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, getDocs } from 'firebase/firestore';

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
  versions?: { date: string; rawInput: string; snapshot: JobReport }[];
};

type JobReport = {
  markdownReport?: string;
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
  competitorCompanies?: {
    directCompetitors?: string[];
    similarBusinessModels?: string[];
    transferableTalent?: string[];
    whyTheseCompanies?: string;
  };
  positionIntelligence?: {
    natureOfRole?: string;
    dayToDayChallenges?: string[];
    hiddenExpectations?: string[];
    keySuccessFactors?: string[];
    commonCandidateBackgrounds?: string[];
    commonReasonsCandidatesFail?: string[];
    transferableBackgrounds?: string[];
  };
  candidatePersonaObj?: {
    yearsOfExperience?: string;
    industryBackground?: string;
    functionalBackground?: string;
    languageRequirements?: string;
    personalityTraits?: string[];
  };
  talentMarketInsight?: {
    talentPoolDifficulty?: string;
    hiringChallenges?: string[];
    counterOfferRisk?: string;
    salaryCompetitiveness?: string;
    noticePeriodRisk?: string;
  };
  candidateSellingPoints?: string[];
  recruitmentStrategy?: {
    whereToSource?: string[];
    companiesToTargetFirst?: string[];
    challengesAndMitigations?: string[];
  };
  booleanSearchQueries?: {
    linkedin?: string;
    cvDb?: string;
    xray?: string;
    industry?: string;
    japanese?: string;
  };
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

const DEFAULT_COMPANY_RESEARCH_PROMPT = `Bạn là một chuyên gia nghiên cứu thị trường và Chuyên viên Tư vấn Tuyển dụng Cấp cao.
Nhiệm vụ của bạn là nghiên cứu và xây dựng một Báo cáo Trí tuệ Công ty (Company Intelligence Report) chi tiết cho khách hàng sau:

Tên công ty khách hàng: \${currentClientName}

Hãy thu thập, phân tích và tổng hợp các thông tin cốt lõi sau dưới dạng Markdown trôi chảy, chuyên nghiệp bằng tiếng Việt:
1. Tổng quan về mô hình kinh doanh, sản phẩm/dịch vụ cốt lõi, và vị thế trong ngành.
2. Văn hóa doanh nghiệp, phong cách làm việc và môi trường công sở dự kiến.
3. Các tin tức nổi bật, công nghệ sử dụng, cấu trúc tổ chức chính (nếu có).
4. Các từ khóa thông tin quan trọng nhất cần ghi nhớ khi làm việc với đối tác này.

Chú ý: Hãy đưa ra các phân tích có giá trị thực chiến cho tuyển dụng. Tránh bịa đặt số liệu không có thật. Viết rõ ràng bằng Markdown.`;

const DEFAULT_RECRUITMENT_INTELLIGENCE_PROMPT = `Bạn là một Senior Headhunter và Recruitment Consultant với hơn 15 năm kinh nghiệm tại Việt Nam và APAC.
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

function extractJobTitle(markdown: string, rawInput: string): string {
  const lines = markdown.split("\n");
  
  // 1. Try to find the main title header, which often has the format: # Báo cáo ... - Title
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      const parts = trimmed.split("-");
      if (parts.length > 1) {
        return parts[parts.length - 1].trim();
      }
      // If no hyphen, but it's a header and doesn't look like a generic title
      const title = trimmed.replace(/^#+\s*/, "").trim();
      if (title && !/^(Report|Intelligence|Báo cáo|Tổng quan|Trí tuệ Tuyển dụng)$/i.test(title)) {
        return title;
      }
    }
  }

  // 2. Try looking for specific key-value pairs in the markdown
  const positionMatch = markdown.match(/(?:\*\*|)?(?:Vị trí|Position|Role|Job Title)(?:\*\*|)?\s*:\s*([^\n]+)/i);
  if (positionMatch && positionMatch[1]) {
    return positionMatch[1].replace(/\*\*$/, "").trim();
  }

  // 3. Fallback to raw input extraction
  const inputTitleMatch = rawInput.match(/^(?:Job|Vị trí|Title|Position|Job Title):\s*([^\n\r]+)/im);
  if (inputTitleMatch) return inputTitleMatch[1].trim();

  const firstLine = rawInput.split("\n")[0].trim();
  if (firstLine && firstLine.length > 5 && firstLine.length < 100) return firstLine;

  const inputWords = rawInput.split(/\s+/).filter(Boolean);
  if (inputWords.length > 0) {
    return inputWords.slice(0, 5).join(" ") + "...";
  }
  return "Báo cáo Tuyển dụng mới";
}

const DEFAULT_SYSTEM_PROMPT = `Bạn là một Senior Headhunter và Recruitment Consultant với hơn 15 năm kinh nghiệm tại Việt Nam và APAC.

Bạn không phải là một JD parser.

Mục tiêu của bạn là giúp consultant:
1. Hiểu công ty.
2. Hiểu thị trường.
3. Hiểu bản chất của vị trí.
4. Biết nên tìm ứng viên ở đâu.
5. Biết cách bán job cho ứng viên.
6. Biết những rủi ro tuyển dụng có thể xảy ra.
7. Có thể bắt đầu sourcing ngay sau khi đọc báo cáo.

==================================================
CORE PRINCIPLES
==================================================

Không được chỉ lặp lại JD.

Phải sử dụng:
- Kiến thức tuyển dụng;
- Kiến thức ngành;
- Kinh nghiệm headhunt;
- Hiểu biết về thị trường lao động.

Mỗi insight phải giúp consultant hành động được.

Báo cáo phải mang tính tư vấn (consultative), thực chiến (actionable), không chỉ mang tính mô tả (descriptive).

==================================================
FACT VS INFERENCE (QUY TẮC CHỐNG LẶP & GHI NHÃN)
==================================================

Mọi thông tin phải được phân loại và xử lý cẩn thận:

FACT: Có trong JD, website, LinkedIn chính thức hoặc nguồn đáng tin cậy.
INFERENCE: Suy luận hợp lý từ dữ liệu có sẵn.

CẢNH BÁO QUAN TRỌNG CHỐNG LẶP VÔ HẠN:
- TUYỆT ĐỐI KHÔNG ghi chú hoặc thêm các nhãn đóng/mở ngoặc lặp đi lặp lại như "(Fact: ...)", "(Inference: ...)", "(Dựa trên...)" vào cuối mỗi câu hoặc từng ý nhỏ. Việc này làm báo cáo cực kỳ lộn xộn, mất tính chuyên nghiệp, và làm AI bị lặp từ vô hạn gây lỗi hệ thống.
- Hãy viết nội dung một cách tự nhiên, trôi chảy dưới góc nhìn của chuyên gia tư vấn. Nếu là suy luận, hãy dùng các cụm từ diễn đạt tự nhiên như: "Dựa trên thực tế tuyển dụng...", "Nhiều khả năng...", "Có thể nhận định...", "Từ góc độ thị trường..." thay vì sử dụng nhãn đóng mở ngoặc.

Không được trình bày INFERENCE như FACT.

Không được tự bịa:
- doanh thu;
- số lượng nhân sự;
- lương thưởng;
- tình hình tài chính;
- kế hoạch kinh doanh;
- thông tin nội bộ chưa được xác minh.

Nếu thông tin không thể xác minh:
- Ghi nhận rõ "Not verified" hoặc "Chưa xác minh".

==================================================
COMPANY RESEARCH
==================================================

Bạn được phép nghiên cứu:
1. Official Website
2. Official LinkedIn Company Page
3. Reliable News Sources

Mục tiêu cho công ty "\${currentClientName}":
- Industry
- Products
- Services
- Markets
- Business Model
- Company Size (nếu xác minh được)
- Employer Value Proposition (EVP)
- Competitor Companies
- Company Culture (nếu có căn cứ)

==================================================
COMPETITOR & TARGET COMPANIES
==================================================

Nếu xác định được ngành nghề và mô hình kinh doanh của client, hãy đề xuất CỤ THỂ tên công ty.

Mục tiêu của competitor analysis không phải là nghiên cứu thị trường.
Mục tiêu là xác định nơi những ứng viên phù hợp nhất đang làm việc.

Bao gồm:
1. Direct Competitors (Đối thủ trực tiếp)
2. Similar Business Models (Mô hình kinh doanh tương đồng)
3. Companies with Transferable Talent (Công ty có ứng viên sở hữu kỹ năng chuyển đổi tương ứng)
4. Priority Target Companies (Công ty mục tiêu ưu tiên tuyển dụng)

==================================================
POSITION INTELLIGENCE
==================================================

Không được copy lại JD.

Phải giải thích rõ:
- Nature of the Role (Bản chất vai trò thực sự giải quyết vấn đề gì cho doanh nghiệp?)
- Day-to-day Challenges (Thách thức hàng ngày thực tế mà vị trí này sẽ gặp phải)
- Hidden Expectations (Những kỳ vọng ẩn, không ghi trên JD nhưng Hiring Manager chắc chắn sẽ soi kỹ)
- Key Success Factors (Yếu tố cốt lõi để thành công vượt trội trong vai trò này)
- Common Candidate Backgrounds (Background phổ biến của những người làm tốt vai trò này)
- Common Reasons Candidates Fail (Lý do phổ biến nhất khiến ứng viên trượt phỏng vấn hoặc thử việc)
- Transferable Backgrounds (Các background/ngành nghề khác có thể chuyển đổi sang và thích nghi tốt)

==================================================
CANDIDATE PERSONA
==================================================

Phân tích chân dung ứng viên lý tưởng:
- Years of Experience
- Industry Background
- Functional Background
- Language Requirements
- Personality Traits

==================================================
TALENT MARKET INSIGHT
==================================================

Đánh giá thị trường nhân tài cho vị trí này:
- Talent Pool Difficulty (Độ khan hiếm nguồn cung nhân tài)
- Hiring Challenges (Các khó khăn tuyển dụng lớn nhất)
- Counter Offer Risk (Nguy cơ bị công ty hiện tại giữ lại bằng counter-offer)
- Salary Competitiveness (Mức độ cạnh tranh của dải lương hiện tại trên thị trường)
- Notice Period Risk (Rủi ro về thời gian bàn giao/báo trước của ứng viên)

==================================================
CANDIDATE SELLING POINTS
==================================================

Phân tích điểm bán hàng (EVP & Pitching angles):
- Tại sao ứng viên nên gia nhập công ty này? Điểm hấp dẫn của vị trí này là gì?
- Consultant nên dùng câu chuyện/điểm cốt lõi nào để thuyết phục (bán job) cho ứng viên?
- Cơ hội phát triển nghề nghiệp lâu dài tại đây?

==================================================
RECRUITMENT STRATEGY
==================================================

Đề xuất chiến lược Sourcing & Tiếp cận:
- Sourcing Channels (Nên tìm ở kênh nào hiệu quả nhất?)
- Target Companies (Nhóm công ty ưu tiên săn đón)
- Sourcing Priorities & Potential Challenges (Thứ tự ưu tiên và khó khăn khi tiếp cận)
- Alternative Talent Pools (Nguồn ứng viên thay thế sáng tạo)

==================================================
BOOLEAN SEARCH
==================================================

KHÔNG tạo một đoạn Boolean dài lê thê. Hãy tạo riêng:
1. LinkedIn Recruiter Search
2. CV Database Search
3. X-Ray Search
4. Industry Search
5. Japanese Search (nếu phù hợp)

Yêu cầu Boolean: ngắn, thực tế, dễ copy-paste, chuẩn xác theo hành vi tìm kiếm thực tế của Senior Recruiter.

==================================================
FINAL SELF-CHECK
==================================================

Trước khi trả kết quả, hãy tự hỏi:
"Nếu tôi là consultant chưa từng tuyển vị trí này, liệu báo cáo này đã đủ giúp tôi:
1. Hiểu công ty?
2. Hiểu vị trí?
3. Hiểu thị trường?
4. Biết tìm ứng viên ở đâu?
5. Biết cách bán job?
6. Hiểu các rủi ro tuyển dụng?
7. Có thể bắt đầu sourcing ngay?"

Nếu câu trả lời là chưa, hãy bổ sung thêm recruitment insights.

==================================================
LANGUAGE & STYLE INSTRUCTIONS
==================================================
Báo cáo phải được viết chủ yếu bằng tiếng Việt, nhưng có sự kết hợp tự nhiên, khéo léo với các thuật ngữ tiếng Anh chuyên ngành nhân sự và tuyển dụng tại Việt Nam (ví dụ: Job Title, JD, Candidate Persona, Sourcing Channel, EVP, CV, Portfolio, Tech Stack, Must Have, Nice to Have, Headcount, Notice Period, Counter Offer, v.v.).
- Viết theo phong cách chuyên nghiệp, sắc sảo, tự tin của một Headhunter Senior tư vấn cho đồng nghiệp hoặc đối tác.
- Các ý cần ngắn gọn, súc tích, dạng bullet-points gãy gọn, có chiều sâu thực chiến cao.

--------------------------------------------------
INPUT INFORMATION TO ANALYZE:
--------------------------------------------------
Hãy phân tích nội dung JD, ghi chú cuộc họp hoặc email sau đây của client "\${currentClientName}":
"""
\${input}
"""`;

const LOCAL_STORAGE_KEY = 'freec_ai_clients_v2';

const cleanUndefined = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        res[key] = cleanUndefined(val);
      }
    }
    return res;
  }
  return obj;
};

export function FreeCAI({ toast }: { toast: (msg: string, type: 'success'|'error') => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [companyResearchPrompt, setCompanyResearchPrompt] = useState<string>("");
  const [recruitmentIntelligencePrompt, setRecruitmentIntelligencePrompt] = useState<string>("");
  const [activePromptSubTab, setActivePromptSubTab] = useState<'company' | 'recruitment'>('company');
  const [processingStep, setProcessingStep] = useState<number>(0);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<'api' | 'prompt'>('api');
  const [userProvider, setUserProvider] = useState<string>(() => localStorage.getItem('freec_ai_provider') || 'system');
  const [userApiKey, setUserApiKey] = useState<string>(() => localStorage.getItem('freec_ai_api_key') || localStorage.getItem('freec_ai_user_gemini_key') || "");
  const [userModel, setUserModel] = useState<string>(() => localStorage.getItem('freec_ai_model') || "");
  const [userCustomEndpoint, setUserCustomEndpoint] = useState<string>(() => localStorage.getItem('freec_ai_custom_endpoint') || "");

  const [tempProvider, setTempProvider] = useState(userProvider);
  const [tempKey, setTempKey] = useState(userApiKey);
  const [tempModel, setTempModel] = useState(userModel);
  const [tempEndpoint, setTempEndpoint] = useState(userCustomEndpoint);

  // Sync with global custom keys when configuration modal is opened
  useEffect(() => {
    if (isAiSettingsOpen) {
      const provider = localStorage.getItem('freec_ai_provider') || 'system';
      const key = localStorage.getItem('freec_ai_api_key') || localStorage.getItem('freec_ai_user_gemini_key') || "";
      const model = localStorage.getItem('freec_ai_model') || "";
      const endpoint = localStorage.getItem('freec_ai_custom_endpoint') || "";

      setUserProvider(provider);
      setUserApiKey(key);
      setUserModel(model);
      setUserCustomEndpoint(endpoint);

      setTempProvider(provider);
      setTempKey(key);
      setTempModel(model);
      setTempEndpoint(endpoint);
    }
  }, [isAiSettingsOpen]);

  const handleCopySection = (text: string, label: string) => {
    navigator.clipboard.writeText(text || "")
      .then(() => toast(`Đã copy ${label}`, "success"))
      .catch(() => toast("Copy thất bại", "error"));
  };

  const getAiHeaders = () => {
    let effectiveProvider = localStorage.getItem('freec_ai_provider') || 'system';
    let effectiveKey = localStorage.getItem('freec_ai_api_key') || localStorage.getItem('freec_ai_user_gemini_key') || "";
    let effectiveModel = localStorage.getItem('freec_ai_model') || "";
    let effectiveEndpoint = localStorage.getItem('freec_ai_custom_endpoint') || "";

    if (effectiveProvider === 'system') {
      effectiveProvider = localStorage.getItem("ai_provider") || "gemini";
      
      // Load corresponding custom key
      if (effectiveProvider === 'gemini') {
        effectiveKey = localStorage.getItem("custom_gemini_api_key") || "";
        effectiveModel = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
        effectiveEndpoint = localStorage.getItem("gemini_proxy_url") || "";
      } else if (effectiveProvider === 'openai') {
        effectiveKey = localStorage.getItem("custom_openai_api_key") || "";
        effectiveModel = localStorage.getItem("openai_model") || "gpt-4o-mini";
      } else if (effectiveProvider === 'grok') {
        effectiveKey = localStorage.getItem("custom_grok_api_key") || "";
        effectiveModel = "grok-2-latest";
      } else if (effectiveProvider === 'groq') {
        effectiveKey = localStorage.getItem("custom_groq_api_key") || "";
        effectiveModel = localStorage.getItem("groq_model") || "llama-3.3-70b-versatile";
      } else if (effectiveProvider === 'cerebras') {
        effectiveKey = localStorage.getItem("custom_cerebras_api_key") || "";
        effectiveModel = localStorage.getItem("cerebras_model") || "qwen-3-235b-a22b-instruct-2507";
      } else if (effectiveProvider === 'qwen') {
        effectiveKey = localStorage.getItem("custom_qwen_api_key") || "";
        effectiveModel = localStorage.getItem("qwen_model") || "qwen-plus";
      } else if (effectiveProvider === 'github') {
        effectiveKey = localStorage.getItem("custom_github_pat") || "";
        effectiveModel = localStorage.getItem("custom_github_model") || "openai/gpt-4o";
      }
    } else {
      // If they chose a specific provider, but left the key blank, also fallback to the global key of that specific provider
      if (!effectiveKey) {
        if (effectiveProvider === 'gemini') {
          effectiveKey = localStorage.getItem("custom_gemini_api_key") || "";
          if (!effectiveModel) effectiveModel = localStorage.getItem("gemini_model") || "gemini-3.5-flash";
          if (!effectiveEndpoint) effectiveEndpoint = localStorage.getItem("gemini_proxy_url") || "";
        } else if (effectiveProvider === 'openai') {
          effectiveKey = localStorage.getItem("custom_openai_api_key") || "";
          if (!effectiveModel) effectiveModel = localStorage.getItem("openai_model") || "gpt-4o-mini";
        } else if (effectiveProvider === 'grok') {
          effectiveKey = localStorage.getItem("custom_grok_api_key") || "";
          if (!effectiveModel) effectiveModel = "grok-2-latest";
        } else if (effectiveProvider === 'groq') {
          effectiveKey = localStorage.getItem("custom_groq_api_key") || "";
          if (!effectiveModel) effectiveModel = localStorage.getItem("groq_model") || "llama-3.3-70b-versatile";
        } else if (effectiveProvider === 'cerebras') {
          effectiveKey = localStorage.getItem("custom_cerebras_api_key") || "";
          if (!effectiveModel) effectiveModel = localStorage.getItem("cerebras_model") || "qwen-3-235b-a22b-instruct-2507";
        } else if (effectiveProvider === 'qwen') {
          effectiveKey = localStorage.getItem("custom_qwen_api_key") || "";
          if (!effectiveModel) effectiveModel = localStorage.getItem("qwen_model") || "qwen-plus";
        } else if (effectiveProvider === 'github') {
          effectiveKey = localStorage.getItem("custom_github_pat") || "";
          if (!effectiveModel) effectiveModel = localStorage.getItem("custom_github_model") || "openai/gpt-4o";
        }
      }
    }

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
    if (effectiveProvider === 'gemini' && !validGeminiModels.includes(effectiveModel)) {
      effectiveModel = "gemini-3.5-flash";
    }

    return {
      'Content-Type': 'application/json',
      'x-ai-provider': effectiveProvider,
      ...(effectiveKey ? { 'x-ai-key': effectiveKey } : {}),
      ...(effectiveModel ? { 'x-ai-model': effectiveModel } : {}),
      ...(effectiveEndpoint ? { 'x-ai-custom-endpoint': effectiveEndpoint } : {})
    };
  };

  const handleSaveApiSettings = (provider: string, key: string, model: string, endpoint: string) => {
    localStorage.setItem('freec_ai_provider', provider);
    localStorage.setItem('freec_ai_api_key', key.trim());
    localStorage.setItem('freec_ai_model', model.trim());
    localStorage.setItem('freec_ai_custom_endpoint', endpoint.trim());

    setUserProvider(provider);
    setUserApiKey(key.trim());
    setUserModel(model.trim());
    setUserCustomEndpoint(endpoint.trim());

    toast("Đã cập nhật cấu hình AI thành công!", "success");
  };

  const handleClearApiSettings = () => {
    localStorage.removeItem('freec_ai_provider');
    localStorage.removeItem('freec_ai_api_key');
    localStorage.removeItem('freec_ai_user_gemini_key');
    localStorage.removeItem('freec_ai_model');
    localStorage.removeItem('freec_ai_custom_endpoint');

    setUserProvider("system");
    setUserApiKey("");
    setUserModel("");
    setUserCustomEndpoint("");
    setTempProvider("system");
    setTempKey("");
    setTempModel("");
    setTempEndpoint("");

    toast("Đã đặt lại cấu hình AI mặc định (Hệ thống)!", "success");
  };

  useEffect(() => {
    signInAnonymously(auth).catch(err => {
      console.error("Anonymous sign-in failed:", err);
      if (err.code === 'auth/admin-restricted-operation' || err.code === 'auth/operation-not-allowed') {
        toast("Vui lòng bật Anonymous Sign-in trong Firebase Console (Authentication > Sign-in method)", "error");
      }
    });
    const q = query(collection(db, 'clients'));
    const unsubscribeClients = onSnapshot(q, (snapshot) => {
      const loaded: Client[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        loaded.push({
          ...data,
          id: data.id || docSnap.id
        } as Client);
      });
      setClients(loaded);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clients');
    });

    const unsubscribeCompanyPrompt = onSnapshot(doc(db, 'settings', 'companyResearchPrompt'), (docSnap) => {
      if (docSnap.exists()) {
        const val = docSnap.data().prompt || "";
        setCompanyResearchPrompt(val || DEFAULT_COMPANY_RESEARCH_PROMPT);
      } else {
        setCompanyResearchPrompt(DEFAULT_COMPANY_RESEARCH_PROMPT);
      }
    }, (err) => {
      console.error("Error fetching company research prompt:", err);
    });

    const unsubscribeRecruitmentPrompt = onSnapshot(doc(db, 'settings', 'recruitmentIntelligencePrompt'), (docSnap) => {
      if (docSnap.exists()) {
        const val = docSnap.data().prompt || "";
        setRecruitmentIntelligencePrompt(val || DEFAULT_RECRUITMENT_INTELLIGENCE_PROMPT);
      } else {
        setRecruitmentIntelligencePrompt(DEFAULT_RECRUITMENT_INTELLIGENCE_PROMPT);
      }
    }, (err) => {
      console.error("Error fetching recruitment intelligence prompt:", err);
    });

    return () => {
      unsubscribeClients();
      unsubscribeCompanyPrompt();
      unsubscribeRecruitmentPrompt();
    };
  }, []);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  const [selectedClientJobs, setSelectedClientJobs] = useState<Job[]>([]);
  const [selectedClientTimeline, setSelectedClientTimeline] = useState<{ id: string; date: string; content: string; rawInput?: string }[]>([]);

  // Draft and review states
  const [draftResult, setDraftResult] = useState<any | null>(null);
  const [isReviewingDraft, setIsReviewingDraft] = useState(false);
  const [rawInputUsed, setRawInputUsed] = useState("");
  const [activeReviewTab, setActiveReviewTab] = useState<'client' | 'markdown'>('client');

  // Job active tab and selected version index
  const [activeJobTab, setActiveJobTab] = useState<'report' | 'history'>('report');
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientWebsite, setNewClientWebsite] = useState("");
  const [newClientTagline, setNewClientTagline] = useState("");
  
  const [universalInput, setUniversalInput] = useState("");
  const [isProcessingInput, setIsProcessingInput] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'assistant', content: string}[]>([{role: 'assistant', content: 'Hi! I am your AI Copilot. Ask me anything about your clients or jobs.'}]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState("");

  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  // Reset active job tab and selected version index when switching jobs
  useEffect(() => {
    setActiveJobTab('report');
    setSelectedVersionIndex(null);
  }, [selectedJobId]);

  // Synchronize jobs and timeline from subcollections for the selected client
  useEffect(() => {
    if (!selectedClientId) {
      setSelectedClientJobs([]);
      setSelectedClientTimeline([]);
      return;
    }

    const jobsRef = collection(db, 'clients', selectedClientId, 'jobs');
    const unsubscribeJobs = onSnapshot(jobsRef, (snapshot) => {
      const jobsList: Job[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        jobsList.push({
          ...data,
          id: data.id || docSnap.id
        } as Job);
      });
      jobsList.sort((a, b) => b.id.localeCompare(a.id));
      setSelectedClientJobs(jobsList);
    }, (err) => {
      console.error("Error fetching jobs from subcollection:", err);
    });

    const timelineRef = collection(db, 'clients', selectedClientId, 'timeline');
    const unsubscribeTimeline = onSnapshot(timelineRef, (snapshot) => {
      const timelineList: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        timelineList.push({
          ...data,
          id: data.id || docSnap.id
        });
      });
      timelineList.sort((a, b) => b.id.localeCompare(a.id));
      setSelectedClientTimeline(timelineList);
    }, (err) => {
      console.error("Error fetching timeline from subcollection:", err);
    });

    return () => {
      unsubscribeJobs();
      unsubscribeTimeline();
    };
  }, [selectedClientId]);

  // Migration script (runs in background when clients are fetched)
  useEffect(() => {
    if (clients.length === 0) return;
    
    const migrateOldData = async () => {
      for (const client of clients) {
        const rawJobs = (client as any).jobs;
        const rawTimeline = (client as any).timeline;
        
        if ((Array.isArray(rawJobs) && rawJobs.length > 0) || (Array.isArray(rawTimeline) && rawTimeline.length > 0)) {
          console.log(`Migrating old embedded data for client: ${client.name}`);
          
          if (Array.isArray(rawJobs) && rawJobs.length > 0) {
            for (const job of rawJobs) {
              await setDoc(doc(db, 'clients', client.id, 'jobs', job.id), job);
            }
          }
          
          if (Array.isArray(rawTimeline) && rawTimeline.length > 0) {
            for (const item of rawTimeline) {
              await setDoc(doc(db, 'clients', client.id, 'timeline', item.id), item);
            }
          }
          
          // Clear embedded fields to complete migration and avoid running again
          await setDoc(doc(db, 'clients', client.id), {
            jobs: [],
            timeline: []
          }, { merge: true });
          
          console.log(`Migration completed for client: ${client.name}`);
        }
      }
    };
    
    migrateOldData();
  }, [clients]);

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

  const rawSelectedClient = clients.find(c => c.id === selectedClientId);
  const selectedClient = rawSelectedClient ? {
    ...rawSelectedClient,
    jobs: selectedClientJobs,
    timeline: selectedClientTimeline
  } : undefined;

  const selectedJob = selectedClientJobs.find(j => j.id === selectedJobId);

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

  const handleDeleteClient = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setClientToDelete(client);
  };

  const executeDeleteClient = async () => {
    if (!clientToDelete) return;
    const id = clientToDelete.id;
    try {
      // 1. Delete all jobs under the client's jobs subcollection
      const jobsRef = collection(db, 'clients', id, 'jobs');
      const jobsSnapshot = await getDocs(jobsRef);
      const deletePromises: Promise<void>[] = [];
      jobsSnapshot.forEach(jobDoc => {
        deletePromises.push(deleteDoc(doc(db, 'clients', id, 'jobs', jobDoc.id)));
      });

      // 2. Delete all timeline items under the client's timeline subcollection
      const timelineRef = collection(db, 'clients', id, 'timeline');
      const timelineSnapshot = await getDocs(timelineRef);
      timelineSnapshot.forEach(timelineDoc => {
        deletePromises.push(deleteDoc(doc(db, 'clients', id, 'timeline', timelineDoc.id)));
      });

      // Execute all subcollection deletions
      await Promise.all(deletePromises);

      // 3. Delete the parent client document
      await deleteDoc(doc(db, 'clients', id));
      
      toast("Đã xóa client và toàn bộ dữ liệu liên quan thành công!", "success");
      
      if (selectedClientId === id) {
        setSelectedClientId(null);
        setSelectedJobId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'clients');
      toast("Không thể xóa client", "error");
    } finally {
      setClientToDelete(null);
    }
  };

  const handleDeleteJob = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    setJobToDelete(job);
  };

  const executeDeleteJob = async () => {
    if (!jobToDelete || !selectedClientId) return;
    const jobId = jobToDelete.id;
    try {
      await deleteDoc(doc(db, 'clients', selectedClientId, 'jobs', jobId));
      toast("Đã xóa job thành công!", "success");
      if (selectedJobId === jobId) {
        setSelectedJobId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'clients'); // using 'clients' as the collection prefix for subcollection err
      toast("Không thể xóa job", "error");
    } finally {
      setJobToDelete(null);
    }
  };

  const handleDraftMarkdownChange = (val: string) => {
    if (!draftResult) return;
    setDraftResult((prev: any) => {
      if (!prev) return null;
      return {
        ...prev,
        jobData: {
          ...prev.jobData,
          markdownReport: val
        }
      };
    });
  };

  const handleUniversalInputSubmit = async () => {
    if (!universalInput.trim() || !selectedClient) return;
    setIsProcessingInput(true);
    setProcessingProgress(0);
    setProcessingStep(1); // Step 1: Researching Company...
    
    try {
      // Step 1: Company Research AI Call
      console.log("Step 1: Starting Company Research...");
      const step1Response = await fetch('/api/freecai/step1-company-research', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({
          clientName: selectedClient.name,
          customPrompt: companyResearchPrompt || DEFAULT_COMPANY_RESEARCH_PROMPT
        })
      });

      if (!step1Response.ok) {
        throw new Error(`Step 1 (Company Research) failed: ${step1Response.statusText}`);
      }

      const step1Data = await step1Response.json();
      const companyReport = step1Data.companyReport || "";

      // Step 2: Transition to Analyzing Job Description...
      setProcessingStep(2);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Smooth transition buffer

      // Step 3: Transition to Generating Recruitment Intelligence Report...
      setProcessingStep(3);

      console.log("Step 2: Starting Recruitment Intelligence...");
      const step2Response = await fetch('/api/freecai/step2-recruitment-intelligence', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({
          companyReport: companyReport,
          jobDescription: universalInput,
          customPrompt: recruitmentIntelligencePrompt || DEFAULT_RECRUITMENT_INTELLIGENCE_PROMPT
        })
      });

      if (!step2Response.ok) {
        throw new Error(`Step 2 (Recruitment Intelligence) failed: ${step2Response.statusText}`);
      }

      let rawResult = "";
      const reader = step2Response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          rawResult += chunk;
          setProcessingProgress(prev => prev + chunk.length);
        }
      } else {
        rawResult = await step2Response.text();
        setProcessingProgress(rawResult.length);
      }

      if (rawResult.includes("ERROR_STREAMING:")) {
        const parts = rawResult.split("ERROR_STREAMING:");
        throw new Error(parts[parts.length - 1].trim() || "Failed to generate report during stream");
      }

      // Extract a clean title from the generated Markdown
      const extractedTitle = extractJobTitle(rawResult, universalInput);

      setRawInputUsed(universalInput);

      // Construct a compatible draftResult structure
      const mockDraftResult = {
        hasNewJob: true,
        matchedJobId: "null",
        timelineSummary: `Đã tạo Báo cáo Trí tuệ Tuyển dụng cho vị trí ${extractedTitle}.`,
        clientUpdates: {
          culture: "Chưa xác minh",
          overview: companyReport || selectedClient.summary?.overview || "Đang cập nhật thông tin...",
          industry: selectedClient.summary?.industry || "N/A",
          keyInfo: selectedClient.summary?.keyInfo || []
        },
        jobData: {
          title: extractedTitle,
          roleOverview: {
            title: extractedTitle,
            dept: "TBD",
            reportingLine: "TBD",
            salaryRange: "Thỏa thuận",
            location: "TBD",
            teamSize: "TBD"
          },
          companyContext: [],
          idealPersona: [],
          mustHave: [],
          niceToHave: [],
          questionsForClient: [],
          challenges: [],
          targetCompanies: [],
          booleanSearch: "",
          interviewQuestions: [],
          socialPost: "",
          markdownReport: rawResult
        }
      };

      setDraftResult(mockDraftResult);
      setIsReviewingDraft(true);
      setActiveReviewTab('markdown'); // Default to the final report tab
    } catch (err: any) {
      console.error(err);
      toast(`Error processing: ${err.message || err}`, "error");
    } finally {
      setIsProcessingInput(false);
      setProcessingStep(0);
    }
  };

  const handleDraftFieldChange = (section: string, field: string, value: any) => {
    if (!draftResult) return;
    setDraftResult((prev: any) => {
      if (!prev) return null;
      if (section === 'clientUpdates') {
        return {
          ...prev,
          clientUpdates: {
            ...prev.clientUpdates,
            [field]: value
          }
        };
      }
      if (section === 'jobData' && prev.jobData) {
        if (field === 'roleOverview') {
          return {
            ...prev,
            jobData: {
              ...prev.jobData,
              roleOverview: value
            }
          };
        }
        return {
          ...prev,
          jobData: {
            ...prev.jobData,
            [field]: value
          }
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  };

  const handleConfirmDraft = async () => {
    if (!draftResult || !selectedClient) {
      console.warn("Cannot save draft: missing draftResult or selectedClient", { draftResult, selectedClient });
      return;
    }
    try {
      console.log("Saving draft to Firestore...", {
        clientId: selectedClient.id,
        auth: auth.currentUser ? { uid: auth.currentUser.uid, isAnonymous: auth.currentUser.isAnonymous } : "Not signed in"
      });
      // 1. Create timeline item
      const timelineId = "t" + Date.now();
      const newTimelineItem = {
        id: timelineId,
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        content: draftResult.timelineSummary || "Processed new input",
        rawInput: rawInputUsed || ""
      };
      
      // Save timeline to subcollection
      await setDoc(doc(db, 'clients', selectedClient.id, 'timeline', timelineId), cleanUndefined(newTimelineItem));

      // 2. Client Updates (merge in parent document)
      const updatedSummary = {
        industry: "Analyzing...",
        culture: "Analyzing...",
        overview: "AI is researching company info...",
        keyInfo: [],
        ...(selectedClient.summary || {})
      };

      if (draftResult.clientUpdates) {
        if (draftResult.clientUpdates.culture) updatedSummary.culture = draftResult.clientUpdates.culture;
        if (draftResult.clientUpdates.overview) updatedSummary.overview = draftResult.clientUpdates.overview;
        if (draftResult.clientUpdates.industry) updatedSummary.industry = draftResult.clientUpdates.industry;
        if (draftResult.clientUpdates.keyInfo) {
          const keyInfoFiltered = draftResult.clientUpdates.keyInfo.map((s: string) => s.trim()).filter(Boolean);
          updatedSummary.keyInfo = [...(updatedSummary.keyInfo || []), ...keyInfoFiltered];
        }
      }
      
      await setDoc(doc(db, 'clients', selectedClient.id), cleanUndefined({
        summary: updatedSummary
      }), { merge: true });

      // 3. Job handling
      if (draftResult.hasNewJob && draftResult.jobData) {
        const rawMatchedJobId = draftResult.matchedJobId;
        const matchedJobId = (rawMatchedJobId && selectedClientJobs.some(j => j.id === rawMatchedJobId)) ? rawMatchedJobId : null;
        const isUpdate = !!(matchedJobId && selectedClientJobs.some(j => j.id === matchedJobId));
        
        let targetJobId = matchedJobId;
        let existingJob: Job | undefined = undefined;
        
        if (isUpdate) {
          existingJob = selectedClientJobs.find(j => j.id === matchedJobId);
        }
        
        if (!isUpdate || !targetJobId) {
          targetJobId = "j" + Date.now();
        }

        // Prepare new versions array
        const versions = existingJob?.versions || [];
        const previousSnapshot = existingJob ? existingJob.report : {
          roleOverview: { title: "", dept: "", reportTo: "", salary: "", location: "", teamSize: "" },
          companyContext: [],
          idealPersona: [],
          mustHave: [],
          niceToHave: [],
          questionsForClient: [],
          challenges: [],
          targetCompanies: [],
          booleanSearch: "",
          interviewQuestions: [],
          socialPost: ""
        };

        const newVersionEntry = {
          date: new Date().toLocaleString('vi-VN'),
          rawInput: rawInputUsed || "",
          snapshot: previousSnapshot
        };
        const updatedVersions = [...versions, newVersionEntry];

        const jd = draftResult.jobData;
        const previousReport = existingJob?.report;

        const mergedReport: JobReport = {
          markdownReport: jd.markdownReport || previousReport?.markdownReport || "",
          roleOverview: {
            title: jd.title || previousReport?.roleOverview?.title || "",
            dept: jd.roleOverview?.dept || previousReport?.roleOverview?.dept || "TBD",
            reportTo: jd.roleOverview?.reportingLine || previousReport?.roleOverview?.reportTo || "TBD",
            salary: jd.roleOverview?.salaryRange || previousReport?.roleOverview?.salary || "TBD",
            location: jd.roleOverview?.location || previousReport?.roleOverview?.location || "TBD",
            teamSize: previousReport?.roleOverview?.teamSize || "TBD"
          },
          companyContext: jd.companyContext && jd.companyContext.length > 0 ? jd.companyContext.map((s: string) => s.trim()).filter(Boolean) : (previousReport?.companyContext || []),
          idealPersona: jd.idealPersona && jd.idealPersona.length > 0 ? jd.idealPersona.map((s: string) => s.trim()).filter(Boolean) : (previousReport?.idealPersona || []),
          mustHave: jd.mustHave && jd.mustHave.length > 0 ? jd.mustHave.map((s: string) => s.trim()).filter(Boolean) : (previousReport?.mustHave || []),
          niceToHave: jd.niceToHave && jd.niceToHave.length > 0 ? jd.niceToHave.map((s: string) => s.trim()).filter(Boolean) : (previousReport?.niceToHave || []),
          questionsForClient: jd.questionsForClient && jd.questionsForClient.length > 0 ? jd.questionsForClient.map((s: string) => s.trim()).filter(Boolean) : (previousReport?.questionsForClient || []),
          challenges: previousReport?.challenges || [],
          targetCompanies: previousReport?.targetCompanies || [],
          booleanSearch: jd.booleanSearch || previousReport?.booleanSearch || "",
          interviewQuestions: jd.interviewQuestions && jd.interviewQuestions.length > 0 ? jd.interviewQuestions.map((s: string) => s.trim()).filter(Boolean) : (previousReport?.interviewQuestions || []),
          socialPost: jd.socialPost || previousReport?.socialPost || "",
          competitorCompanies: jd.competitorCompanies || previousReport?.competitorCompanies,
          positionIntelligence: jd.positionIntelligence || previousReport?.positionIntelligence,
          candidatePersonaObj: jd.candidatePersonaObj || previousReport?.candidatePersonaObj,
          talentMarketInsight: jd.talentMarketInsight || previousReport?.talentMarketInsight,
          candidateSellingPoints: jd.candidateSellingPoints || previousReport?.candidateSellingPoints,
          recruitmentStrategy: jd.recruitmentStrategy || previousReport?.recruitmentStrategy,
          booleanSearchQueries: jd.booleanSearchQueries || previousReport?.booleanSearchQueries
        };

        const updatedJob: Job = {
          id: targetJobId,
          title: jd.title || existingJob?.title || "New Role (Auto-detected)",
          updatedAt: "Just now",
          report: mergedReport,
          versions: updatedVersions
        };

        // Save to subcollection
        await setDoc(doc(db, 'clients', selectedClient.id, 'jobs', targetJobId), cleanUndefined(updatedJob));
        
        if (isUpdate) {
          toast(`Job Updated: ${updatedJob.title}`, "success");
        } else {
          toast(`New Job Detected: ${updatedJob.title}`, "success");
        }
      } else {
        toast("Information saved to Knowledge Base", "success");
      }

      setUniversalInput("");
      setDraftResult(null);
      setIsReviewingDraft(false);
    } catch (err: any) {
      console.error("Error saving draft:", err);
      toast(`Failed to save changes: ${err.message || err}`, "error");
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
        headers: getAiHeaders(),
        body: JSON.stringify({
          message: msg,
          clientData: selectedClient
        })
      });

      if (!response.ok) {
        let errMsg = "";
        try {
          const errText = await response.text();
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error || errJson.message || errText;
          } catch {
            errMsg = errText || `HTTP Error ${response.status}`;
          }
        } catch {
          errMsg = "Network error or server unreachable";
        }
        throw new Error(errMsg || "Failed to chat");
      }

      const reader = response.body?.getReader();
      if (reader) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "" }]);
        const decoder = new TextDecoder();
        let streamedText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamedText += decoder.decode(value, { stream: true });
          
          if (streamedText.includes("ERROR_STREAMING:")) {
            const parts = streamedText.split("ERROR_STREAMING:");
            throw new Error(parts[parts.length - 1].trim() || "Failed to process chat during stream");
          }

          setChatMessages(prev => {
             const newMsgs = [...prev];
             newMsgs[newMsgs.length - 1].content = streamedText;
             return newMsgs;
          });
        }
      } else {
        const text = await response.text();
        if (text.includes("ERROR_STREAMING:")) {
            const parts = text.split("ERROR_STREAMING:");
            throw new Error(parts[parts.length - 1].trim() || "Failed to process chat during stream");
        }
        setChatMessages(prev => [...prev, { role: 'assistant', content: text }]);
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        toast(`Error: ${err.message}`, "error");
      } else {
        toast("Failed to process chat", "error");
      }
    }
  };

  const handleSavePrompt = async () => {
    try {
      await Promise.all([
        setDoc(doc(db, 'settings', 'companyResearchPrompt'), { prompt: companyResearchPrompt }),
        setDoc(doc(db, 'settings', 'recruitmentIntelligencePrompt'), { prompt: recruitmentIntelligencePrompt })
      ]);
      toast("Đã lưu các System Prompts thành công!", "success");
      setIsEditingPrompt(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/prompts');
      toast("Lỗi khi lưu System Prompts", "error");
    }
  };

  const handleCopyFullReport = () => {
    if (!selectedJob) return;
    const r = selectedJob.report;
    
    let text = "";
    if (r.markdownReport) {
      text = r.markdownReport;
    } else {
      const o = r.roleOverview;
      text = `JOB INTELLIGENCE REPORT: ${selectedJob.title}
Client: ${selectedClient?.name || "N/A"}

1. Role Overview
- Department: ${o.dept || "N/A"}
- Reporting Line: ${o.reportTo || "N/A"}
- Salary Range: ${o.salary || "N/A"}
- Location: ${o.location || "N/A"}

2. Company Context
${r.companyContext && r.companyContext.length > 0 ? r.companyContext.map(item => `- ${item}`).join('\n') : "- Not available"}

${r.competitorCompanies ? `
3. Competitor Companies
- Direct Competitors: ${r.competitorCompanies.directCompetitors?.join(', ') || 'N/A'}
- Similar Business Models: ${r.competitorCompanies.similarBusinessModels?.join(', ') || 'N/A'}
- Transferable Talent: ${r.competitorCompanies.transferableTalent?.join(', ') || 'N/A'}
- Why These Companies: ${r.competitorCompanies.whyTheseCompanies || 'N/A'}
` : ''}

${r.positionIntelligence ? `
4. Position Intelligence
- Nature of Role: ${r.positionIntelligence.natureOfRole || 'N/A'}
- Day-to-Day Challenges: ${r.positionIntelligence.dayToDayChallenges?.join(', ') || 'N/A'}
- Hidden Expectations: ${r.positionIntelligence.hiddenExpectations?.join(', ') || 'N/A'}
- Key Success Factors: ${r.positionIntelligence.keySuccessFactors?.join(', ') || 'N/A'}
- Common Reasons Candidates Fail: ${r.positionIntelligence.commonReasonsCandidatesFail?.join(', ') || 'N/A'}
` : ''}

${r.candidatePersonaObj ? `
5. Candidate Persona
- Experience: ${r.candidatePersonaObj.yearsOfExperience || 'N/A'}
- Industry: ${r.candidatePersonaObj.industryBackground || 'N/A'}
- Function: ${r.candidatePersonaObj.functionalBackground || 'N/A'}
- Language: ${r.candidatePersonaObj.languageRequirements || 'N/A'}
- Traits: ${r.candidatePersonaObj.personalityTraits?.join(', ') || 'N/A'}
` : `
3. Ideal Persona
${r.idealPersona && r.idealPersona.length > 0 ? r.idealPersona.map(item => `- ${item}`).join('\n') : "- Not available"}
`}

6. Must Have
${r.mustHave && r.mustHave.length > 0 ? r.mustHave.map(item => `- ${item}`).join('\n') : "- Not available"}

7. Nice to Have
${r.niceToHave && r.niceToHave.length > 0 ? r.niceToHave.map(item => `- ${item}`).join('\n') : "- Not available"}

${r.talentMarketInsight ? `
8. Talent Market Insight
- Talent Pool Difficulty: ${r.talentMarketInsight.talentPoolDifficulty || 'N/A'}
- Hiring Challenges: ${r.talentMarketInsight.hiringChallenges?.join(', ') || 'N/A'}
- Counter Offer Risk: ${r.talentMarketInsight.counterOfferRisk || 'N/A'}
- Salary Competitiveness: ${r.talentMarketInsight.salaryCompetitiveness || 'N/A'}
- Notice Period Risk: ${r.talentMarketInsight.noticePeriodRisk || 'N/A'}
` : ''}

${r.candidateSellingPoints ? `
9. Candidate Selling Points
${r.candidateSellingPoints.map(item => `- ${item}`).join('\n')}
` : ''}

${r.recruitmentStrategy ? `
10. Recruitment Strategy
- Where to Source: ${r.recruitmentStrategy.whereToSource?.join(', ') || 'N/A'}
- Target First: ${r.recruitmentStrategy.companiesToTargetFirst?.join(', ') || 'N/A'}
- Challenges & Mitigations:
${r.recruitmentStrategy.challengesAndMitigations?.map(item => `  - ${item}`).join('\n') || '  N/A'}
` : ''}

11. Questions for Client
${r.questionsForClient && r.questionsForClient.length > 0 ? r.questionsForClient.map(item => `- ${item}`).join('\n') : "- Not available"}

12. Interview Questions
${r.interviewQuestions && r.interviewQuestions.length > 0 ? r.interviewQuestions.map(item => `- ${item}`).join('\n') : "- Not available"}

13. Social Post
${r.socialPost || "- Not available"}

${r.booleanSearchQueries ? `
14. Boolean Search
${Object.entries(r.booleanSearchQueries).map(([key, query]) => query ? `${key.toUpperCase()}:\n${query}` : '').filter(Boolean).join('\n\n')}
` : `
8. Boolean Search
${r.booleanSearch || "Not generated yet."}
`}
`.trim();
    }

    navigator.clipboard.writeText(text)
      .then(() => {
        toast("Đã copy report đầy đủ", "success");
      })
      .catch((err) => {
        console.error("Copy failed:", err);
        toast("Copy thất bại", "error");
      });
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
        
        <div style={{ display: "flex", gap: 10 }}>
          <Btn onClick={() => { setIsCreatingClient(true); setSelectedJobId(null); setIsEditingPrompt(false); }} style={{ flex: 1, padding: "10px", background: "#4f46e5", color: "white", border: "none", fontWeight: 600, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Client
          </Btn>

          <Btn onClick={() => { setIsAiSettingsOpen(true); }} style={{ padding: "10px 12px", background: "var(--bg-glass)", color: "var(--text-primary)", border: "1px solid var(--border-glass)", fontWeight: 600, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} title="Cấu hình AI (Provider, Keys & Prompt)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            AI Config
          </Btn>
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {filteredClients.map(client => {
            const isSelected = selectedClientId === client.id && !isCreatingClient && !isEditingPrompt;
            return (
              <div 
                key={client.id}
                onClick={() => { setSelectedClientId(client.id); setSelectedJobId(null); setIsCreatingClient(false); setIsEditingPrompt(false); }}
                onMouseEnter={e => {
                  const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                  if (btn) btn.style.opacity = '1';
                  if (!isSelected) {
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.02)";
                  }
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                  if (btn) btn.style.opacity = '0';
                  if (!isSelected) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
                style={{ 
                  padding: "16px", 
                  borderRadius: 12, 
                  cursor: "pointer",
                  background: isSelected ? "rgba(79, 70, 229, 0.08)" : "transparent",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  border: isSelected ? "1px solid rgba(79, 70, 229, 0.2)" : "1px solid transparent",
                  boxShadow: isSelected ? "0 8px 20px -4px rgba(79, 70, 229, 0.12)" : "none",
                  backdropFilter: isSelected ? "blur(12px)" : "none",
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
                  onClick={(e) => handleDeleteClient(e, client)}
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
        
        {isEditingPrompt ? (
          <div style={{ padding: 40, background: "var(--bg-glass)", backdropFilter: "blur(16px)", borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)", display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 12 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                AI Prompt Configuration
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Tùy chỉnh các hướng dẫn và góc nhìn mà AI Gemini sẽ sử dụng khi phân tích. Quy trình gồm hai bước tuần tự. Các thay đổi của bạn sẽ được lưu vào Firestore và áp dụng toàn hệ thống.
              </p>
            </div>

            {/* Sub-tabs for step 1 and step 2 prompts */}
            <div style={{ display: "flex", gap: 12, borderBottom: "1px solid var(--border-color)", paddingBottom: 8 }}>
              <button
                onClick={() => setActivePromptSubTab('company')}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  background: activePromptSubTab === 'company' ? "#4f46e5" : "transparent",
                  color: activePromptSubTab === 'company' ? "white" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Bước 1: Company Research Prompt
              </button>
              <button
                onClick={() => setActivePromptSubTab('recruitment')}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 6,
                  border: "none",
                  background: activePromptSubTab === 'recruitment' ? "#4f46e5" : "transparent",
                  color: activePromptSubTab === 'recruitment' ? "white" : "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Bước 2: Recruitment Intelligence Prompt
              </button>
            </div>

            {activePromptSubTab === 'company' ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>NỘI DUNG COMPANY RESEARCH PROMPT</span>
                  <span style={{ color: "var(--text-secondary)" }}>Biến khả dụng: <code>{"${currentClientName}"}</code></span>
                </div>
                <textarea
                  value={companyResearchPrompt}
                  onChange={e => setCompanyResearchPrompt(e.target.value)}
                  style={{ 
                    width: "100%", height: 280, borderRadius: 8, border: "1px solid var(--border-glass)", 
                    padding: 16, fontSize: 14, background: "var(--bg-body)", color: "var(--text-primary)", 
                    resize: "vertical", outline: "none", fontFamily: "monospace", lineHeight: 1.6
                  }}
                  placeholder="Nhập nội dung prompt nghiên cứu đối tác tại đây..."
                />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>NỘI DUNG RECRUITMENT INTELLIGENCE PROMPT</span>
                  <span style={{ color: "var(--text-secondary)" }}>Biến khả dụng: <code>{"${companyReport}"}</code>, <code>{"${jobDescription}"}</code></span>
                </div>
                <textarea
                  value={recruitmentIntelligencePrompt}
                  onChange={e => setRecruitmentIntelligencePrompt(e.target.value)}
                  style={{ 
                    width: "100%", height: 280, borderRadius: 8, border: "1px solid var(--border-glass)", 
                    padding: 16, fontSize: 14, background: "var(--bg-body)", color: "var(--text-primary)", 
                    resize: "vertical", outline: "none", fontFamily: "monospace", lineHeight: 1.6
                  }}
                  placeholder="Nhập nội dung prompt bóc tách JD và lập báo cáo tuyển dụng tại đây..."
                />
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button 
                onClick={() => {
                  if (activePromptSubTab === 'company') {
                    setCompanyResearchPrompt(DEFAULT_COMPANY_RESEARCH_PROMPT);
                    toast("Đã đặt lại prompt Nghiên cứu Công ty mẫu", "success");
                  } else {
                    setRecruitmentIntelligencePrompt(DEFAULT_RECRUITMENT_INTELLIGENCE_PROMPT);
                    toast("Đã đặt lại prompt Trí tuệ Tuyển dụng mẫu", "success");
                  }
                }}
                style={{ padding: "10px 20px", background: "transparent", color: "var(--text-primary)", borderRadius: 8, border: "1.5px solid var(--border-glass)", cursor: "pointer", fontWeight: 600 }}
              >
                Reset Prompt mẫu
              </button>
              <button 
                onClick={handleSavePrompt}
                style={{ padding: "10px 24px", background: "#4f46e5", color: "white", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Save System Prompts
              </button>
            </div>
          </div>
        ) : isCreatingClient ? (
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
                <Btn 
                  onClick={handleCopyFullReport}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "white", color: "#111", border: "1px solid #e2e8f0" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copy Full Report
                </Btn>
              </div>

              {/* Tabs for Report vs History (VẤN ĐỀ 4) */}
              <div style={{ display: "flex", borderBottom: "1.5px solid var(--border-glass)", gap: 16, marginTop: -8 }}>
                <button
                  onClick={() => { setActiveJobTab('report'); setSelectedVersionIndex(null); }}
                  style={{
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: activeJobTab === 'report' ? "2.5px solid #4f46e5" : "2.5px solid transparent",
                    color: activeJobTab === 'report' ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  AI Report
                </button>
                <button
                  onClick={() => { setActiveJobTab('history'); setSelectedVersionIndex(null); }}
                  style={{
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    borderBottom: activeJobTab === 'history' ? "2.5px solid #4f46e5" : "2.5px solid transparent",
                    color: activeJobTab === 'history' ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  History ({selectedJob.versions?.length || 0})
                </button>
              </div>

              {activeJobTab === 'history' ? (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", gap: 24, paddingRight: 8 }}>
                  {/* Left list of versions */}
                  <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Version History</div>
                    {(!selectedJob.versions || selectedJob.versions.length === 0) ? (
                      <div style={{ fontSize: 14, color: "var(--text-secondary)", padding: 16, background: "var(--bg-glass)", borderRadius: 12, border: "1.5px solid var(--border-glass)" }}>
                        No changes recorded yet. Version history starts when a job is modified or updated by new AI input.
                      </div>
                    ) : (
                      selectedJob.versions.map((ver, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedVersionIndex(idx)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: 16,
                            background: selectedVersionIndex === idx ? "rgba(79, 70, 229, 0.15)" : "var(--bg-glass)",
                            border: selectedVersionIndex === idx ? "1.5px solid #4f46e5" : "1.5px solid var(--border-glass)",
                            borderRadius: 12,
                            cursor: "pointer",
                            color: "var(--text-primary)",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>V{idx + 1}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{ver.date.split(" ")[0]}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {ver.date}
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  {/* Right details panel */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
                    {selectedVersionIndex === null ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300, background: "var(--bg-glass)", borderRadius: 16, border: "1.5px solid var(--border-glass)", color: "var(--text-secondary)", padding: 40, textAlign: "center" }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-muted)", marginBottom: 16 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>Select a Version</h3>
                        <p style={{ fontSize: 14, margin: 0, color: "var(--text-muted)" }}>Choose a version from the left panel to inspect the raw input used and the snapshot state before that update.</p>
                      </div>
                    ) : (
                      <>
                        {/* Raw Input Area */}
                        <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px 0", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-block", width: 6, height: 6, background: "#4f46e5", borderRadius: "50%" }}></span>
                            Raw input for V{selectedVersionIndex + 1}
                          </h3>
                          <div style={{ background: "var(--bg-body)", padding: 16, borderRadius: 8, fontSize: 13, border: "1px solid var(--border-color)", color: "var(--text-secondary)", whiteSpace: "pre-wrap", maxHeight: 150, overflowY: "auto", fontFamily: "monospace" }}>
                            {selectedJob.versions[selectedVersionIndex].rawInput || "No input recorded."}
                          </div>
                        </div>

                        {/* Snapshot Report State */}
                        <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)", display: "flex", flexDirection: "column", gap: 16 }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-block", width: 6, height: 6, background: "#10b981", borderRadius: "50%" }}></span>
                            Previous Snapshot Report (State before update)
                          </h3>

                          {/* Render preview of previous state */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 400, overflowY: "auto", paddingRight: 8 }}>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Role Title</div>
                              <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{selectedJob.versions[selectedVersionIndex].snapshot.roleOverview?.title || selectedJob.title}</div>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Dept</div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{selectedJob.versions[selectedVersionIndex].snapshot.roleOverview?.dept || "N/A"}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Salary</div>
                                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{selectedJob.versions[selectedVersionIndex].snapshot.roleOverview?.salary || "N/A"}</div>
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Company Context</div>
                              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                                {selectedJob.versions[selectedVersionIndex].snapshot.companyContext?.map((item, i) => <li key={i}>{item}</li>) || <li>None</li>}
                              </ul>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Must Have</div>
                              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                                {selectedJob.versions[selectedVersionIndex].snapshot.mustHave?.map((item, i) => <li key={i}>{item}</li>) || <li>None</li>}
                              </ul>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Questions for Client</div>
                              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: "var(--text-secondary)" }}>
                                {selectedJob.versions[selectedVersionIndex].snapshot.questionsForClient?.map((item, i) => <li key={i}>{item}</li>) || <li>None</li>}
                              </ul>
                            </div>

                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Social Post</div>
                              <div style={{ background: "var(--bg-body)", padding: 12, borderRadius: 6, fontSize: 12, border: "1px solid var(--border-color)", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                                {selectedJob.versions[selectedVersionIndex].snapshot.socialPost || "None"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : selectedJob.report.markdownReport ? (
                /* Beautiful Markdown Report View */
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, paddingRight: 8 }}>
                  <div style={{
                    background: "var(--bg-glass-strong)",
                    backdropFilter: "blur(16px)",
                    padding: "32px",
                    borderRadius: 16,
                    border: "1.5px solid var(--border-glass-strong)",
                    boxShadow: "var(--shadow-glass)",
                    color: "var(--text-primary)",
                    lineHeight: "1.75",
                  }} className="markdown-body">
                    <ReactMarkdown>{selectedJob.report.markdownReport}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                /* Job Content Scrollable */
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, paddingRight: 8 }}>
                  
                  {/* 1. Role Overview */}
                  <div style={{ background: "var(--bg-glass-strong)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass-strong)", borderLeft: "3px solid var(--primary)", boxShadow: "var(--shadow-glass)" }}>
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
                    
                    {selectedJob.report.candidatePersonaObj ? (
                    <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>3. Candidate Persona</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 14, color: "var(--text-secondary)" }}>
                        <div><strong>Experience:</strong> {selectedJob.report.candidatePersonaObj.yearsOfExperience}</div>
                        <div><strong>Industry:</strong> {selectedJob.report.candidatePersonaObj.industryBackground}</div>
                        <div><strong>Function:</strong> {selectedJob.report.candidatePersonaObj.functionalBackground}</div>
                        <div><strong>Language:</strong> {selectedJob.report.candidatePersonaObj.languageRequirements}</div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <strong>Traits:</strong> {selectedJob.report.candidatePersonaObj.personalityTraits?.join(", ")}
                        </div>
                      </div>
                    </div>
                    ) : (
                    <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>3. Ideal Persona</h3>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                        {selectedJob.report.idealPersona.length > 0 ? selectedJob.report.idealPersona.map((item, i) => <li key={i}>{item}</li>) : <li>Not available</li>}
                      </ul>
                    </div>
                    )}
                  </div>

                  {/* Competitor Companies */}
                  {selectedJob.report.competitorCompanies && (
                  <div style={{ background: "var(--bg-glass-strong)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass-strong)", borderLeft: "3px solid #f59e0b", boxShadow: "var(--shadow-glass)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>Competitor Companies</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Direct Competitors</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-secondary)" }}>
                          {selectedJob.report.competitorCompanies.directCompetitors?.map((c,i)=><li key={i}>{c}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Similar Business Models</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-secondary)" }}>
                          {selectedJob.report.competitorCompanies.similarBusinessModels?.map((c,i)=><li key={i}>{c}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Transferable Talent</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-secondary)" }}>
                          {selectedJob.report.competitorCompanies.transferableTalent?.map((c,i)=><li key={i}>{c}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Why These Companies</div>
                        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{selectedJob.report.competitorCompanies.whyTheseCompanies}</div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Position Intelligence */}
                  {selectedJob.report.positionIntelligence && (
                  <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>Position Intelligence</h3>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Nature of Role: </span>
                      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{selectedJob.report.positionIntelligence.natureOfRole}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Day-to-day Challenges</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-secondary)" }}>{selectedJob.report.positionIntelligence.dayToDayChallenges?.map((c,i)=><li key={i}>{c}</li>)}</ul>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Hidden Expectations</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-secondary)" }}>{selectedJob.report.positionIntelligence.hiddenExpectations?.map((c,i)=><li key={i}>{c}</li>)}</ul>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Key Success Factors</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-secondary)" }}>{selectedJob.report.positionIntelligence.keySuccessFactors?.map((c,i)=><li key={i}>{c}</li>)}</ul>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Reasons Candidates Fail</div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "var(--text-secondary)" }}>{selectedJob.report.positionIntelligence.commonReasonsCandidatesFail?.map((c,i)=><li key={i}>{c}</li>)}</ul>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Talent Market Insight & Strategy */}
                  {(selectedJob.report.talentMarketInsight || selectedJob.report.recruitmentStrategy || selectedJob.report.candidateSellingPoints) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    {selectedJob.report.talentMarketInsight && (
                    <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>Talent Market Insight</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                        <div><strong>Talent Pool Difficulty:</strong> {selectedJob.report.talentMarketInsight.talentPoolDifficulty}</div>
                        <div><strong>Counter Offer Risk:</strong> {selectedJob.report.talentMarketInsight.counterOfferRisk}</div>
                        <div><strong>Salary Competitiveness:</strong> {selectedJob.report.talentMarketInsight.salaryCompetitiveness}</div>
                        <div><strong>Notice Period Risk:</strong> {selectedJob.report.talentMarketInsight.noticePeriodRisk}</div>
                        <div>
                          <strong>Hiring Challenges:</strong> 
                          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>{selectedJob.report.talentMarketInsight.hiringChallenges?.map((c,i)=><li key={i}>{c}</li>)}</ul>
                        </div>
                      </div>
                    </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      {selectedJob.report.recruitmentStrategy && (
                      <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>Recruitment Strategy</h3>
                        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                          <div style={{ marginBottom: 8 }}><strong>Where to Source:</strong> {selectedJob.report.recruitmentStrategy.whereToSource?.join(", ")}</div>
                          <div style={{ marginBottom: 8 }}><strong>Target First:</strong> {selectedJob.report.recruitmentStrategy.companiesToTargetFirst?.join(", ")}</div>
                          <div style={{ marginBottom: 8 }}><strong>Challenges/Mitigations:</strong></div>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>{selectedJob.report.recruitmentStrategy.challengesAndMitigations?.map((c,i)=><li key={i}>{c}</li>)}</ul>
                        </div>
                      </div>
                      )}
                      {selectedJob.report.candidateSellingPoints && (
                      <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>Selling Points</h3>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                          {selectedJob.report.candidateSellingPoints.map((c,i) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                      )}
                    </div>
                  </div>
                  )}

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

                  {/* 7. Social Post */}
                  <div style={{ background: "var(--bg-output)", border: "1px solid var(--border-output)", borderRadius: 12, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>7. Social Post</h3>
                      <button 
                        onClick={() => handleCopySection(selectedJob.report.socialPost || "", "Social Post")}
                        style={{ 
                          display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", 
                          background: "var(--bg-glass)", border: "1px solid var(--border-output)", 
                          borderRadius: 6, fontSize: 12, color: "var(--text-primary)", cursor: "pointer",
                          fontWeight: 500
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                      </button>
                    </div>
                    <div style={{ fontFamily: "monospace", color: "var(--text-output)", fontSize: 13, whiteSpace: "pre-wrap" }}>
                      {selectedJob.report.socialPost || "Not generated yet."}
                    </div>
                  </div>

                  {/* 8. Boolean Search */}
                  {selectedJob.report.booleanSearchQueries ? (
                  <div style={{ background: "var(--bg-output)", border: "1px solid var(--border-output)", borderRadius: 12, padding: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px 0", color: "var(--text-primary)" }}>Boolean Search</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {Object.entries(selectedJob.report.booleanSearchQueries).map(([key, query]) => query ? (
                        <div key={key}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>{key}</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <div style={{ flex: 1, fontFamily: "monospace", color: "var(--text-output)", fontSize: 13, background: "rgba(0,0,0,0.1)", padding: "8px 12px", borderRadius: 6 }}>{query}</div>
                            <button onClick={() => handleCopySection(query as string, `Boolean ${key}`)} style={{ padding: "8px 12px", background: "var(--bg-glass)", border: "1px solid var(--border-output)", borderRadius: 6, fontSize: 12, color: "var(--text-primary)", cursor: "pointer", fontWeight: 500 }}>Copy</button>
                          </div>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                  ) : (
                  <div style={{ background: "var(--bg-output)", border: "1px solid var(--border-output)", borderRadius: 12, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Boolean Search</h3>
                      <button 
                        onClick={() => handleCopySection(selectedJob.report.booleanSearch || "", "Boolean Search")}
                        style={{ 
                          display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", 
                          background: "var(--bg-glass)", border: "1px solid var(--border-output)", 
                          borderRadius: 6, fontSize: 12, color: "var(--text-primary)", cursor: "pointer",
                          fontWeight: 500
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                      </button>
                    </div>
                    <div style={{ fontFamily: "monospace", color: "var(--text-output)", fontSize: 13 }}>
                      {selectedJob.report.booleanSearch || "Not generated yet."}
                    </div>
                  </div>
                  )}

                  {/* 6 & 9: Questions for Client / Interview Questions (Layout 2 cột) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    {/* 6. Questions for Client */}
                    <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>6. Questions for Client</h3>
                        <button 
                          onClick={() => {
                            const textToCopy = selectedJob.report.questionsForClient && selectedJob.report.questionsForClient.length > 0 
                              ? selectedJob.report.questionsForClient.map((item, i) => `${i + 1}. ${item}`).join('\n') 
                              : "";
                            handleCopySection(textToCopy, "Questions for Client");
                          }}
                          style={{ 
                            display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", 
                            background: "var(--bg-glass)", border: "1px solid var(--border-glass)", 
                            borderRadius: 6, fontSize: 12, color: "var(--text-primary)", cursor: "pointer",
                            fontWeight: 500
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          Copy
                        </button>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                        {selectedJob.report.questionsForClient && selectedJob.report.questionsForClient.length > 0 ? (
                          selectedJob.report.questionsForClient.map((item, i) => <li key={i}>{item}</li>)
                        ) : (
                          <li>Not available</li>
                        )}
                      </ul>
                    </div>

                    {/* 9. Interview Questions */}
                    <div style={{ background: "var(--bg-glass)", backdropFilter: "blur(16px)", padding: 24, borderRadius: 16, border: "1.5px solid var(--border-glass)", boxShadow: "var(--shadow-glass)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>9. Interview Questions</h3>
                        <button 
                          onClick={() => {
                            const textToCopy = selectedJob.report.interviewQuestions && selectedJob.report.interviewQuestions.length > 0 
                              ? selectedJob.report.interviewQuestions.map((item, i) => `${i + 1}. ${item}`).join('\n') 
                              : "";
                            handleCopySection(textToCopy, "Interview Questions");
                          }}
                          style={{ 
                            display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", 
                            background: "var(--bg-glass)", border: "1px solid var(--border-glass)", 
                            borderRadius: 6, fontSize: 12, color: "var(--text-primary)", cursor: "pointer",
                            fontWeight: 500
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          Copy
                        </button>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                        {selectedJob.report.interviewQuestions && selectedJob.report.interviewQuestions.length > 0 ? (
                          selectedJob.report.interviewQuestions.map((item, i) => <li key={i}>{item}</li>)
                        ) : (
                          <li>Not available</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
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
                  {isProcessingInput ? (processingProgress > 0 ? `Processing... (${processingProgress} chars)` : "Processing...") : "Save Information"}
                </Btn>
              </div>
            </div>

            {isProcessingInput && (
              <div style={{
                background: "var(--bg-glass-strong)",
                backdropFilter: "blur(12px)",
                borderRadius: 16,
                border: "1.5px solid var(--border-glass-strong)",
                padding: "24px 32px",
                boxShadow: "var(--shadow-glass)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                textAlign: "center"
              }}>
                <div style={{ position: "relative", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="animate-spin" style={{
                    width: 48,
                    height: 48,
                    border: "4px solid var(--border-color)",
                    borderTop: "4px solid #4f46e5",
                    borderRadius: "50%",
                    position: "absolute"
                  }}></div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#4f46e5", zIndex: 1 }}>{processingStep}</span>
                </div>
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px 0", color: "var(--text-primary)" }}>
                    {processingStep === 1 && "Step 1: Researching Company..."}
                    {processingStep === 2 && "Step 2: Analyzing Job Description..."}
                    {processingStep === 3 && "Step 3: Generating Recruitment Intelligence Report..."}
                    {processingStep === 4 && "Step 4: Finalizing Data Insights..."}
                  </h4>
                  <p style={{ fontSize: 13, margin: 0, color: "var(--text-muted)" }}>
                    {processingStep === 1 && "Thu thập và phân tích dữ liệu ngành nghề, văn hóa và bối cảnh của đối tác..."}
                    {processingStep === 2 && "Bóc tách yêu cầu công việc, phân tích chân dung ứng viên lý tưởng..."}
                    {processingStep === 3 && `Đang soạn thảo báo cáo trí tuệ tuyển dụng toàn diện... (${processingProgress} kí tự)`}
                    {processingStep === 4 && "Bóc tách và cấu trúc hóa dữ liệu báo cáo để lưu trữ vào hệ thống..."}
                  </p>
                </div>
                {/* Visual Step Dots */}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: processingStep >= 1 ? "#4f46e5" : "var(--border-color)", transition: "all 0.3s" }}></div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: processingStep >= 2 ? "#4f46e5" : "var(--border-color)", transition: "all 0.3s" }}></div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: processingStep >= 3 ? "#4f46e5" : "var(--border-color)", transition: "all 0.3s" }}></div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: processingStep >= 4 ? "#4f46e5" : "var(--border-color)", transition: "all 0.3s" }}></div>
                </div>
              </div>
            )}

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
                    onMouseEnter={e => {
                      const btn = e.currentTarget.querySelector('.job-delete-btn') as HTMLElement;
                      if (btn) btn.style.opacity = '1';
                    }}
                    onMouseLeave={e => {
                      const btn = e.currentTarget.querySelector('.job-delete-btn') as HTMLElement;
                      if (btn) btn.style.opacity = '0';
                    }}
                    style={{ 
                      padding: "20px 24px", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 16,
                      borderBottom: index < selectedClient.jobs.length - 1 ? "1px solid var(--border-color)" : "none",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      position: "relative"
                    }}
                    className="hover:bg-[var(--bg-hover)]"
                  >
                    <div style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 8, background: "var(--bg-body)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.title}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Updated {job.updatedAt}</div>
                    </div>
                    
                    {/* Delete job button (visible on hover) */}
                    <button 
                      className="job-delete-btn"
                      onClick={(e) => handleDeleteJob(e, job)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--error)', 
                        cursor: 'pointer', 
                        padding: 8, 
                        opacity: 0, 
                        transition: 'opacity 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 6
                      }}
                      title="Xóa Job"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>

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

      {/* AI CONFIGURATION MODAL */}
      {isAiSettingsOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-glass)",
            borderRadius: 16,
            border: "1.5px solid var(--border-glass)",
            boxShadow: "var(--shadow-glass)",
            width: "100%",
            maxWidth: 680,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-color)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Smart AI Configuration</h3>
              </div>
              <button 
                onClick={() => setIsAiSettingsOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Modal Tabs */}
            <div style={{
              display: "flex",
              borderBottom: "1px solid var(--border-color)",
              background: "rgba(0,0,0,0.02)",
              padding: "0 16px"
            }}>
              <button
                onClick={() => setActiveConfigTab('api')}
                style={{
                  padding: "14px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: activeConfigTab === 'api' ? "#4f46e5" : "var(--text-muted)",
                  borderBottom: activeConfigTab === 'api' ? "2px solid #4f46e5" : "2px solid transparent",
                  transition: "all 0.2s"
                }}
              >
                Nhà cung cấp &amp; API Key
              </button>
              <button
                onClick={() => setActiveConfigTab('prompt')}
                style={{
                  padding: "14px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: activeConfigTab === 'prompt' ? "#4f46e5" : "var(--text-muted)",
                  borderBottom: activeConfigTab === 'prompt' ? "2px solid #4f46e5" : "2px solid transparent",
                  transition: "all 0.2s"
                }}
              >
                System Prompt Tuyển dụng
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {activeConfigTab === 'api' ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(79, 70, 229, 0.03)", padding: "12px 16px", borderRadius: 10, border: "1px solid var(--border-glass)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ 
                        width: 8, height: 8, borderRadius: "50%", 
                        background: userProvider === 'system' ? "#10b981" : (userApiKey ? "#10b981" : (userProvider === 'gemini' ? "#10b981" : "#f59e0b")),
                        display: "inline-block"
                      }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                        Trạng thái: {userProvider === 'system' ? "Đồng bộ hệ thống (Mặc định)" : `Đang dùng ${userProvider.toUpperCase()}`}
                      </span>
                    </div>
                  </div>

                  {/* Provider Select */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Nhà cung cấp AI:</label>
                    <select
                      value={tempProvider}
                      onChange={e => setTempProvider(e.target.value)}
                      style={{ 
                        width: "100%", padding: "10px 12px", borderRadius: 8, 
                        border: "1px solid var(--border-color)", background: "var(--bg-body)", 
                        color: "var(--text-primary)", fontSize: 14, outline: "none" 
                      }}
                    >
                      <option value="system">Dùng cấu hình hệ thống (Mặc định)</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI (GPT)</option>
                      <option value="grok">xAI Grok</option>
                      <option value="claude">Anthropic Claude</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="groq">Groq</option>
                      <option value="cerebras">Cerebras</option>
                      <option value="qwen">Qwen (Alibaba)</option>
                      <option value="github">Github Models</option>
                      <option value="custom">Custom (OpenAI-compatible)</option>
                    </select>
                  </div>

                  {tempProvider === 'system' ? (
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "rgba(79, 70, 229, 0.05)", border: "1px dashed rgba(79, 70, 229, 0.2)", padding: "14px", borderRadius: 8, lineHeight: "1.5" }}>
                      💡 <strong>Đồng bộ hóa tự động:</strong> Tự động đồng bộ với Nhà cung cấp AI &amp; API Key cá nhân bạn đã thiết lập trong hộp thoại <strong>API Key Settings</strong> chung của hệ thống (ở góc trên bên phải màn hình). Bạn không cần cấu hình gì thêm ở đây!
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* API Key */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                          {tempProvider === 'gemini' && !tempKey ? "API Key (Để trống nếu dùng chung của hệ thống):" : "API Key cá nhân:"}
                        </label>
                        <input 
                          type="password"
                          placeholder={
                            (() => {
                              const globalKey = tempProvider === 'github' ? localStorage.getItem("custom_github_pat") : (localStorage.getItem(`custom_${tempProvider}_api_key`) || (tempProvider === 'gemini' ? localStorage.getItem("custom_gemini_api_key") : ""));
                              if (globalKey) {
                                return "•••••••••••••••• (Đã nhận diện API Key từ hệ thống)";
                              }
                              return "Nhập API Key riêng của bạn...";
                            })()
                          }
                          value={tempKey}
                          onChange={e => setTempKey(e.target.value)}
                          style={{ 
                            width: "100%", padding: "10px 12px", borderRadius: 8, 
                            border: "1px solid var(--border-color)", background: "var(--bg-body)", 
                            color: "var(--text-primary)", fontSize: 14, outline: "none" 
                          }} 
                        />
                      </div>

                      {/* Custom Model */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                          Model AI (Không bắt buộc):
                        </label>
                        <input 
                          type="text"
                          placeholder={
                            tempProvider === 'gemini' ? "gemini-3.5-flash (Mặc định)" :
                            tempProvider === 'openai' ? "gpt-4o-mini (Mặc định)" :
                            tempProvider === 'grok' ? "grok-2-latest (Mặc định)" :
                            tempProvider === 'claude' ? "claude-3-5-sonnet-latest" :
                            tempProvider === 'deepseek' ? "deepseek-chat" :
                            tempProvider === 'groq' ? "llama-3.3-70b-versatile" :
                            tempProvider === 'cerebras' ? "qwen-3-235b-a22b-instruct-2507" :
                            tempProvider === 'qwen' ? "qwen-plus" :
                            tempProvider === 'github' ? "openai/gpt-4o (Mặc định)" : "Nhập tên Model cụ thể..."
                          }
                          value={tempModel}
                          onChange={e => setTempModel(e.target.value)}
                          style={{ 
                            width: "100%", padding: "10px 12px", borderRadius: 8, 
                            border: "1px solid var(--border-color)", background: "var(--bg-body)", 
                            color: "var(--text-primary)", fontSize: 14, outline: "none" 
                          }} 
                        />
                      </div>

                      {/* Custom Endpoint (OpenAI compatible or Custom) */}
                      {(tempProvider === 'custom' || tempProvider === 'deepseek') && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                            Base URL / Endpoint:
                          </label>
                          <input 
                            type="text"
                            placeholder={tempProvider === 'deepseek' ? "https://api.deepseek.com" : "https://api.yourprovider.com/v1"}
                            value={tempEndpoint}
                            onChange={e => setTempEndpoint(e.target.value)}
                            style={{ 
                              width: "100%", padding: "10px 12px", borderRadius: 8, 
                              border: "1px solid var(--border-color)", background: "var(--bg-body)", 
                              color: "var(--text-primary)", fontSize: 14, outline: "none" 
                            }} 
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                    {(userApiKey || userProvider !== 'system' || userModel || userCustomEndpoint) && (
                      <button 
                        onClick={() => {
                          handleClearApiSettings();
                        }}
                        style={{ padding: "10px 16px", background: "transparent", color: "var(--error)", border: "1px solid var(--border-glass)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        Đặt lại mặc định
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        handleSaveApiSettings(tempProvider, tempKey, tempModel, tempEndpoint);
                        setIsAiSettingsOpen(false);
                      }}
                      style={{ padding: "10px 20px", background: "#4f46e5", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      Lưu cấu hình API
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      Tùy chỉnh các hướng dẫn và góc nhìn mà AI sẽ sử dụng cho từng bước trong quy trình phân tích hai bước (Sequential Two-Step). Các thay đổi được lưu vào Firestore và áp dụng toàn hệ thống.
                    </p>
                  </div>

                  {/* Sub-tabs for step 1 and step 2 prompts */}
                  <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border-color)", paddingBottom: 8 }}>
                    <button
                      onClick={() => setActivePromptSubTab('company')}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "none",
                        background: activePromptSubTab === 'company' ? "#4f46e5" : "transparent",
                        color: activePromptSubTab === 'company' ? "white" : "var(--text-muted)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      Bước 1: Company Research Prompt
                    </button>
                    <button
                      onClick={() => setActivePromptSubTab('recruitment')}
                      style={{
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: "none",
                        background: activePromptSubTab === 'recruitment' ? "#4f46e5" : "transparent",
                        color: activePromptSubTab === 'recruitment' ? "white" : "var(--text-muted)",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      Bước 2: Recruitment Intelligence Prompt
                    </button>
                  </div>

                  {activePromptSubTab === 'company' ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                        <span>NỘI DUNG COMPANY RESEARCH PROMPT</span>
                        <span style={{ color: "var(--text-secondary)" }}>Biến khả dụng: <code>{"${currentClientName}"}</code></span>
                      </div>
                      <textarea
                        value={companyResearchPrompt}
                        onChange={e => setCompanyResearchPrompt(e.target.value)}
                        style={{ 
                          width: "100%", height: 220, borderRadius: 8, border: "1px solid var(--border-glass)", 
                          padding: 12, fontSize: 13, background: "var(--bg-body)", color: "var(--text-primary)", 
                          resize: "vertical", outline: "none", fontFamily: "monospace", lineHeight: 1.5
                        }}
                        placeholder="Nhập nội dung prompt nghiên cứu đối tác tại đây..."
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                        <span>NỘI DUNG RECRUITMENT INTELLIGENCE PROMPT</span>
                        <span style={{ color: "var(--text-secondary)" }}>Biến khả dụng: <code>{"${companyReport}"}</code>, <code>{"${jobDescription}"}</code></span>
                      </div>
                      <textarea
                        value={recruitmentIntelligencePrompt}
                        onChange={e => setRecruitmentIntelligencePrompt(e.target.value)}
                        style={{ 
                          width: "100%", height: 220, borderRadius: 8, border: "1px solid var(--border-glass)", 
                          padding: 12, fontSize: 13, background: "var(--bg-body)", color: "var(--text-primary)", 
                          resize: "vertical", outline: "none", fontFamily: "monospace", lineHeight: 1.5
                        }}
                        placeholder="Nhập nội dung prompt bóc tách JD và lập báo cáo tuyển dụng tại đây..."
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                    <button 
                      onClick={() => {
                        if (activePromptSubTab === 'company') {
                          setCompanyResearchPrompt(DEFAULT_COMPANY_RESEARCH_PROMPT);
                          toast("Đã đặt lại prompt Nghiên cứu Công ty mẫu", "success");
                        } else {
                          setRecruitmentIntelligencePrompt(DEFAULT_RECRUITMENT_INTELLIGENCE_PROMPT);
                          toast("Đã đặt lại prompt Trí tuệ Tuyển dụng mẫu", "success");
                        }
                      }}
                      style={{ padding: "10px 16px", background: "transparent", color: "var(--text-primary)", borderRadius: 8, border: "1.5px solid var(--border-glass)", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                    >
                      Reset Prompt mẫu
                    </button>
                    <button 
                      onClick={() => {
                        handleSavePrompt();
                        setIsAiSettingsOpen(false);
                      }}
                      style={{ padding: "10px 20px", background: "#4f46e5", color: "white", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
                    >
                      Lưu System Prompts
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DRAFT REVIEW MODAL (VẤN ĐỀ 3) */}
      {isReviewingDraft && draftResult && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(12px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9998,
          padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-glass)",
            borderRadius: 16,
            border: "1.5px solid var(--border-glass)",
            boxShadow: "var(--shadow-glass)",
            width: "100%",
            maxWidth: 800,
            height: "85vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-color)",
              background: "var(--bg-glass-hover)"
            }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Review AI Analysis Draft</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-secondary)" }}>Verify, refine, and modify the AI-parsed information before saving it to the database.</p>
              </div>
              <button 
                onClick={() => { setDraftResult(null); setIsReviewingDraft(false); }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{
              display: "flex",
              borderBottom: "1px solid var(--border-color)",
              background: "rgba(0,0,0,0.01)",
              padding: "0 16px"
            }}>
              <button
                onClick={() => setActiveReviewTab('client')}
                style={{
                  padding: "14px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: activeReviewTab === 'client' ? "#4f46e5" : "var(--text-muted)",
                  borderBottom: activeReviewTab === 'client' ? "2px solid #4f46e5" : "2px solid transparent",
                  transition: "all 0.2s"
                }}
              >
                Client Profile
              </button>
              {draftResult.hasNewJob && (
                <button
                  onClick={() => setActiveReviewTab('markdown')}
                  style={{
                    padding: "14px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: activeReviewTab === 'markdown' ? "#4f46e5" : "var(--text-muted)",
                    borderBottom: activeReviewTab === 'markdown' ? "2px solid #4f46e5" : "2px solid transparent",
                    transition: "all 0.2s"
                  }}
                >
                  Báo cáo Trí tuệ Tuyển dụng
                </button>
              )}
            </div>

            {/* Modal Content Scroll Area */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Timeline summary always visible at the top of review */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "rgba(79, 70, 229, 0.02)", padding: 16, borderRadius: 10, border: "1px dashed rgba(79, 70, 229, 0.2)" }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Timeline Entry Summary</label>
                <input 
                  type="text" 
                  value={draftResult.timelineSummary || ""} 
                  onChange={e => handleDraftFieldChange('', 'timelineSummary', e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                />
              </div>

              {draftResult.hasNewJob && draftResult.jobData && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Job Title</label>
                  <input 
                    type="text" 
                    value={draftResult.jobData.title || ""} 
                    onChange={e => handleDraftFieldChange('jobData', 'title', e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", fontSize: 14, fontWeight: 700, outline: "none" }}
                  />
                </div>
              )}

              {activeReviewTab === 'client' && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Client Overview</label>
                    <textarea 
                      value={draftResult.clientUpdates?.overview || ""} 
                      onChange={e => handleDraftFieldChange('clientUpdates', 'overview', e.target.value)}
                      style={{ width: "100%", height: 100, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", fontSize: 14, outline: "none", resize: "vertical" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Industry</label>
                      <input 
                        type="text" 
                        value={draftResult.clientUpdates?.industry || ""} 
                        onChange={e => handleDraftFieldChange('clientUpdates', 'industry', e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Culture &amp; Atmosphere</label>
                      <input 
                        type="text" 
                        value={draftResult.clientUpdates?.culture || ""} 
                        onChange={e => handleDraftFieldChange('clientUpdates', 'culture', e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Key Information / Fun Facts (One per line)</label>
                    <textarea 
                      value={draftResult.clientUpdates?.keyInfo?.join("\n") || ""} 
                      onChange={e => handleDraftFieldChange('clientUpdates', 'keyInfo', e.target.value.split("\n"))}
                      style={{ width: "100%", height: 80, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "monospace" }}
                      placeholder="Enter each point on a new line"
                    />
                  </div>
                </div>
              )}

              {activeReviewTab === 'markdown' && draftResult.jobData && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Báo cáo Trí tuệ Tuyển dụng - Bạn có thể đọc, chỉnh sửa hoặc xóa bớt nội dung trực tiếp bên dưới trước khi lưu</label>
                    <textarea 
                      value={draftResult.jobData.markdownReport || ""} 
                      onChange={e => handleDraftMarkdownChange(e.target.value)}
                      style={{ width: "100%", height: 500, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "monospace", lineHeight: 1.6 }}
                      placeholder="Nội dung báo cáo dạng Markdown..."
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 24px",
              borderTop: "1px solid var(--border-color)",
              background: "var(--bg-glass)"
            }}>
              <div>
                {draftResult.hasNewJob ? (
                  <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>
                    {draftResult.matchedJobId && selectedClientJobs.some(j => j.id === draftResult.matchedJobId) ? (
                      <span style={{ color: "#d97706", fontWeight: 600 }}>⚠️ Updating existing job (ID: {draftResult.matchedJobId})</span>
                    ) : (
                      <span style={{ color: "#16a34a", fontWeight: 600 }}>✨ Creating brand new job opening</span>
                    )}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Only updating client knowledge base (No job detected)</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button 
                  onClick={() => { setDraftResult(null); setIsReviewingDraft(false); }}
                  style={{ padding: "10px 20px", background: "transparent", color: "var(--text-primary)", borderRadius: 8, border: "1.5px solid var(--border-glass)", cursor: "pointer", fontWeight: 600, fontSize: 14 }}
                >
                  Discard Draft
                </button>
                <button 
                  onClick={handleConfirmDraft}
                  style={{ padding: "10px 24px", background: "#4f46e5", color: "white", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
                >
                  Confirm &amp; Save to Database
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Client Deletion Confirmation Modal */}
      {clientToDelete && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10000, padding: 24
        }}>
          <div style={{
            background: "var(--bg-card)", padding: "40px", borderRadius: "28px",
            maxWidth: 420, width: "100%", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-color)", textAlign: "center",
            position: "relative", overflow: "hidden"
          }}>
            <div style={{ 
              width: 72, height: 72, background: "rgba(239, 68, 68, 0.08)", 
              borderRadius: "22px", display: "flex", alignItems: "center", 
              justifyContent: "center", margin: "0 auto 28px auto", color: "#ef4444"
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 14px 0", color: "var(--text-primary)", letterSpacing: "-0.03em" }}>Xác nhận xóa Đối tác</h3>
            <p style={{ fontSize: 16, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 36, opacity: 0.9 }}>
              Bạn có chắc chắn muốn xóa <span style={{ fontWeight: 700 }}>{clientToDelete.name}</span>? <br />
              <span style={{ fontSize: 14, color: "#ef4444", marginTop: 10, display: "block", fontWeight: 600 }}>Hành động này không thể hoàn tác.</span>
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <button 
                onClick={() => setClientToDelete(null)}
                style={{ flex: 1, padding: "16px", background: "var(--bg-hover)", border: "none", borderRadius: "14px", fontWeight: 700, cursor: "pointer", color: "var(--text-primary)", transition: "all 0.2s" }}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={executeDeleteClient}
                style={{ flex: 1, padding: "16px", background: "#ef4444", color: "white", border: "none", borderRadius: "14px", fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(239, 68, 68, 0.3)" }}
              >
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Deletion Confirmation Modal */}
      {jobToDelete && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10000, padding: 24
        }}>
          <div style={{
            background: "var(--bg-card)", padding: "40px", borderRadius: "28px",
            maxWidth: 420, width: "100%", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-color)", textAlign: "center",
            position: "relative", overflow: "hidden"
          }}>
            <div style={{ 
              width: 72, height: 72, background: "rgba(239, 68, 68, 0.08)", 
              borderRadius: "22px", display: "flex", alignItems: "center", 
              justifyContent: "center", margin: "0 auto 28px auto", color: "#ef4444"
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 14px 0", color: "var(--text-primary)", letterSpacing: "-0.03em" }}>Xác nhận xóa Vị trí</h3>
            <p style={{ fontSize: 16, color: "var(--text-primary)", lineHeight: 1.6, marginBottom: 36, opacity: 0.9 }}>
              Xóa Job: <span style={{ fontWeight: 700 }}>{jobToDelete.title}</span>? <br />
              <span style={{ fontSize: 14, color: "#ef4444", marginTop: 10, display: "block", fontWeight: 600 }}>Toàn bộ báo cáo sẽ bị mất.</span>
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <button 
                onClick={() => setJobToDelete(null)}
                style={{ flex: 1, padding: "16px", background: "var(--bg-hover)", border: "none", borderRadius: "14px", fontWeight: 700, cursor: "pointer", color: "var(--text-primary)", transition: "all 0.2s" }}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={executeDeleteJob}
                style={{ flex: 1, padding: "16px", background: "#ef4444", color: "white", border: "none", borderRadius: "14px", fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 20px rgba(239, 68, 68, 0.3)" }}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
