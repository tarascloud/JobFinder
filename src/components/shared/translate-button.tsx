"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TranslateButtonProps {
  /** The original text to translate */
  originalText: string;
  /** Callback with translated text */
  onTranslated: (translated: string) => void;
  /** Translation server action to call */
  translateAction: (text: string, targetLang: string, fromLang?: string) => Promise<string>;
  /** Source language (defaults to "en") */
  fromLang?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg" | "icon";
  /** Additional className */
  className?: string;
}

/**
 * A button that translates text to the user's interface language.
 * Shows "Translate to {lang}" when not yet translated, and toggles between original/translated.
 */
export function TranslateButton({
  originalText,
  onTranslated,
  translateAction,
  fromLang = "en",
  size = "sm",
  className,
}: TranslateButtonProps) {
  const locale = useLocale();
  const t = useTranslations("translations");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);

  // Don't show button if user's locale matches source language
  if (locale === fromLang) return null;

  async function handleTranslate() {
    if (translated) {
      // Toggle between original and translated
      if (showTranslated) {
        setShowTranslated(false);
        onTranslated(originalText);
      } else {
        setShowTranslated(true);
        onTranslated(translated);
      }
      return;
    }

    setIsTranslating(true);
    try {
      const result = await translateAction(originalText, locale, fromLang);
      setTranslated(result);
      setShowTranslated(true);
      onTranslated(result);
    } catch {
      // Silently fail, keep original
    } finally {
      setIsTranslating(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={handleTranslate}
      disabled={isTranslating}
      className={className}
    >
      {isTranslating ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="ml-1 text-xs">{t("translating")}</span>
        </>
      ) : showTranslated ? (
        <>
          <Languages className="h-3 w-3" />
          <span className="ml-1 text-xs">{t("show_english")}</span>
        </>
      ) : (
        <>
          <Languages className="h-3 w-3" />
          <span className="ml-1 text-xs">
            {t("translate_to", { language: t(locale as "en" | "uk" | "es") })}
          </span>
        </>
      )}
    </Button>
  );
}

/**
 * Inline language toggle for Q&A pairs: EN | UA | ES
 * Shows the active language highlighted.
 */
interface LanguageSelectorProps {
  activeLang: string;
  onSelect: (lang: string) => void;
  isLoading?: boolean;
  availableTranslations?: string[];
}

export function LanguageSelector({
  activeLang,
  onSelect,
  isLoading,
  availableTranslations = [],
}: LanguageSelectorProps) {
  const locale = useLocale();
  const langs = ["en", locale === "en" ? null : locale].filter(Boolean) as string[];
  // Only show unique langs
  const uniqueLangs = [...new Set(langs)];
  if (uniqueLangs.length <= 1) return null;

  const labels: Record<string, string> = { en: "EN", uk: "UA", es: "ES" };

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md bg-muted p-0.5">
      {uniqueLangs.map((lang) => (
        <button
          key={lang}
          onClick={() => onSelect(lang)}
          disabled={isLoading}
          className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
            activeLang === lang
              ? "bg-primary text-primary-foreground"
              : availableTranslations.includes(lang)
              ? "text-foreground hover:bg-accent"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          {labels[lang] || lang.toUpperCase()}
        </button>
      ))}
      {isLoading && <Loader2 className="h-3 w-3 animate-spin ml-1 text-muted-foreground" />}
    </div>
  );
}
