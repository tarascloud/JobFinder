"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

export async function getGuests() {
  const user = await requireUser();
  if (user.role !== "owner") return { error: "Only owner can manage guests" };

  const [invites, users] = await Promise.all([
    prisma.guestInvite.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { role: { not: "owner" } },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { invites, users };
}

export async function inviteGuest(email: string) {
  const user = await requireUser();
  if (user.role !== "owner") return { error: "Only owner can invite" };

  const normalized = email.toLowerCase().trim();
  if (!normalized.includes("@")) return { error: "Invalid email" };

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return { error: "User already exists" };

  await prisma.guestInvite.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized, invitedBy: user.email },
  });

  return { ok: true };
}

export async function revokeInvite(email: string) {
  const user = await requireUser();
  if (user.role !== "owner") return { error: "Only owner can revoke" };

  await prisma.guestInvite.deleteMany({ where: { email } });
  return { ok: true };
}

export async function removeUser(userId: number) {
  const user = await requireUser();
  if (user.role !== "owner") return { error: "Only owner can remove users" };
  if (userId === user.id) return { error: "Cannot remove yourself" };

  await prisma.user.delete({ where: { id: userId } });
  return { ok: true };
}
