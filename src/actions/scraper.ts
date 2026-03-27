"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { scrapeAll } from "@/lib/scrapers";
import type { SearchCriteria } from "@/lib/scrapers/types";
import { saveVacancy, loadExistingVacanciesForDedup } from "@/lib/save-vacancy";

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
    const existingVacancies = await loadExistingVacanciesForDedup(user.id);

    // Save to DB with deduplication
    let newCount = 0;
    let duplicateCount = 0;
    let crossPlatformDupCount = 0;
    const errors: string[] = [];

    for (const vacancy of scraped) {
      try {
        const { result } = await saveVacancy(
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

