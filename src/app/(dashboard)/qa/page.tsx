"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { MessageSquare, CheckCircle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";
import { LanguageSelector } from "@/components/shared/translate-button";
import {
  getPendingQuestions,
  getAnsweredQuestions,
  answerQuestion,
} from "@/actions/qa";
import { getQATranslation } from "@/actions/translations";

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

// Cache for translated Q&A pairs: qaId -> { lang -> { question, answer } }
type TranslationCache = Record<number, Record<string, { question: string; answer: string }>>;

export default function QAPage() {
  const t = useTranslations("qa");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [pending, setPending] = useState<QaPairData[]>([]);
  const [answered, setAnswered] = useState<QaPairData[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  // Translation state
  const [qaLangs, setQaLangs] = useState<Record<number, string>>({});
  const [qaTranslations, setQaTranslations] = useState<TranslationCache>({});
  const [translatingId, setTranslatingId] = useState<number | null>(null);

  function getDisplayLang(qaId: number): string {
    return qaLangs[qaId] || locale;
  }

  async function handleLangSwitch(qa: QaPairData, lang: string) {
    setQaLangs((prev) => ({ ...prev, [qa.id]: lang }));

    // If switching to English (original), no translation needed
    if (lang === "en") return;

    // Check cache
    if (qaTranslations[qa.id]?.[lang]) return;

    // Translate lazily
    setTranslatingId(qa.id);
    try {
      const result = await getQATranslation(
        qa.question,
        qa.answer || "",
        lang,
        "en"
      );
      setQaTranslations((prev) => ({
        ...prev,
        [qa.id]: { ...prev[qa.id], [lang]: result },
      }));
    } finally {
      setTranslatingId(null);
    }
  }

  function getDisplayText(qa: QaPairData): { question: string; answer: string | null } {
    const lang = getDisplayLang(qa.id);
    if (lang === "en") return { question: qa.question, answer: qa.answer };
    const cached = qaTranslations[qa.id]?.[lang];
    if (cached) return { question: cached.question, answer: cached.answer || qa.answer };
    return { question: qa.question, answer: qa.answer };
  }

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
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Pending */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-yellow-400" />
          {t("pending")}
          {pending.length > 0 && (
            <Badge color="yellow">{pending.length}</Badge>
          )}
        </h2>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">{t("no_pending")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pending.map((q) => (
              <Card key={q.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start gap-2">
                    <p className="font-medium text-foreground flex-1">{q.question}</p>
                    {q.source === "ai" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5 shrink-0 bg-purple-500/15 text-purple-400 border-purple-500/30">
                        <Sparkles className="h-3 w-3" />
                        {tCommon("source_ai")}
                      </Badge>
                    )}
                    {q.source === "ai_edited" && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5 shrink-0 bg-blue-500/15 text-blue-400 border-blue-500/30">
                        <Sparkles className="h-3 w-3" />
                        {tCommon("source_ai_edited")}
                      </Badge>
                    )}
                  </div>
                  {q.sourceVacancy && (
                    <p className="text-xs text-muted-foreground">
                      From: {q.sourceVacancy.title}
                      {q.sourceVacancy.company && ` @ ${q.sourceVacancy.company}`}
                    </p>
                  )}
                  <textarea
                    value={drafts[q.id] || ""}
                    onChange={(e) =>
                      setDrafts({ ...drafts, [q.id]: e.target.value })
                    }
                    placeholder={t("answer_placeholder")}
                    rows={3}
                    className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => handleSaveAnswer(q.id)}
                      disabled={!drafts[q.id]?.trim() || savingId === q.id}
                    >
                      {savingId === q.id && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      {tCommon("save")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Answered */}
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
          <div className="space-y-4">
            {answered.map((q) => {
              const display = getDisplayText(q);
              const displayLang = getDisplayLang(q.id);
              return (
                <Card key={q.id}>
                  <CardContent className="p-5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1">
                        <p className="font-medium text-foreground">{display.question}</p>
                        {(q.source === "ai" || q.source === "ai_edited") && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5 shrink-0">
                            <Sparkles className="h-3 w-3" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <LanguageSelector
                          activeLang={displayLang}
                          onSelect={(lang) => handleLangSwitch(q, lang)}
                          isLoading={translatingId === q.id}
                          availableTranslations={[
                            "en",
                            ...(qaTranslations[q.id] ? Object.keys(qaTranslations[q.id]) : []),
                          ]}
                        />
                        <Badge color="default">{t("times_used", { count: q.timesUsed })}</Badge>
                      </div>
                    </div>
                    {q.sourceVacancy && (
                      <p className="text-xs text-muted-foreground">
                        From: {q.sourceVacancy.title}
                        {q.sourceVacancy.company && ` @ ${q.sourceVacancy.company}`}
                      </p>
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-muted-foreground leading-relaxed flex-1">{display.answer}</p>
                      <AiFeedbackButtons
                        field="qa.answer"
                        content={q.answer || ""}
                        context={q.question}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
