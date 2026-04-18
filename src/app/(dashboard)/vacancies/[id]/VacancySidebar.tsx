"use client";

import { useState } from "react";
import Link from "next/link";
import {
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
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getTranslation } from "@/actions/translations";
import type { VacancyDetail, CompanyData, TailorData } from "./types";
import { statusColors, scoreColor } from "./types";

// ---- Score Card ----

interface VacancyScoreCardProps {
  vacancy: VacancyDetail;
  t: (key: string) => string;
}

function VacancyScoreCard({ vacancy, t }: VacancyScoreCardProps) {
  const bestScore = vacancy.scores[0];
  if (!bestScore) return null;

  return (
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
  );
}

// ---- Application Card ----

interface VacancyApplicationCardProps {
  vacancy: VacancyDetail;
  isQueuing: boolean;
  onQueue: () => void;
  tApp: (key: string) => string;
  tq: (key: string) => string;
}

function VacancyApplicationCard({ vacancy, isQueuing, onQueue, tApp, tq }: VacancyApplicationCardProps) {
  return (
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
          <Button className="w-full" onClick={onQueue} disabled={isQueuing}>
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
  );
}

// ---- Cover Letter Card ----

interface VacancyCoverLetterCardProps {
  coverLetter: string;
  onCoverLetterChange: (val: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  locale: string;
  tq: (key: string) => string;
  tTranslations: (key: string) => string;
}

function VacancyCoverLetterCard({
  coverLetter, onCoverLetterChange, isGenerating, onGenerate, locale, tq, tTranslations,
}: VacancyCoverLetterCardProps) {
  const [translatedCoverLetter, setTranslatedCoverLetter] = useState<string | null>(null);
  const [isTranslatingCL, setIsTranslatingCL] = useState(false);
  const [showTranslatedCL, setShowTranslatedCL] = useState(false);

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

  return (
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
            onCoverLetterChange(e.target.value);
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
          onClick={onGenerate}
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
  );
}

// ---- Interview Prep Card ----

interface InterviewPrepCardProps {
  vacancy: VacancyDetail;
  tApp: (key: string) => string;
}

function InterviewPrepCard({ vacancy, tApp }: InterviewPrepCardProps) {
  if (!vacancy.application || vacancy.application.status !== "interview") return null;
  return (
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
  );
}

// ---- Resume Tailor Card ----

interface VacancyResumeTailorProps {
  isTailoring: boolean;
  tailorData: TailorData | null;
  onTailor: () => void;
  tTailor: (key: string) => string;
}

function VacancyResumeTailor({ isTailoring, tailorData, onTailor, tTailor }: VacancyResumeTailorProps) {
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<Set<number>>(new Set());
  const [rejectedSuggestions, setRejectedSuggestions] = useState<Set<number>>(new Set());

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

  return (
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
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                {tTailor("tailored_summary")}
              </span>
              <p className="text-sm text-foreground/80 mt-1 whitespace-pre-line">
                {tailorData.tailoredSummary}
              </p>
            </div>

            {tailorData.keywordsToAdd.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  {tTailor("keywords_add")}
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tailorData.keywordsToAdd.map((kw, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-green-900/30 text-green-300 px-2 py-0.5 rounded">
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
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded">
                      <Minus className="h-3 w-3" />
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
              onClick={onTailor}
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
            onClick={onTailor}
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
  );
}

// ---- Company Research Card ----

interface VacancyCompanyResearchProps {
  company: string;
  companyData: CompanyData | null;
  isResearching: boolean;
  onResearch: () => void;
  tResearch: (key: string) => string;
}

function VacancyCompanyResearch({ company, companyData, isResearching, onResearch, tResearch }: VacancyCompanyResearchProps) {
  return (
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
                    <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">
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
              onClick={onResearch}
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
            onClick={onResearch}
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
  );
}

// ---- Combined Sidebar Export ----

export {
  VacancyScoreCard,
  VacancyApplicationCard,
  VacancyCoverLetterCard,
  InterviewPrepCard,
  VacancyResumeTailor,
  VacancyCompanyResearch,
};
