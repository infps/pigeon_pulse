-- CreateTable (before data migration)
CREATE TABLE "RaceStationRaceType" (
    "stationId" INTEGER NOT NULL,
    "raceTypeId" INTEGER NOT NULL,

    CONSTRAINT "RaceStationRaceType_pkey" PRIMARY KEY ("stationId","raceTypeId")
);

-- AddForeignKey
ALTER TABLE "RaceStationRaceType" ADD CONSTRAINT "RaceStationRaceType_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "RaceStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceStationRaceType" ADD CONSTRAINT "RaceStationRaceType_raceTypeId_fkey" FOREIGN KEY ("raceTypeId") REFERENCES "RaceType"("ID_RACE_TYPE") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing raceTypeId rows to join table
INSERT INTO "RaceStationRaceType" ("stationId", "raceTypeId")
SELECT "id", "raceTypeId"
FROM "RaceStation"
WHERE "raceTypeId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "RaceStation" DROP CONSTRAINT "RaceStation_raceTypeId_fkey";

-- AlterTable
ALTER TABLE "RaceStation" DROP COLUMN "raceTypeId";
