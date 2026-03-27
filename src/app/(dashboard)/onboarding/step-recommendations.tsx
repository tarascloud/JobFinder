"use client";

import { useTranslations } from "next-intl";
import {
  Loader2,
  Check,
  ChevronLeft,
  Sparkles,
  Rocket,
  FileText,
  Briefcase,
  Lightbulb,
  GitCompare,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ResumeRecommendation } from "./types";

interface StepRecommendationsProps {
  recommendations: ResumeRecommendation[];
  recFeedback: Record<string, "like" | "dislike">;
  loadingRecs: boolean;
  applyingRecs: boolean;
  analyzeError: string;
  onRecFeedback: (recId: string, rating: "like" | "dislike") => void;
  onApplySuggestions: () => void;
  onSkip: () => void;
  onBack: () => void;
}

const priorityColors = {
  high: "bg-red-900/40 border-red-700/40 text-red-300",
  medium: "bg-amber-900/40 border-amber-700/40 text-amber-300",
  low: "bg-blue-900/40 border-blue-700/40 text-blue-300",
};

const categoryIcons: Record<string, React.ReactNode> = {
  content: <FileText className="h-4 w-4" />,
  format: <GitCompare className="h-4 w-4" />,
  keywords: <Sparkles className="h-4 w-4" />,
  achievements: <Rocket className="h-4 w-4" />,
  structure: <Briefcase className="h-4 w-4" />,
};

export default function StepRecommendations({
  recommendations,
  recFeedback,
  loadingRecs,
  applyingRecs,
  analyzeError,
  onRecFeedback,
  onApplySuggestions,
  onSkip,
  onBack,
}: StepRecommendationsProps) {
  const t = useTranslations("onboarding");

  const priorityLabels = {
    high: t("priority_high"),
    medium: t("priority_medium"),
    low: t("priority_low"),
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
          <Lightbulb className="h-7 w-7 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold">{t("recommendations_title")}</h2>
        <p className="text-muted-foreground">
          {t("recommendations_desc")}
        </p>
      </div>

      {loadingRecs ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("recommendations_loading")}</p>
          </CardContent>
        </Card>
      ) : recommendations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Check className="h-8 w-8 text-green-400 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t("no_recommendations")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <Card
              key={rec.id}
              className={`transition-opacity ${
                recFeedback[rec.id] === "dislike" ? "opacity-50" : ""
              }`}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5 text-muted-foreground">
                      {categoryIcons[rec.category] || <Lightbulb className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-foreground">{rec.title}</h3>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${priorityColors[rec.priority]}`}
                        >
                          {priorityLabels[rec.priority]}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{rec.description}</p>
                      {rec.currentText && rec.suggestedText && (
                        <div className="mt-2 space-y-1.5">
                          <div className="rounded-md bg-red-950/30 border border-red-900/30 px-3 py-1.5">
                            <p className="text-xs text-red-300/70 line-through">
                              {rec.currentText}
                            </p>
                          </div>
                          <div className="rounded-md bg-green-950/30 border border-green-900/30 px-3 py-1.5">
                            <p className="text-xs text-green-300">{rec.suggestedText}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => onRecFeedback(rec.id, "like")}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        recFeedback[rec.id] === "like"
                          ? "bg-green-900/40 text-green-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onRecFeedback(rec.id, "dislike")}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        recFeedback[rec.id] === "dislike"
                          ? "bg-red-900/40 text-red-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> {t("step_review")}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onSkip}>
            {t("skip_improvements")}
          </Button>
          {recommendations.length > 0 && (
            <Button onClick={onApplySuggestions} disabled={applyingRecs}>
              {applyingRecs ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t("applying_improvements")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t("apply_suggestions")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      {analyzeError && (
        <p className="text-sm text-red-400 text-center">{analyzeError}</p>
      )}
    </div>
  );
}
