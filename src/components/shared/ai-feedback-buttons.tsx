"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { submitAiFeedback } from "@/actions/ai-feedback";

interface AiFeedbackButtonsProps {
  field: string;
  content: string;
  context?: string;
}

export default function AiFeedbackButtons({
  field,
  content,
  context,
}: AiFeedbackButtonsProps) {
  const t = useTranslations("ai_feedback");
  const [rating, setRating] = useState<"like" | "dislike" | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleRate(value: "like" | "dislike") {
    if (submitted) return;

    if (value === "dislike") {
      setRating(value);
      setShowComment(true);
      return;
    }

    setRating(value);
    setSubmitted(true);
    await submitAiFeedback({ field, content, context, rating: value });
  }

  async function handleSubmitDislike() {
    setSubmitted(true);
    setShowComment(false);
    await submitAiFeedback({
      field,
      content,
      context,
      rating: "dislike",
      comment: comment.trim() || undefined,
    });
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        onClick={() => handleRate("like")}
        disabled={submitted}
        className={`p-1 rounded transition-colors cursor-pointer ${
          rating === "like"
            ? "text-green-400"
            : submitted
              ? "text-muted-foreground/30 cursor-default"
              : "text-muted-foreground/50 hover:text-green-400"
        }`}
        title={t("like")}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => handleRate("dislike")}
        disabled={submitted}
        className={`p-1 rounded transition-colors cursor-pointer ${
          rating === "dislike"
            ? "text-red-400"
            : submitted
              ? "text-muted-foreground/30 cursor-default"
              : "text-muted-foreground/50 hover:text-red-400"
        }`}
        title={t("dislike")}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>

      {showComment && !submitted && (
        <div className="flex items-center gap-1.5 ml-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("comment_placeholder")}
            className="h-7 w-48 rounded border border-input bg-muted px-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleSubmitDislike()}
          />
          <button
            onClick={handleSubmitDislike}
            className="h-7 px-2 rounded bg-red-900/40 border border-red-700/40 text-red-300 text-xs hover:bg-red-900/60 transition-colors cursor-pointer"
          >
            {t("send")}
          </button>
        </div>
      )}

      {submitted && (
        <span className="text-xs text-muted-foreground/60 ml-1">
          {t("thanks")}
        </span>
      )}
    </div>
  );
}
