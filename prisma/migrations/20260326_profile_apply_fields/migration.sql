-- Add new profile fields for LinkedIn Easy Apply / auto-apply
ALTER TABLE "user_profiles" ADD COLUMN "location" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN "education_history" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN "experience" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN "certifications" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN "github_url" TEXT;
ALTER TABLE "user_profiles" ADD COLUMN "portfolio_url" TEXT;
