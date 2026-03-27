"use client";

import { useTranslations } from "next-intl";
import {
  Loader2,
  ChevronLeft,
  Rocket,
  Info,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalyzedProfile, AnalyzedSearchProfile, AnalyzedQaPair } from "./types";

interface StepReadyProps {
  profile: AnalyzedProfile;
  searchProfiles: AnalyzedSearchProfile[];
  qaPairs: AnalyzedQaPair[];
  saving: boolean;
  analyzeError: string;
  onComplete: () => void;
  onBack: () => void;
}

export default function StepReady({
  profile,
  searchProfiles,
  qaPairs,
  saving,
  analyzeError,
  onComplete,
  onBack,
}: StepReadyProps) {
  const t = useTranslations("onboarding");
  const tProfile = useTranslations("profile");
  const tSearches = useTranslations("searches");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-600/20 flex items-center justify-center mb-4">
              <Rocket className="h-7 w-7 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold">{t("ready_title")}</h2>
            <p className="text-muted-foreground">
              {t("ready_description")}
            </p>
          </div>

          {/* Profile summary */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground/80 uppercase tracking-wide">
              {tProfile("title")}
            </h3>
            <div className="space-y-1.5 text-sm">
              {profile.headline && (
                <p>
                  <span className="text-muted-foreground">{tProfile("headline")}:</span>{" "}
                  <span className="text-foreground">{profile.headline}</span>
                </p>
              )}
              {profile.yearsExperience && (
                <p>
                  <span className="text-muted-foreground">{tProfile("years_experience")}:</span>{" "}
                  <span className="text-foreground">{profile.yearsExperience}</span>
                </p>
              )}
              {profile.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {profile.skills.slice(0, 8).map((s) => (
                    <Badge key={s} color="blue">
                      {s}
                    </Badge>
                  ))}
                  {profile.skills.length > 8 && (
                    <Badge>+{profile.skills.length - 8} more</Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Search profiles summary */}
          {searchProfiles.map((sp, idx) => (
            <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-medium text-foreground/80 uppercase tracking-wide">
                {tCommon("search")}: {sp.name}
              </h3>
              <div className="space-y-1.5 text-sm">
                {sp.jobTitles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sp.jobTitles.map((jt) => (
                      <Badge key={jt} color="green">
                        {jt}
                      </Badge>
                    ))}
                  </div>
                )}
                <p>
                  <span className="text-muted-foreground">{tSearches("remote_only")}:</span>{" "}
                  <span className="text-foreground">{sp.remoteOnly ? "Yes" : "No"}</span>
                  {sp.minSalary && (
                    <>
                      {" "}
                      <span className="text-muted-foreground/60">|</span>{" "}
                      <span className="text-muted-foreground">{tSearches("min_salary")}:</span>{" "}
                      <span className="text-foreground">
                        {sp.minSalary.toLocaleString()} {sp.currency}
                      </span>
                    </>
                  )}
                </p>
                {sp.geographies.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">{tSearches("geography")}:</span>{" "}
                    <span className="text-foreground">{sp.geographies.join(", ")}</span>
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Q&A summary */}
          {qaPairs.length > 0 && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-medium text-foreground/80 uppercase tracking-wide">
                {t("tab_qa")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("qa_count", { count: qaPairs.length })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tip: review Q&A */}
      <div className="rounded-lg border border-blue-700/40 bg-blue-900/20 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-200">
          {t("ready_tip_qa")}{" "}
          <Link href="/qa" className="font-medium text-blue-400 hover:text-blue-300 underline underline-offset-2">
            {t("ready_tip_qa_link")}
          </Link>
        </p>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
        </Button>
        <Button size="lg" onClick={onComplete} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {tCommon("loading")}
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" />
              {t("start_button")}
            </>
          )}
        </Button>
      </div>
      {analyzeError && (
        <p className="text-sm text-red-400 text-center">{analyzeError}</p>
      )}
    </div>
  );
}
