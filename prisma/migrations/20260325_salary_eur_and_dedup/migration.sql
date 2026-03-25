-- Add EUR-normalized salary fields and cross-platform dedup tracking
ALTER TABLE "vacancies" ADD COLUMN "salary_min_eur" INTEGER;
ALTER TABLE "vacancies" ADD COLUMN "salary_max_eur" INTEGER;
ALTER TABLE "vacancies" ADD COLUMN "is_duplicate_of" INTEGER;

-- Self-referencing FK for duplicate tracking
ALTER TABLE "vacancies" ADD CONSTRAINT "vacancies_is_duplicate_of_fkey"
  FOREIGN KEY ("is_duplicate_of") REFERENCES "vacancies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
