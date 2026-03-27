export type SortBy = "score" | "date" | "salary";

export interface Vacancy {
  id: number;
  platform: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryMinEur: number | null;
  salaryMaxEur: number | null;
  remoteType: string | null;
  employmentType: string | null;
  postedAt: Date | string | null;
  scrapedAt: Date | string | null;
  matchScore: number | null;
  matchNotes: string | null;
  salaryFit: string | null;
  remoteFit: string | null;
  dismissed: boolean;
  applicationId: number | null;
  applicationStatus: string | null;
  appliedWithPersonalAccount: boolean;
  tagStack: string[];
  tagLevel: string | null;
  tagIndustry: string | null;
  tagTeamSize: string | null;
}

export interface ScrapeStatus {
  lastScrapeAt: Date | string | null;
  newLast24h: number;
  total: number;
  byPlatform: Record<string, number>;
  error?: string;
}

export interface SearchProfile {
  id: number;
  name: string;
  isActive: boolean;
}

export interface ScrapeProgress {
  platform: string;
  status: "scraping" | "done" | "error";
  count?: number;
}

export function scoreBadgeVariant(score: number | null): "green" | "yellow" | "red" | "default" {
  if (score === null) return "default";
  if (score > 70) return "green";
  if (score > 40) return "yellow";
  return "red";
}

export function platformIcon(platform: string): string {
  const icons: Record<string, string> = {
    linkedin: "LI",
    indeed: "IN",
    glassdoor: "GD",
    weworkremotely: "WR",
    remoteok: "RO",
  };
  return icons[platform.toLowerCase()] ?? platform.slice(0, 2).toUpperCase();
}

export function applicationStatusVariant(
  status: string | null
): "yellow" | "blue" | "purple" | "green" | "emerald" | "red" | "default" {
  if (!status) return "default";
  const map: Record<string, "yellow" | "blue" | "purple" | "green" | "emerald" | "red"> = {
    queued: "yellow",
    applied: "blue",
    response: "purple",
    interview: "green",
    offer: "emerald",
    reject: "red",
    rejected: "red",
    approved: "blue",
    withdrawn: "red",
  };
  return map[status] ?? "default";
}

export function applicationStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
