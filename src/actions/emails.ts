"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

interface EmailResponse {
  id: number;
  fromEmail: string;
  subject: string;
  body: string | null;
  responseType: string;
  matched: boolean;
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
    await requireUser();

    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;
    const offset = (page - 1) * limit;

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters?.matched !== undefined) {
      conditions.push(`e.matched = $${paramIdx++}`);
      params.push(filters.matched);
    }
    if (filters?.responseType) {
      conditions.push(`e.response_type = $${paramIdx++}`);
      params.push(filters.responseType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM email_responses e ${whereClause}`,
      ...params
    ) as { count: number }[];
    const total = countResult[0]?.count ?? 0;

    const emails = await prisma.$queryRawUnsafe(
      `SELECT e.id, e.from_email as "fromEmail", e.subject, e.body, e.response_type as "responseType",
              e.matched, e.application_id as "applicationId", e.received_at as "receivedAt",
              v.title as "vacancyTitle", v.company as "vacancyCompany"
       FROM email_responses e
       LEFT JOIN applications a ON a.id = e.application_id
       LEFT JOIN vacancies v ON v.id = a.vacancy_id
       ${whereClause}
       ORDER BY e.received_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      ...params,
      limit,
      offset
    ) as EmailResponse[];

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
    await requireUser();

    await prisma.$queryRawUnsafe(
      `UPDATE email_responses SET application_id = $1, matched = true WHERE id = $2`,
      applicationId,
      emailId
    );

    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to link email" };
  }
}

export async function getUnmatchedEmailCount() {
  try {
    await requireUser();

    const result = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM email_responses WHERE matched = false`
    ) as { count: number }[];

    return { count: result[0]?.count ?? 0 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to count unmatched emails" };
  }
}
