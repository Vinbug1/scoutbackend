/*
  Warnings:

  - You are about to drop the column `blurHash` on the `ChatMessage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN "blurHash",
ADD COLUMN     "blurhash" TEXT;
