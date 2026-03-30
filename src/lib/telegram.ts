/**
 * Send a Telegram notification to the admin chat (from env TELEGRAM_CHAT_ID).
 */
export async function sendTelegramNotification(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (error) {
    console.error(
      "[telegram] Failed to send notification:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Send a Telegram notification to a specific user by their chat_id.
 */
export async function sendTelegramToUser(userChatId: string, message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !userChatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: userChatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (error) {
    console.error(
      "[telegram] Failed to send user notification:",
      error instanceof Error ? error.message : error
    );
  }
}
