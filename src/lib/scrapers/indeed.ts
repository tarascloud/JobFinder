import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, fetchWithTimeout } from "./utils";

const BASE_URL = "https://www.indeed.com/jobs";
const REMOTE_FILTER = "032b3046-06a3-4876-8dfd-474eb5e7ed11";


interface IndeedJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
}

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // Patterns like "$80,000 - $120,000 a year", "$50 - $70 an hour", "€60,000"
  const rangeMatch = text.match(
    /[\$\€\£]([\d,]+(?:\.\d+)?)\s*[-–]\s*[\$\€\£]?([\d,]+(?:\.\d+)?)/
  );
  if (rangeMatch) {
    const currency = text.match(/[\$\€\£]/)?.[0] === "$" ? "USD" : text.match(/[\$\€\£]/)?.[0] === "€" ? "EUR" : "GBP";
    let min = parseFloat(rangeMatch[1].replace(/,/g, ""));
    let max = parseFloat(rangeMatch[2].replace(/,/g, ""));
    // Convert hourly to annual (rough estimate)
    if (text.toLowerCase().includes("hour")) {
      min = Math.round(min * 2080);
      max = Math.round(max * 2080);
    }
    return { min, max, currency };
  }

  const singleMatch = text.match(/[\$\€\£]([\d,]+(?:\.\d+)?)/);
  if (singleMatch) {
    const currency = text.match(/[\$\€\£]/)?.[0] === "$" ? "USD" : text.match(/[\$\€\£]/)?.[0] === "€" ? "EUR" : "GBP";
    let val = parseFloat(singleMatch[1].replace(/,/g, ""));
    if (text.toLowerCase().includes("hour")) {
      val = Math.round(val * 2080);
    }
    return { min: val, max: val, currency };
  }

  return { min: null, max: null, currency: null };
}

function parseJobCards(html: string): IndeedJob[] {
  const jobs: IndeedJob[] = [];

  // Indeed uses data-jk attribute for job IDs in job cards
  const cardPattern =
    /data-jk="([^"]+)"[\s\S]*?<h2[^>]*class="[^"]*jobTitle[^"]*"[^>]*>[\s\S]*?<(?:a|span)[^>]*>([\s\S]*?)<\/(?:a|span)>[\s\S]*?data-testid="company-name"[^>]*>([\s\S]*?)<\/[\s\S]*?data-testid="text-location"[^>]*>([\s\S]*?)<\//gi;

  let match;
  while ((match = cardPattern.exec(html)) !== null) {
    const [, jk, titleHtml, companyHtml, locationHtml] = match;

    const title = stripHtml(titleHtml);
    const company = stripHtml(companyHtml);
    const location = stripHtml(locationHtml);

    if (!title || !jk) continue;

    jobs.push({
      externalId: jk,
      title,
      company: company || "Unknown",
      location: location || "Remote",
      salaryText: null,
      url: `https://www.indeed.com/viewjob?jk=${jk}`,
      description: "",
    });
  }

  // Fallback: try simpler pattern if structured one finds nothing
  if (jobs.length === 0) {
    const simplePattern = /data-jk="([^"]+)"/g;
    const jkIds: string[] = [];
    let simpleMatch;
    while ((simpleMatch = simplePattern.exec(html)) !== null) {
      if (!jkIds.includes(simpleMatch[1])) {
        jkIds.push(simpleMatch[1]);
      }
    }

    // Try to extract titles near each job key
    for (const jk of jkIds) {
      const region = html.substring(
        html.indexOf(`data-jk="${jk}"`),
        html.indexOf(`data-jk="${jk}"`) + 3000
      );

      const titleMatch = region.match(
        /jobTitle[^>]*>[\s\S]*?<(?:a|span)[^>]*>([\s\S]*?)<\/(?:a|span)>/i
      );
      const companyMatch = region.match(
        /company-name[^>]*>([\s\S]*?)<\//i
      );

      if (titleMatch) {
        jobs.push({
          externalId: jk,
          title: stripHtml(titleMatch[1]),
          company: companyMatch ? stripHtml(companyMatch[1]) : "Unknown",
          location: "Remote",
          salaryText: null,
          url: `https://www.indeed.com/viewjob?jk=${jk}`,
          description: "",
        });
      }
    }
  }

  // Try to extract salary snippets for each job
  for (const job of jobs) {
    const jkPos = html.indexOf(`data-jk="${job.externalId}"`);
    if (jkPos >= 0) {
      const region = html.substring(jkPos, jkPos + 3000);
      const salaryMatch = region.match(
        /salary-snippet[^>]*>([\s\S]*?)<\//i
      );
      if (salaryMatch) {
        job.salaryText = stripHtml(salaryMatch[1]);
      }
      // Extract description snippet
      const descMatch = region.match(
        /job-snippet[^>]*>([\s\S]*?)<\/(?:div|td)/i
      );
      if (descMatch) {
        job.description = stripHtml(descMatch[1]);
      }
    }
  }

  return jobs;
}

async function searchIndeed(query: string): Promise<IndeedJob[]> {
  const params = new URLSearchParams({
    q: query,
    l: "remote",
    remotejob: REMOTE_FILTER,
    sort: "date",
  });

  const url = `${BASE_URL}?${params.toString()}`;
  console.log(`[indeed] Fetching: ${query}`);

  const res = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    console.warn(`[indeed] Search for "${query}" returned ${res.status}`);
    return [];
  }

  const html = await res.text();
  return parseJobCards(html);
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[indeed] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: IndeedJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    // Build search query — add geography if available
    let query = title;
    if (criteria.geographies.length > 0 && !criteria.remoteOnly) {
      query = `${title} ${criteria.geographies[0]}`;
    }

    try {
      const jobs = await searchIndeed(query);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(
        `[indeed] "${title}": found ${jobs.length} jobs`
      );
    } catch (err) {
      console.error(
        `[indeed] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    // Rate limit: wait between searches
    if (i < criteria.jobTitles.length - 1) {
      await delay(3000);
    }
  }

  console.log(
    `[indeed] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = allJobs.map((job) => {
    const salary = job.salaryText ? parseSalary(job.salaryText) : { min: null, max: null, currency: null };

    return {
      platform: "indeed",
      externalId: job.externalId,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location || "Remote",
      salaryText: job.salaryText,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      remoteType: "remote",
      employmentType: null,
      description: job.description,
      language: "en",
      postedAt: null,
    };
  });

  console.log(`[indeed] Returning ${results.length} vacancies`);
  return results;
}
