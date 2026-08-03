-- Add AverageFilterMode enum and average config tables (idempotent)

DO $$ BEGIN
  CREATE TYPE "AverageFilterMode" AS ENUM ('ALL', 'BY_TYPE', 'MANUAL', 'COMBINATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AverageConfigs" (
    "id"         SERIAL              NOT NULL,
    "seasonId"   INTEGER             NOT NULL,
    "name"       TEXT                NOT NULL,
    "isPublic"   BOOLEAN             NOT NULL DEFAULT false,
    "filterMode" "AverageFilterMode" NOT NULL DEFAULT 'ALL',
    "createdAt"  TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AverageConfigs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AverageConfigRaceTypes" (
    "configId"   INTEGER NOT NULL,
    "raceTypeId" INTEGER NOT NULL,

    CONSTRAINT "AverageConfigRaceTypes_pkey" PRIMARY KEY ("configId", "raceTypeId")
);

CREATE TABLE IF NOT EXISTS "AverageConfigRaces" (
    "configId" INTEGER NOT NULL,
    "raceId"   INTEGER NOT NULL,

    CONSTRAINT "AverageConfigRaces_pkey" PRIMARY KEY ("configId", "raceId")
);

CREATE INDEX IF NOT EXISTS "AverageConfigs_seasonId_idx" ON "AverageConfigs"("seasonId");

DO $$ BEGIN
  ALTER TABLE "AverageConfigs"
      ADD CONSTRAINT "AverageConfigs_seasonId_fkey"
      FOREIGN KEY ("seasonId") REFERENCES "Seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AverageConfigRaceTypes"
      ADD CONSTRAINT "AverageConfigRaceTypes_configId_fkey"
      FOREIGN KEY ("configId") REFERENCES "AverageConfigs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AverageConfigRaceTypes"
      ADD CONSTRAINT "AverageConfigRaceTypes_raceTypeId_fkey"
      FOREIGN KEY ("raceTypeId") REFERENCES "RaceType"("ID_RACE_TYPE") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AverageConfigRaces"
      ADD CONSTRAINT "AverageConfigRaces_configId_fkey"
      FOREIGN KEY ("configId") REFERENCES "AverageConfigs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AverageConfigRaces"
      ADD CONSTRAINT "AverageConfigRaces_raceId_fkey"
      FOREIGN KEY ("raceId") REFERENCES "Race"("ID_RACE") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
