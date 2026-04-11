"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";
import { chromium } from "playwright";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExperienceEntry {
  company?: string;
  title?: string;
  dateFrom?: string;
  dateTo?: string;
  description?: string;
}

interface EducationEntry {
  degree?: string;
  field?: string;
  school?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface TailoredResumeData {
  tailoredSummary: string;
  reorderedSkills: string[];
  injectedKeywords: string[];
}

// ---------------------------------------------------------------------------
// ATS normalization helpers
// ---------------------------------------------------------------------------

function normalizeForAts(text: string): string {
  return text
    // em-dash and en-dash → hyphen
    .replace(/[\u2013\u2014]/g, "-")
    // smart quotes → plain
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // ellipsis → three dots
    .replace(/\u2026/g, "...")
    // bullet variants → dash
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, "-")
    // non-breaking space → regular space
    .replace(/\u00A0/g, " ")
    // trim extra whitespace
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeAll(value: string | null | undefined): string {
  if (!value) return "";
  return normalizeForAts(value);
}

// ---------------------------------------------------------------------------
// HTML template builder
// ---------------------------------------------------------------------------

function buildResumeHtml(params: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  summary: string;
  skills: string[];
  experience: ExperienceEntry[];
  educationHistory: EducationEntry[];
  certifications: string;
  languages: string[];
}): string {
  const {
    firstName,
    lastName,
    email,
    phone,
    location,
    linkedinUrl,
    githubUrl,
    summary,
    skills,
    experience,
    educationHistory,
    certifications,
    languages,
  } = params;

  const fullName = normalizeAll(`${firstName} ${lastName}`.trim()) || "Candidate";

  const contactParts: string[] = [];
  if (email) contactParts.push(normalizeAll(email));
  if (phone) contactParts.push(normalizeAll(phone));
  if (location) contactParts.push(normalizeAll(location));
  if (linkedinUrl) contactParts.push(normalizeAll(linkedinUrl));
  if (githubUrl) contactParts.push(normalizeAll(githubUrl));

  function section(title: string, content: string): string {
    if (!content.trim()) return "";
    return `
      <div class="section">
        <div class="section-title">${title}</div>
        ${content}
      </div>`;
  }

  // Summary
  const summaryHtml = summary
    ? section("Summary", `<p>${normalizeAll(summary)}</p>`)
    : "";

  // Skills
  const skillsHtml =
    skills.length > 0
      ? section(
          "Skills",
          `<p>${skills.map(normalizeAll).join(" - ")}</p>`
        )
      : "";

  // Experience
  const expRows = experience
    .map((e) => {
      const title = normalizeAll(e.title);
      const company = normalizeAll(e.company);
      const period = [normalizeAll(e.dateFrom), normalizeAll(e.dateTo)]
        .filter(Boolean)
        .join(" - ");
      const desc = normalizeAll(e.description);
      return `
        <div class="entry">
          <div class="entry-header">
            <span class="entry-title">${title}${company ? ` at ${company}` : ""}</span>
            ${period ? `<span class="entry-period">${period}</span>` : ""}
          </div>
          ${desc ? `<p class="entry-desc">${desc}</p>` : ""}
        </div>`;
    })
    .join("");
  const experienceHtml = expRows
    ? section("Experience", expRows)
    : "";

  // Education
  const eduRows = educationHistory
    .map((e) => {
      const parts = [
        normalizeAll(e.degree),
        normalizeAll(e.field),
      ]
        .filter(Boolean)
        .join(" in ");
      const school = normalizeAll(e.school);
      const period = [normalizeAll(e.dateFrom), normalizeAll(e.dateTo)]
        .filter(Boolean)
        .join(" - ");
      return `
        <div class="entry">
          <div class="entry-header">
            <span class="entry-title">${parts}${school ? ` - ${school}` : ""}</span>
            ${period ? `<span class="entry-period">${period}</span>` : ""}
          </div>
        </div>`;
    })
    .join("");
  const educationHtml = eduRows
    ? section("Education", eduRows)
    : "";

  // Certifications
  const certHtml = certifications
    ? section("Certifications", `<p>${normalizeAll(certifications)}</p>`)
    : "";

  // Languages
  const langHtml =
    languages.length > 0
      ? section(
          "Languages",
          `<p>${languages.map(normalizeAll).join(" - ")}</p>`
        )
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${fullName} - Resume</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      color: #000000;
      background: #ffffff;
      padding: 32px 40px;
      line-height: 1.45;
    }
    .name {
      font-size: 20pt;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .contact {
      font-size: 10pt;
      color: #333333;
      margin-bottom: 20px;
    }
    .section {
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      border-bottom: 1px solid #000000;
      padding-bottom: 2px;
      margin-bottom: 8px;
      letter-spacing: 0.05em;
    }
    p {
      margin-bottom: 4px;
    }
    .entry {
      margin-bottom: 10px;
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .entry-title {
      font-weight: bold;
    }
    .entry-period {
      font-size: 10pt;
      color: #444444;
    }
    .entry-desc {
      margin-top: 3px;
      font-size: 10.5pt;
    }
  </style>
</head>
<body>
  <div class="name">${fullName}</div>
  ${
    contactParts.length > 0
      ? `<div class="contact">${contactParts.join(" | ")}</div>`
      : ""
  }
  ${summaryHtml}
  ${experienceHtml}
  ${skillsHtml}
  ${educationHtml}
  ${certHtml}
  ${langHtml}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main server action
// ---------------------------------------------------------------------------

export async function generateResumePdf(
  vacancyId: number
): Promise<Buffer | { error: string }> {
  try {
    const user = await requireUser();

    const vacancy = await prisma.vacancy.findUnique({
      where: { id: vacancyId },
    });
    if (!vacancy) return { error: "Vacancy not found" };

    const userProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!userProfile) return { error: "Please create your profile first" };

    // -----------------------------------------------------------------------
    // Parse stored JSON fields
    // -----------------------------------------------------------------------

    let experience: ExperienceEntry[] = [];
    if (userProfile.experience) {
      try {
        const parsed = JSON.parse(userProfile.experience);
        if (Array.isArray(parsed)) experience = parsed as ExperienceEntry[];
      } catch {
        // ignore malformed JSON
      }
    }

    let educationHistory: EducationEntry[] = [];
    if (userProfile.educationHistory) {
      try {
        const parsed = JSON.parse(userProfile.educationHistory);
        if (Array.isArray(parsed))
          educationHistory = parsed as EducationEntry[];
      } catch {
        // ignore malformed JSON
      }
    }

    // -----------------------------------------------------------------------
    // AI: keyword injection + summary rewrite + skills reorder
    // -----------------------------------------------------------------------

    const descriptionTruncated = vacancy.description.slice(0, 3000);
    const profileSkills = userProfile.skills.join(", ") || "Not specified";
    const currentSummary = userProfile.summary || "";

    const aiPrompt = `You are an expert ATS resume optimizer. Given a job description and candidate's current resume data, produce ATS-optimized content.

Job: ${vacancy.title} at ${vacancy.company ?? "Unknown company"}
Job Description: ${descriptionTruncated}

Current candidate summary: ${currentSummary || "(none)"}
Current skills: ${profileSkills}

Tasks:
1. Rewrite the professional summary to be tailored to this specific vacancy. Keep it honest — only rephrase existing skills/experience, do not invent new ones. Max 4 sentences.
2. Reorder the skills array to put most relevant skills first for this vacancy. Only include skills from the original list — do not add new ones.
3. List keywords from the job description that can be ethically injected (i.e., the candidate already has these skills but they were not explicitly stated).

Return JSON:
{
  "tailoredSummary": "string",
  "reorderedSkills": ["string"],
  "injectedKeywords": ["string"]
}`;

    const aiResult = await callAIJSON<TailoredResumeData>(aiPrompt, {
      userId: user.id,
      systemPrompt:
        "You are an expert resume writer specializing in ATS optimization. Tailor resumes ethically — only emphasize skills the candidate already has. Return only valid JSON.",
    });

    // Use AI results, fallback to original profile data on error
    const tailoredSummary =
      aiResult.tailoredSummary || userProfile.summary || "";
    const reorderedSkills =
      Array.isArray(aiResult.reorderedSkills) && aiResult.reorderedSkills.length > 0
        ? aiResult.reorderedSkills
        : userProfile.skills;

    // -----------------------------------------------------------------------
    // Build HTML
    // -----------------------------------------------------------------------

    const html = buildResumeHtml({
      firstName: userProfile.firstName || "",
      lastName: userProfile.lastName || "",
      email: user.email,
      phone: userProfile.phone || "",
      location: userProfile.location || "",
      linkedinUrl: userProfile.linkedinUrl || "",
      githubUrl: userProfile.githubUrl || "",
      summary: tailoredSummary,
      skills: reorderedSkills,
      experience,
      educationHistory,
      certifications: userProfile.certifications || "",
      languages: userProfile.languages,
    });

    // -----------------------------------------------------------------------
    // Render HTML to PDF via Playwright headless Chromium
    // -----------------------------------------------------------------------

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: false,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.error("[generate-resume-pdf] Error:", e);
    return {
      error:
        e instanceof Error ? e.message : "Failed to generate resume PDF",
    };
  }
}
