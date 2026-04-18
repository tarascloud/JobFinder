"use client";

import { useState } from "react";
import { Loader2, Languages } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTranslation } from "@/actions/translations";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { VacancyDetail } from "./types";

interface VacancyDescriptionProps {
  vacancy: VacancyDetail;
  locale: string;
  tTranslations: (key: string, params?: Record<string, string>) => string;
  onDescriptionFetched: (description: string) => void;
}

export function VacancyDescription({ vacancy, locale, tTranslations, onDescriptionFetched }: VacancyDescriptionProps) {
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [isTranslatingDesc, setIsTranslatingDesc] = useState(false);
  const [showTranslatedDesc, setShowTranslatedDesc] = useState(false);

  async function handleTranslateDescription() {
    if (translatedDescription) {
      setShowTranslatedDesc(!showTranslatedDesc);
      return;
    }
    setIsTranslatingDesc(true);
    try {
      const fromLang = vacancy.language || "en";
      const result = await getTranslation(vacancy.description, locale, fromLang);
      setTranslatedDescription(result);
      setShowTranslatedDesc(true);
    } finally {
      setIsTranslatingDesc(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        {locale !== (vacancy.language || "en") && (
          <div className="flex items-center justify-end mb-3">
            <button
              onClick={handleTranslateDescription}
              disabled={isTranslatingDesc}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              {isTranslatingDesc ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Languages className="h-3 w-3" />
              )}
              {isTranslatingDesc
                ? tTranslations("translating")
                : showTranslatedDesc
                ? tTranslations("show_english")
                : tTranslations("translate_to", {
                    language: tTranslations(locale as "en" | "uk" | "es"),
                  })}
            </button>
          </div>
        )}
        {vacancy.description && vacancy.description.length > 10 ? (
          <div
            className="prose prose-invert prose-sm max-w-none text-foreground/80"
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(
                showTranslatedDesc && translatedDescription
                  ? translatedDescription
                  : vacancy.description
              ),
            }}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-3">No description available</p>
            <Button
              variant="outline"
              onClick={async () => {
                const { fetchVacancyDescription } = await import("@/actions/fetch-description");
                const result = await fetchVacancyDescription(vacancy.id);
                if ("description" in result) {
                  onDescriptionFetched(result.description);
                }
              }}
            >
              Fetch Description from Source
            </Button>
            <a href={vacancy.url} target="_blank" rel="noopener noreferrer" className="block mt-2 text-sm text-primary hover:underline">
              Open original listing →
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
