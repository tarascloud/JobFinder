import type { ScrapedVacancy, SearchCriteria } from "./types";

/**
 * StackOverflow Jobs was shut down in March 2022.
 * The stackoverflow.com/jobs URL now redirects to other job boards.
 *
 * This scraper is kept as a placeholder. It logs a notice and returns
 * an empty array. If StackOverflow relaunches a jobs product in the
 * future, this can be updated to scrape it.
 */
export async function scrape(
  _criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    "[stackoverflow] StackOverflow Jobs is defunct (shut down March 2022). Returning empty results."
  );
  return [];
}
