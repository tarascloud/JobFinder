import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, matchesTitle } from "./utils";

const BASE_URL = "https://www.work.ua/en/jobs-remote/";
const DELAY_MS = 3000;

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // Work.ua formats: "від 50 000 грн", "50 000 – 80 000 грн", "$3000-5000"
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

  const usdSingle = text.match(/\$\s*([\d\s,]+)/);
  if (usdSingle) {
    const val = parseFloat(usdSingle[1].replace(/[\s,]/g, ""));
    return { min: val, max: val, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

interface WorkUaJob {
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
 * Work.ua job cards use .card.card-hover containers with:
 *  - h2 > a (job title + link)
 *  - .add-top-xs b (company name)
 *  - .text-muted (location + other info)
 *  - .overflow (description snippet)
 *  - salary in the title/subtitle area
 */
function parseJobListings(html: string): WorkUaJob[] {
  const jobs: WorkUaJob[] = [];
  const seenIds = new Set<string>();

  // Find job links: /en/jobs/12345/
  const jobLinkPattern = /href="(\/en\/jobs\/(\d+)\/?)"[^>]*>/gi;
  let linkMatch;

  while ((linkMatch = jobLinkPattern.exec(html)) !== null) {
    const [, href, id] = linkMatch;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    // Find card region around this link
    const pos = linkMatch.index;
    const regionStart = Math.max(0, pos - 500);
    const regionEnd = Math.min(html.length, pos + 2000);
    const region = html.substring(regionStart, regionEnd);

    // Extract title from link text
    const titleMatch = region.match(
      new RegExp(
        `href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([\\s\\S]*?)<\\/a>`,
        "i"
      )
    );
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    // Extract company
    const companyMatch =
      region.match(/<b\s[^>]*class="[^"]*"[^>]*><a[^>]*>([\s\S]*?)<\/a><\/b>/i) ||
      region.match(/<span\s[^>]*class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
      region.match(/class="[^"]*add-top-xs[^"]*"[^>]*>\s*<b>([\s\S]*?)<\/b>/i);
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    // Extract location (text-muted spans)
    const locationMatch = region.match(
      /class="[^"]*text-muted[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const location = locationMatch ? stripHtml(locationMatch[1]) : "Ukraine";

    // Extract salary
    const salaryMatch =
      region.match(/<b\s[^>]*class="[^"]*text-black[^"]*"[^>]*>([\s\S]*?)<\/b>/i) ||
      region.match(/(\d[\d\s]*[-–—]\s*\d[\d\s]*\s*грн)/i) ||
      region.match(/(\$[\d\s,]+\s*[-–]\s*\$?[\d\s,]+)/i);
    const salaryText = salaryMatch ? stripHtml(salaryMatch[1]).trim() : null;

    // Extract description snippet
    const descMatch = region.match(
      /class="[^"]*overflow[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const description = descMatch ? stripHtml(descMatch[1]) : "";

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText: salaryText || null,
      url: `https://www.work.ua${href}`,
      description,
      postedAt: null, // Work.ua doesn't show exact dates in listings
    });
  }

  return jobs;
}

function mapSearchQuery(title: string): string {
  // Work.ua uses plain text search queries
  const lower = title.toLowerCase();
  // Keep original for most terms, map some specifics
  const mappings: Record<string, string> = {
    "full stack": "fullstack",
    "front-end": "frontend",
    "back-end": "backend",
    "ui/ux": "UI UX designer",
    "react native": "react native",
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (lower.includes(key)) return value;
  }

  return title;
}

async function searchWorkUa(keyword: string): Promise<WorkUaJob[]> {
  const query = mapSearchQuery(keyword);
  // Work.ua English remote jobs URL with search
  const url = `${BASE_URL}?search=${encodeURIComponent(query)}`;
  console.log(`[workua] Fetching: ${keyword} -> ${url}`);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,uk;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.work.ua/en/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[workua] Search for "${keyword}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[workua] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[workua] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: WorkUaJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchWorkUa(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[workua] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[workua] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[workua] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    results.push({
      platform: "workua",
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
      language: "uk",
      postedAt: job.postedAt,
    });
  }

  console.log(`[workua] Returning ${results.length} vacancies`);
  return results;
}
