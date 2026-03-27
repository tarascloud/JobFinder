-- Add status tracking fields to applications
ALTER TABLE "applications" ADD COLUMN "failed_at" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN "error_message" TEXT;
