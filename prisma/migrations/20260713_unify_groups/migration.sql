-- Unify LoftGroup + EventBirdGroup into EventGroup
-- Live data migration: loft groups win for currentGroupId when a bird is in both

-- === 1. Rename/create enums ===

-- LoftGroupStatus → EventGroupStatus (same values OPEN/CLOSED)
ALTER TYPE "LoftGroupStatus" RENAME TO "EventGroupStatus";

-- Add LOFT to EventBirdGroupType, then rename to EventGroupType
ALTER TYPE "EventBirdGroupType" ADD VALUE IF NOT EXISTS 'LOFT';
ALTER TYPE "EventBirdGroupType" RENAME TO "EventGroupType";

-- === 2. Create new tables ===

CREATE TABLE "EventGroup" (
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
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventGroup_eventId_fkey"      FOREIGN KEY ("eventId")      REFERENCES "Events"("ID_EVENT")             ON DELETE CASCADE,
  CONSTRAINT "EventGroup_statusCodeId_fkey" FOREIGN KEY ("statusCodeId") REFERENCES "BirdStatusCodes"("ID_BIRD_STATUS_CODE")
);

CREATE INDEX "EventGroup_eventId_type_idx"   ON "EventGroup"("eventId", "type");
CREATE INDEX "EventGroup_eventId_status_idx" ON "EventGroup"("eventId", "status");

CREATE TABLE "BirdGroupHistory" (
  "id"              SERIAL PRIMARY KEY,
  "inventoryItemId" INTEGER NOT NULL,
  "fromGroupName"   TEXT NOT NULL,
  "movedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BirdGroupHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE
);

CREATE TABLE "BirdBreederHistory" (
  "id"              SERIAL PRIMARY KEY,
  "inventoryItemId" INTEGER NOT NULL,
  "fromBreederName" TEXT NOT NULL,
  "transferredAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BirdBreederHistory_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE
);

CREATE TABLE "BirdVaccinationRecord" (
  "id"                  SERIAL PRIMARY KEY,
  "vaccinationRecordId" INTEGER NOT NULL,
  "inventoryItemId"     INTEGER NOT NULL,
  "recordedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BirdVaccinationRecord_vaccinationRecordId_fkey" FOREIGN KEY ("vaccinationRecordId") REFERENCES "VaccinationRecord"("id") ON DELETE CASCADE,
  CONSTRAINT "BirdVaccinationRecord_inventoryItemId_fkey"     FOREIGN KEY ("inventoryItemId")     REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE,
  CONSTRAINT "BirdVaccinationRecord_vaccinationRecordId_inventoryItemId_key" UNIQUE ("vaccinationRecordId", "inventoryItemId")
);

-- === 3. Add currentGroupId column to EventInventoryItem ===

ALTER TABLE "EventInventoryItem" ADD COLUMN "ID_CURRENT_GROUP" INTEGER;

-- === 4. Migrate LoftGroup → EventGroup ===

INSERT INTO "EventGroup" ("eventId", "name", "type", "status", "hasCapacity", "capacity", "createdAt", "updatedAt")
SELECT
  "eventId",
  CONCAT('Loft Group ', "groupNo"),
  'LOFT'::"EventGroupType",
  "status"::"EventGroupStatus",
  true,
  "capacity",
  "openedAt",
  CURRENT_TIMESTAMP
FROM "LoftGroup";

-- === 5. Update EventInventoryItem.currentGroupId from loftGroupId (loft wins) ===

UPDATE "EventInventoryItem" eii
SET "ID_CURRENT_GROUP" = eg."id"
FROM "LoftGroup" lg
JOIN "EventGroup" eg
  ON eg."name" = CONCAT('Loft Group ', lg."groupNo")
  AND eg."eventId" = lg."eventId"
  AND eg."type" = 'LOFT'
WHERE lg."id" = eii."ID_LOFT_GROUP";

-- === 6. Migrate EventBirdGroup → EventGroup ===

INSERT INTO "EventGroup" ("eventId", "name", "type", "status", "hasCapacity", "capacity", "color", "statusCodeId", "notes", "createdAt", "updatedAt")
SELECT
  "eventId",
  "name",
  "type"::text::"EventGroupType",
  'OPEN'::"EventGroupStatus",
  false,
  NULL,
  "color",
  "statusCodeId",
  "notes",
  "createdAt",
  CURRENT_TIMESTAMP
FROM "EventBirdGroup";

-- For birds with no loft group but in an EventBirdGroup, use first EventBirdGroup membership
-- (only sets currentGroupId if not already set by loft group migration above)
UPDATE "EventInventoryItem" eii
SET "ID_CURRENT_GROUP" = eg."id"
FROM (
  SELECT DISTINCT ON (bgm."eventInventoryItemId")
    bgm."eventInventoryItemId",
    eg."id" AS group_id
  FROM "EventBirdGroupMember" bgm
  JOIN "EventBirdGroup" bg ON bg."id" = bgm."groupId"
  JOIN "EventGroup" eg
    ON eg."name" = bg."name"
    AND eg."eventId" = bg."eventId"
    AND eg."type" = bg."type"::text::"EventGroupType"
  ORDER BY bgm."eventInventoryItemId", bgm."id" ASC
) mapped
WHERE mapped."eventInventoryItemId" = eii."ID_EVENT_INVENTORY_ITEM"
  AND eii."ID_CURRENT_GROUP" IS NULL;

-- === 7. Migrate VaccinationRecord: loftGroupId → eventGroupId ===

ALTER TABLE "VaccinationRecord" ADD COLUMN "eventGroupId" INTEGER;

UPDATE "VaccinationRecord" vr
SET "eventGroupId" = eg."id"
FROM "LoftGroup" lg
JOIN "EventGroup" eg
  ON eg."name" = CONCAT('Loft Group ', lg."groupNo")
  AND eg."eventId" = lg."eventId"
  AND eg."type" = 'LOFT'
WHERE lg."id" = vr."loftGroupId";

-- Snapshot: create BirdVaccinationRecord for all current members of each group at migration time
INSERT INTO "BirdVaccinationRecord" ("vaccinationRecordId", "inventoryItemId", "recordedAt")
SELECT vr."id", eii."ID_EVENT_INVENTORY_ITEM", vr."createdAt"
FROM "VaccinationRecord" vr
JOIN "EventInventoryItem" eii ON eii."ID_CURRENT_GROUP" = vr."eventGroupId"
ON CONFLICT ("vaccinationRecordId", "inventoryItemId") DO NOTHING;

ALTER TABLE "VaccinationRecord" ALTER COLUMN "eventGroupId" SET NOT NULL;
ALTER TABLE "VaccinationRecord" ADD CONSTRAINT "VaccinationRecord_eventGroupId_fkey"
  FOREIGN KEY ("eventGroupId") REFERENCES "EventGroup"("id") ON DELETE CASCADE;

-- Drop old loftGroupId from VaccinationRecord
ALTER TABLE "VaccinationRecord" DROP CONSTRAINT IF EXISTS "VaccinationRecord_loftGroupId_fkey";
ALTER TABLE "VaccinationRecord" DROP COLUMN "loftGroupId";

-- === 8. Drop currentGroupId FK + add it (now EventGroup exists) ===

ALTER TABLE "EventInventoryItem"
  ADD CONSTRAINT "EventInventoryItem_ID_CURRENT_GROUP_fkey"
  FOREIGN KEY ("ID_CURRENT_GROUP") REFERENCES "EventGroup"("id");

-- === 9. Drop old tables ===

ALTER TABLE "EventInventoryItem" DROP CONSTRAINT IF EXISTS "EventInventoryItem_ID_LOFT_GROUP_fkey";
ALTER TABLE "EventInventoryItem" DROP COLUMN "ID_LOFT_GROUP";

DROP TABLE "EventBirdGroupMember";
DROP TABLE "EventBirdGroup";
DROP TABLE "LoftGroup";
