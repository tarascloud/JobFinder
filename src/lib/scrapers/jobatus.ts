import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, fetchWithTimeout, matchesTitle } from "./utils";

const DELAY_MS = 3000;

/**
 * Jobatus (jobatus.es) — Spanish job aggregator.
 *
 * Public search at:
 *   https://www.jobatus.es/empleo/KEYWORD
 *   https://www.jobatus.es/empleo?q=KEYWORD
 *
 * Job detail pages link to external sites or /empleo/SLUG
 */

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // Jobatus formats: "30.000€ - 40.000€", "30.000 - 40.000 €/año"
  const euroRange = text.match(
    /([\d.,]+)\s*€?\s*[-–]\s*([\d.,]+)\s*€/
  );
  if (euroRange) {
    const min = parseFloat(euroRange[1].replace(/\./g, "").replace(",", "."));
    const max = parseFloat(euroRange[2].replace(/\./g, "").replace(",", "."));
    return { min, max, currency: "EUR" };
  }

  const singleEuro = text.match(/([\d.,]+)\s*€/);
  if (singleEuro) {
    const val = parseFloat(singleEuro[1].replace(/\./g, "").replace(",", "."));
    return { min: val, max: val, currency: "EUR" };
  }

  return { min: null, max: null, currency: null };
}

interface JobatusJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
}

function parseJobListings(html: string): JobatusJob[] {
  const jobs: JobatusJob[] = [];
  const seenIds = new Set<string>();

  // Jobatus job cards: links to /empleo/SLUG or external URLs
  // Cards often use class="offer", "job-item", "list-item" or similar
  const jobLinkPattern =
    /href="(\/empleo\/([^"]+))"[^>]*>/gi;

  for (const linkMatch of html.matchAll(jobLinkPattern)) {
    const [, href, slug] = linkMatch;
    // Skip search/category pages
    if (slug.startsWith("?") || slug.split("/").length > 2) continue;

    const id = slug.replace(/[^\w-]/g, "").slice(0, 64);
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const pos = linkMatch.index;
    const regionStart = Math.max(0, pos - 2000);
    const regionEnd = Math.min(html.length, pos + 3000);
    const region = html.substring(regionStart, regionEnd);

    // Extract title from link text
    const titleMatch =
      region.match(
        new RegExp(
          `href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([\\s\\S]*?)<\\/a>`,
          "i"
        )
      ) ||
      region.match(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : "";
    if (!title || title.length < 5) continue;

    // Extract company
    const companyMatch =
      region.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*empresa[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*source[^"]*"[^>]*>([\s\S]*?)<\//i);
    const company = companyMatch ? stripHtml(companyMatch[1]).trim() : "Unknown";

    // Extract location
    const locationMatch =
      region.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*ubicacion[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<i[^>]*class="[^"]*fa-map-marker[^"]*"[^>]*><\/i>\s*([\s\S]*?)<\//i);
    const location = locationMatch
      ? stripHtml(locationMatch[1]).trim()
      : "Spain";

    // Extract salary
    const salaryMatch =
      region.match(/class="[^"]*salario[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/([\d.,]+\s*€\s*[-–]\s*[\d.,]+\s*€[^<]*)/i);
    const salaryText = salaryMatch
      ? stripHtml(salaryMatch[1]).trim()
      : null;

    // Extract date
    const dateMatch =
      region.match(/datetime="([^"]+)"/i) ||
      region.match(/class="[^"]*fecha[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\//i);
    let postedAt: Date | null = null;
    if (dateMatch) {
      const dateStr = stripHtml(dateMatch[1]).trim();
      postedAt = new Date(dateStr);
      if (isNaN(postedAt.getTime())) {
        // Try Spanish date format: "dd/mm/yyyy"
        const esDate = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (esDate) {
          postedAt = new Date(
            parseInt(esDate[3]),
            parseInt(esDate[2]) - 1,
            parseInt(esDate[1])
          );
        } else {
          postedAt = null;
        }
      }
    }

    // Extract description snippet
    const descMatch =
      region.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*descripcion[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<p[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const description = descMatch ? stripHtml(descMatch[1]).trim() : "";

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText: salaryText || null,
      url: `https://www.jobatus.es${href}`,
      description,
      postedAt,
    });
  }

  return jobs;
}

async function searchJobatus(keyword: string): Promise<JobatusJob[]> {
  // Jobatus uses slug-based search URLs
  const slug = encodeURIComponent(keyword.toLowerCase().replace(/\s+/g, "-"));
  const url = `https://www.jobatus.es/empleo/${slug}`;
  console.log(`[jobatus] Fetching: ${keyword}`);

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.jobatus.es/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[jobatus] Search for "${keyword}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[jobatus] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[jobatus] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: JobatusJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchJobatus(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[jobatus] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[jobatus] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[jobatus] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    const locationLower = (job.location || "").toLowerCase();
    let remoteType: string | null = null;
    if (
      locationLower.includes("remoto") ||
      locationLower.includes("remote") ||
      locationLower.includes("teletrabajo")
    ) {
      remoteType = "remote";
    } else if (
      locationLower.includes("h\u00edbrido") ||
      locationLower.includes("hybrid")
    ) {
      remoteType = "hybrid";
    }

    results.push({
      platform: "jobatus",
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
      language: "es",
      postedAt: job.postedAt,
    });
  }

  console.log(`[jobatus] Returning ${results.length} vacancies`);
  return results;
}
