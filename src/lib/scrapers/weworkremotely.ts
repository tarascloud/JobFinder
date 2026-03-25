import type { ScrapedVacancy, SearchCriteria } from "./types";

const RSS_FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "https://weworkremotely.com/categories/remote-management-finance-jobs.rss",
];

interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

function extractTag(xml: string, tag: string): string {
  // Handle CDATA sections
  const cdataPattern = new RegExp(
    `<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`,
    "i"
  );
  const cdataMatch = xml.match(cdataPattern);
  if (cdataMatch) return cdataMatch[1].trim();

  const pattern = new RegExp(`<${tag}>(.*?)</${tag}>`, "is");
  const match = xml.match(pattern);
  return match ? match[1].trim() : "";
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemPattern.exec(xml)) !== null) {
    const itemXml = match[1];
    items.push({
      title: extractTag(itemXml, "title"),
      link: extractTag(itemXml, "link"),
      description: extractTag(itemXml, "description"),
      pubDate: extractTag(itemXml, "pubDate"),
      guid: extractTag(itemXml, "guid"),
    });
  }

  return items;
}

function parseCompanyAndTitle(rawTitle: string): {
  company: string;
  title: string;
} {
  // WWR format: "Company Name: Job Title"
  const colonIndex = rawTitle.indexOf(":");
  if (colonIndex > 0) {
    return {
      company: rawTitle.substring(0, colonIndex).trim(),
      title: rawTitle.substring(colonIndex + 1).trim(),
    };
  }
  return { company: "Unknown", title: rawTitle.trim() };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function matchesTitle(title: string, jobTitles: string[]): boolean {
  if (jobTitles.length === 0) return true;
  const lower = title.toLowerCase();
  return jobTitles.some((search) => lower.includes(search.toLowerCase()));
}

function extractExternalId(link: string): string {
  // URL like https://weworkremotely.com/remote-jobs/company-job-title-123
  const parts = link.split("/");
  return parts[parts.length - 1] || link;
}

async function fetchFeed(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "JobFinder/1.0 (job search aggregator)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!res.ok) {
    console.warn(`[wwr] Feed ${url} returned ${res.status}, skipping`);
    return [];
  }

  const xml = await res.text();
  return parseRssItems(xml);
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log(
    `[wwr] Starting scrape across ${RSS_FEEDS.length} RSS feeds...`
  );

  const allItems: RssItem[] = [];
  const seen = new Set<string>();

  for (const feedUrl of RSS_FEEDS) {
    try {
      const items = await fetchFeed(feedUrl);
      for (const item of items) {
        const id = item.guid || item.link;
        if (!seen.has(id)) {
          seen.add(id);
          allItems.push(item);
        }
      }
      console.log(
        `[wwr] Fetched ${items.length} items from ${feedUrl.split("/").pop()}`
      );
    } catch (err) {
      console.error(
        `[wwr] Error fetching ${feedUrl}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log(`[wwr] Total unique items: ${allItems.length}, filtering...`);

  const results: ScrapedVacancy[] = [];

  for (const item of allItems) {
    const { company, title } = parseCompanyAndTitle(item.title);

    if (!matchesTitle(title, criteria.jobTitles)) continue;

    const externalId = extractExternalId(item.link);
    if (!externalId) continue;

    results.push({
      platform: "weworkremotely",
      externalId,
      url: item.link,
      title,
      company,
      location: "Remote",
      salaryText: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      remoteType: "remote",
      employmentType: "full-time",
      description: stripHtml(item.description),
      language: "en",
      postedAt: item.pubDate ? new Date(item.pubDate) : null,
    });
  }

  console.log(
    `[wwr] Found ${results.length} matching vacancies out of ${allItems.length} total`
  );
  return results;
}
