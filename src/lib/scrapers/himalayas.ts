import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { matchesTitle } from "./utils";

/**
 * Himalayas.app — remote jobs platform with a public JSON API.
 * API docs: https://himalayas.app/api
 * Endpoint: GET https://himalayas.app/jobs/api?limit=50&offset=0
 * No auth required.
 */
const API_URL = "https://himalayas.app/jobs/api";

interface HimalayasApiJob {
  id?: number;
  title?: string;
  companyName?: string;
  categories?: string[];
  locationRestrictions?: string[];
  salary?: string;
  salaryCurrency?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryPeriod?: string;
  excerpt?: string;
  description?: string;
  applicationLink?: string;
  pubDate?: string;
  publishDate?: string;
  slug?: string;
  companySlug?: string;
  guid?: string;
}

interface HimalayasApiResponse {
  jobs?: HimalayasApiJob[];
  total?: number;
  offset?: number;
  limit?: number;
}

function normalizeSalary(job: HimalayasApiJob): {
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
} {
  if (job.salaryMin || job.salaryMax) {
    const min = job.salaryMin || null;
    const max = job.salaryMax || null;
    const currency = job.salaryCurrency?.toUpperCase() || "USD";

    // Convert hourly to annual if period is hourly
    let annualMin = min;
    let annualMax = max;
    if (job.salaryPeriod === "hourly" || job.salaryPeriod === "HOURLY") {
      if (annualMin) annualMin = annualMin * 2080;
      if (annualMax) annualMax = annualMax * 2080;
    } else if (job.salaryPeriod === "monthly" || job.salaryPeriod === "MONTHLY") {
      if (annualMin) annualMin = annualMin * 12;
      if (annualMax) annualMax = annualMax * 12;
    }

    const parts: string[] = [];
    if (annualMin) parts.push(`$${annualMin.toLocaleString()}`);
    if (annualMax && annualMax !== annualMin) parts.push(`$${annualMax.toLocaleString()}`);
    const salaryText = parts.length > 0 ? parts.join(" - ") : null;

    return { salaryText, salaryMin: annualMin, salaryMax: annualMax, salaryCurrency: currency };
  }

  if (job.salary) {
    return { salaryText: job.salary, salaryMin: null, salaryMax: null, salaryCurrency: null };
  }

  return { salaryText: null, salaryMin: null, salaryMax: null, salaryCurrency: null };
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log("[himalayas] Starting scrape via API...");

  const results: ScrapedVacancy[] = [];
  const seenIds = new Set<string>();

  try {
    // Fetch up to 100 jobs (2 pages of 50)
    for (let offset = 0; offset < 100; offset += 50) {
      const url = `${API_URL}?limit=50&offset=${offset}`;
      console.log(`[himalayas] Fetching: offset=${offset}`);

      const res = await fetch(url, {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        console.warn(`[himalayas] API returned ${res.status}`);
        break;
      }

      const data: HimalayasApiResponse = await res.json();
      const jobs = data.jobs || [];

      if (jobs.length === 0) break;

      for (const job of jobs) {
        const id = String(job.id || job.guid || job.slug || "");
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const title = job.title || "";
        if (!title) continue;
        if (!matchesTitle(title, criteria.jobTitles)) continue;

        const salary = normalizeSalary(job);

        const jobUrl = job.applicationLink
          || (job.companySlug && job.slug
            ? `https://himalayas.app/companies/${job.companySlug}/jobs/${job.slug}`
            : `https://himalayas.app/jobs/${job.slug || id}`);

        const location = job.locationRestrictions?.length
          ? job.locationRestrictions.join(", ")
          : "Remote (Worldwide)";

        results.push({
          platform: "himalayas",
          externalId: id,
          url: jobUrl,
          title,
          company: job.companyName || "Unknown",
          location,
          salaryText: salary.salaryText,
          salaryMin: salary.salaryMin,
          salaryMax: salary.salaryMax,
          salaryCurrency: salary.salaryCurrency,
          remoteType: "remote",
          employmentType: "full-time",
          description: stripHtml(job.excerpt || job.description || "").slice(0, 500),
          language: "en",
          postedAt: job.pubDate
            ? new Date(job.pubDate)
            : job.publishDate
              ? new Date(job.publishDate)
              : null,
        });
      }

      console.log(`[himalayas] Page offset=${offset}: ${jobs.length} jobs fetched, ${results.length} matching so far`);

      // If fewer than 50 returned, no more pages
      if (jobs.length < 50) break;
    }
  } catch (err) {
    console.error(
      "[himalayas] Error:",
      err instanceof Error ? err.message : err
    );
  }

  console.log(`[himalayas] Returning ${results.length} vacancies`);
  return results;
}
