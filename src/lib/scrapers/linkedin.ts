import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, fetchWithTimeout } from "./utils";

const SEARCH_URL =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const MAX_REQUESTS_PER_SEARCH = 3;
const DELAY_BETWEEN_REQUESTS_MS = 2000;
const RESULTS_PER_PAGE = 25;


interface LinkedInJob {
  externalId: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  postedAt: Date | null;
}

function parseRelativeDate(text: string): Date | null {
  const now = new Date();
  const lower = text.toLowerCase().trim();

  const hoursMatch = lower.match(/(\d+)\s*hour/);
  if (hoursMatch) {
    now.setHours(now.getHours() - parseInt(hoursMatch[1]));
    return now;
  }

  const daysMatch = lower.match(/(\d+)\s*day/);
  if (daysMatch) {
    now.setDate(now.getDate() - parseInt(daysMatch[1]));
    return now;
  }

  const weeksMatch = lower.match(/(\d+)\s*week/);
  if (weeksMatch) {
    now.setDate(now.getDate() - parseInt(weeksMatch[1]) * 7);
    return now;
  }

  const monthsMatch = lower.match(/(\d+)\s*month/);
  if (monthsMatch) {
    now.setMonth(now.getMonth() - parseInt(monthsMatch[1]));
    return now;
  }

  return null;
}

function parseJobCards(html: string): LinkedInJob[] {
  const jobs: LinkedInJob[] = [];

  // LinkedIn job cards contain base-card or job-search-card classes
  // Each card has a data-entity-urn with the job ID
  const cardPattern =
    /data-entity-urn="urn:li:jobPosting:(\d+)"[\s\S]*?<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]*)"[\s\S]*?<\/a>/gi;

  // Try to find job cards with different patterns
  // Pattern 1: data-entity-urn based
  const urnPattern = /data-entity-urn="urn:li:jobPosting:(\d+)"/g;
  const urns: string[] = [];
  let urnMatch;
  while ((urnMatch = urnPattern.exec(html)) !== null) {
    if (!urns.includes(urnMatch[1])) {
      urns.push(urnMatch[1]);
    }
  }

  for (const jobId of urns) {
    // Find the card region for this job
    const startPos = html.indexOf(`urn:li:jobPosting:${jobId}`);
    if (startPos < 0) continue;

    // Get a reasonable chunk around this job card
    const regionStart = Math.max(0, startPos - 200);
    const regionEnd = Math.min(html.length, startPos + 2000);
    const region = html.substring(regionStart, regionEnd);

    // Extract title
    const titleMatch = region.match(
      /base-search-card__title[^>]*>([\s\S]*?)<\//i
    );
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    // Extract company
    const companyMatch = region.match(
      /base-search-card__subtitle[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i
    ) || region.match(
      /base-search-card__subtitle[^>]*>([\s\S]*?)<\//i
    );
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    // Extract location
    const locationMatch = region.match(
      /job-search-card__location[^>]*>([\s\S]*?)<\//i
    );
    const location = locationMatch ? stripHtml(locationMatch[1]) : null;

    // Extract URL
    const urlMatch = region.match(
      /href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]*)"/i
    );
    const url = urlMatch
      ? urlMatch[1].split("?")[0] // Remove tracking params
      : `https://www.linkedin.com/jobs/view/${jobId}`;

    // Extract date — try multiple patterns
    const dateMatch = region.match(
      /datetime="([^"]+)"/i
    );
    const dateTextMatch = region.match(
      /job-search-card__listdate[^>]*>([\s\S]*?)<\//i
    );
    const timeAgoMatch = region.match(
      /(\d+)\s*(hour|day|week|month)s?\s*ago/i
    );

    let postedAt: Date | null = null;
    if (dateMatch) {
      postedAt = new Date(dateMatch[1]);
    } else if (dateTextMatch) {
      postedAt = parseRelativeDate(stripHtml(dateTextMatch[1]));
    } else if (timeAgoMatch) {
      postedAt = parseRelativeDate(timeAgoMatch[0]);
    }
    // Fallback: if no date found, use current time (better than null for sorting)
    if (!postedAt) {
      postedAt = new Date();
    }

    jobs.push({
      externalId: jobId,
      title,
      company,
      location,
      url,
      postedAt,
    });
  }

  return jobs;
}

async function searchLinkedIn(
  query: string,
  location: string
): Promise<LinkedInJob[]> {
  const allJobs: LinkedInJob[] = [];
  const seenIds = new Set<string>();

  for (let page = 0; page < MAX_REQUESTS_PER_SEARCH; page++) {
    const start = page * RESULTS_PER_PAGE;

    const params = new URLSearchParams({
      keywords: query,
      location: location,
      f_WT: "2", // Remote filter
      start: String(start),
      sortBy: "DD", // Most recent
    });

    const url = `${SEARCH_URL}?${params.toString()}`;
    console.log(
      `[linkedin] Fetching page ${page + 1} for "${query}"...`
    );

    try {
      const res = await fetchWithTimeout(url, {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      if (!res.ok) {
        console.warn(
          `[linkedin] Page ${page + 1} returned ${res.status}, stopping pagination`
        );
        break;
      }

      const html = await res.text();
      if (!html.trim()) {
        console.log(`[linkedin] Empty response on page ${page + 1}, stopping`);
        break;
      }

      const jobs = parseJobCards(html);
      if (jobs.length === 0) {
        console.log(
          `[linkedin] No jobs found on page ${page + 1}, stopping pagination`
        );
        break;
      }

      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }

      console.log(
        `[linkedin] Page ${page + 1}: found ${jobs.length} jobs (total: ${allJobs.length})`
      );
    } catch (err) {
      console.error(
        `[linkedin] Error on page ${page + 1}:`,
        err instanceof Error ? err.message : err
      );
      break;
    }

    // Rate limiting between pages
    if (page < MAX_REQUESTS_PER_SEARCH - 1) {
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  return allJobs;
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[linkedin] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: LinkedInJob[] = [];
  const seenIds = new Set<string>();

  // Determine search location
  const location =
    criteria.geographies.length > 0 && !criteria.remoteOnly
      ? criteria.geographies[0]
      : "Remote";

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchLinkedIn(title, location);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(
        `[linkedin] "${title}": found ${jobs.length} unique jobs`
      );
    } catch (err) {
      console.error(
        `[linkedin] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    // Delay between different searches
    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  console.log(
    `[linkedin] Total unique jobs: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = allJobs.map((job) => ({
    platform: "linkedin",
    externalId: job.externalId,
    url: job.url,
    title: job.title,
    company: job.company,
    location: job.location,
    salaryText: null, // LinkedIn doesn't show salary in search results
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    remoteType: "remote",
    employmentType: null,
    description: "", // Would need detail page fetch for full description
    language: "en",
    postedAt: job.postedAt,
  }));

  console.log(`[linkedin] Returning ${results.length} vacancies`);
  return results;
}
