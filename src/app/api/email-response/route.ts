import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTelegramNotification } from "@/lib/telegram";
import { createNotification } from "@/actions/notifications";

function verifyApiToken(request: NextRequest): boolean {
  const secret = process.env.JOBFINDER_EMAIL_API_TOKEN;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

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
  if (!verifyApiToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { from, subject, body: emailBody, responseType } = body as {
      from: string;
      subject: string;
      body?: string;
      responseType: string;
    };

    if (!from || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: from, subject" },
        { status: 400 }
      );
    }

    const senderDomain = extractDomain(from);
    const senderCompany = domainToCompany(senderDomain);

    // Try to match to an existing application by company domain
    let matchedApplication = null;

    if (senderCompany) {
      // Search applications where vacancy company contains the sender domain company name
      matchedApplication = await prisma.application.findFirst({
        where: {
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

    // Save the email response
    const emailResponse = await prisma.$queryRawUnsafe(
      `INSERT INTO email_responses (from_email, subject, body, response_type, matched, application_id, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id`,
      from,
      subject,
      emailBody?.substring(0, 10000) || null,
      responseType || "info",
      !!matchedApplication,
      matchedApplication?.id || null
    ) as { id: number }[];

    const savedId = emailResponse[0]?.id;

    // If matched, update the application status based on responseType
    if (matchedApplication) {
      const statusMap: Record<string, string> = {
        interview: "interview",
        positive: "response",
        rejection: "rejected",
        info: "response",
      };
      const newStatus = statusMap[responseType] || "response";

      await prisma.application.update({
        where: { id: matchedApplication.id },
        data: {
          status: newStatus,
          applyLog: `Email response (${responseType}) from ${from} at ${new Date().toISOString()}`,
        },
      });
    }

    // Send Telegram notification for positive/interview responses
    if (responseType === "interview" || responseType === "positive") {
      const lines = [
        `<b>JobFinder Email</b>`,
        `Type: ${responseType === "interview" ? "Interview" : "Positive response"}`,
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
      (responseType === "interview" || responseType === "positive")
    ) {
      const companyName =
        matchedApplication.vacancy.company || "A company";
      const notifType =
        responseType === "interview"
          ? "interview_scheduled"
          : "application_response";
      const notifTitle =
        responseType === "interview"
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
      responseType,
    });
  } catch (error) {
    console.error("[email-response] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
