import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram-bot";

/**
 * Telegram Bot Webhook endpoint.
 * When a user sends /start to the bot, we try to link their Telegram chat_id
 * to their account by matching the Telegram username.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Telegram sends updates with a message object
    const message = body?.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat?.id);
    const text = message.text || "";
    const telegramUsername = message.from?.username;

    // Handle /start command
    if (text.startsWith("/start")) {
      if (!telegramUsername) {
        await sendTelegramMessage(
          chatId,
          "Please set a username in your Telegram settings first, then try /start again."
        );
        return NextResponse.json({ ok: true });
      }

      // Try to find a user with this telegram username
      const user = await prisma.user.findFirst({
        where: {
          telegramUsername: {
            equals: telegramUsername,
            mode: "insensitive",
          },
        },
      });

      if (user) {
        // Link the chat_id to the user
        await prisma.user.update({
          where: { id: user.id },
          data: { telegramChatId: chatId },
        });

        await sendTelegramMessage(
          chatId,
          `Connected! Your Telegram account @${telegramUsername} is now linked to your JobFinder account (${user.email}).\n\nYou will receive notifications here about new vacancies, application updates, and more.`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `No JobFinder account found with Telegram username @${telegramUsername}.\n\nPlease make sure you've entered your Telegram username in your JobFinder profile settings first, then try /start again.`
        );
      }

      return NextResponse.json({ ok: true });
    }

    // Handle /status command
    if (text.startsWith("/status")) {
      if (!telegramUsername) {
        await sendTelegramMessage(chatId, "Please set a username in Telegram settings.");
        return NextResponse.json({ ok: true });
      }

      const user = await prisma.user.findFirst({
        where: {
          telegramUsername: { equals: telegramUsername, mode: "insensitive" },
          telegramChatId: chatId,
        },
      });

      if (user) {
        const [appCount, vacancyCount] = await Promise.all([
          prisma.application.count({ where: { userId: user.id } }),
          prisma.userVacancy.count({ where: { userId: user.id, seen: false } }),
        ]);

        await sendTelegramMessage(
          chatId,
          `<b>JobFinder Status</b>\n\nAccount: ${user.email}\nTotal applications: ${appCount}\nUnseen vacancies: ${vacancyCount}`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          "Your account is not linked. Enter your Telegram username in JobFinder profile and send /start."
        );
      }

      return NextResponse.json({ ok: true });
    }

    // Handle /help command
    if (text.startsWith("/help")) {
      await sendTelegramMessage(
        chatId,
        "<b>JobFinder Bot Commands</b>\n\n/start - Link your Telegram to JobFinder\n/status - Check your account status\n/help - Show this help message"
      );
      return NextResponse.json({ ok: true });
    }

    // Default response for unrecognized messages
    await sendTelegramMessage(
      chatId,
      "Send /help to see available commands."
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telegram-webhook] Error:", error instanceof Error ? error.message : error);
    // Always return 200 to Telegram so it doesn't retry
    return NextResponse.json({ ok: true });
  }
}
