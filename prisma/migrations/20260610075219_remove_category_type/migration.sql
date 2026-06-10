/*
  Warnings:

  - You are about to drop the column `categoryType` on the `VideoCategory` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_reelId_fkey";

-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_reelId_fkey";

-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_videoId_fkey";

-- AlterTable
ALTER TABLE "Comment" ALTER COLUMN "reelId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Rating" ALTER COLUMN "videoId" DROP NOT NULL,
ALTER COLUMN "reelId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "VideoCategory" DROP COLUMN "categoryType";

-- DropEnum
DROP TYPE "CategoryType";

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;
