"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Building2,
  Globe,
  Banknote,
  Loader2,
  Languages,
  MousePointerClick,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getVacancyDetail } from "@/actions/vacancies";
import { queueVacancyForApply, markAsManuallyApplied } from "@/actions/apply-queue";
import { generateCoverLetterAction } from "@/actions/scoring";
import { researchCompany, getCachedCompanyResearch } from "@/actions/company-research";
import { tailorResume } from "@/actions/resume-tailor";
import { getTranslation } from "@/actions/translations";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { VacancyDetail, CompanyData, TailorData } from "./vacancy-types";
import { ApplicationPanel } from "./ApplicationPanel";
import { CoverLetterSection } from "./CoverLetterSection";
import { ResumeTailorSection } from "./ResumeTailorSection";
import { CompanyResearchSection } from "./CompanyResearchSection";

export default function VacancyDetailPage() {
  const params = useParams();
  const vacancyId = Number(params.id);
  const t = useTranslations("vacancies");
  const tApp = useTranslations("applications");
  const tq = useTranslations("apply_queue");
  const tCommon = useTranslations("common");
  const tResearch = useTranslations("company_research");
  const tTailor = useTranslations("resume_tailor");
  const tTranslations = useTranslations("translations");
  const locale = useLocale();

  const [vacancy, setVacancy] = useState<VacancyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [isQueuing, setIsQueuing] = useState(false);
  const [isApplyingManual, setIsApplyingManual] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Description translation state
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [isTranslatingDesc, setIsTranslatingDesc] = useState(false);
  const [showTranslatedDesc, setShowTranslatedDesc] = useState(false);

  // Cover letter translation state
  const [translatedCoverLetter, setTranslatedCoverLetter] = useState<string | null>(null);
  const [isTranslatingCL, setIsTranslatingCL] = useState(false);
  const [showTranslatedCL, setShowTranslatedCL] = useState(false);

  // Company research & resume tailor
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailorData, setTailorData] = useState<TailorData | null>(null);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<number>>(new Set());
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<number>>(new Set());

  // ---- Data fetching ----

  useEffect(() => {
    if (!vacancyId || isNaN(vacancyId)) return;
    startTransition(async () => {
      const result = await getVacancyDetail(vacancyId);
      if ("error" in result && result.error) {
        setError(result.error);
      } else if ("id" in result) {
        setVacancy(result as unknown as VacancyDetail);
        if (result.application?.coverLetter) {
          setCoverLetter(result.application.coverLetter);
        }
        if (result.company) {
          const cached = await getCachedCompanyResearch(result.company);
          if (cached) setCompanyData(cached);
        }
      }
    });
  }, [vacancyId]);

  // ---- Handlers ----

  async function handleTranslateDescription() {
    if (translatedDescription) { setShowTranslatedDesc(!showTranslatedDesc); return; }
    if (!vacancy) return;
    setIsTranslatingDesc(true);
    try {
      const fromLang = vacancy.language || "en";
      const result = await getTranslation(vacancy.description, locale, fromLang);
      setTranslatedDescription(result);
      setShowTranslatedDesc(true);
    } finally { setIsTranslatingDesc(false); }
  }

  async function handleTranslateCoverLetter() {
    if (translatedCoverLetter) { setShowTranslatedCL(!showTranslatedCL); return; }
    if (!coverLetter) return;
    setIsTranslatingCL(true);
    try {
      const result = await getTranslation(coverLetter, locale, "en");
      setTranslatedCoverLetter(result);
      setShowTranslatedCL(true);
    } finally { setIsTranslatingCL(false); }
  }

  async function handleResearchCompany() {
    if (!vacancy?.company) return;
    setIsResearching(true);
    const result = await researchCompany(vacancy.company);
    if (!("error" in result)) setCompanyData(result);
    setIsResearching(false);
  }

  async function handleTailorResume() {
    setIsTailoring(true);
    setTailorData(null);
    setAcceptedSuggestions(new Set());
    setRejectedSuggestions(new Set());
    const result = await tailorResume(vacancyId);
    if (!("error" in result)) setTailorData(result);
    setIsTailoring(false);
  }

  function handleAcceptSuggestion(index: number) {
    setAcceptedSuggestions((prev) => new Set([...prev, index]));
    setRejectedSuggestions((prev) => { const next = new Set(prev); next.delete(index); return next; });
  }

  function handleRejectSuggestion(index: number) {
    setRejectedSuggestions((prev) => new Set([...prev, index]));
    setAcceptedSuggestions((prev) => { const next = new Set(prev); next.delete(index); return next; });
  }

  async function reloadVacancy() {
    const updated = await getVacancyDetail(vacancyId);
    if ("id" in updated) {
      setVacancy(updated as unknown as VacancyDetail);
      if (updated.application?.coverLetter) setCoverLetter(updated.application.coverLetter);
    }
  }

  async function handleQueue() {
    if (!vacancy) return;
    setIsQueuing(true);
    const searchProfileId = vacancy.scores[0]?.searchProfile?.id;
    const result = await queueVacancyForApply(vacancy.id, searchProfileId || 0);
    if ("application" in result) await reloadVacancy();
    setIsQueuing(false);
  }

  async function handleApplyManual() {
    if (!vacancy) return;
    window.open(vacancy.url, "_blank", "noopener,noreferrer");
    setIsApplyingManual(true);
    try {
      if (vacancy.application) {
        await markAsManuallyApplied(vacancy.application.id);
      } else {
        const searchProfileId = vacancy.scores[0]?.searchProfile?.id || 0;
        const result = await queueVacancyForApply(vacancy.id, searchProfileId);
        if ("application" in result && result.application) {
          await markAsManuallyApplied(result.application.id);
        }
      }
      await reloadVacancy();
    } catch { /* URL was already opened */ }
    setIsApplyingManual(false);
  }

  async function handleGenerateCoverLetter() {
    if (!vacancy) return;
    setIsGenerating(true);
    const searchProfileId = vacancy.scores[0]?.searchProfile?.id || 0;
    const result = await generateCoverLetterAction(vacancy.id, searchProfileId);
    if (result.coverLetter) setCoverLetter(result.coverLetter);
    setIsGenerating(false);
  }

  // ---- Loading / Error states ----

  if (isPending && !vacancy) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/vacancies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          {tCommon("back")}
        </Link>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!vacancy) return null;

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/vacancies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {tCommon("back")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{vacancy.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {vacancy.company && (
              <span className="inline-flex items-center gap-1"><Building2 className="h-4 w-4" />{vacancy.company}</span>
            )}
            {vacancy.location && (
              <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{vacancy.location}</span>
            )}
            {vacancy.remoteType && (
              <span className="inline-flex items-center gap-1"><Globe className="h-4 w-4" />{vacancy.remoteType}</span>
            )}
            {vacancy.salaryText && (
              <span className="inline-flex items-center gap-1 text-foreground/80"><Banknote className="h-4 w-4" />{vacancy.salaryText}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a href={vacancy.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80">
            <ExternalLink className="h-4 w-4" />
            {t("open_original")}
          </a>
          <Button variant="outline" size="sm" onClick={handleApplyManual} disabled={isApplyingManual}>
            {isApplyingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <MousePointerClick className="h-4 w-4" />}
            {tq("apply_manual")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content -- Description */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              {locale !== (vacancy.language || "en") && (
                <div className="flex items-center justify-end mb-3">
                  <button onClick={handleTranslateDescription} disabled={isTranslatingDesc}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50">
                    {isTranslatingDesc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                    {isTranslatingDesc
                      ? tTranslations("translating")
                      : showTranslatedDesc
                      ? tTranslations("show_english")
                      : tTranslations("translate_to", { language: tTranslations(locale as "en" | "uk" | "es") })}
                  </button>
                </div>
              )}
              {vacancy.description && vacancy.description.length > 10 ? (
                <div className="prose prose-invert prose-sm max-w-none text-foreground/80"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(
                      showTranslatedDesc && translatedDescription ? translatedDescription : vacancy.description
                    ),
                  }}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-3">No description available</p>
                  <Button variant="outline" onClick={async () => {
                    const { fetchVacancyDescription } = await import("@/actions/fetch-description");
                    const result = await fetchVacancyDescription(vacancy.id);
                    if ("description" in result) setVacancy({ ...vacancy, description: result.description });
                  }}>
                    Fetch Description from Source
                  </Button>
                  <a href={vacancy.url} target="_blank" rel="noopener noreferrer" className="block mt-2 text-sm text-primary hover:underline">
                    Open original listing &rarr;
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <ApplicationPanel vacancy={vacancy} isQueuing={isQueuing} onQueue={handleQueue} tApp={tApp} tq={tq} t={t} />

          <CoverLetterSection
            coverLetter={coverLetter}
            onCoverLetterChange={(val) => { setCoverLetter(val); setTranslatedCoverLetter(null); setShowTranslatedCL(false); }}
            onGenerate={handleGenerateCoverLetter}
            isGenerating={isGenerating}
            locale={locale}
            translatedCoverLetter={translatedCoverLetter}
            isTranslatingCL={isTranslatingCL}
            showTranslatedCL={showTranslatedCL}
            onTranslate={handleTranslateCoverLetter}
            tq={tq}
            tTranslations={tTranslations}
          />

          <ResumeTailorSection
            tailorData={tailorData}
            isTailoring={isTailoring}
            onTailor={handleTailorResume}
            acceptedSuggestions={acceptedSuggestions}
            rejectedSuggestions={rejectedSuggestions}
            onAccept={handleAcceptSuggestion}
            onReject={handleRejectSuggestion}
            tTailor={tTailor}
          />

          {vacancy.company && (
            <CompanyResearchSection
              company={vacancy.company}
              companyData={companyData}
              isResearching={isResearching}
              onResearch={handleResearchCompany}
              tResearch={tResearch}
            />
          )}
        </div>
      </div>
    </div>
  );
}
