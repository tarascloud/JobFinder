"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";

type FollowUpType =
  | "after_apply"
  | "after_interview"
  | "thank_you"
  | "check_status";

interface EmailTemplateResult {
  subject: string;
  body: string;
}

export async function generateFollowUp(
  applicationId: number,
  type: FollowUpType
): Promise<EmailTemplateResult | { error: string }> {
  try {
    const user = await requireUser();

    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId: user.id },
      include: {
        vacancy: true,
      },
    });

    if (!application) return { error: "Application not found" };

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!userProfile) return { error: "Please create your profile first" };

    const typeLabels: Record<FollowUpType, string> = {
      after_apply: "Follow-up after submitting an application",
      after_interview: "Follow-up after an interview",
      thank_you: "Thank you note after an interview",
      check_status: "Checking on application status",
    };

    const typeInstructions: Record<FollowUpType, string> = {
      after_apply:
        "Write a professional follow-up email sent 3-5 days after submitting the application. Express continued interest, briefly reiterate value, and ask about next steps.",
      after_interview:
        "Write a follow-up email sent 1-2 days after the interview. Reference specific topics discussed (suggest placeholders), express enthusiasm, and reiterate fit for the role.",
      thank_you:
        "Write a concise thank-you email sent within 24 hours of the interview. Thank the interviewer for their time, mention a specific highlight from the conversation (suggest placeholder), and confirm interest.",
      check_status:
        "Write a polite status check email for an application that has been pending for a while. Be professional and not pushy, express continued interest, and ask about timeline.",
    };

    const profileName = user.name ?? "the candidate";
    const appliedDate = application.appliedAt
      ? new Date(application.appliedAt).toLocaleDateString()
      : "recently";

    const prompt = `Generate a professional follow-up email for this job application.

Type: ${typeLabels[type]}
Job: ${application.vacancy.title} at ${application.vacancy.company ?? "the company"}
Job Description (brief): ${application.vacancy.description.slice(0, 1500)}
Candidate: ${profileName}
Headline: ${userProfile.headline ?? "Not specified"}
Applied date: ${appliedDate}
Application status: ${application.status}

Instructions: ${typeInstructions[type]}

The email should:
- Be professional but warm
- Be concise (3-5 short paragraphs max)
- Include [PLACEHOLDER] markers for details the candidate should fill in (e.g., interviewer name, specific discussion topics)
- Match the language of the job posting if possible

Return as JSON with this exact structure:
{
  "subject": "Email subject line",
  "body": "Full email body text"
}`;

    const result = await callAIJSON<EmailTemplateResult>(prompt, {
      userId: user.id,
      systemPrompt:
        "You are an expert career coach writing professional follow-up emails. Write emails that are concise, professional, and personalized. Return only valid JSON.",
    });

    return result;
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Failed to generate email template",
    };
  }
}
