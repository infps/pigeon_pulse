-- CreateTable
CREATE TABLE "RaceStation" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "miles" DOUBLE PRECISION,
    "km" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceStation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaceStation_eventId_idx" ON "RaceStation"("eventId");

-- AddForeignKey
ALTER TABLE "RaceStation" ADD CONSTRAINT "RaceStation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("ID_EVENT") ON DELETE CASCADE ON UPDATE CASCADE;
