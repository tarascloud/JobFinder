"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";

interface ResumeTailorResult {
  suggestions: {
    section: string;
    original: string;
    suggested: string;
    reason: string;
  }[];
  tailoredSummary: string;
  keywordsToAdd: string[];
  keywordsToRemove: string[];
}

export async function tailorResume(
  vacancyId: number
): Promise<ResumeTailorResult | { error: string }> {
  try {
    const user = await requireUser();

    const vacancy = await prisma.vacancy.findUnique({
      where: { id: vacancyId },
    });
    if (!vacancy) return { error: "Vacancy not found" };

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!userProfile) return { error: "Please create your profile first" };

    const descriptionTruncated = vacancy.description.slice(0, 3000);

    const profileSummary = [
      userProfile.headline ? `Headline: ${userProfile.headline}` : null,
      userProfile.summary ? `Summary: ${userProfile.summary}` : null,
      `Skills: ${userProfile.skills.join(", ") || "Not specified"}`,
      `${userProfile.yearsExperience ?? "Several"} years of experience`,
      userProfile.languages.length > 0
        ? `Languages: ${userProfile.languages.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Given this job description and candidate's profile, suggest how to tailor the resume:

Job: ${vacancy.title} at ${vacancy.company ?? "Unknown company"}
Description: ${descriptionTruncated}

Current profile:
${profileSummary}

Return JSON with:
- suggestions: array of {section, original, suggested, reason} for each improvement. Section should be one of: "headline", "summary", "skills", "experience". Original is the current text, suggested is the improved version, reason explains why.
- tailoredSummary: a rewritten professional summary targeting this specific role
- keywordsToAdd: skills/keywords from the job that should be highlighted in the resume
- keywordsToRemove: irrelevant skills that could be removed for this specific application

Return as JSON with this exact structure:
{
  "suggestions": [{"section": "string", "original": "string", "suggested": "string", "reason": "string"}],
  "tailoredSummary": "string",
  "keywordsToAdd": ["string"],
  "keywordsToRemove": ["string"]
}`;

    const result = await callAIJSON<ResumeTailorResult>(prompt, {
      userId: user.id,
      systemPrompt:
        "You are an expert resume writer and career coach. Analyze the job requirements and suggest specific, actionable improvements to tailor the candidate's resume for this role. Return only valid JSON.",
    });

    return result;
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Failed to generate resume tailoring",
    };
  }
}
