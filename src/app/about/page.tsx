import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Search,
  Globe,
  Brain,
  FileText,
  MessageSquare,
  Mail,
  PenTool,
  BarChart3,
  Zap,
  Server,
  ShieldCheck,
  ChevronRight,
  Lock,
  Database,
  ArrowLeft,
  Sparkles,
  Target,
  GitBranch,
  Code,
  Smartphone,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("about");
  return {
    title: "About JobFinder — Open-Source AI Job Search Automation",
    description: t("subtitle"),
    alternates: {
      canonical: "/about",
    },
  };
}

/* ------------------------------------------------------------------ */
/* Feature card                                                        */
/* ------------------------------------------------------------------ */

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-blue-400/30 hover:bg-white/[0.04]">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-[#9a9ea6]">{desc}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tech badge                                                          */
/* ------------------------------------------------------------------ */

function TechBadge({
  icon,
  name,
}: {
  icon: React.ReactNode;
  name: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-[#9a9ea6]">
      {icon}
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Platform badge                                                      */
/* ------------------------------------------------------------------ */

function PlatformBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#9a9ea6] transition-colors hover:border-blue-400/30 hover:text-white">
      <Globe className="h-3 w-3 text-blue-400/60" />
      {name}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function AboutPage() {
  const t = await getTranslations("about");

  const features = [
    { icon: <Target className="h-5 w-5" />, key: "search_profiles" },
    { icon: <Search className="h-5 w-5" />, key: "scraping" },
    { icon: <Brain className="h-5 w-5" />, key: "scoring" },
    { icon: <FileText className="h-5 w-5" />, key: "resume" },
    { icon: <MessageSquare className="h-5 w-5" />, key: "qa" },
    { icon: <Zap className="h-5 w-5" />, key: "tracking" },
    { icon: <Mail className="h-5 w-5" />, key: "email" },
    { icon: <PenTool className="h-5 w-5" />, key: "cover_letter" },
    { icon: <BarChart3 className="h-5 w-5" />, key: "analytics" },
  ] as const;

  const badges = [
    { icon: <Sparkles className="h-3.5 w-3.5" />, label: t("badge_ai_powered") },
    { icon: <Server className="h-3.5 w-3.5" />, label: t("badge_self_hosted") },
    { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: t("badge_privacy") },
    { icon: <Code className="h-3.5 w-3.5" />, label: t("badge_open_source") },
  ];

  const steps = [1, 2, 3, 4] as const;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-blue-500/20">
      {/* Back to login */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-6">
        <a
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back_to_login")}
        </a>
      </div>

      {/* ==================== HERO ==================== */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 lg:px-8">
        {/* Gradient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-500/[0.06] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Logo */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] shadow-lg shadow-black/20">
            <span className="text-3xl font-bold bg-gradient-to-br from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              JF
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              Job
            </span>
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Finder
            </span>
          </h1>

          <p className="mb-8 text-lg text-[#9a9ea6] sm:text-xl">
            {t("tagline")}
          </p>

          {/* Badges */}
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            {badges.map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/[0.06] px-4 py-1.5 text-sm font-medium text-blue-400"
              >
                {b.icon}
                {b.label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 hover:brightness-110"
            >
              {t("get_started")}
              <ChevronRight className="h-4 w-4" />
            </a>
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-400 transition-all hover:border-emerald-400/50 hover:bg-emerald-500/20"
            >
              <Sparkles className="h-4 w-4" />
              {t("try_demo")}
            </a>
            <a
              href="https://github.com/tarascloud/JobFinder"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-6 py-3 text-sm font-semibold text-white transition-all hover:border-white/[0.2] hover:bg-white/[0.06]"
            >
              <GitBranch className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES ==================== */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("features_title")}
            </h2>
            <p className="text-[#9a9ea6]">
              {t("features_subtitle")}
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard
                key={f.key}
                icon={f.icon}
                title={t(`feature_${f.key}_title`)}
                desc={t(`feature_${f.key}_desc`)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ==================== HOW IT WORKS ==================== */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("how_title")}
            </h2>
            <p className="text-[#9a9ea6]">
              {t("how_subtitle")}
            </p>
          </div>

          <div className="space-y-0">
            {steps.map((step) => (
              <div key={step} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold shadow-lg shadow-blue-600/20">
                    {step}
                  </div>
                  {step < 4 && (
                    <div className="my-1 h-16 w-px bg-gradient-to-b from-blue-500/30 to-transparent" />
                  )}
                </div>
                <div className="pb-8">
                  <h3 className="mb-1 font-semibold text-white/90">
                    {t(`step_${step}_title`)}
                  </h3>
                  <p className="text-sm text-[#9a9ea6]">
                    {t(`step_${step}_desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== PLATFORMS ==================== */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("platforms_title")}
            </h2>
            <p className="text-[#9a9ea6]">
              {t("platforms_subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              "LinkedIn", "Indeed", "Glassdoor", "Djinni", "DOU",
              "Work.ua", "Robota.ua", "Jooble", "RemoteOK", "WeWorkRemotely", "InfoJobs",
            ].map((p) => (
              <PlatformBadge key={p} name={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ==================== TECH STACK ==================== */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("tech_title")}
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Next.js 16" />
            <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="React 19" />
            <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="TypeScript 5" />
            <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Prisma 7" />
            <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="PostgreSQL" />
            <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Tailwind CSS 4" />
            <TechBadge icon={<Lock className="h-3.5 w-3.5 text-blue-400/60" />} name="NextAuth 5" />
            <TechBadge icon={<Brain className="h-3.5 w-3.5 text-blue-400/60" />} name="Ollama / Gemini / Groq" />
            <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Playwright" />
            <TechBadge icon={<Server className="h-3.5 w-3.5 text-blue-400/60" />} name="Docker" />
            <TechBadge icon={<Database className="h-3.5 w-3.5 text-blue-400/60" />} name="Serwist (PWA)" />
            <TechBadge icon={<Globe className="h-3.5 w-3.5 text-blue-400/60" />} name="next-intl" />
            <TechBadge icon={<BarChart3 className="h-3.5 w-3.5 text-blue-400/60" />} name="Recharts" />
            <TechBadge icon={<FileText className="h-3.5 w-3.5 text-blue-400/60" />} name="pdf-parse" />
          </div>
        </div>
      </section>

      {/* ==================== SELF-HOSTED ==================== */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-8 sm:p-12">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-600/20">
                <Server className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                  <h3 className="text-xl font-bold">
                    {t("selfhosted_title")}
                  </h3>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                    {t("selfhosted_badge")}
                  </span>
                </div>
                <p className="text-[#9a9ea6]">
                  {t("selfhosted_desc")}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white/80">
                    {t("selfhosted_privacy_title")}
                  </p>
                  <p className="text-xs text-[#9a9ea6]">
                    {t("selfhosted_privacy_desc")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white/80">
                    {t("selfhosted_control_title")}
                  </p>
                  <p className="text-xs text-[#9a9ea6]">
                    {t("selfhosted_control_desc")}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Code className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white/80">
                    {t("selfhosted_free_title")}
                  </p>
                  <p className="text-xs text-[#9a9ea6]">
                    {t("selfhosted_free_desc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CTA ==================== */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-6 text-3xl font-bold sm:text-4xl">
            {t("cta_ready")}
          </h2>
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-blue-500/30 hover:brightness-110"
          >
            {t("get_started")}
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ==================== PWA BADGE ==================== */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-4 rounded-2xl border border-blue-400/20 bg-blue-500/[0.04] px-6 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <Smartphone className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-white/90">
                {t("pwa_title")}
              </p>
              <p className="text-sm text-[#9a9ea6]">
                {t("pwa_desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="border-t border-white/[0.06] py-12">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-white/30">
            {t("footer")}
          </p>
        </div>
      </footer>
    </div>
  );
}
