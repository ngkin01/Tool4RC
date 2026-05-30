<div align="center">

<img src="https://tool4rc.vercel.app/cover-share.png" alt="Tool4RC Banner" width="900" />

# Tool4RC

**Work faster. Close more placements.**

*Automate the process, humanize the candidate experience.*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-tool4rc.vercel.app-6C63FF?style=for-the-badge&logo=vercel)](https://tool4rc.vercel.app/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

---

## 📖 About

**Tool4RC** is an AI-powered productivity suite built specifically for **Recruitment Consultants**. It eliminates the most repetitive parts of the recruitment workflow — summarizing CVs, drafting emails, managing JDs, coordinating interviews across timezones — so RCs can focus on building real connections.

> *"Tool for Recruitment Consultant – for Real Connections."*

---

## ✨ Features

### 📋 Candidate Tools `/candidate`
Paste or upload a candidate's CV alongside a Job Description to instantly:
- **Generate Summary** — AI-written CV summary ready to send to clients (EN/VI)
- **Analyze CV** — Pre-call fit analysis against the JD with match insights
- **Generate Email** — Draft a polished client submission email automatically
- **Find Phone** — Extract contact number directly from CV content
- Supports plain text paste and **PDF/file upload**

### 📁 JD Hub `/jdhub`
A shared library to find and reuse Job Descriptions in seconds.
- Search by **job title** or **client name**
- **View** full JD or **Copy** to clipboard in one click
- Keeps the whole team aligned on the latest active roles

### ✍️ Job Post Generator `/jobpost`
Turn any JD into platform-ready social content — paste a JD or Job URL to get:
- Posts tailored for **LinkedIn**, **FB Group**, **FB Profile**, or custom platforms
- Optional instructions to control tone, length, and highlights
- Editable **prompt templates** per platform
- Built-in **Social Media Text Formatter** — apply bold, italics, bullet formatting with a live LinkedIn-style post preview

### 📧 Interview Mail `/mail`
Generate professional interview invitation emails with smart inline editing.
- Select round: **1st / 2nd–3rd / Final**
- Select format: **Offline / Online**
- Select language: **EN / VI**
- Auto-generated subject line: `freeC - [company] || Interview Invitation - [candidate] - [date] - [time]`
- Click any highlighted field (name, company, position, date, time, venue) to edit inline
- **Enhance Location**, **Template** management, and **Copy Email** in one click

### ⏰ Interview Time Planner `/planner`
Coordinate interview times across multiple timezones without the mental overhead.
- Pick a date, add multiple cities by search — times displayed side-by-side with live clock
- Toggle **12h / 24h** format
- One-click **Copy result** — formatted as `Friday, May 29, 2026: 9:59 AM – 10:44 AM (Vietnam - GMT+7)`
- **Interview Message Converter** — paste any recruiter message mentioning interview times, enter the candidate's timezone, and AI rewrites the message with converted times automatically

---

## 🤖 AI Provider Support

Tool4RC supports **6 AI providers** — switch freely in the API Key settings panel:

| Provider | Default Model |
|---|---|
| **Google Gemini** *(default)* | `gemini-2.5-flash` |
| **OpenAI** | `gpt-4o-mini` |
| **Grok** (xAI) | — |
| **Groq** | `llama-3.3-70b-versatile` |
| **Cerebras** | `qwen-3-235b-a22b-instruct-2507` |
| **Qwen** (Alibaba) | `qwen-plus` |

All API keys are stored in **localStorage** — nothing is sent to any backend. Supports custom Gemini proxy URL.

The app also tracks **AI usage** (tokens in/out per request) with a 30-day history dashboard.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- An API key from any supported provider (e.g. [Google AI Studio](https://aistudio.google.com/) for Gemini)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/ngkin01/Tool4RC.git
cd Tool4RC

# 2. Install dependencies
npm install

# 3. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then click **API Key** in the top right to add your key.

### Build for production

```bash
npm run build
npm run preview
```

---

## 🔑 Environment Variables

The `.env.example` file is included for reference. In practice, **API keys are stored in localStorage** via the in-app settings panel — no `.env` file is required for local development.

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Gemini API key (used when deployed on Google AI Studio) |
| `APP_URL` | Hosting URL (injected automatically by AI Studio at runtime) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| AI (primary) | Google Gemini (`@google/genai`) |
| AI (others) | OpenAI SDK — used for OpenAI, Grok, Groq, Cerebras, Qwen |
| PDF parsing | `pdfjs-dist` |
| Animations | `motion`, `react-spring` |
| Rich text | `react-quill-new` |
| Icons | `lucide-react` |
| Hosting | Vercel |

---

## 📁 Project Structure

```
Tool4RC/
├── public/                   # Static assets (logo, icons)
├── src/
│   ├── components/
│   │   ├── Header.tsx        # Top bar + API key settings modal
│   │   ├── NavSidebar.tsx    # Navigation sidebar
│   │   ├── LinkedInFormatter.tsx
│   │   ├── UsageDashboard.tsx
│   │   └── ui.tsx            # Shared UI components (Modal, Toast)
│   ├── lib/
│   │   ├── ai.ts             # AI provider clients & call wrappers
│   │   ├── timezoneUtils.ts  # Timezone conversion logic
│   │   ├── unicodeFormatter.ts
│   │   ├── usage.ts          # Token usage tracking
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Landing.tsx       # Dashboard homepage
│   │   ├── CandidateTools.tsx
│   │   ├── JDHub.tsx
│   │   ├── JobPostGenerator.tsx
│   │   ├── InterviewMail.tsx
│   │   └── InterviewPlanner.tsx
│   ├── App.tsx               # Root component + routing
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
└── .env.example
```

---

## 👤 Author

**Tommy Nguyen** · [@ngkin01](https://github.com/ngkin01)

---

## 📄 License

This project is licensed under the [Apache-2.0](LICENSE) license.

---

<div align="center">
  Made with ❤️ for Recruitment Consultants
</div>
