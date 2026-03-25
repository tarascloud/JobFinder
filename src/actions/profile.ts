"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

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

    // Fetch resume content (supports PDF, HTML, LinkedIn)
    let resumeText = "";
    const isLinkedIn = isLinkedInUrl(resumeUrl);

    try {
      const fullUrl = resumeUrl.startsWith("/")
        ? `${process.env.NEXTAUTH_URL ?? "http://localhost:3456"}${resumeUrl}`
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
          // Extract what we can from meta tags and visible text
          const metaDesc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
          const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
          if (metaDesc || ogTitle) {
            const extra = [ogTitle?.[1], metaDesc?.[1]].filter(Boolean).join(". ");
            resumeText = extra + " " + resumeText;
          }
          console.log("[analyzeResume] LinkedIn text length:", resumeText.length);
        }
      } else {
        // Try as text (could be PDF served as octet-stream)
        resumeText = await response.text();
      }

      console.log("[analyzeResume] Resume text length:", resumeText.length);

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

    // Use unified AI provider (Ollama → Gemini → Groq fallback chain)
    const { callAIJSON } = await import("@/lib/ai/provider");

    const sourceNote = isLinkedIn
      ? "Note: This is a LinkedIn public profile. Extract as much info as possible from the available text."
      : "";

    const prompt = `You are an expert career coach and recruiter. Analyze this resume/profile text and return a JSON object.
${sourceNote}

RESUME TEXT:
${resumeText}

Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:

{
  "profile": {
    "headline": "Professional headline/job title",
    "summary": "2-3 sentence professional summary highlighting key strengths",
    "yearsExperience": 20,
    "skills": ["Cloud Architecture", "Kubernetes", "Terraform", "...up to 20 most relevant skills"],
    "languages": ["English (Professional)", "Ukrainian (Native)", "Spanish (Basic)"],
    "portfolioUrls": ["https://..."],
    "salaryMin": 150000,
    "salaryCurrency": "EUR",
    "preferredLocations": ["Remote", "EU", "Spain"],
    "preferredRemoteType": "remote",
    "employmentTypes": ["full-time", "contract"]
  },
  "searchProfiles": [
    {
      "name": "EU Remote CTO/VP Engineering",
      "jobTitles": ["CTO", "VP Engineering", "Engineering Director"],
      "minSalary": 150000,
      "currency": "EUR",
      "geographies": ["EU", "UK"],
      "remoteOnly": true,
      "employmentTypes": ["full-time", "contract"]
    }
  ],
  "qaPairs": [
    {"question": "Tell me about yourself", "answer": "...personalized from resume..."},
    {"question": "What is your greatest achievement?", "answer": "...specific from resume..."}
  ]
}

GUIDELINES:
- searchProfiles: 2-3 targeting DIFFERENT markets with realistic salary
- qaPairs: 10-15 pairs covering behavioral, technical, salary negotiation
- Each answer: 2-4 sentences, personalized to THIS person's experience
- salaryMin: estimate based on experience + skills + market rates
- Return ONLY valid JSON, no markdown, no code fences, no extra text`;

    console.log("[analyzeResume] Calling AI provider...");
    const result = await callAIJSON<ComprehensiveAnalysisResult>(prompt, { userId: user.id });
    console.log("[analyzeResume] AI result received, profile headline:", result?.profile?.headline);
    return result;
  } catch (e) {
    console.error("[analyzeResume] Error:", e);
    const msg = e instanceof Error ? e.message : "Analysis failed";
    return { error: `Analysis failed: ${msg}` };
  }
}
