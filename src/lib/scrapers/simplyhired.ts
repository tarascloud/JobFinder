import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, matchesTitle } from "./utils";

const BASE_URL = "https://www.simplyhired.com/search";
const DELAY_MS = 3000;

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // SimplyHired formats: "$120,000 - $150,000 a year", "$50 - $70 an hour"
  const yearlyRange = text.match(
    /\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)\s*(?:a\s*year|annually|per\s*year)/i
  );
  if (yearlyRange) {
    return {
      min: parseFloat(yearlyRange[1].replace(/,/g, "")),
      max: parseFloat(yearlyRange[2].replace(/,/g, "")),
      currency: "USD",
    };
  }

  const hourlyRange = text.match(
    /\$\s*([\d,.]+)\s*[-–—]\s*\$?\s*([\d,.]+)\s*(?:an?\s*hour|hourly|per\s*hour|\/hr)/i
  );
  if (hourlyRange) {
    const min = parseFloat(hourlyRange[1].replace(/,/g, "")) * 2080;
    const max = parseFloat(hourlyRange[2].replace(/,/g, "")) * 2080;
    return { min, max, currency: "USD" };
  }

  const range = text.match(
    /\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/
  );
  if (range) {
    const min = parseFloat(range[1].replace(/,/g, ""));
    const max = parseFloat(range[2].replace(/,/g, ""));
    return { min, max, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

interface SimplyHiredJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
}

function parseJobListings(html: string): SimplyHiredJob[] {
  const jobs: SimplyHiredJob[] = [];
  const seenIds = new Set<string>();

  // SimplyHired job cards: data-jobkey="xxx" or /job/xxx links
  const jobKeyPattern = /data-jobkey="([^"]+)"/gi;
  const jobLinkPattern = /href="(\/job\/([\w-]+)[^"]*)"/gi;

  // Try data-jobkey first
  for (const match of html.matchAll(jobKeyPattern)) {
    const id = match[1];
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const pos = match.index;
    const regionStart = Math.max(0, pos - 200);
    const regionEnd = Math.min(html.length, pos + 2000);
    const region = html.substring(regionStart, regionEnd);

    const job = parseCardRegion(region, id);
    if (job) jobs.push(job);
  }

  // Also try job links
  for (const match of html.matchAll(jobLinkPattern)) {
    const [, href, id] = match;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const pos = match.index;
    const regionStart = Math.max(0, pos - 500);
    const regionEnd = Math.min(html.length, pos + 2000);
    const region = html.substring(regionStart, regionEnd);

    const job = parseCardRegion(region, id, href);
    if (job) jobs.push(job);
  }

  return jobs;
}

function parseCardRegion(
  region: string,
  id: string,
  href?: string
): SimplyHiredJob | null {
  // Title
  const titleMatch =
    region.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
    region.match(/class="[^"]*jobposting-title[^"]*"[^>]*>([\s\S]*?)<\//i) ||
    region.match(/<a[^>]+data-testid="searchSerpJobTitle"[^>]*>([\s\S]*?)<\/a>/i) ||
    region.match(/class="[^"]*card-title[^"]*"[^>]*>([\s\S]*?)<\//i);
  const title = titleMatch ? stripHtml(titleMatch[1]) : "";
  if (!title) return null;

  // Company
  const companyMatch =
    region.match(/class="[^"]*jobposting-company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
    region.match(/data-testid="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
    region.match(/<span[^>]+class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

  // Location
  const locationMatch =
    region.match(/class="[^"]*jobposting-location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
    region.match(/data-testid="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
    region.match(/<span[^>]+class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const location = locationMatch ? stripHtml(locationMatch[1]) : "Remote";

  // Salary
  const salaryMatch =
    region.match(/class="[^"]*jobposting-salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
    region.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
    region.match(/data-testid="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i);
  const salaryText = salaryMatch ? stripHtml(salaryMatch[1]).trim() : null;

  // Description
  const descMatch =
    region.match(/class="[^"]*jobposting-snippet[^"]*"[^>]*>([\s\S]*?)<\//i) ||
    region.match(/<p[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const description = descMatch ? stripHtml(descMatch[1]) : "";

  const jobUrl = href
    ? `https://www.simplyhired.com${href}`
    : `https://www.simplyhired.com/job/${id}`;

  return {
    externalId: id,
    title,
    company,
    location,
    salaryText: salaryText || null,
    url: jobUrl,
    description,
    postedAt: null,
  };
}

async function searchSimplyHired(
  keyword: string
): Promise<SimplyHiredJob[]> {
  const params = new URLSearchParams({
    q: keyword,
    l: "remote",
    fdb: "7", // last 7 days
  });

  const url = `${BASE_URL}?${params.toString()}`;
  console.log(`[simplyhired] Fetching: ${keyword}`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.simplyhired.com/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(
        `[simplyhired] Search for "${keyword}" returned ${res.status}`
      );
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[simplyhired] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[simplyhired] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: SimplyHiredJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchSimplyHired(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[simplyhired] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[simplyhired] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[simplyhired] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    results.push({
      platform: "simplyhired",
      externalId: job.externalId,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      salaryText: job.salaryText,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      remoteType: "remote",
      employmentType: null,
      description: job.description,
      language: "en",
      postedAt: job.postedAt,
    });
  }

  console.log(`[simplyhired] Returning ${results.length} vacancies`);
  return results;
}
