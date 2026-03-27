-- Track applications made with personal accounts (not @jf.taras.cloud service accounts)
ALTER TABLE "applications" ADD COLUMN "applied_with_personal_account" BOOLEAN NOT NULL DEFAULT false;
