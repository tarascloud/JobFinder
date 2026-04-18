export interface VacancyDetail {
  id: number;
  platform: string;
  externalId: string;
  url: string;
  title: string;
  company: string | null;
  location: string | null;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  remoteType: string | null;
  employmentType: string | null;
  description: string;
  language: string | null;
  postedAt: Date | null;
  scrapedAt: Date;
  scores: {
    id: number;
    matchScore: number;
    salaryFit: boolean | null;
    remoteFit: boolean | null;
    notes: string | null;
    scoredAt: Date;
    scoredBy: string | null;
    searchProfile: { id: number; name: string };
  }[];
  application: {
    id: number;
    status: string;
    coverLetter: string | null;
    appliedAt: Date | null;
    searchProfileId: number;
  } | null;
  qaPairs: { id: number; question: string; answer: string | null }[];
}

export const statusColors: Record<string, "yellow" | "blue" | "green" | "purple" | "indigo" | "red"> = {
  queued: "yellow",
  approved: "blue",
  applied: "green",
  response: "purple",
  interview: "indigo",
  offer: "green",
  rejected: "red",
  withdrawn: "red",
};

export function scoreColor(score: number) {
  if (score >= 90) return "text-green-400";
  if (score >= 75) return "text-primary";
  return "text-muted-foreground";
}

export interface CompanyData {
  description: string;
  industry: string;
  size: string;
  founded: string;
  headquarters: string;
  keyFacts: string[];
  recentNews: string[];
  glassdoorRating?: string;
  techStack?: string[];
  workCulture?: string;
}

export interface TailorData {
  suggestions: { section: string; original: string; suggested: string; reason: string }[];
  tailoredSummary: string;
  keywordsToAdd: string[];
  keywordsToRemove: string[];
}
