import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence, useMotionValue } from 'motion/react';
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
1. Thông tin Công ty & Bối cảnh (Company Intelligence): Tích hợp các thông tin quan trọng nhất từ bản nghiên cứu công ty phía trên vào đây để tạo bối cảnh vững chắc.
2. Tổng quan vị trí (Role Overview): Tên vị trí, Phòng ban, Cấp trên trực tiếp, Khoảng lương dự kiến, Địa điểm làm việc. (Trình bày dạng danh sách bullet points rõ ràng)
3. Chân dung ứng viên lý tưởng (Ideal Persona): Kinh nghiệm, ngành nghề, kỹ năng cứng bắt buộc (Must-have), kỹ năng ưu tiên (Nice-to-have), đặc điểm tính cách.
4. Trí tuệ Vị trí (Position Intelligence): Bản chất công việc, thách thức thực tế hàng ngày, kỳ vọng ẩn giấu từ nhà tuyển dụng, các yếu tố quyết định thành công của ứng viên.
5. Thấu hiểu Thị trường Tài năng (Talent Market Insight): Độ khó của nguồn cung, rủi ro counter-offer, tính cạnh tranh của mức lương, rủi ro notice period.
6. Chiến lược tuyển dụng & Sourcing (Recruitment Strategy): Sourcing channels, các công ty mục tiêu để target ứng viên trước tiên, phương án xử lý thách thức.
7. Công cụ tìm kiếm (Boolean Search Queries): Viết sẵn các mẫu câu lệnh tìm kiếm thực chiến ngắn gọn cho LinkedIn Recruiter, CV Database, X-Ray Search, và các bộ lọc theo ngành.
8. Gợi ý bài đăng tuyển dụng thu hút (Social Post / JD tóm tắt) & Bộ câu hỏi phỏng vấn gợi ý cho Consultant (Interview Questions / Questions for Client).

LƯU Ý QUAN TRỌNG VỀ ĐỊNH DẠNG:
- Trình bày toàn bộ báo cáo bằng định dạng Markdown chuyên nghiệp, thẩm mỹ cao.
- Sử dụng Tiêu đề (H1, H2, H3) để phân cấp thông tin rõ ràng.
- Sử dụng **In đậm** cho các từ khóa then chốt để giúp người dùng nắm bắt nhanh thông tin (Scannability).
- Sử dụng Bảng (Tables) cho các thông tin cần so sánh hoặc dữ liệu số nếu phù hợp. **LƯU Ý: Luôn để ít nhất một dòng trống trước và sau mỗi bảng.**
- Sử dụng Danh sách (Bullet points) có phân cấp rõ ràng.
- Đảm bảo báo cáo bắt đầu bằng một phần giới thiệu chuyên nghiệp về công ty khách hàng dựa trên dữ liệu research.
- KHÔNG trả về định dạng JSON hay bất cứ thông tin thừa nào khác ngoài nội dung Markdown.
- Sử dụng ngôn phong tự nhiên, sắc bén, mang tính tư vấn cao của một Senior Consultant thực thụ.`;

function extractJobTitle(markdown: string, rawInput: string): string {
  const lines = markdown.split("\n");
  
  // 1. Try to find specific key-value pairs in the markdown first as they are most reliable
  const positionMatch = markdown.match(/(?:\*\*|)?(?:Vị trí|Position|Role|Job Title)(?:\*\*|)?\s*:\s*([^\n]+)/i);
  if (positionMatch && positionMatch[1]) {
    const extracted = positionMatch[1].replace(/\*\*$/, "").trim();
    if (extracted && !/^(TBD|Chưa xác định|N\/A)$/i.test(extracted)) {
      return extracted;
    }
  }

  // 2. Try to find the main title header, which often has the format: # Báo cáo ... - Title
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      const parts = trimmed.split("-");
      if (parts.length > 1) {
        const potentialTitle = parts[parts.length - 1].trim();
        if (!/(Báo cáo|Trí tuệ|Tuyển dụng|Intelligence|Report|Phân tích|là gì)/i.test(potentialTitle)) {
          return potentialTitle;
        }
      }
      // If no hyphen, check if it's a generic title
      const title = trimmed.replace(/^#+\s*/, "").trim();
      if (title && !/(Report|Intelligence|Báo cáo|Tổng quan|Trí tuệ|Tuyển dụng|là gì|Phân tích)/i.test(title)) {
        return title;
      }
    }
  }

  // 3. Fallback to raw input extraction - very reliable for pasted JDs
  const inputTitleMatch = rawInput.match(/^(?:Job|Vị trí|Title|Position|Job Title):\s*([^\n\r]+)/im);
  if (inputTitleMatch) return inputTitleMatch[1].trim();

  // 4. Check first few lines of raw input for common title patterns
  const firstLines = rawInput.split("\n").slice(0, 3);
  for (const line of firstLines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.length > 5 && trimmed.length < 100 && !/^(JD|Job Description|Mô tả công việc)$/i.test(trimmed)) {
      // If the line looks like a title (not too long, no verbs, etc.)
      if (!/(chào|hello|dear|vui lòng|please|tôi|bạn|là gì)/i.test(trimmed)) {
        return trimmed;
      }
    }
  }

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
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [windowHeight, setWindowHeight] = useState(typeof window !== "undefined" ? window.innerHeight : 800);

  const [draggedX, setDraggedX] = useState(0);
  const [draggedY, setDraggedY] = useState(0);
  const dragX = useMotionValue(draggedX);
  const dragY = useMotionValue(draggedY);

  // Sync motion values when state changes (e.g. after remount)
  useEffect(() => {
    dragX.set(draggedX);
    dragY.set(draggedY);
  }, [draggedX, draggedY, dragX, dragY]);
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
  const [activeMarkdownReviewMode, setActiveMarkdownReviewMode] = useState<'edit' | 'preview'>('preview');

  // Job active tab and selected version index
  const [activeJobTab, setActiveJobTab] = useState<'report' | 'history'>('report');
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number | null>(null);
  const [isJobMenuOpen, setIsJobMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientWebsite, setNewClientWebsite] = useState("");
  const [newClientTagline, setNewClientTagline] = useState("");
  
  const [universalInput, setUniversalInput] = useState("");
  const [manualJobTitle, setManualJobTitle] = useState("");
  const [isProcessingInput, setIsProcessingInput] = useState(false);
  const [showSavedFeedback, setShowSavedFeedback] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState("");
  const [editingWebsiteVal, setEditingWebsiteVal] = useState("");
  const [editingTaglineVal, setEditingTaglineVal] = useState("");

  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  // Reset active job tab and selected version index when switching jobs
  useEffect(() => {
    setActiveJobTab('report');
    setSelectedVersionIndex(null);
    setIsJobMenuOpen(false);
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

  const handleUpdateClient = async (clientId: string) => {
    if (!editingNameVal.trim()) {
      setEditingClientId(null);
      return;
    }
    try {
      await setDoc(doc(db, 'clients', clientId), { 
        name: editingNameVal,
        website: editingWebsiteVal,
        tagline: editingTaglineVal
      }, { merge: true });
      toast("Client updated", "success");
    } catch (err) {
      console.error(err);
      toast("Failed to update client", "error");
    }
    setEditingClientId(null);
  };

  const rawSelectedClient = clients.find(c => c.id === selectedClientId);
  const selectedClient = rawSelectedClient ? {
    ...rawSelectedClient,
    jobs: selectedClientJobs,
    timeline: selectedClientTimeline
  } : undefined;

  const [isChatOpen, setIsChatOpen] = useState(false);
  const nowTime = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const [chatHistories, setChatHistories] = useState<Record<string, {role: 'user'|'assistant', content: string, time?: string}[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('freec_ai_chat_histories');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  // Persist chat histories to localStorage
  useEffect(() => {
    localStorage.setItem('freec_ai_chat_histories', JSON.stringify(chatHistories));
  }, [chatHistories]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const greetedClientsRef = useRef<Set<string>>(new Set());
  
  const chatMessages = selectedClientId ? (chatHistories[selectedClientId] || []) : [];
  const setChatMessages = (updater: any) => {
    if (!selectedClientId) return;
    setChatHistories(prev => ({
      ...prev,
      [selectedClientId]: typeof updater === 'function' ? updater(prev[selectedClientId] || []) : updater
    }));
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatOpen]);

  // Handle Chat initialization and persistence
  useEffect(() => {
    if (isChatOpen && selectedClientId && selectedClient) {
      if (!greetedClientsRef.current.has(selectedClientId)) {
        setChatHistories(prev => {
          const history = prev[selectedClientId] || [];
          const greeting = { 
            role: 'assistant' as const, 
            content: `Hi! Mình là freeC AI. Bạn muốn hỏi điều gì về client **${selectedClient.name}** này, hay về job nào? Mình sẽ giải đáp nhé!`,
            time: nowTime() 
          };
          
          // Avoid duplicate consecutive identical greetings
          if (history.length > 0 && history[history.length - 1].content === greeting.content) {
            return prev;
          }

          return {
            ...prev,
            [selectedClientId]: [...history, greeting]
          };
        });
        greetedClientsRef.current.add(selectedClientId);
      }
    }
  }, [isChatOpen, selectedClientId, !!selectedClient]);

  // Handle auto-close chat when no client is selected
  useEffect(() => {
    if (!selectedClientId) {
      setIsChatOpen(false);
    }
  }, [selectedClientId]);

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
      const extractedTitle = manualJobTitle.trim() || extractJobTitle(rawResult, universalInput);

      setRawInputUsed(universalInput);
      setManualJobTitle(""); // Reset for next use

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
          markdownReport: companyReport 
            ? `## 🏢 BÁO CÁO NGHIÊN CỨU CÔNG TY (COMPANY INTELLIGENCE)\n\n${companyReport}\n\n---\n\n${rawResult}` 
            : rawResult
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
    setChatMessages(prev => [...prev, { role: 'user', content: msg, time: nowTime() }]);
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
        setChatMessages(prev => [...prev, { role: 'assistant', content: "", time: nowTime() }]);
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
        setChatMessages(prev => [...prev, { role: 'assistant', content: text, time: nowTime() }]);
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

  const isMobile = windowWidth < 1024;
  const isDetailViewOpen = !!(selectedClientId || isCreatingClient || isEditingPrompt || isAiSettingsOpen);

  return (
    <div style={{ 
      padding: isMobile ? "16px" : (selectedJob ? "24px 16px" : "32px 40px"), 
      maxWidth: selectedJob ? 1200 : 1600, 
      margin: "0 auto", 
      height: "100%", 
      display: "flex", 
      gap: isMobile ? 0 : 32 
    }}>
      
      {/* LEFT PANE: Client List */}
      {!selectedJob && (!isMobile || !isDetailViewOpen) && (
        <div style={{ 
          width: isMobile ? "100%" : 260, 
          display: "flex", 
          flexDirection: "column", 
          gap: 16, 
          flexShrink: 0 
        }}>
          
          {/* Search */}
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 14, top: 12, color: "var(--text-muted)" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input 
              placeholder="Tìm kiếm đối tác..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "11px 14px 11px 40px", 
                borderRadius: 12, 
                border: "1.5px solid rgba(99, 102, 241, 0.12)", 
                background: "rgba(255, 255, 255, 0.6)", 
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                fontSize: 14.5, 
                outline: "none", 
                color: "var(--text-primary)", 
                boxShadow: "0 2px 8px rgba(99, 102, 241, 0.02)",
                transition: "all 0.25s ease"
              }} 
              onFocus={e => {
                e.currentTarget.style.borderColor = "#6366f1";
                e.currentTarget.style.boxShadow = "0 0 14px rgba(99, 102, 241, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.4)";
                e.currentTarget.style.background = "var(--bg-card)";
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.12)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.02)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.6)";
              }}
            />
          </div>
          
          <div style={{ display: "flex", gap: 10 }}>
            <Btn 
              onClick={() => { setIsCreatingClient(true); setSelectedJobId(null); setIsEditingPrompt(false); }} 
              className="liquid-glass-btn"
              style={{ 
                flex: 1, 
                padding: "11px", 
                borderRadius: 12, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 6, 
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              New Client
            </Btn>

            <Btn 
              onClick={() => { setIsAiSettingsOpen(true); }} 
              className="liquid-glass-btn"
              style={{ 
                padding: "11px 14px", 
                background: "rgba(255, 255, 255, 0.82)", 
                color: "#3730a3", 
                border: "1.5px solid rgba(255, 255, 255, 0.9)", 
                fontWeight: 800, 
                borderRadius: 12, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 6,
              }} 
              title="Cấu hình AI (Provider, Keys & Prompt)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              AI Config
            </Btn>
          </div>
          
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginTop: 12, padding: "8px 14px 14px 14px" }}>
            {filteredClients.map(client => {
              const isSelected = selectedClientId === client.id && !isCreatingClient && !isEditingPrompt;
              return (
                <div 
                  key={client.id}
                  onClick={() => { setSelectedClientId(client.id); setSelectedJobId(null); setIsCreatingClient(false); setIsEditingPrompt(false); }}
                  onMouseEnter={e => {
                    const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                    if (btn) btn.style.opacity = '1';
                    e.currentTarget.style.background = isSelected 
                      ? "linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(139, 92, 246, 0.1))" 
                      : "linear-gradient(135deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.4))";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.borderColor = isSelected ? "rgba(99, 102, 241, 0.35)" : "rgba(99, 102, 241, 0.15)";
                    e.currentTarget.style.boxShadow = "0 8px 24px rgba(99, 102, 241, 0.06), inset 0 1px 1px rgba(255, 255, 255, 0.5)";
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                    if (btn) btn.style.opacity = '0';
                    e.currentTarget.style.background = isSelected 
                      ? "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08))" 
                      : "rgba(255, 255, 255, 0.25)";
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.borderColor = isSelected ? "rgba(99, 102, 241, 0.25)" : "transparent";
                    e.currentTarget.style.boxShadow = isSelected ? "0 4px 16px rgba(99, 102, 241, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.6)" : "none";
                  }}
                  style={{ 
                    padding: "16px", 
                    borderRadius: 14, 
                    cursor: "pointer",
                    background: isSelected 
                      ? "linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08))" 
                      : "rgba(255, 255, 255, 0.25)",
                    backdropFilter: "blur(16px) saturate(180%)",
                    WebkitBackdropFilter: "blur(16px) saturate(180%)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    position: "relative",
                    border: isSelected 
                      ? "1px solid rgba(99, 102, 241, 0.25)" 
                      : "1px solid transparent",
                    boxShadow: isSelected 
                      ? "0 4px 16px rgba(99, 102, 241, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.6)" 
                      : "none",
                  }}
                >
                  <div style={{ marginTop: 2, color: isSelected ? "#3730a3" : "var(--text-muted)", transition: "color 0.2s" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 21h18"></path><path d="M9 8h1"></path><path d="M9 12h1"></path><path d="M9 16h1"></path><path d="M14 8h1"></path><path d="M14 12h1"></path><path d="M14 16h1"></path><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"></path></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: 800, 
                      color: isSelected ? "#3730a3" : "var(--text-primary)", 
                      fontSize: 14.5, 
                      whiteSpace: "nowrap", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis",
                      transition: "color 0.2s"
                    }}>{client.name}</div>
                    <div style={{ 
                      fontSize: 12, 
                      color: isSelected ? "#3730a3" : "var(--text-secondary)", 
                      marginTop: 4, 
                      whiteSpace: "nowrap", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis",
                      transition: "color 0.2s",
                      opacity: isSelected ? 0.9 : 1
                    }}>{client.tagline || client.summary.industry}</div>
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
      )}

      {/* RIGHT PANE: Main Workspace */}
      {(!isMobile || isDetailViewOpen) && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
          
          {isMobile && isDetailViewOpen && !selectedJob && (
            <button
              onClick={() => {
                setSelectedClientId(null);
                setIsCreatingClient(false);
                setIsEditingPrompt(false);
                setIsAiSettingsOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--bg-glass)",
                backdropFilter: "blur(8px)",
                border: "1px solid var(--border-glass)",
                padding: "8px 16px",
                borderRadius: 12,
                color: "var(--text-primary)",
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 16,
                alignSelf: "flex-start",
                cursor: "pointer"
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Quay lại danh sách
            </button>
          )}

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
          <div style={{ 
            padding: "40px", 
            width: "100%",
            maxWidth: "500px", 
            background: "var(--bg-glass)", 
            backdropFilter: "blur(24px) saturate(180%)", 
            WebkitBackdropFilter: "blur(24px) saturate(180%)", 
            borderRadius: 24, 
            border: "1.5px solid rgba(99, 102, 241, 0.18)", 
            boxShadow: "0 20px 50px rgba(99, 102, 241, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.5)" 
          }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="17" y1="11" x2="23" y2="11"></line></svg>
              Create New Client
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ fontSize: 13.5, fontWeight: 700, display: "block", marginBottom: 8, color: "var(--text-primary)" }}>Company Name *</label>
                <input 
                  style={{ 
                    width: "100%", 
                    padding: "12px 16px", 
                    borderRadius: 12, 
                    border: "1.5px solid rgba(99, 102, 241, 0.12)", 
                    background: "rgba(255, 255, 255, 0.6)", 
                    color: "var(--text-primary)", 
                    outline: "none",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    fontSize: 14
                  }} 
                  placeholder="Ví dụ: TUV Rheinland, FPT Software..."
                  value={newClientName} 
                  onChange={e => setNewClientName(e.target.value)} 
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "#6366f1";
                    e.currentTarget.style.boxShadow = "0 0 15px rgba(99, 102, 241, 0.15), 0 0 0 3px rgba(99, 102, 241, 0.1)";
                    e.currentTarget.style.background = "var(--bg-card)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.12)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.01)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.6)";
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13.5, fontWeight: 700, display: "block", marginBottom: 8, color: "var(--text-primary)" }}>Tagline / Industry (optional)</label>
                <input 
                  style={{ 
                    width: "100%", 
                    padding: "12px 16px", 
                    borderRadius: 12, 
                    border: "1.5px solid rgba(99, 102, 241, 0.12)", 
                    background: "rgba(255, 255, 255, 0.6)", 
                    color: "var(--text-primary)", 
                    outline: "none",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.01)",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    fontSize: 14
                  }} 
                  value={newClientTagline} 
                  onChange={e => setNewClientTagline(e.target.value)} 
                  placeholder="e.g. Japanese Trading Company, Logistics, IT..." 
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "#6366f1";
                    e.currentTarget.style.boxShadow = "0 0 15px rgba(99, 102, 241, 0.15), 0 0 0 3px rgba(99, 102, 241, 0.1)";
                    e.currentTarget.style.background = "var(--bg-card)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.12)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.01)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.6)";
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 13.5, fontWeight: 700, display: "block", marginBottom: 8, color: "var(--text-primary)" }}>Website (optional)</label>
                <input 
                  style={{ 
                    width: "100%", 
                    padding: "12px 16px", 
                    borderRadius: 12, 
                    border: "1.5px solid rgba(99, 102, 241, 0.12)", 
                    background: "rgba(255, 255, 255, 0.6)", 
                    color: "var(--text-primary)", 
                    outline: "none",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.01)",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    fontSize: 14
                  }} 
                  value={newClientWebsite} 
                  onChange={e => setNewClientWebsite(e.target.value)} 
                  placeholder="https://example.com"
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "#6366f1";
                    e.currentTarget.style.boxShadow = "0 0 15px rgba(99, 102, 241, 0.15), 0 0 0 3px rgba(99, 102, 241, 0.1)";
                    e.currentTarget.style.background = "var(--bg-card)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.12)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.01)";
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.6)";
                  }}
                />
              </div>
              <Btn 
                onClick={handleCreateClient} 
                style={{ 
                  marginTop: 12, 
                  padding: "14px", 
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)", 
                  color: "white", 
                  border: "none",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 15,
                  boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
                  transition: "all 0.25s ease"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 18px rgba(99, 102, 241, 0.55)";
                  e.currentTarget.style.filter = "brightness(1.12)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(99, 102, 241, 0.35)";
                  e.currentTarget.style.filter = "none";
                }}
              >
                Create Client
              </Btn>
            </div>
          </div>
        ) : selectedClient ? (
          selectedJob ? (
            <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflowY: "auto", position: "relative" }}>
              
              {/* Static Header */}
              <div style={{ 
                position: "relative",
                zIndex: 10,
                background: "transparent",
                borderBottom: "none",
                padding: isMobile ? "16px 0" : "24px 0 16px 0",
                display: "flex", flexDirection: "column", gap: isMobile ? 12 : 20
              }}>
                <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", padding: isMobile ? "0 16px" : "0 32px" }}>
                  <button
                    onClick={() => setSelectedJobId(null)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "none", border: "none", padding: isMobile ? "0 0 12px 0" : "0 0 16px 0",
                      cursor: "pointer", color: "var(--text-secondary)", fontSize: 13, fontWeight: 500
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
                    onMouseLeave={e => e.currentTarget.style.color = "var(--text-secondary)"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    Quay lại danh sách công việc
                  </button>
                  <div style={{ 
                    display: "flex", 
                    gap: isMobile ? 16 : 20, 
                    alignItems: isMobile ? "stretch" : "flex-start",
                    flexDirection: isMobile ? "column" : "row"
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h1 style={{ 
                        fontSize: isMobile ? 26 : 34, 
                        fontWeight: 800, 
                        margin: "0 0 12px 0", 
                        color: "var(--text-primary)", 
                        letterSpacing: "-0.02em", 
                        lineHeight: 1.2 
                      }}>{selectedJob.title}</h1>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <span style={{ 
                          background: "rgba(99, 102, 241, 0.08)", 
                          color: "#6366f1", 
                          border: "1px solid rgba(99, 102, 241, 0.15)", 
                          padding: "4px 12px", 
                          borderRadius: "100px", 
                          fontSize: 11, 
                          fontWeight: 600 
                        }}>{selectedClient.name}</span>
                        <span style={{ 
                          background: "rgba(139, 92, 246, 0.08)", 
                          color: "#8b5cf6", 
                          border: "1px solid rgba(139, 92, 246, 0.15)", 
                          padding: "4px 12px", 
                          borderRadius: "100px", 
                          fontSize: 11, 
                          fontWeight: 600 
                        }}>Job Intelligence Report</span>
                        <span style={{ 
                          background: "rgba(34, 197, 94, 0.08)", 
                          color: "#16a34a", 
                          border: "1px solid rgba(34, 197, 94, 0.15)", 
                          padding: "4px 12px", 
                          borderRadius: "100px", 
                          fontSize: 11, 
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }}></span>
                          {isMobile ? "Updated Just now" : `Updated ${selectedJob.updatedAt}`}
                        </span>
                      </div>
                    </div>
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 8, 
                      position: "relative",
                      justifyContent: isMobile ? "flex-start" : "flex-end"
                    }}>
                      <Btn
                        onClick={handleCopyFullReport}
                        style={{
                          display: "flex", 
                          alignItems: "center", 
                          gap: 8,
                          background: "linear-gradient(135deg, #6366f1, #8b5cf6)", 
                          color: "white",
                          border: "none", 
                          borderRadius: 12, 
                          padding: isMobile ? "10px 16px" : "10px 20px",
                          height: "auto",
                          fontWeight: 700, 
                          fontSize: 13,
                          boxShadow: "0 4px 14px rgba(99, 102, 241, 0.25)",
                          cursor: "pointer",
                          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                          flex: isMobile ? 1 : "initial",
                          justifyContent: "center"
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = "translateY(-1.5px)";
                          e.currentTarget.style.boxShadow = "0 6px 18px rgba(99, 102, 241, 0.4)";
                          e.currentTarget.style.filter = "brightness(1.12)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 4px 14px rgba(99, 102, 241, 0.25)";
                          e.currentTarget.style.filter = "none";
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy Report
                      </Btn>
                      <button
                        onClick={() => setIsJobMenuOpen(v => !v)}
                        style={{
                          width: 38, 
                          height: 38, 
                          borderRadius: 12,
                          border: "1.5px solid rgba(99, 102, 241, 0.15)", 
                          background: "rgba(255,255,255,0.6)",
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center",
                          cursor: "pointer", 
                          color: "#6366f1",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = "rgba(99, 102, 241, 0.08)";
                          e.currentTarget.style.borderColor = "#6366f1";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "rgba(255,255,255,0.6)";
                          e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.15)";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                      </button>
                      {isJobMenuOpen && (
                        <div style={{
                          position: "absolute", top: 42, right: 0, zIndex: 20,
                          background: "var(--bg-card)", border: "1px solid var(--border-color)",
                          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                          minWidth: 160, overflow: "hidden"
                        }}>
                          <button
                            onClick={(e) => { setIsJobMenuOpen(false); handleDeleteJob(e, selectedJob); }}
                            style={{
                              width: "100%", textAlign: "left", padding: "10px 14px",
                              background: "none", border: "none", cursor: "pointer",
                              color: "#ef4444", fontSize: 13, fontWeight: 500,
                              display: "flex", alignItems: "center", gap: 8
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            Xóa Job
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", padding: isMobile ? "0 16px" : "0 32px" }}>
                  <div style={{ 
                    display: "inline-flex", 
                    gap: 4, 
                    background: "rgba(99, 102, 241, 0.05)", 
                    padding: "4px", 
                    borderRadius: "14px", 
                    border: "1px solid rgba(99, 102, 241, 0.08)" 
                  }}>
                    <button
                      onClick={() => { setActiveJobTab('report'); setSelectedVersionIndex(null); }}
                      style={{
                        padding: "8px 18px",
                        background: activeJobTab === 'report' ? "var(--bg-card)" : "transparent",
                        border: "none",
                        borderRadius: "10px",
                        color: activeJobTab === 'report' ? "#6366f1" : "var(--text-muted)",
                        fontWeight: activeJobTab === 'report' ? 700 : 600, 
                        fontSize: 13.5,
                        boxShadow: activeJobTab === 'report' ? "0 4px 12px rgba(99, 102, 241, 0.06)" : "none",
                        cursor: "pointer", 
                        transition: "all 0.2s ease"
                      }}
                    >
                      AI Report
                    </button>
                    <button
                      onClick={() => { setActiveJobTab('history'); setSelectedVersionIndex(null); }}
                      style={{
                        padding: "8px 18px",
                        background: activeJobTab === 'history' ? "var(--bg-card)" : "transparent",
                        border: "none",
                        borderRadius: "10px",
                        color: activeJobTab === 'history' ? "#6366f1" : "var(--text-muted)",
                        fontWeight: activeJobTab === 'history' ? 700 : 600, 
                        fontSize: 13.5,
                        boxShadow: activeJobTab === 'history' ? "0 4px 12px rgba(99, 102, 241, 0.06)" : "none",
                        cursor: "pointer", 
                        transition: "all 0.2s ease",
                        display: "flex", 
                        alignItems: "center", 
                        gap: 6
                      }}
                    >
                      History <span style={{ 
                        background: activeJobTab === 'history' ? "rgba(99, 102, 241, 0.15)" : "rgba(0,0,0,0.06)", 
                        color: activeJobTab === 'history' ? "#6366f1" : "var(--text-muted)",
                        padding: "1px 6px", 
                        borderRadius: 8, 
                        fontSize: 11,
                        fontWeight: 700,
                        transition: "all 0.2s"
                      }}>{selectedJob.versions?.length || 0}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", paddingTop: 32, paddingBottom: 120 }}>
                {activeJobTab === 'history' ? (
                  <div style={{ display: "flex", gap: 24, padding: "0 32px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
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
                            background: selectedVersionIndex === idx ? "rgba(0, 0, 0, 0.04)" : "transparent",
                            border: selectedVersionIndex === idx ? "1px solid var(--border-color)" : "1px solid transparent",
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
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300, background: "transparent", color: "var(--text-secondary)", padding: 40, textAlign: "center" }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-muted)", marginBottom: 16 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>Select a Version</h3>
                        <p style={{ fontSize: 14, margin: 0, color: "var(--text-muted)" }}>Choose a version from the left panel to inspect the raw input used and the snapshot state before that update.</p>
                      </div>
                    ) : (
                      <>
                        {/* Raw Input Area */}
                        <div style={{ background: "transparent", padding: "0 0 24px 0" }}>
                          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px 0", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-block", width: 6, height: 6, background: "#4f46e5", borderRadius: "50%" }}></span>
                            Raw input for V{selectedVersionIndex + 1}
                          </h3>
                          <div style={{ background: "var(--bg-body)", padding: 16, borderRadius: 8, fontSize: 13, border: "1px solid var(--border-color)", color: "var(--text-secondary)", whiteSpace: "pre-wrap", maxHeight: 150, overflowY: "auto", fontFamily: "monospace" }}>
                            {selectedJob.versions[selectedVersionIndex].rawInput || "No input recorded."}
                          </div>
                        </div>

                        {/* Snapshot Report State */}
                        <div style={{ background: "transparent", display: "flex", flexDirection: "column", gap: 16, paddingTop: 12 }}>
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
                <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", padding: "0 32px" }}>
                  <div style={{
                    color: "var(--text-primary)",
                    lineHeight: "1.8",
                    fontSize: "16px",
                    background: "transparent",
                    border: "none",
                    boxShadow: "none"
                  }} className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedJob.report.markdownReport}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                /* Job Content Scrollable */
                <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", padding: "0 32px", display: "flex", flexDirection: "column", gap: 56 }}>
                  
                  {/* 1. Role Overview */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <h3 style={{ fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Role Overview</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32 }}>
                      <div><div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>Department</div><div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.8 }}>{selectedJob.report.roleOverview.dept || "N/A"}</div></div>
                      <div><div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>Reporting Line</div><div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.8 }}>{selectedJob.report.roleOverview.reportTo || "N/A"}</div></div>
                      <div><div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>Salary Range</div><div style={{ fontSize: 17, fontWeight: 500, color: "#16a34a", lineHeight: 1.8 }}>{selectedJob.report.roleOverview.salary || "N/A"}</div></div>
                      <div><div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 8 }}>Location</div><div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.8 }}>{selectedJob.report.roleOverview.location || "N/A"}</div></div>
                    </div>
                  </div>

                  {/* 2 & 3: Context and Persona */}
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <h3 style={{ fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Company Context</h3>
                      <ul style={{ margin: 0, paddingLeft: 24, fontSize: 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        {selectedJob.report.companyContext.length > 0 ? selectedJob.report.companyContext.map((item, i) => <li key={i} style={{ marginBottom: 12 }}>{item}</li>) : <li>Not available</li>}
                      </ul>
                    </div>
                    
                    {selectedJob.report.candidatePersonaObj ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <h3 style={{ fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Candidate Persona</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, fontSize: 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        <div><strong style={{ color: "var(--text-secondary)" }}>Experience:</strong> <br/>{selectedJob.report.candidatePersonaObj.yearsOfExperience}</div>
                        <div><strong style={{ color: "var(--text-secondary)" }}>Industry:</strong> <br/>{selectedJob.report.candidatePersonaObj.industryBackground}</div>
                        <div><strong style={{ color: "var(--text-secondary)" }}>Function:</strong> <br/>{selectedJob.report.candidatePersonaObj.functionalBackground}</div>
                        <div><strong style={{ color: "var(--text-secondary)" }}>Language:</strong> <br/>{selectedJob.report.candidatePersonaObj.languageRequirements}</div>
                        <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
                          <strong style={{ color: "var(--text-secondary)" }}>Traits:</strong> <br/>{selectedJob.report.candidatePersonaObj.personalityTraits?.join(", ")}
                        </div>
                      </div>
                    </div>
                    ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <h3 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Ideal Persona</h3>
                      <ul style={{ margin: 0, paddingLeft: 24, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        {selectedJob.report.idealPersona.length > 0 ? selectedJob.report.idealPersona.map((item, i) => <li key={i} style={{ marginBottom: 12 }}>{item}</li>) : <li>Not available</li>}
                      </ul>
                    </div>
                    )}
                  </>

                  {/* Competitor Companies */}
                  {selectedJob.report.competitorCompanies && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <h3 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Competitor Companies</h3>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 24 : 32 }}>
                      <div>
                        <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 16 }}>Direct Competitors</div>
                        <ul style={{ margin: 0, paddingLeft: 24, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                          {selectedJob.report.competitorCompanies.directCompetitors?.map((c,i)=><li key={i} style={{ marginBottom: 12 }}>{c}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 16 }}>Similar Business Models</div>
                        <ul style={{ margin: 0, paddingLeft: 24, fontSize: 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                          {selectedJob.report.competitorCompanies.similarBusinessModels?.map((c,i)=><li key={i} style={{ marginBottom: 12 }}>{c}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 16 }}>Transferable Talent</div>
                        <ul style={{ margin: 0, paddingLeft: 24, fontSize: 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                          {selectedJob.report.competitorCompanies.transferableTalent?.map((c,i)=><li key={i} style={{ marginBottom: 12 }}>{c}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 16 }}>Why These Companies</div>
                        <div style={{ fontSize: 17, lineHeight: 1.8, color: "var(--text-primary)" }}>{selectedJob.report.competitorCompanies.whyTheseCompanies}</div>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Position Intelligence */}
                  {selectedJob.report.positionIntelligence && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <h3 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Position Intelligence</h3>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: isMobile ? 15 : 17, fontWeight: 600, color: "var(--text-secondary)" }}>Nature of Role: </span>
                      <span style={{ fontSize: isMobile ? 15 : 17, color: "var(--text-primary)", lineHeight: 1.8 }}>{selectedJob.report.positionIntelligence.natureOfRole}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 24 : 32 }}>
                      <div>
                        <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 16 }}>Day-to-day Challenges</div>
                        <ul style={{ margin: 0, paddingLeft: 24, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>{selectedJob.report.positionIntelligence.dayToDayChallenges?.map((c,i)=><li key={i} style={{ marginBottom: 12 }}>{c}</li>)}</ul>
                      </div>
                      <div>
                        <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 16 }}>Hidden Expectations</div>
                        <ul style={{ margin: 0, paddingLeft: 24, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>{selectedJob.report.positionIntelligence.hiddenExpectations?.map((c,i)=><li key={i} style={{ marginBottom: 12 }}>{c}</li>)}</ul>
                      </div>
                      <div>
                        <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 16 }}>Key Success Factors</div>
                        <ul style={{ margin: 0, paddingLeft: 24, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>{selectedJob.report.positionIntelligence.keySuccessFactors?.map((c,i)=><li key={i} style={{ marginBottom: 12 }}>{c}</li>)}</ul>
                      </div>
                      <div>
                        <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em", marginBottom: 16 }}>Reasons Candidates Fail</div>
                        <ul style={{ margin: 0, paddingLeft: 24, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>{selectedJob.report.positionIntelligence.commonReasonsCandidatesFail?.map((c,i)=><li key={i} style={{ marginBottom: 12 }}>{c}</li>)}</ul>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Talent Market Insight & Strategy */}
                  {(selectedJob.report.talentMarketInsight || selectedJob.report.recruitmentStrategy || selectedJob.report.candidateSellingPoints) && (
                  <>
                    {selectedJob.report.talentMarketInsight && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <h3 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Talent Market Insight</h3>
                      <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        <div><strong style={{ color: "var(--text-secondary)" }}>Talent Pool Difficulty:</strong> {selectedJob.report.talentMarketInsight.talentPoolDifficulty}</div>
                        <div><strong style={{ color: "var(--text-secondary)" }}>Counter Offer Risk:</strong> {selectedJob.report.talentMarketInsight.counterOfferRisk}</div>
                        <div><strong style={{ color: "var(--text-secondary)" }}>Salary Competitiveness:</strong> {selectedJob.report.talentMarketInsight.salaryCompetitiveness}</div>
                        <div><strong style={{ color: "var(--text-secondary)" }}>Notice Period Risk:</strong> {selectedJob.report.talentMarketInsight.noticePeriodRisk}</div>
                        <div>
                          <strong style={{ color: "var(--text-secondary)" }}>Hiring Challenges:</strong> 
                          <ul style={{ margin: "8px 0 0", paddingLeft: 24 }}>{selectedJob.report.talentMarketInsight.hiringChallenges?.map((c,i)=><li key={i} style={{ marginBottom: 12 }}>{c}</li>)}</ul>
                        </div>
                      </div>
                    </div>
                    )}
                    {selectedJob.report.recruitmentStrategy && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <h3 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Recruitment Strategy</h3>
                      <div style={{ fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        <div style={{ marginBottom: 12 }}><strong style={{ color: "var(--text-secondary)" }}>Where to Source:</strong> {selectedJob.report.recruitmentStrategy.whereToSource?.join(", ")}</div>
                        <div style={{ marginBottom: 12 }}><strong style={{ color: "var(--text-secondary)" }}>Target First:</strong> {selectedJob.report.recruitmentStrategy.companiesToTargetFirst?.join(", ")}</div>
                        <div style={{ marginBottom: 12 }}><strong style={{ color: "var(--text-secondary)" }}>Challenges/Mitigations:</strong></div>
                        <ul style={{ margin: 0, paddingLeft: 24 }}>{selectedJob.report.recruitmentStrategy.challengesAndMitigations?.map((c,i)=><li key={i} style={{ marginBottom: 12 }}>{c}</li>)}</ul>
                      </div>
                    </div>
                    )}
                    {selectedJob.report.candidateSellingPoints && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <h3 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Selling Points</h3>
                      <ul style={{ margin: 0, paddingLeft: 24, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        {selectedJob.report.candidateSellingPoints.map((c,i) => <li key={i} style={{ marginBottom: 12 }}>{c}</li>)}
                      </ul>
                    </div>
                    )}
                  </>
                  )}

                  {/* 4 & 5: Must have / Nice to have */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 32 : 56 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <h3 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Must Have</h3>
                      <ul style={{ margin: 0, paddingLeft: 24, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        {selectedJob.report.mustHave.length > 0 ? selectedJob.report.mustHave.map((item, i) => <li key={i} style={{ marginBottom: 12 }}>{item}</li>) : <li>Not available</li>}
                      </ul>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <h3 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Nice to Have</h3>
                      <ul style={{ margin: 0, paddingLeft: 24, fontSize: isMobile ? 15 : 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        {selectedJob.report.niceToHave.length > 0 ? selectedJob.report.niceToHave.map((item, i) => <li key={i} style={{ marginBottom: 12 }}>{item}</li>) : <li>Not available</li>}
                      </ul>
                    </div>
                  </div>

                  {/* 7. Social Post */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Social Post</h3>
                      <button 
                        onClick={() => handleCopySection(selectedJob.report.socialPost || "", "Social Post")}
                        style={{ 
                          display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", 
                          background: "transparent", border: "1px solid var(--border-color)", 
                          borderRadius: 6, fontSize: 13, color: "var(--text-primary)", cursor: "pointer",
                          fontWeight: 500, transition: "all 0.2s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                      </button>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: 15, lineHeight: 1.8, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.02)", padding: 24, borderRadius: 12 }}>
                      {selectedJob.report.socialPost || "Not generated yet."}
                    </div>
                  </div>

                  {/* 8. Boolean Search */}
                  {selectedJob.report.booleanSearchQueries ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <h3 style={{ fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Boolean Search</h3>
                    {Object.entries(selectedJob.report.booleanSearchQueries).map(([key, query]) => query ? (
                      <div key={key}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: 8 }}>{key}</div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ flex: 1, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: 15, background: "rgba(0,0,0,0.02)", padding: "16px 20px", borderRadius: 8, lineHeight: 1.8 }}>{query}</div>
                          <button 
                            onClick={() => handleCopySection(query as string, `Boolean ${key}`)} 
                            style={{ 
                              padding: "0 16px", background: "transparent", border: "1px solid var(--border-color)", 
                              borderRadius: 8, fontSize: 13, color: "var(--text-primary)", cursor: "pointer", 
                              fontWeight: 500, display: "flex", alignItems: "center", transition: "all 0.2s" 
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    ) : null)}
                  </div>
                  ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Boolean Search</h3>
                      <button 
                        onClick={() => handleCopySection(selectedJob.report.booleanSearch || "", "Boolean Search")}
                        style={{ 
                          display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", 
                          background: "transparent", border: "1px solid var(--border-color)", 
                          borderRadius: 6, fontSize: 13, color: "var(--text-primary)", cursor: "pointer",
                          fontWeight: 500, transition: "all 0.2s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                      </button>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: 15, lineHeight: 1.8, background: "rgba(0,0,0,0.02)", padding: 24, borderRadius: 12 }}>
                      {selectedJob.report.booleanSearch || "Not generated yet."}
                    </div>
                  </div>
                  )}

                  {/* 6 & 9: Questions for Client / Interview Questions (Layout 2 cột) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56 }}>
                    {/* 6. Questions for Client */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Questions for Client</h3>
                        <button 
                          onClick={() => {
                            const textToCopy = selectedJob.report.questionsForClient && selectedJob.report.questionsForClient.length > 0 
                              ? selectedJob.report.questionsForClient.map((item, i) => `${i + 1}. ${item}`).join('\n') 
                              : "";
                            handleCopySection(textToCopy, "Questions for Client");
                          }}
                          style={{ 
                            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", 
                            background: "transparent", border: "1px solid var(--border-color)", 
                            borderRadius: 6, fontSize: 13, color: "var(--text-primary)", cursor: "pointer",
                            fontWeight: 500, transition: "all 0.2s"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          Copy
                        </button>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 24, fontSize: 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        {selectedJob.report.questionsForClient && selectedJob.report.questionsForClient.length > 0 ? (
                          selectedJob.report.questionsForClient.map((item, i) => <li key={i} style={{ marginBottom: 12 }}>{item}</li>)
                        ) : (
                          <li>Not available</li>
                        )}
                      </ul>
                    </div>

                    {/* 9. Interview Questions */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3 style={{ fontSize: 30, fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>Interview Questions</h3>
                        <button 
                          onClick={() => {
                            const textToCopy = selectedJob.report.interviewQuestions && selectedJob.report.interviewQuestions.length > 0 
                              ? selectedJob.report.interviewQuestions.map((item, i) => `${i + 1}. ${item}`).join('\n') 
                              : "";
                            handleCopySection(textToCopy, "Interview Questions");
                          }}
                          style={{ 
                            display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", 
                            background: "transparent", border: "1px solid var(--border-color)", 
                            borderRadius: 6, fontSize: 13, color: "var(--text-primary)", cursor: "pointer",
                            fontWeight: 500, transition: "all 0.2s"
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.03)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                          Copy
                        </button>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 24, fontSize: 17, lineHeight: 1.8, color: "var(--text-primary)" }}>
                        {selectedJob.report.interviewQuestions && selectedJob.report.interviewQuestions.length > 0 ? (
                          selectedJob.report.interviewQuestions.map((item, i) => <li key={i} style={{ marginBottom: 12 }}>{item}</li>)
                        ) : (
                          <li>Not available</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 900, height: "100%", overflowY: "auto", paddingRight: 16 }}>
            
            {/* Header */}
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  {editingClientId === selectedClient.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <input 
                          value={editingNameVal} 
                          onChange={e => setEditingNameVal(e.target.value)}
                          placeholder="Tên công ty..."
                          style={{ 
                            fontSize: 28, 
                            fontWeight: 800, 
                            padding: "4px 0", 
                            background: "transparent", 
                            color: "#3730a3", 
                            border: "none", 
                            borderBottom: "2px solid #6366f1",
                            outline: "none", 
                            minWidth: 240,
                            letterSpacing: "-0.02em"
                          }} 
                          autoFocus
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <button 
                            onClick={() => handleUpdateClient(selectedClient.id)} 
                            style={{ 
                              width: 32, 
                              height: 32, 
                              borderRadius: 8, 
                              background: "#10b981", 
                              color: "white", 
                              border: "none", 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center",
                              cursor: "pointer"
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                          <button 
                            onClick={() => setEditingClientId(null)} 
                            style={{ 
                              width: 32, 
                              height: 32, 
                              borderRadius: 8, 
                              background: "rgba(0,0,0,0.05)", 
                              color: "#64748b", 
                              border: "none", 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center",
                              cursor: "pointer"
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                          <input 
                            value={editingWebsiteVal} 
                            onChange={e => setEditingWebsiteVal(e.target.value)}
                            placeholder="Website..."
                            style={{ 
                              fontSize: 13, 
                              fontWeight: 600, 
                              padding: "2px 0", 
                              background: "transparent", 
                              color: "#4f46e5", 
                              border: "none", 
                              borderBottom: "1.5px solid rgba(79, 70, 229, 0.2)",
                              outline: "none", 
                              width: 180
                            }} 
                          />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                          <input 
                            value={editingTaglineVal} 
                            onChange={e => setEditingTaglineVal(e.target.value)}
                            placeholder="Tagline..."
                            style={{ 
                              fontSize: 13, 
                              fontWeight: 500, 
                              padding: "2px 0", 
                              background: "transparent", 
                              color: "#64748b", 
                              border: "none", 
                              borderBottom: "1.5px solid rgba(100, 116, 139, 0.2)",
                              outline: "none", 
                              width: 200
                            }} 
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#3730a3", display: "flex", alignItems: "center", gap: 12, letterSpacing: "-0.02em" }}>
                          {selectedClient.name}
                        </h1>
                        <button 
                          onClick={() => { 
                            setEditingClientId(selectedClient.id); 
                            setEditingNameVal(selectedClient.name); 
                            setEditingWebsiteVal(selectedClient.website || ""); 
                            setEditingTaglineVal(selectedClient.tagline || "");
                          }} 
                          style={{ 
                            background: "rgba(99, 102, 241, 0.08)", 
                            border: "none", 
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            cursor: "pointer", 
                            color: "#6366f1", 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center"
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <span style={{ padding: "4px 10px", background: "rgba(34, 197, 94, 0.15)", color: "#16a34a", fontSize: 11, fontWeight: 700, borderRadius: 12, textTransform: "uppercase" }}>Active</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 2 }}>
                        {selectedClient.website && (
                          <a href={selectedClient.website} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#4f46e5", fontWeight: 600, display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                            {selectedClient.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                        )}
                        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                          {selectedClient.tagline || "N/A"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Universal Input Area */}
            <div 
              style={{ 
                display: "flex",
                flexDirection: "column",
                gap: 20,
                padding: "0 4px"
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ fontSize: 13, color: "#3730a3", fontWeight: 800, display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", boxShadow: "0 0 8px rgba(99, 102, 241, 0.4)" }}></span>
                  Tên vị trí tuyển dụng
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>(Không bắt buộc)</span>
                </label>
                <input 
                  type="text"
                  className="liquid-glass-input"
                  value={manualJobTitle}
                  onChange={e => setManualJobTitle(e.target.value)}
                  placeholder="Ví dụ: Lead Auditor - CSR & Sustainability..."
                  style={{ 
                    width: "100%", 
                    padding: "12px 16px", 
                    borderRadius: 12, 
                    fontSize: 14, 
                    fontWeight: 500,
                    border: "1.5px solid rgba(99, 102, 241, 0.1)",
                    background: "rgba(255, 255, 255, 0.5)",
                    backdropFilter: "none",
                    boxShadow: "none",
                    margin: "1px"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 4, paddingRight: 4 }}>
                  <label style={{ fontSize: 13, color: "#3730a3", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8b5cf6", boxShadow: "0 0 8px rgba(139, 92, 246, 0.4)" }}></span>
                    Nội dung mô tả công việc (JD)
                  </label>
                  
                  <Btn 
                    onClick={async () => {
                      if (!universalInput.trim()) return;
                      await handleUniversalInputSubmit();
                      setShowSavedFeedback(true);
                      setTimeout(() => setShowSavedFeedback(false), 2000);
                    }} 
                    disabled={isProcessingInput || !universalInput.trim()} 
                    style={{ 
                      padding: "6px 16px", 
                      height: 34,
                      borderRadius: 10, 
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: showSavedFeedback ? "#10b981" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      color: "white",
                      border: "none",
                      boxShadow: showSavedFeedback ? "0 4px 12px rgba(16, 185, 129, 0.3)" : "0 4px 12px rgba(99, 102, 241, 0.3)",
                      transform: showSavedFeedback ? "scale(1.05)" : "scale(1)",
                      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                  >
                    {showSavedFeedback ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Saved
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Save
                      </>
                    )}
                  </Btn>
                </div>
                
                <textarea 
                  value={universalInput}
                  onChange={e => setUniversalInput(e.target.value)}
                  placeholder="Dán JD, ghi chú cuộc họp, phản hồi hoặc email yêu cầu..."
                  className="liquid-glass-input"
                  style={{ 
                    width: "100%", 
                    height: 180, 
                    borderRadius: 16, 
                    padding: "16px 18px", 
                    fontSize: 14, 
                    resize: "none", 
                    fontFamily: "inherit",
                    lineHeight: 1.6,
                    fontWeight: 500,
                    border: "1.5px solid rgba(99, 102, 241, 0.1)",
                    background: "rgba(255, 255, 255, 0.5)",
                    backdropFilter: "none",
                    boxShadow: "none",
                    margin: "1px"
                  }}
                />
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
              <div style={{ 
                display: "flex", 
                alignItems: isMobile ? 'flex-start' : 'center', 
                justifyContent: "space-between", 
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? 8 : 16,
                marginBottom: 16 
              }}>
                <h2 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 800, margin: 0, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  Danh sách công việc (Jobs)
                </h2>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
                  {selectedClient.jobs.length} công việc
                </span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selectedClient.jobs.length === 0 && (
                  <div style={{ 
                    padding: "32px 24px", 
                    textAlign: "center", 
                    color: "var(--text-muted)", 
                    fontSize: 14,
                    background: "var(--bg-glass)",
                    borderRadius: 16,
                    border: "1px dashed rgba(99, 102, 241, 0.2)",
                    backdropFilter: "blur(12px)"
                  }}>
                    Chưa có công việc nào. Hãy dán mô tả công việc (JD) ở trên để bắt đầu!
                  </div>
                )}
                {selectedClient.jobs.map((job, index) => (
                  <div 
                    key={job.id} 
                    onClick={() => setSelectedJobId(job.id)}
                    className="liquid-glass-card"
                    onMouseEnter={e => {
                      const btn = e.currentTarget.querySelector('.job-delete-btn') as HTMLElement;
                      if (btn) btn.style.opacity = '1';
                      const icon = e.currentTarget.querySelector('.job-icon-container') as HTMLElement;
                      if (icon) icon.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={e => {
                      const btn = e.currentTarget.querySelector('.job-delete-btn') as HTMLElement;
                      if (btn) btn.style.opacity = '0';
                      const icon = e.currentTarget.querySelector('.job-icon-container') as HTMLElement;
                      if (icon) icon.style.transform = "scale(1)";
                    }}
                    style={{ 
                      padding: isMobile ? "14px 16px" : "18px 24px", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: isMobile ? 12 : 18,
                      borderRadius: 16,
                      cursor: "pointer",
                      position: "relative"
                    }}
                  >
                    <div 
                      className="job-icon-container"
                      style={{ 
                        color: "#6366f1", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        width: isMobile ? 40 : 44, 
                        height: isMobile ? 40 : 44, 
                        borderRadius: 12, 
                        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.15))",
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        border: "1px solid rgba(99, 102, 241, 0.15)",
                        flexShrink: 0
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: isMobile ? 15 : 16, 
                        fontWeight: 700, 
                        color: "var(--text-primary)", 
                        marginBottom: 4, 
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                      }}>
                        {job.title}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {isMobile ? "Cập nhật:" : "Cập nhật:"} {job.updatedAt}
                        </span>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#10B981", display: isMobile ? "none" : "block" }}></span>
                        <span style={{ fontSize: 11, background: "rgba(16, 185, 129, 0.1)", color: "#10B981", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>
                          Sẵn sàng
                        </span>
                      </div>
                    </div>
                    
                    {/* Delete job button (visible on hover) */}
                    <button 
                      className="job-delete-btn"
                      onClick={(e) => handleDeleteJob(e, job)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--danger)', 
                        cursor: 'pointer', 
                        padding: 8, 
                        opacity: 0, 
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 8,
                        marginRight: 8
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                        e.currentTarget.style.transform = "scale(1.1)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "none";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                      title="Xóa Job"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                    
                    <div style={{ 
                      color: "#6366f1", 
                      background: "rgba(99, 102, 241, 0.08)", 
                      width: 32, 
                      height: 32, 
                      borderRadius: "50%", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      transition: "all 0.2s"
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
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
      )}

      {/* FLOATING ASK AI SECTION & TRIGGER BUTTON */}
      <div
        style={{
          position: "fixed",
          bottom: 32,
          right: 32,
          zIndex: 9999,
          pointerEvents: "none"
        }}
      >
        {/* FLOATING ASK AI WINDOW */}
        <AnimatePresence>
          {isChatOpen && (() => {
            const chatBottomFromViewport = 104 - draggedY;
            const maxAllowedHeight = windowHeight - 24 - chatBottomFromViewport;
            const dynamicHeight = Math.max(250, Math.min(550, maxAllowedHeight));

            const buttonRightFromRightEdge = 32 - draggedX;
            const rightOffset = Math.max(0, buttonRightFromRightEdge - (windowWidth - 396));

            return (
              <motion.div 
                initial={{ opacity: 0, y: 35, scale: 0.9, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 25, scale: 0.92, filter: "blur(4px)" }}
                transition={{ type: "spring", damping: 22, stiffness: 200 }}
                onPointerDown={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
                style={{
                  position: "absolute",
                  bottom: 72,
                  right: -rightOffset,
                  width: 380,
                  height: dynamicHeight,
                  x: dragX,
                  y: dragY,
                  background: "var(--bg-glass)",
                  backdropFilter: "blur(24px) saturate(180%)",
                  WebkitBackdropFilter: "blur(24px) saturate(180%)",
                  borderRadius: 24,
                  border: "1.5px solid rgba(99, 102, 241, 0.18)",
                  boxShadow: "0 20px 50px rgba(99, 102, 241, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.5)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  pointerEvents: "auto",
                  zIndex: 9999
                }}
              >
                {/* Header */}
                <div style={{
                  padding: "16px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1.5px solid rgba(99, 102, 241, 0.12)",
                  background: "rgba(255, 255, 255, 0.12)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "white" }}><path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z"></path></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)" }}>freeC AI</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                        {selectedClient ? `Đang hỗ trợ: ${selectedClient.name}` : "Trợ lý trí tuệ tuyển dụng"}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsChatOpen(false)} 
                    style={{ 
                      background: "rgba(99, 102, 241, 0.08)", 
                      border: "none", 
                      color: "#6366f1", 
                      cursor: "pointer", 
                      padding: 6, 
                      borderRadius: "50%",
                      display: "flex", 
                      transition: "all 0.2s" 
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                      e.currentTarget.style.color = "var(--danger)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(99, 102, 241, 0.08)";
                      e.currentTarget.style.color = "#6366f1";
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "18px", display: "flex", flexDirection: "column", gap: 18, background: "rgba(255, 255, 255, 0.04)" }}>
                  {chatMessages.map((msg, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        background: msg.role === 'user' ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "var(--bg-card)",
                        color: msg.role === 'user' ? "white" : "var(--text-primary)",
                        padding: "11px 15px", borderRadius: 16,
                        borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                        borderBottomLeftRadius: msg.role === 'user' ? 16 : 4,
                        maxWidth: "88%", fontSize: 13.5, lineHeight: 1.6, 
                        whiteSpace: msg.role === 'user' ? "pre-wrap" : "normal",
                        boxShadow: msg.role === 'user' ? "0 4px 12px rgba(99, 102, 241, 0.15)" : "0 2px 8px rgba(0,0,0,0.03)",
                        border: msg.role === 'user' ? "none" : "1.5px solid rgba(99, 102, 241, 0.1)"
                      }}>
                        {msg.role === 'user' ? (
                          msg.content
                        ) : (
                          <div className="chat-bubble-markdown">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                      {msg.time && (
                        <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 4, padding: "0 4px" }}>
                           {msg.time}
                           {msg.role === 'user' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div style={{ padding: "14px", borderTop: "1.5px solid rgba(99, 102, 241, 0.12)", background: "rgba(255, 255, 255, 0.12)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-card)", borderRadius: 24, border: "1.5px solid rgba(99, 102, 241, 0.15)", padding: "4px 4px 4px 14px" }}>
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleChatSubmit(); }}
                      placeholder={selectedClient ? `Hỏi về ${selectedClient.name}...` : "Hỏi freeC AI..."}
                      style={{ flex: 1, border: "none", background: "transparent", fontSize: 13.5, outline: "none", color: "var(--text-primary)" }}
                    />
                    <button onClick={handleChatSubmit} style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8, fontWeight: 500 }}>
                    AI có thể mắc lỗi. Vui lòng kiểm tra thông tin quan trọng.
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* FLOATING AI TRIGGER BUTTON */}
        <motion.button 
          drag
          dragMomentum={false}
          dragElastic={0.1}
          dragConstraints={{
            left: -windowWidth + 88,
            right: 16,
            top: -windowHeight + 88,
            bottom: 16
          }}
          initial={{ x: draggedX, y: draggedY }}
          animate={{ x: draggedX, y: draggedY }}
          transition={{ duration: 0 }}
          onDragStart={(event, info) => {
            dragStartPos.current = { x: info.point.x, y: info.point.y };
            isDraggingRef.current = true;
          }}
          onDragEnd={(event, info) => {
            const dx = info.point.x - dragStartPos.current.x;
            const dy = info.point.y - dragStartPos.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            setDraggedX(dragX.get());
            setDraggedY(dragY.get());

            if (distance > 5) {
              isDraggingRef.current = true;
            } else {
              isDraggingRef.current = false;
            }

            // Keep true for a brief duration to swallow any immediate tap/click events
            setTimeout(() => {
              isDraggingRef.current = false;
            }, 150);
          }}
          onTap={() => {
            if (isDraggingRef.current) return;
            setIsChatOpen(prev => !prev);
          }}
          whileHover={{ scale: 1.1, boxShadow: "0 12px 28px rgba(99, 102, 241, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4)" }}
          whileTap={{ scale: 0.95 }}
          style={{ 
            width: 56,
            height: 56,
            borderRadius: "50%", 
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)", 
            border: "none",
            color: "white",
            boxShadow: "0 8px 24px rgba(99, 102, 241, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            cursor: "grab",
            position: "absolute",
            bottom: 0,
            right: 0,
            pointerEvents: "auto",
            x: dragX,
            y: dragY
          }}
          title="Hỏi freeC AI"
        >
          {/* Pulse ripple effect */}
          {!isChatOpen && (
            <motion.span 
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              style={{
                position: "absolute",
                inset: -3,
                borderRadius: "50%",
                border: "2px solid rgba(99, 102, 241, 0.3)",
                pointerEvents: "none"
              }} 
            />
          )}
          
          {/* Animated icon container */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isChatOpen ? "close" : "spark"}
              initial={{ rotate: -45, scale: 0.8, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 45, scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {isChatOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  <path d="M12 7v6"></path>
                  <path d="M9 10h6"></path>
                </svg>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.button>
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
                  Báo cáo Tổng hợp (Intelligence Report)
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>Báo cáo Trí tuệ Tuyển dụng</label>
                    <div style={{ display: "flex", background: "var(--bg-body)", padding: 4, borderRadius: 8, border: "1px solid var(--border-color)" }}>
                      <button 
                        onClick={() => setActiveMarkdownReviewMode('preview')}
                        style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, border: "none", background: activeMarkdownReviewMode === 'preview' ? "var(--primary)" : "transparent", color: activeMarkdownReviewMode === 'preview' ? "#fff" : "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}
                      >
                        Preview
                      </button>
                      <button 
                        onClick={() => setActiveMarkdownReviewMode('edit')}
                        style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, border: "none", background: activeMarkdownReviewMode === 'edit' ? "var(--primary)" : "transparent", color: activeMarkdownReviewMode === 'edit' ? "#fff" : "var(--text-muted)", cursor: "pointer", fontWeight: 600 }}
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {activeMarkdownReviewMode === 'edit' ? (
                    <textarea 
                      value={draftResult.jobData.markdownReport || ""} 
                      onChange={e => handleDraftMarkdownChange(e.target.value)}
                      style={{ width: "100%", height: 500, padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-body)", color: "var(--text-primary)", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "monospace", lineHeight: 1.6 }}
                      placeholder="Nội dung báo cáo dạng Markdown..."
                    />
                  ) : (
                    <div style={{ 
                      width: "100%", 
                      height: 500, 
                      padding: "24px", 
                      borderRadius: 8, 
                      border: "1px solid var(--border-color)", 
                      background: "var(--bg-body)", 
                      overflowY: "auto" 
                    }} className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{draftResult.jobData.markdownReport || ""}</ReactMarkdown>
                    </div>
                  )}
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