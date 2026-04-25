-- AlterTable: add per-user extension token for IDOR fix (R3-05)
ALTER TABLE "users" ADD COLUMN "extension_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_extension_token_key" ON "users"("extension_token");
