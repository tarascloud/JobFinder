"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

export async function getPlatformAccounts() {
  const user = await requireUser();

  const accounts = await prisma.platformAccount.findMany({
    where: { userId: user.id },
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
    "remoteok",
    "weworkremotely",
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
      // TODO: encrypt password before storing
      passwordEncrypted: data.password || null,
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
      ...(data.password !== undefined && { passwordEncrypted: data.password }),
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
