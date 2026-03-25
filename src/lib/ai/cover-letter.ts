import { callGemini } from "./gemini";

interface VacancyInput {
  title: string;
  company?: string | null;
  description: string;
}

interface UserProfileInput {
  headline?: string | null;
  summary?: string | null;
  yearsExperience?: number | null;
  skills: string[];
}

export async function generateCoverLetter(
  vacancy: VacancyInput,
  userProfile: UserProfileInput,
  language?: string
): Promise<string> {
  const descriptionTruncated = vacancy.description.slice(0, 1500);

  const prompt = `Write a concise, professional cover letter (3-4 paragraphs) for this job application.

Job: ${vacancy.title} at ${vacancy.company ?? "the company"}
Description: ${descriptionTruncated}

Candidate: ${userProfile.headline ?? "Professional"}
Experience: ${userProfile.yearsExperience ?? "Several"} years
Skills: ${userProfile.skills.join(", ") || "Not specified"}
Summary: ${userProfile.summary ?? "Experienced professional"}

Language: Write in ${language || "the language of the job description"}.
Tone: Professional but personable. Highlight relevant experience. Don't be generic.
Do NOT include addresses or dates. Start with "Dear Hiring Team," or similar.`;

  return callGemini(prompt);
}
