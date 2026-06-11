"use client";

import { useTranslations } from "next-intl";
import { GitCompare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { AnalyzedProfile } from "@/actions/profile";

interface ResumeImprovementPanelProps {
  improvedProfile: AnalyzedProfile;
  headline: string;
  summary: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ResumeImprovementPanel({
  improvedProfile,
  headline,
  summary,
  onAccept,
  onDismiss,
}: ResumeImprovementPanelProps) {
  const t = useTranslations("profile");
  const tOnboarding = useTranslations("onboarding");

  return (
    <Card className="border-status-success/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-status-success">
          <GitCompare className="h-5 w-5" />
          {tOnboarding("improve_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{tOnboarding("improve_desc")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-status-error/20 space-y-2">
            <h4 className="text-xs font-medium text-status-error uppercase">{tOnboarding("before")}</h4>
            <p className="text-sm"><span className="text-muted-foreground">{t("headline")}:</span> {headline}</p>
            <p className="text-sm text-muted-foreground line-clamp-3">{summary}</p>
          </div>
          <div className="p-3 rounded-lg border border-status-success/20 space-y-2">
            <h4 className="text-xs font-medium text-status-success uppercase">{tOnboarding("after")}</h4>
            <p className="text-sm">
              <span className="text-muted-foreground">{t("headline")}:</span>{" "}
              <span className={improvedProfile.headline !== headline ? "bg-status-success/15 px-1 rounded" : ""}>
                {improvedProfile.headline}
              </span>
            </p>
            <p className={`text-sm text-muted-foreground line-clamp-3 ${
              improvedProfile.summary !== summary ? "bg-status-success/15 px-1 rounded" : ""
            }`}>
              {improvedProfile.summary}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={onAccept}>
            <Check className="h-4 w-4 mr-1" />
            {tOnboarding("accept_improvements")}
          </Button>
          <Button variant="outline" size="sm" onClick={onDismiss}>
            {tOnboarding("reject_improvements")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
