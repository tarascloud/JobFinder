-- AlterTable
ALTER TABLE "vacancies" ADD COLUMN "tag_stack" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "vacancies" ADD COLUMN "tag_level" TEXT;
ALTER TABLE "vacancies" ADD COLUMN "tag_industry" TEXT;
ALTER TABLE "vacancies" ADD COLUMN "tag_team_size" TEXT;
