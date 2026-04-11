"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, ChevronLeft, ChevronRight, User, Briefcase, MessageSquare, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTranslation, getQATranslation } from "@/actions/translations";
import { ReviewProfileTab } from "./review-profile-tab";
import { ReviewSearchesTab } from "./review-searches-tab";
import { ReviewQaTab } from "./review-qa-tab";
import type { ReviewTab, AnalyzedProfile, AnalyzedSearchProfile, AnalyzedQaPair } from "./types";

interface StepReviewProps {
  profile: AnalyzedProfile;
  setProfile: React.Dispatch<React.SetStateAction<AnalyzedProfile>>;
  searchProfiles: AnalyzedSearchProfile[];
  setSearchProfiles: React.Dispatch<React.SetStateAction<AnalyzedSearchProfile[]>>;
  qaPairs: AnalyzedQaPair[];
  setQaPairs: React.Dispatch<React.SetStateAction<AnalyzedQaPair[]>>;
  aiOriginalProfile: AnalyzedProfile | null;
  aiOriginalSearches: AnalyzedSearchProfile[] | null;
  aiOriginalQaPairs: AnalyzedQaPair[] | null;
  analyzeError: string;
  onBack: () => void;
  onNext: () => void;
}

export default function StepReview({
  profile,
  setProfile,
  searchProfiles,
  setSearchProfiles,
  qaPairs,
  setQaPairs,
  aiOriginalProfile,
  aiOriginalSearches,
  aiOriginalQaPairs,
  analyzeError,
  onBack,
  onNext,
}: StepReviewProps) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const tTranslations = useTranslations("translations");
  const locale = useLocale();

  const [activeTab, setActiveTab] = useState<ReviewTab>("profile");
  const [isTranslatingReview, setIsTranslatingReview] = useState(false);
  const [translatedProfile, setTranslatedProfile] = useState<{ headline?: string; summary?: string } | null>(null);
  const [translatedQaPairs, setTranslatedQaPairs] = useState<Record<number, { question: string; answer: string }>>({});
  const [showTranslated, setShowTranslated] = useState(false);

  async function handleTranslateReview() {
    if (translatedProfile) { setShowTranslated(!showTranslated); return; }
    setIsTranslatingReview(true);
    try {
      const [tHeadline, tSummary] = await Promise.all([
        profile.headline ? getTranslation(profile.headline, locale, "en") : Promise.resolve(""),
        profile.summary ? getTranslation(profile.summary, locale, "en") : Promise.resolve(""),
      ]);
      setTranslatedProfile({ headline: tHeadline, summary: tSummary });
      const qaResult: Record<number, { question: string; answer: string }> = {};
      for (let i = 0; i < qaPairs.length; i++) {
        const pair = qaPairs[i];
        if (pair.question) {
          qaResult[i] = await getQATranslation(pair.question, pair.answer || "", locale, "en");
        }
      }
      setTranslatedQaPairs(qaResult);
      setShowTranslated(true);
    } finally {
      setIsTranslatingReview(false);
    }
  }

  const tabItems: { key: ReviewTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "profile", label: t("tab_profile"), icon: <User className="h-4 w-4" />, count: 0 },
    { key: "searches", label: t("tab_searches"), icon: <Briefcase className="h-4 w-4" />, count: searchProfiles.length },
    { key: "qa", label: t("tab_qa"), icon: <MessageSquare className="h-4 w-4" />, count: qaPairs.length },
  ];

  // Suppress unused warning for translations used in future: translatedProfile, translatedQaPairs, showTranslated
  void translatedQaPairs;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">{t("review_title")}</h2>
        <p className="text-muted-foreground">{t("review_description")}</p>
      </div>

      {/* Translation banner */}
      {locale !== "en" && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-muted/50 border border-border text-sm">
          <span className="text-muted-foreground">
            {tTranslations("ai_content_lang")} &middot; {tTranslations("ui_language", { language: tTranslations(locale as "en" | "uk" | "es") })}
          </span>
          <button
            onClick={handleTranslateReview}
            disabled={isTranslatingReview}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {isTranslatingReview ? (
              <><Loader2 className="h-3 w-3 animate-spin" />{tTranslations("translating")}</>
            ) : showTranslated ? (
              <><Languages className="h-3 w-3" />{tTranslations("show_english")}</>
            ) : (
              <><Languages className="h-3 w-3" />{tTranslations("translate_to", { language: tTranslations(locale as "en" | "uk" | "es") })}</>
            )}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "profile" && (
        <ReviewProfileTab profile={profile} setProfile={setProfile} aiOriginalProfile={aiOriginalProfile} />
      )}

      {activeTab === "searches" && (
        <ReviewSearchesTab
          searchProfiles={searchProfiles}
          setSearchProfiles={setSearchProfiles}
          aiOriginalSearches={aiOriginalSearches}
          profile={profile}
        />
      )}

      {activeTab === "qa" && (
        <ReviewQaTab qaPairs={qaPairs} setQaPairs={setQaPairs} aiOriginalQaPairs={aiOriginalQaPairs} />
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
        </Button>
        <Button onClick={onNext}>
          {tCommon("next")} <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      {analyzeError && <p className="text-sm text-red-400 text-center">{analyzeError}</p>}
    </div>
  );
}
