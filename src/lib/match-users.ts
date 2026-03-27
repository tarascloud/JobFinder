import { prisma } from "@/lib/db";
import type { ScrapedVacancy } from "@/lib/scrapers/types";

/**
 * Find all users whose active SearchProfiles match a vacancy,
 * and create UserVacancy records for them.
 *
 * Matching criteria:
 * - At least one jobTitle from the SearchProfile appears in the vacancy title (case-insensitive)
 * - Geography match: vacancy location contains one of the profile's geographies, OR profile is remoteOnly and vacancy is remote
 * - Salary range: if profile has minSalary, vacancy salary (if known) must be >= minSalary
 *
 * Skips creating UserVacancy if one already exists for that user+vacancy.
 */
export async function matchUsersToVacancy(
  vacancyId: number,
  vacancy: ScrapedVacancy,
  excludeUserId?: number
): Promise<number> {
  // Get all active search profiles (excluding the user who triggered the scrape, if any)
  const profiles = await prisma.searchProfile.findMany({
    where: {
      isActive: true,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: {
      id: true,
      userId: true,
      jobTitles: true,
      geographies: true,
      remoteOnly: true,
      minSalary: true,
      currency: true,
    },
  });

  let matched = 0;
  const vacancyTitleLower = vacancy.title.toLowerCase();
  const vacancyLocationLower = (vacancy.location || "").toLowerCase();
  const isRemoteVacancy =
    vacancy.remoteType === "remote" ||
    vacancyLocationLower.includes("remote");

  for (const profile of profiles) {
    // 1. Job title match — at least one title must appear in vacancy title
    const titleMatch = profile.jobTitles.some((t) =>
      vacancyTitleLower.includes(t.toLowerCase())
    );
    if (!titleMatch) continue;

    // 2. Geography match
    const geoMatch =
      profile.geographies.length === 0 ||
      (profile.remoteOnly && isRemoteVacancy) ||
      profile.geographies.some((g) =>
        vacancyLocationLower.includes(g.toLowerCase())
      );
    if (!geoMatch) continue;

    // 3. Salary range check (only if both profile and vacancy have salary data)
    if (profile.minSalary && vacancy.salaryMax) {
      // Simple check: vacancy max salary should be >= profile min salary
      if (vacancy.salaryMax < profile.minSalary) continue;
    }

    // Create UserVacancy if it doesn't exist
    try {
      await prisma.userVacancy.upsert({
        where: {
          userId_vacancyId: {
            userId: profile.userId,
            vacancyId,
          },
        },
        update: {}, // Don't overwrite existing
        create: {
          userId: profile.userId,
          vacancyId,
          searchProfileId: profile.id,
          score: 0,
          seen: false,
        },
      });
      matched++;
    } catch (err) {
      // Ignore unique constraint violations (race condition)
      console.error(
        `[match-users] Error creating UserVacancy for user ${profile.userId}, vacancy ${vacancyId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return matched;
}
