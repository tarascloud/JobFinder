"use client";

import { Loader2, CheckCircle2, Sparkles, Languages } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CoverLetterSectionProps {
  coverLetter: string;
  onCoverLetterChange: (val: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  locale: string;
  translatedCoverLetter: string | null;
  isTranslatingCL: boolean;
  showTranslatedCL: boolean;
  onTranslate: () => void;
  tq: (key: string) => string;
  tTranslations: (key: string, params?: Record<string, string>) => string;
}

export function CoverLetterSection({
  coverLetter,
  onCoverLetterChange,
  onGenerate,
  isGenerating,
  locale,
  translatedCoverLetter,
  isTranslatingCL,
  showTranslatedCL,
  onTranslate,
  tq,
  tTranslations,
}: CoverLetterSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{tq("cover_letter")}</CardTitle>
          {coverLetter && locale !== "en" && (
            <button
              onClick={onTranslate}
              disabled={isTranslatingCL}
              className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              {isTranslatingCL ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Languages className="h-3 w-3" />
              )}
              {showTranslatedCL
                ? tTranslations("show_english")
                : tTranslations("show_translated")}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={showTranslatedCL && translatedCoverLetter ? translatedCoverLetter : coverLetter}
          onChange={(e) => onCoverLetterChange(e.target.value)}
          rows={10}
          placeholder={tq("generating_cover_letter")}
          className="mb-3"
          readOnly={showTranslatedCL}
        />
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {tq("generating_cover_letter")}
            </>
          ) : (
            <>
              {coverLetter ? (
                <><CheckCircle2 className="h-4 w-4" />{tq("edit_cover_letter")}</>
              ) : (
                <><Sparkles className="h-4 w-4" />Generate Cover Letter</>
              )}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
