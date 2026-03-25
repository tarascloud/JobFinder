"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

export interface UserPreferences {
  locale: string;
  skin: string;
  theme: string;
}

/**
 * Get user preferences from DB.
 * Returns defaults for demo users.
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    const user = await requireUser();
    if (user.id === 0) {
      return { locale: "en", skin: "taras", theme: "dark" };
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        preferredLocale: true,
        preferredSkin: true,
        preferredTheme: true,
      },
    });

    return {
      locale: dbUser?.preferredLocale ?? "en",
      skin: dbUser?.preferredSkin ?? "taras",
      theme: dbUser?.preferredTheme ?? "dark",
    };
  } catch {
    return { locale: "en", skin: "taras", theme: "dark" };
  }
}

/**
 * Update a single preference in DB and set the corresponding cookie.
 * Cookie keeps SSR fast; DB is the source of truth.
 */
export async function updatePreference(
  key: "locale" | "skin" | "theme",
  value: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();
    if (user.id === 0) return { success: false, error: "Demo mode" };

    const fieldMap = {
      locale: "preferredLocale",
      skin: "preferredSkin",
      theme: "preferredTheme",
    } as const;

    await prisma.user.update({
      where: { id: user.id },
      data: { [fieldMap[key]]: value },
    });

    // Also set cookie so SSR picks it up immediately
    const jar = await cookies();
    const cookieMap = {
      locale: "locale",
      skin: "jf-skin",
      theme: "theme",
    } as const;

    jar.set(cookieMap[key], value, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Restore cookies from DB preferences.
 * Called from layout on authenticated page loads.
 */
export async function restorePreferencesFromDB(): Promise<UserPreferences | null> {
  try {
    const user = await requireUser();
    if (user.id === 0) return null;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        preferredLocale: true,
        preferredSkin: true,
        preferredTheme: true,
      },
    });

    if (!dbUser) return null;

    const jar = await cookies();
    const prefs = {
      locale: dbUser.preferredLocale,
      skin: dbUser.preferredSkin,
      theme: dbUser.preferredTheme,
    };

    // Restore cookies if missing
    const cookieOpts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

    if (!jar.get("locale")?.value) {
      jar.set("locale", prefs.locale, cookieOpts);
    }
    if (!jar.get("jf-skin")?.value) {
      jar.set("jf-skin", prefs.skin, cookieOpts);
    }
    // theme cookie for next-themes
    if (!jar.get("theme")?.value) {
      jar.set("theme", prefs.theme, cookieOpts);
    }

    return prefs;
  } catch {
    return null;
  }
}
