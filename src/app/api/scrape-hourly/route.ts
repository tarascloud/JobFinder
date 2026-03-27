import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { scrapeAllWithRateLimit } from "@/lib/scrapers/rate-limited";
import { saveVacancy, loadExistingVacanciesForDedup } from "@/lib/save-vacancy";

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.JOBFINDER_CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const expected = `Bearer ${secret}`;
  if (Buffer.byteLength(auth) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}

/**
 * Check if current time is within the night window (23:00-08:00 CET).
 * Returns true if scraping should be skipped.
 */
function isNightWindow(): boolean {
  const now = new Date();
  // Get current hour in CET (Europe/Berlin handles CET/CEST)
  const cetHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Berlin",
    }).format(now)
  );
  return cetHour >= 23 || cetHour < 8;
}

/**
 * Build a unique key for a search query to avoid scraping the same
 * jobTitles + geographies combination multiple times.
 */
function queryKey(jobTitles: string[], geographies: string[]): string {
  const titles = [...jobTitles].sort().join("|").toLowerCase();
  const geos = [...geographies].sort().join("|").toLowerCase();
  return `${titles}::${geos}`;
}

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // JF-V2.4: Night window check
  if (isNightWindow()) {
    console.log("[scrape-hourly] Skipping — night window (23:00-08:00 CET)");
    return NextResponse.json({ skipped: true, reason: "night_window" });
  }

  try {
    const startTime = Date.now();

    // Get all active search profiles with user info
    const searchProfiles = await prisma.searchProfile.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    if (searchProfiles.length === 0) {
      return NextResponse.json({
        totalScraped: 0,
        totalNew: 0,
        totalSkipped: 0,
        profilesProcessed: 0,
        message: "No active search profiles",
      });
    }

    // JF-V2.6: Smart dedup — skip profiles scraped less than 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const profilesToScrape = searchProfiles.filter(
      (sp) => !sp.lastScrapedAt || sp.lastScrapedAt < oneHourAgo
    );
    const skippedProfiles = searchProfiles.length - profilesToScrape.length;

    if (profilesToScrape.length === 0) {
      return NextResponse.json({
        totalScraped: 0,
        totalNew: 0,
        totalSkipped: searchProfiles.length,
        profilesProcessed: 0,
        message: "All profiles recently scraped",
      });
    }

    // Group profiles by unique query to avoid scraping the same thing twice
    const queryGroups = new Map<
      string,
      {
        jobTitles: string[];
        geographies: string[];
        remoteOnly: boolean;
        minSalary: number;
        currency: string;
        profiles: typeof profilesToScrape;
      }
    >();

    for (const sp of profilesToScrape) {
      const key = queryKey(sp.jobTitles, sp.geographies);
      if (!queryGroups.has(key)) {
        queryGroups.set(key, {
          jobTitles: sp.jobTitles,
          geographies: sp.geographies,
          remoteOnly: sp.remoteOnly,
          minSalary: sp.minSalary ?? 0,
          currency: sp.currency ?? "EUR",
          profiles: [sp],
        });
      } else {
        queryGroups.get(key)!.profiles.push(sp);
      }
    }

    let totalScraped = 0;
    let totalNew = 0;
    const errors: string[] = [];

    // Process each unique query group
    for (const [key, group] of queryGroups) {
      console.log(
        `[scrape-hourly] Scraping query group: ${key} (${group.profiles.length} profiles)`
      );

      // JF-V2.7: Retry logic — scrapeAllWithRateLimit catches per-platform errors
      let vacancies;
      try {
        vacancies = await scrapeAllWithRateLimit({
          jobTitles: group.jobTitles,
          geographies: group.geographies,
          remoteOnly: group.remoteOnly,
          minSalary: group.minSalary,
          currency: group.currency,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[scrape-hourly] Query group failed: ${key} — ${msg}`);
        errors.push(`${key}: ${msg}`);
        continue;
      }

      totalScraped += vacancies.length;

      // Save vacancies for each user whose profile is in this group
      for (const sp of group.profiles) {
        const existingVacancies = await loadExistingVacanciesForDedup(sp.userId);

        for (const v of vacancies) {
          try {
            const saved = await saveVacancy(v, sp.userId, sp.id, existingVacancies);
            if (saved.result === "new") {
              totalNew++;
            }
          } catch (err) {
            console.error(
              `[scrape-hourly] Save error for ${v.platform}/${v.externalId}:`,
              err instanceof Error ? err.message : err
            );
          }
        }

        // JF-V2.6: Update lastScrapedAt
        await prisma.searchProfile.update({
          where: { id: sp.id },
          data: { lastScrapedAt: new Date() },
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[scrape-hourly] Done in ${elapsed}s — scraped: ${totalScraped}, new: ${totalNew}, skipped profiles: ${skippedProfiles}`
    );

    return NextResponse.json({
      totalScraped,
      totalNew,
      totalSkipped: skippedProfiles,
      profilesProcessed: profilesToScrape.length,
      uniqueQueries: queryGroups.size,
      elapsed: `${elapsed}s`,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    console.error("[scrape-hourly] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
