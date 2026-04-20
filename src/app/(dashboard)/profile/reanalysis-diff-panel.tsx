"use client";

import { useTranslations } from "next-intl";
import {
  Sparkles,
  Check,
  RotateCcw,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  AnalyzedProfile,
  AnalyzedSearchProfile,
  AnalyzedQaPair,
} from "@/actions/profile";

interface ReanalysisResult {
  profile: AnalyzedProfile;
  searchProfiles: AnalyzedSearchProfile[];
  qaPairs: AnalyzedQaPair[];
}

interface ReanalysisDiffPanelProps {
  reanalysisResult: ReanalysisResult;
  acceptedChanges: Set<string>;
  onAcceptChange: (field: string) => void;
  onAcceptAll: () => void;
  onAcceptSearchProfiles: () => void;
  onDismiss: () => void;
  onLoadRecommendations: () => void;
  hasChanged: (field: string) => boolean;
}

export function ReanalysisDiffPanel({
  reanalysisResult,
  acceptedChanges,
  onAcceptChange,
  onAcceptAll,
  onAcceptSearchProfiles,
  onDismiss,
  onLoadRecommendations,
  hasChanged,
}: ReanalysisDiffPanelProps) {
  const t = useTranslations("profile");
  const tOnboarding = useTranslations("onboarding");

  return (
    <Card className="border-amber-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-300">
          <Sparkles className="h-5 w-5" />
          {t("reanalysis_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("reanalysis_description")}</p>

        <div className="space-y-2">
          {(["headline", "summary", "yearsExperience", "skills", "languages", "portfolioUrls"] as const).map(
            (field) => {
              if (!hasChanged(field) || acceptedChanges.has(field)) return null;
              return (
                <div key={field} className="flex items-center justify-between text-sm p-2 rounded bg-amber-500/10 border border-amber-500/20">
                  <span className="text-foreground capitalize">
                    {field === "yearsExperience" ? t("years_experience") : t(field === "portfolioUrls" ? "portfolio" : field)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAcceptChange(field)}
                    className="text-amber-300 border-amber-500/40"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {t("accept")}
                  </Button>
                </div>
              );
            }
          )}
        </div>

        {reanalysisResult.searchProfiles.length > 0 && !acceptedChanges.has("searchProfiles") && (
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">
                {t("new_search_profiles", { count: reanalysisResult.searchProfiles.length })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={onAcceptSearchProfiles}
                className="text-amber-300 border-amber-500/40"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                {t("accept")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {reanalysisResult.searchProfiles.map((sp) => (
                <Badge key={sp.name} color="yellow">{sp.name}</Badge>
              ))}
            </div>
          </div>
        )}

        {reanalysisResult.qaPairs.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {t("new_qa_pairs", { count: reanalysisResult.qaPairs.length })}
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" onClick={onAcceptAll}>
            <Check className="h-4 w-4 mr-1" />
            {t("accept_all")}
          </Button>
          <Button variant="outline" size="sm" onClick={onDismiss}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {t("dismiss")}
          </Button>
          <Button variant="outline" size="sm" onClick={onLoadRecommendations}>
            <Lightbulb className="h-4 w-4 mr-1" />
            {tOnboarding("recommendations_title")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
