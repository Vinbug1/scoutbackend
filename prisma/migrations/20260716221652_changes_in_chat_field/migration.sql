/*
  Warnings:

  - You are about to drop the column `lastMessageId` on the `ChatRoom` table. All the data in the column will be lost.
  - You are about to drop the column `lastReadMessageId` on the `ChatRoomMember` table. All the data in the column will be lost.
  - You are about to drop the column `unreadCount` on the `ChatRoomMember` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[roomId,seq]` on the table `ChatMessage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[roomId,userId,clientTempId]` on the table `ChatMessage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `seq` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChatMemberRole" AS ENUM ('MEMBER', 'ADMIN');

-- DropForeignKey
ALTER TABLE "ChatRoom" DROP CONSTRAINT "ChatRoom_lastMessageId_fkey";

-- DropIndex
DROP INDEX "ChatMessage_clientTempId_key";

-- DropIndex
DROP INDEX "ChatRoom_lastMessageId_key";

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "mediaMeta" JSONB,
ADD COLUMN     "replyToPreview" TEXT,
ADD COLUMN     "replyToSenderId" INTEGER,
ADD COLUMN     "seq" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ChatRoom" DROP COLUMN "lastMessageId",
ADD COLUMN     "seqCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ChatRoomMember" DROP COLUMN "lastReadMessageId",
DROP COLUMN "unreadCount",
ADD COLUMN     "lastDeliveredSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReadSeq" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mutedUntil" TIMESTAMP(3),
ADD COLUMN     "role" "ChatMemberRole" NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "ChatLastMessage" (
    "roomId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,
    "senderId" INTEGER,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "preview" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatLastMessage_pkey" PRIMARY KEY ("roomId")
);

-- CreateTable
CREATE TABLE "MessageDeliveryReceipt" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageDeliveryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDeletionForUser" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageDeletionForUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatLastMessage_messageId_key" ON "ChatLastMessage"("messageId");

-- CreateIndex
CREATE INDEX "ChatLastMessage_updatedAt_idx" ON "ChatLastMessage"("updatedAt");

-- CreateIndex
CREATE INDEX "MessageDeliveryReceipt_userId_idx" ON "MessageDeliveryReceipt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageDeliveryReceipt_messageId_userId_key" ON "MessageDeliveryReceipt"("messageId", "userId");

-- CreateIndex
CREATE INDEX "MessageDeletionForUser_userId_idx" ON "MessageDeletionForUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageDeletionForUser_messageId_userId_key" ON "MessageDeletionForUser"("messageId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_updatedAt_idx" ON "ChatMessage"("roomId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_roomId_seq_key" ON "ChatMessage"("roomId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_roomId_userId_clientTempId_key" ON "ChatMessage"("roomId", "userId", "clientTempId");

-- AddForeignKey
ALTER TABLE "ChatLastMessage" ADD CONSTRAINT "ChatLastMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatLastMessage" ADD CONSTRAINT "ChatLastMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDeliveryReceipt" ADD CONSTRAINT "MessageDeliveryReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDeliveryReceipt" ADD CONSTRAINT "MessageDeliveryReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDeletionForUser" ADD CONSTRAINT "MessageDeletionForUser_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDeletionForUser" ADD CONSTRAINT "MessageDeletionForUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
