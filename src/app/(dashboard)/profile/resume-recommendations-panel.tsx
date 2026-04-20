"use client";

import { useTranslations } from "next-intl";
import {
  Loader2,
  Check,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { ResumeRecommendation } from "@/actions/resume-recommendations";

interface ResumeRecommendationsPanelProps {
  recommendations: ResumeRecommendation[];
  recFeedback: Record<string, "like" | "dislike">;
  loadingRecs: boolean;
  applyingRecs: boolean;
  onFeedback: (recId: string, rating: "like" | "dislike") => void;
  onApply: () => void;
  onDismiss: () => void;
}

export function ResumeRecommendationsPanel({
  recommendations,
  recFeedback,
  loadingRecs,
  applyingRecs,
  onFeedback,
  onApply,
  onDismiss,
}: ResumeRecommendationsPanelProps) {
  const tOnboarding = useTranslations("onboarding");

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-300">
          <Lightbulb className="h-5 w-5" />
          {tOnboarding("recommendations_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{tOnboarding("recommendations_desc")}</p>

        {loadingRecs ? (
          <div className="text-center py-4">
            <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{tOnboarding("recommendations_loading")}</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-4">
            <Check className="h-6 w-6 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{tOnboarding("no_recommendations")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className={`p-3 rounded-lg border border-border space-y-2 transition-opacity ${
                  recFeedback[rec.id] === "dislike" ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium">{rec.title}</h4>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                        rec.priority === "high" ? "bg-red-900/40 border-red-700/40 text-red-300"
                          : rec.priority === "medium" ? "bg-amber-900/40 border-amber-700/40 text-amber-300"
                          : "bg-blue-900/40 border-blue-700/40 text-blue-300"
                      }`}>
                        {rec.priority === "high" ? tOnboarding("priority_high")
                          : rec.priority === "medium" ? tOnboarding("priority_medium")
                          : tOnboarding("priority_low")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                    {rec.currentText && rec.suggestedText && (
                      <div className="mt-2 space-y-1">
                        <div className="rounded bg-red-950/30 border border-red-900/30 px-2 py-1">
                          <p className="text-xs text-red-300/70 line-through">{rec.currentText}</p>
                        </div>
                        <div className="rounded bg-green-950/30 border border-green-900/30 px-2 py-1">
                          <p className="text-xs text-green-300">{rec.suggestedText}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => onFeedback(rec.id, "like")}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        recFeedback[rec.id] === "like"
                          ? "bg-green-900/40 text-green-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onFeedback(rec.id, "dislike")}
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
              </div>
            ))}
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" onClick={onApply} disabled={applyingRecs}>
              {applyingRecs ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {tOnboarding("applying_improvements")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  {tOnboarding("apply_suggestions")}
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={onDismiss}>
              {tOnboarding("skip_improvements")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
