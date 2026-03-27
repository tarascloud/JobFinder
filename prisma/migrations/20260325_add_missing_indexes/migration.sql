-- Add missing database indexes for foreign key columns

-- Vacancy: index on is_duplicate_of for duplicate lookups
CREATE INDEX IF NOT EXISTS "vacancies_is_duplicate_of_idx" ON "vacancies"("is_duplicate_of");

-- Application: index on vacancy_id for vacancy-based queries
CREATE INDEX IF NOT EXISTS "applications_vacancy_id_idx" ON "applications"("vacancy_id");

-- Application: index on search_profile_id for profile-based queries
CREATE INDEX IF NOT EXISTS "applications_search_profile_id_idx" ON "applications"("search_profile_id");

-- QaPair: index on source_vacancy_id for vacancy-based QA lookups
CREATE INDEX IF NOT EXISTS "qa_pairs_source_vacancy_id_idx" ON "qa_pairs"("source_vacancy_id");

-- Notification: index on user_id for user-based notification queries
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");
