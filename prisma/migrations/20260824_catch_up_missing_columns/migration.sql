-- Catch-up migration: add all columns/tables missing from prior migrations

-- === 1. Birds: IMAGE and IMAGE_KEY columns ===
ALTER TABLE "Birds" ADD COLUMN IF NOT EXISTS "IMAGE"     TEXT;
ALTER TABLE "Birds" ADD COLUMN IF NOT EXISTS "IMAGE_KEY" TEXT;

-- === 2. Race: transport, betting, station columns ===
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransportStatus') THEN
    CREATE TYPE "TransportStatus" AS ENUM ('IDLE', 'IN_TRANSIT', 'ARRIVED');
  END IF;
END $$;

ALTER TABLE "Race" ADD COLUMN IF NOT EXISTS "TRANSPORT_STATUS"    "TransportStatus" NOT NULL DEFAULT 'IDLE';
ALTER TABLE "Race" ADD COLUMN IF NOT EXISTS "TRANSPORT_STARTED_AT" TIMESTAMP(3);
ALTER TABLE "Race" ADD COLUMN IF NOT EXISTS "TRANSPORT_ENDED_AT"   TIMESTAMP(3);
ALTER TABLE "Race" ADD COLUMN IF NOT EXISTS "BETTING_OPEN"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Race" ADD COLUMN IF NOT EXISTS "ID_RACE_STATION"      INTEGER;

DO $$ BEGIN
  ALTER TABLE "Race" ADD CONSTRAINT "Race_ID_RACE_STATION_fkey"
    FOREIGN KEY ("ID_RACE_STATION") REFERENCES "RaceStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- === 3. RaceItem: displayStatusId ===
ALTER TABLE "RaceItem" ADD COLUMN IF NOT EXISTS "ID_DISPLAY_STATUS" INTEGER;

-- === 4. BirdStatusPresets table ===
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusTrigger') THEN
    CREATE TYPE "StatusTrigger" AS ENUM ('REGISTER', 'CHECKIN', 'RELEASE', 'ARRIVE', 'LOST', 'INJURED', 'MANUAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "BirdStatusPresets" (
  "ID_BIRD_STATUS_PRESET" SERIAL       NOT NULL,
  "ID_SEASON"             INTEGER,
  "CODE"                  TEXT         NOT NULL,
  "LABEL"                 TEXT         NOT NULL,
  "COLOR"                 TEXT,
  "TRIGGER"               "StatusTrigger" NOT NULL DEFAULT 'MANUAL',
  "SORT_ORDER"            INTEGER      NOT NULL DEFAULT 0,
  "IS_ACTIVE"             BOOLEAN      NOT NULL DEFAULT true,
  "CREATED_AT"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BirdStatusPresets_pkey" PRIMARY KEY ("ID_BIRD_STATUS_PRESET")
);

CREATE INDEX IF NOT EXISTS "BirdStatusPresets_ID_SEASON_TRIGGER_idx"
  ON "BirdStatusPresets"("ID_SEASON", "TRIGGER");

DO $$ BEGIN
  ALTER TABLE "BirdStatusPresets" ADD CONSTRAINT "BirdStatusPresets_ID_SEASON_fkey"
    FOREIGN KEY ("ID_SEASON") REFERENCES "Seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RaceItem" ADD CONSTRAINT "RaceItem_ID_DISPLAY_STATUS_fkey"
    FOREIGN KEY ("ID_DISPLAY_STATUS") REFERENCES "BirdStatusPresets"("ID_BIRD_STATUS_PRESET") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- BirdGroupHistory, BirdBreederHistory, BirdVaccinationRecord already created in 20260713_unify_groups
