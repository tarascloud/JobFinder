-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "analysisStatus" TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "analysisResult" TEXT;
