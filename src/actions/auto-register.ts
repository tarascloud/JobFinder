"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { encrypt } from "@/lib/encryption";
import {
  registerOnPlatform,
  generatePassword,
  PLATFORM_REGISTRATION_CONFIGS,
  type RegistrationResult,
} from "@/lib/auto-register";

export type { RegistrationResult } from "@/lib/auto-register";

/**
 * Start auto-registration for the given platform using the user's JF email.
 * Creates a PlatformAccount with status "pending" immediately, then runs
 * the Playwright registration script and updates the record with the result.
 */
export async function autoRegisterPlatform(
  platform: string
): Promise<{ ok: boolean; result?: RegistrationResult; error?: string }> {
  const user = await requireUser();

  if (!user.jfEmail) {
    return { ok: false, error: "Your JF email is not set up yet. Please contact support." };
  }

  const config = PLATFORM_REGISTRATION_CONFIGS.find((c) => c.platform === platform);
  if (!config) {
    return { ok: false, error: `Unknown platform: ${platform}` };
  }

  if (!config.supportsAutoRegister) {
    return { ok: false, error: `${config.label} does not require registration — ${config.note}` };
  }

  // Check if account already exists
  const existing = await prisma.platformAccount.findFirst({
    where: { userId: user.id, platform },
  });

  if (existing) {
    return {
      ok: false,
      error: `You already have a ${config.label} account configured. Remove it first to re-register.`,
    };
  }

  // Generate password
  const password = generatePassword();

  // Create pending record immediately (shows "in progress" in UI)
  const account = await prisma.platformAccount.create({
    data: {
      userId: user.id,
      platform,
      authType: "password",
      email: user.jfEmail,
      passwordEncrypted: encrypt(password),
      status: "pending",
      registrationLog: JSON.stringify(["Registration started…"]),
    },
  });

  try {
    // Run Playwright registration
    const result = await registerOnPlatform(platform, {
      jfEmail: user.jfEmail,
      password,
      name: user.name,
    });

    // Map result status to PlatformAccount status
    const accountStatus = mapRegistrationStatus(result.status);

    await prisma.platformAccount.update({
      where: { id: account.id },
      data: {
        status: accountStatus,
        registeredAt: result.status !== "failed" ? new Date() : null,
        registrationLog: JSON.stringify(result.log),
      },
    });

    return { ok: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.platformAccount.update({
      where: { id: account.id },
      data: {
        status: "failed",
        registrationLog: JSON.stringify([`Unexpected error: ${msg}`]),
      },
    });
    return { ok: false, error: msg };
  }
}

/**
 * Get auto-registration status for all registerable platforms for the current user.
 */
export async function getPlatformRegistrationStatus(): Promise<{
  platform: string;
  label: string;
  supportsAutoRegister: boolean;
  requiresPhone: boolean;
  requiresCaptcha: boolean;
  requiresEmailVerification: boolean;
  note: string;
  registrationUrl: string;
  account?: {
    id: number;
    status: string;
    email: string | null;
    registeredAt: Date | null;
    registrationLog: string[] | null;
  } | null;
}[]> {
  const user = await requireUser();

  const accounts = await prisma.platformAccount.findMany({
    where: {
      userId: user.id,
      platform: { not: "__service_credentials__" },
    },
    select: {
      id: true,
      platform: true,
      status: true,
      email: true,
      registeredAt: true,
      registrationLog: true,
    },
  });

  const accountMap = new Map(accounts.map((a) => [a.platform, a]));

  return PLATFORM_REGISTRATION_CONFIGS.map((config) => {
    const account = accountMap.get(config.platform);
    return {
      ...config,
      account: account
        ? {
            id: account.id,
            status: account.status,
            email: account.email,
            registeredAt: account.registeredAt,
            registrationLog: account.registrationLog
              ? (() => {
                  try {
                    return JSON.parse(account.registrationLog) as string[];
                  } catch {
                    return [account.registrationLog];
                  }
                })()
              : null,
          }
        : null,
    };
  });
}

/**
 * Get the current user's JF email.
 */
export async function getMyJfEmail(): Promise<string | null> {
  const user = await requireUser();
  return user.jfEmail ?? null;
}

/**
 * Mark a platform account as verified (user confirmed email).
 */
export async function markPlatformVerified(
  accountId: number
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const account = await prisma.platformAccount.findFirst({
    where: { id: accountId, userId: user.id },
  });

  if (!account) return { ok: false, error: "Account not found" };

  await prisma.platformAccount.update({
    where: { id: accountId },
    data: { status: "active" },
  });

  return { ok: true };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function mapRegistrationStatus(
  regStatus: RegistrationResult["status"]
): string {
  switch (regStatus) {
    case "registered":
      return "active";
    case "needs_verification":
      return "needs_verification";
    case "captcha_required":
      return "needs_attention";
    case "phone_required":
      return "needs_attention";
    case "already_exists":
      return "needs_attention";
    case "failed":
      return "failed";
    default:
      return "pending";
  }
}
