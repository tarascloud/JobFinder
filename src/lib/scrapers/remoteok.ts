import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { fetchWithTimeout } from "./utils";

const API_URL = "https://remoteok.com/api";

interface RemoteOKJob {
  id?: string;
  slug?: string;
  url?: string;
  title?: string;
  company?: string;
  company_logo?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
  tags?: string[];
  date?: string;
  position?: string;
}

function matchesTitle(job: RemoteOKJob, jobTitles: string[]): boolean {
  if (jobTitles.length === 0) return true;
  const title = (job.title ?? "").toLowerCase();
  const position = (job.position ?? "").toLowerCase();
  const tags = (job.tags ?? []).map((t) => t.toLowerCase());

  return jobTitles.some((search) => {
    const s = search.toLowerCase();
    return (
      title.includes(s) ||
      position.includes(s) ||
      tags.some((tag) => tag.includes(s))
    );
  });
}

function meetsSalary(
  job: RemoteOKJob,
  minSalary: number,
  currency: string
): boolean {
  if (!minSalary || minSalary <= 0) return true;
  // RemoteOK salaries are in USD
  if (!job.salary_max) return true; // no salary info — include it
  if (currency.toUpperCase() !== "USD") return true; // can't compare across currencies
  return job.salary_max >= minSalary;
}

function buildSalaryText(job: RemoteOKJob): string | null {
  if (!job.salary_min && !job.salary_max) return null;
  const parts: string[] = [];
  if (job.salary_min) parts.push(`$${job.salary_min.toLocaleString()}`);
  if (job.salary_max) parts.push(`$${job.salary_max.toLocaleString()}`);
  return parts.join(" - ");
}


export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log("[remoteok] Starting scrape...");

  const res = await fetchWithTimeout(API_URL, {
    headers: {
      "User-Agent": getRandomUserAgent(),
    },
  });

  if (!res.ok) {
    throw new Error(`RemoteOK API returned ${res.status}: ${res.statusText}`);
  }

  const data: RemoteOKJob[] = await res.json();

  // First element is often a legal notice object, skip non-job items
  const jobs = data.filter((item) => item.id && item.title);

  console.log(`[remoteok] Fetched ${jobs.length} jobs, filtering...`);

  const results: ScrapedVacancy[] = [];

  for (const job of jobs) {
    if (!matchesTitle(job, criteria.jobTitles)) continue;
    if (!meetsSalary(job, criteria.minSalary, criteria.currency)) continue;

    const externalId = String(job.id ?? job.slug ?? "");
    if (!externalId) continue;

    results.push({
      platform: "remoteok",
      externalId,
      url: job.url ?? `https://remoteok.com/remote-jobs/${job.slug ?? job.id}`,
      title: job.title ?? "",
      company: job.company ?? "Unknown",
      location: job.location || "Remote",
      salaryText: buildSalaryText(job),
      salaryMin: job.salary_min ?? null,
      salaryMax: job.salary_max ?? null,
      salaryCurrency: job.salary_min || job.salary_max ? "USD" : null,
      remoteType: "remote",
      employmentType: "full-time",
      description: stripHtml(job.description ?? ""),
      language: "en",
      postedAt: job.date ? new Date(job.date) : null,
    });
  }

  console.log(
    `[remoteok] Found ${results.length} matching vacancies out of ${jobs.length} total`
  );
  return results;
}
