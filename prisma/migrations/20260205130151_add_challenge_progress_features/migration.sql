-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED', 'PAUSED');

-- DropIndex
DROP INDEX "ChallengeParticipant_userId_idx";

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "targetProgress" DOUBLE PRECISION NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "ChallengeParticipant" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ProgressLog" (
    "id" SERIAL NOT NULL,
    "participantId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "description" TEXT NOT NULL,
    "progressDelta" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChallengeParticipant_status_idx" ON "ChallengeParticipant"("status");

-- CreateIndex
CREATE INDEX "ChallengeParticipant_progress_idx" ON "ChallengeParticipant"("progress");

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ChallengeParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
