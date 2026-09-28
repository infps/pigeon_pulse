-- Race classes, from WinCompanion's Classes / Class Fees screens.
--
-- Their update form gives the shape exactly:
--   Class Fee Id, Description, Class (A-F), Class Fee, Class Type, Przentry
--
-- and their list shows what the types mean:
--   type 0, przentry 10  -> "$20 - 10 for 1"      one prize per 10 entries
--   type 3, przentry 3   -> "$25 - 50, 30, 20"    three places, split by percent
--   type 1, przentry 1   -> "$20 - Winner Take All"
--
-- Rather than build a second payout engine, a class maps onto the one already
-- verified against HayLoft to the cent:
--   RATIO  -> Belgian  (winners = entries / przEntry)
--   PLACES -> Standard (przEntry places, percentages from the betting scheme)
--   WTA    -> Winner takes all
--
-- Classes are season-scoped because fees and structures change year to year.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClassPayoutType') THEN
    -- Named rather than numbered: "0" tells a reader nothing, and the legacy
    -- numbering has a gap at 2 that nobody could account for.
    CREATE TYPE "ClassPayoutType" AS ENUM ('RATIO', 'WTA', 'PLACES');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "RaceClasses" (
  "ID_RACE_CLASS" SERIAL PRIMARY KEY,
  "SEASON_ID"   INTEGER NOT NULL,
  -- The letter breeders actually say out loud: "I'm in A and C".
  "CODE"        TEXT NOT NULL,
  "DESCRIPTION" TEXT,
  "CLASS_FEE"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "PAYOUT_TYPE" "ClassPayoutType" NOT NULL DEFAULT 'WTA',
  -- Entries per prize for RATIO, number of places for PLACES, 1 for WTA.
  "PRZ_ENTRY"   INTEGER NOT NULL DEFAULT 1,
  -- House cut for this class; falls back to the betting scheme when null.
  "CUT_PERCENT" DOUBLE PRECISION,
  "SORT_ORDER"  INTEGER NOT NULL DEFAULT 0,
  "IS_ACTIVE"   BOOLEAN NOT NULL DEFAULT true,
  "CREATED_AT"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RaceClasses_season_fkey"
    FOREIGN KEY ("SEASON_ID") REFERENCES "Seasons"("id") ON DELETE CASCADE,
  -- One meaning per letter within a season.
  CONSTRAINT "RaceClasses_unique_code" UNIQUE ("SEASON_ID", "CODE")
);

CREATE INDEX IF NOT EXISTS "RaceClasses_season_idx" ON "RaceClasses" ("SEASON_ID");

-- Which birds a breeder entered into which class, and what they were charged.
-- The fee is copied at entry time so a later price change cannot rewrite what
-- somebody already agreed to pay.
CREATE TABLE IF NOT EXISTS "RaceClassEntries" (
  "ID_CLASS_ENTRY" SERIAL PRIMARY KEY,
  "ID_RACE_CLASS"  INTEGER NOT NULL,
  "ID_EVENT_INVENTORY_ITEM" INTEGER NOT NULL,
  "FEE_CHARGED"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "ID_PAYMENT"     INTEGER,
  "PAYOUT_VALUE"   DOUBLE PRECISION,
  "POSITION"       INTEGER,
  "CREATED_AT"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RaceClassEntries_class_fkey"
    FOREIGN KEY ("ID_RACE_CLASS") REFERENCES "RaceClasses"("ID_RACE_CLASS") ON DELETE CASCADE,
  CONSTRAINT "RaceClassEntries_item_fkey"
    FOREIGN KEY ("ID_EVENT_INVENTORY_ITEM") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE,
  CONSTRAINT "RaceClassEntries_payment_fkey"
    FOREIGN KEY ("ID_PAYMENT") REFERENCES "Payments"("ID_PAYMENT") ON DELETE SET NULL,
  -- A bird is in a class once.
  CONSTRAINT "RaceClassEntries_unique" UNIQUE ("ID_RACE_CLASS", "ID_EVENT_INVENTORY_ITEM")
);

CREATE INDEX IF NOT EXISTS "RaceClassEntries_item_idx"
  ON "RaceClassEntries" ("ID_EVENT_INVENTORY_ITEM");
