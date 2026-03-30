"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/current-user";
import { getBotInfo, getWebhookInfo, setWebhook, deleteWebhook } from "@/lib/telegram-bot";

async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") throw new Error("Forbidden: owner access required");
  return user;
}

export async function getTelegramBotStatus() {
  await requireOwner();

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return {
      configured: false,
      connected: false,
      botUsername: null,
      webhookUrl: null,
      connectedUsers: 0,
    };
  }

  const [botInfo, webhookInfo, connectedUsers] = await Promise.all([
    getBotInfo(),
    getWebhookInfo(),
    prisma.user.count({
      where: { telegramChatId: { not: null } },
    }),
  ]);

  return {
    configured: true,
    connected: botInfo.ok === true,
    botUsername: botInfo.ok ? botInfo.result?.username : null,
    webhookUrl: webhookInfo.ok ? webhookInfo.result?.url || null : null,
    connectedUsers,
  };
}

export async function setupTelegramWebhook() {
  await requireOwner();

  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL;
  if (!appUrl) {
    return { ok: false, error: "APP_URL or NEXTAUTH_URL not configured" };
  }

  const webhookUrl = `${appUrl}/api/telegram-webhook`;
  const result = await setWebhook(webhookUrl);

  if (result.ok) {
    return { ok: true, webhookUrl };
  }
  return { ok: false, error: result.description || "Failed to set webhook" };
}

export async function removeTelegramWebhook() {
  await requireOwner();
  const result = await deleteWebhook();
  return { ok: result.ok === true };
}

export async function getTelegramConnectedUsers() {
  await requireOwner();

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { telegramUsername: { not: null } },
        { telegramChatId: { not: null } },
      ],
    },
    select: {
      id: true,
      email: true,
      name: true,
      telegramUsername: true,
      telegramChatId: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { users };
}
