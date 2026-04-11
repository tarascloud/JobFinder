"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";

interface OutreachTarget {
  role: "hiring_manager" | "recruiter" | "team_member";
  message: string;
}

interface LinkedInOutreachResult {
  targets: OutreachTarget[];
}

export async function generateLinkedInOutreach(
  vacancyId: number
): Promise<LinkedInOutreachResult | { error: string }> {
  try {
    const user = await requireUser();

    const vacancy = await prisma.vacancy.findFirst({
      where: { id: vacancyId },
      select: {
        title: true,
        company: true,
        description: true,
        tagStack: true,
        tagLevel: true,
      },
    });

    if (!vacancy) return { error: "Vacancy not found" };

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: {
        headline: true,
        yearsExperience: true,
        skills: true,
        summary: true,
        currentTitle: true,
        firstName: true,
      },
    });

    if (!userProfile) return { error: "Please create your profile first" };

    const descriptionTruncated = vacancy.description.slice(0, 2000);

    const profileSummary = [
      userProfile.headline,
      userProfile.currentTitle,
      `${userProfile.yearsExperience ?? "Several"} years of experience`,
      `Top skills: ${(userProfile.skills as string[]).slice(0, 8).join(", ") || "Not specified"}`,
      userProfile.summary?.slice(0, 300),
    ]
      .filter(Boolean)
      .join(". ");

    const prompt = `Generate 3 LinkedIn connection request messages for a job seeker targeting the role below.

Role: ${vacancy.title} at ${vacancy.company ?? "the company"}
Job description (excerpt): ${descriptionTruncated}

Candidate profile: ${profileSummary}

Rules:
- Each message MUST be 300 characters or fewer (LinkedIn limit)
- Use the 3-phrase framework: Hook (grab attention) + Value (what you bring) + Ask (clear call to action)
- Be specific to the role and company — no generic lines
- Sound human and conversational, not salesy
- First-name basis, no formal titles

Generate one message per target persona:
1. hiring_manager — the person making the hire, focus on business impact and results
2. recruiter — internal or agency recruiter, focus on fit, availability, and ease of process
3. team_member — peer engineer/designer/PM on the team, focus on shared interests and learning

Return as JSON:
{
  "targets": [
    { "role": "hiring_manager", "message": "..." },
    { "role": "recruiter", "message": "..." },
    { "role": "team_member", "message": "..." }
  ]
}`;

    const result = await callAIJSON<LinkedInOutreachResult>(prompt, {
      userId: user.id,
      systemPrompt:
        "You are an expert at LinkedIn outreach for job seekers. Write concise, personalized connection requests that get responses. Return only valid JSON.",
    });

    // Enforce 300-char limit per message (trim if AI went over)
    const targets = (result?.targets ?? []).map((t) => ({
      ...t,
      message: t.message.slice(0, 300),
    }));

    return { targets };
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Failed to generate LinkedIn outreach",
    };
  }
}
