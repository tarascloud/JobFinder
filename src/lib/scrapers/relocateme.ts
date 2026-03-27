import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { matchesTitle, fetchWithTimeout } from "./utils";

/**
 * Relocate.me — relocation-focused tech jobs platform.
 * Public job listings at https://relocate.me/search
 * No auth required, HTML scraping.
 * URL pattern: /[country]/[city]/[company]/[job-slug]-[id]
 * Small catalog (~45 jobs) but high-quality relocation roles.
 */

const SEARCH_URL = "https://relocate.me/search";

interface ParsedJob {
  id: string;
  url: string;
  title: string;
  company: string;
  location: string;
}

function extractJobsFromHtml(html: string): ParsedJob[] {
  const jobs: ParsedJob[] = [];
  const seen = new Set<string>();

  // Job links: href="/country/city/company/job-title-slug-12345"
  const linkPattern =
    /href="(\/([\w-]+)\/([\w-]+)\/([\w-]+)\/([\w-]+-\d+))"/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const country = match[2];
    const city = match[3];
    const company = match[4];
    const slug = match[5];

    // Extract numeric ID from slug end
    const idMatch = slug.match(/-(\d+)$/);
    const id = idMatch ? idMatch[1] : slug;
    if (seen.has(id)) continue;
    seen.add(id);

    // Find the title near this link
    const pos = match.index;
    const regionStart = Math.max(0, pos - 200);
    const regionEnd = Math.min(html.length, pos + 800);
    const region = html.substring(regionStart, regionEnd);

    // Title is typically the link text or nearby heading
    const titleMatch =
      region.match(
        new RegExp(
          `href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([^<]+)<`,
          "i"
        )
      ) || region.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i);

    const title = titleMatch ? titleMatch[1].trim() : "";
    if (!title || title.length < 5) continue;

    // Format location from URL segments
    const formatSegment = (s: string) =>
      s
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

    const locationStr = `${formatSegment(city)}, ${formatSegment(country)}`;
    const companyName = formatSegment(company);

    jobs.push({
      id,
      url: `https://relocate.me${href}`,
      title,
      company: companyName,
      location: locationStr,
    });
  }

  return jobs;
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log("[relocateme] Starting scrape...");

  try {
    // Relocate.me has a small catalog, so one page fetch is sufficient
    const queryParam =
      criteria.jobTitles.length > 0
        ? `?query=${encodeURIComponent(criteria.jobTitles[0])}`
        : "";
    const url = `${SEARCH_URL}${queryParam}`;

    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      console.warn(`[relocateme] Returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    const jobs = extractJobsFromHtml(html);
    console.log(`[relocateme] Parsed ${jobs.length} jobs, filtering...`);

    const results: ScrapedVacancy[] = [];

    for (const job of jobs) {
      if (!matchesTitle(job.title, criteria.jobTitles)) continue;

      results.push({
        platform: "relocateme",
        externalId: job.id,
        url: job.url,
        title: job.title,
        company: job.company,
        location: job.location,
        salaryText: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        remoteType: "hybrid", // relocation jobs are typically on-site/hybrid
        employmentType: "full-time",
        description: "",
        language: "en",
        postedAt: null,
      });
    }

    console.log(`[relocateme] Returning ${results.length} vacancies`);
    return results;
  } catch (err) {
    console.error(
      "[relocateme] Error:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}
