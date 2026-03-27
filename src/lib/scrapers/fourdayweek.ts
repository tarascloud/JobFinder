import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { matchesTitle, fetchWithTimeout } from "./utils";

/**
 * 4dayweek.io — 4-day work week remote jobs.
 * Public job listings at https://4dayweek.io/remote-jobs
 * No auth required. Page embeds job data in window.__PRELOADED_STATE__ JSON.
 * Good for remote tech roles with work-life balance focus.
 */

const BASE_URL = "https://4dayweek.io/remote-jobs";

interface PreloadedJob {
  id?: number;
  title?: string;
  slug?: string;
  company_name?: string;
  company_slug?: string;
  location_country?: string;
  location_city?: string;
  salary_lower?: number;
  salary_upper?: number;
  salary_currency?: string;
  description?: string;
  short_description?: string;
  apply_url?: string;
  created_at?: string;
  published_at?: string;
  skills?: string[];
  tools?: string[];
  remote?: boolean;
}

function extractPreloadedState(html: string): PreloadedJob[] {
  // Find window.__PRELOADED_STATE__ = {...}
  const stateMatch = html.match(
    /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/
  );
  if (!stateMatch) return [];

  try {
    const state = JSON.parse(stateMatch[1]);

    // Jobs are typically in state.list.jobs_list.items or similar nested path
    const items =
      state?.list?.jobs_list?.items ||
      state?.jobs?.items ||
      state?.jobs_list?.items ||
      {};

    const jobs: PreloadedJob[] = [];

    if (typeof items === "object" && !Array.isArray(items)) {
      // Object keyed by ID
      for (const key of Object.keys(items)) {
        const job = items[key];
        if (job && typeof job === "object" && job.title) {
          jobs.push(job as PreloadedJob);
        }
      }
    } else if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item === "object" && item.title) {
          jobs.push(item as PreloadedJob);
        }
      }
    }

    return jobs;
  } catch {
    return [];
  }
}

function buildJobUrl(job: PreloadedJob): string {
  if (job.apply_url) return job.apply_url;
  const slug = job.slug || `job-${job.id}`;
  return `https://4dayweek.io/remote-job/${slug}/apply`;
}

function buildSalaryText(job: PreloadedJob): string | null {
  if (!job.salary_lower && !job.salary_upper) return null;
  const currency = job.salary_currency || "USD";
  const symbol = currency === "GBP" ? "\u00A3" : currency === "EUR" ? "\u20AC" : "$";
  const parts: string[] = [];
  if (job.salary_lower)
    parts.push(`${symbol}${job.salary_lower.toLocaleString()}`);
  if (job.salary_upper && job.salary_upper !== job.salary_lower)
    parts.push(`${symbol}${job.salary_upper.toLocaleString()}`);
  return parts.join(" - ");
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log("[4dayweek] Starting scrape...");

  try {
    const res = await fetchWithTimeout(BASE_URL, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) {
      console.warn(`[4dayweek] Returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    const jobs = extractPreloadedState(html);
    console.log(`[4dayweek] Extracted ${jobs.length} jobs from preloaded state`);

    if (jobs.length === 0) {
      // Fallback: try HTML link parsing
      return scrapeHtmlFallback(html, criteria);
    }

    const results: ScrapedVacancy[] = [];
    const seenIds = new Set<string>();

    for (const job of jobs) {
      const id = String(job.id || job.slug || "");
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const title = job.title || "";
      if (!title) continue;
      if (!matchesTitle(title, criteria.jobTitles)) continue;

      const location =
        [job.location_city, job.location_country].filter(Boolean).join(", ") ||
        "Remote";

      results.push({
        platform: "4dayweek",
        externalId: id,
        url: buildJobUrl(job),
        title,
        company: job.company_name || "Unknown",
        location,
        salaryText: buildSalaryText(job),
        salaryMin: job.salary_lower ?? null,
        salaryMax: job.salary_upper ?? null,
        salaryCurrency: job.salary_lower || job.salary_upper
          ? (job.salary_currency || "USD")
          : null,
        remoteType: "remote",
        employmentType: "full-time",
        description: stripHtml(
          job.short_description || job.description || ""
        ).slice(0, 500),
        language: "en",
        postedAt: job.published_at
          ? new Date(job.published_at)
          : job.created_at
            ? new Date(job.created_at)
            : null,
      });
    }

    console.log(`[4dayweek] Returning ${results.length} vacancies`);
    return results;
  } catch (err) {
    console.error(
      "[4dayweek] Error:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/**
 * HTML fallback if preloaded state extraction fails.
 */
function scrapeHtmlFallback(
  html: string,
  criteria: SearchCriteria
): ScrapedVacancy[] {
  console.log("[4dayweek] Trying HTML fallback...");
  const results: ScrapedVacancy[] = [];
  const seenIds = new Set<string>();

  // Job links: /remote-job/slug/apply
  const linkPattern = /href="(\/remote-job\/([\w-]+)\/apply)"/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const slug = match[2];
    if (seenIds.has(slug)) continue;
    seenIds.add(slug);

    const pos = match.index;
    const regionStart = Math.max(0, pos - 500);
    const regionEnd = Math.min(html.length, pos + 1000);
    const region = html.substring(regionStart, regionEnd);

    const titleMatch =
      region.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i) ||
      region.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\//i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : "";
    if (!title || !matchesTitle(title, criteria.jobTitles)) continue;

    const companyMatch = region.match(
      /class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const company = companyMatch ? stripHtml(companyMatch[1]).trim() : "Unknown";

    results.push({
      platform: "4dayweek",
      externalId: slug,
      url: `https://4dayweek.io${href}`,
      title,
      company,
      location: "Remote",
      salaryText: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      remoteType: "remote",
      employmentType: "full-time",
      description: "",
      language: "en",
      postedAt: null,
    });
  }

  console.log(`[4dayweek] HTML fallback: ${results.length} vacancies`);
  return results;
}
