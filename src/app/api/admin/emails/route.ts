import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyApiToken } from "@/lib/api-auth";
import { z } from "zod";

const InboxEmailSchema = z.object({
  from: z.string().min(1).max(500),
  to: z.string().max(500).optional(),
  subject: z.string().min(1).max(1000),
  body: z.string().max(10000).optional(),
  bodyText: z.string().max(10000).optional(),
  bodyHtml: z.string().max(50000).optional(),
  rawBody: z.string().max(100000).optional(),
  messageId: z.string().max(500).optional(),
});

/**
 * Detect platform from sender email domain.
 */
function detectPlatform(fromEmail: string): string | null {
  const email = fromEmail.toLowerCase();
  const platformMap: Record<string, string> = {
    "linkedin.com": "linkedin",
    "indeed.com": "indeed",
    "glassdoor.com": "glassdoor",
    "monster.com": "monster",
    "ziprecruiter.com": "ziprecruiter",
    "wellfound.com": "wellfound",
    "angellist.com": "wellfound",
    "dice.com": "dice",
    "stackoverflow.com": "stackoverflow",
    "hired.com": "hired",
    "weworkremotely.com": "weworkremotely",
    "remoteok.com": "remoteok",
    "infojobs.net": "infojobs",
    "xing.com": "xing",
    "stepstone.com": "stepstone",
    "reed.co.uk": "reed",
    "totaljobs.com": "totaljobs",
    "seek.com": "seek",
    "naukri.com": "naukri",
    "hh.ru": "headhunter",
    "workday.com": "workday",
    "greenhouse.io": "greenhouse",
    "lever.co": "lever",
    "ashbyhq.com": "ashby",
    "smartrecruiters.com": "smartrecruiters",
    "icims.com": "icims",
    "jobvite.com": "jobvite",
    "breezy.hr": "breezy",
    "recruitee.com": "recruitee",
    "teamtailor.com": "teamtailor",
  };

  for (const [domain, platform] of Object.entries(platformMap)) {
    if (email.includes(domain)) return platform;
  }
  return null;
}

/**
 * Detect email category from subject line.
 */
function detectCategory(subject: string, body: string): string {
  const text = (subject + " " + body).toLowerCase();

  const registrationKeywords = [
    "verify your email",
    "confirm your email",
    "welcome to",
    "account created",
    "registration",
    "sign up",
    "activate your account",
    "email verification",
  ];

  const confirmationKeywords = [
    "application received",
    "application confirmed",
    "successfully applied",
    "your application",
    "thank you for applying",
    "we received your",
    "confirmation",
  ];

  const notificationKeywords = [
    "new job",
    "job alert",
    "new match",
    "recommended for you",
    "you appeared in",
    "profile view",
    "someone viewed",
    "new message",
    "unread message",
  ];

  if (registrationKeywords.some((k) => text.includes(k))) return "registration";
  if (confirmationKeywords.some((k) => text.includes(k))) return "confirmation";
  if (notificationKeywords.some((k) => text.includes(k))) return "notification";
  return "other";
}

export async function POST(request: NextRequest) {
  if (!verifyApiToken(request, "JOBFINDER_EMAIL_API_TOKEN", "JF_INBOX_TOKEN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const parsed = InboxEmailSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { from, to, subject, body, bodyText, bodyHtml, messageId } = parsed.data;

    const platform = detectPlatform(from);
    // Use parsed text for category detection when available
    const textForDetection = bodyText || body || "";
    const category = detectCategory(subject, textForDetection);

    const email = await prisma.adminEmail.create({
      data: {
        fromEmail: from,
        toEmail: to || "jf@taras.cloud",
        subject,
        body: (body || "").substring(0, 10000),
        bodyText: bodyText ? bodyText.substring(0, 10000) : null,
        bodyHtml: bodyHtml ? bodyHtml.substring(0, 50000) : null,
        messageId: messageId || null,
        platform,
        category,
      },
    });

    return NextResponse.json({
      id: email.id,
      platform,
      category,
    });
  } catch (error) {
    console.error("[admin/emails] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
