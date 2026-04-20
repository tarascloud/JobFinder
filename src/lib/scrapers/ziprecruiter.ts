import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, matchesTitle } from "./utils";

const BASE_URL = "https://www.ziprecruiter.com/jobs-search";
const DELAY_MS = 3000;

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const rangeMatch = text.match(
    /\$([\d,]+(?:\.\d+)?)\s*[-–]\s*\$?([\d,]+(?:\.\d+)?)/
  );
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1].replace(/,/g, ""));
    let max = parseFloat(rangeMatch[2].replace(/,/g, ""));
    if (text.toLowerCase().includes("hour") || text.toLowerCase().includes("/hr")) {
      min = Math.round(min * 2080);
      max = Math.round(max * 2080);
    }
    return { min, max, currency: "USD" };
  }

  const singleMatch = text.match(/\$([\d,]+(?:\.\d+)?)/);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1].replace(/,/g, ""));
    if (text.toLowerCase().includes("hour") || text.toLowerCase().includes("/hr")) {
      val = Math.round(val * 2080);
    }
    return { min: val, max: val, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

interface ZipRecruiterJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
}

function parseJobListings(html: string): ZipRecruiterJob[] {
  const jobs: ZipRecruiterJob[] = [];
  const seenIds = new Set<string>();

  // ZipRecruiter uses article elements or div with job_content class
  // Try to find job cards by data attributes or common class patterns
  const jobIdPattern = /data-job-id="([^"]+)"/g;
  const jobIds: string[] = [];
  for (const idMatch of html.matchAll(jobIdPattern)) {
    if (!jobIds.includes(idMatch[1])) {
      jobIds.push(idMatch[1]);
    }
  }

  // If no data-job-id found, try to find job links
  if (jobIds.length === 0) {
    const linkPattern = /href="(https:\/\/www\.ziprecruiter\.com\/c\/[^"]*\/job\/[^"]*)"/gi;
    for (const linkMatch of html.matchAll(linkPattern)) {
      const url = linkMatch[1];
      // Create a pseudo-ID from the URL
      const id = url.split("/").slice(-1)[0] || url;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        jobIds.push(id);
      }
    }
  }

  // Also try /jobs/ pattern links
  if (jobIds.length === 0) {
    const altLinkPattern = /href="(\/jobs\/[^"]*?)"/gi;
    for (const altMatch of html.matchAll(altLinkPattern)) {
      const id = altMatch[1].split("/").pop() || altMatch[1];
      if (!seenIds.has(id)) {
        seenIds.add(id);
        jobIds.push(id);
      }
    }
  }

  for (const jobId of jobIds) {
    // Find region around this job
    const idStr = jobId.includes("/") ? jobId : `data-job-id="${jobId}"`;
    let pos = html.indexOf(idStr);
    if (pos < 0) {
      // Try finding by URL containing this ID
      pos = html.indexOf(jobId);
    }
    if (pos < 0) continue;

    const regionStart = Math.max(0, pos - 500);
    const regionEnd = Math.min(html.length, pos + 3000);
    const region = html.substring(regionStart, regionEnd);

    // Extract title
    const titleMatch =
      region.match(/class="[^"]*job_link[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*job-title[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
      region.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    // Extract company
    const companyMatch =
      region.match(/class="[^"]*company[_-]?name[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*t_org_link[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/<a[^>]*class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    // Extract location
    const locationMatch =
      region.match(/class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*job_location[^"]*"[^>]*>([\s\S]*?)<\//i);
    const location = locationMatch ? stripHtml(locationMatch[1]) : "Remote";

    // Extract salary
    const salaryMatch =
      region.match(/class="[^"]*salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/(\$[\d,]+\s*[-–]\s*\$?[\d,]+\s*(?:\/?\s*(?:yr|year|hr|hour))?)/i);
    const salaryText = salaryMatch ? stripHtml(salaryMatch[1]) : null;

    // Extract URL
    const urlMatch =
      region.match(/href="(https:\/\/www\.ziprecruiter\.com\/[^"]*job[^"]*)"/i) ||
      region.match(/href="(\/jobs\/[^"]*)"/i);
    let url = "";
    if (urlMatch) {
      url = urlMatch[1].startsWith("http")
        ? urlMatch[1]
        : `https://www.ziprecruiter.com${urlMatch[1]}`;
    } else {
      url = `https://www.ziprecruiter.com/jobs/${jobId}`;
    }

    // Extract date
    const dateMatch = region.match(/datetime="([^"]+)"/i);
    const timeAgoMatch = region.match(/(\d+[dh])\s*ago/i);
    let postedAt: Date | null = null;
    if (dateMatch) {
      postedAt = new Date(dateMatch[1]);
      if (isNaN(postedAt.getTime())) postedAt = null;
    } else if (timeAgoMatch) {
      const now = new Date();
      const val = parseInt(timeAgoMatch[1]);
      if (timeAgoMatch[1].includes("d")) {
        now.setDate(now.getDate() - val);
      } else {
        now.setHours(now.getHours() - val);
      }
      postedAt = now;
    }

    // Extract description snippet
    const descMatch =
      region.match(/class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      region.match(/class="[^"]*job_snippet[^"]*"[^>]*>([\s\S]*?)<\//i);
    const description = descMatch ? stripHtml(descMatch[1]) : "";

    jobs.push({
      externalId: jobId,
      title,
      company,
      location,
      salaryText,
      url,
      description,
      postedAt,
    });
  }

  return jobs;
}

async function searchZipRecruiter(query: string): Promise<ZipRecruiterJob[]> {
  const params = new URLSearchParams({
    search: query,
    location: "Remote",
  });

  const url = `${BASE_URL}?${params.toString()}`;
  console.log(`[ziprecruiter] Fetching: ${query}`);

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
      console.warn(`[ziprecruiter] Search for "${query}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[ziprecruiter] Error searching "${query}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[ziprecruiter] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: ZipRecruiterJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchZipRecruiter(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[ziprecruiter] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[ziprecruiter] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[ziprecruiter] Total unique jobs found: ${allJobs.length}, converting...`
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
      platform: "ziprecruiter",
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
      postedAt: job.postedAt,
    });
  }

  console.log(`[ziprecruiter] Returning ${results.length} vacancies`);
  return results;
}
