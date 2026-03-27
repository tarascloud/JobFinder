import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, fetchWithTimeout, matchesTitle } from "./utils";

const BASE_URL = "https://djinni.co/jobs/";
const DELAY_MS = 3000;

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  // Djinni formats: "$3000-$5000", "₴50000-₴80000", "$3 000 - $5 000"
  const usdRange = text.match(
    /\$([\d\s,]+)\s*[-–—]\s*\$?([\d\s,]+)/
  );
  if (usdRange) {
    const min = parseFloat(usdRange[1].replace(/[\s,]/g, ""));
    const max = parseFloat(usdRange[2].replace(/[\s,]/g, ""));
    return { min, max, currency: "USD" };
  }

  const uahRange = text.match(
    /₴([\d\s,]+)\s*[-–—]\s*₴?([\d\s,]+)/
  );
  if (uahRange) {
    const min = parseFloat(uahRange[1].replace(/[\s,]/g, ""));
    const max = parseFloat(uahRange[2].replace(/[\s,]/g, ""));
    return { min, max, currency: "UAH" };
  }

  const singleUsd = text.match(/\$([\d\s,]+)/);
  if (singleUsd) {
    const val = parseFloat(singleUsd[1].replace(/[\s,]/g, ""));
    return { min: val, max: val, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

interface DjinniJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  salaryText: string | null;
  url: string;
  description: string;
  postedAt: Date | null;
  employmentType: string | null;
  remoteType: string | null;
}

// Primary parser: JSON-LD (schema.org/JobPosting) — most reliable
function parseJsonLd(html: string): DjinniJob[] {
  const jobs: DjinniJob[] = [];

  const jsonLdMatch = html.match(
    /<script type="application\/ld\+json">\s*(\[[\s\S]*?\])\s*<\/script>/
  );
  if (!jsonLdMatch) return jobs;

  let postings: Array<Record<string, unknown>>;
  try {
    postings = JSON.parse(jsonLdMatch[1]);
  } catch {
    console.warn("[djinni] Failed to parse JSON-LD");
    return jobs;
  }

  for (const posting of postings) {
    if (posting["@type"] !== "JobPosting") continue;

    const identifier = String(posting.identifier ?? "");
    if (!identifier) continue;

    const org = posting.hiringOrganization as
      | { name?: string }
      | undefined;

    const locationType = String(posting.jobLocationType ?? "");
    const remoteType = locationType === "TELECOMMUTE" ? "remote" : null;

    const empType = String(posting.employmentType ?? "");
    let employmentType: string | null = null;
    if (empType === "FULL_TIME") employmentType = "full-time";
    else if (empType === "PART_TIME") employmentType = "part-time";
    else if (empType === "CONTRACT") employmentType = "contract";

    let postedAt: Date | null = null;
    if (posting.datePosted) {
      postedAt = new Date(String(posting.datePosted));
      if (isNaN(postedAt.getTime())) postedAt = null;
    }

    // Extract salary from HTML card (JSON-LD doesn't include salary on Djinni)
    // Will be enriched later from HTML if available
    jobs.push({
      externalId: identifier,
      title: String(posting.title ?? ""),
      company: org?.name ?? "Unknown",
      location: remoteType === "remote" ? "Remote" : "Unknown",
      salaryText: null,
      url: String(posting.url ?? `https://djinni.co/jobs/${identifier}/`),
      description: stripHtml(String(posting.description ?? "")),
      postedAt,
      employmentType,
      remoteType,
    });
  }

  return jobs;
}

// Enrich JSON-LD data with salary and location from HTML cards
function enrichFromHtml(jobs: DjinniJob[], html: string): void {
  for (const job of jobs) {
    const cardId = `job-item-${job.externalId}`;
    const cardStart = html.indexOf(cardId);
    if (cardStart < 0) continue;

    const cardEnd = Math.min(html.length, cardStart + 3000);
    const card = html.substring(cardStart, cardEnd);

    // Extract salary from card ($$$ indicator or actual amount)
    const salaryMatch =
      card.match(/class="[^"]*public-salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      card.match(/(\$[\d\s,]+\s*[-–—]\s*\$?[\d\s,]+)/);
    if (salaryMatch) {
      job.salaryText = stripHtml(salaryMatch[1]);
    }

    // Extract location from card
    const locationMatch = card.match(
      /class="location-text"[^>]*>([\s\S]*?)<\//i
    );
    if (locationMatch) {
      job.location = stripHtml(locationMatch[1]);
    }

    // Check for "Full Remote" in card
    if (card.includes("Full Remote")) {
      job.remoteType = "remote";
    } else if (card.includes("Office")) {
      job.remoteType = "onsite";
    } else if (card.includes("Hybrid") || card.includes("Relocation")) {
      job.remoteType = "hybrid";
    }
  }
}

// Fallback parser: HTML regex (if JSON-LD is missing)
function parseHtmlFallback(html: string): DjinniJob[] {
  const jobs: DjinniJob[] = [];
  const foundIds = new Set<string>();

  // Match job card containers: <div id="job-item-{id}" ...>
  const cardPattern = /id="job-item-(\d+)"/g;
  let cardMatch;

  while ((cardMatch = cardPattern.exec(html)) !== null) {
    const id = cardMatch[1];
    if (foundIds.has(id)) continue;
    foundIds.add(id);

    const cardStart = cardMatch.index;
    const cardEnd = Math.min(html.length, cardStart + 3000);
    const card = html.substring(cardStart, cardEnd);

    // Title: <h2 class="job-item__position ...">Title</h2>
    const titleMatch = card.match(
      /class="job-item__position[^"]*"[^>]*>([\s\S]*?)<\/h2>/i
    );
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!title) continue;

    // Company
    const companyMatch = card.match(
      /class="[^"]*text-gray-800 opacity-75 font-weight-500[^"]*"[^>]*>([\s\S]*?)<\//i
    );
    const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

    // Location
    const locationMatch = card.match(
      /class="location-text"[^>]*>([\s\S]*?)<\//i
    );
    const location = locationMatch ? stripHtml(locationMatch[1]) : "Remote";

    // URL
    const urlMatch = card.match(
      /href="(\/jobs\/\d+[^"]*?)"/i
    );
    const url = urlMatch
      ? `https://djinni.co${urlMatch[1]}`
      : `https://djinni.co/jobs/${id}/`;

    // Salary
    const salaryMatch =
      card.match(/class="[^"]*public-salary[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      card.match(/(\$[\d\s,]+\s*[-–—]\s*\$?[\d\s,]+)/);
    const salaryText = salaryMatch ? stripHtml(salaryMatch[1]) : null;

    // Description
    const descMatch = card.match(
      /class="js-truncated-text"[^>]*>([\s\S]*?)<\/span>/i
    );
    const description = descMatch ? stripHtml(descMatch[1]) : "";

    // Remote type
    let remoteType: string | null = "remote";
    if (card.includes("Office")) remoteType = "onsite";
    else if (card.includes("Hybrid")) remoteType = "hybrid";

    jobs.push({
      externalId: id,
      title,
      company,
      location,
      salaryText,
      url,
      description,
      postedAt: null,
      employmentType: null,
      remoteType,
    });
  }

  return jobs;
}

function parseJobListings(html: string): DjinniJob[] {
  // Try JSON-LD first (most reliable — structured data from Djinni)
  let jobs = parseJsonLd(html);

  if (jobs.length > 0) {
    console.log(`[djinni] Parsed ${jobs.length} jobs from JSON-LD`);
    enrichFromHtml(jobs, html);
    return jobs;
  }

  // Fallback to HTML parsing
  console.log("[djinni] No JSON-LD found, falling back to HTML parsing");
  jobs = parseHtmlFallback(html);
  console.log(`[djinni] Parsed ${jobs.length} jobs from HTML`);
  return jobs;
}

function mapKeyword(title: string): string {
  const mappings: Record<string, string> = {
    frontend: "JavaScript",
    "front-end": "JavaScript",
    react: "JavaScript",
    backend: "Python",
    "back-end": "Python",
    "full stack": "JavaScript",
    fullstack: "JavaScript",
    devops: "DevOps",
    "data engineer": "Python",
    "data scientist": "Python",
    "machine learning": "Python",
    golang: "Golang",
    go: "Golang",
    rust: "Rust",
    java: "Java",
    "c#": ".NET",
    ".net": ".NET",
    python: "Python",
    node: "Node.js",
    nodejs: "Node.js",
    typescript: "JavaScript",
    ios: "iOS",
    android: "Android",
    flutter: "Flutter",
    "react native": "React Native",
    ruby: "Ruby",
    php: "PHP",
    scala: "Scala",
    kotlin: "Kotlin",
    qa: "QA",
    test: "QA",
    "project manager": "Project Manager",
    "product manager": "Product Manager",
    designer: "Designer",
    "ui/ux": "Designer",
  };

  const lower = title.toLowerCase();
  for (const [key, value] of Object.entries(mappings)) {
    if (lower.includes(key)) return value;
  }

  return title;
}

async function searchDjinni(keyword: string): Promise<DjinniJob[]> {
  const mappedKeyword = mapKeyword(keyword);
  const params = new URLSearchParams({
    primary_keyword: mappedKeyword,
    region: "remote",
  });

  const url = `${BASE_URL}?${params.toString()}`;
  console.log(`[djinni] Fetching: ${keyword} (keyword: ${mappedKeyword})`);

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(`[djinni] Search for "${keyword}" returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    return parseJobListings(html);
  } catch (err) {
    console.error(
      `[djinni] Error searching "${keyword}":`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[djinni] Starting scrape for ${criteria.jobTitles.length} job titles...`
  );

  const allJobs: DjinniJob[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const title = criteria.jobTitles[i];

    try {
      const jobs = await searchDjinni(title);
      for (const job of jobs) {
        if (!seenIds.has(job.externalId)) {
          seenIds.add(job.externalId);
          allJobs.push(job);
        }
      }
      console.log(`[djinni] "${title}": found ${jobs.length} jobs`);
    } catch (err) {
      console.error(
        `[djinni] Error searching "${title}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(
    `[djinni] Total unique jobs found: ${allJobs.length}, converting...`
  );

  const results: ScrapedVacancy[] = [];

  for (const job of allJobs) {
    // Skip matchesTitle for Djinni — primary_keyword already filters by category,
    // and job titles on Djinni rarely match user search terms exactly
    // (e.g. searching "software engineer" returns "Python/AI Engineer")

    const salary = job.salaryText
      ? parseSalary(job.salaryText)
      : { min: null, max: null, currency: null };

    results.push({
      platform: "djinni",
      externalId: job.externalId,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      salaryText: job.salaryText,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      remoteType: job.remoteType ?? "remote",
      employmentType: job.employmentType,
      description: job.description,
      language: "uk",
      postedAt: job.postedAt,
    });
  }

  console.log(`[djinni] Returning ${results.length} vacancies`);
  return results;
}
