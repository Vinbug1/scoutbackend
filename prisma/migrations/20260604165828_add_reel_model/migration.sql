/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Video` table. All the data in the column will be lost.
  - Added the required column `reelId` to the `Comment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reelId` to the `Rating` table without a default value. This is not possible if the table is not empty.
  - Added the required column `reelId` to the `VideoView` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Video" DROP CONSTRAINT "Video_categoryId_fkey";

-- DropIndex
DROP INDEX "Video_categoryId_idx";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "reelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Rating" ADD COLUMN     "reelId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "categoryId";

-- AlterTable
ALTER TABLE "VideoView" ADD COLUMN     "reelId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Reel" (
    "id" SERIAL NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "categoryId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,

    CONSTRAINT "Reel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reel_playerId_idx" ON "Reel"("playerId");

-- CreateIndex
CREATE INDEX "Reel_createdAt_idx" ON "Reel"("createdAt");

-- CreateIndex
CREATE INDEX "Reel_categoryId_idx" ON "Reel"("categoryId");

-- CreateIndex
CREATE INDEX "Comment_reelId_idx" ON "Comment"("reelId");

-- CreateIndex
CREATE INDEX "Rating_reelId_idx" ON "Rating"("reelId");

-- CreateIndex
CREATE INDEX "VideoView_reelId_idx" ON "VideoView"("reelId");

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "VideoCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoView" ADD CONSTRAINT "VideoView_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
