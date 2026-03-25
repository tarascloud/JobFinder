import type { ScrapedVacancy, SearchCriteria } from "./types";
import { scrape as scrapeRemoteOK } from "./remoteok";
import { scrape as scrapeWWR } from "./weworkremotely";
import { scrape as scrapeIndeed } from "./indeed";
import { scrape as scrapeLinkedIn } from "./linkedin";
import { scrape as scrapeGlassdoor } from "./glassdoor";
import { scrape as scrapeWellfound } from "./wellfound";
import { scrape as scrapeHNWhoHiring } from "./hn-whohiring";
import { scrape as scrapeDjinni } from "./djinni";
import { scrape as scrapeStackOverflow } from "./stackoverflow";
import { scrape as scrapeZipRecruiter } from "./ziprecruiter";
import { scrape as scrapeGoogleJobs } from "./google-jobs";

export type { ScrapedVacancy, SearchCriteria } from "./types";

const scrapers = [
  { name: "remoteok", fn: scrapeRemoteOK },
  { name: "weworkremotely", fn: scrapeWWR },
  { name: "indeed", fn: scrapeIndeed },
  { name: "linkedin", fn: scrapeLinkedIn },
  { name: "glassdoor", fn: scrapeGlassdoor },
  { name: "wellfound", fn: scrapeWellfound },
  { name: "hn-whohiring", fn: scrapeHNWhoHiring },
  { name: "djinni", fn: scrapeDjinni },
  { name: "stackoverflow", fn: scrapeStackOverflow },
  { name: "ziprecruiter", fn: scrapeZipRecruiter },
  { name: "google-jobs", fn: scrapeGoogleJobs },
] as const;

export async function scrapeAll(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[scrapers] Starting scrape for ${criteria.jobTitles.length} job titles across ${scrapers.length} platforms`
  );
  const startTime = Date.now();
  const results: ScrapedVacancy[] = [];

  const settled = await Promise.allSettled(
    scrapers.map((s) =>
      s
        .fn(criteria)
        .catch((e) => {
          console.error(
            `[${s.name}] error:`,
            e instanceof Error ? e.message : e
          );
          return [] as ScrapedVacancy[];
        })
    )
  );

  for (const r of settled) {
    if (r.status === "fulfilled") {
      results.push(...r.value);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[scrapers] Completed in ${elapsed}s — ${results.length} total vacancies from ${scrapers.length} platforms`
  );

  return results;
}

export async function scrapePlatform(
  platform: string,
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  const scraper = scrapers.find((s) => s.name === platform);
  if (!scraper) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  return scraper.fn(criteria);
}
