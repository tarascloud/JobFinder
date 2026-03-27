import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, matchesTitle } from "./utils";

const BASE_URL = "https://robota.ua/zapros";
const DELAY_MS = 3000;

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // Robota.ua formats: "50 000 – 80 000 грн", "від 50 000 грн", "$3000-5000"
  const uahRange = text.match(
    /([\d\s]+)\s*[-–—]\s*([\d\s]+)\s*грн/i
  );
  if (uahRange) {
    const min = parseFloat(uahRange[1].replace(/\s/g, ""));
    const max = parseFloat(uahRange[2].replace(/\s/g, ""));
    return { min, max, currency: "UAH" };
  }

  const uahSingle = text.match(/([\d\s]+)\s*грн/i);
  if (uahSingle) {
    const val = parseFloat(uahSingle[1].replace(/\s/g, ""));
    return { min: val, max: val, currency: "UAH" };
  }

  const usdRange = text.match(
    /\$\s*([\d\s,]+)\s*[-–—]\s*\$?\s*([\d\s,]+)/
  );
  if (usdRange) {
    const min = parseFloat(usdRange[1].replace(/[\s,]/g, ""));
    const max = parseFloat(usdRange[2].replace(/[\s,]/g, ""));
    return { min, max, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

interface RobotaJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
}

/**
 * Robota.ua renders job cards with Next.js/SSR.
 * Job cards contain:
 *  - alliance-vacancy-card or santa-vacancy-card components
 *  - h2 with title link
 *  - company name in separate element
 *  - salary, location, date
 *
 * The site also has an internal API at /api/vacancy/search
 * but it requires specific headers. We parse HTML as fallback.
 */
function parseJobListings(html: string): RobotaJob[] {
  const jobs: RobotaJob[] = [];
  const seenIds = new Set<string>();

  // Robota.ua vacancy links: /company12345/vacancy12345 or /zapros/keyword/vacancy12345
  const jobLinkPattern = /href="[^"]*\/vacancy(\d+)[^"]*"/gi;
  let linkMatch;

  while ((linkMatch = jobLinkPattern.exec(html)) !== null) {
    const id = linkMatch[1];
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    // Find card region around this link
    const pos = linkMatch.index;
    const regionStart = Math.max(0, pos - 1000);
    const regionEnd = Math.min(html.length, pos + 2000);
    const region = html.substring(regionStart, regionEnd);

    // Extract title — usually in h2 or a with vacancy title
    const titleMatch =
      region.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
      region.match(/class="[^"]*vacancy-card__title[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*card-title[^"]*"[^>]*>([\s\S]*?)<\//i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    // Extract company
    const companyMatch =
      region.match(/class="[^"]*company-name[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*vacancy-card__company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<a[^>]+href="\/company\d+"[^>]*>([\s\S]*?)<\/a>/i);
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    // Extract location
    const locationMatch =
      region.match(/class="[^"]*city[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i);
    const location = locationMatch ? stripHtml(locationMatch[1]) : "Ukraine";

    // Extract salary
    const salaryMatch =
      region.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/([\d\s]+[-–—][\d\s]+\s*грн)/i) ||
      region.match(/(\$[\d\s,]+[-–]\$?[\d\s,]+)/i);
    const salaryText = salaryMatch ? stripHtml(salaryMatch[1]).trim() : null;

    // Extract date
    const dateMatch =
      region.match(/datetime="([^"]+)"/i) ||
      region.match(/class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\//i);
    let postedAt: Date | null = null;
    if (dateMatch) {
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed.getTime())) postedAt = parsed;
    }

    // Extract description snippet
    const descMatch =
      region.match(/class="[^"]*vacancy-card__description[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\//i);
    const description = descMatch ? stripHtml(descMatch[1]) : "";

    // Build full URL
    const hrefMatch = html
      .substring(pos, pos + 500)
      .match(/href="([^"]*vacancy\d+[^"]*)"/i);
    const fullHref = hrefMatch ? hrefMatch[1] : `/vacancy${id}`;

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText: salaryText || null,
      url: fullHref.startsWith("http")
        ? fullHref
        : `https://robota.ua${fullHref}`,
      description,
      postedAt,
    });
  }

  return jobs;
}

function buildSearchSlug(title: string): string {
  // Robota.ua uses URL slugs: /zapros/frontend-developer/ukraine
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

async function searchRobota(keyword: string): Promise<RobotaJob[]> {
  const slug = buildSearchSlug(keyword);
  const url = `${BASE_URL}/${slug}/ukraine?scheduleIds=3`; // scheduleIds=3 = remote
  console.log(`[robotaua] Fetching: ${keyword} -> ${url}`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://robota.ua/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[robotaua] Search for "${keyword}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[robotaua] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[robotaua] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: RobotaJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchRobota(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[robotaua] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[robotaua] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[robotaua] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    // Determine remote type from location text
    const locationLower = (job.location || "").toLowerCase();
    let remoteType: string | null = "remote"; // default since we filter for remote
    if (locationLower.includes("hybrid") || locationLower.includes("гібрид")) {
      remoteType = "hybrid";
    }

    results.push({
      platform: "robotaua",
      externalId: job.externalId,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      salaryText: job.salaryText,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      remoteType,
      employmentType: null,
      description: job.description,
      language: "uk",
      postedAt: job.postedAt,
    });
  }

  console.log(`[robotaua] Returning ${results.length} vacancies`);
  return results;
}
