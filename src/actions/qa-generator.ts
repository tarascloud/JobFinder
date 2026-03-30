"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

interface GeneratedQaPair {
  question: string;
  answer: string;
  category: string;
  confidence?: number;
}

export async function generateMoreQA(
  _category?: string,
  count: number = 5
): Promise<{ qaPairs: GeneratedQaPair[] } | { error: string }> {
  try {
    const user = await requireUser();

    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return { error: "Profile not found. Please complete your profile first." };
    }

    // Get existing Q&A to avoid duplicates
    const existingQa = await prisma.qaPair.findMany({
      where: { userId: user.id },
      select: { question: true },
    });
    const existingQuestions = existingQa.map((q) => q.question).join("\n- ");

    const { callAIJSON } = await import("@/lib/ai/provider");

    const topSkills = (profile.skills as string[]).slice(0, 15).join(", ");

    const result = await callAIJSON<{ qaPairs: GeneratedQaPair[] }>(
      `Generate exactly ${count} NEW LinkedIn Easy Apply screening questions for this candidate. SHORT answers only (1 word or 1 number).

Candidate: ${profile.headline}, ${profile.yearsExperience} years. Skills: ${topSkills}. Location: ${(profile.preferredLocations as string[]).join(", ")}. Salary: ${profile.salaryMin ? profile.salaryMin + " " + profile.salaryCurrency : "negotiable"}

Types of questions to generate:
- How many years of experience do you have with [technology]?
- Are you comfortable working in [timezone/location]?
- What is your proficiency in [language]?
- Do you have experience with [specific tool/framework]?
- Have you completed [certification]?
- Are you willing to work [schedule type]?
- Can you start within [timeframe]?

DO NOT repeat these existing questions:
- ${existingQuestions || "none yet"}

Return ONLY JSON: {"qaPairs":[{"question":"...","answer":"...short...","category":"linkedin_apply","confidence":0-100}]}
- "confidence": integer 0-100 how confident you are the answer is correct for this candidate (80-100 clear, 50-79 reasonable, 0-49 uncertain)`,
      { userId: user.id }
    );

    const qaPairs = result?.qaPairs || [];

    // Save to database
    const existingSet = new Set(existingQa.map((q) => q.question));
    for (const qa of qaPairs) {
      if (existingSet.has(qa.question)) continue;
      const confidence =
        typeof qa.confidence === "number"
          ? Math.max(0, Math.min(100, Math.round(qa.confidence)))
          : null;
      await prisma.qaPair.create({
        data: {
          userId: user.id,
          question: qa.question,
          answer: qa.answer,
          category: "linkedin_apply",
          answeredAt: new Date(),
          source: "ai",
          aiConfidence: confidence,
        },
      });
    }

    return { qaPairs };
  } catch (e) {
    console.error("[generateMoreQA] Error:", e);
    return { error: e instanceof Error ? e.message : "Failed to generate Q&A" };
  }
}
