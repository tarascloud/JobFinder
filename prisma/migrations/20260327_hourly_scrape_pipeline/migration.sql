-- AlterTable: Add lastScrapedAt to search_profiles for smart dedup
ALTER TABLE "search_profiles" ADD COLUMN "last_scraped_at" TIMESTAMP(3);
