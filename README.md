<div align="center">

# ⬡ IRIS — Improve Resume Intelligence Studio

> **Stop sending your CV into the "Resume Black Hole".**

[![GitHub stars](https://img.shields.io/github/stars/her0-00/IRIS---Improve-Resume-Intelligence-Studio?style=for-the-badge&color=FFE066&logo=github&labelColor=2B2D31)](https://github.com/her0-00/IRIS---Improve-Resume-Intelligence-Studio/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/her0-00/IRIS---Improve-Resume-Intelligence-Studio?style=for-the-badge&color=4DABF7&logo=git&labelColor=2B2D31)](https://github.com/her0-00/IRIS---Improve-Resume-Intelligence-Studio/network)
[![License: MIT](https://img.shields.io/badge/License-MIT-40C057?style=for-the-badge&logo=open-source-initiative&labelColor=2B2D31)](LICENSE)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-228BE6?style=for-the-badge&logo=docker&labelColor=2B2D31)](Dockerfile)
[![Build Status](https://img.shields.io/github/actions/workflow/status/her0-00/IRIS---Improve-Resume-Intelligence-Studio/ci.yml?branch=main&style=for-the-badge&logo=github-actions&labelColor=2B2D31)](https://github.com/her0-00/IRIS---Improve-Resume-Intelligence-Studio/actions)

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white&labelColor=2B2D31)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15%2F16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white&labelColor=2B2D31)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white&labelColor=2B2D31)](https://tailwindcss.com/)

75% of applications are rejected by automated bots before a human ever sees them.  
**IRIS** is a high-performance AI-powered utility designed to audit, rewrite, and export your CV so it bypasses Applicant Tracking Systems (ATS) and lands directly on a recruiter's desk.

🌐 **[Live Demo](https://iris.onrender.com/)** · 💬 **[Support Guide](SUPPORT.md)** · ⚙️ **[How to Contribute](CONTRIBUTING.md)** · 🛡️ **[Security Policy](SECURITY.md)** · 🐛 **[Report Bug](.github/ISSUE_TEMPLATE/bug_report.md)**

<br/>

![IRIS Home Interface](home.png)

</div>

---

## 🚀 The Value Proposition

| Feature | Impact |
| :--- | :--- |
| **ATS Forensic Audit** | Identifies why robots (Workday, Taleo, iCIMS) are flagging your CV. |
| **Psychological Insights** | AI analyzes why a human recruiter might ignore or underpay you. |
| **Market Value Benchmarking** | Estimates your salary potential and identifies the "Salary Gap". |
| **Semantic Keyword Injection** | Automatically matches your skills to the job offer using ethical reformulation. |
| **Dual Workflow** | "I have a job offer" OR "Find offers matching my CV" — two distinct paths. |
| **🤖 Autonomous Hunter** | AI agent that autonomously scrapes job sites, scores offers vs your CV, and generates ready-to-send PDFs. |
| **CV Comparison** | Myers' diff algorithm with word-level highlighting to visualize AI improvements. |
| **ATS Simulator** | Extract and score your PDF exactly as ATS systems would see it. |
| **CV Studio Pro** | Generates pixel-perfect PDFs in 32 premium themes with full customization. |
| **Profile Photo Integration** | Upload and embed professional photos in 10 specialized photo-enabled themes. |
| **DOCX Export** | Download editable Word format for further customization. |
| **### 🤖 Autonomous Hunter** | Fully autonomous job-hunting agent:
- **Configure**: query, location, company blacklist, recency filter
- **Sources**: JobTeaser (university portal) or Multi-source (WTTJ, HelloWork, Adzuna)
- **Real-time console**: streaming logs via SSE (Server-Sent Events)
- **Auto-scoring**: AI rates each offer vs your CV (0–100 match score)
- **Auto-generation**: PDF CV + cover letter generated per matched offer
- **Results library**: browse hunts grouped by company, filter by freshness (< 2h, < 24h, < 3d)
- **Abort support**: stop mission at any time with clean process termination |
| **### ✉️ Cover Letter Generator (v2)** | - Fully AI-powered (Groq / Mistral / Google AI / **Azure OpenAI**)
- Bilingual: **French and English** output
- Structured 4-paragraph narrative (Hook → You → Company → CTA)
- Infers company address and hiring manager from context
- Preserves authentic background if existing letter provided
- Outputs structured JSON → rendered into premium PDF layout
- Accessible from CV Studio and Autonomous Hunter results |
| **4 AI Providers** | Groq, Mistral AI, Google AI (Gemini), or Azure OpenAI for analysis. |
| **Onboarding Tour** | Guided interactive tour with mobile-adaptive tooltips. |

---

## 🎯 Dual Workflow

After uploading your CV, IRIS offers two distinct paths:

### 📄 Path A — "I have a job offer"
1. Paste the job description
2. Instant CV vs. offer analysis
3. ATS Score + missing keywords
4. AI rewrite optimized for the role
5. Export PDF / DOCX

### 🔍 Path B — "Find offers that match my CV"
1. Automatic keyword extraction from your CV (Groq AI)
2. Intelligent scraping (WTTJ, HelloWork via Playwright)
3. AI relevance scoring (0–100) for each offer
4. Select an offer → Audit → Rewrite → PDF export

### 🤖 Path C — Autonomous Hunter (NEW)
Fully autonomous job-hunting agent that runs in the background:
1. Configure search query, location, blacklisted companies
2. Choose source: **JobTeaser only** or **Multi-source** (WTTJ, HelloWork, Adzuna)
3. Filter by recency: All / Last 24h / Last 7 days
4. Agent scrapes, scores, and generates a full PDF per matched offer
5. **Live streaming console** with real-time logs
6. **Results library** — browse all hunts grouped by company, filtered by freshness
7. One-click to open any result in CV editor or letter editor

---

## 🛠️ Core Features

### 🔍 Deep Audit & Scoring
Get a precise **Score (0–100)**, a **Pass Probability**, and a **Market Verdict**. IRIS scans for:
- **Missing Keywords**: Specific technical and soft skills the ATS is looking for.
- **Content Density**: Evaluates if your experience matches the seniority level.
- **Recruiter Psychology**: Explains the "Shadow Profile" you present to hiring managers.
- **CV Comparison**: Myers' diff algorithm with word-level highlighting (side-by-side & unified views).
- **ATS Simulator**: Extract text exactly as ATS systems see it with compatibility scoring.

### 🧠 Intelligent AI Rewriting
Powered by **3 AI Providers** (Groq, Mistral AI, Google AI), IRIS transforms your CV:
- **Boost Mode**: Enriches your experience with hidden accomplishments relevant to the job.
- **Ethical Keyword Injection**: Reformulates existing experience with job offer vocabulary without inventing skills.
- **Quantifiable Impact**: Ensures every bullet point includes metrics (%, $, time, users).
- **Dual Language**: Seamlessly translate and optimize between French and English.
- **Live Editor**: Click any part of your PDF preview and edit text directly.

### 🔎 Job Search Integration
Integrated job search powered by **Adzuna API** (1000 free calls/month):
- Search 1000+ job offers across France
- Filter by keywords, location, and remote options
- Click any offer to auto-fill the job description field
- **GIS Map Visualization**: Interactive Leaflet map with geolocation markers
- Combine with **Remotive API** for remote-first positions
- No scraping, no CAPTCHA, 100% legal APIs

![Job Search Map Visualization](sig.png)

### 🤖 Intelligent Job Scraping
For offline/direct job discovery:
- **Playwright headless** for JS-rendered sites (WTTJ, HelloWork)
- **Rate limiting**: 2s between sites, 15s timeout per page, 30s global
- **Auto-deduplication** of results
- **AI scoring**: Groq rates each offer's relevance to your CV (0–100)

### 🎨 The PDF Engine (Python Worker)
Most "beautiful" CVs (Canva/Design) fail ATS because machines can't read them. Our Python backend uses **ReportLab** with exact coordinate drawing:
- **32 Premium Themes**: 16 standard + 10 photo-enabled + 6 ATS-optimized
- **Real-time Customization Studio**:
  - Accent, primary, secondary, and tertiary color schemes
  - Typography: name, headings, subheadings, body text colors
  - Backgrounds: main body, sidebar, header
  - Photo border colors (photo themes)
  - Font scale: 50% to 200% with maintained layout integrity
- **100% ATS-Safe**: Every PDF is text-extractable with proper Unicode mapping.

---

## 🎭 Theme Categories

### Standard Themes (16)
Professional layouts without photo integration:
| Theme | Style |
|-------|-------|
| Classic Dark | Elegant sidebar with gold accents |
| Canva Minimal | Clean white design with coral highlights |
| Nordic Clean | Scandinavian-inspired pastel aesthetics |
| Tech Grid | Dark mode with geometric grid patterns |
| Luxury Serif | Premium serif typography for consulting |
| Finance Pro | Navy and gold for financial sector |
| Medical Clean | Aqua accents for healthcare professionals |
| BTP Industry | Safety orange for construction/engineering |
| Apprentice | Vibrant yellow for entry-level positions |
| Startup SaaS | Violet and pink for tech startups |
| Academic Legal | Monochrome professional for law/academia |
| Creative Agency | Rose tones for creative industries |
| Logistics | Navy and green for supply chain |
| Retail Sales | Bold red for sales positions |
| Executive C | Slate gray for C-level executives |
| SOTA Luxury | Champagne gold ultra-premium design |

### Photo-Enabled Themes (10)
Specialized layouts with integrated profile photos:
| Theme | Style |
|-------|-------|
| Executive Portrait | Round photo in premium header (corporate) |
| Modern Profile | Large sidebar photo with tech styling |
| Creative Vision | Artistic diagonal layout with colored overlay |
| Finance Executive | Formal photo with finance color palette |
| Tech Leader | Modern sidebar with tech accents |
| Startup Founder | Dynamic photo with innovative layout |
| Consultant Premium | 3-column layout with centered photo |
| Corporate Elite | Asymmetric header with photo integration |
| Minimalist Pro | Ultra-clean design with small aligned photo |
| International Profile | Sidebar with square photo and progress bars |

---

## ⚡ Quick Start (Self-Host)

### Prerequisites
- Node.js 20+
- Python 3.11+
- At least one AI API Key: [Groq](https://console.groq.com) (Free) | [Mistral](https://console.mistral.ai) | [Google AI](https://aistudio.google.com/apikey) | [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service)
- *(Optional)* [Adzuna API Key](https://developer.adzuna.com/) for job search

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/her0-00/IRIS---Improve-Resume-Intelligence-Studio.git
cd IRIS---Improve-Resume-Intelligence-Studio

# 2. Install Python backend dependencies
pip install -r requirements.txt

# 3. (Optional) Install Playwright for job scraping & Autonomous Hunter
python -m playwright install chromium

# 4. Install & start the Next.js frontend
cd web
npm install
npm run dev
```

Navigate to `http://localhost:3000` to start your audit.

### Environment Variables

Create a `.env.local` file in the `web/` directory (see `.env.example`):

```bash
# At least one AI provider is required
GROQ_API_KEY=your_groq_key_here
MISTRAL_API_KEY=your_mistral_key_here         # optional
GOOGLE_API_KEY=your_google_key_here           # optional

# Azure OpenAI — optional
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-deployment-name

# Job Search (Adzuna) — optional
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key

# Server
PORT=3000
```

---

## 🚀 Deployment (Render.com)

### One-Click Deploy
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com)

### Manual Deployment
1. **Fork this repository** to your GitHub account
2. **Create a new Web Service** on [Render.com](https://render.com)
3. **Connect your GitHub repository**
4. **Configure Environment Variables** (see above)
5. **Deploy Settings**:
   - Build Command: *(Handled by Dockerfile)*
   - Start Command: *(Handled by Dockerfile)*
   - Docker: Enabled — uses `Dockerfile` in root

> 💡 Get free Adzuna credentials at https://developer.adzuna.com/ (1000 calls/month).

### Post-Deployment Notes
- **Cold Start**: On Render's free tier, the service sleeps after 15 minutes of inactivity
- **First Load**: May take 30–60 seconds to wake up
- **Dynamic Rendering**: IRIS uses `force-dynamic` to prevent static caching issues
- **No Reload Needed**: Once awake, all API calls work immediately

### Troubleshooting
| Issue | Solution |
|-------|----------|
| 503 on first load | Normal — service is waking up from sleep |
| API calls failing | Check that env variables are correctly set |
| PDF generation timeout | Increase timeout in Render settings (paid plans) |
| Port issues | Ensure `PORT=10000` is set |
| Playwright not found | Run `python -m playwright install chromium` |
| Out of memory on Render | Upgrade to Starter ($7/mo) or reduce `max_jobs` |

---

## 🏗️ Architecture

IRIS operates as a multi-agent pipeline:

```
User Upload
    │
    ├─► Auditor       — Extracts text (pdfminer.six) + competitive analysis
    ├─► Architect     — Restructures data into normalized JSON schema
    ├─► Worker        — Python process renders JSON into high-fidelity PDF
    └─► Photo Proc.   — Handles photo upload with face detection & optimization
```

### File Structure

```
IRIS/
├── backend/
│   ├── extractor.py          # PDF text extraction (pdfminer.six)
│   ├── pdf_cv.py             # PDF generation engine (ReportLab)
│   ├── docx_cv.py            # DOCX export (python-docx)
│   ├── worker.py             # Agent orchestration
│   ├── photo_processor.py    # Profile photo processing (Pillow)
│   ├── scraper_cli.py        # Playwright job scraper CLI
│   ├── job_hunter_agent.py   # 🆕 Autonomous Hunter agent (Python)
│   └── ats_metadata.py       # ATS compatibility metadata
│
├── web/
│   └── src/app/
│       ├── page.tsx                          # Main UI + workflow logic
│       ├── OnboardingTour.tsx                # Guided interactive tour
│       ├── AutonomousHunter.tsx              # 🆕 Autonomous Hunter component
│       ├── globals.css                       # Responsive styles
│       └── api/
│           ├── extract/route.ts              # PDF text extraction
│           ├── extract_keywords/route.ts     # AI keyword extraction
│           ├── search_jobs/route.ts          # Adzuna + Remotive search
│           ├── analyze/route.ts              # CV analysis
│           ├── generate_cv/route.ts          # PDF/DOCX generation
│           ├── generate_cover_letter/        # 🆕 AI Cover Letter API
│           ├── autonomous-hunt/              # 🆕 Autonomous Hunter API (streaming)
│           ├── company-colors/               # AI company brand color extraction
│           └── job-hunter-results/           # 🆕 Hunt results management
│               ├── data/                     #   → Load a specific result
│               ├── history/                  #   → List/delete hunt history
│               ├── source/                   #   → Get source URL
│               └── view/                     #   → View generated PDF
│
├── web/public/stories/       # 🆕 Sample CVs (Sophie & Lucas before/after)
├── ats_config.json           # 🆕 ATS scoring configuration
├── Dockerfile                # Docker build config
├── render.yaml               # Render.com deployment config
├── requirements.txt          # Python dependencies
└── README.md
```

### Technical Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| **Backend** | Python 3.11, ReportLab, python-docx |
| **AI Engine** | Groq API, Mistral AI, Google AI (Gemini), **Azure OpenAI** |
| **Autonomous Agent** | Python + Playwright (headless) + SSE streaming |
| **Job Search** | Adzuna API, Remotive API, JobTeaser, WTTJ, HelloWork |
| **Map** | Leaflet + React Leaflet |
| **PDF Parsing** | pdfminer.six |
| **Image Processing** | Pillow (face detection + optimization) |
| **Diff Engine** | Myers' diff + Levenshtein similarity |
| **Deployment** | Docker + Render.com |

### Performance

| Operation | Typical Time |
|-----------|-------------|
| CV Upload | ~1–2s |
| Keyword Extraction | ~3–5s (Groq API) |
| Job Scraping | ~15–25s (2 sites, rate-limited) |
| CV Audit | ~5–10s (AI) |
| PDF Generation | ~2–3s (ReportLab) |

---

## 📋 Workflow Example

1. **Upload CV** — Drop your existing PDF or Word document
2. **Choose Path** — "I have a job offer" or "Find matching offers"
3. **Job Search** *(optional)* — Adzuna search or Playwright scraping
4. **Paste/Select Job Offer** — Or auto-fill from search results
5. **AI Analysis** — Instant ATS score and improvement suggestions
6. **Compare Changes** — Before/after with Myers' diff (word-level)
7. **AI Rewrite** *(optional)* — Let AI optimize your content
8. **Choose Theme** — 32 professional PDF themes
9. **Upload Photo** *(optional)* — For the 10 photo-enabled themes
10. **Customize** — Colors, fonts, photo border
11. **ATS Simulator** — Verify ATS compatibility with extraction preview
12. **Export** — Download ATS-optimized PDF or editable DOCX

---

## 🔧 Advanced Features

### CareerOps Integration
IRIS integrates proven CV optimization techniques:
- **Ethical Keyword Injection**: Reformulate existing experience with job vocabulary (never invent)
- **Quantifiable Impact**: Every experience must include numbers (%, $, time, users)
- **ATS Structure Detection**: Warns about multi-column layouts that fail ATS parsing
- **Professional Summary Optimization**: Top 5 keywords in first 2 sentences
- **Exit Narrative**: Automatic bridge for founders/entrepreneurs
- **Date Format Enforcement**: Consistent MM/YYYY formatting

### CV Comparison (Myers' Diff)
- Side-by-side and unified diff views
- Word-level highlighting of changes
- Statistics: lines added, removed, modified
- Color-coded visualization (green/red/orange)
- Levenshtein similarity detection for modified lines

### ATS Simulator
- Extract text exactly as ATS systems see it
- Calculate ATS compatibility score (0–100)
- Detect missing email, phone, sections
- Identify special character issues
- Preview extracted text with metrics

### Photo Customization (v4.1)
- Upload JPG/PNG (max 5MB)
- Automatic face detection and smart cropping
- Customizable border color per theme
- Circular or square rendering based on theme
- Auto-regeneration with debounce (1.2s)

---

## 🛡️ Privacy & Security

- **Zero Data Retention**: CV data is processed in-memory, never stored permanently.
- **Sub-Second AI**: Groq LPU technology ensures analysis completes in under 2 seconds.
- **Local Photo Processing**: Photos never stored on servers.
- **API Key Safety**: Keys stored client-side (localStorage), never logged server-side.
- **Scraping Ethics**: Rate-limited, timeout-guarded, no credential theft.
- **Temp File Cleanup**: Autonomous Hunter cleans up temp CV/letter files after each mission.
- **Azure OpenAI**: Enterprise-grade AI option for organizations with strict data policies.

---

## 📱 Mobile Responsive

IRIS is fully responsive across all screen sizes:

| Breakpoint | Behavior |
|-----------|---------|
| Desktop (>1024px) | Full layout with sidebar |
| Tablet (≤1024px) | 260px sidebar, 2-column theme grid |
| Mobile (≤768px) | Collapsible sidebar, full-width layout |
| Small (≤420px) | 2x2 theme grid, compact tabs |

---

## 🔭 Roadmap

### v4.2 (Short-term)
- [ ] Redis cache for job scraping results
- [ ] Support Indeed + LinkedIn scraping
- [ ] CSV export of hunt results
- [ ] Scheduled autonomous hunts (cron)
- [ ] Email notifications for new matches

### v5.0 (Long-term)
- [ ] User accounts + authentication
- [ ] Cloud CV + letter storage
- [ ] Application tracking dashboard
- [ ] Multi-language UI (EN/FR/ES)
- [ ] Analytics dashboard
- [ ] Chrome extension for 1-click job scraping

---

## 🤝 Contributing & Community

We warmly welcome contributions to IRIS! Whether you are fixing a bug, suggesting a feature, or writing documentation, your help is highly appreciated.

To get started, please read our **[Contribution Guidelines](CONTRIBUTING.md)** and our **[Code of Conduct](CODE_OF_CONDUCT.md)** to ensure a welcoming environment for all.

### ⚡ Quick Start for Contributors

```bash
# 1. Fork and clone
git clone https://github.com/her0-00/IRIS---Improve-Resume-Intelligence-Studio.git
cd IRIS---Improve-Resume-Intelligence-Studio

# 2. Set up virtual environment and install backend dependencies
python -m venv venv
# Windows: .\venv\Scripts\activate | macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium

# 3. Set up and run Next.js frontend
cd web
npm install
npm run dev
```

For more details on expanding the backend or contributing to the scraping agents, check out **[CONTRIBUTING.md](CONTRIBUTING.md)**.

---

## 📚 Documentation & Community Health

| File / Resource | Description |
|------|---------|
| ⚙️ **[CONTRIBUTING.md](CONTRIBUTING.md)** | Guide to local setup, branching, commits, and PR flows |
| 💬 **[SUPPORT.md](SUPPORT.md)** | Support Center, community help channels, and SLAs |
| 🛡️ **[SECURITY.md](SECURITY.md)** | Security Policy and instructions on reporting vulnerabilities |
| 🤝 **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** | Standards for building a healthy, inclusive community |
| `CHANGELOG_v4.md` | Detailed version and release history |
| `DEPLOY_RENDER.md` | Full Render.com deployment guide |
| `WORKFLOW_IMPLEMENTATION.md` | Technical workflow details of the multi-agent pipeline |
| `TESTING_CHECKLIST.md` | Verification and test scenarios checklist |
| `SECURITY_AUDIT.md` | In-depth security analysis report |
| `PHOTO_FEATURE.md` | Face-detection and picture crop features details |

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.

---

<div align="center">
  <strong>⬡ IRIS — Production Ready 🚀</strong><br/>
  Built with ❤️ · Next.js 15/16 · Python 3.11 · ReportLab · Groq · Mistral · Gemini · Azure OpenAI
</div>
