-- Migration: Season↔Event relationship flip
-- Before: Event has seasonId FK → Season
-- After:  Season has eventId FK → Event; all operational FKs point to Season instead of Event

-- ============================================================
-- STEP 1: Add EVENT_ID to Seasons (nullable for backfill)
-- ============================================================
ALTER TABLE "Seasons" ADD COLUMN "EVENT_ID" INTEGER;

-- ============================================================
-- STEP 2: Add scheme FK columns to Seasons
-- ============================================================
ALTER TABLE "Seasons"
  ADD COLUMN "ID_FEE_SCHEME"              INTEGER,
  ADD COLUMN "ID_BETTING_SCHEME"          INTEGER,
  ADD COLUMN "ID_FINAL_PRIZE_SCHEME"      INTEGER,
  ADD COLUMN "ID_HOT_SPOT1_PRIZE_SCHEME"  INTEGER,
  ADD COLUMN "ID_HOT_SPOT2_PRIZE_SCHEME"  INTEGER,
  ADD COLUMN "ID_HOT_SPOT3_PRIZE_SCHEME"  INTEGER,
  ADD COLUMN "ID_HOT_SPOT_AVG_PRIZE_SCHEME" INTEGER;

-- ============================================================
-- STEP 3: Backfill Seasons.EVENT_ID and copy scheme IDs from Events
-- ============================================================
DO $$
BEGIN
  -- For seasons that already have an Event linked via Events.SEASON_ID
  UPDATE "Seasons" s
  SET
    "EVENT_ID"                    = e."ID_EVENT",
    "ID_FEE_SCHEME"               = e."ID_FEE_SCHEME",
    "ID_BETTING_SCHEME"           = e."ID_BETTING_SCHEME",
    "ID_FINAL_PRIZE_SCHEME"       = e."ID_FINAL_PRIZE_SCHEME",
    "ID_HOT_SPOT1_PRIZE_SCHEME"   = e."ID_HOT_SPOT1_PRIZE_SCHEME",
    "ID_HOT_SPOT2_PRIZE_SCHEME"   = e."ID_HOT_SPOT2_PRIZE_SCHEME",
    "ID_HOT_SPOT3_PRIZE_SCHEME"   = e."ID_HOT_SPOT3_PRIZE_SCHEME",
    "ID_HOT_SPOT_AVG_PRIZE_SCHEME" = e."ID_HOT_SPOT_AVG_PRIZE_SCHEME"
  FROM "Events" e
  WHERE e."SEASON_ID" = s."id";

  -- For any orphaned Events that have no Season yet: create a default Season per Event
  INSERT INTO "Seasons" ("name", "startDate", "endDate", "isActive", "EVENT_ID",
    "ID_FEE_SCHEME", "ID_BETTING_SCHEME", "ID_FINAL_PRIZE_SCHEME",
    "ID_HOT_SPOT1_PRIZE_SCHEME", "ID_HOT_SPOT2_PRIZE_SCHEME",
    "ID_HOT_SPOT3_PRIZE_SCHEME", "ID_HOT_SPOT_AVG_PRIZE_SCHEME")
  SELECT
    COALESCE(e."EVENT_NAME", 'Season 1'),
    COALESCE(e."EVENT_DATE", NOW()),
    COALESCE(e."END_DATE", NOW() + INTERVAL '6 months'),
    TRUE,
    e."ID_EVENT",
    e."ID_FEE_SCHEME",
    e."ID_BETTING_SCHEME",
    e."ID_FINAL_PRIZE_SCHEME",
    e."ID_HOT_SPOT1_PRIZE_SCHEME",
    e."ID_HOT_SPOT2_PRIZE_SCHEME",
    e."ID_HOT_SPOT3_PRIZE_SCHEME",
    e."ID_HOT_SPOT_AVG_PRIZE_SCHEME"
  FROM "Events" e
  WHERE e."ID_EVENT" NOT IN (
    SELECT "EVENT_ID" FROM "Seasons" WHERE "EVENT_ID" IS NOT NULL
  );
END $$;

-- ============================================================
-- STEP 4: Make EVENT_ID NOT NULL after backfill
-- ============================================================
ALTER TABLE "Seasons" ALTER COLUMN "EVENT_ID" SET NOT NULL;

-- ============================================================
-- STEP 5: Add SEASON_ID columns to all operational tables (nullable first)
-- ============================================================
ALTER TABLE "Race"               ADD COLUMN "SEASON_ID" INTEGER;
ALTER TABLE "EventInventory"     ADD COLUMN "SEASON_ID" INTEGER;
ALTER TABLE "EventBaskets"       ADD COLUMN "SEASON_ID" INTEGER;
ALTER TABLE "EventGroup"         ADD COLUMN "seasonId"  INTEGER;
ALTER TABLE "RaceStation"        ADD COLUMN "seasonId"  INTEGER;
ALTER TABLE "CalcuttaConfig"     ADD COLUMN "seasonId"  INTEGER;
ALTER TABLE "CalcuttaBetGroup"   ADD COLUMN "seasonId"  INTEGER;
ALTER TABLE "EventMessages"      ADD COLUMN "SEASON_ID" INTEGER;
ALTER TABLE "EventStoreListings" ADD COLUMN "SEASON_ID" INTEGER;
ALTER TABLE "EventRaceNumber"    ADD COLUMN "SEASON_ID" INTEGER;
ALTER TABLE "AvgWinnerPrizes"    ADD COLUMN "SEASON_ID" INTEGER;
ALTER TABLE "PrizeValue"         ADD COLUMN "SEASON_ID" INTEGER;

-- ============================================================
-- STEP 6: Backfill SEASON_ID on all operational tables
--         Join: table.eventId → Events.ID_EVENT → Seasons.EVENT_ID
--         Pick the season with isActive=TRUE first, else the newest
-- ============================================================
DO $$
BEGIN
  -- Helper: for a given event_id, pick the best season id
  -- (isActive season, or fallback to max id for that event)

  -- Race (ID_EVENT column)
  UPDATE "Race" r
  SET "SEASON_ID" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = r."ID_EVENT"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE r."ID_EVENT" IS NOT NULL;

  -- EventInventory (ID_EVENT column)
  UPDATE "EventInventory" ei
  SET "SEASON_ID" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = ei."ID_EVENT"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE ei."ID_EVENT" IS NOT NULL;

  -- EventBaskets (ID_EVENT column)
  UPDATE "EventBaskets" eb
  SET "SEASON_ID" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = eb."ID_EVENT"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE eb."ID_EVENT" IS NOT NULL;

  -- EventGroup (eventId column)
  UPDATE "EventGroup" eg
  SET "seasonId" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = eg."eventId"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE eg."eventId" IS NOT NULL;

  -- RaceStation (eventId column)
  UPDATE "RaceStation" rs
  SET "seasonId" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = rs."eventId"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE rs."eventId" IS NOT NULL;

  -- CalcuttaConfig (eventId column)
  UPDATE "CalcuttaConfig" cc
  SET "seasonId" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = cc."eventId"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE cc."eventId" IS NOT NULL;

  -- CalcuttaBetGroup (eventId column)
  UPDATE "CalcuttaBetGroup" cbg
  SET "seasonId" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = cbg."eventId"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE cbg."eventId" IS NOT NULL;

  -- EventMessages (ID_EVENT column)
  UPDATE "EventMessages" em
  SET "SEASON_ID" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = em."ID_EVENT"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE em."ID_EVENT" IS NOT NULL;

  -- EventStoreListings (ID_EVENT column)
  UPDATE "EventStoreListings" esl
  SET "SEASON_ID" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = esl."ID_EVENT"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE esl."ID_EVENT" IS NOT NULL;

  -- EventRaceNumber (ID_EVENT column — part of composite PK)
  UPDATE "EventRaceNumber" ern
  SET "SEASON_ID" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = ern."ID_EVENT"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE ern."ID_EVENT" IS NOT NULL;

  -- AvgWinnerPrizes (ID_EVENT column)
  UPDATE "AvgWinnerPrizes" awp
  SET "SEASON_ID" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = awp."ID_EVENT"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE awp."ID_EVENT" IS NOT NULL;

  -- PrizeValue (ID_EVENT column)
  UPDATE "PrizeValue" pv
  SET "SEASON_ID" = (
    SELECT s."id" FROM "Seasons" s
    WHERE s."EVENT_ID" = pv."ID_EVENT"
    ORDER BY s."isActive" DESC, s."id" DESC
    LIMIT 1
  )
  WHERE pv."ID_EVENT" IS NOT NULL;
END $$;

-- ============================================================
-- STEP 7: Drop old FK constraints (eventId → Events)
--         Prisma-generated constraint names follow pattern: tableName_columnName_fkey
-- ============================================================
ALTER TABLE "Race"               DROP CONSTRAINT IF EXISTS "Race_ID_EVENT_fkey";
ALTER TABLE "EventInventory"     DROP CONSTRAINT IF EXISTS "EventInventory_ID_EVENT_fkey";
ALTER TABLE "EventBaskets"       DROP CONSTRAINT IF EXISTS "EventBaskets_ID_EVENT_fkey";
ALTER TABLE "EventGroup"         DROP CONSTRAINT IF EXISTS "EventGroup_eventId_fkey";
ALTER TABLE "RaceStation"        DROP CONSTRAINT IF EXISTS "RaceStation_eventId_fkey";
ALTER TABLE "CalcuttaConfig"     DROP CONSTRAINT IF EXISTS "CalcuttaConfig_eventId_fkey";
ALTER TABLE "CalcuttaBetGroup"   DROP CONSTRAINT IF EXISTS "CalcuttaBetGroup_eventId_fkey";
ALTER TABLE "EventMessages"      DROP CONSTRAINT IF EXISTS "EventMessages_ID_EVENT_fkey";
ALTER TABLE "EventStoreListings" DROP CONSTRAINT IF EXISTS "EventStoreListings_ID_EVENT_fkey";
ALTER TABLE "EventRaceNumber"    DROP CONSTRAINT IF EXISTS "EventRaceNumber_ID_EVENT_fkey";
ALTER TABLE "AvgWinnerPrizes"    DROP CONSTRAINT IF EXISTS "AvgWinnerPrizes_ID_EVENT_fkey";
ALTER TABLE "PrizeValue"         DROP CONSTRAINT IF EXISTS "PrizeValue_ID_EVENT_fkey";

-- Drop unique constraint on EventBaskets that used eventId
ALTER TABLE "EventBaskets" DROP CONSTRAINT IF EXISTS "EventBaskets_ID_EVENT_BASKET_NO_PHASE_ID_RACE_key";
-- Drop old indexes that used eventId
DROP INDEX IF EXISTS "EventBaskets_ID_EVENT_PHASE_ID_RACE_idx";
DROP INDEX IF EXISTS "EventGroup_eventId_type_idx";
DROP INDEX IF EXISTS "EventGroup_eventId_status_idx";
DROP INDEX IF EXISTS "EventGroup_eventId_type_isActive_idx";
DROP INDEX IF EXISTS "RaceStation_eventId_idx";
DROP INDEX IF EXISTS "CalcuttaBetGroup_eventId_status_idx";
DROP INDEX IF EXISTS "EventMessages_ID_EVENT_CREATED_AT_idx";

-- Drop old PK on EventRaceNumber (composite with ID_EVENT)
ALTER TABLE "EventRaceNumber" DROP CONSTRAINT IF EXISTS "EventRaceNumber_pkey";

-- ============================================================
-- STEP 8: Drop old eventId columns from all migrated tables
-- ============================================================
ALTER TABLE "Race"               DROP COLUMN IF EXISTS "ID_EVENT";
ALTER TABLE "EventInventory"     DROP COLUMN IF EXISTS "ID_EVENT";
ALTER TABLE "EventBaskets"       DROP COLUMN IF EXISTS "ID_EVENT";
ALTER TABLE "EventGroup"         DROP COLUMN IF EXISTS "eventId";
ALTER TABLE "RaceStation"        DROP COLUMN IF EXISTS "eventId";
ALTER TABLE "CalcuttaConfig"     DROP COLUMN IF EXISTS "eventId";
ALTER TABLE "CalcuttaBetGroup"   DROP COLUMN IF EXISTS "eventId";
ALTER TABLE "EventMessages"      DROP COLUMN IF EXISTS "ID_EVENT";
ALTER TABLE "EventStoreListings" DROP COLUMN IF EXISTS "ID_EVENT";
ALTER TABLE "EventRaceNumber"    DROP COLUMN IF EXISTS "ID_EVENT";
ALTER TABLE "AvgWinnerPrizes"    DROP COLUMN IF EXISTS "ID_EVENT";
ALTER TABLE "PrizeValue"         DROP COLUMN IF EXISTS "ID_EVENT";

-- ============================================================
-- STEP 9: Drop scheme FK columns and seasonId from Events table
-- ============================================================
ALTER TABLE "Events"
  DROP COLUMN IF EXISTS "SEASON_ID",
  DROP COLUMN IF EXISTS "ID_FEE_SCHEME",
  DROP COLUMN IF EXISTS "ID_BETTING_SCHEME",
  DROP COLUMN IF EXISTS "ID_FINAL_PRIZE_SCHEME",
  DROP COLUMN IF EXISTS "ID_HOT_SPOT1_PRIZE_SCHEME",
  DROP COLUMN IF EXISTS "ID_HOT_SPOT2_PRIZE_SCHEME",
  DROP COLUMN IF EXISTS "ID_HOT_SPOT3_PRIZE_SCHEME",
  DROP COLUMN IF EXISTS "ID_HOT_SPOT_AVG_PRIZE_SCHEME";

-- Drop old FK from Events to Seasons
ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_SEASON_ID_fkey";
-- Drop old FKs from Events to scheme tables
ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_ID_FEE_SCHEME_fkey";
ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_ID_BETTING_SCHEME_fkey";
ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_ID_FINAL_PRIZE_SCHEME_fkey";
ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_ID_HOT_SPOT1_PRIZE_SCHEME_fkey";
ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_ID_HOT_SPOT2_PRIZE_SCHEME_fkey";
ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_ID_HOT_SPOT3_PRIZE_SCHEME_fkey";
ALTER TABLE "Events" DROP CONSTRAINT IF EXISTS "Events_ID_HOT_SPOT_AVG_PRIZE_SCHEME_fkey";

-- ============================================================
-- STEP 10: Add new FK constraints for SEASON_ID on all migrated tables
-- ============================================================
ALTER TABLE "Race"
  ADD CONSTRAINT "Race_SEASON_ID_fkey"
  FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE SET NULL;

ALTER TABLE "EventInventory"
  ADD CONSTRAINT "EventInventory_SEASON_ID_fkey"
  FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE SET NULL;

ALTER TABLE "EventBaskets"
  ADD CONSTRAINT "EventBaskets_SEASON_ID_fkey"
  FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id");

ALTER TABLE "EventGroup"
  ADD CONSTRAINT "EventGroup_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Seasons"("id") ON DELETE CASCADE;

ALTER TABLE "RaceStation"
  ADD CONSTRAINT "RaceStation_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Seasons"("id") ON DELETE CASCADE;

ALTER TABLE "CalcuttaConfig"
  ADD CONSTRAINT "CalcuttaConfig_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Seasons"("id") ON DELETE CASCADE;

ALTER TABLE "CalcuttaBetGroup"
  ADD CONSTRAINT "CalcuttaBetGroup_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "Seasons"("id") ON DELETE CASCADE;

ALTER TABLE "EventMessages"
  ADD CONSTRAINT "EventMessages_SEASON_ID_fkey"
  FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE CASCADE;

ALTER TABLE "EventStoreListings"
  ADD CONSTRAINT "EventStoreListings_SEASON_ID_fkey"
  FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id");

ALTER TABLE "EventRaceNumber"
  ADD CONSTRAINT "EventRaceNumber_SEASON_ID_fkey"
  FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id");

ALTER TABLE "AvgWinnerPrizes"
  ADD CONSTRAINT "AvgWinnerPrizes_SEASON_ID_fkey"
  FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE SET NULL;

ALTER TABLE "PrizeValue"
  ADD CONSTRAINT "PrizeValue_SEASON_ID_fkey"
  FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE SET NULL;

-- ============================================================
-- STEP 11: Add FK from Seasons to Events
-- ============================================================
ALTER TABLE "Seasons"
  ADD CONSTRAINT "Seasons_EVENT_ID_fkey"
  FOREIGN KEY ("EVENT_ID") REFERENCES "Events"("ID_EVENT");

-- ============================================================
-- STEP 12: Add FK constraints from Seasons to scheme tables
-- ============================================================
ALTER TABLE "Seasons"
  ADD CONSTRAINT "Seasons_ID_FEE_SCHEME_fkey"
  FOREIGN KEY ("ID_FEE_SCHEME") REFERENCES "FeeScheme"("ID_FEE_SCHEME");

ALTER TABLE "Seasons"
  ADD CONSTRAINT "Seasons_ID_BETTING_SCHEME_fkey"
  FOREIGN KEY ("ID_BETTING_SCHEME") REFERENCES "BettingScheme"("ID_BETTING_SCHEME");

ALTER TABLE "Seasons"
  ADD CONSTRAINT "Seasons_ID_FINAL_PRIZE_SCHEME_fkey"
  FOREIGN KEY ("ID_FINAL_PRIZE_SCHEME") REFERENCES "PrizeScheme"("ID_PRIZE_SCHEME");

ALTER TABLE "Seasons"
  ADD CONSTRAINT "Seasons_ID_HOT_SPOT1_PRIZE_SCHEME_fkey"
  FOREIGN KEY ("ID_HOT_SPOT1_PRIZE_SCHEME") REFERENCES "PrizeScheme"("ID_PRIZE_SCHEME");

ALTER TABLE "Seasons"
  ADD CONSTRAINT "Seasons_ID_HOT_SPOT2_PRIZE_SCHEME_fkey"
  FOREIGN KEY ("ID_HOT_SPOT2_PRIZE_SCHEME") REFERENCES "PrizeScheme"("ID_PRIZE_SCHEME");

ALTER TABLE "Seasons"
  ADD CONSTRAINT "Seasons_ID_HOT_SPOT3_PRIZE_SCHEME_fkey"
  FOREIGN KEY ("ID_HOT_SPOT3_PRIZE_SCHEME") REFERENCES "PrizeScheme"("ID_PRIZE_SCHEME");

ALTER TABLE "Seasons"
  ADD CONSTRAINT "Seasons_ID_HOT_SPOT_AVG_PRIZE_SCHEME_fkey"
  FOREIGN KEY ("ID_HOT_SPOT_AVG_PRIZE_SCHEME") REFERENCES "PrizeScheme"("ID_PRIZE_SCHEME");

-- ============================================================
-- STEP 13: NOT NULL constraints for tables that had non-null eventId
-- ============================================================
-- EventBaskets.SEASON_ID was NOT NULL (ID_EVENT was NOT NULL before)
ALTER TABLE "EventBaskets" ALTER COLUMN "SEASON_ID" SET NOT NULL;

-- EventGroup.seasonId was NOT NULL (eventId was NOT NULL before)
ALTER TABLE "EventGroup" ALTER COLUMN "seasonId" SET NOT NULL;

-- RaceStation.seasonId was NOT NULL (eventId was NOT NULL before)
ALTER TABLE "RaceStation" ALTER COLUMN "seasonId" SET NOT NULL;

-- CalcuttaConfig.seasonId was NOT NULL (eventId was UNIQUE NOT NULL via @unique)
ALTER TABLE "CalcuttaConfig" ALTER COLUMN "seasonId" SET NOT NULL;

-- CalcuttaBetGroup.seasonId was NOT NULL (eventId was NOT NULL before)
ALTER TABLE "CalcuttaBetGroup" ALTER COLUMN "seasonId" SET NOT NULL;

-- EventMessages.SEASON_ID was NOT NULL (ID_EVENT was NOT NULL before)
ALTER TABLE "EventMessages" ALTER COLUMN "SEASON_ID" SET NOT NULL;

-- EventStoreListings.SEASON_ID was NOT NULL (ID_EVENT was NOT NULL before)
ALTER TABLE "EventStoreListings" ALTER COLUMN "SEASON_ID" SET NOT NULL;

-- EventRaceNumber: add new composite PK with SEASON_ID replacing ID_EVENT
ALTER TABLE "EventRaceNumber" ADD PRIMARY KEY ("SEASON_ID", "ID_NUMBER_GROUP");

-- CalcuttaConfig: restore unique constraint on seasonId
ALTER TABLE "CalcuttaConfig" ADD CONSTRAINT "CalcuttaConfig_seasonId_key" UNIQUE ("seasonId");

-- ============================================================
-- STEP 14: Recreate indexes
-- ============================================================
CREATE INDEX "Seasons_EVENT_ID_idx" ON "Seasons"("EVENT_ID");
CREATE UNIQUE INDEX "EventBaskets_SEASON_ID_BASKET_NO_PHASE_ID_RACE_key"
  ON "EventBaskets"("SEASON_ID", "BASKET_NO", "PHASE", "ID_RACE");
CREATE INDEX "EventBaskets_SEASON_ID_PHASE_ID_RACE_idx"
  ON "EventBaskets"("SEASON_ID", "PHASE", "ID_RACE");
CREATE INDEX "EventGroup_seasonId_type_idx"           ON "EventGroup"("seasonId", "type");
CREATE INDEX "EventGroup_seasonId_status_idx"         ON "EventGroup"("seasonId", "status");
CREATE INDEX "EventGroup_seasonId_type_isActive_idx"  ON "EventGroup"("seasonId", "type", "isActive");
CREATE INDEX "RaceStation_seasonId_idx"               ON "RaceStation"("seasonId");
CREATE INDEX "CalcuttaBetGroup_seasonId_status_idx"   ON "CalcuttaBetGroup"("seasonId", "status");
CREATE INDEX "EventMessages_SEASON_ID_CREATED_AT_idx" ON "EventMessages"("SEASON_ID", "CREATED_AT");
