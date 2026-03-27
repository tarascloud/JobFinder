"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";

interface ProfileFormProps {
  headline: string;
  setHeadline: (v: string) => void;
  summary: string;
  setSummary: (v: string) => void;
  yearsOfExperience: string;
  setYearsOfExperience: (v: string) => void;
  // Diff indicators
  headlineDiff?: boolean;
  summaryDiff?: boolean;
  yearsDiff?: boolean;
  headlineAccepted?: boolean;
  summaryAccepted?: boolean;
  onAcceptChange?: (field: string) => void;
}

export default function ProfileForm({
  headline,
  setHeadline,
  summary,
  setSummary,
  yearsOfExperience,
  setYearsOfExperience,
  headlineDiff,
  summaryDiff,
  yearsDiff,
  headlineAccepted,
  summaryAccepted,
  onAcceptChange,
}: ProfileFormProps) {
  const t = useTranslations("profile");

  function DiffIndicator({ field, show }: { field: string; show?: boolean }) {
    if (!show || !onAcceptChange) return null;
    return (
      <button
        onClick={() => onAcceptChange(field)}
        className="ml-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
        title={t("accept_change")}
      >
        <Sparkles className="h-3 w-3" />
        {t("new_suggestion")}
      </button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("headline")}
          <DiffIndicator field="headline" show={headlineDiff} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="block text-sm text-muted-foreground">{t("headline")}</label>
            {headlineAccepted && (
              <AiFeedbackButtons field="profile.headline" content={headline} context="resume_analysis" />
            )}
          </div>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <label className="block text-sm text-muted-foreground">
              {t("summary")}
              <DiffIndicator field="summary" show={summaryDiff} />
            </label>
            {summaryAccepted && (
              <AiFeedbackButtons field="profile.summary" content={summary} context="resume_analysis" />
            )}
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">
            {t("years_experience")}
            <DiffIndicator field="yearsExperience" show={yearsDiff} />
          </label>
          <Input
            type="number"
            value={yearsOfExperience}
            onChange={(e) => setYearsOfExperience(e.target.value)}
            className="max-w-32"
          />
        </div>
      </CardContent>
    </Card>
  );
}
