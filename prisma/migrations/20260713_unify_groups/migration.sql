-- Idempotent catch-up migration: unify groups + all new schema (EventGroup, BirdEventHistory, Calcutta)
-- Safe to run whether tables exist (db push) or not.

-- === 1. Enums ===

DO $$ BEGIN CREATE TYPE "EventGroupStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "EventGroupType" AS ENUM ('LOFT', 'TAG_COLOR', 'STATUS', 'DEFAULTER', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TYPE "EventBirdGroupType" ADD VALUE IF NOT EXISTS 'LOFT'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "EventBirdGroupType" ADD VALUE IF NOT EXISTS 'TAG_COLOR'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "EventBirdGroupType" ADD VALUE IF NOT EXISTS 'STATUS'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "EventBirdGroupType" ADD VALUE IF NOT EXISTS 'DEFAULTER'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "EventBirdGroupType" ADD VALUE IF NOT EXISTS 'CUSTOM'; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "EventBirdGroupType" RENAME TO "EventGroupType";
EXCEPTION WHEN undefined_object THEN NULL; WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "RaceFormat" AS ENUM ('STANDARD', 'CALCUTTA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "BirdHistoryAction" AS ENUM ('RFID_LINKED', 'BASKET_ASSIGNED', 'GROUP_ASSIGNED', 'GROUP_MOVED', 'GROUP_REMOVED', 'STATUS_CHANGED', 'RELEASED', 'ARRIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "CalcuttaPhase" AS ENUM ('SETUP', 'AUCTION', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "CalcuttaGroupStatus" AS ENUM ('PENDING', 'BIDDING', 'SOLD', 'EARLY_BOUGHT', 'HOUSE', 'REPRICED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- === 2. EventGroup ===

CREATE TABLE IF NOT EXISTS "EventGroup" (
  "id"           SERIAL PRIMARY KEY,
  "eventId"      INTEGER NOT NULL,
  "name"         TEXT NOT NULL,
  "type"         "EventGroupType"   NOT NULL DEFAULT 'LOFT',
  "status"       "EventGroupStatus" NOT NULL DEFAULT 'OPEN',
  "hasCapacity"  BOOLEAN NOT NULL DEFAULT true,
  "capacity"     INTEGER,
  "color"        TEXT,
  "statusCodeId" INTEGER,
  "notes"        TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN ALTER TABLE "EventGroup" ADD CONSTRAINT "EventGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("ID_EVENT") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "EventGroup" ADD CONSTRAINT "EventGroup_statusCodeId_fkey" FOREIGN KEY ("statusCodeId") REFERENCES "BirdStatusCodes"("ID_BIRD_STATUS_CODE");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "EventGroup_eventId_type_idx" ON "EventGroup"("eventId", "type");
CREATE INDEX IF NOT EXISTS "EventGroup_eventId_status_idx" ON "EventGroup"("eventId", "status");
CREATE INDEX IF NOT EXISTS "EventGroup_eventId_type_isActive_idx" ON "EventGroup"("eventId", "type", "isActive");

ALTER TABLE "EventGroup" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT false;

-- === 3. VaccinationRecord: swap loftGroupId → eventGroupId ===

ALTER TABLE "VaccinationRecord" ADD COLUMN IF NOT EXISTS "eventGroupId" INTEGER;

DO $$ BEGIN ALTER TABLE "VaccinationRecord" DROP CONSTRAINT "VaccinationRecord_loftGroupId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE "VaccinationRecord" DROP COLUMN IF EXISTS "loftGroupId";

DO $$ BEGIN ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_eventGroupId_fkey" FOREIGN KEY ("eventGroupId") REFERENCES "EventGroup"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- === 4. BirdGroupHistory, BirdBreederHistory, BirdVaccinationRecord ===

CREATE TABLE IF NOT EXISTS "BirdGroupHistory" (
  "id"              SERIAL PRIMARY KEY,
  "inventoryItemId" INTEGER NOT NULL,
  "fromGroupName"   TEXT NOT NULL,
  "movedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE "BirdGroupHistory" ADD CONSTRAINT "BirdGroupHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BirdBreederHistory" (
  "id"              SERIAL PRIMARY KEY,
  "inventoryItemId" INTEGER NOT NULL,
  "fromBreederName" TEXT NOT NULL,
  "transferredAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE "BirdBreederHistory" ADD CONSTRAINT "BirdBreederHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BirdVaccinationRecord" (
  "id"                  SERIAL PRIMARY KEY,
  "vaccinationRecordId" INTEGER NOT NULL,
  "inventoryItemId"     INTEGER NOT NULL,
  "recordedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE "BirdVaccinationRecord" ADD CONSTRAINT "BirdVaccinationRecord_vaccinationRecordId_fkey" FOREIGN KEY ("vaccinationRecordId") REFERENCES "VaccinationRecord"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BirdVaccinationRecord" ADD CONSTRAINT "BirdVaccinationRecord_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BirdVaccinationRecord" ADD CONSTRAINT "BirdVaccinationRecord_uq" UNIQUE ("vaccinationRecordId", "inventoryItemId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- === 5. EventInventoryItem: new group FK columns ===

DO $$ BEGIN ALTER TABLE "EventInventoryItem" DROP CONSTRAINT "EventInventoryItem_ID_LOFT_GROUP_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
ALTER TABLE "EventInventoryItem" DROP COLUMN IF EXISTS "ID_LOFT_GROUP";

ALTER TABLE "EventInventoryItem" ADD COLUMN IF NOT EXISTS "ID_CURRENT_GROUP" INTEGER;
ALTER TABLE "EventInventoryItem" ADD COLUMN IF NOT EXISTS "tagColorGroupId"  INTEGER;
ALTER TABLE "EventInventoryItem" ADD COLUMN IF NOT EXISTS "statusGroupId"    INTEGER;

DO $$ BEGIN ALTER TABLE "EventInventoryItem" ADD CONSTRAINT "EventInventoryItem_ID_CURRENT_GROUP_fkey" FOREIGN KEY ("ID_CURRENT_GROUP") REFERENCES "EventGroup"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EventInventoryItem" ADD CONSTRAINT "EventInventoryItem_tagColorGroupId_fkey" FOREIGN KEY ("tagColorGroupId") REFERENCES "EventGroup"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EventInventoryItem" ADD CONSTRAINT "EventInventoryItem_statusGroupId_fkey" FOREIGN KEY ("statusGroupId") REFERENCES "EventGroup"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- === 6. BirdEventHistory ===

CREATE TABLE IF NOT EXISTS "BirdEventHistory" (
  "id"                   SERIAL PRIMARY KEY,
  "eventInventoryItemId" INTEGER NOT NULL,
  "action"               "BirdHistoryAction" NOT NULL,
  "detail"               TEXT,
  "groupId"              INTEGER,
  "basketId"             INTEGER,
  "performedById"        TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE "BirdEventHistory" ADD CONSTRAINT "BirdEventHistory_eventInventoryItemId_fkey" FOREIGN KEY ("eventInventoryItemId") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "BirdEventHistory_itemId_createdAt_idx" ON "BirdEventHistory"("eventInventoryItemId", "createdAt");

-- === 7. Events: raceFormat ===

ALTER TABLE "Events" ADD COLUMN IF NOT EXISTS "raceFormat" "RaceFormat" NOT NULL DEFAULT 'STANDARD';

-- === 8. Calcutta tables ===

CREATE TABLE IF NOT EXISTS "CalcuttaConfig" (
  "id"                SERIAL PRIMARY KEY,
  "eventId"           INTEGER NOT NULL UNIQUE,
  "pricePerBird"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "targetGroupSize"   INTEGER NOT NULL DEFAULT 15,
  "biddingDuration"   INTEGER NOT NULL DEFAULT 120,
  "antiSnipeDuration" INTEGER NOT NULL DEFAULT 10,
  "bidRaiseOptions"   INTEGER[] NOT NULL DEFAULT '{}',
  "youtubeStreamUrl"  TEXT,
  "phase"             "CalcuttaPhase" NOT NULL DEFAULT 'SETUP',
  "activeGroupId"     INTEGER,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE "CalcuttaConfig" ADD CONSTRAINT "CalcuttaConfig_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("ID_EVENT") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CalcuttaBetGroup" (
  "id"              SERIAL PRIMARY KEY,
  "eventId"         INTEGER NOT NULL,
  "groupNumber"     INTEGER NOT NULL,
  "birdCount"       INTEGER NOT NULL,
  "calculatedPrice" DECIMAL(10,2) NOT NULL,
  "startingBid"     DECIMAL(10,2) NOT NULL,
  "status"          "CalcuttaGroupStatus" NOT NULL DEFAULT 'PENDING',
  "ownerId"         TEXT,
  "finalPrice"      DECIMAL(10,2),
  "isHouse"         BOOLEAN NOT NULL DEFAULT false,
  "lastBidAt"       TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE "CalcuttaBetGroup" ADD CONSTRAINT "CalcuttaBetGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("ID_EVENT") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CalcuttaBetGroup" ADD CONSTRAINT "CalcuttaBetGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "CalcuttaBetGroup_eventId_status_idx" ON "CalcuttaBetGroup"("eventId", "status");

CREATE TABLE IF NOT EXISTS "CalcuttaBetGroupMember" (
  "id"               SERIAL PRIMARY KEY,
  "groupId"          INTEGER NOT NULL,
  "eventInventoryId" INTEGER NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE "CalcuttaBetGroupMember" ADD CONSTRAINT "CalcuttaBetGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CalcuttaBetGroup"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CalcuttaBetGroupMember" ADD CONSTRAINT "CalcuttaBetGroupMember_eventInventoryId_fkey" FOREIGN KEY ("eventInventoryId") REFERENCES "EventInventory"("ID_EVENT_INVENTORY") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "CalcuttaBetGroupMember_groupId_eventInventoryId_key" ON "CalcuttaBetGroupMember"("groupId", "eventInventoryId");
CREATE INDEX IF NOT EXISTS "CalcuttaBetGroupMember_eventInventoryId_idx" ON "CalcuttaBetGroupMember"("eventInventoryId");

CREATE TABLE IF NOT EXISTS "CalcuttaBid" (
  "id"        SERIAL PRIMARY KEY,
  "groupId"   INTEGER NOT NULL,
  "bidderId"  TEXT NOT NULL,
  "amount"    DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN ALTER TABLE "CalcuttaBid" ADD CONSTRAINT "CalcuttaBid_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CalcuttaBetGroup"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CalcuttaBid" ADD CONSTRAINT "CalcuttaBid_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "user"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "CalcuttaBid_groupId_amount_idx" ON "CalcuttaBid"("groupId", "amount");

-- === 9. Fix EventBaskets unique index ===

DO $$ BEGIN ALTER TABLE "EventBaskets" DROP CONSTRAINT "EventBaskets_ID_EVENT_BASKET_NO_PHASE_key";
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DROP INDEX IF EXISTS "EventBaskets_ID_EVENT_BASKET_NO_PHASE_key";
CREATE UNIQUE INDEX IF NOT EXISTS "EventBaskets_ID_EVENT_BASKET_NO_PHASE_ID_RACE_key" ON "EventBaskets"("ID_EVENT", "BASKET_NO", "PHASE", "ID_RACE");

-- === 10. Drop old tables replaced by EventGroup ===

DROP TABLE IF EXISTS "EventBirdGroupMember";
DROP TABLE IF EXISTS "EventBirdGroup";
DROP TABLE IF EXISTS "LoftGroup";
