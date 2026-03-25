# JobFinder

AI-powered job search automation. Find, score, and apply to remote jobs automatically.

## Features
- Multi-user SaaS with Google OAuth
- AI resume analysis -> auto-generate profile
- Multiple search profiles (EU, US, etc.)
- Scrape 15+ job platforms
- AI scoring & cover letter generation
- Semi-auto and full-auto apply modes
- Q&A knowledge base for screening questions
- Application tracking with funnel analytics

## Quick Start

```bash
docker compose up -d
```

Open http://localhost:3456

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
- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Prisma 7, PostgreSQL
- NextAuth 5 (Google OAuth)
- Gemini Flash (AI scoring, cover letters, resume analysis)
- Playwright (job application automation)
