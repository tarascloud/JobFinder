-- AlterTable: add jf_email column to users
ALTER TABLE "users" ADD COLUMN "jf_email" TEXT;

-- Backfill existing user Taras (id=1)
UPDATE "users" SET "jf_email" = 'tpedchenko@jf.taras.cloud' WHERE "id" = 1;

-- CreateIndex
CREATE UNIQUE INDEX "users_jf_email_key" ON "users"("jf_email");
