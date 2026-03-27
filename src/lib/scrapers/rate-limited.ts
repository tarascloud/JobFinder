import type { ScrapedVacancy, SearchCriteria } from "./types";
import { scrapePlatform } from "./index";
import { delay } from "./utils";

/**
 * Platform-specific rate limit delays (in milliseconds).
 * These delays are applied BETWEEN platform requests to avoid
 * being rate-limited or blocked.
 *
 * JF-V2.2: Rate limiting between platform requests
 */
const PLATFORM_DELAYS: Record<string, number> = {
  linkedin: 5000,
  indeed: 3000,
  glassdoor: 3000,
};
const DEFAULT_DELAY = 1000;

/**
 * All platforms to scrape, in order.
 * Matches the list in scrapers/index.ts.
 */
const PLATFORMS = [
  "remoteok",
  "weworkremotely",
  "indeed",
  "linkedin",
  "glassdoor",
  "wellfound",
  "hn-whohiring",
  "djinni",
  "dou",
  "workua",
  "robotaua",
  "ziprecruiter",
  "dice",
  "simplyhired",
  "arcdev",
  "himalayas",
  "infojobs",
  "tecnoempleo",
  "jobatus",
  "computrabajo",
  "nodesk",
  "relocateme",
  "4dayweek",
  "euroremotejobs",
] as const;

/**
 * Scrape all platforms sequentially with rate limiting between requests.
 * Each platform scraper runs independently — if one fails, the error
 * is logged and scraping continues with the next platform (JF-V2.7).
 */
export async function scrapeAllWithRateLimit(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[rate-limited] Starting scrape for ${criteria.jobTitles.length} job titles across ${PLATFORMS.length} platforms`
  );
  const startTime = Date.now();
  const results: ScrapedVacancy[] = [];

  for (let i = 0; i < PLATFORMS.length; i++) {
    const platform = PLATFORMS[i];

    // Rate limiting delay before each platform (except the first)
    if (i > 0) {
      const delayMs = PLATFORM_DELAYS[platform] ?? DEFAULT_DELAY;
      await delay(delayMs);
    }

    try {
      const vacancies = await scrapePlatform(platform, criteria);
      console.log(`[rate-limited] ${platform}: ${vacancies.length} vacancies`);
      results.push(...vacancies);
    } catch (err) {
      // JF-V2.7: Log error and continue to next platform
      console.error(
        `[rate-limited] ${platform}: FAILED —`,
        err instanceof Error ? err.message : err
      );
      // Don't retry — the next hourly run will try again
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[rate-limited] Completed in ${elapsed}s — ${results.length} total vacancies`
  );

  return results;
}
