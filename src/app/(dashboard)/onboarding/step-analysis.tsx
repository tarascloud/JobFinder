"use client";

import { useTranslations } from "next-intl";
import {
  Loader2,
  Check,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ANALYSIS_MESSAGES } from "./types";

interface StepAnalysisProps {
  analysisMessageIndex: number;
  analysisError: string;
  onBack: () => void;
}

export default function StepAnalysis({
  analysisMessageIndex,
  analysisError,
  onBack,
}: StepAnalysisProps) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");

  return (
    <Card>
      <CardContent className="p-8">
        <div className="text-center space-y-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Loader2 className="h-7 w-7 text-amber-400 animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{t("analyzing_title")}</h2>
            <p className="text-muted-foreground">{t("analyzing_description")}</p>
          </div>

          {/* Animated progress messages */}
          <div className="space-y-3 py-4">
            {ANALYSIS_MESSAGES.map((msgKey, idx) => (
              <div
                key={msgKey}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-500 ${
                  idx < analysisMessageIndex
                    ? "bg-green-900/20 border border-green-700/30"
                    : idx === analysisMessageIndex
                    ? "bg-amber-900/20 border border-amber-700/30"
                    : "bg-muted/30 border border-transparent"
                }`}
              >
                {idx < analysisMessageIndex ? (
                  <Check className="h-4 w-4 text-green-400 shrink-0" />
                ) : idx === analysisMessageIndex ? (
                  <Loader2 className="h-4 w-4 text-amber-400 animate-spin shrink-0" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    idx < analysisMessageIndex
                      ? "text-green-300"
                      : idx === analysisMessageIndex
                      ? "text-amber-300"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {t(msgKey)}
                </span>
              </div>
            ))}
          </div>

          {analysisError && (
            <div className="space-y-3">
              <p className="text-sm text-red-400">{analysisError}</p>
              <Button variant="outline" onClick={onBack}>
                <ChevronLeft className="h-4 w-4 mr-1" /> {tCommon("back")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
