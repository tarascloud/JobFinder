import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/**
 * Send email via Resend API.
 * Called from admin/emails and user/emails UI for Reply/Forward.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { to, subject, body, inReplyTo, references } = data as {
      to: string;
      subject: string;
      body: string;
      inReplyTo?: string;
      references?: string;
    };

    if (!to || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    const fromEmail = user.jfEmail || "jf@taras.cloud";
    const fromName = user.name || "JobFinder";

    const payload: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      text: body,
    };

    if (inReplyTo || references) {
      const headers: Record<string, string> = {};
      if (inReplyTo) headers["In-Reply-To"] = inReplyTo;
      if (references) headers["References"] = references;
      payload.headers = headers;
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      console.error("[send-email] Resend error:", resp.status, errorData);
      return NextResponse.json(
        { error: `Send failed: ${(errorData as Record<string, string>).message || resp.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[send-email] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
