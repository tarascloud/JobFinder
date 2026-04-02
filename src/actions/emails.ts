"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

interface EmailResponse {
  id: number;
  fromEmail: string;
  subject: string;
  body: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  messageId: string | null;
  responseType: string;
  matched: boolean;
  read: boolean;
  applicationId: number | null;
  receivedAt: Date;
  vacancyTitle?: string | null;
  vacancyCompany?: string | null;
}

interface EmailFilters {
  matched?: boolean;
  responseType?: string;
  page?: number;
  limit?: number;
}

export async function getEmailResponses(filters?: EmailFilters) {
  try {
    const user = await requireUser();

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: { userId: number; matched?: boolean; responseType?: string } = {
      userId: user.id,
    };
    if (filters?.matched !== undefined) {
      where.matched = filters.matched;
    }
    if (filters?.responseType) {
      where.responseType = filters.responseType;
    }

    const [total, emailRows] = await Promise.all([
      prisma.emailResponse.count({ where }),
      prisma.emailResponse.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        take: limit,
        skip,
      }),
    ]);

    // Fetch vacancy info for matched emails via their applicationId
    const applicationIds = emailRows
      .filter((e) => e.applicationId !== null)
      .map((e) => e.applicationId as number);

    const vacancyMap = new Map<number, { title: string | null; company: string | null }>();
    if (applicationIds.length > 0) {
      const applications = await prisma.application.findMany({
        where: { id: { in: applicationIds }, userId: user.id },
        select: { id: true, vacancy: { select: { title: true, company: true } } },
      });
      for (const app of applications) {
        vacancyMap.set(app.id, { title: app.vacancy.title, company: app.vacancy.company });
      }
    }

    const emails: EmailResponse[] = emailRows.map((e) => {
      const vacancy = e.applicationId ? vacancyMap.get(e.applicationId) : undefined;
      return {
        id: e.id,
        fromEmail: e.fromEmail,
        subject: e.subject,
        body: e.body,
        bodyText: e.bodyText,
        bodyHtml: e.bodyHtml,
        messageId: e.messageId,
        responseType: e.responseType,
        matched: e.matched,
        read: e.read,
        applicationId: e.applicationId,
        receivedAt: e.receivedAt,
        vacancyTitle: vacancy?.title ?? null,
        vacancyCompany: vacancy?.company ?? null,
      };
    });

    return {
      emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load email responses" };
  }
}

export async function linkEmailToApplication(emailId: number, applicationId: number) {
  try {
    const user = await requireUser();

    // Verify the email belongs to this user before linking
    const email = await prisma.emailResponse.findFirst({
      where: { id: emailId, userId: user.id },
    });
    if (!email) return { error: "Email not found" };

    // Verify the application belongs to this user
    const application = await prisma.application.findFirst({
      where: { id: applicationId, userId: user.id },
    });
    if (!application) return { error: "Application not found" };

    await prisma.emailResponse.update({
      where: { id: emailId },
      data: { applicationId, matched: true },
    });

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to link email" };
  }
}

export async function getUnmatchedEmailCount() {
  try {
    const user = await requireUser();

    const count = await prisma.emailResponse.count({
      where: { userId: user.id, matched: false },
    });

    return { count };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to count unmatched emails" };
  }
}

export async function getUnreadEmailCount() {
  try {
    const user = await requireUser();

    const count = await prisma.emailResponse.count({
      where: { userId: user.id, read: false },
    });

    return { count };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to count unread emails" };
  }
}

export async function sendUserEmail(data: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}) {
  try {
    const user = await requireUser();
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { error: "RESEND_API_KEY not configured" };

    const fromEmail = user.jfEmail || "jf@taras.cloud";
    const fromName = user.name || "JobFinder";

    const payload: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: [data.to],
      subject: data.subject,
      text: data.body,
    };

    if (data.inReplyTo) {
      payload.headers = { "In-Reply-To": data.inReplyTo, References: data.inReplyTo };
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error("[sendUserEmail] Resend error:", resp.status, err);
      return { error: `Send failed: ${(err as Record<string,string>).message || resp.status}` };
    }

    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send email" };
  }
}

export async function deleteUserEmail(id: number) {
  try {
    const user = await requireUser();

    // Verify the email belongs to this user before deleting
    const email = await prisma.emailResponse.findFirst({
      where: { id, userId: user.id },
    });
    if (!email) return { error: "Email not found" };

    await prisma.emailResponse.delete({
      where: { id },
    });

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete email" };
  }
}

export async function markEmailAsRead(emailId: number) {
  try {
    const user = await requireUser();

    // Verify the email belongs to this user before updating
    const email = await prisma.emailResponse.findFirst({
      where: { id: emailId, userId: user.id },
    });
    if (!email) return { error: "Email not found" };

    await prisma.emailResponse.update({
      where: { id: emailId },
      data: { read: true },
    });

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to mark email as read" };
  }
}
