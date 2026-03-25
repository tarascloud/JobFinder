import { callGeminiJSON } from "./gemini";

export interface VacancyScoreResult {
  matchScore: number; // 0-100
  salaryFit: boolean;
  remoteFit: boolean;
  notes: string;
}

interface VacancyInput {
  title: string;
  company?: string | null;
  location?: string | null;
  description: string;
  salaryText?: string | null;
  remoteType?: string | null;
}

interface UserProfileInput {
  headline?: string | null;
  summary?: string | null;
  yearsExperience?: number | null;
  skills: string[];
}

interface SearchCriteriaInput {
  jobTitles: string[];
  minSalary?: number | null;
  currency?: string | null;
  remoteOnly: boolean;
  geographies: string[];
}

export async function scoreVacancy(
  vacancy: VacancyInput,
  userProfile: UserProfileInput,
  searchCriteria: SearchCriteriaInput
): Promise<VacancyScoreResult> {
  const descriptionTruncated = vacancy.description.slice(0, 2000);

  const prompt = `You are a job matching AI. Score this vacancy against the candidate's profile and search criteria.

Vacancy: ${vacancy.title} at ${vacancy.company ?? "Unknown"}, ${vacancy.location ?? "Unknown"}
Description: ${descriptionTruncated}
Salary: ${vacancy.salaryText ?? "Not specified"}
Remote type: ${vacancy.remoteType ?? "Not specified"}

Candidate: ${userProfile.headline ?? "Not specified"}, ${userProfile.yearsExperience ?? "Unknown"} years experience
Skills: ${userProfile.skills.join(", ") || "Not specified"}
Looking for: ${searchCriteria.jobTitles.join(", ") || "Not specified"}
Min salary: ${searchCriteria.minSalary ?? "Not specified"} ${searchCriteria.currency ?? "EUR"}/year
Remote only: ${searchCriteria.remoteOnly}
Geographies: ${searchCriteria.geographies.join(", ") || "Not specified"}

Return JSON: { "matchScore": 0-100, "salaryFit": true/false, "remoteFit": true/false, "notes": "brief explanation" }`;

  const result = await callGeminiJSON<VacancyScoreResult>(prompt);

  return {
    matchScore: Math.max(0, Math.min(100, Math.round(result.matchScore))),
    salaryFit: Boolean(result.salaryFit),
    remoteFit: Boolean(result.remoteFit),
    notes: String(result.notes || ""),
  };
}
