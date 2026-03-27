import type { ScrapedVacancy, SearchCriteria } from "./types";
import { getRandomUserAgent } from "@/lib/proxy";
import { stripHtml } from "@/lib/html-utils";
import { delay, matchesTitle } from "./utils";

/**
 * Arc.dev — remote developer jobs platform.
 * Has a public job listing at https://arc.dev/remote-jobs
 * Also has RSS at https://arc.dev/remote-jobs/rss
 */
const RSS_URL = "https://arc.dev/remote-jobs/rss";
const DELAY_MS = 2000;

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

function parseSalary(text: string): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const range = text.match(
    /\$\s*([\d,]+)\s*[-–—]\s*\$?\s*([\d,]+)/
  );
  if (range) {
    const min = parseFloat(range[1].replace(/,/g, ""));
    const max = parseFloat(range[2].replace(/,/g, ""));
    return { min, max, currency: "USD" };
  }

  const hourlyRange = text.match(
    /\$\s*([\d,.]+)\s*\/?\s*(?:hr|hour)\s*[-–—]\s*\$?\s*([\d,.]+)/i
  );
  if (hourlyRange) {
    const min = parseFloat(hourlyRange[1].replace(/,/g, "")) * 2080;
    const max = parseFloat(hourlyRange[2].replace(/,/g, "")) * 2080;
    return { min, max, currency: "USD" };
  }

  return { min: null, max: null, currency: null };
}

function parseCompanyAndTitle(rawTitle: string): {
  company: string;
  title: string;
} {
  // Arc.dev formats: "Company Name - Job Title" or "Job Title at Company Name"
  const atIndex = rawTitle.lastIndexOf(" at ");
  if (atIndex > 0) {
    return {
      title: rawTitle.substring(0, atIndex).trim(),
      company: rawTitle.substring(atIndex + 4).trim(),
    };
  }

  const dashIndex = rawTitle.indexOf(" - ");
  if (dashIndex > 0) {
    return {
      company: rawTitle.substring(0, dashIndex).trim(),
      title: rawTitle.substring(dashIndex + 3).trim(),
    };
  }

  return { company: "Unknown", title: rawTitle.trim() };
}

function extractExternalId(link: string): string {
  const parts = link.split("/");
  return parts[parts.length - 1] || link;
}

export async function scrape(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log("[arcdev] Starting scrape via RSS...");

  try {
    const res = await fetch(RSS_URL, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!res.ok) {
      // RSS might not exist, try HTML scraping
      console.warn(`[arcdev] RSS returned ${res.status}, trying HTML fallback`);
      return scrapeHtml(criteria);
    }

    const xml = await res.text();

    // Check if we actually got XML
    if (!xml.includes("<rss") && !xml.includes("<item")) {
      console.warn("[arcdev] RSS response is not XML, trying HTML fallback");
      return scrapeHtml(criteria);
    }

    const items = parseRssItems(xml);
    console.log(`[arcdev] Fetched ${items.length} items from RSS`);

    const results: ScrapedVacancy[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const { company, title } = parseCompanyAndTitle(item.title);
      if (!matchesTitle(title, criteria.jobTitles)) continue;

      const externalId = extractExternalId(item.link || item.guid);
      if (!externalId || seen.has(externalId)) continue;
      seen.add(externalId);

      const description = stripHtml(item.description);
      const salary = parseSalary(description + " " + item.title);

      results.push({
        platform: "arcdev",
        externalId,
        url: item.link,
        title,
        company,
        location: "Remote",
        salaryText: salary.min ? `$${salary.min.toLocaleString()} - $${(salary.max || salary.min).toLocaleString()}` : null,
        salaryMin: salary.min,
        salaryMax: salary.max,
        salaryCurrency: salary.currency,
        remoteType: "remote",
        employmentType: "full-time",
        description: description.slice(0, 500),
        language: "en",
        postedAt: item.pubDate ? new Date(item.pubDate) : null,
      });
    }

    console.log(`[arcdev] Returning ${results.length} vacancies from RSS`);
    return results;
  } catch (err) {
    console.error(
      "[arcdev] RSS error:",
      err instanceof Error ? err.message : err
    );
    return scrapeHtml(criteria);
  }
}

/**
 * HTML fallback scraper for arc.dev/remote-jobs
 */
async function scrapeHtml(
  criteria: SearchCriteria
): Promise<ScrapedVacancy[]> {
  console.log("[arcdev] Trying HTML scraping...");
  const results: ScrapedVacancy[] = [];

  for (let i = 0; i < criteria.jobTitles.length; i++) {
    const keyword = criteria.jobTitles[i];
    const url = `https://arc.dev/remote-jobs?query=${encodeURIComponent(keyword)}`;

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      if (!res.ok) {
        console.warn(`[arcdev] HTML for "${keyword}" returned ${res.status}`);
        continue;
      }

      const html = await res.text();
      const seenIds = new Set<string>();

      // Find job links on arc.dev
      const jobLinkPattern = /href="(\/remote-jobs\/[\w-]+)"/gi;
      let linkMatch;

      while ((linkMatch = jobLinkPattern.exec(html)) !== null) {
        const href = linkMatch[1];
        const id = href.split("/").pop() || "";
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const pos = linkMatch.index;
        const regionStart = Math.max(0, pos - 500);
        const regionEnd = Math.min(html.length, pos + 1500);
        const region = html.substring(regionStart, regionEnd);

        const titleMatch =
          region.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i) ||
          region.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\//i);
        const title = titleMatch ? stripHtml(titleMatch[1]) : "";
        if (!title || !matchesTitle(title, [keyword])) continue;

        const companyMatch =
          region.match(/class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\//i);
        const company = companyMatch ? stripHtml(companyMatch[1]) : "Unknown";

        results.push({
          platform: "arcdev",
          externalId: id,
          url: `https://arc.dev${href}`,
          title,
          company,
          location: "Remote",
          salaryText: null,
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          remoteType: "remote",
          employmentType: "full-time",
          description: "",
          language: "en",
          postedAt: null,
        });
      }

      console.log(`[arcdev] "${keyword}" HTML: found ${seenIds.size} jobs`);
    } catch (err) {
      console.error(
        `[arcdev] HTML error "${keyword}":`,
        err instanceof Error ? err.message : err
      );
    }

    if (i < criteria.jobTitles.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log(`[arcdev] Returning ${results.length} vacancies from HTML`);
  return results;
}
