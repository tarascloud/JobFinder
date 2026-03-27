import type {
  AnalyzedProfile,
  AnalyzedSearchProfile,
  AnalyzedQaPair,
} from "@/actions/profile";
import type { ResumeRecommendation } from "@/actions/resume-recommendations";

export type ReviewTab = "profile" | "searches" | "qa";
export type AIModel = "ollama" | "gemini" | "groq";

export const ANALYSIS_MESSAGES = [
  "analyzing_extracting",
  "analyzing_profile",
  "analyzing_searches",
  "analyzing_qa",
] as const;

export type { AnalyzedProfile, AnalyzedSearchProfile, AnalyzedQaPair, ResumeRecommendation };
