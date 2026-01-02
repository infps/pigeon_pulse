/*
  Warnings:

  - Added the required column `eventId` to the `EventInventory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EventInventory" ADD COLUMN     "eventId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "EventInventory" ADD CONSTRAINT "EventInventory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;
