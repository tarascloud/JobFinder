import type { ScrapedVacancy, SearchCriteria } from "./types";
import { scrape as scrapeRemoteOK } from "./remoteok";
import { scrape as scrapeWWR } from "./weworkremotely";
import { scrape as scrapeIndeed } from "./indeed";
import { scrape as scrapeLinkedIn } from "./linkedin";
import { scrape as scrapeGlassdoor } from "./glassdoor";
import { scrape as scrapeWellfound } from "./wellfound";
import { scrape as scrapeHNWhoHiring } from "./hn-whohiring";
import { scrape as scrapeDjinni } from "./djinni";
import { scrape as scrapeDou } from "./dou";
import { scrape as scrapeZipRecruiter } from "./ziprecruiter";
import { scrape as scrapeWorkUa } from "./workua";
import { scrape as scrapeRobotaUa } from "./robotaua";
import { scrape as scrapeDice } from "./dice";
import { scrape as scrapeSimplyHired } from "./simplyhired";
import { scrape as scrapeArcDev } from "./arcdev";
import { scrape as scrapeHimalayas } from "./himalayas";
import { scrape as scrapeInfoJobs } from "./infojobs";
import { scrape as scrapeTecnoempleo } from "./tecnoempleo";
import { scrape as scrapeJobatus } from "./jobatus";
import { scrape as scrapeComputrabajo } from "./computrabajo";
import { scrape as scrapeNoDesk } from "./nodesk";
import { scrape as scrapeRelocateMe } from "./relocateme";
import { scrape as scrapeFourDayWeek } from "./fourdayweek";
import { scrape as scrapeEuroRemoteJobs } from "./euroremotejobs";
import { scrape as scrapeCareerPages } from "./career-pages";

export type { ScrapedVacancy, SearchCriteria } from "./types";

/**
 * Scraper reliability notes (as of 2026-03):
 *
 * RELIABLE (have public APIs or RSS feeds):
 *  - remoteok: JSON API, no auth needed. Works well.
 *  - weworkremotely: RSS feeds, no auth. Works well.
 *  - hn-whohiring: Algolia HN API. Works well.
 *  - linkedin: Guest job search API. Works, but may rate-limit.
 *  - himalayas: JSON API, no auth needed. Works well.
 *  - arcdev: RSS feed, fallback to HTML. Works well.
 *  - dice: DHI Group search API (public key). Works well for US tech.
 *
 * MODERATE (HTML scraping, usually works):
 *  - djinni: Works sometimes, depends on IP/region. Major UA tech board.
 *  - dou: HTML scraping, may need category mapping. Major UA board.
 *  - workua: HTML scraping, Ukrainian job board. Largest UA platform.
 *  - robotaua: HTML scraping, Ukrainian job board. Second largest UA platform.
 *  - simplyhired: Job aggregator, HTML scraping. May have bot detection.
 *  - infojobs: #1 Spanish job board, HTML scraping. May have bot detection.
 *  - tecnoempleo: Spanish tech/IT board, HTML scraping. Usually works.
 *  - jobatus: Spanish job aggregator, HTML scraping. Usually works.
 *  - computrabajo: Spanish/LATAM job board, HTML scraping. May have bot detection.
 *  - nodesk: Remote jobs aggregator, HTML scraping. Public listings, no auth.
 *  - relocateme: Relocation-focused tech jobs. Small catalog (~45), public HTML.
 *  - 4dayweek: 4-day week remote jobs. Preloaded JSON state, public.
 *  - euroremotejobs: EU remote jobs, WordPress-based. HTML scraping.
 *
 * UNRELIABLE (HTML scraping, often blocked):
 *  - indeed: Aggressive bot detection, often returns 0 results.
 *  - glassdoor: Heavy JS rendering, HTML parsing often finds 0 jobs.
 *  - wellfound: API returns non-JSON, HTML scraping depends on page structure.
 *  - ziprecruiter: Bot detection, often returns empty or blocked pages.
 *  - google-jobs: Almost always blocked by CAPTCHA.
 *
 * DEFUNCT:
 *  - stackoverflow: Jobs shut down March 2022. Always returns [].
 */
const scrapers = [
  { name: "remoteok", fn: scrapeRemoteOK },
  { name: "weworkremotely", fn: scrapeWWR },
  { name: "indeed", fn: scrapeIndeed },
  { name: "linkedin", fn: scrapeLinkedIn },
  { name: "glassdoor", fn: scrapeGlassdoor },
  { name: "wellfound", fn: scrapeWellfound },
  { name: "hn-whohiring", fn: scrapeHNWhoHiring },
  { name: "djinni", fn: scrapeDjinni },
  { name: "dou", fn: scrapeDou },
  { name: "workua", fn: scrapeWorkUa },
  { name: "robotaua", fn: scrapeRobotaUa },
  { name: "ziprecruiter", fn: scrapeZipRecruiter },
  { name: "dice", fn: scrapeDice },
  { name: "simplyhired", fn: scrapeSimplyHired },
  { name: "arcdev", fn: scrapeArcDev },
  { name: "himalayas", fn: scrapeHimalayas },
  { name: "infojobs", fn: scrapeInfoJobs },
  { name: "tecnoempleo", fn: scrapeTecnoempleo },
  { name: "jobatus", fn: scrapeJobatus },
  { name: "computrabajo", fn: scrapeComputrabajo },
  { name: "nodesk", fn: scrapeNoDesk },
  { name: "relocateme", fn: scrapeRelocateMe },
  { name: "4dayweek", fn: scrapeFourDayWeek },
  { name: "euroremotejobs", fn: scrapeEuroRemoteJobs },
  { name: "career-pages", fn: scrapeCareerPages },
  // Disabled: StackOverflow Jobs shut down in March 2022 — always returns [].
  // Disabled: Google Jobs is almost always blocked by CAPTCHA.
  // Scraper files kept in ./stackoverflow and ./google-jobs for reference.
  //
  // Platforms considered but NOT added (research notes, 2026-03):
  //
  // SKIPPED — requires auth/subscription:
  //  - FlexJobs (flexjobs.com) — subscription required for full listings.
  //  - Otta (app.otta.com) — requires login, no public API or RSS.
  //  - Toptal (toptal.com/freelance-jobs) — requires login for most listings.
  //  - Upwork (upwork.com) — aggressive bot detection, ToS prohibits scraping.
  //  - Freelancer (freelancer.com) — heavy bot detection, slow API approval.
  //  - Lemon.io (lemon.io) — no public job listings, talent-matching model.
  //
  // SKIPPED — bot protection / no public access:
  //  - Jooble (jooble.org) — returns 403, aggressive bot detection. Has partner API but requires approval.
  //  - EURES (eures.europa.eu) — heavy JS SPA, no discoverable REST API, page loads CSS only without JS engine.
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

  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    const name = scrapers[i].name;
    if (r.status === "fulfilled") {
      console.log(`[scrapers] ${name}: ${r.value.length} vacancies`);
      results.push(...r.value);
    } else {
      console.error(`[scrapers] ${name}: FAILED — ${r.reason}`);
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
