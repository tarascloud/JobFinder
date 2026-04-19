import Link from "next/link";
import {
  Brain,
  Zap,
  Globe,
  MessageSquare,
  Mail,
  BarChart3,
  UserPlus,
  Search,
  Send,
  ArrowRight,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { getFreeSpotsRemaining } from "@/actions/free-spots";
import { LanguageToggle } from "@/components/shared/language-toggle";

/* ------------------------------------------------------------------ */
/* Feature row (zig-zag)                                               */
/* ------------------------------------------------------------------ */

function FeatureRow({
  icon,
  title,
  description,
  reverse = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  reverse?: boolean;
}) {
  return (
    <div className={`grid items-center gap-8 md:grid-cols-2 ${reverse ? "md:[direction:rtl]" : ""}`}>
      <div className={reverse ? "md:[direction:ltr]" : ""}>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
        <h3 className="mb-2 text-xl font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="max-w-[50ch] text-base leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className={`rounded-2xl border border-border bg-card/50 p-8 ${reverse ? "md:[direction:ltr]" : ""}`}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            {icon}
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-3/4 rounded bg-muted" />
            <div className="h-2 w-1/2 rounded bg-muted/60" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="h-14 rounded-lg bg-muted/40 border border-border/50" />
          <div className="h-14 rounded-lg bg-muted/40 border border-border/50" />
          <div className="h-14 rounded-lg bg-primary/5 border border-primary/20" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step card                                                           */
/* ------------------------------------------------------------------ */

function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex flex-col items-start">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
        {icon}
      </div>
      <span className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
        Step {number}
      </span>
      <h3 className="mb-2 text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Platform badge                                                      */
/* ------------------------------------------------------------------ */

function PlatformBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground">
      <Globe className="h-3 w-3 text-primary/60" />
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Landing page                                                        */
/* ------------------------------------------------------------------ */

export async function LandingPage() {
  const freeSpots = await getFreeSpotsRemaining();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-lg font-bold tracking-tight text-foreground">JobFinder</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <Link
              href="/about"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              About
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              Sign In
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero -- left-aligned split screen */}
      <section className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
        {/* Background glow -- offset to the right */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-primary/[0.04] blur-[140px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
          {/* Left: text content */}
          <div>
            {freeSpots > 0 && (
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                {freeSpots} of 10 free spots remaining
              </div>
            )}

            <h1 className="mb-6 text-4xl font-bold leading-none tracking-tighter md:text-5xl lg:text-6xl">
              Find Your Dream Job,{" "}
              <span className="text-primary">Automatically</span>
            </h1>

            <p className="mb-10 max-w-[50ch] text-base leading-relaxed text-muted-foreground md:text-lg">
              AI-powered job search automation. Score vacancies, generate cover
              letters, and auto-apply across 20+ platforms -- all from a single
              dashboard.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] active:translate-y-[1px]"
              >
                Try Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://github.com/tarascloud/JobFinder"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-8 py-3.5 text-base font-semibold transition-all hover:border-primary/30 hover:bg-card/80 active:scale-[0.98] active:translate-y-[1px]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                Self-Host on GitHub
              </a>
            </div>
          </div>

          {/* Right: abstract dashboard preview */}
          <div className="hidden md:block">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              {/* Mock header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div className="h-3 w-3 rounded-full bg-green-500/60" />
                <div className="flex-1" />
                <div className="h-5 w-24 rounded bg-muted" />
              </div>
              {/* Mock vacancy cards */}
              <div className="space-y-3">
                {[92, 87, 74].map((score, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold ${
                      i === 0 ? "bg-blue-500/10 text-blue-500" :
                      i === 1 ? "bg-emerald-500/10 text-emerald-500" :
                      "bg-orange-500/10 text-orange-500"
                    }`}>
                      {["Li", "In", "RO"][i]}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-3/5 rounded bg-muted" />
                      <div className="h-2 w-2/5 rounded bg-muted/60" />
                    </div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold ${
                      score >= 80 ? "border-green-500/40 bg-green-500/10 text-green-500" :
                      "border-yellow-500/40 bg-yellow-500/10 text-yellow-500"
                    }`}>
                      {score}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features -- 2-column zig-zag */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl space-y-20 px-6">
          <FeatureRow
            icon={<Brain className="h-5 w-5" />}
            title="AI Scoring"
            description="Every vacancy is scored against your profile. Focus only on the best matches with AI-powered relevance ranking."
          />
          <FeatureRow
            icon={<Zap className="h-5 w-5" />}
            title="Auto-Apply"
            description="One-click apply with AI-generated cover letters tailored to each position. LinkedIn Easy Apply and Indeed Quick Apply supported."
            reverse
          />
          <FeatureRow
            icon={<Globe className="h-5 w-5" />}
            title="20+ Platforms"
            description="Scrape jobs from LinkedIn, Indeed, RemoteOK, Glassdoor, Wellfound, Djinni, HN, and many more -- all in one place."
          />
          <FeatureRow
            icon={<MessageSquare className="h-5 w-5" />}
            title="Q&A Bank"
            description="Build a bank of screening answers. AI auto-fills common questions so you never type the same answer twice."
            reverse
          />
          <FeatureRow
            icon={<Mail className="h-5 w-5" />}
            title="Email Tracking"
            description="Recruiter responses are automatically tracked and linked to applications. Never miss a reply."
          />
          <FeatureRow
            icon={<BarChart3 className="h-5 w-5" />}
            title="Analytics"
            description="Funnel charts, weekly trends, platform comparison, and response rate analysis. Data-driven job search."
            reverse
          />
        </div>
      </section>

      {/* Platforms */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12">
            <h2 className="mb-4 text-3xl font-bold tracking-tighter sm:text-4xl">
              Supported Platforms
            </h2>
            <p className="max-w-[50ch] text-muted-foreground">
              Aggregate jobs from all major platforms into a single feed.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {[
              "LinkedIn",
              "Indeed",
              "RemoteOK",
              "We Work Remotely",
              "Glassdoor",
              "Wellfound",
              "Hacker News",
              "Djinni",
              "ZipRecruiter",
              "Google Jobs",
              "StackOverflow",
            ].map((name) => (
              <PlatformBadge key={name} name={name} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16">
            <h2 className="mb-4 text-3xl font-bold tracking-tighter sm:text-4xl">
              How It Works
            </h2>
            <p className="max-w-[50ch] text-muted-foreground">
              Three steps from signup to your first auto-applied job.
            </p>
          </div>

          <div className="grid gap-12 sm:grid-cols-3">
            <StepCard
              number={1}
              icon={<UserPlus className="h-6 w-6" />}
              title="Create Profile"
              description="Upload your resume or paste a URL. AI extracts your skills, experience, and preferences automatically."
            />
            <StepCard
              number={2}
              icon={<Search className="h-6 w-6" />}
              title="AI Finds Jobs"
              description="Configure search profiles with job titles, salary range, and locations. JobFinder scrapes and scores matches daily."
            />
            <StepCard
              number={3}
              icon={<Send className="h-6 w-6" />}
              title="Auto-Apply"
              description="Review the queue, approve with one click, and let JobFinder apply with tailored cover letters."
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="mb-4 text-3xl font-bold tracking-tighter sm:text-4xl">
                Ready to automate your job search?
              </h2>
              <p className="max-w-[50ch] text-lg text-muted-foreground">
                {freeSpots > 0
                  ? `Free for the first 10 users. ${freeSpots} spot${freeSpots !== 1 ? "s" : ""} remaining.`
                  : "Self-host for free or join the waitlist."}
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row md:justify-end">
              <Link
                href="/login"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] active:translate-y-[1px]"
              >
                {freeSpots > 0 ? "Get Started Free" : "Join Waitlist"}
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://github.com/tarascloud/JobFinder"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-8 py-3.5 text-base font-semibold transition-all hover:border-primary/30 hover:bg-card/80 active:scale-[0.98] active:translate-y-[1px]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                Open Source -- Self-Host
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>JobFinder</span>
            <span className="mx-2">|</span>
            <span>AGPL-3.0</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a
              href="https://github.com/tarascloud/JobFinder"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <Link
              href="/about"
              className="transition-colors hover:text-foreground"
            >
              About
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
