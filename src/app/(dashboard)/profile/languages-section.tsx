"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const LANGUAGE_OPTIONS = [
  "English",
  "Ukrainian",
  "Spanish",
  "German",
  "French",
  "Portuguese",
  "Italian",
  "Polish",
  "Dutch",
  "Czech",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Japanese",
  "Chinese",
  "Korean",
  "Arabic",
  "Hindi",
  "Turkish",
  "Russian",
];

export const LANGUAGE_LEVELS = ["Native", "Fluent", "Professional", "Basic"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export interface LanguageEntry {
  language: string;
  level: LanguageLevel;
}

export function parseLanguages(raw: string[]): LanguageEntry[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((item) => {
    const match = item.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      const level = LANGUAGE_LEVELS.find(
        (l) => l.toLowerCase() === match[2].trim().toLowerCase()
      );
      return { language: match[1].trim(), level: level ?? "Professional" };
    }
    return { language: item.trim(), level: "Professional" as LanguageLevel };
  });
}

export function serializeLanguages(entries: LanguageEntry[]): string[] {
  return entries.map((e) => `${e.language} (${e.level})`);
}

function getLevelColor(level: LanguageLevel) {
  switch (level) {
    case "Native":
      return "bg-status-success/15 border-status-success/40 text-status-success";
    case "Fluent":
      return "bg-primary/15 border-primary/30 text-primary/80";
    case "Professional":
      return "bg-purple-900/40 border-purple-700/40 text-purple-300";
    case "Basic":
      return "bg-muted border-border text-foreground/80";
  }
}

interface LanguagesSectionProps {
  languageEntries: LanguageEntry[];
  setLanguageEntries: (entries: LanguageEntry[]) => void;
  hasDiffSuggestion?: boolean;
  onAcceptChange?: () => void;
}

export default function LanguagesSection({
  languageEntries,
  setLanguageEntries,
  hasDiffSuggestion,
  onAcceptChange,
}: LanguagesSectionProps) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");

  const [showLanguageAdd, setShowLanguageAdd] = useState(false);
  const [newLanguage, setNewLanguage] = useState("");
  const [newLanguageLevel, setNewLanguageLevel] = useState<LanguageLevel>("Professional");

  function addLanguage() {
    const lang = newLanguage.trim();
    if (lang && !languageEntries.find((e) => e.language === lang)) {
      setLanguageEntries([...languageEntries, { language: lang, level: newLanguageLevel }]);
      setNewLanguage("");
      setNewLanguageLevel("Professional");
      setShowLanguageAdd(false);
    }
  }

  function removeLanguage(language: string) {
    setLanguageEntries(languageEntries.filter((e) => e.language !== language));
  }

  function updateLanguageLevel(language: string, level: LanguageLevel) {
    setLanguageEntries(
      languageEntries.map((e) =>
        e.language === language ? { ...e, level } : e
      )
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("languages")}
          {hasDiffSuggestion && onAcceptChange && (
            <button
              onClick={onAcceptChange}
              className="ml-2 inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
              title={t("accept_change")}
            >
              <Sparkles className="h-3 w-3" />
              {t("new_suggestion")}
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {languageEntries.map((entry) => (
            <div
              key={entry.language}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${getLevelColor(entry.level)}`}
            >
              <span className="font-medium">{entry.language}</span>
              <select
                value={entry.level}
                onChange={(e) => updateLanguageLevel(entry.language, e.target.value as LanguageLevel)}
                className="bg-transparent border-none text-xs cursor-pointer focus:outline-none"
              >
                {LANGUAGE_LEVELS.map((level) => (
                  <option key={level} value={level} className="bg-muted text-foreground">
                    {t(`level_${level.toLowerCase()}`)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeLanguage(entry.language)}
                className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {showLanguageAdd ? (
          <div className="flex gap-2 items-center">
            <select
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">{t("select_language")}</option>
              {LANGUAGE_OPTIONS.filter(
                (l) => !languageEntries.find((e) => e.language === l)
              ).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              value={newLanguageLevel}
              onChange={(e) => setNewLanguageLevel(e.target.value as LanguageLevel)}
              className="rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {LANGUAGE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {t(`level_${level.toLowerCase()}`)}
                </option>
              ))}
            </select>
            <Button variant="outline" size="md" onClick={addLanguage} disabled={!newLanguage}>
              <Plus className="h-4 w-4 mr-1" /> {tCommon("save")}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setShowLanguageAdd(false)}>
              {tCommon("cancel")}
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowLanguageAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t("add_language")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
