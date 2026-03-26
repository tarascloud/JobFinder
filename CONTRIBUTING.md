# Contributing to JobFinder

Thank you for your interest in contributing! This guide will help you get started.

## Prerequisites

- **Node.js 22+** (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- **Docker & Docker Compose** (for PostgreSQL)

## Development Setup

### 1. Clone and install

```bash
git clone https://github.com/tarascloud/jobfinder.git
cd jobfinder
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d pg
```

This starts PostgreSQL 16 on `localhost:5432` using the root `docker-compose.yml`.

Or point `DATABASE_URL` to your own PostgreSQL instance.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — at minimum fill in:

| Variable | How to get |
|----------|-----------|
| `DATABASE_URL` | `postgresql://jobfinder:jobfinder@localhost:5432/jobfinder` (matches docker-compose) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CLIENT_SECRET` | Same page as above |

GitHub OAuth, Gemini API key, and scraper proxy are optional.

### 4. Run migrations and start

```bash
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Open [http://localhost:3456](http://localhost:3456). The first sign-in automatically becomes the **owner** account.

### Authentication

The app supports three auth methods:

- **Google OAuth** — primary, requires Client ID/Secret
- **GitHub OAuth** — optional, set `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
- **Guest invites** — owner can invite guests by email

## Running Tests

```bash
# E2E tests (Playwright — requires a running dev server)
npx playwright install --with-deps
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

## Project Structure

```
├── prisma/              # Schema & migrations
├── public/              # Static assets
├── src/
│   ├── actions/         # Server Actions
│   │   ├── analytics.ts       # Dashboard analytics
│   │   ├── applications.ts    # Job applications
│   │   ├── profile.ts         # User profile & resume
│   │   ├── qa.ts              # Q&A pairs
│   │   ├── scoring.ts         # Vacancy matching
│   │   ├── scraper.ts         # Job scraping
│   │   ├── search-profiles.ts # Search profiles
│   │   ├── vacancies.ts       # Vacancy management
│   │   └── *.ts               # Other actions (AI, emails, settings, …)
│   ├── app/
│   │   ├── (auth)/            # Login page
│   │   ├── (dashboard)/       # Authenticated pages
│   │   │   ├── analytics/         # Charts & stats
│   │   │   ├── applications/      # Application tracker
│   │   │   ├── emails/            # Email responses
│   │   │   ├── onboarding/        # First-time setup wizard
│   │   │   ├── profile/           # Profile & resume
│   │   │   ├── qa/                # Q&A bank
│   │   │   ├── searches/          # Search profiles
│   │   │   ├── settings/          # App settings
│   │   │   └── vacancies/         # Vacancy browser
│   │   ├── about/             # Public landing page
│   │   └── api/               # REST endpoints (scrape, apply, resume, …)
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives
│   │   └── shared/            # Sidebar, layout, shared components
│   ├── generated/             # Prisma-generated client (do not edit)
│   ├── i18n/                  # Internationalization config
│   └── lib/                   # Shared utilities (db, auth, encryption, scrapers, AI, …)
│       ├── ai/                # AI provider integrations
│       ├── apply/             # Auto-apply engine
│       └── scrapers/          # Job platform scrapers
├── tests/               # Playwright E2E tests
├── messages/            # i18n translations (en.json, uk.json, es.json)
├── extension/           # Browser extension for manual scraping
├── scripts/             # Utility scripts
└── docker-compose.yml   # PostgreSQL + app (self-hosted)
```

### Key modules

| Module | Pages | Server Actions |
|--------|-------|---------------|
| **Vacancies** | `vacancies/` | `actions/vacancies.ts`, `actions/scraper.ts` |
| **Applications** | `applications/` | `actions/applications.ts`, `actions/apply-*.ts` |
| **Profile** | `profile/` | `actions/profile.ts`, `actions/resume-*.ts` |
| **Search Profiles** | `searches/` | `actions/search-profiles.ts` |
| **Q&A Bank** | `qa/` | `actions/qa.ts`, `actions/qa-generator.ts` |
| **Analytics** | `analytics/` | `actions/analytics.ts` |
| **Emails** | `emails/` | `actions/emails.ts` |
| **Settings** | `settings/` | `actions/preferences.ts`, `actions/ai-settings.ts` |
| **Onboarding** | `onboarding/` | `actions/onboarding.ts` |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16, React 19, TypeScript 6, Tailwind CSS 4, shadcn/ui, Recharts, Sonner |
| **Backend** | Next.js App Router, Server Actions, Prisma 7, NextAuth 5 |
| **Database** | PostgreSQL 16 |
| **AI** | Gemini, Ollama (local), Groq |
| **Auth** | Google OAuth, GitHub OAuth, Guest invites |
| **i18n** | next-intl (English, Ukrainian, Spanish) |
| **PWA** | Serwist service worker |
| **Testing** | Playwright (E2E) |

## Code Style

- **TypeScript** in strict mode — no `any` unless absolutely necessary
- **Tailwind CSS 4** for styling — no custom CSS files
- **Prisma** for all database access — no raw SQL in application code
- **Server Actions** (`src/actions/`) for data mutations
- **next-intl** for i18n — all user-facing strings in `messages/*.json`
- Format with: `npm run lint`

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes — keep PRs focused on a single feature or fix
3. Add or update tests for your changes
4. Ensure linting passes: `npm run lint`
5. Write a clear PR description explaining **what** and **why**
6. Submit the PR — a maintainer will review it

### Test guidelines

- Tests must create their own data and **clean up after themselves**
- Use `test.afterEach` for cleanup
- Do not modify existing demo/seed data

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
