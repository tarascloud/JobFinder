import { prisma } from "@/lib/db";
import type { ScrapedVacancy } from "@/lib/scrapers/types";
import { findDuplicate } from "@/lib/dedup";
import { computeEurSalary } from "@/lib/salary";
import { tagVacancy } from "@/lib/ai/tagger";
import { matchUsersToVacancy } from "@/lib/match-users";

export interface ExistingVacancyForDedup {
  id: number;
  company: string | null;
  title: string;
  postedAt: Date | null;
}

export type SaveVacancyResult = "new" | "duplicate" | "cross-platform-dup";

/**
 * Save a scraped vacancy to the database with full processing:
 * - Exact platform+externalId dedup
 * - Smart cross-platform dedup
 * - EUR salary normalization
 * - Auto-tagging (with backfill for existing vacancies missing tags)
 * - VacancyScore creation/linking
 *
 * @param existingVacancies - mutable array; new vacancies are pushed for within-batch dedup
 * @returns the save result and the vacancy id
 */
export async function saveVacancy(
  vacancy: ScrapedVacancy,
  userId: number,
  searchProfileId: number,
  existingVacancies: ExistingVacancyForDedup[]
): Promise<{ result: SaveVacancyResult; vacancyId: number }> {
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
    await ensureVacancyScore(existing.id, userId, searchProfileId);
    // Backfill tags if missing
    if (!existing.tagLevel) {
      const tags = tagVacancy(
        existing.title,
        existing.company ?? "",
        existing.description
      );
      await prisma.vacancy.update({
        where: { id: existing.id },
        data: {
          tagStack: tags.stack,
          tagLevel: tags.level,
          tagIndustry: tags.industry,
          tagTeamSize: tags.teamSize,
        },
      });
    }
    return { result: "duplicate", vacancyId: existing.id };
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

  // Auto-tag
  const tags = tagVacancy(
    vacancy.title,
    vacancy.company ?? "",
    vacancy.description || ""
  );

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

  // Add to in-memory list for within-batch dedup
  existingVacancies.push({
    id: created.id,
    company: vacancy.company,
    title: vacancy.title,
    postedAt: vacancy.postedAt,
  });

  if (duplicateOfId) {
    return { result: "cross-platform-dup", vacancyId: created.id };
  }

  // Create VacancyScore for this user+profile
  await prisma.vacancyScore.create({
    data: {
      vacancyId: created.id,
      userId,
      searchProfileId,
      matchScore: 0,
      scoredBy: "scraper",
    },
  });

  // Match other users whose SearchProfiles match this vacancy
  try {
    await matchUsersToVacancy(created.id, vacancy, userId);
  } catch (err) {
    console.error(
      `[save-vacancy] matchUsersToVacancy error for vacancy ${created.id}:`,
      err instanceof Error ? err.message : err
    );
  }

  return { result: "new", vacancyId: created.id };
}

/**
 * Ensure a VacancyScore link exists for a given vacancy/user/profile combo.
 */
export async function ensureVacancyScore(
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

/**
 * Load existing vacancies for a user, suitable for cross-platform dedup.
 */
export async function loadExistingVacanciesForDedup(
  userId: number
): Promise<ExistingVacancyForDedup[]> {
  return prisma.vacancy.findMany({
    where: { vacancyScores: { some: { userId } } },
    select: { id: true, company: true, title: true, postedAt: true },
  });
}

// ---------------------------------------------------------------------------
// Batch-optimized helpers for scrape-hourly (REV-16)
// ---------------------------------------------------------------------------

/** Compact record from pre-fetched existing vacancies by platform+externalId */
export interface ExistingVacancyRecord {
  id: number;
  platform: string;
  externalId: string;
  tagLevel: string | null;
  title: string;
  company: string | null;
  description: string;
}

/**
 * Pre-fetch ALL existing vacancies whose platform+externalId is in the given set.
 * Returns a Map keyed by "platform::externalId" for O(1) lookup.
 */
export async function prefetchExistingByPlatformId(
  keys: Array<{ platform: string; externalId: string }>
): Promise<Map<string, ExistingVacancyRecord>> {
  if (keys.length === 0) return new Map();

  // Prisma doesn't support findMany with composite unique IN,
  // so we use OR with chunks to avoid query-size limits
  const CHUNK_SIZE = 500;
  const result = new Map<string, ExistingVacancyRecord>();

  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE);
    const rows = await prisma.vacancy.findMany({
      where: {
        OR: chunk.map((k) => ({
          platform: k.platform,
          externalId: k.externalId,
        })),
      },
      select: {
        id: true,
        platform: true,
        externalId: true,
        tagLevel: true,
        title: true,
        company: true,
        description: true,
      },
    });
    for (const row of rows) {
      result.set(`${row.platform}::${row.externalId}`, row);
    }
  }

  return result;
}

/**
 * Pre-fetch existing VacancyScore records for a set of (vacancyId, userId, searchProfileId)
 * to avoid N individual findFirst calls.
 * Returns a Set of "vacancyId::userId::searchProfileId" keys.
 */
export async function prefetchExistingScores(
  vacancyIds: number[],
  userId: number,
  searchProfileId: number
): Promise<Set<string>> {
  if (vacancyIds.length === 0) return new Set();

  const scores = await prisma.vacancyScore.findMany({
    where: {
      vacancyId: { in: vacancyIds },
      userId,
      searchProfileId,
    },
    select: { vacancyId: true, userId: true, searchProfileId: true },
  });

  const keys = new Set<string>();
  for (const s of scores) {
    keys.add(`${s.vacancyId}::${s.userId}::${s.searchProfileId}`);
  }
  return keys;
}

/**
 * Batch-create VacancyScore records, skipping those that already exist.
 */
export async function batchEnsureVacancyScores(
  entries: Array<{ vacancyId: number; userId: number; searchProfileId: number }>,
  existingScoreKeys: Set<string>
): Promise<number> {
  const toCreate = entries.filter(
    (e) => !existingScoreKeys.has(`${e.vacancyId}::${e.userId}::${e.searchProfileId}`)
  );

  if (toCreate.length === 0) return 0;

  const result = await prisma.vacancyScore.createMany({
    data: toCreate.map((e) => ({
      vacancyId: e.vacancyId,
      userId: e.userId,
      searchProfileId: e.searchProfileId,
      matchScore: 0,
      scoredBy: "scraper",
    })),
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * Batch-save scraped vacancies with pre-fetched lookup data.
 * Eliminates the N+1 pattern: no individual findUnique/findFirst per vacancy.
 *
 * @param vacancies - scraped vacancies from a single query group
 * @param userId - the user who owns this search profile
 * @param searchProfileId - the search profile ID
 * @param existingByPlatformId - pre-fetched Map from prefetchExistingByPlatformId
 * @param dedupVacancies - mutable array for cross-platform dedup (shared across groups per user)
 * @returns count of newly created vacancies
 */
export async function batchSaveVacancies(
  vacancies: ScrapedVacancy[],
  userId: number,
  searchProfileId: number,
  existingByPlatformId: Map<string, ExistingVacancyRecord>,
  dedupVacancies: ExistingVacancyForDedup[]
): Promise<{ newCount: number; dupCount: number }> {
  let newCount = 0;
  let dupCount = 0;

  // Separate into existing (duplicates) and new vacancies using the pre-fetched map
  const duplicateVacancyIds: number[] = [];
  const tagBackfillUpdates: Array<{
    id: number;
    title: string;
    company: string;
    description: string;
  }> = [];
  const toCreate: ScrapedVacancy[] = [];

  for (const v of vacancies) {
    const key = `${v.platform}::${v.externalId}`;
    const existing = existingByPlatformId.get(key);
    if (existing) {
      duplicateVacancyIds.push(existing.id);
      if (!existing.tagLevel) {
        tagBackfillUpdates.push({
          id: existing.id,
          title: existing.title,
          company: existing.company ?? "",
          description: existing.description,
        });
      }
      dupCount++;
    } else {
      toCreate.push(v);
    }
  }

  // Batch ensure VacancyScore for all existing (duplicate) vacancies
  if (duplicateVacancyIds.length > 0) {
    const existingScoreKeys = await prefetchExistingScores(
      duplicateVacancyIds,
      userId,
      searchProfileId
    );
    await batchEnsureVacancyScores(
      duplicateVacancyIds.map((vid) => ({
        vacancyId: vid,
        userId,
        searchProfileId,
      })),
      existingScoreKeys
    );
  }

  // Batch backfill tags for existing vacancies missing them
  // Run in parallel since updates are independent
  if (tagBackfillUpdates.length > 0) {
    await Promise.all(
      tagBackfillUpdates.map((u) => {
        const tags = tagVacancy(u.title, u.company, u.description);
        return prisma.vacancy.update({
          where: { id: u.id },
          data: {
            tagStack: tags.stack,
            tagLevel: tags.level,
            tagIndustry: tags.industry,
            tagTeamSize: tags.teamSize,
          },
        });
      })
    );
  }

  // Create new vacancies one by one (need returned IDs for score + match)
  // But batch the VacancyScore creation and matchUsersToVacancy after
  const newVacancyEntries: Array<{
    vacancyId: number;
    vacancy: ScrapedVacancy;
    isDuplicate: boolean;
  }> = [];

  for (const v of toCreate) {
    const duplicateOfId = findDuplicate(v, dedupVacancies);
    const eurSalary = computeEurSalary(
      v.salaryMin,
      v.salaryMax,
      v.salaryCurrency,
      v.salaryText
    );
    const tags = tagVacancy(v.title, v.company ?? "", v.description || "");

    try {
      const created = await prisma.vacancy.create({
        data: {
          platform: v.platform,
          externalId: v.externalId,
          url: v.url,
          title: v.title,
          company: v.company,
          location: v.location,
          salaryText: v.salaryText,
          salaryMin: v.salaryMin,
          salaryMax: v.salaryMax,
          salaryCurrency: v.salaryCurrency,
          salaryMinEur: eurSalary.minEur,
          salaryMaxEur: eurSalary.maxEur,
          remoteType: v.remoteType,
          employmentType: v.employmentType,
          description: v.description || "",
          language: v.language,
          postedAt: v.postedAt,
          isDuplicateOf: duplicateOfId,
          tagStack: tags.stack,
          tagLevel: tags.level,
          tagIndustry: tags.industry,
          tagTeamSize: tags.teamSize,
        },
      });

      // Update in-memory structures
      dedupVacancies.push({
        id: created.id,
        company: v.company,
        title: v.title,
        postedAt: v.postedAt,
      });
      existingByPlatformId.set(`${v.platform}::${v.externalId}`, {
        id: created.id,
        platform: v.platform,
        externalId: v.externalId,
        tagLevel: tags.level,
        title: v.title,
        company: v.company,
        description: v.description || "",
      });

      newVacancyEntries.push({
        vacancyId: created.id,
        vacancy: v,
        isDuplicate: !!duplicateOfId,
      });
    } catch (err) {
      console.error(
        `[save-vacancy] Create error for ${v.platform}/${v.externalId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Batch-create VacancyScore for all new non-duplicate vacancies
  const scoreEntries = newVacancyEntries
    .filter((e) => !e.isDuplicate)
    .map((e) => ({
      vacancyId: e.vacancyId,
      userId,
      searchProfileId,
    }));

  if (scoreEntries.length > 0) {
    await prisma.vacancyScore.createMany({
      data: scoreEntries.map((e) => ({
        vacancyId: e.vacancyId,
        userId: e.userId,
        searchProfileId: e.searchProfileId,
        matchScore: 0,
        scoredBy: "scraper",
      })),
      skipDuplicates: true,
    });
  }

  // Match other users in parallel for new non-duplicate vacancies
  const matchPromises = newVacancyEntries
    .filter((e) => !e.isDuplicate)
    .map((e) =>
      matchUsersToVacancy(e.vacancyId, e.vacancy, userId).catch((err) => {
        console.error(
          `[save-vacancy] matchUsersToVacancy error for vacancy ${e.vacancyId}:`,
          err instanceof Error ? err.message : err
        );
      })
    );

  if (matchPromises.length > 0) {
    await Promise.all(matchPromises);
  }

  newCount = newVacancyEntries.length;
  return { newCount, dupCount };
}
