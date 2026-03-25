"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { scrapeAll } from "@/lib/scrapers";
import type { ScrapedVacancy, SearchCriteria } from "@/lib/scrapers/types";
import { findDuplicate } from "@/lib/dedup";
import { computeEurSalary } from "@/lib/salary";
import { tagVacancy } from "@/lib/ai/tagger";

export async function getScrapeStatus(searchProfileId?: number) {
  try {
    const user = await requireUser();

    // Get the latest scraped vacancy timestamp
    const where = searchProfileId
      ? {
          vacancyScores: {
            some: { userId: user.id, searchProfileId },
          },
        }
      : {
          vacancyScores: {
            some: { userId: user.id },
          },
        };

    const latestVacancy = await prisma.vacancy.findFirst({
      where,
      orderBy: { scrapedAt: "desc" },
      select: { scrapedAt: true },
    });

    // Count vacancies scraped in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = await prisma.vacancy.count({
      where: {
        scrapedAt: { gte: oneDayAgo },
        vacancyScores: {
          some: {
            userId: user.id,
            ...(searchProfileId ? { searchProfileId } : {}),
          },
        },
      },
    });

    // Total vacancies for this user
    const totalCount = await prisma.vacancy.count({
      where,
    });

    // Count by platform
    const byPlatform = await prisma.vacancy.groupBy({
      by: ["platform"],
      where,
      _count: { id: true },
    });

    const platformCounts: Record<string, number> = {};
    for (const row of byPlatform) {
      platformCounts[row.platform] = row._count.id;
    }

    return {
      lastScrapeAt: latestVacancy?.scrapedAt ?? null,
      newLast24h: recentCount,
      total: totalCount,
      byPlatform: platformCounts,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to get scrape status",
    };
  }
}

export async function triggerScrape(searchProfileId: number) {
  try {
    const user = await requireUser();

    // Load the search profile
    const searchProfile = await prisma.searchProfile.findFirst({
      where: { id: searchProfileId, userId: user.id },
    });
    if (!searchProfile) {
      return { error: "Search profile not found" };
    }

    // Build search criteria from the profile
    const criteria: SearchCriteria = {
      jobTitles: searchProfile.jobTitles,
      geographies: searchProfile.geographies,
      remoteOnly: searchProfile.remoteOnly,
      minSalary: searchProfile.minSalary ?? 0,
      currency: searchProfile.currency ?? "EUR",
    };

    console.log(
      `[scraper] Starting scrape for profile "${searchProfile.name}" (id: ${searchProfileId})`
    );

    // Run all scrapers
    const scraped = await scrapeAll(criteria);

    console.log(
      `[scraper] Scraped ${scraped.length} vacancies, saving to DB...`
    );

    // Load existing vacancies for smart cross-platform dedup
    const existingVacancies = await prisma.vacancy.findMany({
      where: {
        vacancyScores: { some: { userId: user.id } },
      },
      select: {
        id: true,
        company: true,
        title: true,
        postedAt: true,
      },
    });

    // Save to DB with deduplication
    let newCount = 0;
    let duplicateCount = 0;
    let crossPlatformDupCount = 0;
    const errors: string[] = [];

    for (const vacancy of scraped) {
      try {
        const result = await saveVacancy(
          vacancy,
          user.id,
          searchProfileId,
          existingVacancies
        );
        if (result === "new") {
          newCount++;
        } else if (result === "cross-platform-dup") {
          crossPlatformDupCount++;
          duplicateCount++;
        } else {
          duplicateCount++;
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error saving vacancy";
        errors.push(`${vacancy.platform}/${vacancy.externalId}: ${msg}`);
      }
    }

    console.log(
      `[scraper] Done — new: ${newCount}, duplicates: ${duplicateCount} (cross-platform: ${crossPlatformDupCount}), errors: ${errors.length}`
    );

    return {
      totalScraped: scraped.length,
      newVacancies: newCount,
      duplicates: duplicateCount,
      crossPlatformDuplicates: crossPlatformDupCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to trigger scrape",
    };
  }
}

interface ExistingVacancyForDedup {
  id: number;
  company: string | null;
  title: string;
  postedAt: Date | null;
}

async function saveVacancy(
  vacancy: ScrapedVacancy,
  userId: number,
  searchProfileId: number,
  existingVacancies: ExistingVacancyForDedup[]
): Promise<"new" | "duplicate" | "cross-platform-dup"> {
  // Step 1: Check exact platform + externalId dedup
  const existing = await prisma.vacancy.findUnique({
    where: {
      platform_externalId: {
        platform: vacancy.platform,
        externalId: vacancy.externalId,
      },
    },
  });

  if (existing) {
    // Ensure a VacancyScore link exists for this user+profile
    await ensureVacancyScore(existing.id, userId, searchProfileId);
    return "duplicate";
  }

  // Step 2: Smart cross-platform dedup
  const duplicateOfId = findDuplicate(vacancy, existingVacancies);

  // Compute EUR-normalized salary
  const eurSalary = computeEurSalary(
    vacancy.salaryMin,
    vacancy.salaryMax,
    vacancy.salaryCurrency,
    vacancy.salaryText
  );

  // Auto-tag the vacancy
  const tags = tagVacancy(
    vacancy.title,
    vacancy.company ?? "",
    vacancy.description || ""
  );

  // Create new vacancy (even if it's a cross-platform dup, we store it for reference)
  const created = await prisma.vacancy.create({
    data: {
      platform: vacancy.platform,
      externalId: vacancy.externalId,
      url: vacancy.url,
      title: vacancy.title,
      company: vacancy.company,
      location: vacancy.location,
      salaryText: vacancy.salaryText,
      salaryMin: vacancy.salaryMin,
      salaryMax: vacancy.salaryMax,
      salaryCurrency: vacancy.salaryCurrency,
      salaryMinEur: eurSalary.minEur,
      salaryMaxEur: eurSalary.maxEur,
      remoteType: vacancy.remoteType,
      employmentType: vacancy.employmentType,
      description: vacancy.description || "",
      language: vacancy.language,
      postedAt: vacancy.postedAt,
      isDuplicateOf: duplicateOfId,
      tagStack: tags.stack,
      tagLevel: tags.level,
      tagIndustry: tags.industry,
      tagTeamSize: tags.teamSize,
    },
  });

  // Add to our in-memory list for subsequent dedup checks within this batch
  existingVacancies.push({
    id: created.id,
    company: vacancy.company,
    title: vacancy.title,
    postedAt: vacancy.postedAt,
  });

  if (duplicateOfId) {
    // Cross-platform duplicate found — don't create a separate VacancyScore,
    // just link it. The original vacancy already has scores.
    return "cross-platform-dup";
  }

  // Create VacancyScore for this user+profile
  await prisma.vacancyScore.create({
    data: {
      vacancyId: created.id,
      userId,
      searchProfileId,
      matchScore: 0, // Will be scored later by AI
      scoredBy: "scraper",
    },
  });

  return "new";
}

async function ensureVacancyScore(
  vacancyId: number,
  userId: number,
  searchProfileId: number
) {
  const existingScore = await prisma.vacancyScore.findFirst({
    where: { vacancyId, userId, searchProfileId },
  });

  if (!existingScore) {
    await prisma.vacancyScore.create({
      data: {
        vacancyId,
        userId,
        searchProfileId,
        matchScore: 0,
        scoredBy: "scraper",
      },
    });
  }
}
