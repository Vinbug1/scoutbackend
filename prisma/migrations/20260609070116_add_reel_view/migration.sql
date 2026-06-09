/*
  Warnings:

  - You are about to drop the column `reelId` on the `VideoView` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "VideoView" DROP CONSTRAINT "VideoView_reelId_fkey";

-- DropIndex
DROP INDEX "VideoView_reelId_idx";

-- AlterTable
ALTER TABLE "VideoView" DROP COLUMN "reelId";

-- CreateTable
CREATE TABLE "ReelView" (
    "id" SERIAL NOT NULL,
    "reelId" INTEGER NOT NULL,
    "userId" INTEGER,
    "ipHash" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReelView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReelView_reelId_idx" ON "ReelView"("reelId");

-- CreateIndex
CREATE INDEX "ReelView_userId_idx" ON "ReelView"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReelView_reelId_userId_key" ON "ReelView"("reelId", "userId");

-- AddForeignKey
ALTER TABLE "ReelView" ADD CONSTRAINT "ReelView_reelId_fkey" FOREIGN KEY ("reelId") REFERENCES "Reel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReelView" ADD CONSTRAINT "ReelView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
