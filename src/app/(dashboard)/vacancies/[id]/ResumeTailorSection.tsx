"use client";

import { Loader2, FileEdit, Check, X, Plus, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TailorData } from "./vacancy-types";

interface ResumeTailorSectionProps {
  tailorData: TailorData | null;
  isTailoring: boolean;
  onTailor: () => void;
  acceptedSuggestions: Set<number>;
  rejectedSuggestions: Set<number>;
  onAccept: (index: number) => void;
  onReject: (index: number) => void;
  tTailor: (key: string) => string;
}

export function ResumeTailorSection({
  tailorData,
  isTailoring,
  onTailor,
  acceptedSuggestions,
  rejectedSuggestions,
  onAccept,
  onReject,
  tTailor,
}: ResumeTailorSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <FileEdit className="h-4 w-4" />
          {tTailor("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tailorData ? (
          <div className="space-y-4">
            {/* Tailored Summary */}
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                {tTailor("tailored_summary")}
              </span>
              <p className="text-sm text-foreground/80 mt-1 whitespace-pre-line">
                {tailorData.tailoredSummary}
              </p>
            </div>

            {/* Keywords to Add */}
            {tailorData.keywordsToAdd.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  {tTailor("keywords_add")}
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tailorData.keywordsToAdd.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs bg-green-900/30 text-green-300 px-2 py-0.5 rounded"
                    >
                      <Plus className="h-3 w-3" />
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords to Remove */}
            {tailorData.keywordsToRemove.length > 0 && (
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  {tTailor("keywords_remove")}
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tailorData.keywordsToRemove.map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs bg-red-900/30 text-red-300 px-2 py-0.5 rounded"
                    >
                      <Minus className="h-3 w-3" />
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {tailorData.suggestions.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-medium text-muted-foreground">
                  {tTailor("suggestions")}
                </span>
                {tailorData.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className={`border rounded-lg p-3 text-sm space-y-2 ${
                      acceptedSuggestions.has(i)
                        ? "border-green-700 bg-green-900/10"
                        : rejectedSuggestions.has(i)
                        ? "border-red-700 bg-red-900/10 opacity-50"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Badge color="blue">{s.section}</Badge>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onAccept(i)}
                          className="p-1 rounded hover:bg-green-900/30 text-green-400 transition-colors"
                          title={tTailor("accept")}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onReject(i)}
                          className="p-1 rounded hover:bg-red-900/30 text-red-400 transition-colors"
                          title={tTailor("reject")}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">{tTailor("original")}:</span>{" "}
                      <span className="line-through">{s.original}</span>
                    </div>
                    <div className="text-xs text-foreground/80">
                      <span className="font-medium">{tTailor("suggested")}:</span>{" "}
                      {s.suggested}
                    </div>
                    <p className="text-xs text-muted-foreground italic">
                      {s.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2"
              onClick={onTailor}
              disabled={isTailoring}
            >
              {isTailoring ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <FileEdit className="h-3 w-3" />
              )}
              {tTailor("regenerate")}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onTailor}
            disabled={isTailoring}
          >
            {isTailoring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {tTailor("tailoring")}
              </>
            ) : (
              <>
                <FileEdit className="h-4 w-4" />
                {tTailor("tailor_button")}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
