"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import type { AnalyzedProfile, AnalyzedSearchProfile, AnalyzedQaPair } from "@/actions/profile";

export async function completeOnboarding(
  profileData: AnalyzedProfile & { resumeUrl: string },
  searchProfiles: AnalyzedSearchProfile[],
  qaPairs: AnalyzedQaPair[]
) {
  try {
    const user = await requireUser();

    // Use a transaction to save everything atomically
    await prisma.$transaction(async (tx) => {
      // 1. Upsert user profile
      await tx.userProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          headline: profileData.headline || null,
          summary: profileData.summary || null,
          yearsExperience: profileData.yearsExperience,
          skills: profileData.skills,
          languages: profileData.languages,
          portfolioUrls: profileData.portfolioUrls,
          resumeUrl: profileData.resumeUrl || null,
          salaryMin: profileData.salaryMin,
          salaryCurrency: profileData.salaryCurrency || null,
          preferredLocations: profileData.preferredLocations,
          preferredRemoteType: profileData.preferredRemoteType || null,
          employmentTypes: profileData.employmentTypes,
        },
        update: {
          headline: profileData.headline || null,
          summary: profileData.summary || null,
          yearsExperience: profileData.yearsExperience,
          skills: profileData.skills,
          languages: profileData.languages,
          portfolioUrls: profileData.portfolioUrls,
          resumeUrl: profileData.resumeUrl || null,
          salaryMin: profileData.salaryMin,
          salaryCurrency: profileData.salaryCurrency || null,
          preferredLocations: profileData.preferredLocations,
          preferredRemoteType: profileData.preferredRemoteType || null,
          employmentTypes: profileData.employmentTypes,
        },
      });

      // 2. Create all search profiles
      for (const sp of searchProfiles) {
        await tx.searchProfile.create({
          data: {
            userId: user.id,
            name: sp.name || "My Job Search",
            jobTitles: sp.jobTitles,
            minSalary: sp.minSalary,
            currency: sp.currency || "EUR",
            employmentTypes: sp.employmentTypes,
            remoteOnly: sp.remoteOnly,
            geographies: sp.geographies,
          },
        });
      }

      // 3. Create Q&A pairs
      if (qaPairs.length > 0) {
        await tx.qaPair.createMany({
          data: qaPairs.map((p) => ({
            userId: user.id,
            question: p.question,
            answer: p.answer,
            answeredAt: new Date(),
            category: "resume",
          })),
        });
      }
    });

    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to complete onboarding",
    };
  }
}
