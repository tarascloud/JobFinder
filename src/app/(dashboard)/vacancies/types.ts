export type SortBy = "score" | "date" | "salary";

export interface Vacancy {
  id: number;
  userVacancyId?: number;
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
  salaryFit: boolean | string | null;
  remoteFit: boolean | string | null;
  dismissed: boolean;
  seen: boolean;
  savedAt?: Date | string | null;
  scoredAt?: Date | string | null;
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
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

export function scoreBadgeColor(score: number | null): string {
  if (score === null) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-green-500/15 text-green-600 dark:text-green-400";
  if (score >= 60) return "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400";
  return "bg-red-500/15 text-red-600 dark:text-red-400";
}

export function platformIcon(platform: string): string {
  const icons: Record<string, string> = {
    linkedin: "LI",
    indeed: "IN",
    glassdoor: "GD",
    weworkremotely: "WR",
    remoteok: "RO",
    wellfound: "WF",
    hn: "HN",
    djinni: "DJ",
    ziprecruiter: "ZR",
    google: "GO",
    stackoverflow: "SO",
  };
  return icons[platform.toLowerCase()] ?? platform.slice(0, 2).toUpperCase();
}

export function platformColor(platform: string): string {
  const colors: Record<string, string> = {
    linkedin: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    indeed: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    glassdoor: "bg-green-500/15 text-green-600 dark:text-green-400",
    weworkremotely: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    remoteok: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    wellfound: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    hn: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    djinni: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  };
  return colors[platform.toLowerCase()] ?? "bg-muted text-muted-foreground";
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

export function formatRelativeDate(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
