/**
 * Smart cross-platform vacancy deduplication.
 *
 * The same job may appear on LinkedIn AND Indeed with different externalIds.
 * This module detects duplicates by comparing company name + title + post date.
 */

import type { ScrapedVacancy } from "@/lib/scrapers/types";

/** Suffixes to strip when normalizing company names */
const COMPANY_SUFFIXES =
  /,?\s*(inc\.?|ltd\.?|gmbh|llc|corp\.?|co\.?|plc|ag|sa|s\.?a\.?|bv|b\.?v\.?|limited|s\.?l\.?|s\.?r\.?l\.?)$/i;

/**
 * Normalize company name for fuzzy matching:
 * - lowercase, trim
 * - remove legal entity suffixes (Inc, Ltd, GmbH, etc.)
 */
export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(COMPANY_SUFFIXES, "")
    .trim();
}

/**
 * Calculate word overlap ratio between two titles.
 * Returns a number between 0 and 1.
 * E.g., "Senior Software Engineer" vs "Software Engineer" => 2/3 = 0.67
 */
export function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(
    a
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
  );

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  // Use the smaller set as denominator so "Software Engineer" matches
  // "Senior Software Engineer" at 100% from the shorter side
  const minSize = Math.min(wordsA.size, wordsB.size);
  return overlap / minSize;
}

interface ExistingVacancy {
  id: number;
  company: string | null;
  title: string;
  postedAt: Date | null;
}

/**
 * Find a duplicate vacancy across platforms.
 *
 * Matching criteria (all must match):
 * 1. Same company name (fuzzy: normalized, stripped of suffixes)
 * 2. Similar title (>80% word overlap)
 * 3. Posted within 7 days of each other
 *
 * Returns the id of the duplicate vacancy, or null if no match.
 */
export function findDuplicate(
  vacancy: ScrapedVacancy,
  existingVacancies: ExistingVacancy[]
): number | null {
  if (!vacancy.company) return null;

  const normalizedCompany = normalizeCompany(vacancy.company);
  if (!normalizedCompany) return null;

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  for (const existing of existingVacancies) {
    // 1. Company match
    if (!existing.company) continue;
    const existingNormalized = normalizeCompany(existing.company);
    if (normalizedCompany !== existingNormalized) continue;

    // 2. Title similarity > 80%
    const similarity = titleSimilarity(vacancy.title, existing.title);
    if (similarity < 0.8) continue;

    // 3. Posted within 7 days of each other
    if (vacancy.postedAt && existing.postedAt) {
      const diff = Math.abs(
        vacancy.postedAt.getTime() - existing.postedAt.getTime()
      );
      if (diff > SEVEN_DAYS_MS) continue;
    }
    // If either date is missing, skip date check (still match on company+title)

    return existing.id;
  }

  return null;
}
