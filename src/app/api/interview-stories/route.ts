import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { checkIpRateLimit } from "@/lib/rate-limiter";

const CreateStorySchema = z.object({
  theme: z.string().min(1).max(100),
  situation: z.string().min(1),
  task: z.string().min(1),
  action: z.string().min(1),
  result: z.string().min(1),
  reflection: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const user = authResult.user;

    const stories = await prisma.interviewStory.findMany({
      where: { userId: user.id },
      orderBy: [{ usedCount: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ stories });
  } catch (e) {
    console.error("[interview-stories] GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch interview stories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // IP-based rate limit: 10 requests per minute
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rl = checkIpRateLimit(ip, "interview-stories:POST", 10);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: rl.retryAfter },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      );
    }

    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const user = authResult.user;

    const body = await request.json();
    const parsed = CreateStorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const story = await prisma.interviewStory.create({
      data: {
        userId: user.id,
        theme: parsed.data.theme,
        situation: parsed.data.situation,
        task: parsed.data.task,
        action: parsed.data.action,
        result: parsed.data.result,
        reflection: parsed.data.reflection,
        tags: parsed.data.tags,
      },
    });

    return NextResponse.json({ story }, { status: 201 });
  } catch (e) {
    console.error("[interview-stories] POST error:", e);
    return NextResponse.json(
      { error: "Failed to create interview story" },
      { status: 500 }
    );
  }
}
