import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, matchesTitle } from "./utils";

const DELAY_MS = 3000;

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const rangeMatch = text.match(
    /[\$\€\£]([\d,]+(?:\.\d+)?)\s*[-–]\s*[\$\€\£]?([\d,]+(?:\.\d+)?)/
  );
  if (rangeMatch) {
    const symbol = text.match(/[\$\€\£]/)?.[0];
    const currency =
      symbol === "$" ? "USD" : symbol === "€" ? "EUR" : symbol === "£" ? "GBP" : null;
    let min = parseFloat(rangeMatch[1].replace(/,/g, ""));
    let max = parseFloat(rangeMatch[2].replace(/,/g, ""));
    if (text.toLowerCase().includes("hour") || text.toLowerCase().includes("/hr")) {
      min = Math.round(min * 2080);
      max = Math.round(max * 2080);
    }
    return { min, max, currency };
  }

  const singleMatch = text.match(/[\$\€\£]([\d,]+(?:\.\d+)?)/);
  if (singleMatch) {
    const symbol = text.match(/[\$\€\£]/)?.[0];
    const currency =
      symbol === "$" ? "USD" : symbol === "€" ? "EUR" : symbol === "£" ? "GBP" : null;
    let val = parseFloat(singleMatch[1].replace(/,/g, ""));
    if (text.toLowerCase().includes("hour") || text.toLowerCase().includes("/hr")) {
      val = Math.round(val * 2080);
    }
    return { min: val, max: val, currency };
  }

  return { min: null, max: null, currency: null };
}

interface GlassdoorJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
}

function parseJobListings(html: string): GlassdoorJob[] {
  const jobs: GlassdoorJob[] = [];

  // Glassdoor uses various patterns for job cards
  // Try data-id or data-job-id attributes
  const jobIdPattern = /data-(?:job-)?id="(\d+)"/g;
  const jobIds: string[] = [];
  let idMatch;
  while ((idMatch = jobIdPattern.exec(html)) !== null) {
    if (!jobIds.includes(idMatch[1])) {
      jobIds.push(idMatch[1]);
    }
  }

  for (const jobId of jobIds) {
    const startPos = html.indexOf(`data-id="${jobId}"`) >= 0
      ? html.indexOf(`data-id="${jobId}"`)
      : html.indexOf(`data-job-id="${jobId}"`);
    if (startPos < 0) continue;

    const region = html.substring(startPos, Math.min(html.length, startPos + 3000));

    // Extract title
    const titleMatch =
      region.match(/class="[^"]*job-title[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*jobTitle[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<a[^>]*data-test="job-link"[^>]*>([\s\S]*?)<\/a>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    // Extract company
    const companyMatch =
      region.match(/class="[^"]*employer-name[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/data-test="employer-short-name"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*companyName[^"]*"[^>]*>([\s\S]*?)<\//i);
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    // Extract location
    const locationMatch =
      region.match(/class="[^"]*job-location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/data-test="emp-location"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i);
    const location = locationMatch ? stripHtml(locationMatch[1]) : "Remote";

    // Extract salary estimate
    const salaryMatch =
      region.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/data-test="detailSalary"[^>]*>([\s\S]*?)<\//i);
    const salaryText = salaryMatch ? stripHtml(salaryMatch[1]) : null;

    // Extract URL
    const urlMatch = region.match(/href="(\/partner\/jobListing[^"]*|\/job-listing\/[^"]*)"/i);
    const url = urlMatch
      ? `https://www.glassdoor.com${urlMatch[1]}`
      : `https://www.glassdoor.com/job-listing/-${jobId}.htm`;

    jobs.push({
      externalId: jobId,
      title,
      company,
      location,
      salaryText,
      url,
      description: "",
    });
  }

  return jobs;
}

async function searchGlassdoor(query: string): Promise<GlassdoorJob[]> {
  const encoded = encodeURIComponent(query.replace(/\s+/g, "-"));
  const queryLen = 7 + encoded.length; // "remote-" prefix length + query
  const url = `https://www.glassdoor.com/Job/remote-${encoded}-jobs-SRCH_IL.0,6_IS11047_KO7,${queryLen}.htm`;

  console.log(`[glassdoor] Fetching: ${query}`);

  try {
    const res = await fetch(url, {
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
      console.warn(`[glassdoor] Search for "${query}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[glassdoor] Error searching "${query}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[glassdoor] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: GlassdoorJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchGlassdoor(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[glassdoor] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[glassdoor] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[glassdoor] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    if (!matchesTitle(job.title, criteria.jobTitles)) continue;

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    if (
      criteria.minSalary > 0 &&
      salary.max !== null &&
      criteria.currency.toUpperCase() === (salary.currency ?? "").toUpperCase() &&
      salary.max < criteria.minSalary
    ) {
      continue;
    }

    results.push({
      platform: "glassdoor",
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
      language: "en",
      postedAt: null,
    });
  }

  console.log(`[glassdoor] Returning ${results.length} vacancies`);
  return results;
}
