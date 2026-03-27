import { callAI } from "./provider";

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

export type CoverLetterVariant = "formal" | "casual" | "technical";

const VARIANT_TONES: Record<CoverLetterVariant, string> = {
  formal:
    "Formal and polished. Use traditional business language, structured paragraphs, and a respectful tone throughout.",
  casual:
    "Conversational and personable. Write as if speaking to a colleague — friendly, enthusiastic, and direct. Avoid stiff corporate language.",
  technical:
    "Technical and evidence-based. Lead with specific technologies, metrics, and concrete achievements. Minimize fluff, maximize substance.",
};

export function pickCoverLetterVariant(): CoverLetterVariant {
  const variants: CoverLetterVariant[] = ["formal", "casual", "technical"];
  return variants[Math.floor(Math.random() * variants.length)];
}

export async function generateCoverLetter(
  vacancy: VacancyInput,
  userProfile: UserProfileInput,
  language?: string,
  variant?: CoverLetterVariant,
  options?: { userId?: number }
): Promise<{ text: string; variant: CoverLetterVariant }> {
  const chosenVariant = variant ?? pickCoverLetterVariant();
  const descriptionTruncated = vacancy.description.slice(0, 1500);

  const prompt = `Write a concise, professional cover letter (3-4 paragraphs) for this job application.

Job: ${vacancy.title} at ${vacancy.company ?? "the company"}
Description: ${descriptionTruncated}

Candidate: ${userProfile.headline ?? "Professional"}
Experience: ${userProfile.yearsExperience ?? "Several"} years
Skills: ${userProfile.skills.join(", ") || "Not specified"}
Summary: ${userProfile.summary ?? "Experienced professional"}

Language: Write in ${language || "the language of the job description"}.
Tone: ${VARIANT_TONES[chosenVariant]}
Do NOT include addresses or dates. Start with "Dear Hiring Team," or similar.`;

  const text = await callAI(prompt, { userId: options?.userId });
  return { text, variant: chosenVariant };
}
