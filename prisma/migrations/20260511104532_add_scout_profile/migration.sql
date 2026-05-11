/*
  Warnings:

  - You are about to drop the column `report` on the `ScouterReport` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `ScouterReport` table. All the data in the column will be lost.
  - You are about to drop the `PlayerReport` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('RECOMMEND_FOR_TRIAL', 'FILE_FOR_FUTURE_REFERENCE', 'NOT_SUITABLE');

-- DropForeignKey
ALTER TABLE "PlayerReport" DROP CONSTRAINT "PlayerReport_playerId_fkey";

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "ScouterReport" DROP COLUMN "report",
DROP COLUMN "title",
ADD COLUMN     "ageGroup" TEXT,
ADD COLUMN     "agilityBalance" INTEGER,
ADD COLUMN     "areasForDevelopment" TEXT[],
ADD COLUMN     "ballControl" INTEGER,
ADD COLUMN     "braveryCommitment" INTEGER,
ADD COLUMN     "coachability" INTEGER,
ADD COLUMN     "composure" INTEGER,
ADD COLUMN     "currentClub" TEXT,
ADD COLUMN     "decisionMaking" INTEGER,
ADD COLUMN     "determination" INTEGER,
ADD COLUMN     "dribbling" INTEGER,
ADD COLUMN     "firstTouch" INTEGER,
ADD COLUMN     "gameIntelligence" INTEGER,
ADD COLUMN     "heading" INTEGER,
ADD COLUMN     "jumpingRate" INTEGER,
ADD COLUMN     "keyStrengths" TEXT[],
ADD COLUMN     "leadershipCommunication" INTEGER,
ADD COLUMN     "matchScouted" TEXT,
ADD COLUMN     "movementOffBall" INTEGER,
ADD COLUMN     "overallAssessment" TEXT,
ADD COLUMN     "pace" INTEGER,
ADD COLUMN     "passingLong" INTEGER,
ADD COLUMN     "passingShort" INTEGER,
ADD COLUMN     "positionalAwareness" INTEGER,
ADD COLUMN     "recommendation" "Recommendation",
ADD COLUMN     "shooting" INTEGER,
ADD COLUMN     "smartPass" INTEGER,
ADD COLUMN     "staminaWorkRate" INTEGER,
ADD COLUMN     "strength" INTEGER,
ADD COLUMN     "tackling" INTEGER,
ADD COLUMN     "throughBalls" INTEGER,
ADD COLUMN     "timesSeen" INTEGER,
ADD COLUMN     "transitions" INTEGER,
ADD COLUMN     "weakerFoot" INTEGER;

-- DropTable
DROP TABLE "PlayerReport";

-- CreateTable
CREATE TABLE "ScoutProfile" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "avatarUrl" TEXT,
    "club" TEXT,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoutProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoomMember" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScoutProfile_userId_key" ON "ScoutProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoomMember_roomId_userId_key" ON "ChatRoomMember"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "ScoutProfile" ADD CONSTRAINT "ScoutProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoomMember" ADD CONSTRAINT "ChatRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
