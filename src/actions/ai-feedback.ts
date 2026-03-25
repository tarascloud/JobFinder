"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

export async function submitAiFeedback(data: {
  field: string;
  context?: string;
  content: string;
  rating: "like" | "dislike";
  comment?: string;
}) {
  try {
    const user = await requireUser();
    if (user.id === 0) return { error: "Demo mode" };

    const feedback = await prisma.aiFeedback.create({
      data: {
        userId: user.id,
        field: data.field,
        context: data.context || null,
        content: data.content,
        rating: data.rating,
        comment: data.comment || null,
      },
    });

    return { feedback };
  } catch {
    return { error: "Failed to submit feedback" };
  }
}

export async function getAiFeedbackStats() {
  try {
    const user = await requireUser();
    if (user.id === 0) {
      return {
        totalLikes: 0,
        totalDislikes: 0,
        byField: [],
      };
    }

    const all = await prisma.aiFeedback.findMany({
      where: { userId: user.id },
      select: { field: true, rating: true },
    });

    const totalLikes = all.filter((f) => f.rating === "like").length;
    const totalDislikes = all.filter((f) => f.rating === "dislike").length;

    const fieldMap = new Map<string, { likes: number; dislikes: number }>();
    for (const item of all) {
      const current = fieldMap.get(item.field) || { likes: 0, dislikes: 0 };
      if (item.rating === "like") current.likes++;
      else current.dislikes++;
      fieldMap.set(item.field, current);
    }

    const byField = Array.from(fieldMap.entries()).map(([field, counts]) => ({
      field,
      likes: counts.likes,
      dislikes: counts.dislikes,
    }));

    return { totalLikes, totalDislikes, byField };
  } catch {
    return { error: "Failed to fetch stats" };
  }
}

export async function getRecentFeedback(limit: number = 20) {
  try {
    const user = await requireUser();
    if (user.id === 0) return { feedback: [] };

    const feedback = await prisma.aiFeedback.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { feedback };
  } catch {
    return { error: "Failed to fetch feedback" };
  }
}
