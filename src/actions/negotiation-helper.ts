"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";

interface SalaryRange {
  min: number;
  target: number;
  max: number;
  currency: string;
}

export interface NegotiationHelperResult {
  salaryRange: SalaryRange;
  talkingPoints: string[];
  counterOfferScript: string;
  questions: string[];
  redFlags: string[];
}

export async function generateNegotiationHelper(
  vacancyId: number
): Promise<NegotiationHelperResult | { error: string }> {
  try {
    const user = await requireUser();

    const vacancy = await prisma.vacancy.findFirst({
      where: { id: vacancyId },
      select: {
        title: true,
        company: true,
        description: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        salaryText: true,
        tagStack: true,
        tagLevel: true,
        location: true,
        remoteType: true,
        employmentType: true,
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
        salaryMin: true,
        salaryCurrency: true,
        currentTitle: true,
        preferredLocations: true,
        preferredRemoteType: true,
      },
    });

    if (!userProfile) return { error: "Please create your profile first" };

    const descriptionTruncated = vacancy.description.slice(0, 2000);

    const salarySectionParts: string[] = [];
    if (vacancy.salaryText) salarySectionParts.push(`Listed salary: ${vacancy.salaryText}`);
    if (vacancy.salaryMin && vacancy.salaryMax) {
      salarySectionParts.push(
        `Parsed range: ${vacancy.salaryMin}–${vacancy.salaryMax} ${vacancy.salaryCurrency ?? "USD"}`
      );
    }
    if (userProfile.salaryMin) {
      salarySectionParts.push(
        `Candidate's minimum expectation: ${userProfile.salaryMin} ${userProfile.salaryCurrency ?? "EUR"}`
      );
    }
    const salaryContext =
      salarySectionParts.length > 0
        ? salarySectionParts.join(". ")
        : "No salary information available.";

    const profileSummary = [
      userProfile.headline,
      userProfile.currentTitle,
      `${userProfile.yearsExperience ?? "Several"} years of experience`,
      `Skills: ${(userProfile.skills as string[]).slice(0, 10).join(", ") || "Not specified"}`,
      userProfile.summary?.slice(0, 300),
    ]
      .filter(Boolean)
      .join(". ");

    const prompt = `You are a salary negotiation expert. Analyze this job offer and generate actionable negotiation guidance.

Role: ${vacancy.title} at ${vacancy.company ?? "the company"}
Location: ${vacancy.location ?? "Not specified"} | Remote: ${vacancy.remoteType ?? "Not specified"}
Employment type: ${vacancy.employmentType ?? "Not specified"}
Tech stack: ${(vacancy.tagStack as string[]).join(", ") || "Not specified"}
Level: ${vacancy.tagLevel ?? "Not specified"}

Salary context: ${salaryContext}

Job description (excerpt): ${descriptionTruncated}

Candidate profile: ${profileSummary}

Generate negotiation guidance with the following:
1. Recommended salary range with three points: minimum (walk-away), target (realistic ask), maximum (stretch goal). Use the same currency as the vacancy or EUR if unknown.
2. 5 specific talking points the candidate should use to justify their ask (based on their experience and the role requirements).
3. A counter-offer script: a short professional email/message the candidate can send when they receive the offer (or when negotiating verbally).
4. 5 clarifying questions the candidate should ask about the offer (benefits, equity, bonus, PTO, remote policy, review cycles, etc.).
5. 3-5 red flags to watch for in this specific offer or company (based on the job description, e.g. vague scope, unrealistic expectations, no benefits mention).

Return as JSON with this exact structure:
{
  "salaryRange": {
    "min": number,
    "target": number,
    "max": number,
    "currency": "string (3-letter ISO code, e.g. EUR)"
  },
  "talkingPoints": ["string"],
  "counterOfferScript": "string (full script, 3-5 sentences)",
  "questions": ["string"],
  "redFlags": ["string"]
}`;

    const result = await callAIJSON<NegotiationHelperResult>(prompt, {
      userId: user.id,
      systemPrompt:
        "You are a salary negotiation expert. Provide specific, actionable guidance based on real market data and the candidate's profile. Return only valid JSON.",
    });

    return result;
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Failed to generate negotiation helper",
    };
  }
}
