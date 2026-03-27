"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Plus,
  X,
  Loader2,
  Check,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  MessageSquare,
  User,
  Pencil,
  Trash2,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import { getTranslation, getQATranslation } from "@/actions/translations";
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

// Russian language helper
function isRussianLanguage(lang: string): boolean {
  const lower = lang.toLowerCase();
  return lower.startsWith("russian") || lower.startsWith("русский") || lower.startsWith("русский");
}

function normalizeLanguageEntry(lang: string): string {
  if (isRussianLanguage(lang)) {
    const name = lang.replace(/\s*\(.*?\)\s*$/, "").trim();
    return `${name} (Want to forget)`;
  }
  return lang;
}

function addTag(
  value: string,
  list: string[],
  setList: (v: string[]) => void,
  setCurrent: (v: string) => void
) {
  const trimmed = value.trim();
  if (trimmed && !list.includes(trimmed)) {
    setList([...list, trimmed]);
  }
  setCurrent("");
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
  const tProfile = useTranslations("profile");
  const tSearches = useTranslations("searches");
  const tCommon = useTranslations("common");
  const tEdit = useTranslations("ai_edit_tracking");
  const tTranslations = useTranslations("translations");
  const locale = useLocale();

  // Tab state
  const [activeTab, setActiveTab] = useState<ReviewTab>("profile");

  // Translation state
  const [isTranslatingReview, setIsTranslatingReview] = useState(false);
  const [translatedProfile, setTranslatedProfile] = useState<{ headline?: string; summary?: string } | null>(null);
  const [translatedQaPairs, setTranslatedQaPairs] = useState<Record<number, { question: string; answer: string }>>({});
  const [showTranslated, setShowTranslated] = useState(false);

  // Inline edit helpers
  const [newSkill, setNewSkill] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [newPortfolioUrl, setNewPortfolioUrl] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [editingQa, setEditingQa] = useState<number | null>(null);

  // Search profile edit state
  const [editingSearch, setEditingSearch] = useState<number | null>(null);
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newGeo, setNewGeo] = useState("");

  async function handleTranslateReview() {
    if (translatedProfile) {
      setShowTranslated(!showTranslated);
      return;
    }
    setIsTranslatingReview(true);
    try {
      const [tHeadline, tSummary] = await Promise.all([
        profile.headline ? getTranslation(profile.headline, locale, "en") : Promise.resolve(""),
        profile.summary ? getTranslation(profile.summary, locale, "en") : Promise.resolve(""),
      ]);
      setTranslatedProfile({ headline: tHeadline, summary: tSummary });

      const qaTranslationsResult: Record<number, { question: string; answer: string }> = {};
      for (let i = 0; i < qaPairs.length; i++) {
        const pair = qaPairs[i];
        if (pair.question) {
          const translated = await getQATranslation(pair.question, pair.answer || "", locale, "en");
          qaTranslationsResult[i] = translated;
        }
      }
      setTranslatedQaPairs(qaTranslationsResult);
      setShowTranslated(true);
    } finally {
      setIsTranslatingReview(false);
    }
  }

  function toggleEmploymentType(type: string) {
    setProfile((prev) => ({
      ...prev,
      employmentTypes: prev.employmentTypes.includes(type)
        ? prev.employmentTypes.filter((t) => t !== type)
        : [...prev.employmentTypes, type],
    }));
  }

  function updateSearchProfile(index: number, updates: Partial<AnalyzedSearchProfile>) {
    setSearchProfiles((prev) =>
      prev.map((sp, i) => (i === index ? { ...sp, ...updates } : sp))
    );
  }

  function removeSearchProfile(index: number) {
    setSearchProfiles((prev) => prev.filter((_, i) => i !== index));
  }

  function addSearchProfile() {
    setSearchProfiles((prev) => [
      ...prev,
      {
        name: `Search ${prev.length + 1}`,
        jobTitles: profile.headline ? [profile.headline] : [],
        minSalary: profile.salaryMin,
        currency: profile.salaryCurrency,
        geographies: [],
        remoteOnly: true,
        employmentTypes: ["full-time"],
      },
    ]);
    setEditingSearch(searchProfiles.length);
  }

  function updateQaPair(index: number, field: "question" | "answer", value: string) {
    setQaPairs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function removeQaPair(index: number) {
    setQaPairs((prev) => prev.filter((_, i) => i !== index));
    if (editingQa === index) setEditingQa(null);
  }

  function addQaPair() {
    setQaPairs((prev) => [...prev, { question: "", answer: "" }]);
    setEditingQa(qaPairs.length);
  }

  const tabItems: { key: ReviewTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "profile", label: t("tab_profile"), icon: <User className="h-4 w-4" />, count: 0 },
    {
      key: "searches",
      label: t("tab_searches"),
      icon: <Briefcase className="h-4 w-4" />,
      count: searchProfiles.length,
    },
    {
      key: "qa",
      label: t("tab_qa"),
      icon: <MessageSquare className="h-4 w-4" />,
      count: qaPairs.length,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">{t("review_title")}</h2>
        <p className="text-muted-foreground">
          {t("review_description")}
        </p>
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
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {tTranslations("translating")}
              </>
            ) : showTranslated ? (
              <>
                <Languages className="h-3 w-3" />
                {tTranslations("show_english")}
              </>
            ) : (
              <>
                <Languages className="h-3 w-3" />
                {tTranslations("translate_to", { language: tTranslations(locale as "en" | "uk" | "es") })}
              </>
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
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---- Profile Tab ---- */}
      {activeTab === "profile" && (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-muted-foreground">
                  {tProfile("headline")}
                </label>
                <div className="flex items-center gap-1.5">
                  {aiOriginalProfile && profile.headline !== aiOriginalProfile.headline && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> {tEdit("edited")}
                    </span>
                  )}
                  {aiOriginalProfile && profile.headline === aiOriginalProfile.headline && aiOriginalProfile.headline && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {tEdit("kept")}
                    </span>
                  )}
                  {aiOriginalProfile?.headline && (
                    <AiFeedbackButtons field="profile.headline" content={aiOriginalProfile.headline} context="onboarding" />
                  )}
                </div>
              </div>
              <Input
                value={profile.headline}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, headline: e.target.value }))
                }
                placeholder="e.g. Senior Frontend Engineer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-muted-foreground">
                  {tProfile("summary")}
                </label>
                <div className="flex items-center gap-1.5">
                  {aiOriginalProfile && profile.summary !== aiOriginalProfile.summary && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> {tEdit("edited")}
                    </span>
                  )}
                  {aiOriginalProfile && profile.summary === aiOriginalProfile.summary && aiOriginalProfile.summary && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {tEdit("kept")}
                    </span>
                  )}
                  {aiOriginalProfile?.summary && (
                    <AiFeedbackButtons field="profile.summary" content={aiOriginalProfile.summary} context="onboarding" />
                  )}
                </div>
              </div>
              <textarea
                value={profile.summary}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, summary: e.target.value }))
                }
                rows={3}
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  {tProfile("years_experience")}
                </label>
                <Input
                  type="number"
                  value={profile.yearsExperience ?? ""}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      yearsExperience: e.target.value ? parseInt(e.target.value) : null,
                    }))
                  }
                  placeholder="5"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  {tProfile("salary_min")}
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={profile.salaryMin ?? ""}
                    onChange={(e) =>
                      setProfile((p) => ({
                        ...p,
                        salaryMin: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
                    placeholder="80000"
                    className="flex-1"
                  />
                  <select
                    value={profile.salaryCurrency}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, salaryCurrency: e.target.value }))
                    }
                    className="rounded-lg border border-input bg-muted px-2 text-sm text-foreground focus:border-ring focus:outline-none"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="UAH">UAH</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Skills */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-muted-foreground">
                  {tProfile("skills")}
                </label>
                <div className="flex items-center gap-1.5">
                  {aiOriginalProfile && profile.skills.join(",") !== aiOriginalProfile.skills.join(",") && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> {tEdit("edited")}
                    </span>
                  )}
                  {aiOriginalProfile && profile.skills.join(",") === aiOriginalProfile.skills.join(",") && aiOriginalProfile.skills.length > 0 && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {tEdit("kept")}
                    </span>
                  )}
                  {aiOriginalProfile && aiOriginalProfile.skills.length > 0 && (
                    <AiFeedbackButtons field="profile.skills" content={aiOriginalProfile.skills.join(", ")} context="onboarding" />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-sm text-primary/80"
                  >
                    {skill}
                    <button
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          skills: p.skills.filter((s) => s !== skill),
                        }))
                      }
                      className="ml-0.5 text-primary hover:text-primary/80 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    addTag(
                      newSkill,
                      profile.skills,
                      (v) => setProfile((p) => ({ ...p, skills: v })),
                      setNewSkill
                    )
                  }
                  placeholder={tProfile("skills") + "..."}
                  className="max-w-64"
                />
                <Button
                  variant="outline"
                  size="md"
                  onClick={() =>
                    addTag(
                      newSkill,
                      profile.skills,
                      (v) => setProfile((p) => ({ ...p, skills: v })),
                      setNewSkill
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Languages */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-muted-foreground">
                  {tProfile("languages")}
                </label>
                <div className="flex items-center gap-1.5">
                  {aiOriginalProfile && profile.languages.join(",") !== aiOriginalProfile.languages.join(",") && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> {tEdit("edited")}
                    </span>
                  )}
                  {aiOriginalProfile && profile.languages.join(",") === aiOriginalProfile.languages.join(",") && aiOriginalProfile.languages.length > 0 && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {tEdit("kept")}
                    </span>
                  )}
                  {aiOriginalProfile && aiOriginalProfile.languages.length > 0 && (
                    <AiFeedbackButtons field="profile.languages" content={aiOriginalProfile.languages.join(", ")} context="onboarding" />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.languages.map((lang) => (
                  <span
                    key={lang}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
                      isRussianLanguage(lang)
                        ? "bg-red-900/40 border border-red-700/40 text-red-300 line-through opacity-70"
                        : "bg-purple-900/40 border border-purple-700/40 text-purple-300"
                    }`}
                  >
                    {lang}
                    <button
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          languages: p.languages.filter((l) => l !== lang),
                        }))
                      }
                      className={`ml-0.5 hover:text-primary/80 cursor-pointer ${
                        isRussianLanguage(lang) ? "text-red-400" : "text-purple-400"
                      }`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    addTag(
                      normalizeLanguageEntry(newLanguage),
                      profile.languages,
                      (v) => setProfile((p) => ({ ...p, languages: v })),
                      setNewLanguage
                    )
                  }
                  placeholder="e.g. English (Professional)"
                  className="max-w-64"
                />
                <Button
                  variant="outline"
                  size="md"
                  onClick={() =>
                    addTag(
                      normalizeLanguageEntry(newLanguage),
                      profile.languages,
                      (v) => setProfile((p) => ({ ...p, languages: v })),
                      setNewLanguage
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Preferred Locations */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm text-muted-foreground">
                  {t("preferred_locations")}
                </label>
                <div className="flex items-center gap-1.5">
                  {aiOriginalProfile && profile.preferredLocations.join(",") !== aiOriginalProfile.preferredLocations.join(",") && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> {tEdit("edited")}
                    </span>
                  )}
                  {aiOriginalProfile && profile.preferredLocations.join(",") === aiOriginalProfile.preferredLocations.join(",") && aiOriginalProfile.preferredLocations.length > 0 && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {tEdit("kept")}
                    </span>
                  )}
                  {aiOriginalProfile && aiOriginalProfile.preferredLocations.length > 0 && (
                    <AiFeedbackButtons field="profile.preferredLocations" content={aiOriginalProfile.preferredLocations.join(", ")} context="onboarding" />
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.preferredLocations.map((loc) => (
                  <span
                    key={loc}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 border border-indigo-700/40 px-3 py-1 text-sm text-indigo-300"
                  >
                    {loc}
                    <button
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          preferredLocations: p.preferredLocations.filter((l) => l !== loc),
                        }))
                      }
                      className="ml-0.5 text-indigo-400 hover:text-primary/80 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    addTag(
                      newLocation,
                      profile.preferredLocations,
                      (v) => setProfile((p) => ({ ...p, preferredLocations: v })),
                      setNewLocation
                    )
                  }
                  placeholder="e.g. Remote, EU, Spain"
                  className="max-w-64"
                />
                <Button
                  variant="outline"
                  size="md"
                  onClick={() =>
                    addTag(
                      newLocation,
                      profile.preferredLocations,
                      (v) => setProfile((p) => ({ ...p, preferredLocations: v })),
                      setNewLocation
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Remote type + Employment types */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  {tSearches("remote_only")}
                </label>
                <select
                  value={profile.preferredRemoteType}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, preferredRemoteType: e.target.value }))
                  }
                  className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
                >
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1.5">
                  {tSearches("employment_types")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {["full-time", "contract", "part-time", "freelance"].map((type) => (
                    <button
                      key={type}
                      onClick={() => toggleEmploymentType(type)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer ${
                        profile.employmentTypes.includes(type)
                          ? "border-primary bg-primary/20 text-primary/80"
                          : "border-input bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Portfolio URLs */}
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">
                {tProfile("portfolio")}
              </label>
              <div className="space-y-1.5 mb-2">
                {profile.portfolioUrls.map((url) => (
                  <div key={url} className="flex items-center gap-2 text-sm">
                    <span className="text-foreground/80 truncate flex-1">{url}</span>
                    <button
                      onClick={() =>
                        setProfile((p) => ({
                          ...p,
                          portfolioUrls: p.portfolioUrls.filter((u) => u !== url),
                        }))
                      }
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={newPortfolioUrl}
                  onChange={(e) => setNewPortfolioUrl(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    addTag(
                      newPortfolioUrl,
                      profile.portfolioUrls,
                      (v) => setProfile((p) => ({ ...p, portfolioUrls: v })),
                      setNewPortfolioUrl
                    )
                  }
                  placeholder="https://github.com/username"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="md"
                  onClick={() =>
                    addTag(
                      newPortfolioUrl,
                      profile.portfolioUrls,
                      (v) => setProfile((p) => ({ ...p, portfolioUrls: v })),
                      setNewPortfolioUrl
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Searches Tab ---- */}
      {activeTab === "searches" && (
        <div className="space-y-4">
          {searchProfiles.map((sp, idx) => (
            <Card key={idx}>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    {editingSearch === idx ? (
                      <Input
                        value={sp.name}
                        onChange={(e) =>
                          updateSearchProfile(idx, { name: e.target.value })
                        }
                        className="max-w-64"
                      />
                    ) : (
                      <h3 className="font-medium">{sp.name}</h3>
                    )}
                    {aiOriginalSearches && aiOriginalSearches[idx] && (
                      <AiFeedbackButtons
                        field={`search.${idx}`}
                        content={`${sp.name}: ${sp.jobTitles.join(", ")}`}
                        context="onboarding"
                      />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditingSearch(editingSearch === idx ? null : idx)
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {searchProfiles.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSearchProfile(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    )}
                  </div>
                </div>

                {editingSearch === idx ? (
                  <div className="space-y-4">
                    {/* Job titles */}
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1.5">
                        {tSearches("job_titles")}
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {sp.jobTitles.map((title) => (
                          <span
                            key={title}
                            className="inline-flex items-center gap-1 rounded-full bg-green-900/40 border border-green-700/40 px-3 py-1 text-sm text-green-300"
                          >
                            {title}
                            <button
                              onClick={() =>
                                updateSearchProfile(idx, {
                                  jobTitles: sp.jobTitles.filter((t) => t !== title),
                                })
                              }
                              className="ml-0.5 text-green-400 hover:text-primary/80 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newJobTitle}
                          onChange={(e) => setNewJobTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newJobTitle.trim()) {
                              updateSearchProfile(idx, {
                                jobTitles: [...sp.jobTitles, newJobTitle.trim()],
                              });
                              setNewJobTitle("");
                            }
                          }}
                          placeholder="e.g. Senior Engineer"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => {
                            if (newJobTitle.trim()) {
                              updateSearchProfile(idx, {
                                jobTitles: [...sp.jobTitles, newJobTitle.trim()],
                              });
                              setNewJobTitle("");
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Salary + Remote */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1.5">
                          {tSearches("min_salary")}
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={sp.minSalary ?? ""}
                            onChange={(e) =>
                              updateSearchProfile(idx, {
                                minSalary: e.target.value ? parseInt(e.target.value) : null,
                              })
                            }
                            placeholder="80000"
                            className="flex-1"
                          />
                          <select
                            value={sp.currency}
                            onChange={(e) =>
                              updateSearchProfile(idx, { currency: e.target.value })
                            }
                            className="rounded-lg border border-input bg-muted px-2 text-sm text-foreground focus:border-ring focus:outline-none"
                          >
                            <option value="EUR">EUR</option>
                            <option value="USD">USD</option>
                            <option value="GBP">GBP</option>
                            <option value="UAH">UAH</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-muted-foreground mb-1.5">
                          {tSearches("remote_only")}
                        </label>
                        <button
                          onClick={() =>
                            updateSearchProfile(idx, { remoteOnly: !sp.remoteOnly })
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-sm text-left transition-colors cursor-pointer ${
                            sp.remoteOnly
                              ? "border-primary bg-primary/20 text-primary/80"
                              : "border-input bg-muted text-muted-foreground"
                          }`}
                        >
                          {sp.remoteOnly ? tSearches("remote_only") : "Include on-site/hybrid"}
                        </button>
                      </div>
                    </div>

                    {/* Geographies */}
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1.5">
                        {tSearches("geography")}
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {sp.geographies.map((geo) => (
                          <span
                            key={geo}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 border border-indigo-700/40 px-3 py-1 text-sm text-indigo-300"
                          >
                            {geo}
                            <button
                              onClick={() =>
                                updateSearchProfile(idx, {
                                  geographies: sp.geographies.filter((g) => g !== geo),
                                })
                              }
                              className="ml-0.5 text-indigo-400 hover:text-primary/80 cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={newGeo}
                          onChange={(e) => setNewGeo(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newGeo.trim()) {
                              updateSearchProfile(idx, {
                                geographies: [...sp.geographies, newGeo.trim()],
                              });
                              setNewGeo("");
                            }
                          }}
                          placeholder="e.g. EU, Remote worldwide"
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => {
                            if (newGeo.trim()) {
                              updateSearchProfile(idx, {
                                geographies: [...sp.geographies, newGeo.trim()],
                              });
                              setNewGeo("");
                            }
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Employment types */}
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1.5">
                        {tSearches("employment_types")}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {["full-time", "contract", "part-time", "freelance"].map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              const types = sp.employmentTypes.includes(type)
                                ? sp.employmentTypes.filter((t) => t !== type)
                                : [...sp.employmentTypes, type];
                              updateSearchProfile(idx, { employmentTypes: types });
                            }}
                            className={`rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer ${
                              sp.employmentTypes.includes(type)
                                ? "border-primary bg-primary/20 text-primary/80"
                                : "border-input bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Collapsed view */
                  <div className="space-y-2 text-sm">
                    {sp.jobTitles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {sp.jobTitles.map((jt) => (
                          <Badge key={jt} color="green">
                            {jt}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                      {sp.minSalary && (
                        <span>
                          {sp.minSalary.toLocaleString()} {sp.currency}
                        </span>
                      )}
                      <span>{sp.remoteOnly ? "Remote" : "Any location"}</span>
                      {sp.geographies.length > 0 && (
                        <span>{sp.geographies.join(", ")}</span>
                      )}
                      {sp.employmentTypes.length > 0 && (
                        <span>{sp.employmentTypes.join(", ")}</span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addSearchProfile} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {t("add_search")}
          </Button>
        </div>
      )}

      {/* ---- Q&A Tab ---- */}
      {activeTab === "qa" && (
        <div className="space-y-3">
          {qaPairs.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                {t("no_qa_generated")}
              </CardContent>
            </Card>
          )}
          {qaPairs.map((pair, idx) => (
            <Card key={idx}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={pair.question}
                      onChange={(e) => updateQaPair(idx, "question", e.target.value)}
                      placeholder="Question..."
                      className="text-sm font-medium"
                    />
                    <textarea
                      value={pair.answer}
                      onChange={(e) => updateQaPair(idx, "answer", e.target.value)}
                      rows={2}
                      placeholder="Answer..."
                      className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="flex items-center gap-1 shrink-0 pt-1">
                    {aiOriginalQaPairs && aiOriginalQaPairs[idx] && (
                      <>
                        {pair.answer !== aiOriginalQaPairs[idx].answer && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <Pencil className="h-3 w-3" />
                          </span>
                        )}
                        {pair.answer === aiOriginalQaPairs[idx].answer && aiOriginalQaPairs[idx].answer && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                        <AiFeedbackButtons
                          field={`qa.${idx}.answer`}
                          content={aiOriginalQaPairs[idx].answer}
                          context={pair.question}
                        />
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQaPair(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={addQaPair} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {t("add_qa")}
          </Button>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
        </Button>
        <Button onClick={onNext}>
          {tCommon("next")} <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      {analyzeError && (
        <p className="text-sm text-red-400 text-center">{analyzeError}</p>
      )}
    </div>
  );
}
