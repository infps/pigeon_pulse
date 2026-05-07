-- AlterTable: EventBaskets add ID_RACE
ALTER TABLE "EventBaskets" ADD COLUMN "ID_RACE" INTEGER;

-- AlterTable: RaceItemResult add ID_ARRIVAL_GROUP
ALTER TABLE "RaceItemResult" ADD COLUMN "ID_ARRIVAL_GROUP" INTEGER;

-- DropIndex: old composite index on EventBaskets
DROP INDEX IF EXISTS "EventBaskets_eventId_phase_idx";

-- CreateIndex: new composite index incl raceId
CREATE INDEX "EventBaskets_eventId_phase_raceId_idx" ON "EventBaskets"("ID_EVENT", "PHASE", "ID_RACE");

-- AddForeignKey: EventBaskets.ID_RACE -> Race.ID_RACE
ALTER TABLE "EventBaskets" ADD CONSTRAINT "EventBaskets_ID_RACE_fkey" FOREIGN KEY ("ID_RACE") REFERENCES "Race"("ID_RACE") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: RaceItemResult.ID_ARRIVAL_GROUP -> ArrivalGroup.id
ALTER TABLE "RaceItemResult" ADD CONSTRAINT "RaceItemResult_ID_ARRIVAL_GROUP_fkey" FOREIGN KEY ("ID_ARRIVAL_GROUP") REFERENCES "ArrivalGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
