"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";

interface CompanyResearchResult {
  description: string;
  industry: string;
  size: string;
  founded: string;
  headquarters: string;
  keyFacts: string[];
  recentNews: string[];
  glassdoorRating?: string;
  techStack?: string[];
  workCulture?: string;
  // Deep research axes (optional — populated when profile context is provided)
  aiTechStrategy?: string;
  recentMovements?: string[];
  engineeringCulture?: string;
  probableChallenges?: string[];
  competitorsAndDifferentiation?: string;
  candidateAngle?: string;
}

export async function researchCompany(
  companyName: string
): Promise<CompanyResearchResult | { error: string }> {
  try {
    const user = await requireUser();

    // Check cache first (per-user, with 30-day TTL)
    const cached = await prisma.companyResearch.findUnique({
      where: {
        companyName_userId: {
          companyName: companyName.trim().toLowerCase(),
          userId: user.id,
        },
      },
    });

    if (cached) {
      const ageMs = Date.now() - cached.createdAt.getTime();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      if (ageMs < thirtyDaysMs) {
        return JSON.parse(cached.data) as CompanyResearchResult;
      }
      // Cache expired — delete and re-generate
      await prisma.companyResearch.delete({ where: { id: cached.id } });
    }

    const prompt = `Research the company "${companyName}" and provide detailed information.

Return as JSON with this exact structure:
{
  "description": "Brief description of what the company does",
  "industry": "Primary industry",
  "size": "Company size (e.g., '1000-5000 employees')",
  "founded": "Year founded or 'Unknown'",
  "headquarters": "HQ location",
  "keyFacts": ["5 key facts about the company"],
  "recentNews": ["3-5 notable recent developments or news"],
  "glassdoorRating": "Approximate rating if known, or null",
  "techStack": ["Known technologies used"],
  "workCulture": "Brief description of work culture"
}

If you don't have reliable information about the company, still provide your best assessment based on available knowledge. Mark uncertain items accordingly.`;

    const result = await callAIJSON<CompanyResearchResult>(prompt, {
      userId: user.id,
      systemPrompt:
        "You are a knowledgeable company researcher. Provide accurate, helpful information about companies. Return only valid JSON.",
    });

    // Cache in DB (per-user)
    await prisma.companyResearch.create({
      data: {
        companyName: companyName.trim().toLowerCase(),
        userId: user.id,
        data: JSON.stringify(result),
      },
    });

    return result;
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Failed to research company",
    };
  }
}

export async function researchCompanyDeep(
  companyName: string,
  vacancyId?: number
): Promise<CompanyResearchResult | { error: string }> {
  try {
    const user = await requireUser();

    // Load user profile for the candidate angle axis
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: {
        headline: true,
        yearsExperience: true,
        skills: true,
        summary: true,
        currentTitle: true,
      },
    });

    // Optionally load vacancy context
    let vacancyContext = "";
    if (vacancyId) {
      const vacancy = await prisma.vacancy.findFirst({
        where: { id: vacancyId },
        select: { title: true, description: true, tagStack: true },
      });
      if (vacancy) {
        vacancyContext = `\nTarget role: ${vacancy.title}\nJob description excerpt: ${vacancy.description.slice(0, 1500)}`;
      }
    }

    const profileSummary = userProfile
      ? [
          userProfile.headline,
          userProfile.currentTitle,
          `${userProfile.yearsExperience ?? "Several"} years of experience`,
          `Skills: ${(userProfile.skills as string[]).slice(0, 10).join(", ") || "Not specified"}`,
          userProfile.summary?.slice(0, 300),
        ]
          .filter(Boolean)
          .join(". ")
      : "Profile not available";

    const prompt = `Perform deep research on the company "${companyName}" across 6 axes.${vacancyContext}

Candidate profile: ${profileSummary}

Return as JSON with this exact structure (include ALL fields from both standard and deep research):
{
  "description": "Brief description of what the company does",
  "industry": "Primary industry",
  "size": "Company size (e.g., '1000-5000 employees')",
  "founded": "Year founded or 'Unknown'",
  "headquarters": "HQ location",
  "keyFacts": ["5 key facts about the company"],
  "recentNews": ["3-5 notable recent developments or news"],
  "glassdoorRating": "Approximate rating if known, or null",
  "techStack": ["Known technologies used"],
  "workCulture": "Brief description of work culture",
  "aiTechStrategy": "How AI features in their product, R&D investments, or internal tooling. Are they AI-first, AI-augmented, or AI-absent?",
  "recentMovements": ["3-5 items: notable hires/departures, funding rounds, acquisitions, or product launches in the past 12 months"],
  "engineeringCulture": "Deploy cadence (daily/weekly/release trains), primary tech stack, remote vs in-office policy, team size estimates, and engineering blog/open-source activity",
  "probableChallenges": ["3-4 likely technical or business challenges: scaling pains, legacy migration, market pressure, compliance, hiring freeze, etc."],
  "competitorsAndDifferentiation": "Top 2-3 direct competitors and what makes this company meaningfully different (product, pricing, market, tech)",
  "candidateAngle": "Specific ways THIS candidate (based on their profile and the target role) can add value to this company given their challenges and strategy. Be concrete."
}

If uncertain about any field, provide your best-informed estimate and note uncertainty. Never leave a field null — use 'Unknown' or empty array where truly no data exists.`;

    const result = await callAIJSON<CompanyResearchResult>(prompt, {
      userId: user.id,
      systemPrompt:
        "You are a senior company intelligence analyst specializing in tech companies. You help job seekers understand companies deeply before interviews. Return only valid JSON.",
    });

    // Cache deep result under the same key (overrides basic cache)
    const cacheKey = companyName.trim().toLowerCase();
    const existing = await prisma.companyResearch.findUnique({
      where: { companyName_userId: { companyName: cacheKey, userId: user.id } },
    });

    if (existing) {
      await prisma.companyResearch.update({
        where: { id: existing.id },
        data: { data: JSON.stringify(result) },
      });
    } else {
      await prisma.companyResearch.create({
        data: {
          companyName: cacheKey,
          userId: user.id,
          data: JSON.stringify(result),
        },
      });
    }

    return result;
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Failed to perform deep company research",
    };
  }
}

export async function getCachedCompanyResearch(
  companyName: string
): Promise<CompanyResearchResult | null> {
  try {
    const user = await requireUser();

    const cached = await prisma.companyResearch.findUnique({
      where: {
        companyName_userId: {
          companyName: companyName.trim().toLowerCase(),
          userId: user.id,
        },
      },
    });

    if (!cached) return null;

    // Check 30-day TTL
    const ageMs = Date.now() - cached.createdAt.getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (ageMs >= thirtyDaysMs) return null;

    return JSON.parse(cached.data) as CompanyResearchResult;
  } catch {
    return null;
  }
}
