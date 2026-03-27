import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, matchesTitle, fetchWithTimeout } from "./utils";

/**
 * NoDesk (nodesk.co) — remote jobs aggregator.
 * Public listings at https://nodesk.co/remote-jobs/
 * No auth required, no known API/RSS — HTML scraping.
 * ~2600 engineering jobs, good for remote EU/US tech roles.
 */

const BASE_URL = "https://nodesk.co/remote-jobs";
const DELAY_MS = 2000;

function extractJobsFromHtml(html: string): {
  id: string;
  url: string;
  title: string;
  company: string;
  location: string;
  salary: string | null;
}[] {
  const jobs: {
    id: string;
    url: string;
    title: string;
    company: string;
    location: string;
    salary: string | null;
  }[] = [];

  // NoDesk job links follow pattern: /remote-jobs/company-slug-job-title-slug/
  const jobPattern =
    /href="(\/remote-jobs\/[\w][\w-]+-[\w-]+\/)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = jobPattern.exec(html)) !== null) {
    const href = match[1];
    const linkContent = match[2];

    // Skip category/filter links (e.g. /remote-jobs/engineering/, /remote-jobs/europe/)
    const segments = href.replace(/^\/|\/$/g, "").split("/");
    if (segments.length < 2) continue;
    const slug = segments[segments.length - 1];
    // Category pages have single-word slugs; job pages have compound slugs with hyphens
    if (!slug.includes("-")) continue;

    const title = stripHtml(linkContent).trim();
    if (!title || title.length < 5) continue;

    // Try to find company name near the job link
    const pos = match.index;
    const regionStart = Math.max(0, pos - 800);
    const regionEnd = Math.min(html.length, pos + 1500);
    const region = html.substring(regionStart, regionEnd);

    // Company often in a separate link to /remote-companies/
    const companyMatch = region.match(
      /href="\/remote-companies\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i
    );
    const company = companyMatch ? stripHtml(companyMatch[1]).trim() : "Unknown";

    // Location tags
    const locationTags: string[] = [];
    const locPattern =
      /(?:class="[^"]*location[^"]*"|href="\/remote-jobs\/(?:europe|us|canada|worldwide|uk|asia)[^"]*")[^>]*>([\s\S]*?)<\/(?:a|span)/gi;
    let locMatch;
    while ((locMatch = locPattern.exec(region)) !== null) {
      const loc = stripHtml(locMatch[1]).trim();
      if (loc && !locationTags.includes(loc)) locationTags.push(loc);
    }

    // Salary
    const salaryMatch = region.match(/\$[\d,]+[kK]?\s*[-–]\s*\$[\d,]+[kK]?/);
    const salary = salaryMatch ? salaryMatch[0] : null;

    jobs.push({
      id: slug,
      url: `https://nodesk.co${href}`,
      title,
      company,
      location: locationTags.length > 0 ? locationTags.join(", ") : "Remote",
      salary,
    });
  }

  return jobs;
}

function parseSalaryRange(text: string | null): {
  min: number | null;
  max: number | null;
} {
  if (!text) return { min: null, max: null };
  const match = text.match(/\$([\d,]+)[kK]?\s*[-–]\s*\$([\d,]+)[kK]?/);
  if (!match) return { min: null, max: null };

  let min = parseFloat(match[1].replace(/,/g, ""));
  let max = parseFloat(match[2].replace(/,/g, ""));

  // If values look like they're in thousands (e.g. $145K)
  if (text.toLowerCase().includes("k")) {
    if (min < 1000) min *= 1000;
    if (max < 1000) max *= 1000;
  }

  return { min, max };
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log("[nodesk] Starting scrape...");

  const results: ScrapedVacancy[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const keyword = criteria.jobTitles[i];
    // NoDesk doesn't have search params — scrape the main listing page
    // and filter by title match. For engineering roles, use the category page.
    const url =
      keyword.toLowerCase().includes("engineer") ||
      keyword.toLowerCase().includes("developer") ||
      keyword.toLowerCase().includes("programming")
        ? `${BASE_URL}/engineering/`
        : `${BASE_URL}/`;

    try {
      const res = await fetchWithTimeout(url, {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!res.ok) {
        console.warn(`[nodesk] ${url} returned ${res.status}`);
        continue;
      }

      const html = await res.text();
      const jobs = extractJobsFromHtml(html);

      for (const job of jobs) {
        if (seenIds.has(job.id)) continue;
        if (!matchesTitle(job.title, [keyword])) continue;
        seenIds.add(job.id);

        const salary = parseSalaryRange(job.salary);

        results.push({
          platform: "nodesk",
          externalId: job.id,
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location,
          salaryText: job.salary,
          salaryMin: salary.min,
          salaryMax: salary.max,
          salaryCurrency: salary.min ? "USD" : null,
          remoteType: "remote",
          employmentType: "full-time",
          description: "",
          language: "en",
          postedAt: null,
        });
      }

      console.log(
        `[nodesk] "${keyword}": ${jobs.length} jobs parsed, ${results.length} matching so far`
      );
    } catch (err) {
      console.error(
        `[nodesk] Error for "${keyword}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(`[nodesk] Returning ${results.length} vacancies`);
  return results;
}
