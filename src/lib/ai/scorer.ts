import { callAIJSON } from "./provider";

export interface RequirementMatch {
  requirement: string;
  matched: boolean;
  evidence: string;
}

export interface GapItem {
  skill: string;
  severity: "critical" | "moderate" | "minor";
  mitigation: string;
}

export interface DetailedAnalysis {
  requirements: RequirementMatch[];
  gaps: GapItem[];
  keywords: string[];
}

export interface VacancyScoreResult {
  matchScore: number; // 0-100
  salaryFit: boolean;
  remoteFit: boolean;
  notes: string;
  detailedAnalysis?: DetailedAnalysis;
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

interface AIScoreResponse {
  matchScore: number;
  salaryFit: boolean;
  remoteFit: boolean;
  notes: string;
  requirements: Array<{ requirement: string; matched: boolean; evidence: string }>;
  gaps: Array<{ skill: string; severity: string; mitigation: string }>;
  keywords: string[];
}

export async function scoreVacancy(
  vacancy: VacancyInput,
  userProfile: UserProfileInput,
  searchCriteria: SearchCriteriaInput,
  options?: { userId?: number }
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

Return a JSON object with ALL of the following fields:
{
  "matchScore": 0-100 integer overall match score,
  "salaryFit": true/false whether salary meets candidate minimum,
  "remoteFit": true/false whether remote policy matches candidate preference,
  "notes": "brief 1-2 sentence explanation of the score",
  "requirements": [
    { "requirement": "extracted requirement from job description", "matched": true/false, "evidence": "why matched or not based on candidate profile" }
  ],
  "gaps": [
    { "skill": "missing skill or experience", "severity": "critical|moderate|minor", "mitigation": "how candidate could address this gap" }
  ],
  "keywords": ["ats", "keyword", "list", "from", "job", "description"]
}

Extract 5-10 key requirements from the job description for "requirements".
List only real gaps (skills/experience the candidate clearly lacks) in "gaps".
Extract 10-20 ATS keywords from the job description for resume optimization in "keywords".`;

  const result = await callAIJSON<AIScoreResponse>(prompt, { userId: options?.userId });

  const requirements: RequirementMatch[] = Array.isArray(result.requirements)
    ? result.requirements.map((r) => ({
        requirement: String(r.requirement || ""),
        matched: Boolean(r.matched),
        evidence: String(r.evidence || ""),
      }))
    : [];

  const gaps: GapItem[] = Array.isArray(result.gaps)
    ? result.gaps
        .filter((g) => ["critical", "moderate", "minor"].includes(g.severity))
        .map((g) => ({
          skill: String(g.skill || ""),
          severity: g.severity as "critical" | "moderate" | "minor",
          mitigation: String(g.mitigation || ""),
        }))
    : [];

  const keywords: string[] = Array.isArray(result.keywords)
    ? result.keywords.map((k) => String(k))
    : [];

  return {
    matchScore: Math.max(0, Math.min(100, Math.round(result.matchScore))),
    salaryFit: Boolean(result.salaryFit),
    remoteFit: Boolean(result.remoteFit),
    notes: String(result.notes || ""),
    detailedAnalysis:
      requirements.length > 0 || gaps.length > 0 || keywords.length > 0
        ? { requirements, gaps, keywords }
        : undefined,
  };
}
