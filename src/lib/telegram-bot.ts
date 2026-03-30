const TELEGRAM_API = "https://api.telegram.org/bot";

function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

/**
 * Send a message to a specific Telegram chat.
 */
export async function sendTelegramMessage(chatId: string, text: string, parseMode: "HTML" | "Markdown" = "HTML") {
  const token = getBotToken();
  if (!token) {
    console.error("[telegram-bot] TELEGRAM_BOT_TOKEN not set");
    return { ok: false, error: "Bot token not configured" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("[telegram-bot] Failed to send message:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Failed to send message" };
  }
}

/**
 * Get bot info (username, id, etc.) to verify the token is valid.
 */
export async function getBotInfo() {
  const token = getBotToken();
  if (!token) {
    return { ok: false, error: "Bot token not configured" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/getMe`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("[telegram-bot] Failed to get bot info:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Failed to connect to Telegram" };
  }
}

/**
 * Set webhook URL for the bot.
 */
export async function setWebhook(url: string) {
  const token = getBotToken();
  if (!token) {
    return { ok: false, error: "Bot token not configured" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("[telegram-bot] Failed to set webhook:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Failed to set webhook" };
  }
}

/**
 * Get current webhook info.
 */
export async function getWebhookInfo() {
  const token = getBotToken();
  if (!token) {
    return { ok: false, error: "Bot token not configured" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/getWebhookInfo`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("[telegram-bot] Failed to get webhook info:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Failed to get webhook info" };
  }
}

/**
 * Delete webhook (switch to polling mode or disable).
 */
export async function deleteWebhook() {
  const token = getBotToken();
  if (!token) {
    return { ok: false, error: "Bot token not configured" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/deleteWebhook`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("[telegram-bot] Failed to delete webhook:", error instanceof Error ? error.message : error);
    return { ok: false, error: "Failed to delete webhook" };
  }
}
