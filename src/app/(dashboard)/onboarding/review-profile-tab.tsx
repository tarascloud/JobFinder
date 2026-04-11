"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import type { AnalyzedProfile } from "./types";

function isRussianLanguage(lang: string): boolean {
  const lower = lang.toLowerCase();
  return lower.startsWith("russian") || lower.startsWith("русский");
}

function normalizeLanguageEntry(lang: string): string {
  if (isRussianLanguage(lang)) {
    const name = lang.replace(/\s*\(.*?\)\s*$/, "").trim();
    return `${name} (Want to forget)`;
  }
  return lang;
}

function addTag(value: string, list: string[], setList: (v: string[]) => void, setCurrent: (v: string) => void) {
  const trimmed = value.trim();
  if (trimmed && !list.includes(trimmed)) setList([...list, trimmed]);
  setCurrent("");
}

interface ReviewProfileTabProps {
  profile: AnalyzedProfile;
  setProfile: React.Dispatch<React.SetStateAction<AnalyzedProfile>>;
  aiOriginalProfile: AnalyzedProfile | null;
}

export function ReviewProfileTab({ profile, setProfile, aiOriginalProfile }: ReviewProfileTabProps) {
  const tProfile = useTranslations("profile");
  const tSearches = useTranslations("searches");
  const tEdit = useTranslations("ai_edit_tracking");

  const [newSkill, setNewSkill] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [newPortfolioUrl, setNewPortfolioUrl] = useState("");
  const [newLocation, setNewLocation] = useState("");

  function toggleEmploymentType(type: string) {
    setProfile((prev) => ({
      ...prev,
      employmentTypes: prev.employmentTypes.includes(type)
        ? prev.employmentTypes.filter((t) => t !== type)
        : [...prev.employmentTypes, type],
    }));
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        {/* Headline */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-muted-foreground">{tProfile("headline")}</label>
            <div className="flex items-center gap-1.5">
              {aiOriginalProfile && profile.headline !== aiOriginalProfile.headline && (
                <span className="text-xs text-amber-400 flex items-center gap-1"><Pencil className="h-3 w-3" /> {tEdit("edited")}</span>
              )}
              {aiOriginalProfile && profile.headline === aiOriginalProfile.headline && aiOriginalProfile.headline && (
                <span className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> {tEdit("kept")}</span>
              )}
              {aiOriginalProfile?.headline && (
                <AiFeedbackButtons field="profile.headline" content={aiOriginalProfile.headline} context="onboarding" />
              )}
            </div>
          </div>
          <Input
            value={profile.headline}
            onChange={(e) => setProfile((p) => ({ ...p, headline: e.target.value }))}
            placeholder="e.g. Senior Frontend Engineer"
          />
        </div>

        {/* Summary */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-muted-foreground">{tProfile("summary")}</label>
            <div className="flex items-center gap-1.5">
              {aiOriginalProfile && profile.summary !== aiOriginalProfile.summary && (
                <span className="text-xs text-amber-400 flex items-center gap-1"><Pencil className="h-3 w-3" /> {tEdit("edited")}</span>
              )}
              {aiOriginalProfile && profile.summary === aiOriginalProfile.summary && aiOriginalProfile.summary && (
                <span className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> {tEdit("kept")}</span>
              )}
              {aiOriginalProfile?.summary && (
                <AiFeedbackButtons field="profile.summary" content={aiOriginalProfile.summary} context="onboarding" />
              )}
            </div>
          </div>
          <textarea
            value={profile.summary}
            onChange={(e) => setProfile((p) => ({ ...p, summary: e.target.value }))}
            rows={3}
            className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Years + Salary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{tProfile("years_experience")}</label>
            <Input
              type="number"
              value={profile.yearsExperience ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, yearsExperience: e.target.value ? parseInt(e.target.value) : null }))}
              placeholder="5"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{tProfile("salary_min")}</label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={profile.salaryMin ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, salaryMin: e.target.value ? parseInt(e.target.value) : null }))}
                placeholder="80000"
                className="flex-1"
              />
              <select
                value={profile.salaryCurrency}
                onChange={(e) => setProfile((p) => ({ ...p, salaryCurrency: e.target.value }))}
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
            <label className="text-sm text-muted-foreground">{tProfile("skills")}</label>
            <div className="flex items-center gap-1.5">
              {aiOriginalProfile && profile.skills.join(",") !== aiOriginalProfile.skills.join(",") && (
                <span className="text-xs text-amber-400 flex items-center gap-1"><Pencil className="h-3 w-3" /> {tEdit("edited")}</span>
              )}
              {aiOriginalProfile && profile.skills.join(",") === aiOriginalProfile.skills.join(",") && aiOriginalProfile.skills.length > 0 && (
                <span className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> {tEdit("kept")}</span>
              )}
              {aiOriginalProfile && aiOriginalProfile.skills.length > 0 && (
                <AiFeedbackButtons field="profile.skills" content={aiOriginalProfile.skills.join(", ")} context="onboarding" />
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            {profile.skills.map((skill) => (
              <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-sm text-primary/80">
                {skill}
                <button onClick={() => setProfile((p) => ({ ...p, skills: p.skills.filter((s) => s !== skill) }))} className="ml-0.5 text-primary hover:text-primary/80 cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag(newSkill, profile.skills, (v) => setProfile((p) => ({ ...p, skills: v })), setNewSkill)}
              placeholder={tProfile("skills") + "..."}
              className="max-w-64"
            />
            <Button variant="outline" size="md" onClick={() => addTag(newSkill, profile.skills, (v) => setProfile((p) => ({ ...p, skills: v })), setNewSkill)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Languages */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-muted-foreground">{tProfile("languages")}</label>
            <div className="flex items-center gap-1.5">
              {aiOriginalProfile && profile.languages.join(",") !== aiOriginalProfile.languages.join(",") && (
                <span className="text-xs text-amber-400 flex items-center gap-1"><Pencil className="h-3 w-3" /> {tEdit("edited")}</span>
              )}
              {aiOriginalProfile && profile.languages.join(",") === aiOriginalProfile.languages.join(",") && aiOriginalProfile.languages.length > 0 && (
                <span className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> {tEdit("kept")}</span>
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
                  onClick={() => setProfile((p) => ({ ...p, languages: p.languages.filter((l) => l !== lang) }))}
                  className={`ml-0.5 hover:text-primary/80 cursor-pointer ${isRussianLanguage(lang) ? "text-red-400" : "text-purple-400"}`}
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
              onKeyDown={(e) => e.key === "Enter" && addTag(normalizeLanguageEntry(newLanguage), profile.languages, (v) => setProfile((p) => ({ ...p, languages: v })), setNewLanguage)}
              placeholder="e.g. English (Professional)"
              className="max-w-64"
            />
            <Button variant="outline" size="md" onClick={() => addTag(normalizeLanguageEntry(newLanguage), profile.languages, (v) => setProfile((p) => ({ ...p, languages: v })), setNewLanguage)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Preferred Locations */}
        <div>
          <label className="block text-sm text-muted-foreground mb-1.5">Preferred Locations</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {profile.preferredLocations.map((loc) => (
              <span key={loc} className="inline-flex items-center gap-1 rounded-full bg-indigo-900/40 border border-indigo-700/40 px-3 py-1 text-sm text-indigo-300">
                {loc}
                <button onClick={() => setProfile((p) => ({ ...p, preferredLocations: p.preferredLocations.filter((l) => l !== loc) }))} className="ml-0.5 text-indigo-400 hover:text-primary/80 cursor-pointer">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag(newLocation, profile.preferredLocations, (v) => setProfile((p) => ({ ...p, preferredLocations: v })), setNewLocation)}
              placeholder="e.g. Remote, EU, Spain"
              className="max-w-64"
            />
            <Button variant="outline" size="md" onClick={() => addTag(newLocation, profile.preferredLocations, (v) => setProfile((p) => ({ ...p, preferredLocations: v })), setNewLocation)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Remote + Employment types */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{tSearches("remote_only")}</label>
            <select
              value={profile.preferredRemoteType}
              onChange={(e) => setProfile((p) => ({ ...p, preferredRemoteType: e.target.value }))}
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
            >
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{tSearches("employment_types")}</label>
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
          <label className="block text-sm text-muted-foreground mb-1.5">{tProfile("portfolio")}</label>
          <div className="space-y-1.5 mb-2">
            {profile.portfolioUrls.map((url) => (
              <div key={url} className="flex items-center gap-2 text-sm">
                <span className="text-foreground/80 truncate flex-1">{url}</span>
                <button onClick={() => setProfile((p) => ({ ...p, portfolioUrls: p.portfolioUrls.filter((u) => u !== url) }))} className="text-muted-foreground hover:text-foreground cursor-pointer">
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
              onKeyDown={(e) => e.key === "Enter" && addTag(newPortfolioUrl, profile.portfolioUrls, (v) => setProfile((p) => ({ ...p, portfolioUrls: v })), setNewPortfolioUrl)}
              placeholder="https://github.com/username"
              className="flex-1"
            />
            <Button variant="outline" size="md" onClick={() => addTag(newPortfolioUrl, profile.portfolioUrls, (v) => setProfile((p) => ({ ...p, portfolioUrls: v })), setNewPortfolioUrl)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
