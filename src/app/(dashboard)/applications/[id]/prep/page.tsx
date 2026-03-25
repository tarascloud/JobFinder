"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Building2,
  Target,
  MessageSquare,
  Star,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateInterviewPrep, getInterviewPrep } from "@/actions/interview-prep";
import { CalendarButton } from "@/components/shared/calendar-button";

interface InterviewPrepData {
  companyOverview: string;
  roleAnalysis: string;
  potentialQuestions: { question: string; suggestedAnswer: string }[];
  talkingPoints: string[];
  questionsToAsk: string[];
  applicationId: number;
  vacancyTitle: string;
  company: string | null;
  status: string;
}

export default function InterviewPrepPage() {
  const params = useParams();
  const applicationId = Number(params.id);
  const t = useTranslations("interview_prep");
  const tCommon = useTranslations("common");

  const [prep, setPrep] = useState<InterviewPrepData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!applicationId || isNaN(applicationId)) return;
    startTransition(async () => {
      const result = await getInterviewPrep(applicationId);
      if ("error" in result) {
        // Not an error if just no prep yet
        if (result.error !== "No interview prep generated yet") {
          setError(result.error);
        }
      } else {
        setPrep(result);
      }
    });
  }, [applicationId]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    const result = await generateInterviewPrep(applicationId);
    if ("error" in result) {
      setError(result.error);
    } else {
      // Reload full data
      const full = await getInterviewPrep(applicationId);
      if (!("error" in full)) {
        setPrep(full);
      }
    }
    setIsGenerating(false);
  }

  if (isPending && !prep) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !prep) {
    return (
      <div className="space-y-4">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
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

  return (
    <div className="space-y-6">
      <Link
        href="/applications"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tCommon("back")}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          {prep && (
            <p className="text-sm text-muted-foreground mt-1">
              {prep.vacancyTitle}
              {prep.company && ` — ${prep.company}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {prep && prep.status === "interview" && (
            <CalendarButton applicationId={applicationId} />
          )}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            variant={prep ? "secondary" : "default"}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("generating")}
              </>
            ) : prep ? (
              <>
                <RefreshCw className="h-4 w-4" />
                {t("regenerate")}
              </>
            ) : (
              t("generate")
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {!prep && !isGenerating && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
            <p className="text-muted-foreground text-lg">{t("no_prep")}</p>
            <p className="text-muted-foreground text-sm mt-2">{t("no_prep_hint")}</p>
          </CardContent>
        </Card>
      )}

      {prep && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {t("company_overview")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/80 whitespace-pre-line">
                {prep.companyOverview}
              </p>
            </CardContent>
          </Card>

          {/* Role Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t("role_analysis")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/80 whitespace-pre-line">
                {prep.roleAnalysis}
              </p>
            </CardContent>
          </Card>

          {/* Talking Points */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4" />
                {t("talking_points")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {prep.talkingPoints.map((point, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/80">
                    <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Questions to Ask */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                {t("questions_to_ask")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {prep.questionsToAsk.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/80">
                    <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                    {q}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Potential Questions - full width */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t("potential_questions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {prep.potentialQuestions.map((qa, i) => (
                  <div key={i} className="border-b border-border pb-4 last:border-0 last:pb-0">
                    <p className="text-sm font-medium text-foreground mb-1">
                      {i + 1}. {qa.question}
                    </p>
                    <p className="text-sm text-foreground/70 pl-4">{qa.suggestedAnswer}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
