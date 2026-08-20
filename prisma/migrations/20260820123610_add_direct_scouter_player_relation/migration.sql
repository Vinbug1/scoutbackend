-- AlterTable
ALTER TABLE "User" ADD COLUMN     "scouterId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_scouterId_fkey" FOREIGN KEY ("scouterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
