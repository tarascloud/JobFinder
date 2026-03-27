-- Add Telegram integration fields to users table
ALTER TABLE "users" ADD COLUMN "telegram_username" TEXT;
ALTER TABLE "users" ADD COLUMN "telegram_chat_id" TEXT;
