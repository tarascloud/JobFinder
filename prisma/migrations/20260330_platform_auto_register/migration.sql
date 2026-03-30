-- Add auto-registration fields to platform_accounts
ALTER TABLE "platform_accounts"
  ADD COLUMN IF NOT EXISTS "registered_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "registration_log" TEXT;
