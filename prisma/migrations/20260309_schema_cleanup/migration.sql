-- Schema Cleanup Migration
-- 1. Drop orphaned legacy tables (BirdsView, Users/LegacyUser)
-- 2. Rename auth tables: user→Users, session→Sessions, account→Accounts, verification→Verifications
-- 3. Rename PerchFeeItem→BirdFeeItems
-- 4. Legacy DB alignment (from align_with_legacy_db if not yet applied)

-- ============================================================
-- LEGACY CLEANUP: Drop FKs on legacy tables (IF EXISTS for safety)
-- ============================================================
ALTER TABLE IF EXISTS "BirdsView" DROP CONSTRAINT IF EXISTS "BirdsView_ID_PICTURE_fkey";
ALTER TABLE IF EXISTS "BirdsView" DROP CONSTRAINT IF EXISTS "BirdsView_LOST_ID_RACE_fkey";
ALTER TABLE IF EXISTS "Log" DROP CONSTRAINT IF EXISTS "Log_ID_USER_fkey";
ALTER TABLE IF EXISTS "LogUserLoggedin" DROP CONSTRAINT IF EXISTS "LogUserLoggedin_ID_LOG_fkey";
ALTER TABLE IF EXISTS "LogUserLoggedin" DROP CONSTRAINT IF EXISTS "LogUserLoggedin_ID_USER_fkey";
ALTER TABLE IF EXISTS "LogUserLoggedout" DROP CONSTRAINT IF EXISTS "LogUserLoggedout_ID_LOG_fkey";
ALTER TABLE IF EXISTS "RightGroupLines" DROP CONSTRAINT IF EXISTS "RightGroupLines_ID_RIGHT_GROUP_fkey";
ALTER TABLE IF EXISTS "SystemRequirements" DROP CONSTRAINT IF EXISTS "SystemRequirements_ID_SYSTEM_UPDATE_fkey";
ALTER TABLE IF EXISTS "TmpBets" DROP CONSTRAINT IF EXISTS "TmpBets_ID_EVENT_INVENTORY_ITEM_fkey";
ALTER TABLE IF EXISTS "UserRightGroups" DROP CONSTRAINT IF EXISTS "UserRightGroups_ID_RIGHT_GROUP_fkey";
ALTER TABLE IF EXISTS "UserRightGroups" DROP CONSTRAINT IF EXISTS "UserRightGroups_ID_USER_fkey";

-- Drop orphaned legacy tables
DROP TABLE IF EXISTS "BirdsView";
DROP TABLE IF EXISTS "DatasyncSys";
DROP TABLE IF EXISTS "DatasyncWeb";
DROP TABLE IF EXISTS "IbeLogBlobFields";
DROP TABLE IF EXISTS "IbeLogFields";
DROP TABLE IF EXISTS "IbeLogKeys";
DROP TABLE IF EXISTS "IbeLogTables";
DROP TABLE IF EXISTS "Log";
DROP TABLE IF EXISTS "LogUserLoggedin";
DROP TABLE IF EXISTS "LogUserLoggedout";
DROP TABLE IF EXISTS "ReportClasses";
DROP TABLE IF EXISTS "ReportIds";
DROP TABLE IF EXISTS "Reports";
DROP TABLE IF EXISTS "RightGroupLines";
DROP TABLE IF EXISTS "RightGroups";
DROP TABLE IF EXISTS "SystemCfg";
DROP TABLE IF EXISTS "SystemInfo";
DROP TABLE IF EXISTS "SystemRequirements";
DROP TABLE IF EXISTS "SystemSession";
DROP TABLE IF EXISTS "SystemUpdates";
DROP TABLE IF EXISTS "TmpAvgSpeed";
DROP TABLE IF EXISTS "TmpBets";
DROP TABLE IF EXISTS "TmpId";
DROP TABLE IF EXISTS "UserRightGroups";

-- Drop legacy "Users" table (LegacyUser — orphaned, no active FKs)
DROP TABLE IF EXISTS "Users";

-- ============================================================
-- LEGACY ALIGNMENT: Fix indexes/PKs (idempotent)
-- ============================================================
DROP INDEX IF EXISTS "EventRaceNumber_ID_NUMBER_GROUP_ID_EVENT_key";
DROP INDEX IF EXISTS "Partners_ID_EVENT_INVENTORY_ID_BREEDER_key";
DROP INDEX IF EXISTS "RaceItemScan_ID_RACE_ID_RACE_ITEM_key";

DO $$ BEGIN
  ALTER TABLE "AvgWinnerPrizes" ALTER COLUMN "ID_EVENT_INVENTORY_ITEM" DROP DEFAULT;
EXCEPTION WHEN others THEN NULL;
END $$;
DROP SEQUENCE IF EXISTS "avgwinnerprizes_id_event_inventory_item_seq";

DO $$ BEGIN
  ALTER TABLE "EventRaceNumber" ADD CONSTRAINT "EventRaceNumber_pkey" PRIMARY KEY ("ID_EVENT", "ID_NUMBER_GROUP");
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Partners" ADD CONSTRAINT "Partners_pkey" PRIMARY KEY ("ID_BREEDER", "ID_EVENT_INVENTORY");
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RaceItemScan" ADD CONSTRAINT "RaceItemScan_pkey" PRIMARY KEY ("ID_RACE", "ID_RACE_ITEM");
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- RENAME AUTH TABLES: user→Users, session→Sessions, etc.
-- ============================================================

-- Rename "user" → "Users" (legacy "Users" already dropped above)
ALTER TABLE "user" RENAME TO "Users";

-- Rename "session" → "Sessions"
ALTER TABLE "session" RENAME TO "Sessions";

-- Rename "account" → "Accounts"
ALTER TABLE "account" RENAME TO "Accounts";

-- Rename "verification" → "Verifications"
ALTER TABLE "verification" RENAME TO "Verifications";

-- ============================================================
-- RENAME PerchFeeItem → BirdFeeItems
-- ============================================================

-- Drop FK before rename
ALTER TABLE "PerchFeeItem" DROP CONSTRAINT IF EXISTS "PerchFeeItem_ID_FEE_SCHEME_fkey";

-- Rename table
ALTER TABLE "PerchFeeItem" RENAME TO "BirdFeeItems";

-- Recreate FK with new name
ALTER TABLE "BirdFeeItems" ADD CONSTRAINT "BirdFeeItems_ID_FEE_SCHEME_fkey"
  FOREIGN KEY ("ID_FEE_SCHEME") REFERENCES "FeeScheme"("ID_FEE_SCHEME") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- RECREATE RaceTypeFeeScheme FKs (if not exist)
-- ============================================================
DO $$ BEGIN
  ALTER TABLE "RaceTypeFeeScheme" ADD CONSTRAINT "RaceTypeFeeScheme_raceTypeId_fkey"
    FOREIGN KEY ("raceTypeId") REFERENCES "RaceType"("ID_RACE_TYPE") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RaceTypeFeeScheme" ADD CONSTRAINT "RaceTypeFeeScheme_feeSchemeId_fkey"
    FOREIGN KEY ("feeSchemeId") REFERENCES "FeeScheme"("ID_FEE_SCHEME") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AvgWinnerPrizes FK
DO $$ BEGIN
  ALTER TABLE "AvgWinnerPrizes" ADD CONSTRAINT "AvgWinnerPrizes_ID_EVENT_INVENTORY_ITEM_fkey"
    FOREIGN KEY ("ID_EVENT_INVENTORY_ITEM") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
