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
  CheckCircle2,
  Send,
  Search,
  BookOpen,
  FileEdit,
  Check,
  X,
  Plus,
  Minus,
  Languages,
  Sparkles,
  MousePointerClick,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getVacancyDetail } from "@/actions/vacancies";
import { queueVacancyForApply, markAsManuallyApplied } from "@/actions/apply-queue";
import { generateCoverLetterAction } from "@/actions/scoring";
import { researchCompany, getCachedCompanyResearch } from "@/actions/company-research";
import { tailorResume } from "@/actions/resume-tailor";
import { getTranslation } from "@/actions/translations";
import { sanitizeHtml } from "@/lib/sanitize-html";

const statusColors: Record<string, "yellow" | "blue" | "green" | "purple" | "indigo" | "red"> = {
  queued: "yellow",
  approved: "blue",
  applied: "green",
  response: "purple",
  interview: "indigo",
  offer: "green",
  rejected: "red",
  withdrawn: "red",
};

interface VacancyDetail {
  id: number;
  platform: string;
  externalId: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  remoteType: string | null;
  employmentType: string | null;
  description: string;
  language: string | null;
  postedAt: Date | null;
  scrapedAt: Date;
  scores: {
    id: number;
    matchScore: number;
    salaryFit: boolean | null;
    remoteFit: boolean | null;
    notes: string | null;
    scoredAt: Date;
    scoredBy: string | null;
    searchProfile: { id: number; name: string };
  }[];
  application: {
    id: number;
    status: string;
    coverLetter: string | null;
    appliedAt: Date | null;
    searchProfileId: number;
  } | null;
  qaPairs: { id: number; question: string; answer: string | null }[];
}

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

  async function handleTranslateDescription() {
    if (translatedDescription) {
      setShowTranslatedDesc(!showTranslatedDesc);
      return;
    }
    if (!vacancy) return;
    setIsTranslatingDesc(true);
    try {
      const fromLang = vacancy.language || "en";
      const result = await getTranslation(vacancy.description, locale, fromLang);
      setTranslatedDescription(result);
      setShowTranslatedDesc(true);
    } finally {
      setIsTranslatingDesc(false);
    }
  }

  async function handleTranslateCoverLetter() {
    if (translatedCoverLetter) {
      setShowTranslatedCL(!showTranslatedCL);
      return;
    }
    if (!coverLetter) return;
    setIsTranslatingCL(true);
    try {
      const result = await getTranslation(coverLetter, locale, "en");
      setTranslatedCoverLetter(result);
      setShowTranslatedCL(true);
    } finally {
      setIsTranslatingCL(false);
    }
  }
  const [companyData, setCompanyData] = useState<{
    description: string;
    industry: string;
    size: string;
    founded: string;
    headquarters: string;
    keyFacts: string[];
    recentNews: string[];
    glassdoorRating?: string;
    techStack?: string[];
    workCulture?: string;
  } | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailorData, setTailorData] = useState<{
    suggestions: { section: string; original: string; suggested: string; reason: string }[];
    tailoredSummary: string;
    keywordsToAdd: string[];
    keywordsToRemove: string[];
  } | null>(null);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<number>>(new Set());
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<number>>(new Set());

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
        // Check cached company research
        if (result.company) {
          const cached = await getCachedCompanyResearch(result.company);
          if (cached) setCompanyData(cached);
        }
      }
    });
  }, [vacancyId]);

  async function handleResearchCompany() {
    if (!vacancy?.company) return;
    setIsResearching(true);
    const result = await researchCompany(vacancy.company);
    if (!("error" in result)) {
      setCompanyData(result);
    }
    setIsResearching(false);
  }

  async function handleTailorResume() {
    setIsTailoring(true);
    setTailorData(null);
    setAcceptedSuggestions(new Set());
    setRejectedSuggestions(new Set());
    const result = await tailorResume(vacancyId);
    if (!("error" in result)) {
      setTailorData(result);
    }
    setIsTailoring(false);
  }

  function handleAcceptSuggestion(index: number) {
    setAcceptedSuggestions((prev) => new Set([...prev, index]));
    setRejectedSuggestions((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function handleRejectSuggestion(index: number) {
    setRejectedSuggestions((prev) => new Set([...prev, index]));
    setAcceptedSuggestions((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  async function handleQueue() {
    if (!vacancy) return;
    setIsQueuing(true);
    // Use first score's search profile, or first active profile as fallback
    const searchProfileId = vacancy.scores[0]?.searchProfile?.id;
    const result = await queueVacancyForApply(vacancy.id, searchProfileId || 0);
    if ("application" in result) {
      // Reload
      const updated = await getVacancyDetail(vacancyId);
      if ("id" in updated) {
        setVacancy(updated as unknown as VacancyDetail);
        if (updated.application?.coverLetter) {
          setCoverLetter(updated.application.coverLetter);
        }
      }
    }
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
      // Reload
      const updated = await getVacancyDetail(vacancyId);
      if ("id" in updated) {
        setVacancy(updated as unknown as VacancyDetail);
      }
    } catch {
      // URL was already opened
    }
    setIsApplyingManual(false);
  }

  async function handleGenerateCoverLetter() {
    if (!vacancy) return;
    setIsGenerating(true);
    const searchProfileId = vacancy.scores[0]?.searchProfile?.id || 0;
    const result = await generateCoverLetterAction(vacancy.id, searchProfileId);
    if (result.coverLetter) {
      setCoverLetter(result.coverLetter);
    }
    setIsGenerating(false);
  }

  function scoreColor(score: number) {
    if (score >= 90) return "text-green-400";
    if (score >= 75) return "text-primary";
    return "text-muted-foreground";
  }

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

  const bestScore = vacancy.scores[0];

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
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-4 w-4" />
                {vacancy.company}
              </span>
            )}
            {vacancy.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {vacancy.location}
              </span>
            )}
            {vacancy.remoteType && (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-4 w-4" />
                {vacancy.remoteType}
              </span>
            )}
            {vacancy.salaryText && (
              <span className="inline-flex items-center gap-1 text-foreground/80">
                <Banknote className="h-4 w-4" />
                {vacancy.salaryText}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={vacancy.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
          >
            <ExternalLink className="h-4 w-4" />
            {t("open_original")}
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={handleApplyManual}
            disabled={isApplyingManual}
          >
            {isApplyingManual ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MousePointerClick className="h-4 w-4" />
            )}
            {tq("apply_manual")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardContent className="p-6">
              {locale !== (vacancy.language || "en") && (
                <div className="flex items-center justify-end mb-3">
                  <button
                    onClick={handleTranslateDescription}
                    disabled={isTranslatingDesc}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  >
                    {isTranslatingDesc ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Languages className="h-3 w-3" />
                    )}
                    {isTranslatingDesc
                      ? tTranslations("translating")
                      : showTranslatedDesc
                      ? tTranslations("show_english")
                      : tTranslations("translate_to", {
                          language: tTranslations(locale as "en" | "uk" | "es"),
                        })}
                  </button>
                </div>
              )}
              {vacancy.description && vacancy.description.length > 10 ? (
                <div
                  className="prose prose-invert prose-sm max-w-none text-foreground/80"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(
                      showTranslatedDesc && translatedDescription
                        ? translatedDescription
                        : vacancy.description
                    ),
                  }}
                />
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-3">No description available</p>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const { fetchVacancyDescription } = await import("@/actions/fetch-description");
                      const result = await fetchVacancyDescription(vacancy.id);
                      if ("description" in result) {
                        setVacancy({ ...vacancy, description: result.description });
                      }
                    }}
                  >
                    Fetch Description from Source
                  </Button>
                  <a href={vacancy.url} target="_blank" rel="noopener noreferrer" className="block mt-2 text-sm text-primary hover:underline">
                    Open original listing →
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Match Score */}
          {bestScore && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("score")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-3">
                  <span className={`text-4xl font-bold ${scoreColor(bestScore.matchScore)}`}>
                    {bestScore.matchScore}%
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  {bestScore.salaryFit !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("salary")} fit</span>
                      <Badge color={bestScore.salaryFit ? "green" : "red"}>
                        {bestScore.salaryFit ? "Yes" : "No"}
                      </Badge>
                    </div>
                  )}
                  {bestScore.remoteFit !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Remote fit</span>
                      <Badge color={bestScore.remoteFit ? "green" : "red"}>
                        {bestScore.remoteFit ? "Yes" : "No"}
                      </Badge>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    {bestScore.searchProfile.name}
                  </div>
                </div>
                {bestScore.notes && (
                  <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">
                    {bestScore.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Application Status / Queue Button */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{tApp("title")}</CardTitle>
            </CardHeader>
            <CardContent>
              {vacancy.application ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge color={statusColors[vacancy.application.status] || "yellow"}>
                      {tApp(`status_${vacancy.application.status}`)}
                    </Badge>
                  </div>
                  {vacancy.application.appliedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Applied</span>
                      <span className="text-sm text-foreground/80">
                        {new Date(vacancy.application.appliedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={handleQueue}
                  disabled={isQueuing}
                >
                  {isQueuing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {tq("queue_for_apply")}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Cover Letter */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{tq("cover_letter")}</CardTitle>
                {coverLetter && locale !== "en" && (
                  <button
                    onClick={handleTranslateCoverLetter}
                    disabled={isTranslatingCL}
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  >
                    {isTranslatingCL ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Languages className="h-3 w-3" />
                    )}
                    {showTranslatedCL
                      ? tTranslations("show_english")
                      : tTranslations("show_translated")}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={showTranslatedCL && translatedCoverLetter ? translatedCoverLetter : coverLetter}
                onChange={(e) => {
                  setCoverLetter(e.target.value);
                  setTranslatedCoverLetter(null);
                  setShowTranslatedCL(false);
                }}
                rows={10}
                placeholder={tq("generating_cover_letter")}
                className="mb-3"
                readOnly={showTranslatedCL}
              />
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleGenerateCoverLetter}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tq("generating_cover_letter")}
                  </>
                ) : (
                  <>
                    {coverLetter ? (
                      <><CheckCircle2 className="h-4 w-4" />{tq("edit_cover_letter")}</>
                    ) : (
                      <><Sparkles className="h-4 w-4" />Generate Cover Letter</>
                    )}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Interview Prep Button */}
          {vacancy.application && vacancy.application.status === "interview" && (
            <Card>
              <CardContent className="p-4">
                <Link href={`/applications/${vacancy.application.id}/prep`}>
                  <Button variant="default" className="w-full">
                    <BookOpen className="h-4 w-4" />
                    {tApp("prepare")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Resume Tailor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileEdit className="h-4 w-4" />
                {tTailor("title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tailorData ? (
                <div className="space-y-4">
                  {/* Tailored Summary */}
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {tTailor("tailored_summary")}
                    </span>
                    <p className="text-sm text-foreground/80 mt-1 whitespace-pre-line">
                      {tailorData.tailoredSummary}
                    </p>
                  </div>

                  {/* Keywords */}
                  {tailorData.keywordsToAdd.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {tTailor("keywords_add")}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tailorData.keywordsToAdd.map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs bg-green-900/30 text-green-300 px-2 py-0.5 rounded"
                          >
                            <Plus className="h-3 w-3" />
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {tailorData.keywordsToRemove.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {tTailor("keywords_remove")}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tailorData.keywordsToRemove.map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded"
                          >
                            <Minus className="h-3 w-3" />
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {tailorData.suggestions.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-medium text-muted-foreground">
                        {tTailor("suggestions")}
                      </span>
                      {tailorData.suggestions.map((s, i) => (
                        <div
                          key={i}
                          className={`border rounded-lg p-3 text-sm space-y-2 ${
                            acceptedSuggestions.has(i)
                              ? "border-green-700 bg-green-900/10"
                              : rejectedSuggestions.has(i)
                              ? "border-red-700 bg-red-900/10 opacity-50"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Badge color="blue">{s.section}</Badge>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleAcceptSuggestion(i)}
                                className="p-1 rounded hover:bg-green-900/30 text-green-400 transition-colors"
                                title={tTailor("accept")}
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleRejectSuggestion(i)}
                                className="p-1 rounded hover:bg-red-900/30 text-red-400 transition-colors"
                                title={tTailor("reject")}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">{tTailor("original")}:</span>{" "}
                            <span className="line-through">{s.original}</span>
                          </div>
                          <div className="text-xs text-foreground/80">
                            <span className="font-medium">{tTailor("suggested")}:</span>{" "}
                            {s.suggested}
                          </div>
                          <p className="text-xs text-muted-foreground italic">
                            {s.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={handleTailorResume}
                    disabled={isTailoring}
                  >
                    {isTailoring ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <FileEdit className="h-3 w-3" />
                    )}
                    {tTailor("regenerate")}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={handleTailorResume}
                  disabled={isTailoring}
                >
                  {isTailoring ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tTailor("tailoring")}
                    </>
                  ) : (
                    <>
                      <FileEdit className="h-4 w-4" />
                      {tTailor("tailor_button")}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Company Research */}
          {vacancy.company && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {tResearch("title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {companyData ? (
                  <div className="space-y-3 text-sm">
                    <p className="text-foreground/80">{companyData.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">{tResearch("industry")}</span>
                        <p className="text-foreground/80">{companyData.industry}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tResearch("size")}</span>
                        <p className="text-foreground/80">{companyData.size}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tResearch("founded")}</span>
                        <p className="text-foreground/80">{companyData.founded}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tResearch("headquarters")}</span>
                        <p className="text-foreground/80">{companyData.headquarters}</p>
                      </div>
                    </div>
                    {companyData.glassdoorRating && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">{tResearch("rating")}: </span>
                        <span className="text-foreground/80">{companyData.glassdoorRating}</span>
                      </div>
                    )}
                    {companyData.techStack && companyData.techStack.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">{tResearch("tech_stack")}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {companyData.techStack.map((tech, i) => (
                            <span
                              key={i}
                              className="text-xs bg-muted px-2 py-0.5 rounded"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {companyData.workCulture && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">{tResearch("work_culture")}</span>
                        <p className="text-foreground/80 mt-0.5">{companyData.workCulture}</p>
                      </div>
                    )}
                    {companyData.keyFacts.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">{tResearch("key_facts")}</span>
                        <ul className="mt-1 space-y-1">
                          {companyData.keyFacts.map((fact, i) => (
                            <li key={i} className="text-xs text-foreground/70">
                              &bull; {fact}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={handleResearchCompany}
                      disabled={isResearching}
                    >
                      {isResearching ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Search className="h-3 w-3" />
                      )}
                      {tResearch("refresh")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={handleResearchCompany}
                    disabled={isResearching}
                  >
                    {isResearching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {tResearch("researching")}
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        {tResearch("research_button")}
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
