"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

export async function trackAIEdit(data: {
  field: string; // "profile.headline", "search.0.jobTitles", "qa.0.answer"
  originalAI: string; // what AI generated
  userEdited: string; // what user changed it to
  accepted: boolean; // true if user kept AI version, false if edited
}) {
  try {
    const user = await requireUser();
    if (user.id === 0) return { error: "Demo mode" };

    const feedback = await prisma.aiFeedback.create({
      data: {
        userId: user.id,
        field: data.field,
        context: data.originalAI,
        content: data.userEdited,
        rating: data.accepted ? "accept" : "edit",
        comment: data.accepted
          ? null
          : `Original: ${data.originalAI.substring(0, 500)}`,
      },
    });

    return { feedback };
  } catch {
    return { error: "Failed to track edit" };
  }
}

export async function trackAIEditsBatch(
  edits: {
    field: string;
    originalAI: string;
    userEdited: string;
    accepted: boolean;
  }[]
) {
  try {
    const user = await requireUser();
    if (user.id === 0) return { error: "Demo mode" };

    const data = edits.map((edit) => ({
      userId: user.id,
      field: edit.field,
      context: edit.originalAI,
      content: edit.userEdited,
      rating: edit.accepted ? "accept" : "edit",
      comment: edit.accepted
        ? null
        : `Original: ${edit.originalAI.substring(0, 500)}`,
    }));

    await prisma.aiFeedback.createMany({ data });

    return { tracked: edits.length };
  } catch {
    return { error: "Failed to track edits" };
  }
}

export async function getEditTrackingStats() {
  try {
    const user = await requireUser();
    if (user.id === 0) {
      return { totalFields: 0, acceptedAsIs: 0, edited: 0, editRate: 0 };
    }

    const all = await prisma.aiFeedback.findMany({
      where: {
        userId: user.id,
        rating: { in: ["accept", "edit"] },
      },
      select: { rating: true },
    });

    const totalFields = all.length;
    const acceptedAsIs = all.filter((f) => f.rating === "accept").length;
    const edited = all.filter((f) => f.rating === "edit").length;
    const editRate =
      totalFields > 0 ? Math.round((edited / totalFields) * 100) : 0;

    return { totalFields, acceptedAsIs, edited, editRate };
  } catch {
    return { error: "Failed to fetch edit stats" };
  }
}
