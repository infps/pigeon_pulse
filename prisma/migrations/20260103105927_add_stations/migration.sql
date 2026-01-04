-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "ReleaseStations" (
    "stationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StationStatus" NOT NULL DEFAULT 'ACTIVE',
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseStations_pkey" PRIMARY KEY ("stationId")
);

-- CreateTable
CREATE TABLE "EventReleaseStations" (
    "eventId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,

    CONSTRAINT "EventReleaseStations_pkey" PRIMARY KEY ("eventId","stationId")
);

-- AddForeignKey
ALTER TABLE "EventReleaseStations" ADD CONSTRAINT "EventReleaseStations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("eventId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReleaseStations" ADD CONSTRAINT "EventReleaseStations_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "ReleaseStations"("stationId") ON DELETE CASCADE ON UPDATE CASCADE;
