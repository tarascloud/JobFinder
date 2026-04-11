"use client";

import { useTranslations } from "next-intl";
import { Plus, Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import type { AnalyzedQaPair } from "./types";

interface ReviewQaTabProps {
  qaPairs: AnalyzedQaPair[];
  setQaPairs: React.Dispatch<React.SetStateAction<AnalyzedQaPair[]>>;
  aiOriginalQaPairs: AnalyzedQaPair[] | null;
}

export function ReviewQaTab({ qaPairs, setQaPairs, aiOriginalQaPairs }: ReviewQaTabProps) {
  const t = useTranslations("onboarding");

  function updateQaPair(index: number, field: "question" | "answer", value: string) {
    setQaPairs((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  }

  function removeQaPair(index: number) {
    setQaPairs((prev) => prev.filter((_, i) => i !== index));
  }

  function addQaPair() {
    setQaPairs((prev) => [...prev, { question: "", answer: "" }]);
  }

  return (
    <div className="space-y-3">
      {qaPairs.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">{t("no_qa_generated")}</CardContent>
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
                      <span className="text-xs text-amber-400 flex items-center gap-1"><Pencil className="h-3 w-3" /></span>
                    )}
                    {pair.answer === aiOriginalQaPairs[idx].answer && aiOriginalQaPairs[idx].answer && (
                      <span className="text-xs text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /></span>
                    )}
                    <AiFeedbackButtons field={`qa.${idx}.answer`} content={aiOriginalQaPairs[idx].answer} context={pair.question} />
                  </>
                )}
                <Button variant="ghost" size="sm" onClick={() => removeQaPair(idx)}>
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
  );
}
