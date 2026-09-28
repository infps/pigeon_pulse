-- Prize engine: give each RaceType an explicit prize role.
--
-- HayLoft hardcoded race type IDs in its stored procedures:
--   5 = Final race, 6 = Hot spot 1, 7 = Hot spot 2, 8 = Hot spot 3, 9 = AVG winner
-- and only those types could carry a prize (RACE_ITEM_PRIZE_VALUE_CALC_INT).
--
-- Race types are user-configurable here, so the role becomes an explicit field
-- instead of a magic ID. The backfill below preserves the legacy IDs that came
-- across in the migration.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RaceTypePrizeRole') THEN
    CREATE TYPE "RaceTypePrizeRole" AS ENUM ('NONE', 'FINAL', 'HOTSPOT_1', 'HOTSPOT_2', 'HOTSPOT_3', 'AVERAGE');
  END IF;
END $$;

ALTER TABLE "RaceType"
  ADD COLUMN IF NOT EXISTS "PRIZE_ROLE" "RaceTypePrizeRole" NOT NULL DEFAULT 'NONE';

-- Backfill the migrated legacy types. Guarded on name as well as ID so this
-- cannot mislabel a race type created after the migration.
UPDATE "RaceType" SET "PRIZE_ROLE" = 'FINAL'     WHERE "ID_RACE_TYPE" = 5 AND "TYPE_NAME" = 'Final race' AND "PRIZE_ROLE" = 'NONE';
UPDATE "RaceType" SET "PRIZE_ROLE" = 'HOTSPOT_1' WHERE "ID_RACE_TYPE" = 6 AND "TYPE_NAME" = 'Hot spot 1' AND "PRIZE_ROLE" = 'NONE';
UPDATE "RaceType" SET "PRIZE_ROLE" = 'HOTSPOT_2' WHERE "ID_RACE_TYPE" = 7 AND "TYPE_NAME" = 'Hot spot 2' AND "PRIZE_ROLE" = 'NONE';
UPDATE "RaceType" SET "PRIZE_ROLE" = 'HOTSPOT_3' WHERE "ID_RACE_TYPE" = 8 AND "TYPE_NAME" = 'Hot spot 3' AND "PRIZE_ROLE" = 'NONE';
UPDATE "RaceType" SET "PRIZE_ROLE" = 'AVERAGE'   WHERE "ID_RACE_TYPE" = 9 AND "TYPE_NAME" = 'AVG winner' AND "PRIZE_ROLE" = 'NONE';

-- Baskets with a NULL race are unprotected: the existing
-- (SEASON_ID, BASKET_NO, PHASE, ID_RACE) constraint never fires for them
-- because NULLs are distinct in a unique index. Loft baskets always store
-- NULL, and 5 race baskets in the live data do too.
--
-- PHASE is part of the key: a loft basket and a race basket legitimately share
-- a number within a season, and two such pairs exist in the live data.
--
-- Built as a plain (non-concurrent) index because migrations run in a
-- transaction; the table is small (27 rows) so the lock is momentary.
CREATE UNIQUE INDEX IF NOT EXISTS "EventBaskets_null_race_basket_no_unique"
  ON "EventBaskets" ("SEASON_ID", "PHASE", "BASKET_NO")
  WHERE "ID_RACE" IS NULL;
