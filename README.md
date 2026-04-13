<p align="center">
  <strong>JobFinder</strong><br/>
  <em>Your job search, automated.</em>
</p>

<p align="center">
  <a href="https://github.com/tarascloud/JobFinder/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg" alt="License: AGPL-3.0" /></a>
  <a href="https://github.com/tarascloud/JobFinder/stargazers"><img src="https://img.shields.io/github/stars/tarascloud/JobFinder.svg?style=social" alt="GitHub stars" /></a>
  <a href="https://hub.docker.com/r/tarascloud/jobfinder"><img src="https://img.shields.io/badge/docker-ready-2496ED.svg?logo=docker&logoColor=white" alt="Docker" /></a>
  <a href="https://jobfinder.taras.cloud"><img src="https://img.shields.io/badge/demo-live-brightgreen.svg" alt="Live Demo" /></a>
</p>

---

AI-powered job search automation. Upload your resume, scrape 11+ job boards, get AI match scores, auto-generate cover letters, and auto-apply -- all self-hosted and privacy-first.

> **Free hosted instance for the first 10 users** -- [jobfinder.taras.cloud](https://jobfinder.taras.cloud)

## Screenshots

<!-- TODO: Add screenshots -->
| Dashboard | Vacancies | Analytics |
|-----------|-----------|-----------|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Vacancies](docs/screenshots/vacancies.png) | ![Analytics](docs/screenshots/analytics.png) |

## Features

- **Resume Parsing** -- Upload PDF or paste URL, AI extracts skills, experience, and generates your complete profile
- **Multi-Platform Scraping** -- Daily automated scraping across 11 job boards (LinkedIn, Indeed, Glassdoor, Djinni, RemoteOK, WeWorkRemotely, and more)
- **AI Match Scoring** -- Every vacancy scored against your skills, experience, salary expectations, and preferences
- **Cover Letter Generation** -- AI generates personalized cover letters in the vacancy's language
- **Auto-Apply** -- Semi-auto or full-auto apply modes for high-scoring matches (LinkedIn Easy Apply, Indeed Quick Apply)
- **Q&A Knowledge Base** -- AI answers screening questions from your history and resume. Never answer the same question twice
- **Application Tracking** -- Full pipeline: scraped, scored, reviewed, applied, responded, interview, offer
- **Email Tracking** -- Auto-detect and classify recruiter email responses, linked to applications
- **Analytics Dashboard** -- Funnel visualization, platform comparison, score distribution, response rates, weekly trends
- **Multi-language** -- UI in English, Ukrainian, Spanish (next-intl)
- **PWA** -- Install as a native app from your browser, no app store needed
- **Self-hosted** -- Your data stays on your server. Choose AI provider: local Ollama, Gemini Flash, or Groq

## Quick Start (Docker)

```bash
git clone https://github.com/tarascloud/JobFinder.git
cd JobFinder
cp .env.example .env
# Edit .env with your credentials (database, OAuth, AI provider)
docker compose up -d
```

Open [http://localhost:3456](http://localhost:3456)

## Development

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npx prisma migrate deploy
npx prisma generate
npm run dev
```

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Database:** Prisma 7, PostgreSQL
- **Auth:** NextAuth 5 (Google OAuth, GitHub OAuth), invite-only + demo mode
- **AI:** Ollama (gemma4:e4b, local default), Gemini Flash, Groq -- configurable per user
- **Scraping/Apply:** Playwright (headless browser automation)
- **PWA:** Serwist 9 (service worker, offline support)
- **i18n:** next-intl (EN, UA, ES)
- **Charts:** Recharts
- **Infra:** Docker, Node 22-alpine

## Supported Job Boards

LinkedIn, Indeed, Glassdoor, Djinni, DOU, Work.ua, Robota.ua, Jooble, RemoteOK, WeWorkRemotely, InfoJobs

## License

[AGPL-3.0](LICENSE) -- free to use, modify, and self-host. Contributions welcome.
