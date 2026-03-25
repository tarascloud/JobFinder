"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { readFile } from "fs/promises";
import path from "path";

export async function getProfile() {
  try {
    const user = await requireUser();
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    return profile;
  } catch {
    return null;
  }
}

export async function getAnalysisStatus(): Promise<{
  status: string;
  result: ComprehensiveAnalysisResult | null;
  error: string | null;
}> {
  try {
    const user = await requireUser();
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { analysisStatus: true, analysisResult: true },
    });

    if (!profile) {
      return { status: "idle", result: null, error: null };
    }

    if (profile.analysisStatus === "error" && profile.analysisResult) {
      const parsed = JSON.parse(profile.analysisResult);
      return { status: "error", result: null, error: parsed.error || "Analysis failed" };
    }

    if (profile.analysisStatus === "done" && profile.analysisResult) {
      return {
        status: "done",
        result: JSON.parse(profile.analysisResult) as ComprehensiveAnalysisResult,
        error: null,
      };
    }

    return { status: profile.analysisStatus, result: null, error: null };
  } catch {
    return { status: "idle", result: null, error: null };
  }
}

export async function clearAnalysisStatus() {
  try {
    const user = await requireUser();
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { analysisStatus: "idle", analysisResult: null },
    });
  } catch {
    // ignore
  }
}

interface UpdateProfileData {
  headline?: string | null;
  summary?: string | null;
  yearsExperience?: number | null;
  skills?: string[];
  languages?: string[];
  portfolioUrls?: string[];
  resumeUrl?: string | null;
  salaryMin?: number | null;
  salaryCurrency?: string | null;
  preferredLocations?: string[];
  preferredRemoteType?: string | null;
  employmentTypes?: string[];
}

export async function updateProfile(data: UpdateProfileData) {
  try {
    const user = await requireUser();

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        headline: data.headline,
        summary: data.summary,
        yearsExperience: data.yearsExperience,
        skills: data.skills ?? [],
        languages: data.languages ?? [],
        portfolioUrls: data.portfolioUrls ?? [],
        resumeUrl: data.resumeUrl,
        salaryMin: data.salaryMin,
        salaryCurrency: data.salaryCurrency,
        preferredLocations: data.preferredLocations ?? [],
        preferredRemoteType: data.preferredRemoteType,
        employmentTypes: data.employmentTypes ?? [],
      },
      update: {
        headline: data.headline,
        summary: data.summary,
        yearsExperience: data.yearsExperience,
        skills: data.skills ?? [],
        languages: data.languages ?? [],
        portfolioUrls: data.portfolioUrls ?? [],
        resumeUrl: data.resumeUrl,
        salaryMin: data.salaryMin,
        salaryCurrency: data.salaryCurrency,
        preferredLocations: data.preferredLocations ?? [],
        preferredRemoteType: data.preferredRemoteType,
        employmentTypes: data.employmentTypes ?? [],
      },
    });

    return profile;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update profile" };
  }
}

export interface AnalyzedSearchProfile {
  name: string;
  jobTitles: string[];
  minSalary: number | null;
  currency: string;
  geographies: string[];
  remoteOnly: boolean;
  employmentTypes: string[];
}

export interface AnalyzedQaPair {
  question: string;
  answer: string;
}

export interface AnalyzedProfile {
  headline: string;
  summary: string;
  yearsExperience: number | null;
  skills: string[];
  languages: string[];
  portfolioUrls: string[];
  salaryMin: number | null;
  salaryCurrency: string;
  preferredLocations: string[];
  preferredRemoteType: string;
  employmentTypes: string[];
}

export interface ComprehensiveAnalysisResult {
  profile: AnalyzedProfile;
  searchProfiles: AnalyzedSearchProfile[];
  qaPairs: AnalyzedQaPair[];
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#160;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLinkedInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "www.linkedin.com" || parsed.hostname === "linkedin.com";
  } catch {
    return false;
  }
}

export async function analyzeResume(
  resumeUrl: string
): Promise<ComprehensiveAnalysisResult | { error: string }> {
  try {
    const user = await requireUser();
    return analyzeResumeForUser(resumeUrl, user.id);
  } catch (e) {
    console.error("[analyzeResume] Error:", e);
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return { error: `Analysis failed: ${msg}` };
  }
}

/**
 * Core analysis logic that accepts userId directly.
 * Can be called from background tasks where request context is unavailable.
 */
export async function analyzeResumeForUser(
  resumeUrl: string,
  userId: number
): Promise<ComprehensiveAnalysisResult | { error: string }> {
  try {
    // Fetch resume content (supports PDF, HTML, LinkedIn, local uploads)
    let resumeText = "";
    const isLinkedIn = isLinkedInUrl(resumeUrl);
    const isLocalUpload =
      resumeUrl.startsWith("/api/resumes/") || resumeUrl.startsWith("/resumes/");

    try {
      if (isLocalUpload) {
        // Read uploaded file directly from disk — no HTTP needed
        // Supports both old /resumes/ URLs and new /api/resumes/ URLs
        const filename = resumeUrl.split("/").pop() || "";
        const dataDir = process.env.DATA_DIR || "/app/data";
        const filePath = path.join(dataDir, "resumes", filename);
        // Also check legacy public/resumes/ path
        const legacyPath = path.join(process.cwd(), "public", "resumes", filename);

        let buffer: Buffer | null = null;
        try {
          buffer = await readFile(filePath);
          console.log("[analyzeResume] Read file from data dir:", filePath);
        } catch {
          try {
            buffer = await readFile(legacyPath);
            console.log("[analyzeResume] Read file from legacy path:", legacyPath);
          } catch {
            console.error("[analyzeResume] File not found at", filePath, "or", legacyPath);
            return { error: "Uploaded resume file not found on disk" };
          }
        }

        // For PDF: extract raw text (binary PDF has some readable text)
        // Convert to string and strip binary artifacts
        const raw = buffer.toString("utf-8");
        // Extract text between PDF stream markers or just get readable ASCII
        resumeText = raw
          .replace(/[^\x20-\x7E\n\r\t]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        console.log("[analyzeResume] Local file text length:", resumeText.length);
      } else {
        // Remote URL — fetch via HTTP
        const fullUrl = resumeUrl.startsWith("/")
          ? `http://localhost:${process.env.PORT ?? "3456"}${resumeUrl}`
          : resumeUrl;

        console.log("[analyzeResume] Fetching URL:", fullUrl, "isLinkedIn:", isLinkedIn);

        const response = await fetch(fullUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; JobFinder/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          console.error("[analyzeResume] Fetch failed:", response.status, response.statusText);
          return { error: `Failed to fetch resume: ${response.status}` };
        }

        const contentType = response.headers.get("content-type") || "";
        console.log("[analyzeResume] Content-Type:", contentType);

        if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
          const html = await response.text();
          resumeText = stripHtmlToText(html);

          if (isLinkedIn) {
            // LinkedIn public profiles have limited data without login
            const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
            const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
            if (metaDesc || ogTitle) {
              const extra = [ogTitle?.[1], metaDesc?.[1]].filter(Boolean).join(". ");
              resumeText = extra + " " + resumeText;
            }
            console.log("[analyzeResume] LinkedIn text length:", resumeText.length);
          }
        } else {
          resumeText = await response.text();
        }

        console.log("[analyzeResume] Resume text length:", resumeText.length);
      }

      if (resumeText.length < 50) {
        return {
          error: isLinkedIn
            ? "LinkedIn profile returned too little public data. Try exporting your profile as PDF and uploading it instead."
            : "Resume content too short. Please check the URL.",
        };
      }

      // Truncate to 4000 chars for Ollama compatibility (limited context window)
      // Gemini/Groq can handle more but we keep it safe for the fallback chain
      resumeText = resumeText.substring(0, 4000);
    } catch (e) {
      console.error("[analyzeResume] Fetch error:", e);
      return { error: "Failed to download resume from the provided URL" };
    }

    // Split into 3 smaller AI calls for speed (14B model is slow on large prompts)
    const { callAIJSON } = await import("@/lib/ai/provider");
    const resumeSnippet = resumeText.substring(0, 2000); // shorter for each call

    // Step 1: Profile extraction (~10-30 sec)
    console.log("[analyzeResume] Step 1: Extracting profile...");
    let profile: AnalyzedProfile;
    try {
      profile = await callAIJSON<AnalyzedProfile>(
        `Analyze this resume and extract a professional profile. Return ONLY valid JSON, no markdown.

RESUME: ${resumeSnippet}

Return JSON: {"headline":"job title","summary":"2-3 sentences","yearsExperience":20,"skills":["skill1","skill2"],"languages":["English (Professional)","Ukrainian (Native)"],"portfolioUrls":[],"salaryMin":150000,"salaryCurrency":"EUR","preferredLocations":["Remote","EU"],"preferredRemoteType":"remote","employmentTypes":["full-time","contract"]}`,
        { userId }
      );
      console.log("[analyzeResume] Profile extracted:", profile?.headline);
    } catch (e) {
      console.error("[analyzeResume] Profile extraction failed:", e);
      profile = {
        headline: "Professional",
        summary: "Experienced professional. Edit your profile manually.",
        yearsExperience: null, skills: [], languages: ["English (Professional)"],
        portfolioUrls: [], salaryMin: null, salaryCurrency: "EUR",
        preferredLocations: ["Remote"], preferredRemoteType: "remote",
        employmentTypes: ["full-time"],
      };
    }

    // Step 2: Search profiles (~10-30 sec)
    console.log("[analyzeResume] Step 2: Generating search profiles...");
    let searchProfiles: AnalyzedSearchProfile[];
    try {
      const searchResult = await callAIJSON<{ searchProfiles: AnalyzedSearchProfile[] }>(
        `Based on this profile, suggest 2-3 job search strategies for different markets. Return ONLY valid JSON, no markdown.

Profile: ${profile.headline}, ${profile.yearsExperience} years, skills: ${profile.skills.slice(0, 10).join(", ")}

Return JSON: {"searchProfiles":[{"name":"EU Remote","jobTitles":["title1","title2"],"minSalary":150000,"currency":"EUR","geographies":["EU"],"remoteOnly":true,"employmentTypes":["full-time"]}]}`,
        { userId }
      );
      searchProfiles = searchResult?.searchProfiles || [];
      console.log("[analyzeResume] Searches generated:", searchProfiles.length);
    } catch (e) {
      console.error("[analyzeResume] Search generation failed:", e);
      searchProfiles = [{
        name: "My Job Search", jobTitles: [profile.headline || "Engineer"],
        minSalary: profile.salaryMin, currency: profile.salaryCurrency || "EUR",
        geographies: profile.preferredLocations, remoteOnly: true,
        employmentTypes: profile.employmentTypes,
      }];
    }

    // Step 3: Q&A pairs (~10-30 sec)
    console.log("[analyzeResume] Step 3: Building Q&A pairs...");
    let qaPairs: AnalyzedQaPair[];
    try {
      const qaResult = await callAIJSON<{ qaPairs: AnalyzedQaPair[] }>(
        `Generate 10 interview Q&A pairs for this candidate. Each answer 2-3 sentences, personalized. Return ONLY valid JSON, no markdown.

Candidate: ${profile.headline}, ${profile.yearsExperience} years. Skills: ${profile.skills.slice(0, 8).join(", ")}. Summary: ${profile.summary}

Return JSON: {"qaPairs":[{"question":"Tell me about yourself","answer":"personalized answer..."}]}`,
        { userId }
      );
      qaPairs = qaResult?.qaPairs || [];
      console.log("[analyzeResume] Q&A generated:", qaPairs.length);
    } catch (e) {
      console.error("[analyzeResume] Q&A generation failed:", e);
      qaPairs = [];
    }

    return { profile, searchProfiles, qaPairs };
  } catch (e) {
    console.error("[analyzeResume] Error:", e);
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return { error: `Analysis failed: ${msg}` };
  }
}
