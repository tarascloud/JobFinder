"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  FileText,
  Search,
  Brain,
  PenTool,
  Zap,
  MessageSquare,
  Mail,
  BarChart3,
  Server,
  GitBranch,
  ArrowRight,
  Globe,
  Shield,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  { key: "resume", icon: FileText, gradient: "from-blue-500 to-cyan-500" },
  { key: "search", icon: Search, gradient: "from-emerald-500 to-teal-500" },
  { key: "scoring", icon: Brain, gradient: "from-purple-500 to-violet-500" },
  { key: "cover_letter", icon: PenTool, gradient: "from-amber-500 to-orange-500" },
  { key: "auto_apply", icon: Zap, gradient: "from-rose-500 to-pink-500" },
  { key: "qa", icon: MessageSquare, gradient: "from-indigo-500 to-blue-500" },
  { key: "email", icon: Mail, gradient: "from-teal-500 to-emerald-500" },
  { key: "analytics", icon: BarChart3, gradient: "from-fuchsia-500 to-purple-500" },
] as const;

const TECH_STACK = [
  { name: "Next.js 16", category: "framework" },
  { name: "React 19", category: "framework" },
  { name: "TypeScript 5", category: "language" },
  { name: "Prisma 7", category: "database" },
  { name: "PostgreSQL", category: "database" },
  { name: "Tailwind CSS 4", category: "styling" },
  { name: "NextAuth 5", category: "auth" },
  { name: "Ollama / Gemini / Groq", category: "ai" },
  { name: "Playwright", category: "testing" },
  { name: "Docker", category: "infra" },
  { name: "Serwist (PWA)", category: "pwa" },
  { name: "next-intl", category: "i18n" },
];

function LanguageSwitcher() {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white/5 p-1 text-sm backdrop-blur-sm border border-white/10">
      {["EN", "UA", "ES"].map((lang) => (
        <button
          key={lang}
          className="rounded-full px-3 py-1 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
        >
          {lang}
        </button>
      ))}
    </div>
  );
}

export default function AboutPage() {
  const t = useTranslations("about");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-blue-500/25">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-[400px] left-1/2 -translate-x-1/2 h-[800px] w-[800px] rounded-full bg-gradient-to-b from-blue-600/20 via-purple-600/10 to-transparent blur-3xl" />
        <div className="absolute top-[60%] -right-[200px] h-[600px] w-[600px] rounded-full bg-gradient-to-b from-emerald-600/10 via-teal-600/5 to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/login" className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-2">
          <ArrowRight className="h-4 w-4 rotate-180" />
          {t("back_to_login")}
        </Link>
        <LanguageSwitcher />
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-blue-400" />
          <span className="text-white/70">{t("badge")}</span>
        </div>

        <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-7xl">
          <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            Job
          </span>
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Finder
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/50 sm:text-xl">
          {t("subtitle")}
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-blue-600/40 hover:scale-[1.02]"
          >
            {t("get_started")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/tarascloud/jf-public"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white backdrop-blur-sm"
          >
            <GitBranch className="h-5 w-5" />
            GitHub
          </a>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-32">
        <div className="mb-16 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("features_title")}
          </h2>
          <p className="text-white/40">{t("features_subtitle")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, icon: Icon, gradient }, i) => (
            <div
              key={key}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.04]"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {/* Gradient glow on hover */}
              <div
                className={`absolute -top-12 -right-12 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20`}
              />

              <div
                className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${gradient} p-2.5 shadow-lg`}
              >
                <Icon className="h-5 w-5 text-white" />
              </div>

              <h3 className="mb-2 font-semibold text-white/90">
                {t(`feature_${key}_title`)}
              </h3>
              <p className="text-sm leading-relaxed text-white/40">
                {t(`feature_${key}_desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-32">
        <div className="mb-16 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("how_title")}
          </h2>
          <p className="text-white/40">{t("how_subtitle")}</p>
        </div>

        <div className="space-y-0">
          {[1, 2, 3, 4].map((step) => (
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
                <p className="text-sm text-white/40">{t(`step_${step}_desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-32">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("tech_title")}
          </h2>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {TECH_STACK.map(({ name }) => (
            <span
              key={name}
              className="rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-white/60 transition-colors hover:border-white/[0.12] hover:text-white/80"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Self-hosted banner */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-32">
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-8 sm:p-12">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-600/20">
              <Server className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                <h3 className="text-xl font-bold">{t("selfhosted_title")}</h3>
                <span className="rounded-full bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  {t("selfhosted_badge")}
                </span>
              </div>
              <p className="text-white/40">{t("selfhosted_desc")}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {(["privacy", "control", "free"] as const).map((key) => (
              <div key={key} className="flex items-start gap-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white/80">{t(`selfhosted_${key}_title`)}</p>
                  <p className="text-xs text-white/40">{t(`selfhosted_${key}_desc`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-32">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {t("platforms_title")}
          </h2>
          <p className="text-white/40">{t("platforms_subtitle")}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {[
            "LinkedIn", "Indeed", "Glassdoor", "Djinni", "DOU",
            "Work.ua", "Robota.ua", "Jooble", "RemoteOK", "WeWorkRemotely", "InfoJobs",
          ].map((platform) => (
            <span
              key={platform}
              className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-white/60"
            >
              <Globe className="h-3.5 w-3.5" />
              {platform}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-12">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-sm text-white/30">
            {t("footer")}
          </p>
        </div>
      </footer>
    </div>
  );
}
