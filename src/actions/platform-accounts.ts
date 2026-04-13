"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { encrypt } from "@/lib/encryption";

export async function getPlatformAccounts() {
  try {
    const user = await requireUser();

    const accounts = await prisma.platformAccount.findMany({
      where: {
        userId: user.id,
        platform: { not: "__service_credentials__" },
      },
      orderBy: { id: "desc" },
      select: {
        id: true,
        platform: true,
        authType: true,
        email: true,
        status: true,
        lastLogin: true,
      },
    });

    return { accounts };
  } catch (error) {
    console.error("Failed to fetch platform accounts:", error);
    return { accounts: [], error: "Failed to fetch platform accounts" };
  }
}

export async function addPlatformAccount(data: {
  platform: string;
  authType: string;
  email: string;
  password?: string;
}) {
  const user = await requireUser();

  const supportedPlatforms = [
    "linkedin",
    "indeed",
    "glassdoor",
    "wellfound",
    "arcdev",
    "djinni",
    "dou",
    "workua",
    "robotaua",
    "remoteok",
    "weworkremotely",
    "dice",
    "simplyhired",
    "himalayas",
  ];

  if (!supportedPlatforms.includes(data.platform)) {
    return { error: "Unsupported platform" };
  }

  if (!data.email?.trim()) {
    return { error: "Email is required" };
  }

  const existing = await prisma.platformAccount.findFirst({
    where: { userId: user.id, platform: data.platform },
  });

  if (existing) {
    return { error: "Platform account already exists" };
  }

  await prisma.platformAccount.create({
    data: {
      userId: user.id,
      platform: data.platform,
      authType: data.authType || "password",
      email: data.email.trim(),
      passwordEncrypted: data.password ? encrypt(data.password) : null,
      status: "active",
    },
  });

  return { ok: true };
}

export async function updatePlatformAccount(
  id: number,
  data: Partial<{
    email: string;
    password: string;
    authType: string;
    status: string;
  }>
) {
  const user = await requireUser();

  const account = await prisma.platformAccount.findFirst({
    where: { id, userId: user.id },
  });

  if (!account) return { error: "Account not found" };

  await prisma.platformAccount.update({
    where: { id },
    data: {
      ...(data.email !== undefined && { email: data.email.trim() }),
      ...(data.password !== undefined && {
        passwordEncrypted: data.password ? encrypt(data.password) : null,
      }),
      ...(data.authType !== undefined && { authType: data.authType }),
      ...(data.status !== undefined && { status: data.status }),
    },
  });

  return { ok: true };
}

export async function deletePlatformAccount(id: number) {
  const user = await requireUser();

  const account = await prisma.platformAccount.findFirst({
    where: { id, userId: user.id },
  });

  if (!account) return { error: "Account not found" };

  await prisma.platformAccount.delete({ where: { id } });

  return { ok: true };
}

/**
 * Returns platform names that have service accounts set up by an owner.
 * Does NOT reveal credentials — just which platforms are integrated.
 */
export async function getServiceIntegrationPlatforms(): Promise<string[]> {
  await requireUser();
  const accounts = await prisma.platformAccount.findMany({
    where: {
      user: { role: "owner" },
      platform: { notIn: ["__service_credentials__"] },
    },
    select: { platform: true },
    distinct: ["platform"],
  });
  return accounts.map(a => a.platform);
}

/**
 * Returns platforms enabled by admin in Platform Registrations.
 */
export async function getAvailablePlatformNames(): Promise<string[]> {
  await requireUser();

  const enabledRows = await prisma.$queryRaw<{ platform: string }[]>`
    SELECT platform FROM platform_settings WHERE enabled = true ORDER BY platform
  `;

  return enabledRows.map((r) => r.platform);
}

export async function testPlatformConnection(id: number) {
  const user = await requireUser();

  const account = await prisma.platformAccount.findFirst({
    where: { id, userId: user.id },
  });

  if (!account) return { error: "Account not found" };

  // TODO: implement actual platform login test
  // For now, return placeholder success
  return { ok: true, message: "Connection test placeholder — not yet implemented" };
}
