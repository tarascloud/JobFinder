import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { analyzeResumeForUser } from "@/actions/profile";
import { checkRateLimitAsync } from "@/lib/rate-limiter";
import {
  isHostAllowed,
  parseLocalResumeUrl,
} from "@/lib/safe-fetch";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const user = authResult.user;

    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { analysisStatus: true, analysisResult: true },
    });

    if (!profile) {
      return NextResponse.json({ status: "idle", result: null });
    }

    return NextResponse.json({
      status: profile.analysisStatus,
      result: profile.analysisResult
        ? JSON.parse(profile.analysisResult)
        : null,
    });
  } catch (e) {
    console.error("Get analysis status error:", e);
    return NextResponse.json(
      { error: "Failed to get analysis status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const user = authResult.user;

    // Rate limit: max 5 resume analyses per hour per user
    const rateCheck = await checkRateLimitAsync(user.id, "analyze-resume", 5);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: rateCheck.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfter) },
        }
      );
    }

    const body = await request.json();
    const { resumeUrl } = body;

    if (!resumeUrl || typeof resumeUrl !== "string") {
      return NextResponse.json(
        { error: "resumeUrl is required" },
        { status: 400 }
      );
    }

    // SSRF pre-check (ARC-20260601-0002): reject obviously-bad URLs
    // before scheduling background work. The action layer
    // (safeExternalFetch) does the full DNS + IP check; here we just
    // do shape validation so we don't write "analyzing" status for a
    // request that's guaranteed to fail.
    if (resumeUrl.startsWith("/")) {
      if (parseLocalResumeUrl(resumeUrl) === null) {
        return NextResponse.json(
          { error: "Resume URL is not allowed" },
          { status: 400 }
        );
      }
    } else {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(resumeUrl);
      } catch {
        return NextResponse.json(
          { error: "Invalid resumeUrl" },
          { status: 400 }
        );
      }
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return NextResponse.json(
          { error: "URL scheme is not allowed" },
          { status: 400 }
        );
      }
      if (!isHostAllowed(parsedUrl.hostname)) {
        return NextResponse.json(
          { error: "URL host is not allowed" },
          { status: 400 }
        );
      }
    }

    // Ensure profile exists and set status to analyzing
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        resumeUrl,
        analysisStatus: "analyzing",
        analysisResult: null,
      },
      update: {
        resumeUrl,
        analysisStatus: "analyzing",
        analysisResult: null,
      },
    });

    // Fire-and-forget: run analysis in background
    runAnalysisInBackground(user.id, resumeUrl).catch((e) => {
      console.error("[analyze-resume] Background analysis error:", e);
    });

    return NextResponse.json({ status: "analyzing" });
  } catch (e) {
    console.error("Start analysis error:", e);
    return NextResponse.json(
      { error: "Failed to start analysis" },
      { status: 500 }
    );
  }
}

async function runAnalysisInBackground(
  userId: number,
  resumeUrl: string
): Promise<void> {
  try {
    console.log(
      "[analyze-resume] Starting background analysis for user",
      userId
    );
    const result = await analyzeResumeForUser(resumeUrl, userId);

    if ("error" in result) {
      await prisma.userProfile.update({
        where: { userId },
        data: {
          analysisStatus: "error",
          analysisResult: JSON.stringify({ error: result.error }),
        },
      });
      console.error("[analyze-resume] Analysis returned error:", result.error);
      return;
    }

    await prisma.userProfile.update({
      where: { userId },
      data: {
        analysisStatus: "done",
        analysisResult: JSON.stringify(result),
      },
    });

    // Auto-create search profiles from analysis (skip duplicates by name)
    if (result.searchProfiles?.length) {
      const existing = await prisma.searchProfile.findMany({
        where: { userId },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((e) => e.name));

      for (const sp of result.searchProfiles) {
        if (existingNames.has(sp.name)) continue;
        await prisma.searchProfile.create({
          data: {
            userId,
            name: sp.name,
            jobTitles: sp.jobTitles || [],
            minSalary: sp.minSalary ?? null,
            currency: sp.currency || "EUR",
            geographies: sp.geographies || [],
            remoteOnly: sp.remoteOnly ?? true,
            employmentTypes: sp.employmentTypes || ["full-time"],
            source: "ai",
          },
        });
      }
      console.log(
        "[analyze-resume] Auto-created",
        result.searchProfiles.length,
        "search profiles for user",
        userId
      );
    }

    // Auto-create Q&A pairs from analysis (skip duplicates by question)
    if (result.qaPairs?.length) {
      const existingQa = await prisma.qaPair.findMany({
        where: { userId },
        select: { question: true },
      });
      const existingQuestions = new Set(existingQa.map((e) => e.question));

      for (const qa of result.qaPairs) {
        if (existingQuestions.has(qa.question)) continue;
        await prisma.qaPair.create({
          data: {
            userId,
            question: qa.question,
            answer: qa.answer,
            category: qa.category || "linkedin_apply",
            answeredAt: new Date(),
            source: "ai",
          },
        });
      }
      console.log(
        "[analyze-resume] Auto-created",
        result.qaPairs.length,
        "Q&A pairs for user",
        userId
      );
    }

    console.log("[analyze-resume] Analysis complete for user", userId);
  } catch (e) {
    console.error("[analyze-resume] Background analysis failed:", e);
    await prisma.userProfile
      .update({
        where: { userId },
        data: {
          analysisStatus: "error",
          analysisResult: JSON.stringify({
            error: e instanceof Error ? e.message : "Analysis failed",
          }),
        },
      })
      .catch(() => {});
  }
}
