"use client";

import { useTranslations } from "next-intl";
import {
  Check,
  ChevronLeft,
  GitCompare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalyzedProfile } from "./types";

interface StepImproveProps {
  originalProfile: AnalyzedProfile | null;
  improvedProfile: AnalyzedProfile | null;
  onAccept: () => void;
  onReject: () => void;
  onBack: () => void;
}

export default function StepImprove({
  originalProfile,
  improvedProfile,
  onAccept,
  onReject,
  onBack,
}: StepImproveProps) {
  const t = useTranslations("onboarding");
  const tProfile = useTranslations("profile");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mb-4">
          <GitCompare className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">{t("improve_title")}</h2>
        <p className="text-muted-foreground">{t("improve_desc")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Before */}
        <Card className="border-red-900/30">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-medium text-red-300 uppercase tracking-wide">
              {t("before")}
            </h3>
            {originalProfile && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{tProfile("headline")}:</span>{" "}
                  <span className="text-foreground">{originalProfile.headline}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tProfile("summary")}:</span>{" "}
                  <span className="text-foreground/80">{originalProfile.summary}</span>
                </div>
                {originalProfile.skills.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">{tProfile("skills")}:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {originalProfile.skills.map((s) => (
                        <Badge key={s} color="red">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {originalProfile.yearsExperience && (
                  <div>
                    <span className="text-muted-foreground">{tProfile("years_experience")}:</span>{" "}
                    <span className="text-foreground">{originalProfile.yearsExperience}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* After */}
        <Card className="border-green-900/30">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-sm font-medium text-green-300 uppercase tracking-wide">
              {t("after")}
            </h3>
            {improvedProfile && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">{tProfile("headline")}:</span>{" "}
                  <span className={`text-foreground ${
                    improvedProfile.headline !== originalProfile?.headline ? "bg-green-900/30 px-1 rounded" : ""
                  }`}>
                    {improvedProfile.headline}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{tProfile("summary")}:</span>{" "}
                  <span className={`text-foreground/80 ${
                    improvedProfile.summary !== originalProfile?.summary ? "bg-green-900/30 px-1 rounded" : ""
                  }`}>
                    {improvedProfile.summary}
                  </span>
                </div>
                {improvedProfile.skills.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">{tProfile("skills")}:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {improvedProfile.skills.map((s) => (
                        <Badge
                          key={s}
                          color={originalProfile?.skills.includes(s) ? "blue" : "green"}
                        >
                          {s}
                          {!originalProfile?.skills.includes(s) && (
                            <span className="ml-1 text-green-400">+</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {improvedProfile.yearsExperience && (
                  <div>
                    <span className="text-muted-foreground">{tProfile("years_experience")}:</span>{" "}
                    <span className="text-foreground">{improvedProfile.yearsExperience}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onReject}>
            {t("reject_improvements")}
          </Button>
          <Button onClick={onAccept}>
            <Check className="h-4 w-4 mr-2" />
            {t("accept_improvements")}
          </Button>
        </div>
      </div>
    </div>
  );
}
