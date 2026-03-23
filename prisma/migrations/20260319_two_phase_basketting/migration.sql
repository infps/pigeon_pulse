-- Two-Phase Basketting Migration
-- 1. Update RaceItemStatus enum: add CHECKED_IN, ARRIVED, remove RACE_BASKETED
-- 2. Create EventBaskets + BasketAssignments tables
-- 3. Remove old basket columns from RaceItem
-- 4. Drop old Basket table

-- Step 1: Add new enum values
ALTER TYPE "RaceItemStatus" ADD VALUE IF NOT EXISTS 'CHECKED_IN' BEFORE 'LOFT_BASKETED';
ALTER TYPE "RaceItemStatus" ADD VALUE IF NOT EXISTS 'ARRIVED' AFTER 'RELEASED';

-- Step 2: Migrate existing RACE_BASKETED data to ARRIVED
UPDATE "RaceItem" SET status = 'ARRIVED' WHERE status = 'RACE_BASKETED';

-- Step 3: Add BasketPhase enum
CREATE TYPE "BasketPhase" AS ENUM ('LOFT', 'RACE');

-- Step 4: Create EventBaskets table
CREATE TABLE "EventBaskets" (
    "ID_EVENT_BASKET" SERIAL NOT NULL,
    "ID_EVENT" INTEGER NOT NULL,
    "BASKET_NO" INTEGER NOT NULL,
    "CAPACITY" INTEGER NOT NULL,
    "PHASE" "BasketPhase" NOT NULL,

    CONSTRAINT "EventBaskets_pkey" PRIMARY KEY ("ID_EVENT_BASKET")
);

-- Step 5: Create BasketAssignments table
CREATE TABLE "BasketAssignments" (
    "ID_BASKET_ASSIGNMENT" SERIAL NOT NULL,
    "ID_EVENT_BASKET" INTEGER NOT NULL,
    "ID_EVENT_INVENTORY_ITEM" INTEGER NOT NULL,
    "ASSIGNED_AT" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BasketAssignments_pkey" PRIMARY KEY ("ID_BASKET_ASSIGNMENT")
);

-- Step 6: Add indexes and unique constraints
CREATE UNIQUE INDEX "EventBaskets_eventId_basketNo_phase_key" ON "EventBaskets"("ID_EVENT", "BASKET_NO", "PHASE");
CREATE INDEX "EventBaskets_eventId_phase_idx" ON "EventBaskets"("ID_EVENT", "PHASE");
CREATE UNIQUE INDEX "BasketAssignments_item_basket_key" ON "BasketAssignments"("ID_EVENT_INVENTORY_ITEM", "ID_EVENT_BASKET");
CREATE INDEX "BasketAssignments_basket_idx" ON "BasketAssignments"("ID_EVENT_BASKET");

-- Step 7: Add foreign keys
ALTER TABLE "EventBaskets" ADD CONSTRAINT "EventBaskets_ID_EVENT_fkey" FOREIGN KEY ("ID_EVENT") REFERENCES "Events"("ID_EVENT") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BasketAssignments" ADD CONSTRAINT "BasketAssignments_ID_EVENT_BASKET_fkey" FOREIGN KEY ("ID_EVENT_BASKET") REFERENCES "EventBaskets"("ID_EVENT_BASKET") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BasketAssignments" ADD CONSTRAINT "BasketAssignments_ID_EVENT_INVENTORY_ITEM_fkey" FOREIGN KEY ("ID_EVENT_INVENTORY_ITEM") REFERENCES "EventInventoryItem"("ID_EVENT_INVENTORY_ITEM") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Drop old basket foreign keys from RaceItem
ALTER TABLE "RaceItem" DROP CONSTRAINT IF EXISTS "RaceItem_ID_DIST_BASKET_fkey";
ALTER TABLE "RaceItem" DROP CONSTRAINT IF EXISTS "RaceItem_ID_RACE_BASKET_fkey";

-- Step 9: Drop old basket columns from RaceItem
ALTER TABLE "RaceItem" DROP COLUMN IF EXISTS "ID_DIST_BASKET";
ALTER TABLE "RaceItem" DROP COLUMN IF EXISTS "ID_RACE_BASKET";
ALTER TABLE "RaceItem" DROP COLUMN IF EXISTS "IS_DIST_BASKETED";

-- Step 10: Drop old Basket table
DROP TABLE IF EXISTS "Basket";
