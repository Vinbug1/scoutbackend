/*
  Warnings:

  - You are about to drop the column `consent` on the `WaitlistEntry` table. All the data in the column will be lost.
  - You are about to drop the column `ipHash` on the `WaitlistEntry` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `WaitlistEntry` table. All the data in the column will be lost.
  - You are about to drop the column `source` on the `WaitlistEntry` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `WaitlistEntry` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `WaitlistEntry` table. All the data in the column will be lost.
  - Added the required column `age` to the `WaitlistEntry` table without a default value. This is not possible if the table is not empty.
  - Made the column `fullname` on table `WaitlistEntry` required. This step will fail if there are existing NULL values in that column.
  - Made the column `country` on table `WaitlistEntry` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `WaitlistEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "WaitlistEntry_status_idx";

-- AlterTable
ALTER TABLE "WaitlistEntry" DROP COLUMN "consent",
DROP COLUMN "ipHash",
DROP COLUMN "role",
DROP COLUMN "source",
DROP COLUMN "status",
DROP COLUMN "userAgent",
ADD COLUMN     "age" TEXT NOT NULL,
ALTER COLUMN "fullname" SET NOT NULL,
ALTER COLUMN "country" SET NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;

-- DropEnum
DROP TYPE "WaitlistStatus";
