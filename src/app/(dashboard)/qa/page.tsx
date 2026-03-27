"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  MessageSquare,
  CheckCircle,
  Sparkles,
  Loader2,
  Plus,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getPendingQuestions,
  getAnsweredQuestions,
  answerQuestion,
} from "@/actions/qa";
import { generateMoreQA } from "@/actions/qa-generator";

interface QaPairData {
  id: number;
  question: string;
  answer: string | null;
  timesUsed: number;
  category: string | null;
  source: string;
  sourceVacancy?: {
    id: number;
    title: string;
    company: string | null;
    platform: string;
  } | null;
}

export default function QAPage() {
  const t = useTranslations("qa");
  const tCommon = useTranslations("common");

  const [pending, setPending] = useState<QaPairData[]>([]);
  const [answered, setAnswered] = useState<QaPairData[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [generating, setGenerating] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [pendingResult, answeredResult] = await Promise.all([
        getPendingQuestions(),
        getAnsweredQuestions(),
      ]);

      if (Array.isArray(pendingResult)) {
        setPending(pendingResult as QaPairData[]);
      }
      if (answeredResult && "questions" in answeredResult) {
        setAnswered(answeredResult.questions as QaPairData[]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveAnswer(id: number) {
    const answer = drafts[id];
    if (!answer?.trim()) return;
    setSavingId(id);
    try {
      const result = await answerQuestion(id, answer);
      if (result && !("error" in result)) {
        await loadData();
        setDrafts((d) => {
          const copy = { ...d };
          delete copy[id];
          return copy;
        });
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleInlineEdit(id: number) {
    if (!editValue.trim()) return;
    setSavingId(id);
    try {
      const result = await answerQuestion(id, editValue);
      if (result && !("error" in result)) {
        setEditingId(null);
        setEditValue("");
        await loadData();
      }
    } finally {
      setSavingId(null);
    }
  }

  function startEditing(qa: QaPairData) {
    setEditingId(qa.id);
    setEditValue(qa.answer || "");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditValue("");
  }

  async function handleGenerateMore() {
    setGenerating(true);
    try {
      const result = await generateMoreQA("linkedin_apply", 5);
      if ("qaPairs" in result && result.qaPairs.length > 0) {
        await loadData();
      }
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 max-w-3xl">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateMore}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          ) : (
            <Plus className="h-3 w-3 mr-1.5" />
          )}
          {t("generate_more")}
        </Button>
      </div>

      {/* Pending — questions without answers */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-yellow-400" />
            {t("pending")}
            <Badge color="yellow">{pending.length}</Badge>
          </h2>

          <div className="space-y-3">
            {pending.map((q) => (
              <Card key={q.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <p className="font-medium text-foreground text-sm flex-1">
                      {q.question}
                    </p>
                    {q.source === "ai" && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 flex items-center gap-0.5 bg-purple-500/15 text-purple-400 border-purple-500/30 shrink-0"
                      >
                        <Sparkles className="h-3 w-3" />
                        AI
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={drafts[q.id] || ""}
                      onChange={(e) =>
                        setDrafts({ ...drafts, [q.id]: e.target.value })
                      }
                      placeholder={t("answer_placeholder")}
                      className="flex-1 rounded-md border border-input bg-muted px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveAnswer(q.id);
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveAnswer(q.id)}
                      disabled={!drafts[q.id]?.trim() || savingId === q.id}
                    >
                      {savingId === q.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Answered — simple table */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-400" />
          {t("answered")}
          {answered.length > 0 && (
            <Badge color="green">{answered.length}</Badge>
          )}
        </h2>

        {answered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{t("no_answered")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                    {t("col_question")}
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-48">
                    {t("col_answer")}
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {answered.map((qa) => (
                  <tr
                    key={qa.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{qa.question}</span>
                        {(qa.source === "ai" || qa.source === "ai_edited") && (
                          <Sparkles className="h-3 w-3 text-purple-400 shrink-0" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {editingId === qa.id ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleInlineEdit(qa.id);
                              if (e.key === "Escape") cancelEditing();
                            }}
                          />
                          <button
                            onClick={() => handleInlineEdit(qa.id)}
                            disabled={savingId === qa.id}
                            className="p-1 text-green-400 hover:text-green-300"
                          >
                            {savingId === qa.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs">
                          {qa.answer}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      {editingId !== qa.id && (
                        <button
                          onClick={() => startEditing(qa)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
