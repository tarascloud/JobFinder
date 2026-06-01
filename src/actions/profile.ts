"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { readFile } from "fs/promises";
import path from "path";
import {
  safeExternalFetch,
  parseLocalResumeUrl,
  SafeFetchError,
} from "@/lib/safe-fetch";

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
  resumeFilename?: string | null;
  salaryMin?: number | null;
  salaryCurrency?: string | null;
  preferredLocations?: string[];
  preferredRemoteType?: string | null;
  employmentTypes?: string[];
  // LinkedIn Easy Apply fields
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  location?: string | null;
  education?: string | null;
  educationField?: string | null;
  educationSchool?: string | null;
  educationHistory?: string | null;
  currentCompany?: string | null;
  currentTitle?: string | null;
  experience?: string | null;
  certifications?: string | null;
  noticePeriod?: string | null;
  visaRequired?: boolean;
  workAuthorization?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
}

export async function updateProfile(data: UpdateProfileData) {
  try {
    const user = await requireUser();

    const profilePayload = {
        headline: data.headline,
        summary: data.summary,
        yearsExperience: data.yearsExperience,
        skills: data.skills ?? [],
        languages: data.languages ?? [],
        portfolioUrls: data.portfolioUrls ?? [],
        resumeUrl: data.resumeUrl,
        resumeFilename: data.resumeFilename,
        salaryMin: data.salaryMin,
        salaryCurrency: data.salaryCurrency,
        preferredLocations: data.preferredLocations ?? [],
        preferredRemoteType: data.preferredRemoteType,
        employmentTypes: data.employmentTypes ?? [],
        // LinkedIn Easy Apply fields
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        location: data.location,
        education: data.education,
        educationField: data.educationField,
        educationSchool: data.educationSchool,
        educationHistory: data.educationHistory,
        currentCompany: data.currentCompany,
        currentTitle: data.currentTitle,
        experience: data.experience,
        certifications: data.certifications,
        noticePeriod: data.noticePeriod,
        visaRequired: data.visaRequired ?? false,
        workAuthorization: data.workAuthorization,
        linkedinUrl: data.linkedinUrl,
        githubUrl: data.githubUrl,
        portfolioUrl: data.portfolioUrl,
    };

    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...profilePayload,
      },
      update: profilePayload,
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
  category?: string;
}

// QA_CATEGORIES moved to @/lib/qa-categories.ts (can't export non-async from "use server")

export interface ExperienceEntry {
  company: string;
  title: string;
  dateFrom: string;
  dateTo: string;
  description: string;
}

export interface EducationEntry {
  degree: string;
  field: string;
  school: string;
  dateFrom: string;
  dateTo: string;
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
  // Extended fields for auto-apply
  firstName?: string;
  lastName?: string;
  phone?: string;
  location?: string;
  currentTitle?: string;
  currentCompany?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  certifications?: string;
  experience?: ExperienceEntry[];
  educationHistory?: EducationEntry[];
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
    // Fetch resume content (supports PDF, HTML, LinkedIn, local uploads).
    // SSRF hardening (ARC-20260601-0002): for /-prefixed URLs we read the
    // file from disk via parseLocalResumeUrl() — never coerce to
    // http://localhost. For remote URLs we go through safeExternalFetch()
    // which enforces scheme + host allowlist + private-IP blocklist +
    // 5 MB body cap.
    let resumeText = "";
    const isLinkedIn = isLinkedInUrl(resumeUrl);
    const localFilename = parseLocalResumeUrl(resumeUrl);

    try {
      if (resumeUrl.startsWith("/") && localFilename === null) {
        // Looks local but failed the strict resume-path regex
        // (path traversal, %2F, weird chars). Reject upfront.
        console.warn("[analyzeResume] Rejected local URL outside /api/resumes/:", resumeUrl);
        return { error: "Resume URL is not allowed" };
      }

      if (localFilename !== null) {
        // Read uploaded file directly from disk — no HTTP needed
        const dataDir = process.env.DATA_DIR || "/app/data";
        const filePath = path.join(dataDir, "resumes", localFilename);
        // Also check legacy public/resumes/ path
        const legacyPath = path.join(process.cwd(), "public", "resumes", localFilename);

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

        // Extract text from PDF using pdf-parse, or fallback to raw ASCII
        if (localFilename.endsWith(".pdf")) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const pdfParse = require("pdf-parse");
            const pdfData = await pdfParse(buffer);
            resumeText = pdfData.text.replace(/\s+/g, " ").trim();
            console.log("[analyzeResume] PDF parsed, text length:", resumeText.length);
          } catch (e) {
            console.warn("[analyzeResume] pdf-parse failed, using raw extract:", e);
            resumeText = buffer.toString("utf-8")
              .replace(/[^\x20-\x7E\n\r\t]/g, " ")
              .replace(/\s+/g, " ")
              .trim();
          }
        } else {
          // Non-PDF (HTML etc)
          resumeText = buffer.toString("utf-8");
          resumeText = stripHtmlToText(resumeText);
        }
        console.log("[analyzeResume] Local file text length:", resumeText.length);
      } else {
        // Remote URL — fetch via safeExternalFetch (SSRF-hardened).
        console.log("[analyzeResume] Fetching URL:", resumeUrl, "isLinkedIn:", isLinkedIn);

        let response;
        try {
          response = await safeExternalFetch(resumeUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; JobFinder/1.0)",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            timeoutMs: 15000,
            maxBytes: 5_000_000,
          });
        } catch (e) {
          if (e instanceof SafeFetchError) {
            console.warn("[analyzeResume] safe-fetch rejected URL:", e.code, e.message);
            // Return a generic message — don't leak which check failed.
            return { error: "Resume URL is not allowed or unreachable" };
          }
          throw e;
        }

        if (!response.ok) {
          console.error("[analyzeResume] Fetch failed:", response.status, response.statusText);
          return { error: `Failed to fetch resume: ${response.status}` };
        }

        const contentType = response.contentType;
        console.log("[analyzeResume] Content-Type:", contentType);

        if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
          const html = response.text;
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
          resumeText = response.text;
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

    // Split into 3 smaller AI calls for speed (large model is slow on large prompts)
    const { callAIJSON } = await import("@/lib/ai/provider");
    const { isLikelyPromptInjection, sanitizeUserInput, wrapUserContent } = await import("@/lib/prompt-guard");

    // Guard: reject resumes that look like prompt-injection attempts (e.g. PDF with
    // hidden "ignore previous instructions" payload). REV-R2-20260419-0027.
    if (isLikelyPromptInjection(resumeText)) {
      console.warn("[analyzeResume] Prompt injection detected in resume text for user", userId);
      return { error: "Resume content contains suspicious instructions. Please review your PDF/URL." };
    }

    const resumeSanitized = sanitizeUserInput(resumeText, 4000);
    void resumeSanitized.substring(0, 2000); // shorter snippet reserved for search/QA calls
    const resumeFullSnippet = wrapUserContent(resumeSanitized.substring(0, 3500)); // longer for profile/skills extraction

    // Step 1: Profile extraction (~10-30 sec)
    console.log("[analyzeResume] Step 1: Extracting profile...");
    let profile: AnalyzedProfile;
    try {
      profile = await callAIJSON<AnalyzedProfile>(
        `Extract a professional profile from this resume. Return ONLY valid JSON.

RESUME TEXT:
${resumeFullSnippet}

CRITICAL: The "skills" array MUST contain EVERY technology, tool, framework, methodology, certification, and competency mentioned in the resume. Copy them exactly as written. I expect 40-80 items. Do NOT summarize or generalize — list each one individually.

CRITICAL: The "languages" array MUST contain ALL spoken/written languages mentioned anywhere in the resume with proficiency levels. Extract EVERY language the person knows. Format each as "Language (Level)" where Level is one of: Native, Fluent, Professional, Conversational, Basic. If the resume does not specify a level, infer it from context (e.g. resume written in English = at least Professional). Do NOT skip any language.

Return JSON with this structure:
{
  "headline": "exact job title from resume",
  "summary": "2-3 sentences about key strengths",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+34 612 345 678",
  "location": "Madrid, Spain",
  "currentTitle": "Senior Software Engineer",
  "currentCompany": "Acme Corp",
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "githubUrl": "https://github.com/johndoe",
  "portfolioUrl": "https://johndoe.dev",
  "certifications": "AWS Solutions Architect, PMP, Kubernetes CKA",
  "yearsExperience": 20,
  "skills": ["Communication", "Leadership", "Strategic Management", "Agile", "Scrum", "PCI DSS", "GDPR", "Azure", "AWS", "Kubernetes", "Terraform", "Docker", "Python", "SQL", "Bash", "Golang", ".NET", "Java", "Prometheus", "Grafana", "PostgreSQL", "MongoDB", "Redis", "Kafka", "...EVERY skill from resume"],
  "languages": ["English (Professional)", "Ukrainian (Native)", "Spanish (Professional)", "...EVERY language from resume with level"],
  "portfolioUrls": [],
  "salaryMin": 150000,
  "salaryCurrency": "EUR",
  "preferredLocations": ["Remote", "EU", "Spain"],
  "preferredRemoteType": "remote",
  "employmentTypes": ["full-time", "contract"],
  "experience": [{"company":"Acme Corp","title":"Senior Engineer","dateFrom":"2020-01","dateTo":"present","description":"Led team of 5..."}],
  "educationHistory": [{"degree":"Master's","field":"Computer Science","school":"MIT","dateFrom":"2010","dateTo":"2012"}]
}

CRITICAL: Extract firstName, lastName, phone, location, currentTitle, currentCompany from the resume. Extract ALL work experience entries and ALL education entries. If a field is not found, omit it or use null.`,
        { userId }
      );
      // Ensure arrays are never null (AI may return null instead of [])
      profile.skills = profile.skills || [];
      profile.languages = profile.languages || [];
      profile.portfolioUrls = profile.portfolioUrls || [];
      profile.preferredLocations = profile.preferredLocations || [];
      profile.employmentTypes = profile.employmentTypes || [];
      console.log("[analyzeResume] Profile extracted:", profile?.headline, "skills:", profile.skills.length, "langs:", profile.languages.length);
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

Profile: ${profile.headline}, ${profile.yearsExperience} years, skills: ${(profile.skills || []).slice(0, 25).join(", ")}

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

    // Brief pause to avoid Gemini rate limiting between calls
    await new Promise((r) => setTimeout(r, 2000));

    // Step 3: Q&A pairs (~5-15 sec) — LinkedIn Easy Apply screening questions only
    console.log("[analyzeResume] Step 3: Building LinkedIn Easy Apply Q&A...");
    let qaPairs: AnalyzedQaPair[];
    try {
      const topSkills = profile.skills.slice(0, 10).join(", ");
      const qaResult = await callAIJSON<{ qaPairs: AnalyzedQaPair[] }>(
        `Generate 12-15 LinkedIn Easy Apply screening question answers for this candidate. These are the SHORT form fields that appear when applying on LinkedIn.

Candidate: ${profile.headline}, ${profile.yearsExperience} years. Skills: ${topSkills}. Location: ${(profile.preferredLocations || []).join(", ") || "Remote"}. Salary: ${profile.salaryMin ? profile.salaryMin + " " + profile.salaryCurrency : "negotiable"}. Languages: ${(profile.languages || []).join(", ") || "English"}

Return ONLY JSON: {"qaPairs":[
  {"question":"How many years of experience do you have with Kubernetes?","answer":"8","category":"linkedin_apply"},
  {"question":"What is your expected base salary (annual, EUR)?","answer":"150000","category":"linkedin_apply"},
  {"question":"Are you authorized to work in the EU?","answer":"Yes","category":"linkedin_apply"}
]}

RULES:
- Questions must match EXACTLY what LinkedIn Easy Apply forms ask
- Answers must be SHORT (1 word or 1 number) — these are form fields, not essays
- Generate "How many years of experience do you have with [skill]?" for EACH of these skills: ${topSkills}
- Also include: expected salary, work authorization, visa sponsorship, education level, total work experience, management experience, relocation willingness, language proficiency, remote work comfort
- Category always "linkedin_apply"`,
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
