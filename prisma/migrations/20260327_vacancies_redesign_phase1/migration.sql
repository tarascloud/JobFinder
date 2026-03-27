-- Phase 1: Vacancies Redesign
-- JF-V1.1: Create user_vacancies table
-- JF-V1.2: Add last_vacancies_seen_at to users
-- JF-V1.3: Add skills, preferred_platforms, excluded_keywords to search_profiles
-- JF-V1.4: Add is_archived, archived_at to vacancies

-- 1. Create user_vacancies table (JF-V1.1)
CREATE TABLE "user_vacancies" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "vacancy_id" INTEGER NOT NULL,
    "search_profile_id" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "salary_fit" BOOLEAN,
    "remote_fit" BOOLEAN,
    "score_notes" TEXT,
    "scored_at" TIMESTAMP(3),
    "scored_by" TEXT,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "saved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_vacancies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_vacancies_vacancy_id_fkey" FOREIGN KEY ("vacancy_id") REFERENCES "vacancies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_vacancies_search_profile_id_fkey" FOREIGN KEY ("search_profile_id") REFERENCES "search_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Unique constraint
ALTER TABLE "user_vacancies" ADD CONSTRAINT "user_vacancies_user_id_vacancy_id_key" UNIQUE ("user_id", "vacancy_id");

-- Indexes
CREATE INDEX "user_vacancies_user_id_seen_idx" ON "user_vacancies"("user_id", "seen");
CREATE INDEX "user_vacancies_user_id_score_idx" ON "user_vacancies"("user_id", "score");
CREATE INDEX "user_vacancies_vacancy_id_idx" ON "user_vacancies"("vacancy_id");

-- 2. Add last_vacancies_seen_at to users (JF-V1.2)
ALTER TABLE "users" ADD COLUMN "last_vacancies_seen_at" TIMESTAMP(3);

-- 3. Add new fields to search_profiles (JF-V1.3)
ALTER TABLE "search_profiles" ADD COLUMN "skills" TEXT[] DEFAULT '{}';
ALTER TABLE "search_profiles" ADD COLUMN "preferred_platforms" TEXT[] DEFAULT '{}';
ALTER TABLE "search_profiles" ADD COLUMN "excluded_keywords" TEXT[] DEFAULT '{}';

-- 4. Add is_archived and archived_at to vacancies (JF-V1.4)
ALTER TABLE "vacancies" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vacancies" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "vacancies_is_archived_scraped_at_idx" ON "vacancies"("is_archived", "scraped_at");

-- 5. Migrate data from vacancy_scores to user_vacancies
INSERT INTO user_vacancies (user_id, vacancy_id, search_profile_id, score, salary_fit, remote_fit, score_notes, scored_at, scored_by, dismissed, created_at)
SELECT user_id, vacancy_id, search_profile_id, match_score, salary_fit, remote_fit, notes, scored_at, scored_by, dismissed, scored_at
FROM vacancy_scores
ON CONFLICT (user_id, vacancy_id) DO NOTHING;
