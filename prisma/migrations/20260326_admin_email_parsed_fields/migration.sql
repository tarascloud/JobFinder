-- AlterTable: add parsed body fields to admin_emails
ALTER TABLE "admin_emails" ADD COLUMN "body_text" TEXT;
ALTER TABLE "admin_emails" ADD COLUMN "body_html" TEXT;
ALTER TABLE "admin_emails" ADD COLUMN "message_id" TEXT;

-- AlterTable: add parsed body fields to email_responses
ALTER TABLE "email_responses" ADD COLUMN "body_text" TEXT;
ALTER TABLE "email_responses" ADD COLUMN "body_html" TEXT;
ALTER TABLE "email_responses" ADD COLUMN "message_id" TEXT;
