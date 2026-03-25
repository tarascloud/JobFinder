-- Add source column to search_profiles
ALTER TABLE "search_profiles" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';

-- Add source column to qa_pairs
ALTER TABLE "qa_pairs" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
