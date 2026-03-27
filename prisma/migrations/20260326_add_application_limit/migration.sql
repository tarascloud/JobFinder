-- Add per-user application rate limit
ALTER TABLE "users" ADD COLUMN "application_limit" INTEGER NOT NULL DEFAULT 10;
