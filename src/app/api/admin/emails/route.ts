import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

function verifyToken(request: NextRequest): boolean {
  const secret = process.env.JF_INBOX_TOKEN;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (!auth) return false;
  const expected = `Bearer ${secret}`;
  if (Buffer.byteLength(auth) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}

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
  if (!verifyToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { from, to, subject, body, bodyText, bodyHtml, rawBody, messageId } = data as {
      from: string;
      to: string;
      subject: string;
      body: string;
      bodyText?: string;
      bodyHtml?: string;
      rawBody?: string;
      messageId?: string;
    };

    if (!from || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: from, subject" },
        { status: 400 }
      );
    }

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
