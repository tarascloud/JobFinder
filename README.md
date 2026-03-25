# JobFinder

**Your job search, automated.**

Open-source, self-hosted job search automation platform. AI-powered vacancy scoring, multi-platform scraping, auto-apply, and application tracking. Built with Next.js 16, React 19, Prisma, and Tailwind CSS.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)

> **[Live demo →](https://jobfinder.taras.cloud)**

## Quick Start

```bash
git clone https://github.com/tarascloud/JobFinder.git
cd JobFinder

# Start PostgreSQL
docker compose up -d pg

# Install and run
npm install
cp .env.example .env
# Edit .env — fill in DATABASE_URL and auth credentials

npx prisma migrate deploy
npx prisma generate
npm run dev
```

Open [http://localhost:3456](http://localhost:3456). The first sign-in becomes the **owner**.

### Docker Deployment

```bash
docker compose up -d
```

## Features

- **Search Profiles** — Create multiple search configurations with different job titles, salary ranges, locations, and filters. Each profile runs independently
- **Multi-Platform Scraping** — LinkedIn, Indeed, Glassdoor, RemoteOK, WeWorkRemotely, AngelList, Arc.dev, Djinni, DOU, and more
- **AI Vacancy Scoring** — Each vacancy scored by AI for match percentage based on your resume, skills, and preferences
- **Resume Parsing** — Upload your PDF resume; AI extracts skills, experience, and auto-fills your profile
- **Q&A Bank** — Screening questions from applications stored and answered. AI learns from your responses for future auto-fill
- **Application Tracking** — Full pipeline: New → Applied → Response → Interview → Offer/Reject with funnel analytics
- **Email Tracking** — Incoming recruiter emails parsed and matched to applications automatically
- **Cover Letters** — AI-generated cover letter per vacancy, in the language of the job posting
- **Analytics Dashboard** — Application funnel, response rates, salary distributions, platform performance
- **Multi-language** — English, Ukrainian, Spanish (next-intl)
- **Multi-user** — Google OAuth with per-user search profiles and data isolation
- **Dark/Light Theme** — System-aware with manual toggle

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Recharts, Lucide |
| **Backend** | Next.js App Router, Server Actions, Prisma 7, NextAuth 5 |
| **Database** | PostgreSQL 17 |
| **AI** | Ollama (local), Gemini Flash, Groq — configurable per user |
| **Scraping** | Playwright (headless Chrome) |
| **Infra** | Docker (multi-stage), Node 22-alpine |

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login page
│   ├── (dashboard)/     # Authenticated pages
│   │   ├── searches/    # Search profile management
│   │   ├── vacancies/   # Vacancy list with AI scoring
│   │   ├── applications/# Application tracking pipeline
│   │   ├── qa/          # Q&A bank for screening questions
│   │   ├── emails/      # Recruiter email tracking
│   │   ├── analytics/   # Funnel charts and statistics
│   │   ├── profile/     # Resume upload and skills
│   │   ├── settings/    # AI provider, platforms, preferences
│   │   └── onboarding/  # First-time setup wizard
│   ├── about/           # Public landing page
│   └── api/             # REST endpoints
├── prisma/              # Schema & migrations
├── messages/            # i18n (en, uk, es)
└── public/              # Static assets
```

## Self-Hosted

JobFinder is designed to run on your own server. Your data stays with you — resumes, applications, API keys, and job search history never leave your infrastructure.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE).

If you use this software to provide a service over a network, you must make the source code available to users of that service.

## Contributing

Contributions are welcome! Fork the repo, create a branch from `main`, and submit a PR.
