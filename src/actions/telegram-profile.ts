"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";

export async function getTelegramSettings() {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      telegramUsername: true,
      telegramChatId: true,
    },
  });

  return {
    telegramUsername: dbUser?.telegramUsername || "",
    telegramChatId: dbUser?.telegramChatId || null,
    isConnected: !!dbUser?.telegramChatId,
  };
}

export async function updateTelegramUsername(username: string) {
  const user = await requireUser();

  // Normalize: remove @ prefix if present, trim whitespace
  const normalized = username.trim().replace(/^@/, "");

  if (normalized && !/^[a-zA-Z0-9_]{5,32}$/.test(normalized)) {
    return { error: "Invalid Telegram username. Must be 5-32 characters, alphanumeric and underscores only." };
  }

  // If username changed, reset chat_id (needs re-linking)
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { telegramUsername: true },
  });

  const usernameChanged = current?.telegramUsername !== (normalized || null);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramUsername: normalized || null,
      // Reset chat_id if username changed — user needs to /start again
      ...(usernameChanged ? { telegramChatId: null } : {}),
    },
  });

  return { ok: true, username: normalized || null };
}

export async function disconnectTelegram() {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramChatId: null,
    },
  });

  return { ok: true };
}
