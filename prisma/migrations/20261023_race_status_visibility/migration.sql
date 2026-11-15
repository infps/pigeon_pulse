-- Per-race control over which RaceItemStatus values breeders can see.
-- No rows seeded: a missing row means visible, so behaviour is unchanged.

CREATE TABLE IF NOT EXISTS "RaceStatusVisibility" (
  "id"      SERIAL NOT NULL,
  "raceId"  INTEGER NOT NULL,
  "status"  "RaceItemStatus" NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "RaceStatusVisibility_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaceStatusVisibility_raceId_fkey"
    FOREIGN KEY ("raceId") REFERENCES "Race"("ID_RACE") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RaceStatusVisibility_raceId_idx" ON "RaceStatusVisibility"("raceId");

CREATE UNIQUE INDEX IF NOT EXISTS "RaceStatusVisibility_raceId_status_key" ON "RaceStatusVisibility"("raceId", "status");
