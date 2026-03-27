-- CreateTable
CREATE TABLE "admin_emails" (
    "id" SERIAL NOT NULL,
    "from_email" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "platform" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_emails_created_at_idx" ON "admin_emails"("created_at");

-- CreateIndex
CREATE INDEX "admin_emails_category_idx" ON "admin_emails"("category");
