import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, fetchWithTimeout, matchesTitle } from "./utils";

const DELAY_MS = 3000;

/**
 * Computrabajo (computrabajo.com) — major Spanish-language job board
 * popular in Spain and Latin America.
 *
 * Public search at:
 *   https://www.computrabajo.com/trabajo-de-KEYWORD
 *   https://www.computrabajo.com/trabajo-de-KEYWORD?by=date
 *
 * For remote jobs:
 *   https://www.computrabajo.com/trabajo-de-KEYWORD?tp=3 (teletrabajo)
 *
 * Job detail pages: /ofertas-de-trabajo/oferta-de-trabajo-de-SLUG-NNNNNN
 */

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // Computrabajo formats: "1.500€ - 2.500€/mes", "30.000€ - 45.000€/año",
  // "Desde 25.000€", "25.000 - 35.000 €"
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

interface ComputrabajoJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
}

function parseJobListings(html: string): ComputrabajoJob[] {
  const jobs: ComputrabajoJob[] = [];
  const seenIds = new Set<string>();

  // Computrabajo job links: /ofertas-de-trabajo/oferta-de-trabajo-de-SLUG-NNNNNN
  // or /empleo/SLUG/NNNNNN
  const jobLinkPattern =
    /href="((?:\/ofertas-de-trabajo\/[^"]+|\/empleo\/[^"]+?))"[^>]*>/gi;
  let linkMatch;

  while ((linkMatch = jobLinkPattern.exec(html)) !== null) {
    const [, href] = linkMatch;

    // Extract ID from the URL (usually trailing digits)
    const idMatch = href.match(/(\d{5,})/) || href.match(/([a-zA-Z0-9-]{10,})$/);
    const id = idMatch ? idMatch[1] : href.replace(/[^\w-]/g, "").slice(0, 64);
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
          `href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([\\s\\S]*?)<\\/a>`,
          "i"
        )
      ) ||
      region.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]).trim() : "";
    if (!title || title.length < 5) continue;

    // Extract company
    const companyMatch =
      region.match(/class="[^"]*empresa[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*fc-company[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<span[^>]*class="[^"]*offer-company[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const company = companyMatch ? stripHtml(companyMatch[1]).trim() : "Unknown";

    // Extract location
    const locationMatch =
      region.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*ubicacion[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*fc-city[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<i[^>]*class="[^"]*fa-map-marker[^"]*"[^>]*><\/i>\s*([\s\S]*?)<\//i);
    const location = locationMatch
      ? stripHtml(locationMatch[1]).trim()
      : "Spain";

    // Extract salary
    const salaryMatch =
      region.match(/class="[^"]*salario[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*fc-salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
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
      region.match(/<p[^>]*class="[^"]*fc-description[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const description = descMatch ? stripHtml(descMatch[1]).trim() : "";

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText: salaryText || null,
      url: href.startsWith("http")
        ? href
        : `https://www.computrabajo.com${href}`,
      description,
      postedAt,
    });
  }

  return jobs;
}

async function searchComputrabajo(keyword: string): Promise<ComputrabajoJob[]> {
  // Computrabajo uses slug-based search: /trabajo-de-KEYWORD
  const slug = keyword.toLowerCase().replace(/\s+/g, "-");
  const url = `https://www.computrabajo.com/trabajo-de-${encodeURIComponent(slug)}?by=date`;
  console.log(`[computrabajo] Fetching: ${keyword}`);

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.computrabajo.com/",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(
        `[computrabajo] Search for "${keyword}" returned ${res.status}`
      );
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[computrabajo] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[computrabajo] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: ComputrabajoJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchComputrabajo(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[computrabajo] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[computrabajo] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[computrabajo] Total unique jobs found: ${allJobs.length}, converting...`
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
      platform: "computrabajo",
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

  console.log(`[computrabajo] Returning ${results.length} vacancies`);
  return results;
}
