"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AiFeedbackButtons from "@/components/shared/ai-feedback-buttons";

interface Question {
  id: string;
  question: string;
  answer: string;
  timesUsed: number;
}

const initialPending: Question[] = [
  { id: "1", question: "Why do you want to work at our company?", answer: "", timesUsed: 0 },
  { id: "2", question: "Describe a challenging project you led.", answer: "", timesUsed: 0 },
  { id: "3", question: "What is your experience with microservices?", answer: "", timesUsed: 0 },
];

const initialAnswered: Question[] = [
  {
    id: "4",
    question: "Tell me about yourself.",
    answer:
      "I'm a senior frontend engineer with 8+ years of experience building scalable web applications. I specialize in React, TypeScript, and modern frontend architecture.",
    timesUsed: 12,
  },
  {
    id: "5",
    question: "What are your salary expectations?",
    answer:
      "Based on my experience and the market, I'm targeting 140-180k EUR depending on the total compensation package and company stage.",
    timesUsed: 8,
  },
  {
    id: "6",
    question: "Why are you looking for a new role?",
    answer:
      "I'm seeking a role where I can have greater technical impact and work on products that push the boundaries of web technology.",
    timesUsed: 6,
  },
];

export default function QAPage() {
  const t = useTranslations("qa");
  const tCommon = useTranslations("common");
  const [pending, setPending] = useState(initialPending);
  const [answered, setAnswered] = useState(initialAnswered);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function handleSaveAnswer(id: string) {
    const answer = drafts[id];
    if (!answer?.trim()) return;

    const question = pending.find((q) => q.id === id);
    if (!question) return;

    setPending(pending.filter((q) => q.id !== id));
    setAnswered([{ ...question, answer, timesUsed: 0 }, ...answered]);
    setDrafts((d) => {
      const copy = { ...d };
      delete copy[id];
      return copy;
    });
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
                  <p className="font-medium text-foreground">{q.question}</p>
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
                      disabled={!drafts[q.id]?.trim()}
                    >
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
            {answered.map((q) => (
              <Card key={q.id}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">{q.question}</p>
                    <Badge color="default">{t("times_used", { count: q.timesUsed })}</Badge>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">{q.answer}</p>
                    <AiFeedbackButtons
                      field="qa.answer"
                      content={q.answer}
                      context={q.question}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
