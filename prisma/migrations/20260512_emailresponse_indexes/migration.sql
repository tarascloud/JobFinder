-- CreateIndex: EmailResponse FK & query-pattern indexes (REV-20260512-068)
-- Use IF NOT EXISTS so this migration is idempotent on environments where
-- some indexes may already exist from ad-hoc DBA work.

CREATE INDEX IF NOT EXISTS "email_responses_user_id_idx"
  ON "email_responses"("user_id");

CREATE INDEX IF NOT EXISTS "email_responses_application_id_idx"
  ON "email_responses"("application_id");

-- Composite index for "list latest emails for user" queries
CREATE INDEX IF NOT EXISTS "email_responses_user_id_received_at_idx"
  ON "email_responses"("user_id", "received_at" DESC);
