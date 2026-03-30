"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";

export async function getPendingQuestions() {
  try {
    const user = await requireUser();

    const questions = await prisma.qaPair.findMany({
      where: {
        userId: user.id,
        answer: null,
      },
      include: {
        sourceVacancy: {
          select: {
            id: true,
            title: true,
            company: true,
            platform: true,
          },
        },
      },
      orderBy: { id: "asc" },
    });

    return questions;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load pending questions" };
  }
}

interface AnsweredQuestionsFilters {
  page?: number;
  limit?: number;
}

export async function getAnsweredQuestions(
  page?: number,
  limit?: number
) {
  try {
    const user = await requireUser();

    const actualPage = page ?? 1;
    const actualLimit = limit ?? 20;
    const skip = (actualPage - 1) * actualLimit;

    const where = {
      userId: user.id,
      answer: { not: null as string | null },
    };

    const [questions, total] = await Promise.all([
      prisma.qaPair.findMany({
        where,
        include: {
          sourceVacancy: {
            select: {
              id: true,
              title: true,
              company: true,
              platform: true,
            },
          },
        },
        orderBy: { answeredAt: "desc" },
        skip,
        take: actualLimit,
      }),
      prisma.qaPair.count({ where }),
    ]);

    return {
      questions,
      total,
      page: actualPage,
      limit: actualLimit,
      totalPages: Math.ceil(total / actualLimit),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load answered questions" };
  }
}

export async function answerQuestion(id: number, answer: string) {
  try {
    const user = await requireUser();

    const existing = await prisma.qaPair.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return { error: "Question not found" };

    if (!answer.trim()) return { error: "Answer cannot be empty" };

    // If editing an AI-created answer, mark as ai_edited and clear confidence
    const isAiEdit = existing.source === "ai" || existing.source === "ai_edited";
    const sourceUpdate = existing.source === "ai" ? { source: "ai_edited" as const } : {};
    const confidenceUpdate = isAiEdit ? { aiConfidence: null } : {};

    const qaPair = await prisma.qaPair.update({
      where: { id },
      data: {
        answer: answer.trim(),
        answeredAt: new Date(),
        ...sourceUpdate,
        ...confidenceUpdate,
      },
    });

    return qaPair;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save answer" };
  }
}

/**
 * Use AI to generate an answer for a pending question.
 * Returns the answer with a confidence score (0-100).
 * - score >= 80: high confidence (green)
 * - score 50-79: medium confidence (yellow), needs review
 * - score < 50: low confidence (red), needs review
 */
export async function autoAnswerQuestion(id: number) {
  try {
    const user = await requireUser();

    const qaPair = await prisma.qaPair.findFirst({
      where: { id, userId: user.id },
    });
    if (!qaPair) return { error: "Question not found" };

    // Load user profile for context
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    const profileContext = profile
      ? `Candidate: ${profile.headline ?? "Software Engineer"}, ${profile.yearsExperience ?? "?"} years experience. Skills: ${(profile.skills as string[]).slice(0, 10).join(", ")}. Location: ${(profile.preferredLocations as string[]).join(", ")}. Salary: ${profile.salaryMin ? profile.salaryMin + " " + profile.salaryCurrency : "negotiable"}.`
      : "Candidate profile not available.";

    const prompt = `You are answering a LinkedIn Easy Apply screening question for a job candidate. Answer must be SHORT (1 word or 1 number when possible).

${profileContext}

Question: "${qaPair.question}"

Respond with JSON: { "answer": "your short answer", "confidence": 0-100 }
- "answer": the best SHORT answer for this candidate (1 word, 1 number, or very brief phrase)
- "confidence": integer 0-100 how confident you are this answer is correct and appropriate:
  - 80-100: you have high confidence — clear question, answer is definitive from profile data
  - 50-79: moderate confidence — answer is reasonable but may need human review
  - 0-49: low confidence — question is ambiguous, profile data insufficient, or answer is a guess`;

    const result = await callAIJSON<{ answer: string; confidence: number }>(
      prompt,
      { userId: user.id }
    );

    const answer = result.answer?.trim();
    const confidence = Math.max(0, Math.min(100, Math.round(result.confidence ?? 0)));

    if (!answer) return { error: "AI did not provide an answer" };

    // Persist the AI answer with confidence score
    const updated = await prisma.qaPair.update({
      where: { id },
      data: {
        answer,
        answeredAt: new Date(),
        source: "ai",
        aiConfidence: confidence,
      },
    });

    return { qaPair: updated, answer, confidence };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to auto-answer question" };
  }
}

export async function getQaStats() {
  try {
    const user = await requireUser();

    const [total, pending, answered] = await Promise.all([
      prisma.qaPair.count({ where: { userId: user.id } }),
      prisma.qaPair.count({ where: { userId: user.id, answer: null } }),
      prisma.qaPair.count({
        where: { userId: user.id, answer: { not: null } },
      }),
    ]);

    return { total, pending, answered };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load QA stats" };
  }
}
