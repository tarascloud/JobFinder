import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyApiToken } from "@/lib/api-auth";
import { sendTelegramNotification } from "@/lib/telegram";
import { createNotification } from "@/actions/notifications";
import { sanitizeHtml } from "@/lib/sanitize-html";

const EmailResponseSchema = z.object({
  from: z.string().min(1),
  to: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().optional(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  messageId: z.string().optional(),
  responseType: z.string(),
});

// Defense-in-depth bound on stored bodyHtml. CF Worker already trims to ~50KB,
// but the boundary must enforce its own ceiling so a misbehaving / malicious
// upstream cannot bloat the EmailResponse table.
const MAX_BODY_HTML = 50_000;

/**
 * Extract domain from email address, e.g. "recruiter@google.com" -> "google.com"
 */
function extractDomain(email: string): string {
  const match = email.match(/@([^>]+)>?$/);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Extract company name from domain, e.g. "google.com" -> "google"
 */
function domainToCompany(domain: string): string {
  return domain.replace(/\.(com|io|co|org|net|eu|es|de|uk|nl|se|fr|it).*$/, "").toLowerCase();
}

export async function POST(request: NextRequest) {
  if (!verifyApiToken(request, "JOBFINDER_EMAIL_API_TOKEN", "JF_INBOX_TOKEN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = EmailResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { from, to, subject, body: emailBody, bodyText, bodyHtml, messageId, responseType } = parsed.data;

    const allowedResponseTypes = ["positive", "rejection", "interview", "info"];
    const validatedResponseType = allowedResponseTypes.includes(responseType)
      ? responseType
      : "info";

    // Derive userId ONLY from the `to` address (jfEmail) — never trust userId from body
    let resolvedUserId: number | undefined;
    if (to) {
      const toAddress = to.replace(/^.*</, "").replace(/>.*$/, "").trim().toLowerCase();
      if (toAddress.endsWith("@jf.taras.cloud")) {
        const targetUser = await prisma.user.findUnique({
          where: { jfEmail: toAddress },
          select: { id: true },
        });
        if (targetUser) {
          resolvedUserId = targetUser.id;
        }
      }
    }

    const senderDomain = extractDomain(from);
    const senderCompany = domainToCompany(senderDomain);

    // Try to match to an existing application by company domain
    let matchedApplication = null;

    if (senderCompany) {
      // Search applications where vacancy company contains the sender domain company name
      matchedApplication = await prisma.application.findFirst({
        where: {
          ...(resolvedUserId ? { userId: resolvedUserId } : {}),
          vacancy: {
            company: {
              contains: senderCompany,
              mode: "insensitive",
            },
          },
          status: { in: ["applied", "approved", "pending_manual", "response", "interview"] },
        },
        include: {
          vacancy: { select: { id: true, title: true, company: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // If not found by company, try matching by subject containing vacancy title
    if (!matchedApplication) {
      const subjectLower = subject.toLowerCase();
      const recentApplications = await prisma.application.findMany({
        where: {
          ...(resolvedUserId ? { userId: resolvedUserId } : {}),
          status: { in: ["applied", "approved", "pending_manual", "response", "interview"] },
        },
        include: {
          vacancy: { select: { id: true, title: true, company: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      for (const app of recentApplications) {
        const title = app.vacancy.title.toLowerCase();
        // Check if the subject contains key words from the vacancy title
        const titleWords = title.split(/\s+/).filter((w) => w.length > 3);
        const matchCount = titleWords.filter((w) => subjectLower.includes(w)).length;
        if (matchCount >= 2 || (titleWords.length <= 2 && matchCount >= 1)) {
          matchedApplication = app;
          break;
        }
      }
    }

    // Sanitize bodyHtml at the trust boundary BEFORE persisting. CF Worker
    // already substring(0, 50000)s it but defense-in-depth: re-cap, then run
    // through the canonical DOMPurify-based sanitizeHtml() so any XSS payload
    // stripped at storage time cannot resurface even if a future caller
    // forgets to sanitize on render.
    let sanitizedBodyHtml: string | null = null;
    if (bodyHtml) {
      const capped = bodyHtml.length > MAX_BODY_HTML ? bodyHtml.substring(0, MAX_BODY_HTML) : bodyHtml;
      sanitizedBodyHtml = sanitizeHtml(capped);
    }

    // Save the email response (include userId when provided by per-user email worker)
    const savedEmail = await prisma.emailResponse.create({
      data: {
        userId: resolvedUserId ?? matchedApplication?.userId ?? null,
        fromEmail: from,
        subject,
        body: emailBody?.substring(0, 10000) || null,
        bodyText: bodyText ? bodyText.substring(0, 10000) : null,
        bodyHtml: sanitizedBodyHtml,
        messageId: messageId || null,
        responseType: validatedResponseType,
        matched: !!matchedApplication,
        applicationId: matchedApplication?.id || null,
        receivedAt: new Date(),
      },
    });

    const savedId = savedEmail.id;

    // If matched, update the application status based on responseType
    if (matchedApplication) {
      const statusMap: Record<string, string> = {
        interview: "interview",
        positive: "response",
        rejection: "rejected",
        info: "response",
      };
      const newStatus = statusMap[validatedResponseType] || "response";

      await prisma.application.update({
        where: { id: matchedApplication.id },
        data: {
          status: newStatus,
          applyLog: `Email response (${validatedResponseType}) from ${from} at ${new Date().toISOString()}`,
        },
      });
    }

    // Send Telegram notification for positive/interview responses
    if (validatedResponseType === "interview" || validatedResponseType === "positive") {
      const lines = [
        `<b>JobFinder Email</b>`,
        `Type: ${validatedResponseType === "interview" ? "Interview" : "Positive response"}`,
        `From: ${from}`,
        `Subject: ${subject}`,
        matchedApplication
          ? `Matched: ${matchedApplication.vacancy.title} @ ${matchedApplication.vacancy.company}`
          : "Not matched to any application",
      ];
      await sendTelegramNotification(lines.join("\n"));
    }

    // Create in-app notification for positive/interview responses
    if (
      matchedApplication &&
      (validatedResponseType === "interview" || validatedResponseType === "positive")
    ) {
      const companyName =
        matchedApplication.vacancy.company || "A company";
      const notifType =
        validatedResponseType === "interview"
          ? "interview_scheduled"
          : "application_response";
      const notifTitle =
        validatedResponseType === "interview"
          ? `${companyName} scheduled an interview!`
          : `${companyName} responded!`;
      const notifMessage = `${subject} - ${from}`;
      const notifLink = matchedApplication.id
        ? `/applications/${matchedApplication.id}/prep`
        : "/emails";

      await createNotification(
        matchedApplication.userId,
        notifType,
        notifTitle,
        notifMessage,
        notifLink
      );
    }

    return NextResponse.json({
      id: savedId,
      matched: !!matchedApplication,
      applicationId: matchedApplication?.id || null,
      responseType: validatedResponseType,
    });
  } catch (error) {
    console.error("[email-response] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
