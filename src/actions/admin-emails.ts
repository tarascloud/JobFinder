"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") throw new Error("Forbidden: owner access required");
  return user;
}

export async function getAdminEmails(filters?: {
  category?: string;
  unreadOnly?: boolean;
}) {
  await requireOwner();

  const where: Record<string, unknown> = {};
  if (filters?.category && filters.category !== "all") {
    where.category = filters.category;
  }
  if (filters?.unreadOnly) {
    where.read = false;
  }

  const emails = await prisma.adminEmail.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return { emails };
}

export async function markAdminEmailAsRead(id: number) {
  await requireOwner();

  await prisma.adminEmail.update({
    where: { id },
    data: { read: true },
  });

  return { ok: true };
}

export async function getAdminEmailUnreadCount() {
  await requireOwner();

  const count = await prisma.adminEmail.count({
    where: { read: false },
  });

  return { count };
}

export async function deleteAdminEmail(id: number) {
  await requireOwner();

  await prisma.adminEmail.delete({
    where: { id },
  });

  return { ok: true };
}

export async function sendEmail(data: {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
}) {
  const user = await requireOwner();

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { error: "RESEND_API_KEY not configured" };

    const fromEmail = "jf@taras.cloud";
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
      console.error("[sendEmail] Resend error:", resp.status, err);
      return { error: `Send failed: ${(err as Record<string,string>).message || resp.status}` };
    }

    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send email" };
  }
}
