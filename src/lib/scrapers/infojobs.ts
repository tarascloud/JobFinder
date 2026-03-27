import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, fetchWithTimeout, matchesTitle } from "./utils";

const DELAY_MS = 3000;

/**
 * InfoJobs (infojobs.net) — #1 job board in Spain.
 *
 * Public search results are available at:
 *   https://www.infojobs.net/jobsearch/search-results/list.xhtml?keyword=...
 *
 * InfoJobs also has a public API at https://developer.infojobs.net/ but it
 * requires registration. We scrape the public HTML search results instead.
 */

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // InfoJobs formats: "30.000€ - 40.000€", "30.000 - 40.000 €/año",
  // "Más de 50.000€", "25.000€ - 35.000€ bruto/año"
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

interface InfoJobsJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
}

function parseJobListings(html: string): InfoJobsJob[] {
  const jobs: InfoJobsJob[] = [];
  const seenIds = new Set<string>();

  // InfoJobs job cards contain links to /oferta/-/{id}
  // Pattern: /oferta/SLUG/ID or direct offer links
  const offerLinkPattern =
    /href="(https?:\/\/www\.infojobs\.net\/[^"]*?\/of-i([a-zA-Z0-9]+)[^"]*)"/gi;
  let linkMatch;

  while ((linkMatch = offerLinkPattern.exec(html)) !== null) {
    const [, url, id] = linkMatch;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const pos = linkMatch.index;
    const regionStart = Math.max(0, pos - 2000);
    const regionEnd = Math.min(html.length, pos + 3000);
    const region = html.substring(regionStart, regionEnd);

    // Extract title from link text or nearby heading
    const titleMatch =
      region.match(
        new RegExp(
          `href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([\\s\\S]*?)<\\/a>`,
          "i"
        )
      ) ||
      region.match(/<h2[^>]*class="[^"]*"[^>]*>([\s\S]*?)<\/h2>/i) ||
      region.match(/<a[^>]+class="[^"]*offer-title[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : "";
    if (!title || title.length < 3) continue;

    // Extract company
    const companyMatch =
      region.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*empresa[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<span[^>]*class="[^"]*offer-company[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const company = companyMatch ? stripHtml(companyMatch[1]).trim() : "Unknown";

    // Extract location
    const locationMatch =
      region.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*ciudad[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*offer-location[^"]*"[^>]*>([\s\S]*?)<\//i);
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
      region.match(/data-date="([^"]+)"/i);
    let postedAt: Date | null = null;
    if (dateMatch) {
      postedAt = new Date(dateMatch[1]);
      if (isNaN(postedAt.getTime())) postedAt = null;
    }

    // Extract description snippet
    const descMatch =
      region.match(/class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*offer-description[^"]*"[^>]*>([\s\S]*?)<\//i);
    const description = descMatch ? stripHtml(descMatch[1]).trim() : "";

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText: salaryText || null,
      url,
      description,
      postedAt,
    });
  }

  // Fallback: try generic offer link pattern
  if (jobs.length === 0) {
    const fallbackPattern =
      /href="(\/oferta\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let fbMatch;

    while ((fbMatch = fallbackPattern.exec(html)) !== null) {
      const [, href, linkText] = fbMatch;
      const title = stripHtml(linkText).trim();
      if (!title || title.length < 5) continue;

      const idMatch = href.match(/of-i([a-zA-Z0-9]+)/);
      const id = idMatch ? idMatch[1] : href.replace(/[^\w]/g, "").slice(0, 32);
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      jobs.push({
        externalId: id,
        title,
        company: "Unknown",
        location: "Spain",
        salaryText: null,
        url: `https://www.infojobs.net${href}`,
        description: "",
        postedAt: null,
      });
    }
  }

  return jobs;
}

async function searchInfoJobs(keyword: string): Promise<InfoJobsJob[]> {
  const params = new URLSearchParams({
    keyword,
    segmentId: "0",
    page: "1",
    sortBy: "PUBLICATION_DATE",
    onlyForeign498: "false",
    sin498: "false",
  });

  const url = `https://www.infojobs.net/jobsearch/search-results/list.xhtml?${params.toString()}`;
  console.log(`[infojobs] Fetching: ${keyword}`);

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.infojobs.net/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[infojobs] Search for "${keyword}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[infojobs] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[infojobs] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: InfoJobsJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchInfoJobs(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[infojobs] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[infojobs] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[infojobs] Total unique jobs found: ${allJobs.length}, converting...`
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
      platform: "infojobs",
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

  console.log(`[infojobs] Returning ${results.length} vacancies`);
  return results;
}
