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
