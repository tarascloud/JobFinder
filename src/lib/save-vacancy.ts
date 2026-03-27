import { prisma } from "@/lib/db";
import type { ScrapedVacancy } from "@/lib/scrapers/types";
import { findDuplicate } from "@/lib/dedup";
import { computeEurSalary } from "@/lib/salary";
import { tagVacancy } from "@/lib/ai/tagger";

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
