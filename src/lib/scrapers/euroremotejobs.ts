import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { matchesTitle, fetchWithTimeout } from "./utils";

/**
 * EuroRemoteJobs (euroremotejobs.com) — remote jobs in Europe.
 * WordPress-based site with public job listings.
 * No auth required, HTML scraping.
 * Job cards use WP Job Manager classes.
 */

const BASE_URL = "https://euroremotejobs.com";

interface ParsedJob {
  id: string;
  url: string;
  title: string;
  company: string;
  location: string;
  jobType: string | null;
}

function extractJobsFromHtml(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const seen = new Set<string>();

  // WP Job Manager uses <li> elements with job listings inside
  // Job links: /job/[job-slug]/
  const linkPattern = /href="(https?:\/\/euroremotejobs\.com\/job\/([\w-]+)\/?)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1];
    const slug = match[2];
    const linkText = stripHtml(match[3]).trim();

    if (seen.has(slug)) continue;
    if (!linkText || linkText.length < 5) continue;
    seen.add(slug);

    // Look around the link for more context
    const pos = match.index;
    const regionStart = Math.max(0, pos - 600);
    const regionEnd = Math.min(html.length, pos + 1200);
    const region = html.substring(regionStart, regionEnd);

    // Title from listing-title h4 or the link text itself
    const titleMatch = region.match(
      /class="[^"]*listing-title[^"]*"[^>]*>[\s\S]*?<h\d[^>]*>([\s\S]*?)<\/h\d>/i
    );
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : linkText;

    // Company name
    const companyMatch =
      region.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*employer[^"]*"[^>]*>([\s\S]*?)<\//i);
    const company = companyMatch
      ? stripHtml(companyMatch[1]).trim()
      : "Unknown";

    // Location
    const locationMatch = region.match(
      /class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const location = locationMatch
      ? stripHtml(locationMatch[1]).trim()
      : "Remote (Europe)";

    // Job type badge
    const typeMatch = region.match(
      /class="[^"]*job[_-]?type[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const jobType = typeMatch ? stripHtml(typeMatch[1]).trim().toLowerCase() : null;

    jobs.push({
      id: slug,
      url,
      title,
      company,
      location: location || "Remote (Europe)",
      jobType,
    });
  }

  return jobs;
}

function normalizeEmploymentType(
  jobType: string | null
): string {
  if (!jobType) return "full-time";
  const t = jobType.toLowerCase();
  if (t.includes("part")) return "part-time";
  if (t.includes("contract") || t.includes("freelance")) return "contract";
  if (t.includes("intern")) return "internship";
  return "full-time";
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log("[euroremotejobs] Starting scrape...");

  try {
    // The homepage lists recent jobs; also try with search param
    const searchParam =
      criteria.jobTitles.length > 0
        ? `/?s=${encodeURIComponent(criteria.jobTitles[0])}&post_type=job_listing`
        : "";

    const url = `${BASE_URL}${searchParam}`;

    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      console.warn(`[euroremotejobs] Returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    const jobs = extractJobsFromHtml(html);
    console.log(`[euroremotejobs] Parsed ${jobs.length} jobs, filtering...`);

    const results: ScrapedVacancy[] = [];

    for (const job of jobs) {
      if (!matchesTitle(job.title, criteria.jobTitles)) continue;

      results.push({
        platform: "euroremotejobs",
        externalId: job.id,
        url: job.url,
        title: job.title,
        company: job.company,
        location: job.location,
        salaryText: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        remoteType: "remote",
        employmentType: normalizeEmploymentType(job.jobType),
        description: "",
        language: "en",
        postedAt: null,
      });
    }

    console.log(`[euroremotejobs] Returning ${results.length} vacancies`);
    return results;
  } catch (err) {
    console.error(
      "[euroremotejobs] Error:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
