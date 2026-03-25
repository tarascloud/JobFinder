"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

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

    const qaPair = await prisma.qaPair.update({
      where: { id },
      data: {
        answer: answer.trim(),
        answeredAt: new Date(),
      },
    });

    return qaPair;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save answer" };
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
