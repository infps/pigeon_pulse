/*
  Warnings:

  - You are about to drop the `EventReleaseStations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReleaseStations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EventReleaseStations" DROP CONSTRAINT "EventReleaseStations_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventReleaseStations" DROP CONSTRAINT "EventReleaseStations_stationId_fkey";

-- DropTable
DROP TABLE "EventReleaseStations";

-- DropTable
DROP TABLE "ReleaseStations";

-- DropEnum
DROP TYPE "StationStatus";
