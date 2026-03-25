"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import type { AnalyzedProfile } from "@/actions/profile";

export interface ResumeRecommendation {
  id: string;
  category: "content" | "format" | "keywords" | "achievements" | "structure";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  currentText?: string;
  suggestedText?: string;
}

export interface RecommendationsResult {
  recommendations: ResumeRecommendation[];
}

export async function generateResumeRecommendations(
  userId: number
): Promise<RecommendationsResult | { error: string }> {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return { error: "No profile found. Please complete resume analysis first." };
    }

    const { callAIJSON } = await import("@/lib/ai/provider");

    const profileData = {
      headline: profile.headline,
      summary: profile.summary,
      yearsExperience: profile.yearsExperience,
      skills: profile.skills,
      languages: profile.languages,
      portfolioUrls: profile.portfolioUrls,
      salaryMin: profile.salaryMin,
      salaryCurrency: profile.salaryCurrency,
      preferredLocations: profile.preferredLocations,
      preferredRemoteType: profile.preferredRemoteType,
      employmentTypes: profile.employmentTypes,
    };

    const prompt = `You are an expert career coach and resume reviewer. Analyze this professional profile and provide specific, actionable improvement recommendations.

PROFILE DATA:
${JSON.stringify(profileData, null, 2)}

Return ONLY a valid JSON object (no markdown, no code fences) with this structure:

{
  "recommendations": [
    {
      "id": "rec_1",
      "category": "achievements",
      "title": "Add quantified achievements",
      "description": "Your summary mentions experience but lacks specific numbers. Add metrics like 'Reduced deployment time by 40%' or 'Led team of 12 engineers'.",
      "priority": "high",
      "currentText": "Experienced software engineer with cloud expertise",
      "suggestedText": "Software engineer with 8+ years building cloud-native systems, reducing infrastructure costs by 35% and leading teams of 10+ engineers"
    }
  ]
}

GUIDELINES:
- Provide 4-8 recommendations
- Categories: "content" (missing info), "format" (structure issues), "keywords" (trending skills to add), "achievements" (quantify results), "structure" (organization)
- Priority: "high" (critical for job search), "medium" (would improve profile), "low" (nice to have)
- Each recommendation must be specific to THIS profile, not generic
- currentText and suggestedText should reference actual profile content when applicable
- For keywords category, suggest trending industry terms relevant to their skills
- For achievements, suggest adding metrics and numbers
- If summary is too long (>3 sentences), suggest shortening
- If skills list is short (<5), suggest adding more
- Return ONLY valid JSON`;

    const result = await callAIJSON<RecommendationsResult>(prompt, { userId });
    return result;
  } catch (e) {
    console.error("[generateResumeRecommendations] Error:", e);
    return { error: e instanceof Error ? e.message : "Failed to generate recommendations" };
  }
}

export async function applyRecommendations(
  userId: number,
  acceptedIds: string[]
): Promise<{ updatedProfile: AnalyzedProfile } | { error: string }> {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return { error: "No profile found" };
    }

    const { callAIJSON } = await import("@/lib/ai/provider");

    const profileData = {
      headline: profile.headline,
      summary: profile.summary,
      yearsExperience: profile.yearsExperience,
      skills: profile.skills,
      languages: profile.languages,
      portfolioUrls: profile.portfolioUrls,
      salaryMin: profile.salaryMin,
      salaryCurrency: profile.salaryCurrency,
      preferredLocations: profile.preferredLocations,
      preferredRemoteType: profile.preferredRemoteType,
      employmentTypes: profile.employmentTypes,
    };

    // Load the recommendations to know which ones were accepted
    const recsResult = await generateResumeRecommendations(userId);
    if ("error" in recsResult) {
      return { error: recsResult.error };
    }

    const acceptedRecs = recsResult.recommendations.filter((r) =>
      acceptedIds.includes(r.id)
    );

    if (acceptedRecs.length === 0) {
      return {
        updatedProfile: {
          headline: profile.headline || "",
          summary: profile.summary || "",
          yearsExperience: profile.yearsExperience,
          skills: profile.skills,
          languages: profile.languages,
          portfolioUrls: profile.portfolioUrls,
          salaryMin: profile.salaryMin,
          salaryCurrency: profile.salaryCurrency || "EUR",
          preferredLocations: profile.preferredLocations,
          preferredRemoteType: profile.preferredRemoteType || "remote",
          employmentTypes: profile.employmentTypes,
        },
      };
    }

    const prompt = `You are an expert career coach. Apply the following accepted improvements to this professional profile.

CURRENT PROFILE:
${JSON.stringify(profileData, null, 2)}

ACCEPTED IMPROVEMENTS TO APPLY:
${JSON.stringify(acceptedRecs, null, 2)}

Return ONLY a valid JSON object (no markdown, no code fences) with the improved profile:

{
  "headline": "Improved headline",
  "summary": "Improved 2-3 sentence summary",
  "yearsExperience": 10,
  "skills": ["Skill1", "Skill2", "...up to 20"],
  "languages": ["English (Professional)", "..."],
  "portfolioUrls": ["https://..."],
  "salaryMin": 150000,
  "salaryCurrency": "EUR",
  "preferredLocations": ["Remote", "EU"],
  "preferredRemoteType": "remote",
  "employmentTypes": ["full-time", "contract"]
}

GUIDELINES:
- Apply ONLY the accepted improvements, keep everything else the same
- For keyword recommendations, add suggested skills to the skills array
- For achievement recommendations, update the summary with quantified results
- For structure recommendations, reorganize as suggested
- Preserve all existing data that wasn't part of improvements
- Return ONLY valid JSON`;

    const result = await callAIJSON<AnalyzedProfile>(prompt, { userId });
    return { updatedProfile: result };
  } catch (e) {
    console.error("[applyRecommendations] Error:", e);
    return { error: e instanceof Error ? e.message : "Failed to apply recommendations" };
  }
}

export async function generateResumeRecommendationsForCurrentUser(): Promise<
  RecommendationsResult | { error: string }
> {
  try {
    const user = await requireUser();
    return generateResumeRecommendations(user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to generate recommendations" };
  }
}

export async function applyRecommendationsForCurrentUser(
  acceptedIds: string[]
): Promise<{ updatedProfile: AnalyzedProfile } | { error: string }> {
  try {
    const user = await requireUser();
    return applyRecommendations(user.id, acceptedIds);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to apply recommendations" };
  }
}
