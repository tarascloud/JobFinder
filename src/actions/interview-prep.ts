"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";

interface StoryEntry {
  theme: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  tags: string[];
}

interface InterviewPrepResult {
  companyOverview: string;
  roleAnalysis: string;
  potentialQuestions: { question: string; suggestedAnswer: string }[];
  talkingPoints: string[];
  questionsToAsk: string[];
  stories?: StoryEntry[];
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

    // Load existing stories to reuse them
    const existingStories = await prisma.interviewStory.findMany({
      where: { userId: user.id },
      orderBy: { usedCount: "desc" },
      take: 20,
    });

    const descriptionTruncated = application.vacancy.description.slice(0, 3000);
    const profileSummary = [
      userProfile.headline,
      `${userProfile.yearsExperience ?? "Several"} years of experience`,
      `Skills: ${userProfile.skills.join(", ") || "Not specified"}`,
      userProfile.summary,
    ]
      .filter(Boolean)
      .join(". ");

    const existingStoriesContext =
      existingStories.length > 0
        ? `\n\nCandidate's existing STAR+R stories (reuse where relevant, don't duplicate):\n${existingStories
            .map(
              (s, i) =>
                `Story ${i + 1} [theme: ${s.theme}, tags: ${s.tags.join(", ")}]:\n  S: ${s.situation.slice(0, 150)}\n  T: ${s.task.slice(0, 100)}\n  A: ${s.action.slice(0, 150)}\n  R: ${s.result.slice(0, 100)}\n  Reflection: ${s.reflection.slice(0, 100)}`
            )
            .join("\n\n")}`
        : "";

    const prompt = `Based on this job listing and candidate profile, generate interview preparation.

Job: ${application.vacancy.title} at ${application.vacancy.company ?? "the company"}
Description: ${descriptionTruncated}

Candidate: ${profileSummary}${existingStoriesContext}

Generate:
1. Brief company overview (what they do, culture, recent news if known)
2. Role analysis (what they're looking for, red/green flags)
3. 10 likely interview questions with suggested answers tailored to the candidate
4. 5 key talking points the candidate should highlight
5. 5 good questions the candidate should ask the interviewer
6. 3-5 STAR+R behavioral stories relevant to THIS role. ${existingStories.length > 0 ? "Reuse existing stories where applicable (reference same theme/situation). Only add new stories for gaps not covered." : "Generate fresh stories based on candidate's experience."}

Return as JSON with this exact structure:
{
  "companyOverview": "string",
  "roleAnalysis": "string",
  "potentialQuestions": [{"question": "string", "suggestedAnswer": "string"}],
  "talkingPoints": ["string"],
  "questionsToAsk": ["string"],
  "stories": [
    {
      "theme": "string (e.g. leadership, conflict resolution, technical challenge)",
      "situation": "string",
      "task": "string",
      "action": "string",
      "result": "string",
      "reflection": "string (what I learned or what I'd do differently)",
      "tags": ["skill1", "skill2"]
    }
  ]
}`;

    const result = await callAIJSON<InterviewPrepResult>(prompt, {
      userId: user.id,
      systemPrompt:
        "You are an expert career coach helping candidates prepare for job interviews. Return only valid JSON.",
    });

    // Persist new/updated stories to the bank
    if (result.stories?.length) {
      const existingThemes = new Set(existingStories.map((s) => s.theme.toLowerCase()));

      for (const story of result.stories) {
        const themeKey = story.theme.toLowerCase();

        if (existingThemes.has(themeKey)) {
          // Increment usedCount for existing story with same theme
          await prisma.interviewStory.updateMany({
            where: {
              userId: user.id,
              theme: { equals: story.theme, mode: "insensitive" },
            },
            data: { usedCount: { increment: 1 } },
          });
        } else {
          // Save as new story
          await prisma.interviewStory.create({
            data: {
              userId: user.id,
              theme: story.theme,
              situation: story.situation,
              task: story.task,
              action: story.action,
              result: story.result,
              reflection: story.reflection,
              tags: story.tags ?? [],
              usedCount: 1,
            },
          });
          existingThemes.add(themeKey);
        }
      }
    }

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
