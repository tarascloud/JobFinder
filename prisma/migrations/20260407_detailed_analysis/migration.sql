-- AddColumn: detailed_analysis (JSONB) to vacancy_scores
ALTER TABLE "vacancy_scores" ADD COLUMN IF NOT EXISTS "detailed_analysis" JSONB;
