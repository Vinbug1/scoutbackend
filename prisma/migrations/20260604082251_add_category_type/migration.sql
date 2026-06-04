-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('SKILL', 'GENERAL', 'TACTICAL', 'PHYSICAL');

-- AlterTable
ALTER TABLE "VideoCategory" ADD COLUMN     "categoryType" "CategoryType" NOT NULL DEFAULT 'GENERAL';
