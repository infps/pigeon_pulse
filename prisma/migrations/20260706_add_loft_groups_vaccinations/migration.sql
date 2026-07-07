-- CreateEnum
CREATE TYPE "LoftGroupStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable LoftGroup
CREATE TABLE "LoftGroup" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "groupNo" INTEGER NOT NULL,
    "status" "LoftGroupStatus" NOT NULL DEFAULT 'OPEN',
    "capacity" INTEGER NOT NULL DEFAULT 150,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "LoftGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable VaccinationRecord
CREATE TABLE "VaccinationRecord" (
    "id" SERIAL NOT NULL,
    "loftGroupId" INTEGER NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "vaccinationDate" TIMESTAMP(3) NOT NULL,
    "vet" TEXT,
    "batchNo" TEXT,
    "notes" TEXT,
    "documentUrl" TEXT,
    "documentKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VaccinationRecord_pkey" PRIMARY KEY ("id")
);

-- AlterTable EventInventoryItems: add loftGroupId FK
ALTER TABLE "EventInventoryItems" ADD COLUMN "ID_LOFT_GROUP" INTEGER;

-- AlterTable EventBaskets: drop old unique constraint, add new one with raceId
ALTER TABLE "EventBaskets" DROP CONSTRAINT IF EXISTS "EventBaskets_ID_EVENT_BASKET_NO_PHASE_key";
CREATE UNIQUE INDEX "EventBaskets_ID_EVENT_BASKET_NO_PHASE_ID_RACE_key" ON "EventBaskets"("ID_EVENT", "BASKET_NO", "PHASE", "ID_RACE");

-- AddForeignKey LoftGroup → Events
ALTER TABLE "LoftGroup" ADD CONSTRAINT "LoftGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("ID_EVENT") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey VaccinationRecord → LoftGroup
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_loftGroupId_fkey" FOREIGN KEY ("loftGroupId") REFERENCES "LoftGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey EventInventoryItems → LoftGroup
ALTER TABLE "EventInventoryItems" ADD CONSTRAINT "EventInventoryItems_ID_LOFT_GROUP_fkey" FOREIGN KEY ("ID_LOFT_GROUP") REFERENCES "LoftGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "LoftGroup_eventId_groupNo_key" ON "LoftGroup"("eventId", "groupNo");
CREATE INDEX "LoftGroup_eventId_status_idx" ON "LoftGroup"("eventId", "status");
