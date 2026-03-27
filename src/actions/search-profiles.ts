"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { callAIJSON } from "@/lib/ai/provider";

export async function getSearchProfiles() {
  try {
    const user = await requireUser();
    return await prisma.searchProfile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load search profiles" };
  }
}

export async function getSearchProfile(id: number) {
  try {
    const user = await requireUser();
    const profile = await prisma.searchProfile.findFirst({
      where: { id, userId: user.id },
    });
    if (!profile) return { error: "Search profile not found" };
    return profile;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load search profile" };
  }
}

interface SearchProfileData {
  name: string;
  jobTitles?: string[];
  minSalary?: number | null;
  currency?: string | null;
  employmentTypes?: string[];
  remoteOnly?: boolean;
  geographies?: string[];
  excludedCompanies?: string[];
  excludedIndustries?: string[];
  stackFilter?: string[];
  skills?: string[];
  preferredPlatforms?: string[];
  excludedKeywords?: string[];
  applyHoursStart?: number;
  applyHoursEnd?: number;
  applyTimezone?: string;
  maxDailyApplies?: number;
  autoApply?: boolean;
  scrapeSchedule?: string;
}

export async function createSearchProfile(data: SearchProfileData) {
  try {
    const user = await requireUser();

    // Enforce max 3 profiles per user
    const existingCount = await prisma.searchProfile.count({
      where: { userId: user.id },
    });
    if (existingCount >= 3) {
      return { error: "Maximum 3 search profiles allowed" };
    }

    const profile = await prisma.searchProfile.create({
      data: {
        userId: user.id,
        name: data.name,
        jobTitles: data.jobTitles ?? [],
        minSalary: data.minSalary,
        currency: data.currency,
        employmentTypes: data.employmentTypes ?? [],
        remoteOnly: data.remoteOnly ?? true,
        geographies: data.geographies ?? [],
        excludedCompanies: data.excludedCompanies ?? [],
        excludedIndustries: data.excludedIndustries ?? [],
        stackFilter: data.stackFilter ?? [],
        skills: data.skills ?? [],
        preferredPlatforms: data.preferredPlatforms ?? [],
        excludedKeywords: data.excludedKeywords ?? [],
        applyHoursStart: data.applyHoursStart ?? 18,
        applyHoursEnd: data.applyHoursEnd ?? 22,
        applyTimezone: data.applyTimezone ?? "Europe/Madrid",
        maxDailyApplies: data.maxDailyApplies ?? 20,
        autoApply: data.autoApply ?? false,
        scrapeSchedule: data.scrapeSchedule ?? "daily",
      },
    });

    return profile;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create search profile" };
  }
}

export async function updateSearchProfile(id: number, data: Partial<SearchProfileData>) {
  try {
    const user = await requireUser();

    // Verify ownership
    const existing = await prisma.searchProfile.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return { error: "Search profile not found" };

    // If editing an AI-created profile, mark as ai_edited
    const sourceUpdate = existing.source === "ai" ? { source: "ai_edited" } : {};

    const profile = await prisma.searchProfile.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.jobTitles !== undefined && { jobTitles: data.jobTitles }),
        ...(data.minSalary !== undefined && { minSalary: data.minSalary }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.employmentTypes !== undefined && { employmentTypes: data.employmentTypes }),
        ...(data.remoteOnly !== undefined && { remoteOnly: data.remoteOnly }),
        ...(data.geographies !== undefined && { geographies: data.geographies }),
        ...(data.excludedCompanies !== undefined && { excludedCompanies: data.excludedCompanies }),
        ...(data.excludedIndustries !== undefined && { excludedIndustries: data.excludedIndustries }),
        ...(data.stackFilter !== undefined && { stackFilter: data.stackFilter }),
        ...(data.skills !== undefined && { skills: data.skills }),
        ...(data.preferredPlatforms !== undefined && { preferredPlatforms: data.preferredPlatforms }),
        ...(data.excludedKeywords !== undefined && { excludedKeywords: data.excludedKeywords }),
        ...(data.applyHoursStart !== undefined && { applyHoursStart: data.applyHoursStart }),
        ...(data.applyHoursEnd !== undefined && { applyHoursEnd: data.applyHoursEnd }),
        ...(data.applyTimezone !== undefined && { applyTimezone: data.applyTimezone }),
        ...(data.maxDailyApplies !== undefined && { maxDailyApplies: data.maxDailyApplies }),
        ...(data.autoApply !== undefined && { autoApply: data.autoApply }),
        ...(data.scrapeSchedule !== undefined && { scrapeSchedule: data.scrapeSchedule }),
        ...sourceUpdate,
      },
    });

    return profile;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update search profile" };
  }
}

export async function deleteSearchProfile(id: number) {
  try {
    const user = await requireUser();

    const existing = await prisma.searchProfile.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return { error: "Search profile not found" };

    await prisma.searchProfile.delete({ where: { id } });
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete search profile" };
  }
}

export async function toggleSearchProfile(id: number) {
  try {
    const user = await requireUser();

    const existing = await prisma.searchProfile.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) return { error: "Search profile not found" };

    const profile = await prisma.searchProfile.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return profile;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to toggle search profile" };
  }
}

interface GeneratedSearchData {
  name: string;
  jobTitles: string[];
  minSalary: number | null;
  currency: string;
  employmentTypes: string[];
  remoteOnly: boolean;
  geographies: string[];
}

export async function generateSearchFromProfile(): Promise<
  GeneratedSearchData | { error: string }
> {
  try {
    const user = await requireUser();

    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) {
      return { error: "Please create your profile first" };
    }

    const profileSummary = {
      headline: profile.headline,
      summary: profile.summary,
      yearsExperience: profile.yearsExperience,
      skills: profile.skills,
      languages: profile.languages,
      salaryMin: profile.salaryMin,
      salaryCurrency: profile.salaryCurrency,
      preferredLocations: profile.preferredLocations,
      preferredRemoteType: profile.preferredRemoteType,
      employmentTypes: profile.employmentTypes,
    };

    const prompt = `Based on this professional profile, suggest job search criteria. Return ONLY a valid JSON object with these fields:
- "name": suggested search profile name (string)
- "jobTitles": 5-10 relevant job title suggestions (string[])
- "minSalary": minimum annual salary in EUR (number or null)
- "currency": salary currency, default "EUR" (string)
- "employmentTypes": suitable employment types like "full-time", "contract", "part-time" (string[])
- "remoteOnly": whether to search remote only (boolean)
- "geographies": suggested geographies/countries (string[])

Profile: ${JSON.stringify(profileSummary)}

Return ONLY the JSON object, no markdown formatting or code blocks.`;

    const parsed = await callAIJSON<GeneratedSearchData>(prompt, {
      userId: user.id,
    });

    return {
      name: parsed.name ?? "My Job Search",
      jobTitles: Array.isArray(parsed.jobTitles) ? parsed.jobTitles : [],
      minSalary: typeof parsed.minSalary === "number" ? parsed.minSalary : null,
      currency: parsed.currency ?? "EUR",
      employmentTypes: Array.isArray(parsed.employmentTypes) ? parsed.employmentTypes : ["full-time"],
      remoteOnly: typeof parsed.remoteOnly === "boolean" ? parsed.remoteOnly : true,
      geographies: Array.isArray(parsed.geographies) ? parsed.geographies : [],
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to generate search profile" };
  }
}
