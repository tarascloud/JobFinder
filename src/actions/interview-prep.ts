"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";

interface InterviewPrepResult {
  companyOverview: string;
  roleAnalysis: string;
  potentialQuestions: { question: string; suggestedAnswer: string }[];
  talkingPoints: string[];
  questionsToAsk: string[];
}

export async function generateInterviewPrep(
  applicationId: number
): Promise<InterviewPrepResult | { error: string }> {
  try {
    const user = await requireUser();

    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId: user.id },
      include: {
        vacancy: true,
      },
    });

    if (!application) return { error: "Application not found" };
    if (application.status !== "interview") {
      return { error: "Application must have interview status" };
    }

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!userProfile) return { error: "Please create your profile first" };

    const descriptionTruncated = application.vacancy.description.slice(0, 3000);
    const profileSummary = [
      userProfile.headline,
      `${userProfile.yearsExperience ?? "Several"} years of experience`,
      `Skills: ${userProfile.skills.join(", ") || "Not specified"}`,
      userProfile.summary,
    ]
      .filter(Boolean)
      .join(". ");

    const prompt = `Based on this job listing and candidate profile, generate interview preparation.

Job: ${application.vacancy.title} at ${application.vacancy.company ?? "the company"}
Description: ${descriptionTruncated}

Candidate: ${profileSummary}

Generate:
1. Brief company overview (what they do, culture, recent news if known)
2. Role analysis (what they're looking for, red/green flags)
3. 10 likely interview questions with suggested answers tailored to the candidate
4. 5 key talking points the candidate should highlight
5. 5 good questions the candidate should ask the interviewer

Return as JSON with this exact structure:
{
  "companyOverview": "string",
  "roleAnalysis": "string",
  "potentialQuestions": [{"question": "string", "suggestedAnswer": "string"}],
  "talkingPoints": ["string"],
  "questionsToAsk": ["string"]
}`;

    const result = await callAIJSON<InterviewPrepResult>(prompt, {
      userId: user.id,
      systemPrompt:
        "You are an expert career coach helping candidates prepare for job interviews. Return only valid JSON.",
    });

    // Save to DB
    await prisma.application.update({
      where: { id: applicationId },
      data: { interviewPrep: JSON.stringify(result) },
    });

    return result;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to generate interview prep",
    };
  }
}

export async function getInterviewPrep(
  applicationId: number
): Promise<
  | (InterviewPrepResult & {
      applicationId: number;
      vacancyTitle: string;
      company: string | null;
      status: string;
    })
  | { error: string }
> {
  try {
    const user = await requireUser();

    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId: user.id },
      include: {
        vacancy: {
          select: { title: true, company: true },
        },
      },
    });

    if (!application) return { error: "Application not found" };

    if (!application.interviewPrep) {
      return { error: "No interview prep generated yet" };
    }

    const prep = JSON.parse(application.interviewPrep) as InterviewPrepResult;

    return {
      ...prep,
      applicationId: application.id,
      vacancyTitle: application.vacancy.title,
      company: application.vacancy.company,
      status: application.status,
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to load interview prep",
    };
  }
}
