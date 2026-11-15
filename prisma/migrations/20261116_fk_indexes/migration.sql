-- FK/filter indexes: prod had PKs only; race queries seq-scanned RaceItem.
-- Plain, not CONCURRENTLY: prisma migrate deploy runs this file as one multi-statement batch (implicit tx).
-- IF NOT EXISTS: safe if any were hand-created on prod.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Breeders_EMAIL_idx" ON "Breeders"("EMAIL");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Race_SEASON_ID_idx" ON "Race"("SEASON_ID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ArrivalGroup_raceId_idx" ON "ArrivalGroup"("raceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RaceItem_ID_RACE_status_idx" ON "RaceItem"("ID_RACE", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RaceItem_ID_INVENTORY_ITEM_idx" ON "RaceItem"("ID_INVENTORY_ITEM");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RaceItemResult_ID_ARRIVAL_GROUP_idx" ON "RaceItemResult"("ID_ARRIVAL_GROUP");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RacePhantomBird_ID_RACE_RF_ID_idx" ON "RacePhantomBird"("ID_RACE", "RF_ID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RacePhantomBird_ID_BIRD_idx" ON "RacePhantomBird"("ID_BIRD");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RaceIgnoreBird_ID_RACE_ID_EVENT_INVENTORY_ITEM_idx" ON "RaceIgnoreBird"("ID_RACE", "ID_EVENT_INVENTORY_ITEM");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventInventory_SEASON_ID_APPROVAL_STATUS_idx" ON "EventInventory"("SEASON_ID", "APPROVAL_STATUS");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventInventory_ID_BREEDER_idx" ON "EventInventory"("ID_BREEDER");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventInventoryItem_ID_EVENT_INVENTORY_idx" ON "EventInventoryItem"("ID_EVENT_INVENTORY");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventInventoryItem_ID_BIRD_idx" ON "EventInventoryItem"("ID_BIRD");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventInventoryItem_ID_CURRENT_GROUP_idx" ON "EventInventoryItem"("ID_CURRENT_GROUP");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventInventoryItem_statusGroupId_idx" ON "EventInventoryItem"("statusGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EventInventoryItem_tagColorGroupId_idx" ON "EventInventoryItem"("tagColorGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payments_ID_EVENT_INVENTORY_idx" ON "Payments"("ID_EVENT_INVENTORY");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payments_ID_BREEDER_idx" ON "Payments"("ID_BREEDER");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payments_BETTOR_ID_idx" ON "Payments"("BETTOR_ID");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Birds_breederId_idx" ON "Birds"("breederId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LostHistory_ID_BIRD_idx" ON "LostHistory"("ID_BIRD");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BirdGroupHistory_inventoryItemId_idx" ON "BirdGroupHistory"("inventoryItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BirdBreederHistory_inventoryItemId_idx" ON "BirdBreederHistory"("inventoryItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bets_ID_BETTOR_idx" ON "Bets"("ID_BETTOR");
